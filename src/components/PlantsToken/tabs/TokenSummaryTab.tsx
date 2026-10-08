import React, { useMemo, useState } from 'react'
import { soundManager } from '../../../utils/audioManager'
import type { TokenHubSharedProps, Timeframe } from '../types'
import { TOKEN_ASSETS } from '../tokenAssets'
import { AmmCurveModal } from '../modals/AmmCurveModal'

export const TokenSummaryTab: React.FC<TokenHubSharedProps> = ({
  marketState,
  priceHistory,
  countdownSeconds,
  spotPrice,
  poolUsdt,
  totalBurned,
  onTabChange,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('24H')
  const [isAmmModalOpen, setIsAmmModalOpen] = useState(false)

  // Formato para contador digital de cuenta regresiva
  const formatCountdown = (secs: number) => {
    const total = secs > 0 ? secs : 86400 * 7 + 3600 * 6 + 60 * 31 + 43
    const d = Math.floor(total / 86400)
    const h = Math.floor((total % 86400) / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return {
      days: String(d).padStart(2, '0'),
      hours: String(h).padStart(2, '0'),
      minutes: String(m).padStart(2, '0'),
      seconds: String(s).padStart(2, '0'),
    }
  }

  const timeParts = formatCountdown(countdownSeconds)

  // Gráfica SVG interactiva de AMM con soporte dinámico de timeframes
  const { chartPoints, minDisplayPrice, maxDisplayPrice, xAxisLabels } = useMemo(() => {
    const now = Date.now()
    let cutoff = 0
    let labels: string[] = []

    if (timeframe === '1H') {
      cutoff = now - 3600 * 1000
      labels = ['-60m', '-45m', '-30m', '-15m', 'Ahora']
    } else if (timeframe === '24H') {
      cutoff = now - 24 * 3600 * 1000
      labels = ['-24h', '-18h', '-12h', '-6h', 'Ahora']
    } else if (timeframe === '7D') {
      cutoff = now - 7 * 24 * 3600 * 1000
      labels = ['Día -7', 'Día -5', 'Día -3', 'Día -1', 'Hoy']
    } else {
      cutoff = 0
      labels = ['Génesis Seed', 'Fase Inicial', 'Halving 1', 'Actual']
    }

    const validHistory = (priceHistory || []).filter((p) => {
      const t = new Date(p.created_at).getTime()
      return isNaN(t) || t >= cutoff
    })

    const genesisPrice = 0.0002
    const currentPrice = spotPrice > 0 ? spotPrice : genesisPrice
    const sampleCount = 16
    const pts: { x: number; y: number; price: number }[] = []

    let prices: number[] = []
    if (validHistory.length >= sampleCount) {
      prices = validHistory.slice(-sampleCount).map((p) => p.spot_price)
    } else if (validHistory.length > 1) {
      prices = validHistory.map((p) => p.spot_price)
      while (prices.length < sampleCount) {
        prices.push(currentPrice)
      }
    } else {
      for (let i = 0; i < sampleCount; i++) {
        const progress = i / (sampleCount - 1)
        const p = genesisPrice + (currentPrice - genesisPrice) * progress
        prices.push(p)
      }
    }

    const minP = Math.min(genesisPrice * 0.95, ...prices) * 0.98
    const maxP = Math.max(currentPrice * 1.05, ...prices) * 1.02
    const range = maxP - minP || 0.0001

    for (let i = 0; i < prices.length; i++) {
      const x = 30 + (i / (prices.length - 1)) * 580
      const p = prices[i]
      const norm = Math.max(0, Math.min(1, (p - minP) / range))
      const y = 145 - norm * 105
      pts.push({ x, y, price: p })
    }

    return {
      chartPoints: pts,
      minDisplayPrice: minP,
      maxDisplayPrice: maxP,
      xAxisLabels: labels,
    }
  }, [priceHistory, spotPrice, timeframe])

  const svgPathD = useMemo(() => {
    if (chartPoints.length === 0) return ''
    return chartPoints.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
    }, '')
  }, [chartPoints])

  const svgAreaD = useMemo(() => {
    if (chartPoints.length === 0) return ''
    const first = chartPoints[0]
    const last = chartPoints[chartPoints.length - 1]
    return `M ${first.x} 160 L ${first.x} ${first.y} ${chartPoints
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ')} L ${last.x} 160 Z`
  }, [chartPoints])

  return (
    <div className="token-summary-screen">
      {/* =====================================================
           1. KPI ROW (5 CARDS)
           ===================================================== */}
      <section className="summary-kpi-grid">
        {/* PRECIO SPOT */}
        <article className="summary-kpi-card" data-section="kpi-price-spot">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--green">
            <span className="summary-kpi-emoji">💲</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PRECIO SPOT</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-green">${spotPrice.toFixed(6)} USDT</strong>
              <span className="summary-kpi-tag summary-kpi-tag--green">LIVE AMM</span>
            </div>
            <span className="summary-kpi-sub">5,000 PLANTS = $1.00 USDT</span>
          </div>
        </article>

        {/* LIQUIDEZ */}
        <article className="summary-kpi-card" data-section="kpi-liquidity">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--blue">
            <span className="summary-kpi-emoji">💧</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">LIQUIDEZ</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-cyan">${poolUsdt.toFixed(2)} USDT</strong>
              <span className="summary-kpi-tag summary-kpi-tag--blue">100% RESPALDADO</span>
            </div>
            <span className="summary-kpi-sub">60% Preventas + 70% Gemas Inyectadas</span>
          </div>
        </article>

        {/* QUEMADOS */}
        <article className="summary-kpi-card" data-section="kpi-burned">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--orange">
            <span className="summary-kpi-emoji">🔥</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">QUEMADOS</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-orange">{totalBurned.toLocaleString()} PLANTS</strong>
            </div>
            <span className="summary-kpi-sub">Super Sink (+20% Gemas)</span>
          </div>
        </article>

        {/* HALVING */}
        <article className="summary-kpi-card" data-section="kpi-halving">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--gold">
            <span className="summary-kpi-emoji">🪙</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">HALVING</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-gold">FASE {marketState?.currentHalvingEra ?? 1} / 5</strong>
              <span className="summary-kpi-tag summary-kpi-tag--gold">100% RECOMPENSAS</span>
            </div>
            <span className="summary-kpi-sub">Tope Total: 1,000,000 PLANTS</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           3. MID ROW: COUNTDOWN (35%) + AMM CHART (65%)
           ===================================================== */}
      <section className="summary-mid-grid">
        {/* FIN DE PREVENTA */}
        <article className="summary-countdown-card" data-section="presale-countdown">
          <div className="summary-countdown-header">
            <span className="summary-trophy-icon">🏆</span>
            <h3 className="summary-countdown-title">FIN DE PREVENTA</h3>
            <span className="summary-trophy-icon">🏆</span>
          </div>

          <div className="summary-countdown-boxes">
            <div className="summary-countdown-box">
              <strong className="summary-countdown-num">{timeParts.days}</strong>
              <span className="summary-countdown-lbl">DÍAS</span>
            </div>
            <div className="summary-countdown-box">
              <strong className="summary-countdown-num">{timeParts.hours}</strong>
              <span className="summary-countdown-lbl">HRS</span>
            </div>
            <div className="summary-countdown-box">
              <strong className="summary-countdown-num">{timeParts.minutes}</strong>
              <span className="summary-countdown-lbl">MIN</span>
            </div>
            <div className="summary-countdown-box">
              <strong className="summary-countdown-num">{timeParts.seconds}</strong>
              <span className="summary-countdown-lbl">SEG</span>
            </div>
          </div>

          <div className="summary-countdown-bar-wrap">
            <div className="summary-countdown-bar">
              <div className="summary-countdown-fill" style={{ width: '45%' }} />
              <div className="summary-bar-dots">
                <span className="summary-bar-dot active" />
                <span className="summary-bar-dot active" />
                <span className="summary-bar-dot active" />
                <span className="summary-bar-dot" />
                <span className="summary-bar-dot" />
              </div>
            </div>
          </div>
        </article>

        {/* CURVA AMM */}
        <article className="summary-chart-card" data-section="amm-chart">
          <div className="summary-chart-header">
            <div className="summary-chart-title-wrap">
              <span className="summary-chart-title">📈 CURVA AMM PLANTS / USDT</span>
              <span className="summary-chart-formula">P = R / V (K = 200M)</span>
            </div>
            <div className="summary-chart-filters">
              {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={`summary-tf-btn ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
              <button
                type="button"
                className="summary-tf-btn summary-tf-btn--expand"
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setIsAmmModalOpen(true)
                }}
                title="Ver Curva AMM en pantalla completa"
              >
                ⛶
              </button>
            </div>
          </div>

          <div className="summary-chart-canvas">
            <svg viewBox="0 0 640 170" className="summary-chart-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="summaryChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#19d99c" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#19d99c" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="summaryLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#29bdf6" />
                  <stop offset="100%" stopColor="#19d99c" />
                </linearGradient>
              </defs>

              {/* Y Axis Gridlines and Labels */}
              <line x1="30" y1="30" x2="620" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <text x="32" y="26" fill="rgba(255,255,255,0.35)" fontSize="8.5">${maxDisplayPrice.toFixed(6)}</text>

              <line x1="30" y1="85" x2="620" y2="85" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <text x="32" y="81" fill="rgba(255,255,255,0.35)" fontSize="8.5">${((maxDisplayPrice + minDisplayPrice) / 2).toFixed(6)}</text>

              <line x1="30" y1="140" x2="620" y2="140" stroke="rgba(255,255,255,0.08)" />
              <text x="32" y="136" fill="rgba(255,255,255,0.35)" fontSize="8.5">${minDisplayPrice.toFixed(6)}</text>

              {svgAreaD && <path d={svgAreaD} fill="url(#summaryChartGrad)" />}
              {svgPathD && <path d={svgPathD} fill="none" stroke="url(#summaryLineGrad)" strokeWidth="3" />}

              {chartPoints.map((pt, idx) => {
                const isLast = idx === chartPoints.length - 1
                return (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={isLast ? 6 : 3}
                    className={isLast ? 'summary-chart-dot--pulse' : 'summary-chart-dot'}
                    fill={isLast ? '#20dba4' : '#14896d'}
                  />
                )
              })}
            </svg>

            {/* X Axis Labels */}
            <div className="summary-chart-x-labels" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginTop: '2px', fontSize: '8px', color: '#78929b' }}>
              {xAxisLabels.map((lbl, idx) => (
                <span key={idx}>{lbl}</span>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* =====================================================
           4. BOTTOM ROW: FLUJO (33%) + PACKS (34%) + BENEFICIOS (33%)
           ===================================================== */}
      <section className="summary-bottom-grid">
        {/* FLUJO DEL ECOSISTEMA */}
        <article className="summary-panel" data-section="ecosystem-flow">
          <div className="summary-panel-header">
            <span className="summary-panel-icon">⚙️</span>
            <h4 className="summary-panel-title">FLUJO DEL ECOSISTEMA</h4>
          </div>

          <div className="summary-flow-nodes">
            <div className="summary-flow-node">
              <div className="summary-flow-badge">1</div>
              <div className="summary-flow-icon">🛒</div>
              <span className="summary-flow-text">Compra packs o gemas</span>
            </div>
            <span className="summary-flow-arrow">➔</span>

            <div className="summary-flow-node">
              <div className="summary-flow-badge">2</div>
              <div className="summary-flow-icon">🌱</div>
              <span className="summary-flow-text">Recibes PLANTS en vesting</span>
            </div>
            <span className="summary-flow-arrow">➔</span>

            <div className="summary-flow-node">
              <div className="summary-flow-badge">3</div>
              <div className="summary-flow-icon">📅</div>
              <span className="summary-flow-text">Liberación diaria (45 días)</span>
            </div>
            <span className="summary-flow-arrow">➔</span>

            <div className="summary-flow-node">
              <div className="summary-flow-badge">4</div>
              <div className="summary-flow-icon">🔄</div>
              <span className="summary-flow-text">Swap / Cash-out o canje a gemas</span>
            </div>
          </div>
        </article>

        {/* PACKS DE PREVENTA */}
        <article className="summary-panel" data-section="presale-packs">
          <div className="summary-panel-header">
            <div className="summary-panel-title-row">
              <span className="summary-panel-icon">🎁</span>
              <h4 className="summary-panel-title">PACKS DE PREVENTA</h4>
            </div>
            <button
              type="button"
              className="summary-see-all-link"
              onClick={() => onTabChange('presale')}
            >
              Ver todos ➔
            </button>
          </div>

          <div className="summary-mini-packs">
            {/* PACK PIONERO */}
            <div
              className="summary-mini-pack-card summary-mini-pack-card--pionero"
              onClick={() => onTabChange('presale')}
            >
              <span className="summary-mini-pack-name">Pack Pionero</span>
              <img
                src={TOKEN_ASSETS.summaryPackPioneer || '/game-assets/token/chest_pioneer.webp'}
                alt="Pack Pionero"
                className="summary-mini-pack-img"
              />
              <strong className="summary-mini-pack-price text-cyan">$10 USDT</strong>
              <span className="summary-mini-pack-plants text-mint">+2,500 PLANTS</span>
            </div>

            {/* PACK CAMPEÓN */}
            <div
              className="summary-mini-pack-card summary-mini-pack-card--campeon"
              onClick={() => onTabChange('presale')}
            >
              <span className="summary-mini-pack-name">Pack Campeón</span>
              <img
                src={TOKEN_ASSETS.summaryPackChampion || '/game-assets/token/chest_champion.webp'}
                alt="Pack Campeón"
                className="summary-mini-pack-img"
              />
              <strong className="summary-mini-pack-price text-purple">$25 USDT</strong>
              <span className="summary-mini-pack-plants text-mint">+7,500 PLANTS</span>
            </div>

            {/* PACK LEYENDA */}
            <div
              className="summary-mini-pack-card summary-mini-pack-card--leyenda"
              onClick={() => onTabChange('presale')}
            >
              <span className="summary-mini-pack-name">Pack Leyenda</span>
              <img
                src={TOKEN_ASSETS.summaryPackLegend || '/game-assets/token/chest_legend.webp'}
                alt="Pack Leyenda"
                className="summary-mini-pack-img"
              />
              <strong className="summary-mini-pack-price text-gold">$50 USDT</strong>
              <span className="summary-mini-pack-plants text-mint">+15,000 PLANTS</span>
            </div>
          </div>
        </article>

        {/* BENEFICIOS CLAVE */}
        <article className="summary-panel" data-section="key-benefits">
          <div className="summary-panel-header">
            <span className="summary-panel-icon">⭐</span>
            <h4 className="summary-panel-title">BENEFICIOS CLAVE</h4>
          </div>

          <div className="summary-benefits-list">
            <div className="summary-benefit-item">
              <span className="summary-benefit-icon">💧</span>
              <div className="summary-benefit-info">
                <strong>60% al Pool de Liquidez</strong>
                <p>Impulsa la estabilidad del token</p>
              </div>
            </div>

            <div className="summary-benefit-item">
              <span className="summary-benefit-icon">📅</span>
              <div className="summary-benefit-info">
                <strong>Vesting lineal de 45 días</strong>
                <p>Liberación diaria de tus PLANTS</p>
              </div>
            </div>

            <div className="summary-benefit-item">
              <span className="summary-benefit-icon">💎</span>
              <div className="summary-benefit-info">
                <strong>Canje a Gemas +20%</strong>
                <p>Sin esperar los 45 días</p>
              </div>
            </div>

            <div className="summary-benefit-item">
              <span className="summary-benefit-icon">📈</span>
              <div className="summary-benefit-info">
                <strong>Sistema AMM en vivo</strong>
                <p>Precio dinámico y transparente</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* PANTALLA DEDICADA / MODAL DE LA CURVA AMM */}
      <AmmCurveModal
        isOpen={isAmmModalOpen}
        onClose={() => setIsAmmModalOpen(false)}
        spotPrice={spotPrice}
        priceHistory={priceHistory}
        marketState={marketState}
      />
    </div>
  )
}
