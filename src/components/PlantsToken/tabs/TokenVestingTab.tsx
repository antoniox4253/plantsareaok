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
    const total = secs > 0 ? secs : 3600 * 6 + 60 * 31 + 43
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const claimable = vestingSummary?.claimablePlantsNow ?? 2222
  const effectiveTotal = totalPlants > 0 ? totalPlants : 125000
  const effectiveLiquid = liquidPlants > 0 ? liquidPlants : 25000
  const effectiveVesting = lockedVestingPlants > 0 ? lockedVestingPlants : 100000

  // 10 puntos de la curva de 45 días
  const chartDays = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45]
  const chartPoints = useMemo(() => {
    return chartDays.map((day, idx) => {
      const x = 30 + (idx / (chartDays.length - 1)) * 580
      const progress = day / 45
      const liberatedY = 150 - progress * 95
      const pendingY = 55 + progress * 80
      return { day, x, liberatedY, pendingY }
    })
  }, [])

  return (
    <div className="token-vesting-screen">
      {/* =====================================================
           1. KPI ROW (5 CARDS)
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
            <span className="summary-kpi-sub">{((effectiveLiquid / effectiveTotal) * 100).toFixed(2)}%</span>
          </div>
        </article>

        {/* EN VESTING */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--gold">
            <span className="summary-kpi-emoji">🔒</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">EN VESTING</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-gold">{effectiveVesting.toLocaleString()}</strong>
            </div>
            <span className="summary-kpi-sub">{((effectiveVesting / effectiveTotal) * 100).toFixed(2)}%</span>
          </div>
        </article>

        {/* LIBERACIÓN HOY */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--mint">
            <span className="summary-kpi-emoji">📅</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">LIBERACIÓN HOY</span>
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
              <strong className="summary-kpi-value text-orange">{claimable.toLocaleString()}</strong>
            </div>
            <span className="summary-kpi-sub">en {formatCountdown(countdownSeconds)}</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           3. MID GRID: CALENDARIO (65%) + RESUMEN CARTERA (35%)
           ===================================================== */}
      <section className="vesting-mid-grid">
        {/* CALENDARIO DE LIBERACIÓN */}
        <article className="vesting-chart-card">
          <div className="vesting-chart-header">
            <div className="vesting-chart-title-wrap">
              <span className="vesting-chart-icon">📈</span>
              <h4 className="vesting-chart-title">CALENDARIO DE LIBERACIÓN (45 DÍAS)</h4>
            </div>
            <div className="vesting-chart-legend">
              <span className="vesting-legend-item text-mint">● Liberado (25,000)</span>
              <span className="vesting-legend-item text-cyan">● Pendiente (100,000)</span>
            </div>
          </div>

          <div className="vesting-chart-canvas">
            <svg viewBox="0 0 640 180" className="vesting-chart-svg" preserveAspectRatio="none">
              {/* Gridlines */}
              <line x1="30" y1="40" x2="620" y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <text x="32" y="36" fill="rgba(255,255,255,0.3)" fontSize="9">150,000</text>
              <line x1="30" y1="85" x2="620" y2="85" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <text x="32" y="81" fill="rgba(255,255,255,0.3)" fontSize="9">100,000</text>
              <line x1="30" y1="130" x2="620" y2="130" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <text x="32" y="126" fill="rgba(255,255,255,0.3)" fontSize="9">50,000</text>
              <line x1="30" y1="165" x2="620" y2="165" stroke="rgba(255,255,255,0.08)" />

              {/* Curve Liberado (Verde) */}
              <path
                d={`M ${chartPoints.map((p) => `${p.x} ${p.liberatedY}`).join(' L ')}`}
                fill="none"
                stroke="#20dba4"
                strokeWidth="3"
              />

              {/* Curve Pendiente (Azul) */}
              <path
                d={`M ${chartPoints.map((p) => `${p.x} ${p.pendingY}`).join(' L ')}`}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
              />

              {/* Tooltip callout at day 45 */}
              <g transform="translate(520, 70)">
                <rect width="105" height="58" rx="8" fill="#061e27" stroke="#20dba4" strokeWidth="1.5" />
                <text x="8" y="16" fill="#fef08a" fontSize="10" fontWeight="bold">Día 45</text>
                <text x="8" y="29" fill="#94a3b8" fontSize="8.5">Total: 125,000</text>
                <text x="8" y="41" fill="#38bdf8" fontSize="8.5">Pend: 100,000</text>
                <text x="8" y="53" fill="#20dba4" fontSize="8.5">Lib: 25,000</text>
              </g>

              {/* Circles */}
              {chartPoints.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.liberatedY} r="3.5" fill="#20dba4" />
              ))}
              {chartPoints.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.pendingY} r="3.5" fill="#38bdf8" />
              ))}
            </svg>

            {/* X-Axis labels */}
            <div className="vesting-chart-x-labels">
              {chartDays.map((d) => (
                <span key={d}>Día {d}</span>
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
            <div className="vesting-wallet-row">
              <span className="vesting-pack-name">📦 Pack Pionero</span>
              <strong className="vesting-pack-val">25,000 PLANTS <small>(20.00%)</small></strong>
            </div>
            <div className="vesting-wallet-row">
              <span className="vesting-pack-name">🧰 Pack Campeón</span>
              <strong className="vesting-pack-val">50,000 PLANTS <small>(40.00%)</small></strong>
            </div>
            <div className="vesting-wallet-row">
              <span className="vesting-pack-name">👑 Pack Leyenda</span>
              <strong className="vesting-pack-val">50,000 PLANTS <small>(40.00%)</small></strong>
            </div>
          </div>

          <div className="vesting-wallet-stats">
            <div className="vesting-stat-line">
              <span>Total comprado</span>
              <strong>{effectiveTotal.toLocaleString()} PLANTS</strong>
            </div>
            <div className="vesting-stat-line">
              <span>Liberado actualmente</span>
              <strong className="text-mint">{effectiveLiquid.toLocaleString()} PLANTS (20.00%)</strong>
            </div>
            <div className="vesting-stat-line">
              <span>En vesting</span>
              <strong className="text-gold">{effectiveVesting.toLocaleString()} PLANTS (80.00%)</strong>
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
              disabled={isClaimingVesting}
              onClick={onClaimDailyVesting}
            >
              🌱 RECLAMAR HOY · {claimable.toLocaleString()} PLANTS
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
           4. BOTTOM ROW: MIS PACKS (50%) + ÚLTIMAS LIBERACIONES (50%)
           ===================================================== */}
      <section className="vesting-bottom-grid">
        {/* MIS PACKS DE PREVENTA */}
        <article className="vesting-table-card">
          <div className="vesting-table-header">
            <span className="vesting-table-icon">🎁</span>
            <h4 className="vesting-table-title">MIS PACKS DE PREVENTA</h4>
          </div>

          <div className="vesting-custom-table">
            <div className="vesting-th">PACK</div>
            <div className="vesting-th">FECHA COMPRA</div>
            <div className="vesting-th">TOTAL</div>
            <div className="vesting-th">LIBERADO</div>
            <div className="vesting-th">PENDIENTE</div>
            <div className="vesting-th">PLANTS/DÍA</div>
            <div className="vesting-th">ESTADO</div>

            {/* Row 1 */}
            <div className="vesting-td pack-col">📦 Pionero</div>
            <div className="vesting-td">12 Abr 15:30</div>
            <div className="vesting-td">25,000</div>
            <div className="vesting-td text-mint">5,000 (20%)</div>
            <div className="vesting-td text-cyan">20,000 (80%)</div>
            <div className="vesting-td">556</div>
            <div className="vesting-td"><span className="vesting-status-pill">EN VESTING</span></div>

            {/* Row 2 */}
            <div className="vesting-td pack-col">🧰 Campeón</div>
            <div className="vesting-td">14 Abr 10:20</div>
            <div className="vesting-td">50,000</div>
            <div className="vesting-td text-mint">10,000 (20%)</div>
            <div className="vesting-td text-cyan">40,000 (80%)</div>
            <div className="vesting-td">1,111</div>
            <div className="vesting-td"><span className="vesting-status-pill">EN VESTING</span></div>

            {/* Row 3 */}
            <div className="vesting-td pack-col">👑 Leyenda</div>
            <div className="vesting-td">16 Abr 22:10</div>
            <div className="vesting-td">50,000</div>
            <div className="vesting-td text-mint">10,000 (20%)</div>
            <div className="vesting-td text-cyan">40,000 (80%)</div>
            <div className="vesting-td">1,111</div>
            <div className="vesting-td"><span className="vesting-status-pill">EN VESTING</span></div>
          </div>
        </article>

        {/* ÚLTIMAS LIBERACIONES */}
        <article className="vesting-table-card">
          <div className="vesting-table-header">
            <div className="vesting-table-title-row">
              <span className="vesting-table-icon">🕒</span>
              <h4 className="vesting-table-title">ÚLTIMAS LIBERACIONES</h4>
            </div>
            <span className="summary-see-all-link">Ver todas ➔</span>
          </div>

          <div className="vesting-custom-table vesting-custom-table--releases">
            <div className="vesting-th">FECHA</div>
            <div className="vesting-th">PLANTS</div>
            <div className="vesting-th">VALOR (USDT)</div>
            <div className="vesting-th">ESTADO</div>

            <div className="vesting-td">Hoy 22 Abr</div>
            <div className="vesting-td text-mint">2,222</div>
            <div className="vesting-td">$0.44</div>
            <div className="vesting-td text-mint">🟢 Liberado</div>

            <div className="vesting-td">Ayer 21 Abr</div>
            <div className="vesting-td text-mint">2,222</div>
            <div className="vesting-td">$0.44</div>
            <div className="vesting-td text-mint">🟢 Liberado</div>

            <div className="vesting-td">20 Abr</div>
            <div className="vesting-td text-mint">2,222</div>
            <div className="vesting-td">$0.44</div>
            <div className="vesting-td text-mint">🟢 Liberado</div>

            <div className="vesting-td">19 Abr</div>
            <div className="vesting-td text-mint">2,222</div>
            <div className="vesting-td">$0.44</div>
            <div className="vesting-td text-mint">🟢 Liberado</div>

            <div className="vesting-td">18 Abr</div>
            <div className="vesting-td text-mint">2,222</div>
            <div className="vesting-td">$0.44</div>
            <div className="vesting-td text-mint">🟢 Liberado</div>
          </div>
        </article>
      </section>
    </div>
  )
}
