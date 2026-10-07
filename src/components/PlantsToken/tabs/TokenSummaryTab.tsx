import React, { useMemo, useState } from 'react'
import type { TokenHubSharedProps, Timeframe } from '../types'
import { TOKEN_ASSETS } from '../tokenAssets'
import { PRESALE_PACKS } from '../../../services/plantsTokenService'

export const TokenSummaryTab: React.FC<TokenHubSharedProps> = ({
  marketState,
  priceHistory,
  countdownSeconds,
  liquidPlants,
  lockedVestingPlants,
  totalPlants,
  spotPrice,
  poolUsdt,
  totalBurned,
  circulating,
  virtualPlants,
  onTabChange,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('24H')

  // Formato para contador de cuenta regresiva
  const formatCountdown = (secs: number) => {
    const d = Math.floor(secs / 86400)
    const h = Math.floor((secs % 86400) / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return {
      days: String(d).padStart(2, '0'),
      hours: String(h).padStart(2, '0'),
      minutes: String(m).padStart(2, '0'),
      seconds: String(s).padStart(2, '0'),
    }
  }

  const timeParts = formatCountdown(countdownSeconds > 0 ? countdownSeconds : 86400 * 14 + 3600 * 8)

  // Gráfica SVG interactiva de AMM
  const chartPoints = useMemo(() => {
    const history = priceHistory.length > 0 ? priceHistory : []
    const pointsCount = Math.max(history.length, 14)
    const pts: { x: number; y: number; price: number }[] = []

    for (let i = 0; i < pointsCount; i++) {
      const x = 30 + (i / (pointsCount - 1)) * 580
      let p = spotPrice
      if (history[i]) {
        p = history[i].spot_price
      } else {
        const factor = 0.92 + Math.sin(i * 0.7) * 0.08 + (i / pointsCount) * 0.12
        p = spotPrice * factor
      }
      const minP = spotPrice * 0.8
      const maxP = spotPrice * 1.3
      const norm = Math.max(0, Math.min(1, (p - minP) / (maxP - minP || 1)))
      const y = 160 - norm * 110
      pts.push({ x, y, price: p })
    }
    return pts
  }, [priceHistory, spotPrice])

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
    return `M ${first.x} 180 L ${first.x} ${first.y} ${chartPoints
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ')} L ${last.x} 180 Z`
  }, [chartPoints])

  return (
    <div className="token-screen">
      {/* =====================================================
           HERO BANNER
           ===================================================== */}
      <section
        className="hero-banner"
        data-section="hero-banner"
        data-label="HERO BANNER"
        style={
          TOKEN_ASSETS.summaryHeroBanner
            ? { backgroundImage: `url(${TOKEN_ASSETS.summaryHeroBanner})`, backgroundSize: 'cover' }
            : {}
        }
      >
        <div className="hero-banner__content">
          <div className="hero-banner__badge">🌱 ECOSISTEMA ECONÓMICO PLANTS ARENA</div>
          <h1 className="hero-banner__title">TOKEN PLANTS · RESPALDO REAL & CURVA AMM</h1>
          <p className="hero-banner__subtitle">
            Moneda deflacionaria con suministro finito de <strong>1,000,000 PLANTS</strong>. El <strong>60% de las preventas</strong> y el <strong>70% de las compras en tienda</strong> inyectan liquidez en USDT al pool descentralizado, respaldando el valor de cada token ganado en batalla.
          </p>

          <div className="hero-banner__chips" style={{ marginBottom: '14px' }}>
            <span className="hero-chip">🏦 100% Respaldado en Reserva USDT</span>
            <span className="hero-chip">🛡️ Vesting Lineal de 45 Días Anti-Dump</span>
            <span className="hero-chip">🔥 Súper Sumidero con +20% Bonus en Gemas</span>
            <span className="hero-chip">🔒 Tope Máximo: 1,000,000 PLANTS</span>
          </div>

          <div className="hero-banner__actions">
            <button
              type="button"
              className="token-action-btn token-action-btn--primary"
              onClick={() => onTabChange('presale')}
            >
              🛒 PARTICIPAR EN LA PREVENTA FUNDADORES
            </button>
            <button
              type="button"
              className="token-action-btn token-action-btn--secondary"
              onClick={() => onTabChange('guide')}
            >
              📖 GUÍA COMPLETA & REGLAS
            </button>
            <button
              type="button"
              className="token-action-btn token-action-btn--secondary"
              onClick={() => onTabChange('swap')}
            >
              🔄 MERCADO SWAP & CASHOUT
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
           KPI SUMMARY ROW
           ===================================================== */}
      <section className="kpi-grid" data-section="kpi-row" data-label="KPI ROW">
        <article className="kpi-card" data-section="kpi-price-spot" data-label="PRICE SPOT">
          <div className="kpi-icon-slot">
            <span className="kpi-icon">💎</span>
          </div>
          <div className="kpi-content-slot">
            <span className="kpi-label">PRECIO SPOT EN VIVO</span>
            <strong className="kpi-value text-cyan">${spotPrice.toFixed(6)} USDT</strong>
            <span className="kpi-sub">Curva AMM (1 USDT = {(1 / spotPrice).toFixed(0)} PLANTS)</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-liquidity" data-label="LIQUIDITY">
          <div className="kpi-icon-slot">
            <span className="kpi-icon">🏦</span>
          </div>
          <div className="kpi-content-slot">
            <span className="kpi-label">FONDO DE RESERVA USDT</span>
            <strong className="kpi-value text-green">${poolUsdt.toFixed(2)} USDT</strong>
            <span className="kpi-sub">100% Disponible en Bóveda</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-burned" data-label="BURNED">
          <div className="kpi-icon-slot">
            <span className="kpi-icon">🔥</span>
          </div>
          <div className="kpi-content-slot">
            <span className="kpi-label">TOKENS QUEMADOS</span>
            <strong className="kpi-value text-orange">{totalBurned.toLocaleString()} PLANTS</strong>
            <span className="kpi-sub">Deflación continua activa</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-halving" data-label="HALVING">
          <div className="kpi-icon-slot">
            <span className="kpi-icon">⏳</span>
          </div>
          <div className="kpi-content-slot">
            <span className="kpi-label">ERA DE HALVING</span>
            <strong className="kpi-value text-purple">FASE {marketState?.currentHalvingEra ?? 1} / 5</strong>
            <span className="kpi-sub">100% Recompensas de Minado</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-liquid-balance" data-label="LIQUID BALANCE">
          <div className="kpi-icon-slot">
            <span className="kpi-icon">🌱</span>
          </div>
          <div className="kpi-content-slot">
            <span className="kpi-label">MI BILLETERA PLANTS</span>
            <strong className="kpi-value text-gold">{liquidPlants.toFixed(2)} LÍQUIDOS</strong>
            <span className="kpi-sub">Total: {totalPlants.toFixed(2)} ({lockedVestingPlants.toFixed(1)} en Vesting)</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           MID ROW: COUNTDOWN + AMM CHART
           ===================================================== */}
      <section className="mid-grid">
        {/* Presale Countdown Card */}
        <article className="countdown-card" data-section="presale-countdown" data-label="PRESALE COUNTDOWN">
          <div className="countdown-header-slot">
            <div className="section-title-wrap">
              <span className="section-badge">FASE GÉNESIS</span>
              <h3 className="section-title">PREVENTA EXCLUSIVA DE 20 PACKS</h3>
            </div>
            <p className="section-desc">
              Acceso anticipado con precios de entrada únicos. El 60% ingresa directamente al pool de liquidez en USDT elevando el precio base.
            </p>
          </div>

          <div className="countdown-cells">
            <div className="countdown-cell" data-section="countdown-days">
              <strong className="countdown-cell__num">{timeParts.days}</strong>
              <span className="countdown-cell__lbl">DÍAS</span>
            </div>
            <div className="countdown-cell" data-section="countdown-hours">
              <strong className="countdown-cell__num">{timeParts.hours}</strong>
              <span className="countdown-cell__lbl">HORAS</span>
            </div>
            <div className="countdown-cell" data-section="countdown-minutes">
              <strong className="countdown-cell__num">{timeParts.minutes}</strong>
              <span className="countdown-cell__lbl">MIN</span>
            </div>
            <div className="countdown-cell" data-section="countdown-seconds">
              <strong className="countdown-cell__num">{timeParts.seconds}</strong>
              <span className="countdown-cell__lbl">SEG</span>
            </div>
          </div>

          <div className="countdown-progress-wrap">
            <div className="countdown-progress" data-section="presale-progress">
              <div className="countdown-progress__bar" style={{ width: '45%' }} />
            </div>
            <div className="countdown-progress__info">
              <span>Disponibilidad Génesis: <strong>9 de 20 Packs Vendidos (45%)</strong></span>
              <span>Liquidez aportada: <strong>+$120.00 USDT al pool</strong></span>
            </div>
          </div>
        </article>

        {/* AMM Chart Card */}
        <article className="chart-card" data-section="amm-chart" data-label="AMM CHART">
          <div className="chart-toolbar">
            <div className="chart-title-slot">
              <span className="chart-title-text">CURVA BONDING CURVE AMM (PLANTS / USDT)</span>
              <span className="chart-badge">P = R / V</span>
            </div>
            <div className="chart-filter-slot">
              {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={`chart-tf-btn ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-area" data-section="amm-chart-area">
            <svg viewBox="0 0 640 180" className="chart-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradientSummary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#19d99c" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#19d99c" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lineGradientSummary" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#29bdf6" />
                  <stop offset="100%" stopColor="#19d99c" />
                </linearGradient>
              </defs>

              <line x1="30" y1="40" x2="610" y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="30" y1="90" x2="610" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="30" y1="140" x2="610" y2="140" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />

              {svgAreaD && <path d={svgAreaD} fill="url(#chartGradientSummary)" />}
              {svgPathD && <path d={svgPathD} fill="none" stroke="url(#lineGradientSummary)" strokeWidth="3" />}

              {chartPoints.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={idx === chartPoints.length - 1 ? 5 : 3}
                  className={idx === chartPoints.length - 1 ? 'chart-point-pulse' : 'chart-point'}
                />
              ))}
            </svg>
          </div>

          <div className="chart-stats-footer">
            <span>Circulante: <strong>{circulating.toLocaleString()} PLANTS</strong></span>
            <span>Reserva Virtual: <strong>{virtualPlants.toLocaleString()} vPLANTS</strong></span>
            <span>Presión Compradora: <strong className="text-green">+60% en Preventas / +70% en Tienda</strong></span>
          </div>
        </article>
      </section>

      {/* =====================================================
           BOTTOM ROW: FLOW + PACKS + BENEFITS
           ===================================================== */}
      <section className="bottom-grid">
        {/* Ecosystem Flow Panel */}
        <article className="flow-panel" data-section="ecosystem-flow" data-label="ECOSYSTEM FLOW">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">CICLO DEL ECOSISTEMA ECONÓMICO</h4>
            <span className="panel-heading-badge">4 FASES CLAVE</span>
          </div>

          <div className="flow-grid">
            <div className="flow-step" data-section="flow-step-buy">
              <div className="flow-number-slot">1</div>
              <div className="flow-icon-slot" data-slot="summaryFlowStep1">
                {TOKEN_ASSETS.summaryFlowStep1 ? (
                  <img src={TOKEN_ASSETS.summaryFlowStep1} alt="Paso 1" className="slot-img" />
                ) : (
                  <span className="step-emoji">🛒</span>
                )}
              </div>
              <div className="flow-copy-slot">
                <strong>1. Compra de Pack</strong>
                <p>Adquiere en preventa o acumula jugando. El 60% va al pool de liquidez.</p>
              </div>
            </div>

            <div className="flow-step" data-section="flow-step-vesting">
              <div className="flow-number-slot">2</div>
              <div className="flow-icon-slot" data-slot="summaryFlowStep2">
                {TOKEN_ASSETS.summaryFlowStep2 ? (
                  <img src={TOKEN_ASSETS.summaryFlowStep2} alt="Paso 2" className="slot-img" />
                ) : (
                  <span className="step-emoji">🛡️</span>
                )}
              </div>
              <div className="flow-copy-slot">
                <strong>2. Vesting Seguro 45d</strong>
                <p>Desbloqueo lineal del 2.22% cada 24 horas, garantizando estabilidad.</p>
              </div>
            </div>

            <div className="flow-step" data-section="flow-step-release">
              <div className="flow-number-slot">3</div>
              <div className="flow-icon-slot" data-slot="summaryFlowStep3">
                {TOKEN_ASSETS.summaryFlowStep3 ? (
                  <img src={TOKEN_ASSETS.summaryFlowStep3} alt="Paso 3" className="slot-img" />
                ) : (
                  <span className="step-emoji">⚡</span>
                )}
              </div>
              <div className="flow-copy-slot">
                <strong>3. Reclamo Diario</strong>
                <p>Acredita diariamente tus tokens liberados a tu saldo líquido sin comisiones.</p>
              </div>
            </div>

            <div className="flow-step" data-section="flow-step-swap">
              <div className="flow-number-slot">4</div>
              <div className="flow-icon-slot" data-slot="summaryFlowStep4">
                {TOKEN_ASSETS.summaryFlowStep4 ? (
                  <img src={TOKEN_ASSETS.summaryFlowStep4} alt="Paso 4" className="slot-img" />
                ) : (
                  <span className="step-emoji">🔄</span>
                )}
              </div>
              <div className="flow-copy-slot">
                <strong>4. Swap o Super Sink</strong>
                <p>Retira a USDT BEP-20 o canjea por Gemas con un +20% de bonus inmediato.</p>
              </div>
            </div>
          </div>
        </article>

        {/* Presale Packs Panel */}
        <article className="packs-panel" data-section="presale-packs" data-label="PRESALE PACKS">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">PACKS GÉNESIS DISPONIBLES</h4>
            <span className="panel-heading-badge text-gold">20 PACKS TOTAL</span>
          </div>

          <div className="pack-grid">
            {PRESALE_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="pack-card"
                data-section={pack.id}
                onClick={() => onTabChange('presale')}
                style={{ cursor: 'pointer' }}
              >
                <div className="pack-title-slot">
                  <span className="pack-tag-pill" style={{ color: pack.accentColor }}>
                    {pack.tag}
                  </span>
                  <strong>{pack.name}</strong>
                </div>

                <div className="pack-image-slot" data-slot={`pack-${pack.id}`}>
                  <span className="pack-slot-placeholder-icon">
                    {pack.id === 'pack_pionero_10' ? '🥉' : pack.id === 'pack_campeon_25' ? '🥈' : '👑'}
                  </span>
                </div>

                <div className="pack-copy-slot">
                  <span className="pack-price-hero">${pack.priceUsdt} USDT <small>({pack.gemsPrice.toLocaleString()} 💎)</small></span>
                  <span className="pack-plants-hero">+{pack.plantsAmount.toLocaleString()} PLANTS</span>
                  <span className="pack-daily-hero">+{pack.dailyRate} / día (45 días)</span>
                  <small style={{ color: '#29bdf6', fontSize: '9px', marginTop: '2px' }}>+{pack.gemsReward.toLocaleString()} 💎 Bono Inmediato</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Key Benefits Panel */}
        <article className="benefits-panel" data-section="key-benefits" data-label="KEY BENEFITS">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">GARANTÍAS & BENEFICIOS</h4>
            <span className="panel-heading-badge text-cyan">PROTOCOLOS</span>
          </div>

          <div className="benefit-list">
            <div className="benefit-row" data-section="benefit-liquidity">
              <div className="benefit-icon-slot">
                <span>🏦</span>
              </div>
              <div className="benefit-copy-slot">
                <strong>Liquidez Transparente y Respaldada</strong>
                <p>El 60% de preventas y el 70% de compras in-game ingresan al pool USDT.</p>
              </div>
            </div>

            <div className="benefit-row" data-section="benefit-vesting">
              <div className="benefit-icon-slot">
                <span>⏳</span>
              </div>
              <div className="benefit-copy-slot">
                <strong>Vesting Lineal Anti-Especulación</strong>
                <p>45 días de liberación fija que eliminan caídas de precio artificiales.</p>
              </div>
            </div>

            <div className="benefit-row" data-section="benefit-gem-bonus">
              <div className="benefit-icon-slot">
                <span>💎</span>
              </div>
              <div className="benefit-copy-slot">
                <strong>Super Sink (+20% Gemas con Quema)</strong>
                <p>Canjea tus PLANTS por Gemas con un 20% extra. Los tokens se queman de por vida.</p>
              </div>
            </div>

            <div className="benefit-row" data-section="benefit-live-amm">
              <div className="benefit-icon-slot">
                <span>📈</span>
              </div>
              <div className="benefit-copy-slot">
                <strong>Curva AMM con Emisión Finita</strong>
                <p>Suministro máximo inmutable de 1M PLANTS con 5 eras de halving programadas.</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* =====================================================
           PRIMARY CTAs ROW
           ===================================================== */}
      <section className="cta-grid" data-section="primary-cta-row" data-label="PRIMARY CTAs">
        <button
          type="button"
          className="cta-placeholder cta-placeholder--presale"
          data-action="open-presale"
          onClick={() => onTabChange('presale')}
        >
          <span>🛒 PARTICIPAR EN LA PREVENTA GÉNESIS</span>
        </button>

        <button
          type="button"
          className="cta-placeholder cta-placeholder--vesting"
          data-action="open-vesting"
          onClick={() => onTabChange('vesting')}
        >
          <span>🌱 RECLAMAR VESTING & MIS TOKENS</span>
        </button>

        <button
          type="button"
          className="cta-placeholder cta-placeholder--swap"
          data-action="open-swap"
          onClick={() => onTabChange('swap')}
        >
          <span>🔄 ABRIR SWAP & RETIROS BEP-20</span>
        </button>
      </section>
    </div>
  )
}
