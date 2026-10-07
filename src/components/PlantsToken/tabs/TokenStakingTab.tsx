import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { TokenHubSharedProps } from '../types'
import { plantsTokenService, type StakingSummary } from '../../../services/plantsTokenService'
import { soundManager } from '../../../utils/audioManager'
import { TOKEN_ASSETS } from '../tokenAssets'

export const TokenStakingTab: React.FC<TokenHubSharedProps> = ({
  liquidPlants,
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

  // Cargar datos de staking
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
    loadStakingData()
    const timer = setInterval(loadStakingData, 10000)
    return () => clearInterval(timer)
  }, [loadStakingData])

  const parsedAmount = useMemo(() => {
    const val = parseFloat(amountStr)
    return isNaN(val) || val <= 0 ? 0 : val
  }, [amountStr])

  // Previsualización calculada con la fórmula del servicio
  const preview = useMemo(() => {
    return plantsTokenService.calculateStakingPreview(parsedAmount, selectedDuration)
  }, [parsedAmount, selectedDuration])

  // Validación de saldo y monto mínimo
  const hasEnoughBalance = liquidPlants >= parsedAmount
  const canSubmit =
    parsedAmount >= preview.minAmount &&
    hasEnoughBalance &&
    !isSubmitting &&
    !isLoading

  // Atajos de porcentaje
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

  // Enviar orden de staking
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
      await Promise.all([loadStakingData(), onRefreshData()])
    } else {
      soundManager.playSound('defeat', 0.5)
      showNotification(res.error || 'No fue posible iniciar el staking', 'error')
    }
  }

  // Reclamar recompensas acumuladas
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
        `🎉 ¡Cosecha diaria reclamada! +${gems.toFixed(2)} Gemas 💎 y +${gold.toLocaleString()} Oro 🪙 añadidos a tu cuenta.`,
        'success'
      )
      await Promise.all([loadStakingData(), onRefreshData()])
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
        `🏆 ¡Staking completado! +${plants.toLocaleString()} PLANTS devueltos a tu saldo líquido y has recibido tus bonus${desc}.`,
        'success'
      )
      await Promise.all([loadStakingData(), onRefreshData()])
    } else {
      soundManager.playSound('defeat', 0.5)
      showNotification(res.error || 'No fue posible retirar el staking', 'error')
    }
  }

  const formatCountdown = (secs: number) => {
    if (secs <= 0) return '¡Maduro / Listo para liberar!'
    const d = Math.floor(secs / 86400)
    const h = Math.floor((secs % 86400) / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
  }

  const positions = stakingSummary?.positions ?? []
  const totalStaked = stakingSummary?.totalStaked ?? 0
  const claimableGemsTotal = stakingSummary?.totalClaimableGems ?? 0
  const claimableGoldTotal = stakingSummary?.totalClaimableGold ?? 0

  return (
    <div className="staking-screen">
      {/* =====================================================
           HERO BANNER
           ===================================================== */}
      <section
        className="staking-hero"
        style={
          TOKEN_ASSETS.vestingHeroBanner
            ? { backgroundImage: `url(${TOKEN_ASSETS.vestingHeroBanner})`, backgroundSize: 'cover' }
            : {}
        }
      >
        <div className="staking-hero__content">
          <div className="staking-hero__tag">🌱 INVERNADERO BOTÁNICO & RENDIMIENTO PASIVO</div>
          <h1 className="staking-hero__title">STAKING LIBRE DE TOKENS PLANTS</h1>
          <p className="staking-hero__desc">
            Pon a cultivar tus tokens <strong>PLANTS líquidos</strong> para recibir <strong>Gemas y Oro diarios</strong> en tiempo real sin arriesgar tu capital. Al cumplirse el plazo elegido (30, 60 o 90 días), tus tokens originales se devuelven <strong>100% íntegros</strong> a tu saldo y recibes <strong>Sobres y Skins exclusivas</strong> de recompensa.
          </p>

          <div className="staking-hero__chips">
            <span className="hero-chip">💎 Gemas Diarias en Tiempo Real</span>
            <span className="hero-chip">🪙 Oro Automático para Mejoras</span>
            <span className="hero-chip">🎁 Sobres Básicos, Épicos & Legendarios</span>
            <span className="hero-chip">👑 Skin Oro 24K en Plan 90 Días</span>
            <span className="hero-chip">🔒 100% Devolución de Capital</span>
          </div>
        </div>
      </section>

      {/* =====================================================
           KPIS ROW
           ===================================================== */}
      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-icon-slot">🌿</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">TOTAL PLANTS EN STAKING</span>
            <strong className="kpi-value">{totalStaked.toLocaleString()}</strong>
            <span className="kpi-sub">{stakingSummary?.activeCount ?? 0} Posiciones Activas</span>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon-slot">💎</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">GEMAS POR COBRAR HOY</span>
            <strong className="kpi-value" style={{ color: '#60a5fa' }}>
              +{claimableGemsTotal.toFixed(2)}
            </strong>
            <span className="kpi-sub">Acumulado en tiempo real</span>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon-slot">🪙</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">ORO POR COBRAR HOY</span>
            <strong className="kpi-value" style={{ color: '#fbbf24' }}>
              +{claimableGoldTotal.toLocaleString()}
            </strong>
            <span className="kpi-sub">Acumulado en tiempo real</span>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon-slot">💰</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">SALDO LÍQUIDO DISPONIBLE</span>
            <strong className="kpi-value">{liquidPlants.toLocaleString()}</strong>
            <span className="kpi-sub">Listo para cultivar</span>
          </div>
        </article>
      </section>

      {/* BOTÓN GLOBAL DE RECLAMO RÁPIDO SI HAY GANANCIAS */}
      {(claimableGemsTotal > 0 || claimableGoldTotal > 0) && (
        <section className="staking-claim-bar">
          <div className="staking-claim-bar__info">
            <span className="staking-claim-bar__icon">🧺</span>
            <div>
              <strong>¡Tienes cosecha acumulada lista para recolectar!</strong>
              <p>
                +{claimableGemsTotal.toFixed(2)} Gemas 💎 y +{claimableGoldTotal.toLocaleString()} Oro 🪙 disponibles en tus posiciones activas.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-plants-action btn-plants-action--claim"
            onClick={() => handleClaimDailyRewards()}
            disabled={isClaiming}
          >
            {isClaiming ? 'COSECHANDO...' : 'RECLAMAR TODA LA COSECHA'}
          </button>
        </section>
      )}

      {/* =====================================================
           PANEL PRINCIPAL: CALCULADORA Y NUEVA ORDEN
           ===================================================== */}
      <div className="staking-workspace-grid">
        {/* COLUMNA IZQUIERDA: FORMULARIO */}
        <div className="staking-panel-card">
          <div className="staking-panel-header">
            <h3>🌱 NUEVO CULTIVO DE STAKING</h3>
            <p>Ingresa la cantidad libre de tokens PLANTS y selecciona el plazo deseado.</p>
          </div>

          {/* SELECTOR DE PLAZOS */}
          <div className="staking-duration-selector">
            <button
              type="button"
              className={`staking-duration-btn ${selectedDuration === 30 ? 'active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSelectedDuration(30)
              }}
            >
              <span className="staking-duration-title">🌱 30 DÍAS</span>
              <span className="staking-duration-sub">Mín. 500 PLANTS</span>
              <span className="staking-duration-tag">1x Sobre Básico</span>
            </button>

            <button
              type="button"
              className={`staking-duration-btn ${selectedDuration === 60 ? 'active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSelectedDuration(60)
              }}
            >
              <span className="staking-duration-title">🌿 60 DÍAS</span>
              <span className="staking-duration-sub">Mín. 5,000 PLANTS</span>
              <span className="staking-duration-tag">3x Sobres Básicos</span>
            </button>

            <button
              type="button"
              className={`staking-duration-btn ${selectedDuration === 90 ? 'active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSelectedDuration(90)
              }}
            >
              <span className="staking-duration-title">👑 90 DÍAS</span>
              <span className="staking-duration-sub">Mín. 25,000 PLANTS</span>
              <span className="staking-duration-tag">3 Épicos + 1 Legendario + Skin</span>
            </button>
          </div>

          {/* INPUT LIBRE DE MONTO */}
          <div className="staking-input-group">
            <div className="staking-input-label-row">
              <label htmlFor="staking-amount-input">CANTIDAD DE PLANTS A CULTIVAR:</label>
              <span className="staking-balance-hint">
                Disponible: <strong>{liquidPlants.toLocaleString()} PLANTS</strong>
              </span>
            </div>

            <div className="staking-input-wrapper">
              <input
                id="staking-amount-input"
                type="number"
                min={preview.minAmount}
                step="100"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder={`Mínimo ${preview.minAmount}`}
                className="staking-amount-input"
              />
              <span className="staking-input-suffix">PLANTS</span>
            </div>

            {/* ATAJOS RÁPIDOS */}
            <div className="staking-quick-buttons">
              <button type="button" onClick={handleSetMin} className="staking-quick-btn">
                MÍN ({preview.minAmount.toLocaleString()})
              </button>
              <button type="button" onClick={() => handleSetPercent(25)} className="staking-quick-btn">
                25%
              </button>
              <button type="button" onClick={() => handleSetPercent(50)} className="staking-quick-btn">
                50%
              </button>
              <button type="button" onClick={handleSetMax} className="staking-quick-btn">
                MÁX ({Math.floor(liquidPlants).toLocaleString()})
              </button>
            </div>

            {/* ALERTAS DE VALIDACIÓN */}
            {parsedAmount > 0 && parsedAmount < preview.minAmount && (
              <div className="staking-alert staking-alert--warning">
                ⚠️ El monto mínimo para el plan de {selectedDuration} días es de{' '}
                <strong>{preview.minAmount.toLocaleString()} PLANTS</strong>.
              </div>
            )}

            {parsedAmount > liquidPlants && (
              <div className="staking-alert staking-alert--error">
                ❌ Saldo líquido insuficiente. Necesitas {parsedAmount.toLocaleString()} PLANTS (tienes {liquidPlants.toLocaleString()}).
              </div>
            )}
          </div>

          {/* BOTÓN DE ACCIÓN */}
          <button
            type="button"
            className="btn-plants-action btn-plants-action--primary staking-submit-btn"
            onClick={handleStartStaking}
            disabled={!canSubmit}
          >
            {isSubmitting
              ? 'PROCESANDO...'
              : `🚀 CULTIVAR ${parsedAmount > 0 ? parsedAmount.toLocaleString() : '0'} PLANTS POR ${selectedDuration} DÍAS`}
          </button>
        </div>

        {/* COLUMNA DERECHA: PREVISUALIZACIÓN DE COSECHA */}
        <div className="staking-preview-card">
          <div className="staking-panel-header">
            <h3>📊 COSECHA ESTIMADA EN TIEMPO REAL</h3>
            <p>Rendimiento proyectado para el plazo seleccionado.</p>
          </div>

          <div className="staking-preview-metrics">
            <div className="staking-metric-row">
              <span className="metric-title">💎 Gemas Diarias</span>
              <strong className="metric-val" style={{ color: '#60a5fa' }}>
                +{preview.dailyGemRate.toFixed(4)} 💎 / día
              </strong>
            </div>

            <div className="staking-metric-row">
              <span className="metric-title">🪙 Oro Diario</span>
              <strong className="metric-val" style={{ color: '#fbbf24' }}>
                +{preview.dailyGoldRate.toFixed(2)} 🪙 / día
              </strong>
            </div>

            <div className="staking-metric-row">
              <span className="metric-title">📅 Total Gemas al Vencer</span>
              <strong className="metric-val" style={{ color: '#4ade80' }}>
                ~{preview.totalEstimatedGems.toLocaleString()} Gemas
              </strong>
            </div>

            <div className="staking-metric-row">
              <span className="metric-title">💰 Total Oro al Vencer</span>
              <strong className="metric-val" style={{ color: '#facc15' }}>
                ~{preview.totalEstimatedGold.toLocaleString()} Monedas de Oro
              </strong>
            </div>
          </div>

          {/* BONUS FINAL DE PAQUETES Y SKINS */}
          <div className="staking-bonus-box">
            <span className="staking-bonus-badge">🎁 BONUS FINAL AL DESBLOQUEAR</span>
            <p className="staking-bonus-desc">{preview.bonusDesc}</p>
            <small className="staking-bonus-sub">
              Al vencer el día {selectedDuration}, tus {parsedAmount.toLocaleString()} PLANTS regresan automáticamente a tu saldo líquido sin comisiones.
            </small>
          </div>
        </div>
      </div>

      {/* =====================================================
           LISTADO DE POSICIONES ACTIVAS & HISTORIAL
           ===================================================== */}
      <section className="staking-positions-section">
        <div className="staking-panel-header">
          <h3>🌱 MIS POSICIONES DE CULTIVO ({positions.length})</h3>
          <p>Supervisa el progreso, reclama tus gemas diarias y libera tus tokens al madurar.</p>
        </div>

        {positions.length === 0 ? (
          <div className="staking-empty-state">
            <span className="empty-icon">🪴</span>
            <h4>No tienes ningún cultivo de staking activo</h4>
            <p>
              Comienza cultivando tokens PLANTS para recolectar Gemas y Oro todos los días de forma automática.
            </p>
          </div>
        ) : (
          <div className="staking-positions-list">
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
                <article key={pos.id} className={`staking-position-item ${pos.isMature ? 'mature' : ''}`}>
                  <div className="pos-item-header">
                    <div className="pos-title-wrap">
                      <span className="pos-icon">{pos.durationDays === 90 ? '👑' : pos.durationDays === 60 ? '🌿' : '🌱'}</span>
                      <div>
                        <strong>{pos.amount.toLocaleString()} PLANTS</strong>
                        <span className="pos-chip">Plan {pos.durationDays} Días</span>
                        {pos.status === 'completed' && <span className="pos-status-chip completed">COMPLETADO</span>}
                        {pos.status === 'active' && pos.isMature && (
                          <span className="pos-status-chip ready">¡LISTO PARA LIBERAR!</span>
                        )}
                      </div>
                    </div>

                    <div className="pos-countdown-wrap">
                      <span className="pos-countdown-label">Tiempo Restante:</span>
                      <strong className="pos-countdown-val">{formatCountdown(pos.secondsRemaining)}</strong>
                    </div>
                  </div>

                  {/* BARRA DE PROGRESO */}
                  <div className="pos-progress-container">
                    <div className="pos-progress-bar" style={{ width: `${progressPct}%` }} />
                  </div>

                  {/* STATS DEL CULTIVO */}
                  <div className="pos-stats-grid">
                    <div className="pos-stat">
                      <span className="stat-label">💎 Rendimiento Diario</span>
                      <span className="stat-value">+{pos.dailyGemRate.toFixed(2)} Gemas / día</span>
                    </div>

                    <div className="pos-stat">
                      <span className="stat-label">🪙 Oro Diario</span>
                      <span className="stat-value">+{pos.dailyGoldRate.toLocaleString()} Oro / día</span>
                    </div>

                    <div className="pos-stat">
                      <span className="stat-label">🧺 Por Reclamar Hoy</span>
                      <span className="stat-value highlight">
                        +{pos.claimableGemsNow.toFixed(2)} 💎 / +{pos.claimableGoldNow.toLocaleString()} 🪙
                      </span>
                    </div>

                    <div className="pos-stat">
                      <span className="stat-label">✅ Total Ya Cobrado</span>
                      <span className="stat-value">
                        {pos.totalGemsClaimed.toFixed(2)} 💎 | {pos.totalGoldClaimed.toLocaleString()} 🪙
                      </span>
                    </div>
                  </div>

                  {/* ACCIONES DE LA POSICIÓN */}
                  {pos.status === 'active' && (
                    <div className="pos-actions-row">
                      {pos.isMature ? (
                        <button
                          type="button"
                          className="btn-plants-action btn-plants-action--unstake"
                          onClick={() => handleUnstake(pos.id)}
                          disabled={unstakingId === pos.id}
                        >
                          {unstakingId === pos.id ? 'LIBERANDO...' : '🎉 COBRAR BONUS & LIBERAR PLANTS'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-plants-action btn-plants-action--claim"
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
      </section>
    </div>
  )
}
