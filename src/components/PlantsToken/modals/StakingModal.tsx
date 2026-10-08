import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { soundManager } from '../../../utils/audioManager'
import { plantsTokenService, type StakingSummary } from '../../../services/plantsTokenService'
import type { TokenTabType } from '../types'

interface StakingModalProps {
  isOpen: boolean
  onClose: () => void
  liquidPlants: number
  onTabChange?: (tab: TokenTabType) => void
  onRefreshData?: () => Promise<void>
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void
}

export const StakingModal: React.FC<StakingModalProps> = ({
  isOpen,
  onClose,
  liquidPlants,
  onTabChange,
  onRefreshData,
  showNotification,
}) => {
  const [stakingSummary, setStakingSummary] = useState<StakingSummary | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<30 | 60 | 90>(30)
  const [amountStr, setAmountStr] = useState<string>('500')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isClaiming, setIsClaiming] = useState<boolean>(false)
  const [unstakingId, setUnstakingId] = useState<string | null>(null)

  // Cargar datos de staking en vivo
  const loadStakingData = useCallback(async () => {
    try {
      const summary = await plantsTokenService.getMyStakingPositions()
      if (summary) {
        setStakingSummary(summary)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    loadStakingData()
    const timer = setInterval(loadStakingData, 8000)
    return () => clearInterval(timer)
  }, [isOpen, loadStakingData])

  const parsedAmount = useMemo(() => {
    const val = parseFloat(amountStr)
    return isNaN(val) || val <= 0 ? 0 : val
  }, [amountStr])

  // Previsualización de ganancias
  const preview = useMemo(() => {
    return plantsTokenService.calculateStakingPreview(parsedAmount, selectedDuration)
  }, [parsedAmount, selectedDuration])

  const hasEnoughBalance = liquidPlants >= parsedAmount
  const canSubmit =
    parsedAmount >= preview.minAmount &&
    hasEnoughBalance &&
    !isSubmitting &&
    !isLoading

  const handleClose = () => {
    soundManager.playSound('click', 0.4)
    onClose()
  }

  const handleGoToTab = () => {
    soundManager.playSound('click', 0.4)
    onClose()
    if (onTabChange) {
      onTabChange('staking')
    }
  }

  // Atajos rápidos de monto
  const handleSetMin = () => {
    soundManager.playSound('click', 0.4)
    setAmountStr(String(preview.minAmount))
  }

  const handleSetPercent = (pct: number) => {
    soundManager.playSound('click', 0.4)
    const val = Math.floor(liquidPlants * (pct / 100))
    setAmountStr(String(Math.max(0, val)))
  }

  const handleSetMax = () => {
    soundManager.playSound('click', 0.4)
    setAmountStr(String(Math.floor(liquidPlants)))
  }

  // Iniciar staking
  const handleStartStaking = async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    soundManager.playSound('upgrade', 0.7)

    const res = await plantsTokenService.stakePlants(parsedAmount, selectedDuration)
    setIsSubmitting(false)

    if (res.success) {
      soundManager.playSound('victory', 0.8)
      showNotification(
        `🌿 ¡Staking de ${parsedAmount.toLocaleString()} PLANTS iniciado con éxito por ${selectedDuration} días!`,
        'success'
      )
      await Promise.all([loadStakingData(), onRefreshData?.()])
    } else {
      soundManager.playSound('defeat', 0.5)
      showNotification(res.error || 'No fue posible iniciar el staking', 'error')
    }
  }

  // Reclamar cosecha diaria
  const handleClaimDailyRewards = async (positionId?: string) => {
    if (isClaiming) return
    setIsClaiming(true)
    soundManager.playSound('click', 0.4)

    const res = await plantsTokenService.claimStakingDailyRewards(positionId)
    setIsClaiming(false)

    if (res.success) {
      soundManager.playSound('victory', 0.8)
      const gems = res.claimedGems ?? 0
      const gold = res.claimedGold ?? 0
      showNotification(
        `🎉 ¡Cosecha reclamada! +${gems.toFixed(2)} Gemas 💎 y +${gold.toLocaleString()} Oro 🪙 añadidos a tu cuenta.`,
        'success'
      )
      await Promise.all([loadStakingData(), onRefreshData?.()])
    } else {
      soundManager.playSound('defeat', 0.5)
      showNotification(res.error || 'No se pudieron reclamar las recompensas', 'error')
    }
  }

  // Liberar staking maduro
  const handleUnstake = async (posId: string) => {
    if (unstakingId) return
    setUnstakingId(posId)
    soundManager.playSound('click', 0.5)

    const res = await plantsTokenService.unstakePlants(posId)
    setUnstakingId(null)

    if (res.success) {
      soundManager.playSound('victory', 0.9)
      const plants = res.unlockedPlants ?? 0
      const desc = res.bonusDescription ? ` (${res.bonusDescription})` : ''
      showNotification(
        `🏆 ¡Staking completado! +${plants.toLocaleString()} PLANTS devueltos a tu saldo y has recibido tus bonus${desc}.`,
        'success'
      )
      await Promise.all([loadStakingData(), onRefreshData?.()])
    } else {
      soundManager.playSound('defeat', 0.5)
      showNotification(res.error || 'No fue posible retirar el staking', 'error')
    }
  }

  const formatCountdown = (secs: number) => {
    if (secs <= 0) return '¡Maduro / Listo!'
    const d = Math.floor(secs / 86400)
    const h = Math.floor((secs % 86400) / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
  }

  if (!isOpen) return null

  const positions = stakingSummary?.positions ?? []
  const totalStaked = stakingSummary?.totalStaked ?? 0
  const claimableGemsTotal = stakingSummary?.totalClaimableGems ?? 0
  const claimableGoldTotal = stakingSummary?.totalClaimableGold ?? 0

  return (
    <div className="token-modal-backdrop" onClick={handleClose}>
      <div className="token-modal-card staking-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="token-modal-header">
          <div className="token-modal-header-left">
            <span className="token-modal-icon">🌿</span>
            <div>
              <div className="staking-modal-title-row">
                <h3 className="token-modal-title">CULTIVO Y STAKING DE PLANTS</h3>
                <span className="staking-modal-badge">100% RETORNO DE CAPITAL</span>
              </div>
              <p className="token-modal-subtitle">
                Cultiva tokens PLANTS líquidos para cosechar Gemas 💎 y Oro 🪙 diarios sin inflación ni riesgo de pérdida
              </p>
            </div>
          </div>

          <div className="staking-modal-header-actions">
            {onTabChange && (
              <button
                type="button"
                className="staking-modal-tab-btn"
                onClick={handleGoToTab}
                title="Abrir pestaña completa en el centro"
              >
                <span>↗ IR A PESTAÑA</span>
              </button>
            )}
            <button type="button" className="token-modal-close-btn" onClick={handleClose} title="Cerrar">
              ✕
            </button>
          </div>
        </header>

        {/* KPIs Strip */}
        <section className="staking-modal-kpis">
          <div className="staking-modal-kpi-card">
            <span className="staking-modal-kpi-lbl">TOTAL PLANTS BLOQUEADOS</span>
            <div className="staking-modal-kpi-val-row">
              <strong className="staking-modal-kpi-val text-green">{totalStaked.toLocaleString()}</strong>
              <span className="staking-modal-kpi-tag text-mint">
                {stakingSummary?.activeCount ?? 0} BLOQUES
              </span>
            </div>
            <span className="staking-modal-kpi-sub">Capital en cultivo activo</span>
          </div>

          <div className="staking-modal-kpi-card">
            <span className="staking-modal-kpi-lbl">GEMAS POR COBRAR HOY</span>
            <div className="staking-modal-kpi-val-row">
              <strong className="staking-modal-kpi-val text-cyan">+{claimableGemsTotal.toFixed(2)}</strong>
              <span className="staking-modal-kpi-tag text-cyan">💎 EN VIVO</span>
            </div>
            <span className="staking-modal-kpi-sub">Acumulado en tiempo real</span>
          </div>

          <div className="staking-modal-kpi-card">
            <span className="staking-modal-kpi-lbl">ORO POR COBRAR HOY</span>
            <div className="staking-modal-kpi-val-row">
              <strong className="staking-modal-kpi-val text-gold">+{claimableGoldTotal.toLocaleString()}</strong>
              <span className="staking-modal-kpi-tag text-gold">🪙 EN VIVO</span>
            </div>
            <span className="staking-modal-kpi-sub">Para mejoras en el Jardín</span>
          </div>

          <div className="staking-modal-kpi-card">
            <span className="staking-modal-kpi-lbl">SALDO LÍQUIDO DISPONIBLE</span>
            <div className="staking-modal-kpi-val-row">
              <strong className="staking-modal-kpi-val text-white">{liquidPlants.toLocaleString()}</strong>
              <span className="staking-modal-kpi-tag text-green">DISPONIBLE</span>
            </div>
            <span className="staking-modal-kpi-sub">Listo para nuevos cultivos</span>
          </div>
        </section>

        {/* Cosecha rápida global */}
        {(claimableGemsTotal > 0 || claimableGoldTotal > 0) && (
          <div className="staking-modal-claim-bar">
            <div className="staking-modal-claim-info">
              <span className="staking-modal-claim-icon">🧺</span>
              <div>
                <strong>¡Cosecha acumulada lista para recolectar!</strong>
                <span>
                  +{claimableGemsTotal.toFixed(2)} Gemas 💎 y +{claimableGoldTotal.toLocaleString()} Oro 🪙 disponibles
                </span>
              </div>
            </div>
            <button
              type="button"
              className="staking-modal-claim-btn"
              onClick={() => handleClaimDailyRewards()}
              disabled={isClaiming}
            >
              {isClaiming ? 'COSECHANDO...' : '🧺 RECLAMAR TODA LA COSECHA'}
            </button>
          </div>
        )}

        {/* Main Body Grid */}
        <div className="staking-modal-body-grid">
          {/* Left Column: Formulario de nuevo cultivo */}
          <div className="staking-modal-form-card">
            <div className="staking-modal-card-header">
              <h4>🌱 NUEVO BLOQUE DE CULTIVO</h4>
              <span>Elige el plazo y la cantidad</span>
            </div>

            {/* Selector de Plazos / Bloques */}
            <div className="staking-modal-duration-grid">
              <button
                type="button"
                className={`staking-modal-duration-btn ${selectedDuration === 30 ? 'active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setSelectedDuration(30)
                }}
              >
                <div className="duration-btn-top">
                  <span className="duration-btn-title">🌱 30 DÍAS</span>
                  <span className="duration-btn-min">Mín. 500</span>
                </div>
                <span className="duration-btn-reward">🎁 1x Sobre Básico</span>
              </button>

              <button
                type="button"
                className={`staking-modal-duration-btn ${selectedDuration === 60 ? 'active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setSelectedDuration(60)
                }}
              >
                <div className="duration-btn-top">
                  <span className="duration-btn-title">🌿 60 DÍAS</span>
                  <span className="duration-btn-min">Mín. 5,000</span>
                </div>
                <span className="duration-btn-reward">🎁 3x Sobres Básicos</span>
              </button>

              <button
                type="button"
                className={`staking-modal-duration-btn ${selectedDuration === 90 ? 'active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setSelectedDuration(90)
                }}
              >
                <div className="duration-btn-top">
                  <span className="duration-btn-title">👑 90 DÍAS</span>
                  <span className="duration-btn-min">Mín. 25,000</span>
                </div>
                <span className="duration-btn-reward">👑 Sobres + Skin Oro 24K</span>
              </button>
            </div>

            {/* Input de Monto */}
            <div className="staking-modal-input-group">
              <div className="staking-modal-input-lbl-row">
                <label>PLANTS a cultivar:</label>
                <span className="staking-modal-balance-hint">
                  Disponible: <strong>{liquidPlants.toLocaleString()}</strong>
                </span>
              </div>

              <div className="staking-modal-input-wrap">
                <input
                  type="number"
                  min={preview.minAmount}
                  step="100"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder={`Mínimo ${preview.minAmount}`}
                  className="staking-modal-amount-input"
                />
                <span className="staking-modal-input-suffix">PLANTS</span>
              </div>

              {/* Botones rápidos */}
              <div className="staking-modal-quick-row">
                <button type="button" onClick={handleSetMin} className="staking-modal-quick-btn">
                  MÍN ({preview.minAmount.toLocaleString()})
                </button>
                <button type="button" onClick={() => handleSetPercent(25)} className="staking-modal-quick-btn">
                  25%
                </button>
                <button type="button" onClick={() => handleSetPercent(50)} className="staking-modal-quick-btn">
                  50%
                </button>
                <button type="button" onClick={handleSetMax} className="staking-modal-quick-btn">
                  MÁX ({Math.floor(liquidPlants).toLocaleString()})
                </button>
              </div>

              {/* Advertencias */}
              {parsedAmount > 0 && parsedAmount < preview.minAmount && (
                <div className="staking-modal-alert warning">
                  ⚠️ El mínimo para {selectedDuration} días es de <strong>{preview.minAmount.toLocaleString()} PLANTS</strong>.
                </div>
              )}
              {parsedAmount > liquidPlants && (
                <div className="staking-modal-alert error">
                  ❌ Saldo líquido insuficiente ({liquidPlants.toLocaleString()} disponibles).
                </div>
              )}
            </div>

            {/* Rendimiento estimado */}
            <div className="staking-modal-yield-preview">
              <div className="yield-line">
                <span>💎 Gemas Diarias</span>
                <strong className="text-cyan">+{preview.dailyGemRate.toFixed(4)} / día</strong>
              </div>
              <div className="yield-line">
                <span>🪙 Oro Diario</span>
                <strong className="text-gold">+{preview.dailyGoldRate.toFixed(2)} / día</strong>
              </div>
              <div className="yield-line highlight">
                <span>Total Cosecha al Vencer</span>
                <strong className="text-green">
                  ~{preview.totalEstimatedGems} 💎 / ~{preview.totalEstimatedGold} 🪙
                </strong>
              </div>
              <div className="yield-bonus-tag">
                <span>🎁 BONUS FINAL: {preview.bonusDesc}</span>
              </div>
            </div>

            {/* Botón de Submit */}
            <button
              type="button"
              className="staking-modal-submit-btn"
              onClick={handleStartStaking}
              disabled={!canSubmit}
            >
              {isSubmitting
                ? 'PROCESANDO...'
                : `🚀 CULTIVAR ${parsedAmount > 0 ? parsedAmount.toLocaleString() : '0'} PLANTS POR ${selectedDuration} DÍAS`}
            </button>
          </div>

          {/* Right Column: Bloques Realizados / Posiciones */}
          <div className="staking-modal-positions-card">
            <div className="staking-modal-card-header">
              <h4>🧱 BLOQUES REALIZADOS ({positions.length})</h4>
              <span>Supervisa tus posiciones y cobra ganancias</span>
            </div>

            {positions.length === 0 ? (
              <div className="staking-modal-empty">
                <span className="empty-icon">🪴</span>
                <h5>No tienes ningún bloque de cultivo activo</h5>
                <p>
                  Cultiva tus tokens PLANTS con el formulario de la izquierda para comenzar a recibir Gemas y Oro todos los días de forma automática.
                </p>
                <div className="empty-tip">
                  <span>💡 El 100% de tus PLANTS regresa a tu saldo al finalizar el plazo elegido.</span>
                </div>
              </div>
            ) : (
              <div className="staking-modal-positions-list">
                {positions.map((pos) => {
                  const progressPct = Math.min(
                    100,
                    Math.max(
                      0,
                      ((new Date().getTime() - new Date(pos.startDate).getTime()) /
                        (new Date(pos.endDate).getTime() - new Date(pos.startDate).getTime())) *
                        100
                    )
                  )

                  return (
                    <article key={pos.id} className={`staking-modal-pos-item ${pos.isMature ? 'mature' : ''}`}>
                      <div className="pos-item-header">
                        <div className="pos-title-wrap">
                          <span className="pos-icon">
                            {pos.durationDays === 90 ? '👑' : pos.durationDays === 60 ? '🌿' : '🌱'}
                          </span>
                          <div>
                            <strong>{pos.amount.toLocaleString()} PLANTS</strong>
                            <span className="pos-duration-chip">Plan {pos.durationDays} Días</span>
                            {pos.status === 'completed' && <span className="pos-tag completed">COMPLETADO</span>}
                            {pos.status === 'active' && pos.isMature && (
                              <span className="pos-tag ready">¡LISTO PARA LIBERAR!</span>
                            )}
                          </div>
                        </div>

                        <div className="pos-countdown-wrap">
                          <span className="pos-countdown-lbl">Restante:</span>
                          <strong className="pos-countdown-val">{formatCountdown(pos.secondsRemaining)}</strong>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="pos-progress-track">
                        <div className="pos-progress-bar" style={{ width: `${progressPct}%` }} />
                      </div>

                      {/* Stats del bloque */}
                      <div className="pos-stats-grid">
                        <div className="pos-stat">
                          <span className="lbl">💎 Gemas/día:</span>
                          <strong className="text-cyan">+{pos.dailyGemRate.toFixed(2)}</strong>
                        </div>
                        <div className="pos-stat">
                          <span className="lbl">🪙 Oro/día:</span>
                          <strong className="text-gold">+{pos.dailyGoldRate.toLocaleString()}</strong>
                        </div>
                        <div className="pos-stat">
                          <span className="lbl">🧺 Por cobrar:</span>
                          <strong className="text-mint">
                            +{pos.claimableGemsNow.toFixed(2)} 💎 / +{pos.claimableGoldNow.toLocaleString()} 🪙
                          </strong>
                        </div>
                      </div>

                      {/* Acciones */}
                      {pos.status === 'active' && (
                        <div className="pos-actions">
                          {pos.isMature ? (
                            <button
                              type="button"
                              className="pos-action-btn unstake"
                              onClick={() => handleUnstake(pos.id)}
                              disabled={unstakingId === pos.id}
                            >
                              {unstakingId === pos.id ? 'LIBERANDO...' : '🎉 COBRAR BONUS & LIBERAR PLANTS'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="pos-action-btn claim"
                              onClick={() => handleClaimDailyRewards(pos.id)}
                              disabled={isClaiming || (pos.claimableGemsNow <= 0 && pos.claimableGoldNow <= 0)}
                            >
                              {isClaiming ? 'COSECHANDO...' : '💎 COSECHAR GANANCIAS DIARIAS'}
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
