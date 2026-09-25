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
                    <button
                      type="button"
                      className="arena-ads-btn arena-ads-btn--primary"
                      onClick={handleResumeRun}
                    >
                      ▶️ CONTINUAR (NIV {activeRun.level})
                    </button>
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
                <button
                  type="button"
                  className="arena-ads-btn arena-ads-btn--primary"
                  onClick={() => handleEquipPlantAndBattle()}
                  disabled={isProcessing}
                  title="Inicia el combate con la opción seleccionada o la gratuita por defecto"
                >
                  ⚔️ ENTRAR A COMBATIR (NIVEL {activeRun?.level})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
