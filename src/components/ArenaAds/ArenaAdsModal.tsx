import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { PlantId } from '../../types/game'
import {
  ArenaAdsManager,
  ARENA_ADS_ENTRY_FEE_GOLD,
  ARENA_ADS_ENTRY_FEE_GEMS,
  type ArenaAdsRun,
  type ArenaAdsPlantOption,
  type ArenaAdsLoot,
} from '../../utils/arenaAdsManager'
import { arenaAdsService } from '../../services/arenaAdsService'
import { soundManager } from '../../utils/audioManager'
import { isFullscreen, toggleFullscreen } from '../../utils/fullscreen'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import {
  activateArenaAdsNetwork,
  deactivateArenaAdsNetwork,
  resetPopunderQuota,
  triggerArenaAdsSmartlink,
  loadArenaAdsNativeBanner,
  ARENA_ADS_NATIVE_CONTAINER_ID,
} from '../../utils/arenaAdsNetwork'
import { supabase } from '../../lib/supabaseClient'
import {
  sponsoredMissionService,
  type SponsoredMission,
} from '../../services/sponsoredMissionService'
import GoldIcon from '../Common/GoldIcon'
import './ArenaAdsModal.css'

interface ArenaAdsModalProps {
  isOpen: boolean
  onClose: () => void
  userGold: number
  userGems?: number
  claimedLevels?: number[]
  onDeductGold: (amount: number) => boolean
  onDeductGems?: (amount: number) => boolean
  onStartArenaAdsBattle: (run: ArenaAdsRun) => void
  onClaimLoot: (loot: ArenaAdsLoot, multiplier?: number, newlyClaimedLevels?: number[]) => void | Promise<void>
}

export default function ArenaAdsModal({
  isOpen,
  onClose,
  userGold,
  userGems = 0,
  claimedLevels = [],
  onDeductGold,
  onDeductGems,
  onStartArenaAdsBattle,
  onClaimLoot,
}: ArenaAdsModalProps) {
  const [activeRun, setActiveRun] = useState<ArenaAdsRun | null>(null)
  const [activeView, setActiveView] = useState<'lobby' | 'prep'>('lobby')
  const [selectedPlantOption, setSelectedPlantOption] = useState<ArenaAdsPlantOption | null>(null)
  const [claimSummary, setClaimSummary] = useState<ArenaAdsLoot | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isFullscreenActive, setIsFullscreenActive] = useState<boolean>(() => {
    if (typeof document !== 'undefined') return isFullscreen()
    return false
  })
  const [isManualFullscreen, setIsManualFullscreen] = useState<boolean>(false)

  const isEffectiveFullscreen = isFullscreenActive || isManualFullscreen

  // ── MISIONES PATROCINADAS EN EL LOBBY ──
  const [missions, setMissions] = useState<SponsoredMission[]>([])
  const [currentMissionIndex, setCurrentMissionIndex] = useState<number>(0)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right')
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [isLoadingMissions, setIsLoadingMissions] = useState<boolean>(false)
  const [isUploadingProof, setIsUploadingProof] = useState<string | null>(null)
  const [isClaimingReward, setIsClaimingReward] = useState<string | null>(null)
  const [newSponsorUrl, setNewSponsorUrl] = useState<string>('')
  const [isCreatingMission, setIsCreatingMission] = useState<boolean>(false)
  const [sponsorNotice, setSponsorNotice] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

  const handlePrevMission = () => {
    if (missions.length <= 1) return
    soundManager.playSound('click', 0.25)
    setSlideDirection('left')
    setCurrentMissionIndex((prev) => (prev > 0 ? prev - 1 : missions.length - 1))
  }

  const handleNextMission = () => {
    if (missions.length <= 1) return
    soundManager.playSound('click', 0.25)
    setSlideDirection('right')
    setCurrentMissionIndex((prev) => (prev < missions.length - 1 ? prev + 1 : 0))
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0]?.clientX ?? null)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || missions.length <= 1) return
    const touchEndX = e.changedTouches[0]?.clientX ?? touchStartX
    const diff = touchStartX - touchEndX
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNextMission()
      } else {
        handlePrevMission()
      }
    }
    setTouchStartX(null)
  }

  const loadMissions = async () => {
    setIsLoadingMissions(true)
    try {
      const list = await sponsoredMissionService.getActiveMissions()
      setMissions(list)
    } catch {
      setMissions([])
    } finally {
      setIsLoadingMissions(false)
    }
  }

  useEffect(() => {
    if (isOpen && activeView === 'lobby') {
      void loadMissions()
    }
  }, [isOpen, activeView])

  const handleUploadProof = async (missionId: string, file: File) => {
    if (!file) return
    setIsUploadingProof(missionId)
    setSponsorNotice(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        setSponsorNotice({ type: 'error', message: 'Debes iniciar sesión para subir una captura.' })
        setIsUploadingProof(null)
        return
      }

      soundManager.playSound('click', 0.4)
      const uploadRes = await sponsoredMissionService.uploadProofImage(file, user.id)
      if (!uploadRes.success || !uploadRes.url) {
        setSponsorNotice({ type: 'error', message: uploadRes.error || 'Error al subir la captura al servidor.' })
        setIsUploadingProof(null)
        return
      }

      const submitRes = await sponsoredMissionService.submitProof(missionId, uploadRes.url)
      if (!submitRes.success) {
        setSponsorNotice({ type: 'error', message: submitRes.message || submitRes.error || 'Error al registrar la captura.' })
        setIsUploadingProof(null)
        return
      }

      soundManager.playSound('plantation', 0.8)
      setSponsorNotice({ type: 'success', message: '¡Captura adjuntada con éxito! El administrador la revisará para validar tus 5 Gemas.' })
      await loadMissions()
    } catch (err: any) {
      setSponsorNotice({ type: 'error', message: err?.message || 'Error al procesar la captura.' })
    } finally {
      setIsUploadingProof(null)
    }
  }

  const handleClaimReward = async (submissionId: string) => {
    setIsClaimingReward(submissionId)
    setSponsorNotice(null)
    try {
      soundManager.playSound('click', 0.5)
      const res = await sponsoredMissionService.claimReward(submissionId)
      if (!res.success) {
        setSponsorNotice({ type: 'error', message: res.message || res.error || 'Error al reclamar recompensa.' })
        setIsClaimingReward(null)
        return
      }

      soundManager.playSound('victory', 0.9)
      setSponsorNotice({ type: 'success', message: '🎉 ¡Has reclamado tus 5 Gemas 💎 exitosamente!' })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh_user_balance'))
      }
      await loadMissions()
    } catch (err: any) {
      setSponsorNotice({ type: 'error', message: err?.message || 'Error al reclamar las gemas.' })
    } finally {
      setIsClaimingReward(null)
    }
  }

  const handleCreateMission = async () => {
    const url = newSponsorUrl.trim()
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      setSponsorNotice({ type: 'warning', message: 'Ingresa un enlace válido que comience con http:// o https://' })
      return
    }

    if (userGems < 250) {
      soundManager.playSound('surrender', 0.6)
      setSponsorNotice({
        type: 'warning',
        message: `Saldo insuficiente. Requieres 250 Gemas 💎 y dispones de ${Math.floor(userGems)} Gemas 💎.`,
      })
      return
    }

    setIsCreatingMission(true)
    setSponsorNotice(null)
    try {
      soundManager.playSound('click', 0.5)
      const res = await sponsoredMissionService.createMission(url)
      if (!res.success) {
        setSponsorNotice({ type: 'error', message: res.message || res.error || 'Error al crear la campaña de patrocinio.' })
        setIsCreatingMission(false)
        return
      }

      onDeductGems?.(250)
      soundManager.playSound('plantation', 0.9)
      setSponsorNotice({
        type: 'success',
        message: '🚀 ¡Campaña de patrocinio creada con éxito! 40 jugadores podrán completar tu misión.',
      })
      setNewSponsorUrl('')
      setCurrentMissionIndex(0)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh_user_balance'))
      }
      await loadMissions()
    } catch (err: any) {
      setSponsorNotice({ type: 'error', message: err?.message || 'Error de conexión al crear misión.' })
    } finally {
      setIsCreatingMission(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = isFullscreen()
      setIsFullscreenActive(active)
      if (!active) {
        setIsManualFullscreen(false)
      }
    }
    handleFullscreenChange()
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Activar la red de anuncios (popunder) en preparación y banner nativo en lobby
  useEffect(() => {
    if (!isOpen) {
      deactivateArenaAdsNetwork(true)
      return
    }

    if (activeView === 'prep') {
      activateArenaAdsNetwork()
    } else if (activeView === 'lobby') {
      loadArenaAdsNativeBanner()
    }

    return () => {
      if (!isOpen) {
        deactivateArenaAdsNetwork(true)
      }
    }
  }, [isOpen, activeView])

  // Preservar y recargar estado ante cambios de pestaña en móvil (cuando un anuncio abre otra pestaña y el jugador regresa)
  useEffect(() => {
    if (!isOpen) return

    const handleTabResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const stored = ArenaAdsManager.getStoredRun()
        if (stored) {
          setActiveRun({ ...stored })
          if (stored.status === 'prep') {
            setActiveView('prep')
          }
          if (stored.chosenAdvantage?.type === 'reward') {
            setSelectedPlantOption(null)
          } else if (stored.chosenAdvantage?.type?.startsWith('plant')) {
            setSelectedPlantOption(stored.chosenAdvantage.plantChosen || null)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleTabResume)
    window.addEventListener('focus', handleTabResume)
    return () => {
      document.removeEventListener('visibilitychange', handleTabResume)
      window.removeEventListener('focus', handleTabResume)
    }
  }, [isOpen])

  // Sincronizar o cargar la run guardada en caché y stock disponible
  useEffect(() => {
    if (!isOpen) return
    arenaAdsService.getStock().then((stock) => {
      ArenaAdsManager.setCachedStock(stock)
    }).catch((err) => console.warn('[ArenaAdsModal] Error fetching stock:', err))

    const stored = ArenaAdsManager.getStoredRun()
    if (stored) {
      setActiveRun(stored)
      if (stored.status === 'prep') {
        setActiveView('prep')
      } else {
        setActiveView('lobby')
      }
      if (stored.chosenAdvantage?.type === 'reward') {
        setSelectedPlantOption(null)
      } else if (stored.chosenAdvantage?.type?.startsWith('plant')) {
        setSelectedPlantOption(stored.chosenAdvantage.plantChosen || null)
      } else {
        setSelectedPlantOption(null)
      }
    } else {
      setActiveRun(null)
      setActiveView('lobby')
      setSelectedPlantOption(null)
    }
  }, [isOpen])

  const totalAccumulatedLoot = useMemo(() => {
    if (!activeRun) return null
    return activeRun.accumulatedRewards
  }, [activeRun])

  // Auto-seleccionar la opción gratuita por defecto (Columna 1) para que el mazo siempre esté listo
  useEffect(() => {
    if (!isOpen) return
    if (activeView === 'prep' && activeRun?.currentPrepChoice) {
      const defaultPlant =
        activeRun.currentPrepChoice.tacticalColumns?.[0]?.plant ||
        activeRun.currentPrepChoice.normalPlantOptions?.[0]
      if (defaultPlant && !selectedPlantOption) {
        setSelectedPlantOption(defaultPlant)
        const updated = ArenaAdsManager.applyAdvantageChoice(activeRun, {
          type: defaultPlant.isFused ? 'plant_fused' : 'plant_normal',
          option: defaultPlant,
        })
        setActiveRun({ ...updated })
      }
    }
  }, [isOpen, activeView, activeRun?.currentPrepChoice, selectedPlantOption])

  if (!isOpen || typeof document === 'undefined') return null

  // Iniciar nueva expedición (100 Oro -> 1x multiplicador, o 200 Gemas -> 2x multiplicador)
  const handleStartNewRun = async (paymentType: 'gold' | 'gems' = 'gold') => {
    if (paymentType === 'gold' && userGold < ARENA_ADS_ENTRY_FEE_GOLD) {
      soundManager.playSound('click', 0.5)
      alert(`Oro insuficiente. Necesitas al menos ${ARENA_ADS_ENTRY_FEE_GOLD} de Oro 🪙 para entrar a Arena ADS.`)
      return
    }

    if (paymentType === 'gems' && userGems < ARENA_ADS_ENTRY_FEE_GEMS) {
      soundManager.playSound('click', 0.5)
      alert(`Gemas insuficientes. Necesitas al menos ${ARENA_ADS_ENTRY_FEE_GEMS} Gemas 💎 para la entrada potenciada con 2X de botín.`)
      return
    }

    setIsProcessing(true)
    try {
      // 1. Validación y deducción autoritativa en base de datos Supabase
      const backendRes = await arenaAdsService.enterArenaAds(paymentType)
      if (!backendRes.success) {
        soundManager.playSound('click', 0.5)
        alert(backendRes.error || 'No se pudo procesar la entrada en el servidor.')
        setIsProcessing(false)
        return
      }

      // 2. Descontar en el estado local de inventario
      if (paymentType === 'gold') {
        onDeductGold(ARENA_ADS_ENTRY_FEE_GOLD)
      } else if (onDeductGems) {
        onDeductGems(ARENA_ADS_ENTRY_FEE_GEMS)
      }

      soundManager.playSound('victory', 0.6)
      resetPopunderQuota()
      const serverClaimed = backendRes.claimedArenaAdsLevels || []
      const mergedClaimed = Array.from(new Set([...(claimedLevels || []), ...serverClaimed]))
      const newRun = ArenaAdsManager.startNewRun(paymentType, Date.now(), mergedClaimed)
      setActiveRun(newRun)
      setActiveView('prep')
      setSelectedPlantOption(null)
    } finally {
      setIsProcessing(false)
    }
  }

  // Continuar la run existente desde caché
  const handleResumeRun = () => {
    if (!activeRun) return
    soundManager.playSound('click', 0.5)
    setActiveView('prep')
  }



  // Seleccionar planta para previsualizar en el rack inferior
  const handleSelectPlant = (plant: ArenaAdsPlantOption) => {
    if (!activeRun) return
    soundManager.playSound('click', 0.4)
    setSelectedPlantOption(plant)
    const updated = ArenaAdsManager.applyAdvantageChoice(activeRun, {
      type: plant.isFused ? 'plant_fused' : 'plant_normal',
      option: plant,
    })
    setActiveRun({ ...updated })
  }

  // Reroll táctico con patrocinador
  const handleRerollTacticalChoices = () => {
    if (!activeRun) return
    soundManager.playSound('click', 0.5)
    // Disparar patrocinador por el reroll
    triggerArenaAdsSmartlink()
    const updated = ArenaAdsManager.rerollPrepChoices(activeRun)
    setActiveRun({ ...updated })
    setSelectedPlantOption(null)
  }

  // Equipar planta y avanzar al combate
  const handleEquipPlantAndBattle = (plantOverride?: ArenaAdsPlantOption, isSponsored = false) => {
    if (!activeRun || !activeRun.currentPrepChoice) return
    soundManager.playSound('click', 0.7)

    const plant =
      plantOverride ||
      selectedPlantOption ||
      activeRun.currentPrepChoice.tacticalColumns?.[0]?.plant ||
      activeRun.currentPrepChoice.normalPlantOptions[0]

    if (isSponsored) {
      soundManager.playSound('victory', 0.6)
      triggerArenaAdsSmartlink()
    }

    if (plant) {
      const updated = ArenaAdsManager.applyAdvantageChoice(activeRun, {
        type: plant.isFused ? 'plant_fused' : 'plant_normal',
        option: plant,
      })
      setActiveRun({ ...updated })
      deactivateArenaAdsNetwork(true)
      const runInBattle = ArenaAdsManager.startBattle(updated)
      onClose()
      onStartArenaAdsBattle(runInBattle)
    } else {
      deactivateArenaAdsNetwork(true)
      const runInBattle = ArenaAdsManager.startBattle(activeRun)
      onClose()
      onStartArenaAdsBattle(runInBattle)
    }
  }

  // Retirarse y reclamar botín acumulado exacto (guardando en backend y en inventario local)
  const handleCashout = async () => {
    if (!activeRun) return
    setIsProcessing(true)
    try {
      const loot = { ...activeRun.accumulatedRewards }
      const mult = activeRun.multiplier || 1

      // Sincronizar centralizadamente en backend y perfiles
      await onClaimLoot(loot, mult, activeRun.newlyClaimedLevels)

      // Registrar el récord en el leaderboard del backend
      const runStarted = activeRun.startedAt || activeRun.createdAt
      const playtimeSeconds = runStarted
        ? Math.max(1, Math.round((Date.now() - runStarted) / 1000))
        : 60
      const spentGems = activeRun.paymentType === 'gems'
      const gemsSpent = (spentGems ? 200 : 0) + ((activeRun.reviveCount || 0) * 150)
      const revived = (activeRun.reviveCount || 0) > 0

      arenaAdsService
        .recordRun({
          level: activeRun.level,
          playtimeSeconds,
          spentGems,
          gemsSpent,
          revived,
          reviveCount: activeRun.reviveCount || 0,
          totalRewards: {
            gold: loot.gold || 0,
            gems: loot.gems || 0,
            items: loot.items,
          },
          status: 'retired',
        })
        .catch((err) => console.warn('[ArenaAdsModal] recordRun error:', err))

      // Mostrar el resumen con los montos exactos acumulados sin multiplicar residualmente
      setClaimSummary({
        gold: loot.gold || 0,
        gems: loot.gems || 0,
        items: { ...loot.items },
      })
      setActiveRun(null)
    } finally {
      setIsProcessing(false)
    }
  }

  return createPortal(
    <div
      className={`arena-ads-backdrop ${isEffectiveFullscreen ? 'arena-ads-backdrop--fullscreen' : ''}`}
      onClick={onClose}
    >
      <div
        className={`arena-ads-modal ${isEffectiveFullscreen ? 'arena-ads-modal--fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER COMPACTO CON BOTÓN DE CERRAR INDEPENDIENTE */}
        <div className="arena-ads-header">
          <div className="arena-ads-title-box">
            <span className="arena-ads-icon">🏰</span>
            <div>
              <h2 className="arena-ads-title">ARENA ADS</h2>
              <p className="arena-ads-subtitle">Mazmorra Roguelike</p>
            </div>
          </div>

          <div className="arena-ads-header-right">
            <div className="arena-ads-header-badges">
              <div className="arena-ads-badge arena-ads-badge--gold" title="Tu saldo de Oro">
                <GoldIcon size={16} />
                <strong>{userGold}</strong>
              </div>
              <div className="arena-ads-badge arena-ads-badge--gems" title="Tu saldo de Gemas">
                <span>💎</span>
                <strong>{userGems}</strong>
              </div>
              {activeRun && (
                <div className="arena-ads-badge arena-ads-badge--level" title="Nivel actual en mazmorra">
                  <span>⚔️</span>
                  <strong>Niv {activeRun.level}</strong>
                </div>
              )}
              {activeRun?.multiplier === 2 && (
                <div className="arena-ads-badge arena-ads-badge--2x" title="Multiplicador x2 Activo">
                  <span>⚡</span>
                  <strong>2X</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              className="arena-ads-fullscreen-btn"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setIsManualFullscreen((prev) => !prev)
                toggleFullscreen()
              }}
              title={isEffectiveFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isEffectiveFullscreen ? '🗗' : '⛶'}
            </button>

            <button type="button" className="arena-ads-close-btn" onClick={onClose} title="Cerrar">
              ✕
            </button>
          </div>
        </div>

        {/* MODAL DE RESUMEN DE RETIRO / RECOMPENSAS */}
        {claimSummary ? (
          <div className="arena-ads-content arena-ads-cashout-view">
            <div className="arena-ads-cashout-icon">🎉</div>
            <h2 className="arena-ads-cashout-title">¡TE HAS RETIRADO CON ÉXITO!</h2>
            <p className="arena-ads-cashout-desc">
              Has asegurado tu botín acumulado antes de caer en combate. Todos los recursos se han sumado a tu cuenta.
            </p>

            <div className="arena-ads-loot-pills arena-ads-loot-pills--center">
              {claimSummary.gold > 0 && (
                <div className="arena-ads-loot-pill arena-ads-loot-pill--gold">
                  <GoldIcon size={16} /> +{claimSummary.gold} Oro
                </div>
              )}
              <div className="arena-ads-loot-pill arena-ads-loot-pill--gems">
                <span>💎</span> +{claimSummary.gems} Gemas
              </div>
              {Object.entries(claimSummary.items).map(([id, qty]) => (
                <div key={id} className="arena-ads-loot-pill arena-ads-loot-pill--items">
                  <span>🎒</span> +{qty} {id}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="arena-ads-btn arena-ads-btn--primary"
              style={{ margin: '8px auto 0' }}
              onClick={() => {
                setClaimSummary(null)
                setActiveView('lobby')
              }}
            >
              CONTINUAR
            </button>
          </div>
        ) : activeView === 'lobby' ? (
          /* ── VISTA LOBBY / ENTRADA (OPTIMIZADA SIN SCROLL EN HORIZONTAL) ── */
          <div className="arena-ads-content arena-ads-lobby-layout">
            {/* Banner Header Slim */}
            <div className="arena-ads-native-banner-box" style={{ minHeight: 'auto', padding: '3px 8px' }}>
              <div className="arena-ads-native-header" style={{ margin: 0 }}>
                <span className="arena-ads-native-badge">📢 ARENA ADS PATROCINADA</span>
                <span className="arena-ads-native-title">Juega gratis contra bots patrocinado por red oficial de anuncios</span>
              </div>
              <div id={ARENA_ADS_NATIVE_CONTAINER_ID} className="arena-ads-native-banner-slot" />
            </div>

            {/* Fila / Columnas Principales del Lobby */}
            <div className="arena-ads-lobby-columns">
              {activeRun ? (
                /* Run Activa en Caché */
                <div className="arena-ads-active-run-card">
                  <div className="arena-ads-run-header">
                    <div className="arena-ads-run-title">
                      <span>⚔️</span>
                      <span>EXPEDICIÓN EN CURSO — NIVEL {activeRun.level}</span>
                    </div>
                    <span className="arena-ads-cache-tag">Guardada en caché</span>
                  </div>

                  <p className="arena-ads-run-desc">
                    Tienes una expedición activa {activeRun.multiplier === 2 ? '⚡ con MULTIPLICADOR 2X' : ''}. Puedes continuar luchando o retirarte para reclamar tu botín acumulado.
                  </p>

                  {totalAccumulatedLoot && (
                    <div className="arena-ads-loot-pills">
                      {totalAccumulatedLoot.gold > 0 && (
                        <div className="arena-ads-loot-pill arena-ads-loot-pill--gold">
                          <GoldIcon size={16} /> {totalAccumulatedLoot.gold} Oro
                        </div>
                      )}
                      <div className="arena-ads-loot-pill arena-ads-loot-pill--gems">
                        <span>💎</span> {totalAccumulatedLoot.gems} Gemas
                      </div>
                      {Object.entries(totalAccumulatedLoot.items).map(([id, qty]) => (
                        <div key={id} className="arena-ads-loot-pill arena-ads-loot-pill--items">
                          <span>🎒</span> {qty} {id}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Reglas e Instrucciones Compactas */
                <div className="arena-ads-rules-card">
                  <h3 className="arena-ads-rules-title">
                    <span>📜</span> Cómo Jugar la Mazmorra Infinita
                  </h3>
                  <div className="arena-ads-rules-grid">
                    <div className="arena-ads-rule-item">
                      <strong>1. Entrada:</strong> 350 <GoldIcon size={14} /> (1x) o 200 💎 (⚡ 2x botín).
                    </div>
                    <div className="arena-ads-rule-item">
                      <strong>2. Refuerzo Táctico:</strong> 3 Opciones (1 Gratis + 2 Fusiones con Patrocinador).
                    </div>
                    <div className="arena-ads-rule-item">
                      <strong>3. 🌻 Girasol:</strong> Siempre garantizado en tu mazo.
                    </div>
                    <div className="arena-ads-rule-item">
                      <strong>4. 👑 Botín de Combate:</strong> Recompensas fijas al ganar (Gemas, Recursos, Sobres y Skins).
                    </div>
                  </div>
                </div>
              )}

              {/* COLUMNA 2: PATROCINIOS Y MISIONES DE LA COMUNIDAD */}
              <div className="arena-ads-sponsor-card">
                <div className="arena-ads-sponsor-header">
                  <div className="arena-ads-sponsor-badge">💎 PATROCÍNATE POR 250 GEMAS</div>
                  <h4 className="arena-ads-sponsor-title">
                    <span>🎯</span> Regístrate, adjunta tu captura y recibe 5 Gemas
                  </h4>
                  <span className="arena-ads-sponsor-sub">
                    Gana gemas gratis completando misiones (máx. 40 personas por patrocinio)
                  </span>
                </div>

                {/* Notificación temporal de acciones */}
                {sponsorNotice && (
                  <div className={`arena-ads-sponsor-notice arena-ads-sponsor-notice--${sponsorNotice.type}`}>
                    <span>{sponsorNotice.message}</span>
                    <button
                      type="button"
                      className="arena-ads-sponsor-notice-close"
                      onClick={() => setSponsorNotice(null)}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Carrusel / Slider de Misiones */}
                <div
                  className="arena-ads-missions-slider-container"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {isLoadingMissions ? (
                    <div className="arena-ads-missions-loading">Cargando misiones disponibles...</div>
                  ) : missions.length === 0 ? (
                    <div className="arena-ads-missions-empty">
                      <span>🌱</span>
                      <p>No hay misiones activas por ahora. ¡Sé el primero en patrocinarte!</p>
                    </div>
                  ) : (
                    <>
                      <div className="arena-ads-missions-slider-track">
                        {missions.length > 1 && (
                          <button
                            type="button"
                            className="arena-ads-slider-arrow arena-ads-slider-arrow--prev"
                            onClick={handlePrevMission}
                            aria-label="Misión anterior"
                            title="Misión anterior"
                          >
                            ◀
                          </button>
                        )}

                        {(() => {
                          const safeMissionIndex = Math.min(currentMissionIndex, missions.length - 1)
                          const mission = missions[safeMissionIndex]
                          if (!mission) return null
                          const isFull = mission.approvedCount >= mission.maxParticipants
                          const sub = mission.mySubmission

                          return (
                            <div
                              key={mission.id}
                              className={`arena-ads-mission-item arena-ads-mission-item--slide arena-ads-mission-item--slide-${slideDirection}`}
                            >
                              <div className="arena-ads-mission-item__top">
                                <div className="arena-ads-mission-item__info">
                                  <div className="arena-ads-mission-title-row">
                                    <strong className="arena-ads-mission-title">{mission.title}</strong>
                                    {missions.length > 1 && (
                                      <span className="arena-ads-mission-counter-tag">
                                        {safeMissionIndex + 1}/{missions.length}
                                      </span>
                                    )}
                                  </div>
                                  <span className="arena-ads-mission-sponsor">
                                    Patrocinado por: <strong>@{mission.sponsorUsername}</strong>
                                  </span>
                                </div>
                                <div className="arena-ads-mission-badge-group">
                                  <span className="arena-ads-mission-reward-badge">+5 💎</span>
                                  <span className={`arena-ads-mission-quota ${isFull ? 'arena-ads-mission-quota--full' : ''}`}>
                                    👥 {mission.approvedCount}/{mission.maxParticipants}
                                  </span>
                                </div>
                              </div>

                              <div className="arena-ads-mission-item__actions">
                                <a
                                  href={mission.targetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="arena-ads-mission-link-btn"
                                  onClick={() => soundManager.playSound('click', 0.3)}
                                  title="Abrir enlace del patrocinador en una nueva pestaña"
                                >
                                  🔗 Abrir Enlace ↗
                                </a>

                                {/* Acciones de comprobante y reclamo */}
                                {mission.isMyMission ? (
                                  <span className="arena-ads-mission-owner-tag">👑 Tu Campaña</span>
                                ) : sub?.claimed ? (
                                  <span className="arena-ads-mission-status-btn arena-ads-mission-status-btn--claimed">
                                    ✓ Reclamado (+5 💎)
                                  </span>
                                ) : sub?.status === 'approved' ? (
                                  <button
                                    type="button"
                                    className="arena-ads-mission-claim-btn"
                                    onClick={() => handleClaimReward(sub.id)}
                                    disabled={isClaimingReward === sub.id}
                                  >
                                    {isClaimingReward === sub.id ? '⏳ Cobrando...' : '🎁 ¡RECLAMAR 5 💎!'}
                                  </button>
                                ) : sub?.status === 'pending' ? (
                                  <span
                                    className="arena-ads-mission-status-btn arena-ads-mission-status-btn--pending"
                                    title="Captura subida. El botón de reclamo se activará en cuanto el admin la valide."
                                  >
                                    ⏳ En Revisión (Admin)
                                  </span>
                                ) : (
                                  <label className={`arena-ads-mission-upload-label ${isUploadingProof === mission.id || isFull ? 'arena-ads-mission-upload-label--disabled' : ''}`}>
                                    <span>
                                      {isUploadingProof === mission.id
                                        ? '⏳ Subiendo...'
                                        : isFull
                                        ? '🔒 Cupo Lleno'
                                        : sub?.status === 'rejected'
                                        ? '⚠️ Rechazado: Reintentar'
                                        : '📸 Adjuntar Captura'}
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp"
                                      disabled={isUploadingProof === mission.id || isFull}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleUploadProof(mission.id, file)
                                        e.target.value = ''
                                      }}
                                      style={{ display: 'none' }}
                                    />
                                  </label>
                                )}
                              </div>
                              {sub?.adminNotes && (
                                <div className="arena-ads-mission-note">Nota admin: {sub.adminNotes}</div>
                              )}
                            </div>
                          )
                        })()}

                        {missions.length > 1 && (
                          <button
                            type="button"
                            className="arena-ads-slider-arrow arena-ads-slider-arrow--next"
                            onClick={handleNextMission}
                            aria-label="Siguiente misión"
                            title="Siguiente misión"
                          >
                            ▶
                          </button>
                        )}
                      </div>

                      {/* Dots / Puntos de navegación */}
                      {missions.length > 1 && (
                        <div className="arena-ads-slider-dots">
                          {missions.map((m, idx) => {
                            const safeMissionIndex = Math.min(currentMissionIndex, missions.length - 1)
                            return (
                              <button
                                key={m.id}
                                type="button"
                                className={`arena-ads-slider-dot ${idx === safeMissionIndex ? 'arena-ads-slider-dot--active' : ''}`}
                                onClick={() => {
                                  soundManager.playSound('click', 0.2)
                                  setSlideDirection(idx > safeMissionIndex ? 'right' : 'left')
                                  setCurrentMissionIndex(idx)
                                }}
                                title={`Misión ${idx + 1}: ${m.title}`}
                                aria-label={`Ir a misión ${idx + 1}`}
                              />
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Formulario / Botón: Patrocínate Ahora */}
                <div className="arena-ads-sponsor-create-box">
                  <div className="arena-ads-sponsor-create-header">
                    <span>🚀 <strong>Patrocínate Ahora:</strong> Paga 250 💎 y consigue hasta 40 registros</span>
                  </div>
                  <div className="arena-ads-sponsor-input-row">
                    <input
                      type="url"
                      className="arena-ads-sponsor-url-input"
                      placeholder="Pega aquí tu link de referido o web (https://...)"
                      value={newSponsorUrl}
                      onChange={(e) => setNewSponsorUrl(e.target.value)}
                      disabled={isCreatingMission}
                    />
                    <button
                      type="button"
                      className="arena-ads-sponsor-launch-btn"
                      onClick={handleCreateMission}
                      disabled={isCreatingMission || !newSponsorUrl.trim()}
                    >
                      {isCreatingMission ? 'Creando...' : 'Pagar 250 💎'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── VISTA FASE DE PREPARACIÓN ULTRA COMPACTA (ZERO SCROLL) ── */
          <div className="arena-ads-content arena-ads-prep-layout">
            {/* Ticker Slim de Instrucciones */}
            <div className="arena-ads-prep-ticker">
              <span className="arena-ads-prep-level-badge">⚔️ NIVEL {activeRun?.level}</span>
              {activeRun?.multiplier === 2 && (
                <span style={{ background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                  ⚡ MULTIPLICADOR 2X ACTIVO
                </span>
              )}
              <span className="arena-ads-prep-instruction">
                🌱 <strong>REFUERZO DE MAZO:</strong> Elige una planta gratuita o desbloquea una poderosa fusión con el patrocinador para liderar el combate.
              </span>
            </div>

            {/* ESCAPARATE TÁCTICO: 3 COLUMNAS DE REFUERZO DE PLANTA */}
            <div className="arena-ads-tactical-showcase">
              <div className="arena-ads-tactical-header">
                <div className="arena-ads-tactical-header-info">
                  <span className="arena-ads-event-badge arena-ads-event-badge--plant">
                    <span>🌱</span> REFUERZO DE MAZO (3 COLUMNAS)
                  </span>
                  <span className="arena-ads-tactical-hint">
                    Elige 1 planta para liderar tu mazo. Las opciones patrocinadas otorgan fusiones de alto impacto.
                  </span>
                </div>
                <button
                  type="button"
                  className="arena-ads-btn arena-ads-btn--reroll"
                  onClick={handleRerollTacticalChoices}
                  disabled={isProcessing}
                  title="¿No te convence ninguna? Cambia las 3 plantas apoyando al patrocinador"
                >
                  🎲 REROLL CON PATROCINADOR
                </button>
              </div>

              <div className="arena-ads-3cols-grid">
                {(activeRun?.currentPrepChoice?.tacticalColumns || []).map((col, idx) => {
                  const plant = col.plant
                  const cfg = PLANT_CONFIGS[plant.plantId]
                  const isFree = !col.requiresAd
                  const isSupreme = col.tier === 3
                  const isSelected = selectedPlantOption?.plantId === plant.plantId

                  return (
                    <div
                      key={`${plant.plantId}-${col.tier}-${idx}`}
                      className={`arena-ads-col-card arena-ads-col-card--${col.color} ${
                        isSelected ? 'arena-ads-col-card--selected' : ''
                      }`}
                      onClick={() => handleSelectPlant(plant)}
                      title="Haz clic para previsualizar en tu mazo inferior"
                    >
                      <div className="arena-ads-col-badge">
                        <span>{isFree ? '🌿' : isSupreme ? '👑' : '⚡'}</span>
                        <span>{col.badge}</span>
                      </div>

                      <div className="arena-ads-col-avatar-wrap">
                        <img
                          src={cfg?.icon || cfg?.sprite}
                          alt={plant.name}
                          className="arena-ads-col-img"
                        />
                        <span className="arena-ads-col-stars">⭐{plant.level}</span>
                      </div>

                      <div className="arena-ads-col-info">
                        <strong className="arena-ads-col-name">{plant.name}</strong>
                        <span className="arena-ads-col-tier-label">{col.tierLabel}</span>
                        <div className="arena-ads-col-stats">
                          {plant.statRolls.length > 0 ? (
                            plant.statRolls.map((roll, rIdx) => {
                              const label =
                                roll === 'damage'
                                  ? '+15% Daño'
                                  : roll === 'hp'
                                  ? '+15% Vida'
                                  : roll === 'attackSpeed'
                                  ? '+15% Cadencia'
                                  : '-15% Recarga'
                              return (
                                <span
                                  key={rIdx}
                                  className={`arena-ads-col-stat-pill arena-ads-col-stat-pill--${roll}`}
                                >
                                  {label}
                                </span>
                              )
                            })
                          ) : (
                            <span className="arena-ads-col-stat-pill arena-ads-col-stat-pill--basic">
                              Estadísticas Estándar
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="arena-ads-col-action">
                        {isFree ? (
                          <button
                            type="button"
                            className="arena-ads-btn arena-ads-btn--col-free"
                            onClick={() => handleEquipPlantAndBattle(plant, false)}
                            disabled={isProcessing}
                          >
                            🟢 ELEGIR GRATIS
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`arena-ads-btn ${
                              isSupreme
                                ? 'arena-ads-btn--col-supreme'
                                : 'arena-ads-btn--col-tactical'
                            }`}
                            onClick={() => handleEquipPlantAndBattle(plant, true)}
                            disabled={isProcessing}
                            title="Desbloquea esta fusión épica apoyando al patrocinador"
                          >
                            {isSupreme
                              ? '👑 DESBLOQUEAR Y LUCHAR ⚡'
                              : '⚡ DESBLOQUEAR Y LUCHAR 🎁'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* DOCK TÁCTICO DEL MAZO ACTIVO (GAMING RACK) */}
            {activeRun && (
              <div className="arena-ads-deck-rack">
                <div className="arena-ads-deck-rack-header">
                  <div className="arena-ads-deck-rack-title">
                    <span className="arena-ads-deck-rack-icon">🎴</span>
                    <strong>MAZO DE COMBATE (5/5 PLANTAS)</strong>
                  </div>
                  <span className="arena-ads-deck-rack-subtitle">
                    {activeRun.deck.some(c => (c.statRolls?.length || 0) > 0 || (c.level || 1) > 1)
                      ? '⚡ Mejoras de fusión listas para el combate'
                      : '🌻 Girasol + 4 unidades de asalto'}
                  </span>
                </div>

                <div className="arena-ads-deck-slots">
                  {activeRun.deck.map((card, idx) => {
                    const cfg = PLANT_CONFIGS[card.plantId as PlantId]
                    if (!cfg) return null
                    const isSunflower = card.plantId === 'sunflower'
                    const cardStars = Math.max(card.level || 0, card.statRolls?.length || 0, 1)
                    const isFused = (card.statRolls?.length || 0) > 0 || cardStars > 1

                    return (
                      <div
                        key={`${card.plantId}-${idx}`}
                        className={`arena-ads-deck-slot ${
                          isSunflower ? 'arena-ads-deck-slot--sunflower' : ''
                        } ${isFused ? 'arena-ads-deck-slot--fused' : ''}`}
                        title={`${cfg.name} (⭐${cardStars})${isSunflower ? ' • Fijo en ranura 1' : ''}${isFused ? ' • Fusión con stats mejorados' : ''}`}
                      >
                        <div className="arena-ads-deck-slot-top">
                          {isSunflower ? (
                            <span className="arena-ads-deck-slot-lock" title="Girasol fijo">🔒</span>
                          ) : (
                            <span className="arena-ads-deck-slot-num">#{idx + 1}</span>
                          )}
                          <span className="arena-ads-deck-slot-stars">⭐{cardStars}</span>
                        </div>

                        <div className="arena-ads-deck-slot-avatar">
                          <img
                            src={cfg.icon || cfg.sprite}
                            alt={cfg.name}
                            className="arena-ads-deck-slot-img"
                          />
                        </div>

                        <div className="arena-ads-deck-slot-footer">
                          <span className="arena-ads-deck-slot-name">
                            {isSunflower ? 'Girasol' : cfg.name}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FOOTER ACTIONS - ANCLADO Y SIEMPRE VISIBLE */}
        <div className="arena-ads-footer">
          {activeView === 'lobby' ? (
            <>
              <button
                type="button"
                className="arena-ads-btn arena-ads-btn--secondary"
                onClick={onClose}
              >
                ✕ CERRAR
              </button>
              <div className="arena-ads-footer-actions">
                {activeRun ? (
                  <>
                    <button
                      type="button"
                      className="arena-ads-btn arena-ads-btn--cashout"
                      onClick={handleCashout}
                      disabled={isProcessing}
                    >
                      💰 RETIRARSE ({activeRun.accumulatedRewards.gems} 💎)
                    </button>
                    {activeRun.level <= 50 && (
                      <button
                        type="button"
                        className="arena-ads-btn arena-ads-btn--primary"
                        onClick={handleResumeRun}
                      >
                        ▶️ CONTINUAR (NIV {activeRun.level})
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="arena-ads-btn arena-ads-btn--primary"
                      onClick={() => handleStartNewRun('gold')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '⏳...' : <>🎮 350 <GoldIcon size={16} style={{ margin: '0 3px' }} /> ORO</>}
                    </button>
                    <button
                      type="button"
                      className="arena-ads-btn arena-ads-btn--gems"
                      onClick={() => handleStartNewRun('gems')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '⏳...' : '⚡ 200 💎 (2X BOTÍN)'}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {activeRun && (activeRun.level >= 2 || activeRun.accumulatedRewards.gems > 0 || Object.keys(activeRun.accumulatedRewards.items || {}).length > 0) ? (
                <button
                  type="button"
                  className="arena-ads-btn arena-ads-btn--cashout"
                  onClick={handleCashout}
                  disabled={isProcessing}
                  title="Retírate ahora con todo lo que has acumulado"
                >
                  💰 RETIRARSE ({activeRun.accumulatedRewards.gems} 💎)
                </button>
              ) : (
                <button
                  type="button"
                  className="arena-ads-btn arena-ads-btn--secondary"
                  onClick={() => setActiveView('lobby')}
                >
                  ← LOBBY
                </button>
              )}

              <div className="arena-ads-footer-actions">
                {activeRun && activeRun.level > 50 ? (
                  <button
                    type="button"
                    className="arena-ads-btn arena-ads-btn--cashout"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      borderColor: '#fbbf24',
                      color: '#fff',
                      fontWeight: 800,
                    }}
                    onClick={handleCashout}
                    disabled={isProcessing}
                  >
                    🏆 COBRAR BOTÍN SUPREMO ({activeRun.accumulatedRewards.gems} 💎)
                  </button>
                ) : (
                  <button
                    type="button"
                    className="arena-ads-btn arena-ads-btn--primary"
                    onClick={() => handleEquipPlantAndBattle()}
                    disabled={isProcessing}
                    title="Inicia el combate con la opción seleccionada o la gratuita por defecto"
                  >
                    ⚔️ ENTRAR A COMBATIR (NIVEL {activeRun?.level})
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
