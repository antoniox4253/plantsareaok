import { useState, useEffect, useMemo } from 'react'
import {
  ArenaAdsManager,
  ARENA_ADS_ENTRY_FEE_GOLD,
  ARENA_ADS_ENTRY_FEE_GEMS,
  type ArenaAdsRun,
  type ArenaAdsPlantOption,
  type ArenaAdsLoot,
  type ArenaAdsRewardOption,
} from '../../utils/arenaAdsManager'
import { arenaAdsService } from '../../services/arenaAdsService'
import { soundManager } from '../../utils/audioManager'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import './ArenaAdsModal.css'

interface ArenaAdsModalProps {
  isOpen: boolean
  onClose: () => void
  userGold: number
  userGems?: number
  onDeductGold: (amount: number) => boolean
  onDeductGems?: (amount: number) => boolean
  onStartArenaAdsBattle: (run: ArenaAdsRun) => void
  onClaimLoot: (loot: ArenaAdsLoot) => void
}

export default function ArenaAdsModal({
  isOpen,
  onClose,
  userGold,
  userGems = 0,
  onDeductGold,
  onDeductGems,
  onStartArenaAdsBattle,
  onClaimLoot,
}: ArenaAdsModalProps) {
  const [activeRun, setActiveRun] = useState<ArenaAdsRun | null>(null)
  const [activeView, setActiveView] = useState<'lobby' | 'prep'>('lobby')
  const [selectedPlantSubTab, setSelectedPlantSubTab] = useState<'normal' | 'fused'>('normal')
  const [selectedPlantOption, setSelectedPlantOption] = useState<ArenaAdsPlantOption | null>(null)
  const [chosenAdvantageType, setChosenAdvantageType] = useState<'none' | 'reward' | 'plant'>('none')
  const [claimSummary, setClaimSummary] = useState<ArenaAdsLoot | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  // Sincronizar o cargar la run guardada en caché
  useEffect(() => {
    if (!isOpen) return
    const stored = ArenaAdsManager.getStoredRun()
    if (stored) {
      setActiveRun(stored)
      if (stored.status === 'prep') {
        setActiveView('prep')
      } else {
        setActiveView('lobby')
      }
      if (stored.chosenAdvantage?.type === 'reward') {
        setChosenAdvantageType('reward')
        setSelectedPlantOption(null)
      } else if (stored.chosenAdvantage?.type?.startsWith('plant')) {
        setChosenAdvantageType('plant')
        setSelectedPlantOption(stored.chosenAdvantage.plantChosen || null)
      } else {
        setChosenAdvantageType('none')
        setSelectedPlantOption(null)
      }
    } else {
      setActiveRun(null)
      setActiveView('lobby')
      setChosenAdvantageType('none')
      setSelectedPlantOption(null)
    }
  }, [isOpen])

  const totalAccumulatedLoot = useMemo(() => {
    if (!activeRun) return null
    return activeRun.accumulatedRewards
  }, [activeRun])

  if (!isOpen) return null

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
      const newRun = ArenaAdsManager.startNewRun(paymentType)
      setActiveRun(newRun)
      setActiveView('prep')
      setChosenAdvantageType('none')
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

  // Elegir Recompensas como ventaja (MUTUAMENTE EXCLUYENTE CON PLANTA)
  const handleSelectRewardAdvantage = (rewards: ArenaAdsRewardOption[]) => {
    if (!activeRun) return
    soundManager.playSound('click', 0.5)
    const updated = ArenaAdsManager.applyAdvantageChoice(activeRun, {
      type: 'reward',
      options: rewards,
    })
    setActiveRun({ ...updated })
    setChosenAdvantageType('reward')
    setSelectedPlantOption(null) // Deselecciona planta de forma estricta
  }

  // Elegir Planta como ventaja (MUTUAMENTE EXCLUYENTE CON RECOMPENSA)
  const handleSelectPlantAdvantage = (plant: ArenaAdsPlantOption) => {
    if (!activeRun) return
    soundManager.playSound('click', 0.5)
    setSelectedPlantOption(plant)
    const updated = ArenaAdsManager.applyAdvantageChoice(activeRun, {
      type: plant.isFused ? 'plant_fused' : 'plant_normal',
      option: plant,
    })
    setActiveRun({ ...updated })
    setChosenAdvantageType('plant') // Cancela la recompensa de forma estricta
  }

  // Retirarse y reclamar botín (guardando en backend y en inventario local)
  const handleCashout = async () => {
    if (!activeRun) return
    setIsProcessing(true)
    try {
      soundManager.playSound('victory', 0.8)
      const loot = { ...activeRun.accumulatedRewards }

      // 1. Acreditar en backend Supabase con multiplicador
      await arenaAdsService.claimLoot(loot, activeRun.multiplier)

      // 2. Acreditar ítems de cultivo en localStorage
      if (loot.items && Object.keys(loot.items).length > 0) {
        try {
          const raw = localStorage.getItem('plant_arena_farming_inventory') || '{}'
          const inv = JSON.parse(raw)
          for (const [itemId, qty] of Object.entries(loot.items)) {
            inv[itemId] = (inv[itemId] || 0) + Number(qty || 0)
          }
          localStorage.setItem('plant_arena_farming_inventory', JSON.stringify(inv))
          window.dispatchEvent(new Event('plant_arena_farming_inventory_updated'))
        } catch (e) {
          console.error('Error al guardar items de cultivo en inventario:', e)
        }
      }

      ArenaAdsManager.clearRun()
      setActiveRun(null)
      setClaimSummary(loot)
      onClaimLoot(loot)
    } finally {
      setIsProcessing(false)
    }
  }

  // Entrar al combate del nivel actual
  const handleEnterBattle = () => {
    if (!activeRun) return
    soundManager.playSound('click', 0.7)
    const runInBattle = ArenaAdsManager.startBattle(activeRun)
    onClose()
    onStartArenaAdsBattle(runInBattle)
  }

  return (
    <div className="arena-ads-backdrop" onClick={onClose}>
      <div className="arena-ads-modal" onClick={(e) => e.stopPropagation()}>
        {/* HEADER COMPACTO */}
        <div className="arena-ads-header">
          <div className="arena-ads-title-box">
            <span className="arena-ads-icon">🏰</span>
            <div>
              <h2 className="arena-ads-title">ARENA ADS</h2>
              <p className="arena-ads-subtitle">Mazmorra Infinita Roguelike contra Bots</p>
            </div>
          </div>

          <div className="arena-ads-header-badges">
            <div className="arena-ads-badge arena-ads-badge--gold" title="Tu saldo de Oro">
              <span>🪙</span>
              <strong>{userGold}</strong>
            </div>
            <div className="arena-ads-badge arena-ads-badge--gems" title="Tu saldo de Gemas">
              <span>💎</span>
              <strong>{userGems}</strong>
            </div>
            {activeRun && (
              <div className="arena-ads-badge arena-ads-badge--level" title="Nivel actual en mazmorra">
                <span>⚔️</span>
                <strong>Nivel {activeRun.level}</strong>
              </div>
            )}
            {activeRun?.multiplier === 2 && (
              <div className="arena-ads-badge" style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: '#fff', border: '1px solid #c084fc' }} title="Multiplicador x2 Activo">
                <span>⚡</span>
                <strong>2X BOTÍN</strong>
              </div>
            )}
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
              <div className="arena-ads-loot-pill arena-ads-loot-pill--gold">
                <span>🪙</span> +{claimSummary.gold} Oro
              </div>
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
            {/* Banner Ad Cascarón Superior Slim */}
            <div className="arena-ads-banner-ad-box arena-ads-banner-ad-box--slim">
              <span className="arena-ads-banner-ad-tag">[ PUBLICIDAD / AD ]</span>
              <span className="arena-ads-banner-ad-text">
                📢 Patrocinador Oficial • Banner 728x90 (Espacio reservado para anunciantes)
              </span>
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
                      <div className="arena-ads-loot-pill arena-ads-loot-pill--gold">
                        <span>🪙</span> {totalAccumulatedLoot.gold} Oro
                      </div>
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
                      <strong>1. Opciones de Entrada:</strong> 100 🪙 Oro (1x botín) o 200 💎 Gemas (⚡ 2x botín).
                    </div>
                    <div className="arena-ads-rule-item">
                      <strong>2. Preparación:</strong> Elige Botín Extra O Reforzar Mazo (1 sola opción por nivel).
                    </div>
                    <div className="arena-ads-rule-item">
                      <strong>3. 🌻 Girasol Fijo:</strong> Siempre presente en tu mazo de 5 cartas.
                    </div>
                    <div className="arena-ads-rule-item">
                      <strong>4. 👑 Ítems Exclusivos:</strong> Salen desde el Nivel 10 cada 5 niveles (sólo 5 unidades cada uno).
                    </div>
                  </div>
                </div>
              )}

              {/* Caja de Patrocinador Destacado */}
              <div className="arena-ads-sponsor-box">
                <div className="arena-ads-sponsor-badge">[ ESPACIO PUBLICITARIO 300x250 ]</div>
                <div className="arena-ads-sponsor-content">
                  <span className="arena-ads-sponsor-icon">🎯</span>
                  <div className="arena-ads-sponsor-info">
                    <strong>Patrocinador de la Mazmorra</strong>
                    <p>Espacio publicitario integrado para recompensas y banners patrocinados.</p>
                  </div>
                </div>
                <div className="arena-ads-sponsor-status">
                  <span className="arena-ads-sponsor-dot"></span>
                  <span>Cargando anuncios interactivos...</span>
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
                Elige <strong>1 SOLA OPCIÓN</strong> para este nivel: 🎁 Botín Extra <em>O</em> 🌱 Reforzar Mazo
              </span>
            </div>

            {/* Columnas de Elección: RECOMPENSA vs PLANTA (MUTUAMENTE EXCLUYENTES) */}
            <div className="arena-ads-choice-columns">
              {/* OPCIÓN 1: RECOMPENSA */}
              <div
                className={`arena-ads-choice-card arena-ads-choice-card--reward ${
                  chosenAdvantageType === 'reward' ? 'arena-ads-choice-card--active' : ''
                }`}
                onClick={() =>
                  activeRun?.currentPrepChoice &&
                  handleSelectRewardAdvantage(activeRun.currentPrepChoice.rewardOptions)
                }
              >
                <div className="arena-ads-choice-header">
                  <span className="arena-ads-choice-title">
                    <span>🎁</span> Opción A: Botín Extra ({activeRun?.currentPrepChoice?.rewardOptions.length || 1})
                  </span>
                  <span
                    className={`arena-ads-choice-indicator ${
                      chosenAdvantageType === 'reward' ? 'arena-ads-choice-indicator--active' : ''
                    }`}
                  >
                    {chosenAdvantageType === 'reward' ? '✓ ELEGIDA' : 'ELEGIR'}
                  </span>
                </div>

                {activeRun?.currentPrepChoice && (
                  <div className="arena-ads-reward-preview" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                      {activeRun.currentPrepChoice.rewardOptions.map((opt, i) => (
                        <div
                          key={i}
                          style={{
                            background: opt.isExclusiveItem ? 'rgba(234, 179, 8, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            border: opt.isExclusiveItem ? '1px solid #facc15' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                          <strong style={{ color: opt.isExclusiveItem ? '#facc15' : '#fff' }}>{opt.label}</strong>
                        </div>
                      ))}
                    </div>
                    <span className="arena-ads-reward-desc" style={{ textAlign: 'center', marginTop: '4px' }}>
                      Se sumará a tu botín acumulado • Tu mazo combatirá con plantas estándar
                    </span>
                  </div>
                )}
              </div>

              {/* OPCIÓN 2: PLANTA (NORMAL O FUSIONADA) */}
              <div
                className={`arena-ads-choice-card ${
                  chosenAdvantageType === 'plant' ? 'arena-ads-choice-card--active' : ''
                }`}
              >
                <div className="arena-ads-choice-header">
                  <span className="arena-ads-choice-title">
                    <span>🌱</span> Opción B: Reforzar Mazo
                  </span>
                  <span
                    className={`arena-ads-choice-indicator arena-ads-choice-indicator--blue ${
                      chosenAdvantageType === 'plant' ? 'arena-ads-choice-indicator--active' : ''
                    }`}
                  >
                    {chosenAdvantageType === 'plant' ? '✓ ELEGIDA' : 'ELEGIR'}
                  </span>
                </div>

                {/* SubTabs: Normal vs Fused */}
                <div className="arena-ads-subtabs">
                  <button
                    type="button"
                    className={`arena-ads-subtab-btn ${
                      selectedPlantSubTab === 'normal' ? 'arena-ads-subtab-btn--active' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      soundManager.playSound('click', 0.3)
                      setSelectedPlantSubTab('normal')
                    }}
                  >
                    🌿 Normal (⭐1)
                  </button>
                  <button
                    type="button"
                    className={`arena-ads-subtab-btn arena-ads-subtab-btn--fused ${
                      selectedPlantSubTab === 'fused' ? 'arena-ads-subtab-btn--active' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      soundManager.playSound('click', 0.3)
                      setSelectedPlantSubTab('fused')
                    }}
                  >
                    ⚡ Fusión (⭐+)
                  </button>
                </div>

                {/* Plant Choices List */}
                <div className="arena-ads-plant-options-list">
                  {(selectedPlantSubTab === 'normal'
                    ? activeRun?.currentPrepChoice?.normalPlantOptions
                    : activeRun?.currentPrepChoice?.fusedPlantOptions
                  )?.map((plantOpt) => {
                    const isSelected =
                      chosenAdvantageType === 'plant' &&
                      selectedPlantOption?.plantId === plantOpt.plantId &&
                      selectedPlantOption?.isFused === plantOpt.isFused
                    const cfg = PLANT_CONFIGS[plantOpt.plantId]
                    return (
                      <div
                        key={`${plantOpt.plantId}-${plantOpt.isFused ? 'fused' : 'normal'}`}
                        className={`arena-ads-plant-option-item ${
                          plantOpt.isFused ? 'arena-ads-plant-option-item--fused' : ''
                        } ${isSelected ? 'arena-ads-plant-option-item--selected' : ''}`}
                        onClick={() => handleSelectPlantAdvantage(plantOpt)}
                      >
                        <span className="arena-ads-plant-stars">⭐{plantOpt.level}</span>
                        <img
                          src={cfg?.icon || cfg?.sprite}
                          alt={plantOpt.name}
                          className="arena-ads-plant-thumb"
                        />
                        <div className="arena-ads-plant-meta">
                          <span className="arena-ads-plant-name">{plantOpt.name}</span>
                          <span className="arena-ads-plant-desc">{plantOpt.description}</span>
                        </div>
                        {isSelected && (
                          <span className="arena-ads-plant-check">✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* PREVISUALIZACIÓN HORIZONTAL SLIM DEL MAZO ACTIVO */}
            {activeRun && (
              <div className="arena-ads-deck-preview-bar">
                <span className="arena-ads-deck-bar-label">
                  TU MAZO (5 CARTAS):
                </span>
                <div className="arena-ads-deck-strip">
                  {activeRun.deck.map((card, idx) => {
                    const cfg = PLANT_CONFIGS[card.plantId]
                    if (!cfg) return null
                    const isSunflower = card.plantId === 'sunflower'
                    const cardStars = card.level || 1
                    const isFused = (card.statRolls?.length || 0) > 0 || cardStars > 1

                    return (
                      <div
                        key={`${card.plantId}-${idx}`}
                        className={`arena-ads-deck-card ${
                          isSunflower ? 'arena-ads-deck-card--sunflower' : ''
                        } ${isFused ? 'arena-ads-deck-card--fused' : ''}`}
                        title={`${cfg.name} (⭐${cardStars})${isSunflower ? ' (Fijo)' : ''}${isFused ? ' (Fusión)' : ''}`}
                      >
                        {isSunflower && <span className="arena-ads-deck-card-lock">🔒</span>}
                        <span className="arena-ads-deck-card-stars">⭐{cardStars}</span>
                        <img
                          src={cfg.icon || cfg.sprite}
                          alt={cfg.name}
                          className="arena-ads-deck-card-img"
                        />
                        <span className="arena-ads-deck-card-tag">
                          {isSunflower ? 'Girasol' : cfg.name}
                        </span>
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
                CERRAR
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                {activeRun ? (
                  <>
                    <button
                      type="button"
                      className="arena-ads-btn arena-ads-btn--cashout"
                      onClick={handleCashout}
                      disabled={isProcessing}
                    >
                      💰 RETIRARSE ({activeRun.accumulatedRewards.gold} 🪙)
                    </button>
                    <button
                      type="button"
                      className="arena-ads-btn arena-ads-btn--primary"
                      onClick={handleResumeRun}
                    >
                      ▶️ CONTINUAR (NIVEL {activeRun.level})
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
                      {isProcessing ? '⏳ PROCESANDO...' : '🎮 ENTRAR (100 🪙 ORO)'}
                    </button>
                    <button
                      type="button"
                      className="arena-ads-btn"
                      style={{
                        background: 'linear-gradient(180deg, #9333ea 0%, #7e22ce 100%)',
                        border: '2px solid #c084fc',
                        color: '#ffffff',
                        boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)',
                        fontWeight: 800,
                      }}
                      onClick={() => handleStartNewRun('gems')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '⏳ PROCESANDO...' : '⚡ ENTRAR (200 💎) [2X BOTÍN]'}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {activeRun && (activeRun.level >= 2 || activeRun.accumulatedRewards.gold > 0) ? (
                <button
                  type="button"
                  className="arena-ads-btn arena-ads-btn--cashout"
                  onClick={handleCashout}
                  disabled={isProcessing}
                  title="Retírate ahora con todo lo que has acumulado"
                >
                  💰 RETIRARSE CON EL BOTÍN
                </button>
              ) : (
                <button
                  type="button"
                  className="arena-ads-btn arena-ads-btn--secondary"
                  onClick={() => setActiveView('lobby')}
                >
                  VOLVER AL LOBBY
                </button>
              )}

              <button
                type="button"
                className="arena-ads-btn arena-ads-btn--primary"
                onClick={handleEnterBattle}
              >
                ⚔️ COMBATIR (NIVEL {activeRun?.level})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
