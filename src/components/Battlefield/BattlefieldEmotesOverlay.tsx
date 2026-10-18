import { useState, useEffect, useRef, useCallback } from 'react'
import { soundManager } from '../../utils/audioManager'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import { battleService } from '../../services/supabaseService'
import {
  EMOTES_CATALOG,
  getUnlockedEmoteIds,
  isEmoteUnlocked,
  getEmoteById,
  syncUnlockedEmotesFromProfile,
  type EmoteItem,
} from '../../utils/emotesManager'
import './BattlefieldEmotesOverlay.css'

export interface BattlefieldEmotesOverlayProps {
  roomId?: string | null
  soyP1?: boolean
  matchMode?: string
  opponentName?: string
  opponentId?: string | null
  isAsyncMatch?: boolean
  currentUserId?: string | null
  incomingRivalEmote?: { id?: number; emoteId: string; ts?: number } | null
}

export default function BattlefieldEmotesOverlay({
  roomId = null,
  soyP1 = true,
  matchMode,
  opponentName,
  opponentId: _opponentId = null,
  isAsyncMatch = false,
  currentUserId = null,
  incomingRivalEmote = null,
}: BattlefieldEmotesOverlayProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [cooldown, setCooldown] = useState<number>(0)
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => getUnlockedEmoteIds())

  // Emotes activos en pantalla (para cada lado)
  const [activeLeft, setActiveLeft] = useState<{ emote: EmoteItem; key: number; hide: boolean } | null>(null)
  const [activeRight, setActiveRight] = useState<{ emote: EmoteItem; key: number; hide: boolean } | null>(null)

  const leftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<any>(null)
  const lastEmoteIdRef = useRef<number>(0)
  const mySentLocalRef = useRef<Set<number>>(new Set())
  const mySentDbIdsRef = useRef<Set<number>>(new Set())
  const processedEmoteIdsRef = useRef<Set<number>>(new Set())
  const lastRivalEmoteTimeRef = useRef<{ [emoteId: string]: number }>({})
  const tabSessionIdRef = useRef<string>(Math.random().toString(36).slice(2) + Date.now().toString(36))

  // Sincronizar catálogo desbloqueado por eventos locales
  useEffect(() => {
    const handleUpdate = () => {
      setUnlockedIds(getUnlockedEmoteIds())
    }
    window.addEventListener('plant_arena_emotes_updated', handleUpdate)
    return () => window.removeEventListener('plant_arena_emotes_updated', handleUpdate)
  }, [])

  // Sincronización autoritativa desde el perfil de Supabase al entrar a combate
  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured()) return
    let active = true
    const cargarEmotes = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('unlocked_emotes')
          .eq('id', currentUserId)
          .maybeSingle()

        if (!error && data && Array.isArray((data as any).unlocked_emotes) && active) {
          syncUnlockedEmotesFromProfile((data as any).unlocked_emotes)
          setUnlockedIds(getUnlockedEmoteIds())
        }
      } catch (err: any) {
        console.warn('[BattlefieldEmotesOverlay] Error cargando emotes del perfil:', err)
      }
    }
    void cargarEmotes()
    return () => {
      active = false
    }
  }, [currentUserId])

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldown])

  // Despliegue visual de un emote en uno de los lados
  const triggerEmoteDisplay = useCallback((side: 'left' | 'right', emoteId: string) => {
    const emote = getEmoteById(emoteId)
    if (!emote) return

    soundManager.playSound('points', 0.6)
    const newEntry = { emote, key: Date.now() + Math.random(), hide: false }

    if (side === 'left') {
      if (leftTimerRef.current) clearTimeout(leftTimerRef.current)
      setActiveLeft(newEntry)

      // Iniciar desvanecimiento a los 2.9s y eliminar a los 3.2s
      leftTimerRef.current = setTimeout(() => {
        setActiveLeft((prev) => (prev ? { ...prev, hide: true } : null))
        setTimeout(() => {
          setActiveLeft(null)
        }, 240)
      }, 2900)
    } else {
      if (rightTimerRef.current) clearTimeout(rightTimerRef.current)
      setActiveRight(newEntry)

      rightTimerRef.current = setTimeout(() => {
        setActiveRight((prev) => (prev ? { ...prev, hide: true } : null))
        setTimeout(() => {
          setActiveRight(null)
        }, 240)
      }, 2900)
    }
  }, [])

  const currentUserIdRef = useRef<string | null>(currentUserId)
  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  const soyP1Ref = useRef<boolean>(soyP1)
  useEffect(() => {
    soyP1Ref.current = soyP1
  }, [soyP1])

  // Procesador universal de emotes entrantes del rival
  const handleIncomingEmote = useCallback((
    emoteId: string,
    senderUserId?: string,
    id?: number,
    ts?: number,
    sessionId?: string
  ) => {
    if (!emoteId) return

    // 1. Ignorar emotes enviados por esta misma pestaña o sesión local
    if (sessionId && sessionId === tabSessionIdRef.current) return
    if (id && mySentDbIdsRef.current.has(id)) return
    if (ts && mySentLocalRef.current.has(ts)) return

    // 2. Si el sender coincide con el usuario autenticado local, ignorar (es propio)
    if (senderUserId && currentUserIdRef.current && senderUserId === currentUserIdRef.current) {
      return
    }

    // 3. Deduplicación por ID de base de datos
    if (typeof id === 'number') {
      if (processedEmoteIdsRef.current.has(id)) return
      processedEmoteIdsRef.current.add(id)
      if (id > lastEmoteIdRef.current) {
        lastEmoteIdRef.current = id
      }
    }

    // 4. Deduplicación temporal rápida (1.2s) para no duplicar si broadcast y DB coinciden
    const now = Date.now()
    const lastTrigger = lastRivalEmoteTimeRef.current[emoteId] || 0
    if (now - lastTrigger < 1200) return
    lastRivalEmoteTimeRef.current[emoteId] = now

    // 5. ¡¡DESPLEGAR EN EL LADO DERECHO (DEL RIVAL)!!
    triggerEmoteDisplay('right', emoteId)
  }, [triggerEmoteDisplay])

  // Reactividad inmediata ante emotes entregados por el canal unificado de la partida (Battlefield)
  useEffect(() => {
    if (!incomingRivalEmote || !incomingRivalEmote.emoteId) return
    handleIncomingEmote(
      incomingRivalEmote.emoteId,
      undefined,
      incomingRivalEmote.id,
      incomingRivalEmote.ts
    )
  }, [incomingRivalEmote, handleIncomingEmote])

  // Conexión Realtime Dual + Polling Autoritativo RPC
  // Garantiza que los dos combatientes vean sus emotes en tiempo real en cualquier circunstancia
  useEffect(() => {
    if (!roomId || !isSupabaseConfigured()) {
      return
    }

    // Canal dedicado de emotes (match_emotes_${roomId}) con broadcast y postgres_changes
    const emoteCanal = supabase.channel(`match_emotes_${roomId}`, {
      config: { broadcast: { self: false } },
    })
    emoteCanal.on('broadcast', { event: 'battle_emote' }, ({ payload }) => {
      if (payload && (payload.emoteId || payload.emote_id)) {
        handleIncomingEmote(
          payload.emoteId || payload.emote_id,
          payload.senderUserId || payload.user_id,
          payload.id ? Number(payload.id) : undefined,
          payload.ts,
          payload.sessionId
        )
      }
    })
    emoteCanal.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'match_emotes',
        filter: `room_id=eq.${roomId}`,
      },
      (payload: any) => {
        const row = payload.new
        if (row && row.emote_id) {
          handleIncomingEmote(
            row.emote_id,
            row.user_id,
            Number(row.id),
            undefined,
            undefined
          )
        }
      }
    )
    emoteCanal.subscribe()
    channelRef.current = emoteCanal

    // Red de seguridad autoritativa por RPC: Polling periódico cada 800ms
    let cancelado = false
    const recuperarEmotes = async () => {
      if (cancelado || !isSupabaseConfigured() || !roomId) return
      try {
        const data = await battleService.matchEmotesSince(roomId, lastEmoteIdRef.current)
        if (Array.isArray(data) && data.length > 0) {
          for (const row of data) {
            handleIncomingEmote(
              row.emoteId || (row as any).emote_id,
              row.userId || (row as any).user_id,
              Number(row.id),
              undefined,
              undefined
            )
          }
        }
      } catch {
        // Red de seguridad pasiva
      }
    }

    const pollInterval = setInterval(recuperarEmotes, 800)
    void recuperarEmotes()

    return () => {
      cancelado = true
      clearInterval(pollInterval)
      if (emoteCanal) {
        void supabase.removeChannel(emoteCanal)
      }
      channelRef.current = null
    }
  }, [roomId, handleIncomingEmote])

  // Comportamiento de Bot / IA en partidas solitarias, Survivor o Asíncronas
  useEffect(() => {
    if (!isAsyncMatch && roomId && matchMode !== 'arena_ads' && matchMode !== 'practice') return

    // Saludo ocasional del bot al inicio de la batalla (2.8s)
    const introTimer = setTimeout(() => {
      if (Math.random() < 0.6) {
        const intros = ['hola', 'gg', 'que_rico', 'wow']
        const chosen = intros[Math.floor(Math.random() * intros.length)]
        triggerEmoteDisplay('right', chosen)
      }
    }, 2800)

    return () => clearTimeout(introTimer)
  }, [isAsyncMatch, roomId, matchMode, triggerEmoteDisplay])

  // Usar emote por parte del jugador local
  const handleSelectEmote = async (emoteId: string) => {
    if (cooldown > 0) return
    if (!isEmoteUnlocked(emoteId)) return

    // 1. Mostrar localmente en el lado izquierdo de inmediato
    triggerEmoteDisplay('left', emoteId)

    const nowTs = Date.now()
    mySentLocalRef.current.add(nowTs)
    const mySide = soyP1 ? 'p1' : 'p2'

    // 2. Si hay sala (partidas PvP: Friendly, Ranked, Coliseo, Torneos)
    if (roomId) {
      // A) Transmisión directa y persistencia en PostgreSQL vía battleService
      void battleService.sendMatchEmote(
        roomId,
        emoteId,
        currentUserId,
        mySide,
        tabSessionIdRef.current
      ).then((newDbId: number | null) => {
        if (newDbId) {
          mySentDbIdsRef.current.add(newDbId)
          lastEmoteIdRef.current = Math.max(lastEmoteIdRef.current, newDbId)
        }
      })

      // B) Broadcast complementario por canal secundario dedicado de emotes
      if (channelRef.current) {
        try {
          void channelRef.current.send({
            type: 'broadcast',
            event: 'battle_emote',
            payload: {
              emoteId,
              emote_id: emoteId,
              senderSide: mySide,
              senderUserId: currentUserId,
              user_id: currentUserId,
              sessionId: tabSessionIdRef.current,
              ts: nowTs,
            },
          })
        } catch {}
      }
    }

    // 3. Respuesta inteligente del rival en partidas Asíncronas, Bot, Survivor o Práctica
    if (isAsyncMatch || !roomId || matchMode === 'arena_ads' || matchMode === 'practice') {
      setTimeout(() => {
        const botResponses: Record<string, string[]> = {
          hola: ['hola', 'gg'],
          gg: ['gg', 'que_rico', 'jaja'],
          grr: ['jaja', 'que_rico', 'piedad', 'wow'],
          piedad: ['jaja', 'gg', 'que_rico'],
          jaja: ['grr', 'jaja', 'wow'],
          que_rico: ['grr', 'que_rico', 'wow'],
          unete_clan: ['que_rico', 'hola'],
          papi_dagger: ['wow', 'grr', 'jaja'],
          wow: ['wow', 'que_rico', 'papi_dagger'],
          triste: ['piedad', 'jaja', 'gg'],
        }
        const possible = botResponses[emoteId] || ['gg', 'hola', 'que_rico', 'wow']
        const chosen = possible[Math.floor(Math.random() * possible.length)]
        triggerEmoteDisplay('right', chosen)
      }, 1000 + Math.random() * 800)
    }

    // Cooldown anti-spam de 3s y cerrar cajón
    setCooldown(3)
    setIsOpen(false)
  }

  // Filtrar los emotes del catálogo que el jugador posee
  const ownedEmotes = EMOTES_CATALOG.filter((e) => unlockedIds.includes(e.id))

  return (
    <>
      {/* 1. Botón lanzador en el lado izquierdo */}
      <button
        type="button"
        className={`bf-emote-trigger-btn ${cooldown > 0 ? 'bf-emote-trigger-btn--cooldown' : ''}`}
        onClick={() => {
          if (cooldown > 0) return
          soundManager.playSound('plantation', 0.5)
          setIsOpen(!isOpen)
        }}
        title={cooldown > 0 ? `Espera ${cooldown}s` : 'Lanzar Emote'}
        aria-label="Lanzar Emote de Combate"
      >
        <span>🌻</span>
        {cooldown > 0 && <span className="bf-emote-cooldown-text">{cooldown}s</span>}
      </button>

      {/* 2. Cajón deslizante desde la izquierda con todos los emotes desbloqueados */}
      {isOpen && (
        <div className="bf-emotes-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="bf-emotes-drawer__header">
            <div className="bf-emotes-drawer__title">
              <span>💬</span>
              <span>EMOTES DE COMBATE</span>
            </div>
            <button
              type="button"
              className="bf-emotes-drawer__close"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="bf-emotes-grid">
            {ownedEmotes.map((emote) => (
              <button
                key={emote.id}
                type="button"
                className="bf-emote-btn"
                onClick={() => handleSelectEmote(emote.id)}
                title={emote.description}
              >
                <img
                  src={emote.webpSrc || emote.imageSrc}
                  alt={emote.label}
                  className="bf-emote-btn__img"
                />
                <span className="bf-emote-btn__label">{emote.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Burbuja de Emote del Jugador (Lado Izquierdo) */}
      {activeLeft && (
        <div className="bf-bubble-anchor bf-bubble-anchor--left">
          <img
            src={activeLeft.emote.webpSrc || activeLeft.emote.imageSrc}
            alt={activeLeft.emote.label}
            className={`bf-emote-bubble show ${activeLeft.hide ? 'hide' : ''}`}
          />
          {/* Chispas doradas */}
          {[...Array(8)].map((_, i) => {
            const angle = (Math.PI * 2 / 8) * i
            const dist = 32 + Math.random() * 24
            return (
              <div
                key={i}
                className="bf-emote-spark"
                style={{
                  left: `calc(50% + ${Math.cos(angle) * dist}px)`,
                  top: `calc(50% + ${Math.sin(angle) * dist}px)`,
                  ['--dx' as any]: `${Math.cos(angle) * 18}px`,
                  ['--dy' as any]: `${Math.sin(angle) * 18}px`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* 4. Burbuja de Emote del Rival (Lado Derecho) */}
      {activeRight && (
        <div className="bf-bubble-anchor bf-bubble-anchor--right">
          {opponentName && (
            <div className="bf-emote-sender-tag">{opponentName}</div>
          )}
          <img
            src={activeRight.emote.webpSrc || activeRight.emote.imageSrc}
            alt={activeRight.emote.label}
            className={`bf-emote-bubble show ${activeRight.hide ? 'hide' : ''}`}
          />
          {/* Chispas doradas */}
          {[...Array(8)].map((_, i) => {
            const angle = (Math.PI * 2 / 8) * i
            const dist = 32 + Math.random() * 24
            return (
              <div
                key={i}
                className="bf-emote-spark"
                style={{
                  left: `calc(50% + ${Math.cos(angle) * dist}px)`,
                  top: `calc(50% + ${Math.sin(angle) * dist}px)`,
                  ['--dx' as any]: `${Math.cos(angle) * 18}px`,
                  ['--dy' as any]: `${Math.sin(angle) * 18}px`,
                }}
              />
            )
          })}
        </div>
      )}
    </>
  )
}
