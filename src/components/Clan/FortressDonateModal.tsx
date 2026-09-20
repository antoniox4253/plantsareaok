import React, { useState } from 'react'
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
  clanName: string
  currentBudget: number
}

const SUNS_BY_RARITY: Record<string, number> = {
  common: 25,
  uncommon: 40,
  rare: 75,
  epic: 150,
  legendary: 300,
}

export default function FortressDonateModal({
  isOpen,
  onClose,
  onSuccess,
  plantCopies,
  userGold,
  clanName,
  currentBudget,
}: FortressDonateModalProps) {
  const [donateTab, setDonateTab] = useState<'seeds' | 'gold'>('seeds')
  const [selectedPlant, setSelectedPlant] = useState<PlantId | null>(null)
  const [copiesToDonate, setCopiesToDonate] = useState<number>(1)
  const [goldToDonate, setGoldToDonate] = useState<number>(1000)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  // Plantas de las que el usuario tiene copias > 0
  const availableSeeds = (Object.keys(PLANT_CONFIGS) as PlantId[]).filter(
    (pid) => (plantCopies[pid] || 0) > 0
  )

  const selectedConfig = selectedPlant ? PLANT_CONFIGS[selectedPlant] : null
  const selectedMaxCopies = selectedPlant ? (plantCopies[selectedPlant] || 0) : 0

  // Cálculo de soles estimados
  let estimatedSuns = 0
  if (donateTab === 'seeds' && selectedPlant) {
    // Estimación por rareza según coste base
    const baseCost = selectedConfig?.cost || 100
    let sunsPerCopy = 25
    if (baseCost >= 300) sunsPerCopy = 300
    else if (baseCost >= 200) sunsPerCopy = 75
    else if (baseCost >= 125) sunsPerCopy = 40
    estimatedSuns = copiesToDonate * sunsPerCopy
  } else if (donateTab === 'gold') {
    estimatedSuns = Math.floor(goldToDonate / 10)
  }

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
        res = await supabaseService.donateSunsToFortress(selectedPlant, copiesToDonate, 0)
      } else {
        if (goldToDonate < 500) {
          setErrorMsg('La donación mínima de oro es 500 🪙')
          setIsSubmitting(false)
          return
        }
        if (userGold < goldToDonate) {
          setErrorMsg('No tienes suficiente oro')
          setIsSubmitting(false)
          return
        }
        res = await supabaseService.donateSunsToFortress(undefined, 0, goldToDonate)
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
      <div className="fortress-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="fortress-modal-header">
          <div className="fortress-modal-title">
            <span className="fortress-modal-icon">☀️</span>
            <div>
              <h3>ALTAR SOLAR DEL CLAN</h3>
              <p>Fortalece el bastión defensivo de {clanName}</p>
            </div>
          </div>
          <button type="button" className="fortress-modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="fortress-modal-body">
          {/* Indicador de presupuesto actual */}
          <div className="fortress-budget-banner">
            <div className="fortress-budget-stat">
              <span className="label">Presupuesto Solar Actual</span>
              <strong className="value">☀️ {currentBudget} Soles</strong>
            </div>
            {estimatedSuns > 0 && (
              <div className="fortress-budget-stat fortress-budget-stat--gain">
                <span className="label">Aumento Estimado</span>
                <strong className="value-gain">+ {estimatedSuns} ☀️</strong>
              </div>
            )}
          </div>

          {/* Selector de tipo de donación */}
          <div className="fortress-modal-tabs">
            <button
              type="button"
              className={`fortress-modal-tab ${donateTab === 'seeds' ? 'fortress-modal-tab--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.3)
                setDonateTab('seeds')
                setErrorMsg(null)
              }}
            >
              🌱 QUEMA DE COPIAS DE PLANTAS
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
              🪙 ORO DEL JUGADOR
            </button>
          </div>

          {/* TAB 1: DONACIÓN DE COPIAS DE CARTAS */}
          {donateTab === 'seeds' && (
            <div className="fortress-donate-seeds-pane">
              <p className="fortress-donate-hint">
                Dona copias duplicadas de tus cartas para quemarlas en el Altar Solar. Cada copia otorga Soles
                permanentes al presupuesto de tu clan.
              </p>

              {availableSeeds.length === 0 ? (
                <div className="fortress-donate-empty">
                  <span>🍃 No tienes copias duplicadas de plantas en tu inventario.</span>
                  <small>Consigue sobres en la tienda o partidas PvP para obtener más copias.</small>
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
                  <label>Cantidad de copias a donar (Disponibles: {selectedMaxCopies}):</label>
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

          {/* TAB 2: DONACIÓN DE ORO */}
          {donateTab === 'gold' && (
            <div className="fortress-donate-gold-pane">
              <p className="fortress-donate-hint">
                Convierte tus monedas de oro en energía solar para el clan. <strong>1,000 Oro = 100 Soles</strong>.
              </p>

              <div className="fortress-gold-user-balance">
                <span>Tu saldo de oro disponible:</span>
                <strong>
                  <GoldIcon size={18} /> {userGold.toLocaleString()}
                </strong>
              </div>

              <div className="fortress-gold-presets">
                {[500, 1000, 2500, 5000].map((amount) => (
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
                    🪙 {amount.toLocaleString()} Oro
                    <small>+{Math.floor(amount / 10)} ☀️</small>
                  </button>
                ))}
              </div>

              <div className="fortress-custom-gold-input">
                <label>Cantidad personalizada de oro:</label>
                <input
                  type="number"
                  min={500}
                  step={100}
                  max={userGold}
                  value={goldToDonate}
                  onChange={(e) => setGoldToDonate(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>
          )}

          {errorMsg && <div className="fortress-error-alert">{errorMsg}</div>}
        </div>

        <div className="fortress-modal-footer">
          <button type="button" className="fortress-btn-cancel" onClick={onClose} disabled={isSubmitting}>
            CANCELAR
          </button>
          <button
            type="button"
            className="fortress-btn-confirm"
            onClick={handleDonate}
            disabled={isSubmitting || (donateTab === 'seeds' && !selectedPlant) || (donateTab === 'gold' && userGold < goldToDonate)}
          >
            {isSubmitting ? 'DONANDO...' : `☀️ DONAR Y SUMAR +${estimatedSuns} SOLES`}
          </button>
        </div>
      </div>
    </div>
  )
}
