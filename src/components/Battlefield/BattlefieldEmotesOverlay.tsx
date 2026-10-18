import { useState, useEffect, useRef } from 'react'
import { soundManager } from '../../utils/audioManager'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  EMOTES_CATALOG,
  getUnlockedEmoteIds,
  isEmoteUnlocked,
  getEmoteById,
  type EmoteItem,
} from '../../utils/emotesManager'
import './BattlefieldEmotesOverlay.css'

export interface BattlefieldEmotesOverlayProps {
  roomId?: string | null
  soyP1?: boolean
  matchMode?: string
  opponentName?: string
}

export default function BattlefieldEmotesOverlay({
  roomId = null,
  soyP1 = true,
  matchMode: _matchMode,
  opponentName: _opponentName,
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

  // Sincronizar catálogo desbloqueado
  useEffect(() => {
    const handleUpdate = () => {
      setUnlockedIds(getUnlockedEmoteIds())
    }
    window.addEventListener('plant_arena_emotes_updated', handleUpdate)
    return () => window.removeEventListener('plant_arena_emotes_updated', handleUpdate)
  }, [])

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldown])

  // Despliegue visual de un emote en uno de los lados
  const triggerEmoteDisplay = (side: 'left' | 'right', emoteId: string) => {
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
  }

  // Conexión Realtime Multiplayer para sincronizar emotes
  useEffect(() => {
    if (!roomId || !isSupabaseConfigured()) return

    const canal = supabase.channel(`match_emotes_${roomId}`, {
      config: { broadcast: { self: false } },
    })

    canal
      .on('broadcast', { event: 'battle_emote' }, ({ payload }) => {
        if (payload && payload.emoteId) {
          // El rival envió un emote -> se muestra en el lado derecho
          triggerEmoteDisplay('right', payload.emoteId)
        }
      })
      .subscribe()

    channelRef.current = canal

    return () => {
      if (canal) {
        void supabase.removeChannel(canal)
      }
      channelRef.current = null
    }
  }, [roomId])

  // Comportamiento de Bot / IA en partidas locales, de práctica o Survivor
  useEffect(() => {
    if (roomId) return // Es partida humana con sala

    // Saludo ocasional del bot a los 3.5 segundos de iniciar la batalla
    const introTimer = setTimeout(() => {
      if (Math.random() < 0.45) {
        triggerEmoteDisplay('right', 'hola')
      }
    }, 3500)

    return () => clearTimeout(introTimer)
  }, [roomId])

  // Usar emote por parte del jugador local
  const handleSelectEmote = (emoteId: string) => {
    if (cooldown > 0) return
    if (!isEmoteUnlocked(emoteId)) return

    // 1. Mostrar localmente en el lado izquierdo
    triggerEmoteDisplay('left', emoteId)

    // 2. Transmitir por WebSocket en partidas multijugador
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'battle_emote',
        payload: {
          emoteId,
          senderSide: soyP1 ? 'p1' : 'p2',
        },
      })
    } else {
      // 3. Respuesta inteligente del bot si estamos en PvE / solitario
      if (Math.random() < 0.45) {
        setTimeout(() => {
          const botResponses: Record<string, string[]> = {
            hola: ['hola', 'gg'],
            gg: ['gg', 'que_rico', 'jaja'],
            grr: ['jaja', 'que_rico', 'piedad'],
            piedad: ['jaja', 'gg'],
            jaja: ['grr', 'jaja', 'wow'],
          }
          const possible = botResponses[emoteId] || ['gg', 'hola', 'que_rico', 'wow']
          const chosen = possible[Math.floor(Math.random() * possible.length)]
          triggerEmoteDisplay('right', chosen)
        }, 1400 + Math.random() * 800)
      }
    }

    // Cooldown anti-spam de 2.5s y cerrar cajón
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
