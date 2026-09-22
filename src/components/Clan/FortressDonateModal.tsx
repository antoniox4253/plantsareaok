import { useState } from 'react'
import type { PlantId } from '../../types/game'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import { supabaseService } from '../../services/supabaseService'
import { soundManager } from '../../utils/audioManager'
import GoldIcon from '../Common/GoldIcon'
import './FortressDonateModal.css'

interface FortressDonateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newBudget: number, sunsGained: number) => void
  plantCopies: Record<PlantId, number>
  userGold: number
  userGems?: number
  clanName: string
  currentBudget: number
  maxBudget?: number
  sunsSpent?: number
  motherTreeLevel?: number
}

export default function FortressDonateModal({
  isOpen,
  onClose,
  onSuccess,
  plantCopies,
  userGold,
  userGems = 0,
  clanName,
  currentBudget,
  maxBudget = 1000,
  sunsSpent = 0,
  motherTreeLevel = 1,
}: FortressDonateModalProps) {
  const [donateTab, setDonateTab] = useState<'seeds' | 'gems' | 'gold'>('seeds')
  const [selectedPlant, setSelectedPlant] = useState<PlantId | null>(null)
  const [copiesToDonate, setCopiesToDonate] = useState<number>(1)
  const [gemsToDonate, setGemsToDonate] = useState<number>(100)
  const [goldToDonate, setGoldToDonate] = useState<number>(500)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  // Plantas de las que el usuario tiene copias > 0
  const availableSeeds = (Object.keys(PLANT_CONFIGS) as PlantId[]).filter(
    (pid) => (plantCopies[pid] || 0) > 0
  )

  const selectedMaxCopies = selectedPlant ? (plantCopies[selectedPlant] || 0) : 0

  // Cálculo de soles estimados:
  // 1 copia = 100 soles
  // 100 gemas = 200 soles
  // 100 oro = 100 soles
  let estimatedSuns = 0
  if (donateTab === 'seeds' && selectedPlant) {
    estimatedSuns = copiesToDonate * 100
  } else if (donateTab === 'gems') {
    estimatedSuns = Math.floor(gemsToDonate * 2)
  } else if (donateTab === 'gold') {
    estimatedSuns = goldToDonate
  }

  const freeSuns = Math.max(0, currentBudget - sunsSpent)

  const handleDonate = async () => {
    setErrorMsg(null)
    setIsSubmitting(true)

    try {
      let res
      if (donateTab === 'seeds') {
        if (!selectedPlant) {
          setErrorMsg('Selecciona una planta para donar copias')
          setIsSubmitting(false)
          return
        }
        res = await supabaseService.donateSunsToFortress(selectedPlant, copiesToDonate, 0, 0)
      } else if (donateTab === 'gems') {
        if (gemsToDonate < 50) {
          setErrorMsg('La donación mínima de gemas es 50 💎')
          setIsSubmitting(false)
          return
        }
        if (userGems < gemsToDonate) {
          setErrorMsg('No tienes suficientes gemas')
          setIsSubmitting(false)
          return
        }
        res = await supabaseService.donateSunsToFortress(undefined, 0, 0, gemsToDonate)
      } else {
        if (goldToDonate < 100) {
          setErrorMsg('La donación mínima de oro es 100 🪙')
          setIsSubmitting(false)
          return
        }
        if (userGold < goldToDonate) {
          setErrorMsg('No tienes suficiente oro')
          setIsSubmitting(false)
          return
        }
        res = await supabaseService.donateSunsToFortress(undefined, 0, goldToDonate, 0)
      }

      if (!res.success) {
        setErrorMsg(res.error || 'No se pudo completar la donación')
        setIsSubmitting(false)
        return
      }

      soundManager.playSound('click', 0.6)
      onSuccess(res.newBudget || (currentBudget + (res.sunsGained || 0)), res.sunsGained || 0)
      onClose()
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error en la conexión')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fortress-modal-backdrop" onClick={onClose}>
      <div className="fortress-modal-card fortress-modal-card--horizontal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fortress-modal-header">
          <div className="fortress-modal-title">
            <span className="fortress-modal-icon">☀️</span>
            <div>
              <h3>ALTAR SOLAR DEL CLAN</h3>
              <p>Consagra recursos comunitarios para fortalecer el bastión defensivo de {clanName}</p>
            </div>
          </div>
          <button type="button" className="fortress-modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Contenido en 2 Columnas Horizontales */}
        <div className="fortress-modal-body fortress-modal-body--horizontal">
          {/* COLUMNA IZQUIERDA: MÉTRICAS Y EXPLICACIÓN DEL FLUJO SOLAR */}
          <div className="fortress-altar-info-col">
            {/* 1. Tarjeta de Métricas Solares del Clan */}
            <div className="fortress-solar-metrics-card">
              <div className="fortress-solar-metrics-title">
                <span>☀️</span>
                <h4>ESTADO DE ENERGÍA SOLAR</h4>
              </div>

              <div className="fortress-solar-stat-row">
                <span className="label">Presupuesto Solar Acumulado:</span>
                <span className="val">
                  <strong>{currentBudget.toLocaleString()}</strong> / {maxBudget.toLocaleString()} ☀️
                </span>
              </div>
              <div className="fortress-budget-track">
                <div
                  className="fortress-budget-fill"
                  style={{ width: `${Math.min(100, Math.max(0, (currentBudget / maxBudget) * 100))}%` }}
                />
              </div>

              <div className="fortress-solar-chips-grid">
                <div className="fortress-solar-chip fortress-solar-chip--spent">
                  <span className="chip-label">🛡️ En Defensas:</span>
                  <strong className="chip-val">{sunsSpent.toLocaleString()} ☀️</strong>
                </div>
                <div className="fortress-solar-chip fortress-solar-chip--free">
                  <span className="chip-label">🌿 Libres para Formación:</span>
                  <strong className="chip-val">{freeSuns.toLocaleString()} ☀️</strong>
                </div>
              </div>

              {estimatedSuns > 0 && (
                <div className="fortress-gain-callout">
                  <span>✨ Tu donación aportará:</span>
                  <strong>+ {estimatedSuns.toLocaleString()} ☀️ Permanentes</strong>
                </div>
              )}
            </div>

            {/* 2. Sección Didáctica Informativa: Cómo Funciona el Ciclo Solar */}
            <div className="fortress-solar-flow-card">
              <div className="fortress-flow-header">
                <span>📖</span>
                <h5>CÓMO FUNCIONA LA ENERGÍA SOLAR</h5>
              </div>

              <div className="fortress-flow-steps">
                <div className="fortress-flow-step">
                  <div className="step-badge">🌳</div>
                  <div>
                    <strong>1. Techo Máximo del Árbol</strong>
                    <p>El Árbol Madre (Nv. {motherTreeLevel}) expande el límite de almacenamiento (+500 ☀️ por ascenso).</p>
                  </div>
                </div>

                <div className="fortress-flow-step">
                  <div className="step-badge">☀️</div>
                  <div>
                    <strong>2. Consagración en el Altar</strong>
                    <p>Los miembros donan copias, gemas u oro para elevar permanentemente el presupuesto solar del clan.</p>
                  </div>
                </div>

                <div className="fortress-flow-step">
                  <div className="step-badge">🛡️</div>
                  <div>
                    <strong>3. Consumo en Defensas</strong>
                    <p>Cada planta y trampa armada en la arena consume soles de este tesoro solar acumulado.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: PANELES DE ACCIÓN Y DONACIÓN */}
          <div className="fortress-altar-action-col">
            {/* Selector de 3 tipos de donación */}
            <div className="fortress-modal-tabs fortress-modal-tabs--three">
              <button
                type="button"
                className={`fortress-modal-tab ${donateTab === 'seeds' ? 'fortress-modal-tab--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setDonateTab('seeds')
                  setErrorMsg(null)
                }}
              >
                🌱 COPIAS (1 = 100☀️)
              </button>
              <button
                type="button"
                className={`fortress-modal-tab ${donateTab === 'gems' ? 'fortress-modal-tab--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setDonateTab('gems')
                  setErrorMsg(null)
                }}
              >
                💎 GEMAS (100 = 200☀️)
              </button>
              <button
                type="button"
                className={`fortress-modal-tab ${donateTab === 'gold' ? 'fortress-modal-tab--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setDonateTab('gold')
                  setErrorMsg(null)
                }}
              >
                🪙 ORO (100 = 100☀️)
              </button>
            </div>

            {/* TAB 1: COPIAS DE PLANTAS */}
            {donateTab === 'seeds' && (
              <div className="fortress-donate-pane">
                <p className="fortress-donate-hint">
                  Dona copias sobrantes de plantas. <strong>Cada copia otorga +100 Soles</strong> permanentes a la fortaleza.
                </p>

                {availableSeeds.length === 0 ? (
                  <div className="fortress-donate-empty">
                    <span>🍃 No tienes copias duplicadas de plantas en tu inventario.</span>
                    <small>Abre sobres en la tienda o gana partidas PvP para obtener más copias.</small>
                  </div>
                ) : (
                  <div className="fortress-seeds-grid">
                    {availableSeeds.map((pid) => {
                      const cfg = PLANT_CONFIGS[pid]
                      const count = plantCopies[pid] || 0
                      const isSelected = selectedPlant === pid
                      return (
                        <div
                          key={pid}
                          className={`fortress-seed-item ${isSelected ? 'fortress-seed-item--selected' : ''}`}
                          onClick={() => {
                            soundManager.playSound('click', 0.2)
                            setSelectedPlant(pid)
                            setCopiesToDonate(1)
                          }}
                        >
                          <img src={cfg.icon} alt={cfg.name} className="fortress-seed-img" />
                          <span className="fortress-seed-name">{cfg.name}</span>
                          <span className="fortress-seed-badge">x{count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {selectedPlant && (
                  <div className="fortress-quantity-control">
                    <label>Cantidad a consagrar (Disponibles: {selectedMaxCopies}):</label>
                    <div className="fortress-qty-buttons">
                      <button
                        type="button"
                        disabled={copiesToDonate <= 1}
                        onClick={() => setCopiesToDonate((q) => Math.max(1, q - 1))}
                      >
                        -
                      </button>
                      <span className="fortress-qty-val">{copiesToDonate}</span>
                      <button
                        type="button"
                        disabled={copiesToDonate >= selectedMaxCopies}
                        onClick={() => setCopiesToDonate((q) => Math.min(selectedMaxCopies, q + 1))}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="fortress-qty-max-btn"
                        onClick={() => setCopiesToDonate(selectedMaxCopies)}
                      >
                        MÁX
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: GEMAS AL TESORO */}
            {donateTab === 'gems' && (
              <div className="fortress-donate-pane">
                <p className="fortress-donate-hint">
                  Por cada <strong>100 Gemas donadas recibes 200 Soles</strong> (+100% de bonificación solar).
                </p>

                <div className="fortress-gold-user-balance">
                  <span>Tus Gemas disponibles:</span>
                  <strong style={{ color: '#67e8f9' }}>
                    💎 {userGems.toLocaleString()}
                  </strong>
                </div>

                <div className="fortress-gold-presets">
                  {[50, 100, 250, 500].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`fortress-gold-preset-btn ${gemsToDonate === amount ? 'active' : ''}`}
                      onClick={() => {
                        soundManager.playSound('click', 0.2)
                        setGemsToDonate(amount)
                      }}
                      disabled={userGems < amount}
                    >
                      💎 {amount.toLocaleString()}
                      <small>+{amount * 2} ☀️</small>
                    </button>
                  ))}
                </div>

                <div className="fortress-custom-gold-input">
                  <label>Gemas a consagrar:</label>
                  <input
                    type="number"
                    min={50}
                    step={25}
                    max={userGems}
                    value={gemsToDonate}
                    onChange={(e) => setGemsToDonate(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: ORO */}
            {donateTab === 'gold' && (
              <div className="fortress-donate-pane">
                <p className="fortress-donate-hint">
                  Convierte tus monedas de oro en poder solar: <strong>100 Oro = 100 Soles</strong> (Relación 1 a 1).
                </p>

                <div className="fortress-gold-user-balance">
                  <span>Tu Oro disponible:</span>
                  <strong>
                    <GoldIcon size={18} /> {userGold.toLocaleString()}
                  </strong>
                </div>

                <div className="fortress-gold-presets">
                  {[100, 250, 500, 1000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`fortress-gold-preset-btn ${goldToDonate === amount ? 'active' : ''}`}
                      onClick={() => {
                        soundManager.playSound('click', 0.2)
                        setGoldToDonate(amount)
                      }}
                      disabled={userGold < amount}
                    >
                      🪙 {amount.toLocaleString()}
                      <small>+{amount} ☀️</small>
                    </button>
                  ))}
                </div>

                <div className="fortress-custom-gold-input">
                  <label>Oro a consagrar:</label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    max={userGold}
                    value={goldToDonate}
                    onChange={(e) => setGoldToDonate(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>
            )}

            {errorMsg && <div className="fortress-error-alert">{errorMsg}</div>}

            {/* Footer de acción de la columna */}
            <div className="fortress-action-footer">
              <button
                type="button"
                className="fortress-btn-confirm"
                onClick={handleDonate}
                disabled={
                  isSubmitting ||
                  (donateTab === 'seeds' && !selectedPlant) ||
                  (donateTab === 'gems' && userGems < gemsToDonate) ||
                  (donateTab === 'gold' && userGold < goldToDonate)
                }
              >
                {isSubmitting ? 'CONSAGRANDO...' : `☀️ CONSAGRAR EN EL ALTAR (+${estimatedSuns} SOLES)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
