import { useState, useEffect, useMemo } from 'react'
import {
  ArenaAdsManager,
  ARENA_ADS_ENTRY_FEE_GOLD,
  type ArenaAdsRun,
  type ArenaAdsPlantOption,
  type ArenaAdsLoot,
  type ArenaAdsRewardOption,
} from '../../utils/arenaAdsManager'
import { soundManager } from '../../utils/audioManager'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import './ArenaAdsModal.css'

interface ArenaAdsModalProps {
  isOpen: boolean
  onClose: () => void
  userGold: number
  onDeductGold: (amount: number) => boolean
  onStartArenaAdsBattle: (run: ArenaAdsRun) => void
  onClaimLoot: (loot: ArenaAdsLoot) => void
}

export default function ArenaAdsModal({
  isOpen,
  onClose,
  userGold,
  onDeductGold,
  onStartArenaAdsBattle,
  onClaimLoot,
}: ArenaAdsModalProps) {
  const [activeRun, setActiveRun] = useState<ArenaAdsRun | null>(null)
  const [activeView, setActiveView] = useState<'lobby' | 'prep'>('lobby')
  const [selectedPlantSubTab, setSelectedPlantSubTab] = useState<'normal' | 'fused'>('normal')
  const [selectedPlantOption, setSelectedPlantOption] = useState<ArenaAdsPlantOption | null>(null)
  const [chosenAdvantageType, setChosenAdvantageType] = useState<'none' | 'reward' | 'plant'>('none')
  const [claimSummary, setClaimSummary] = useState<ArenaAdsLoot | null>(null)

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
    } else {
      setActiveRun(null)
      setActiveView('lobby')
    }
    setChosenAdvantageType('none')
    setSelectedPlantOption(null)
  }, [isOpen])

  const totalAccumulatedLoot = useMemo(() => {
    if (!activeRun) return null
    return activeRun.accumulatedRewards
  }, [activeRun])

  if (!isOpen) return null

  // Iniciar nueva expedición por 100 de Oro
  const handleStartNewRun = () => {
    if (userGold < ARENA_ADS_ENTRY_FEE_GOLD) {
      soundManager.playSound('click', 0.5)
      alert(`Oro insuficiente. Necesitas al menos ${ARENA_ADS_ENTRY_FEE_GOLD} de Oro 🪙 para entrar a Arena ADS.`)
      return
    }

    const deducted = onDeductGold(ARENA_ADS_ENTRY_FEE_GOLD)
    if (!deducted) {
      alert('No se pudo procesar el pago de 100 de Oro.')
      return
    }

    soundManager.playSound('victory', 0.6)
    const newRun = ArenaAdsManager.startNewRun()
    setActiveRun(newRun)
    setActiveView('prep')
    setChosenAdvantageType('none')
    setSelectedPlantOption(null)
  }

  // Continuar la run existente desde caché
  const handleResumeRun = () => {
    if (!activeRun) return
    soundManager.playSound('click', 0.5)
    setActiveView('prep')
  }

  // Elegir Recompensa como ventaja
  const handleSelectRewardAdvantage = (reward: ArenaAdsRewardOption) => {
    if (!activeRun) return
    soundManager.playSound('click', 0.5)
    const updated = ArenaAdsManager.applyAdvantageChoice(activeRun, {
      type: 'reward',
      option: reward,
    })
    setActiveRun({ ...updated })
    setChosenAdvantageType('reward')
  }

  // Elegir Planta (Normal o Fusionada) como ventaja
  const handleSelectPlantAdvantage = (plant: ArenaAdsPlantOption) => {
    if (!activeRun) return
    soundManager.playSound('click', 0.5)
    setSelectedPlantOption(plant)
    const updated = ArenaAdsManager.applyAdvantageChoice(activeRun, {
      type: plant.isFused ? 'plant_fused' : 'plant_normal',
      option: plant,
    })
    setActiveRun({ ...updated })
    setChosenAdvantageType('plant')
  }

  // Retirarse y reclamar botín
  const handleCashout = () => {
    if (!activeRun) return
    soundManager.playSound('victory', 0.8)
    const loot = { ...activeRun.accumulatedRewards }
    ArenaAdsManager.clearRun()
    setActiveRun(null)
    setClaimSummary(loot)
    onClaimLoot(loot)
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
        {/* HEADER */}
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
            {activeRun && (
              <div className="arena-ads-badge arena-ads-badge--level" title="Nivel actual en mazmorra">
                <span>⚔️</span>
                <strong>Nivel {activeRun.level}</strong>
              </div>
            )}
            <button type="button" className="arena-ads-close-btn" onClick={onClose} title="Cerrar">
              ✕
            </button>
          </div>
        </div>

        {/* MODAL DE RESUMEN DE RETIRO / RECOMPENSAS */}
        {claimSummary ? (
          <div className="arena-ads-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
            <h2 style={{ color: '#facc15', margin: 0, fontSize: '24px' }}>¡TE HAS RETIRADO CON ÉXITO!</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '480px', margin: '8px auto 20px' }}>
              Has asegurado tu botín acumulado antes de caer en combate. Todo lo obtenido se ha sumado a tu cuenta.
            </p>

            <div className="arena-ads-loot-pills" style={{ justifyContent: 'center', marginBottom: '24px' }}>
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
              style={{ margin: '0 auto' }}
              onClick={() => {
                setClaimSummary(null)
                setActiveView('lobby')
              }}
            >
              CONTINUAR
            </button>
          </div>
        ) : activeView === 'lobby' ? (
          /* ── VISTA LOBBY / ENTRADA ── */
          <div className="arena-ads-content">
            {/* Banner Ad Cascarón Superior */}
            <div className="arena-ads-banner-ad-box">
              <div className="arena-ads-banner-ad-label">[ PUBLICIDAD / AD ] - HEADER BANNER 728x90</div>
              <div className="arena-ads-banner-placeholder">
                <span>📢</span>
                <span>Espacio para anuncio del patrocinador (Cargando contenedor...)</span>
              </div>
            </div>

            {/* Run Activa en Caché */}
            {activeRun && (
              <div className="arena-ads-active-run-card">
                <div className="arena-ads-run-header">
                  <div className="arena-ads-run-title">
                    <span>⚔️</span>
                    <span>EXPEDICIÓN EN CURSO — NIVEL {activeRun.level}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Guardada en caché local</span>
                </div>

                <p style={{ margin: 0, fontSize: '13px', color: '#e2e8f0' }}>
                  Tienes una mazmorra activa. Puedes continuar luchando o retirarte ahora para reclamar tu botín sin arriesgarlo.
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
            )}

            {/* Reglas e Instrucciones */}
            <div className="arena-ads-rules-card">
              <h3 className="arena-ads-rules-title">
                <span>📜</span> Cómo Jugar la Mazmorra Infinita
              </h3>
              <div className="arena-ads-rules-grid">
                <div className="arena-ads-rule-item">
                  <strong>1. Paga 100 de Oro:</strong> Inicia una expedición en el Nivel 1.
                </div>
                <div className="arena-ads-rule-item">
                  <strong>2. Fase de Preparación:</strong> En cada nivel elige entre recursos de botín o plantas normales / fusionadas.
                </div>
                <div className="arena-ads-rule-item">
                  <strong>3. Girasol Siempre Listo:</strong> El Girasol siempre está garantizado en tu mazo de 5 cartas; las demás son aleatorias.
                </div>
                <div className="arena-ads-rule-item">
                  <strong>4. Retírate a Tiempo:</strong> Si te derrotan en combate, <strong>¡pierdes todo el botín acumulado!</strong>
                </div>
              </div>
            </div>

            {/* Banner Ad Cascarón Inferior */}
            <div className="arena-ads-banner-ad-box">
              <div className="arena-ads-banner-ad-label">[ PUBLICIDAD / AD ] - FOOTER BANNER 728x90</div>
              <div className="arena-ads-banner-placeholder">
                <span>🎯</span>
                <span>Anuncio promocional entre niveles</span>
              </div>
            </div>
          </div>
        ) : (
          /* ── VISTA FASE DE PREPARACIÓN (NIVEL X) ── */
          <div className="arena-ads-content">
            <div className="arena-ads-prep-box">
              <div className="arena-ads-prep-intro">
                <h3>FASE DE PREPARACIÓN — NIVEL {activeRun?.level}</h3>
                <p>
                  Elige tu ventaja estratégica para el Nivel {activeRun?.level}. Puedes asegurar recursos a tu botín o reforzar tu mazo con una planta clave.
                </p>
              </div>

              {/* Columnas de Elección: RECOMPENSA vs PLANTA */}
              <div className="arena-ads-choice-columns">
                {/* OPCIÓN 1: RECOMPENSA */}
                <div
                  className={`arena-ads-choice-card arena-ads-choice-card--reward ${
                    chosenAdvantageType === 'reward' ? 'arena-ads-choice-card--active' : ''
                  }`}
                >
                  <div className="arena-ads-choice-header">
                    <span className="arena-ads-choice-title">
                      <span>🎁</span> Opción A: Botín Extra
                    </span>
                    {chosenAdvantageType === 'reward' && (
                      <span style={{ color: '#facc15', fontSize: '11px', fontWeight: 800 }}>✓ ELEGIDA</span>
                    )}
                  </div>

                  {activeRun?.currentPrepChoice && (
                    <div className="arena-ads-reward-preview">
                      <span className="arena-ads-reward-icon">
                        {activeRun.currentPrepChoice.rewardOption.icon}
                      </span>
                      <strong className="arena-ads-reward-val">
                        {activeRun.currentPrepChoice.rewardOption.label}
                      </strong>
                      <p className="arena-ads-reward-desc">
                        Se añade a tu botín de la mazmorra. Tu mazo se armará con Girasol + 4 cartas aleatorias.
                      </p>
                      <button
                        type="button"
                        className="arena-ads-btn arena-ads-btn--cashout"
                        style={{ marginTop: '8px', fontSize: '13px', padding: '8px 14px' }}
                        onClick={() =>
                          handleSelectRewardAdvantage(activeRun.currentPrepChoice!.rewardOption)
                        }
                      >
                        🎁 SUMAR AL BOTÍN
                      </button>
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
                    {chosenAdvantageType === 'plant' && (
                      <span style={{ color: '#38bdf8', fontSize: '11px', fontWeight: 800 }}>✓ ELEGIDA</span>
                    )}
                  </div>

                  {/* SubTabs: Normal vs Fused */}
                  <div className="arena-ads-subtabs">
                    <button
                      type="button"
                      className={`arena-ads-subtab-btn ${
                        selectedPlantSubTab === 'normal' ? 'arena-ads-subtab-btn--active' : ''
                      }`}
                      onClick={() => {
                        soundManager.playSound('click', 0.3)
                        setSelectedPlantSubTab('normal')
                      }}
                    >
                      🌿 Planta Normal
                    </button>
                    <button
                      type="button"
                      className={`arena-ads-subtab-btn arena-ads-subtab-btn--fused ${
                        selectedPlantSubTab === 'fused' ? 'arena-ads-subtab-btn--active' : ''
                      }`}
                      onClick={() => {
                        soundManager.playSound('click', 0.3)
                        setSelectedPlantSubTab('fused')
                      }}
                    >
                      ⚡ Planta Fusionada
                    </button>
                  </div>

                  {/* Plant Choices List */}
                  <div className="arena-ads-plant-options-list">
                    {(selectedPlantSubTab === 'normal'
                      ? activeRun?.currentPrepChoice?.normalPlantOptions
                      : activeRun?.currentPrepChoice?.fusedPlantOptions
                    )?.map((plantOpt) => {
                      const isSelected = selectedPlantOption?.plantId === plantOpt.plantId
                      const cfg = PLANT_CONFIGS[plantOpt.plantId]
                      return (
                        <div
                          key={plantOpt.plantId}
                          className={`arena-ads-plant-option-item ${
                            plantOpt.isFused ? 'arena-ads-plant-option-item--fused' : ''
                          } ${isSelected ? 'arena-ads-plant-option-item--selected' : ''}`}
                          onClick={() => handleSelectPlantAdvantage(plantOpt)}
                        >
                          <div className="arena-ads-plant-info">
                            <img
                              src={cfg?.icon || cfg?.sprite || '/game-assets/greenfoot/peashooterpacket1.webp'}
                              alt={plantOpt.name}
                              className="arena-ads-plant-icon"
                            />
                            <div className="arena-ads-plant-names">
                              <span className="arena-ads-plant-name">{plantOpt.name}</span>
                              <span className="arena-ads-plant-fused-badge">
                                {plantOpt.description}
                              </span>
                            </div>
                          </div>
                          <button type="button" className="arena-ads-plant-select-btn">
                            {isSelected ? '✓ ELEGIDA' : 'ELEGIR'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Deck Preview Row */}
              {activeRun?.deck && (
                <div className="arena-ads-deck-preview">
                  <div className="arena-ads-deck-preview-title">
                    <span>🃏 Tu Mazo de 5 Cartas para el Nivel {activeRun.level}:</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      🌻 Girasol fijo • Resto aleatorias o elegidas
                    </span>
                  </div>
                  <div className="arena-ads-deck-cards-row">
                    {activeRun.deck.map((card, idx) => {
                      const cfg = (PLANT_CONFIGS as any)[card.plantId] || PLANT_CONFIGS.peashooter
                      const isSunflower = card.plantId === 'sunflower'
                      const isFused = Boolean(card.statRolls && card.statRolls.length > 0)
                      return (
                        <div
                          key={`${card.plantId}-${idx}`}
                          className={`arena-ads-deck-card ${
                            isSunflower ? 'arena-ads-deck-card--sunflower' : ''
                          } ${isFused ? 'arena-ads-deck-card--fused' : ''}`}
                          title={`${cfg.name}${isSunflower ? ' (Fijo)' : ''}${isFused ? ' (Fusión)' : ''}`}
                        >
                          {isSunflower && <span className="arena-ads-deck-card-lock">🔒</span>}
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
          </div>
        )}

        {/* FOOTER ACTIONS */}
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
              <div style={{ display: 'flex', gap: '10px' }}>
                {activeRun ? (
                  <>
                    <button
                      type="button"
                      className="arena-ads-btn arena-ads-btn--cashout"
                      onClick={handleCashout}
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
                  <button
                    type="button"
                    className="arena-ads-btn arena-ads-btn--primary"
                    onClick={handleStartNewRun}
                  >
                    🎮 PLAY / ENTRAR (100 🪙)
                  </button>
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
