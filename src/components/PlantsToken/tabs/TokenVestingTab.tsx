import React, { useMemo } from 'react'
import type { TokenHubSharedProps } from '../types'

export const TokenVestingTab: React.FC<TokenHubSharedProps> = ({
  liquidPlants,
  lockedVestingPlants,
  totalPlants,
  spotPrice,
  vestingSummary,
  countdownSeconds,
  isClaimingVesting,
  onClaimDailyVesting,
  onTabChange,
}) => {
  const formatCountdown = (secs: number) => {
    const total = secs > 0 ? secs : 0
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Valores reales del usuario
  const claimable = vestingSummary?.claimablePlantsNow ?? 0
  const effectiveTotal = totalPlants ?? 0
  const effectiveLiquid = liquidPlants ?? 0
  const effectiveVesting = lockedVestingPlants ?? 0
  const orders = vestingSummary?.orders ?? []
  const hasOrders = orders.length > 0 || effectiveTotal > 0

  // Cálculo del día de progreso (1 a 45) según órdenes activas
  const currentVestingDay = useMemo(() => {
    if (orders.length === 0) return 0
    const maxElapsed = Math.max(...orders.map((o) => o.daysElapsed ?? 0))
    return Math.min(45, Math.max(1, maxElapsed))
  }, [orders])

  // Puntos de la curva de 45 días (Liberación lineal 2.22% por día)
  const chartDays = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45]
  const chartPoints = useMemo(() => {
    return chartDays.map((day, idx) => {
      const x = 40 + (idx / (chartDays.length - 1)) * 560
      const pct = (day / 45) * 100
      // y = 105 en 0% a y = 20 en 100% (rango de 85 unidades en altura 115)
      const y = 105 - (pct / 100) * 85
      return { day, x, y, pct }
    })
  }, [])

  // Posición actual del usuario en la curva
  const userProgressPoint = useMemo(() => {
    if (currentVestingDay <= 0) return null
    const x = 40 + ((currentVestingDay - 1) / 44) * 560
    const pct = (currentVestingDay / 45) * 100
    const y = 105 - (pct / 100) * 85
    return { day: currentVestingDay, x, y, pct }
  }, [currentVestingDay])

  // Conteo de packs por categoría
  const packCounts = useMemo(() => {
    const counts = { pionero: 0, campeon: 0, leyenda: 0 }
    orders.forEach((o) => {
      if (o.packId.includes('pionero')) counts.pionero += 1
      else if (o.packId.includes('campeon')) counts.campeon += 1
      else if (o.packId.includes('leyenda')) counts.leyenda += 1
    })
    return counts
  }, [orders])

  return (
    <div className="token-vesting-screen">
      {/* =====================================================
           1. KPI ROW (5 CARDS) - DATOS REALES DE BASE DE DATOS
           ===================================================== */}
      <section className="summary-kpi-grid vesting-kpi-grid" data-section="vesting-kpi-row">
        {/* PLANTS TOTALES */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--green">
            <span className="summary-kpi-emoji">🌱</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PLANTS TOTALES</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-green">{effectiveTotal.toLocaleString()}</strong>
            </div>
            <span className="summary-kpi-sub">≈ ${(effectiveTotal * spotPrice).toFixed(2)} USDT</span>
          </div>
        </article>

        {/* PLANTS LÍQUIDOS */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--blue">
            <span className="summary-kpi-emoji">💧</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PLANTS LÍQUIDOS</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-cyan">{effectiveLiquid.toLocaleString()}</strong>
            </div>
            <span className="summary-kpi-sub">
              {effectiveTotal > 0 ? `${((effectiveLiquid / effectiveTotal) * 100).toFixed(1)}%` : '0%'} Disponible
            </span>
          </div>
        </article>

        {/* EN VESTING */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--gold">
            <span className="summary-kpi-emoji">🔒</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">EN VESTING (45 DÍAS)</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-gold">{effectiveVesting.toLocaleString()}</strong>
            </div>
            <span className="summary-kpi-sub">
              {effectiveTotal > 0 ? `${((effectiveVesting / effectiveTotal) * 100).toFixed(1)}%` : '0%'} En Desbloqueo
            </span>
          </div>
        </article>

        {/* RECLAMABLE HOY */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--mint">
            <span className="summary-kpi-emoji">📅</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">RECLAMABLE HOY</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-mint">{claimable.toLocaleString()}</strong>
            </div>
            <span className="summary-kpi-sub">≈ ${(claimable * spotPrice).toFixed(2)} USDT</span>
          </div>
        </article>

        {/* PRÓXIMO DESBLOQUEO */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--orange">
            <span className="summary-kpi-emoji">⏱️</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PRÓXIMO DESBLOQUEO</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-orange">
                {countdownSeconds > 0 ? formatCountdown(countdownSeconds) : '¡LISTO!'}
              </strong>
            </div>
            <span className="summary-kpi-sub">Ciclo cada 24 Horas</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           2. MID GRID: CALENDARIO REAL (65%) + RESUMEN CARTERA (35%)
           ===================================================== */}
      <section className="vesting-mid-grid">
        {/* CALENDARIO DE LIBERACIÓN LINEAL */}
        <article className="vesting-chart-card">
          <div className="vesting-chart-header">
            <div className="vesting-chart-title-wrap">
              <span className="vesting-chart-icon">📈</span>
              <div>
                <h4 className="vesting-chart-title">CALENDARIO DE LIBERACIÓN LINEAL (45 DÍAS)</h4>
                <p className="vesting-chart-sub">
                  Desbloqueo constante de 2.22% diario cada 24 horas sin penalizaciones
                </p>
              </div>
            </div>
            <div className="vesting-chart-legend">
              <span className="vesting-legend-item text-mint">● Acumulado</span>
              <span className="vesting-legend-item text-cyan">⋯ Programado</span>
            </div>
          </div>

          <div className="vesting-chart-canvas">
            <svg viewBox="0 0 640 115" className="vesting-chart-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="vestingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#20dba4" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#20dba4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Guías horizontales de porcentaje */}
              <line x1="40" y1="20" x2="600" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <text x="12" y="23" fill="rgba(255,255,255,0.4)" fontSize="8.5">100%</text>

              <line x1="40" y1="48" x2="600" y2="48" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <text x="16" y="51" fill="rgba(255,255,255,0.4)" fontSize="8.5">66%</text>

              <line x1="40" y1="76" x2="600" y2="76" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <text x="16" y="79" fill="rgba(255,255,255,0.4)" fontSize="8.5">33%</text>

              <line x1="40" y1="105" x2="600" y2="105" stroke="rgba(255,255,255,0.08)" />
              <text x="20" y="108" fill="rgba(255,255,255,0.4)" fontSize="8.5">0%</text>

              {/* Línea completa de proyección (Cian / Punteada) */}
              <line
                x1={chartPoints[0].x}
                y1={chartPoints[0].y}
                x2={chartPoints[chartPoints.length - 1].x}
                y2={chartPoints[chartPoints.length - 1].y}
                stroke="#38bdf8"
                strokeWidth="2.2"
                strokeDasharray="4 4"
              />

              {/* Área y Curva de progreso acumulado (Verde) */}
              {userProgressPoint && (
                <>
                  <polygon
                    points={`${chartPoints[0].x},105 ${chartPoints[0].x},${chartPoints[0].y} ${userProgressPoint.x},${userProgressPoint.y} ${userProgressPoint.x},105`}
                    fill="url(#vestingAreaGrad)"
                  />
                  <line
                    x1={chartPoints[0].x}
                    y1={chartPoints[0].y}
                    x2={userProgressPoint.x}
                    y2={userProgressPoint.y}
                    stroke="#20dba4"
                    strokeWidth="3"
                  />
                  {/* Marcador vertical del día actual */}
                  <line
                    x1={userProgressPoint.x}
                    y1="18"
                    x2={userProgressPoint.x}
                    y2="105"
                    stroke="#facc15"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  <circle cx={userProgressPoint.x} cy={userProgressPoint.y} r="4.5" fill="#facc15" stroke="#041419" strokeWidth="2" />
                </>
              )}

              {/* Hitos clave en la curva */}
              {chartPoints.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={p.day === 1 || p.day === 15 || p.day === 30 || p.day === 45 ? 3.5 : 2}
                  fill={p.day === 45 ? '#facc15' : '#38bdf8'}
                />
              ))}

              {/* Tooltip con información en el día 45 */}
              <g transform="translate(485, 18)">
                <rect width="112" height="32" rx="5" fill="#061e27" stroke="#20dba4" strokeWidth="1" />
                <text x="7" y="11" fill="#fef08a" fontSize="8" fontWeight="bold">Día 45 · 100% Total</text>
                <text x="7" y="20" fill="#94a3b8" fontSize="7">
                  {effectiveTotal > 0 ? `Total: ${effectiveTotal.toLocaleString()} PLANTS` : 'Liberación Completa'}
                </text>
                <text x="7" y="28" fill="#20dba4" fontSize="6.5">2.22% desbloqueado/día</text>
              </g>

              {/* Tooltip si el usuario tiene progreso activo */}
              {userProgressPoint && (
                <g transform={`translate(${Math.min(480, Math.max(45, userProgressPoint.x - 45))}, 4)`}>
                  <rect width="90" height="15" rx="3" fill="#0f2b2b" stroke="#facc15" strokeWidth="1" />
                  <text x="5" y="10.5" fill="#facc15" fontSize="7.5" fontWeight="bold">
                    HOY: Día {currentVestingDay} ({userProgressPoint.pct.toFixed(1)}%)
                  </text>
                </g>
              )}
            </svg>

            {/* X-Axis labels */}
            <div className="vesting-chart-x-labels">
              {chartDays.map((d) => (
                <span key={d} className={d === currentVestingDay ? 'text-gold font-bold' : ''}>
                  Día {d}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* RESUMEN DE CARTERA */}
        <article className="vesting-wallet-card">
          <div className="vesting-wallet-header">
            <span className="vesting-wallet-icon">🪙</span>
            <h4 className="vesting-wallet-title">RESUMEN DE CARTERA</h4>
          </div>

          <div className="vesting-wallet-breakdown">
            <div className="vesting-wallet-pill">
              <span className="vesting-pack-name">📦 Pionero</span>
              <strong className="vesting-pack-val">{packCounts.pionero}</strong>
            </div>
            <div className="vesting-wallet-pill">
              <span className="vesting-pack-name">🧰 Campeón</span>
              <strong className="vesting-pack-val">{packCounts.campeon}</strong>
            </div>
            <div className="vesting-wallet-pill">
              <span className="vesting-pack-name">👑 Leyenda</span>
              <strong className="vesting-pack-val">{packCounts.leyenda}</strong>
            </div>
          </div>

          <div className="vesting-wallet-stats">
            <div className="vesting-stat-line">
              <span>Total en custodia</span>
              <strong>{effectiveTotal.toLocaleString()} PLANTS</strong>
            </div>
            <div className="vesting-stat-line">
              <span>Liberado actualmente</span>
              <strong className="text-mint">
                {effectiveLiquid.toLocaleString()} ({effectiveTotal > 0 ? ((effectiveLiquid / effectiveTotal) * 100).toFixed(1) : '0'}%)
              </strong>
            </div>
            <div className="vesting-stat-line">
              <span>En vesting bloqueado</span>
              <strong className="text-gold">
                {effectiveVesting.toLocaleString()} ({effectiveTotal > 0 ? ((effectiveVesting / effectiveTotal) * 100).toFixed(1) : '0'}%)
              </strong>
            </div>
            <div className="vesting-stat-line highlight">
              <span>Reclamable ahora</span>
              <strong className="text-mint">{claimable.toLocaleString()} PLANTS</strong>
            </div>
          </div>

          <div className="vesting-wallet-actions">
            <button
              type="button"
              className="vesting-claim-btn"
              disabled={isClaimingVesting || claimable <= 0}
              onClick={onClaimDailyVesting}
            >
              {isClaimingVesting
                ? 'RECLAMANDO...'
                : claimable > 0
                ? `🌱 RECLAMAR HOY · ${claimable.toLocaleString()} PLANTS`
                : '🌱 NADA PENDIENTE HOY'}
            </button>

            <button
              type="button"
              className="vesting-swap-gems-btn"
              onClick={() => onTabChange('swap')}
            >
              💎 CANJEAR A GEMAS · +20% DE BONO
            </button>
          </div>
        </article>
      </section>

      {/* =====================================================
           3. BOTTOM ROW: MIS PACKS (50%) + ÚLTIMAS LIBERACIONES (50%)
           ===================================================== */}
      <section className="vesting-bottom-grid">
        {/* MIS PACKS DE PREVENTA */}
        <article className="vesting-table-card">
          <div className="vesting-table-header">
            <span className="vesting-table-icon">🎁</span>
            <div className="vesting-table-title-row">
              <h4 className="vesting-table-title">MIS PACKS DE PREVENTA</h4>
              <span className="vesting-orders-count-badge">
                {orders.length} {orders.length === 1 ? 'Pack' : 'Packs'}
              </span>
            </div>
          </div>

          {!hasOrders ? (
            <div className="vesting-empty-state">
              <span className="vesting-empty-icon">📦</span>
              <h5 className="vesting-empty-title">Aún no has adquirido packs de preventa</h5>
              <p className="vesting-empty-desc">
                Adquiere tu Pack Fundador en la pestaña Preventa para activar tu liberación diaria durante 45 días.
              </p>
              <button
                type="button"
                className="vesting-go-presale-btn"
                onClick={() => onTabChange('presale')}
              >
                🛒 IR A LA PREVENTA
              </button>
            </div>
          ) : (
            <div className="vesting-table-scroll-wrap">
              <div className="vesting-custom-table">
                <div className="vesting-th">PACK</div>
                <div className="vesting-th">FECHA COMPRA</div>
                <div className="vesting-th">TOTAL</div>
                <div className="vesting-th">LIBERADO</div>
                <div className="vesting-th">PENDIENTE</div>
                <div className="vesting-th">PLANTS/DÍA</div>
                <div className="vesting-th">ESTADO</div>

                {orders.map((o) => {
                  const isPionero = o.packId.includes('pionero')
                  const isCampeon = o.packId.includes('campeon')
                  const packName = isPionero ? '📦 Pionero' : isCampeon ? '🧰 Campeón' : '👑 Leyenda'
                  const claimedPlants = o.vestingClaimedDays * o.vestingDailyRate
                  const pendingPlants = Math.max(0, o.plantsAmount - claimedPlants)
                  const pct = ((claimedPlants / o.plantsAmount) * 100).toFixed(0)

                  return (
                    <React.Fragment key={o.id}>
                      <div className="vesting-td pack-col">{packName}</div>
                      <div className="vesting-td">
                        {new Date(o.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </div>
                      <div className="vesting-td">{o.plantsAmount.toLocaleString()}</div>
                      <div className="vesting-td text-mint">{claimedPlants.toFixed(0)} ({pct}%)</div>
                      <div className="vesting-td text-cyan">{pendingPlants.toFixed(0)}</div>
                      <div className="vesting-td">{o.vestingDailyRate.toFixed(1)}</div>
                      <div className="vesting-td">
                        <span className={`vesting-status-pill ${o.isCompleted ? 'vesting-status-pill--completed' : ''}`}>
                          {o.isCompleted ? 'COMPLETADO' : `DÍA ${o.daysElapsed}/45`}
                        </span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          )}
        </article>

        {/* ÚLTIMAS LIBERACIONES */}
        <article className="vesting-table-card">
          <div className="vesting-table-header">
            <div className="vesting-table-title-row">
              <span className="vesting-table-icon">🕒</span>
              <h4 className="vesting-table-title">ÚLTIMAS LIBERACIONES</h4>
            </div>
          </div>

          {!hasOrders ? (
            <div className="vesting-empty-state">
              <span className="vesting-empty-icon">⏳</span>
              <h5 className="vesting-empty-title">Sin liberaciones pendientes</h5>
              <p className="vesting-empty-desc">
                Una vez adquieras un pack de preventa, tus liberaciones diarias de tokens aparecerán aquí para reclamarlas.
              </p>
            </div>
          ) : (
            <div className="vesting-table-scroll-wrap">
              <div className="vesting-custom-table vesting-custom-table--releases">
                <div className="vesting-th">CICLO</div>
                <div className="vesting-th">PLANTS</div>
                <div className="vesting-th">VALOR (USDT)</div>
                <div className="vesting-th">ESTADO</div>

                <div className="vesting-td">Día Actual</div>
                <div className="vesting-td text-mint">{claimable.toLocaleString()}</div>
                <div className="vesting-td">${(claimable * spotPrice).toFixed(2)}</div>
                <div className="vesting-td text-mint">
                  {claimable > 0 ? '🟢 Reclamable Ahora' : '⏳ En Acumulación 24h'}
                </div>

                <div className="vesting-td">Próximo Desbloqueo</div>
                <div className="vesting-td text-cyan">
                  {orders.length > 0 ? (orders.reduce((acc, o) => acc + o.vestingDailyRate, 0)).toFixed(1) : '0'}
                </div>
                <div className="vesting-td">
                  ${((orders.reduce((acc, o) => acc + o.vestingDailyRate, 0)) * spotPrice).toFixed(2)}
                </div>
                <div className="vesting-td text-orange">⏱️ en {formatCountdown(countdownSeconds)}</div>
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  )
}
