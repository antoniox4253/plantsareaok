import React from 'react'
import type { TokenHubSharedProps } from '../types'
import { TOKEN_ASSETS } from '../tokenAssets'
import { PRESALE_PACKS } from '../../../services/plantsTokenService'

export const TokenPresaleTab: React.FC<TokenHubSharedProps> = ({
  userTokens,
  marketState,
  countdownSeconds,
  poolUsdt,
  isSubmitting,
  onBuyPack,
  onTabChange,
}) => {
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

  // Calcular métricas de packs
  const stockPioneer = marketState?.presaleStocks?.pionero ?? 10
  const stockChampion = marketState?.presaleStocks?.campeon ?? 7
  const stockLegend = marketState?.presaleStocks?.leyenda ?? 3

  const totalSold = 20 - (stockPioneer + stockChampion + stockLegend)
  const totalRemaining = stockPioneer + stockChampion + stockLegend
  const plantsCommitted =
    (10 - stockPioneer) * 2500 + (7 - stockChampion) * 6500 + (3 - stockLegend) * 14000

  return (
    <div className="presale-screen">
      {/* =====================================================
           PRESALE HERO BANNER
           ===================================================== */}
      <section
        className="presale-hero"
        data-section="presale-hero"
        data-label="PRESALE HERO"
        style={
          TOKEN_ASSETS.presaleHeroBanner
            ? { backgroundImage: `url(${TOKEN_ASSETS.presaleHeroBanner})`, backgroundSize: 'cover' }
            : {}
        }
      >
        <div className="presale-hero__content">
          <div className="presale-hero__tag">🚀 RONDA EXCLUSIVA DE FUNDADORES GÉNESIS</div>
          <h1 className="presale-hero__title">PREVENTA LIMITADA A 20 PACKS EXCLUSIVOS</h1>
          <p className="presale-hero__desc">
            Adquiere uno de los <strong>20 packs de fundador</strong> disponibles con tus Gemas o saldo. El <strong>60% del valor</strong> se inyecta directamente a la <strong>reserva de liquidez en USDT</strong> en la curva AMM, garantizando un respaldo real. Recibes tus tokens PLANTS en una <strong>bóveda de Vesting Lineal de 45 días</strong> con desbloqueo diario para retiro o canje inmediato con un <strong>+20% extra en Gemas</strong> mediante Super Sink.
          </p>

          <div className="presale-hero__chips" style={{ marginBottom: '6px' }}>
            <span className="hero-chip">🛡️ Bóveda Anti-Dump (45 Días Lineal)</span>
            <span className="hero-chip">💎 Hasta 70% de Retorno Inmediato en Gemas</span>
            <span className="hero-chip">📦 Sobres Legendarios y Abono de Cultivo</span>
            <span className="hero-chip">🏦 60% Inyectado a Liquidez Pública</span>
          </div>
        </div>
      </section>

      {/* =====================================================
           PRESALE STATS ROW
           ===================================================== */}
      <section className="stats-grid" data-section="presale-stats-row" data-label="PRESALE STATS">
        <article className="stat-card" data-section="presale-initial-liquidity" data-label="INITIAL LIQUIDITY">
          <div className="stat-icon-slot">
            <span>🏦</span>
          </div>
          <div className="stat-content-slot">
            <span className="stat-label">FONDO DE RESPALDO</span>
            <strong className="stat-value text-green">${poolUsdt.toFixed(2)} USDT</strong>
            <span className="stat-sub">100% en Bóveda Pública</span>
          </div>
        </article>

        <article className="stat-card" data-section="packs-sold" data-label="PACKS SOLD">
          <div className="stat-icon-slot">
            <span>🎟️</span>
          </div>
          <div className="stat-content-slot">
            <span className="stat-label">PACKS VENDIDOS</span>
            <strong className="stat-value text-cyan">{totalSold} / 20 PACKS</strong>
            <span className="stat-sub">{((totalSold / 20) * 100).toFixed(0)}% Asignado</span>
          </div>
        </article>

        <article className="stat-card" data-section="packs-remaining" data-label="PACKS REMAINING">
          <div className="stat-icon-slot">
            <span>📦</span>
          </div>
          <div className="stat-content-slot">
            <span className="stat-label">PACKS DISPONIBLES</span>
            <strong className="stat-value text-gold">{totalRemaining} RESTANTES</strong>
            <span className="stat-sub">Sin reposición futura</span>
          </div>
        </article>

        <article className="stat-card" data-section="plants-committed" data-label="PLANTS COMMITTED">
          <div className="stat-icon-slot">
            <span>🌱</span>
          </div>
          <div className="stat-content-slot">
            <span className="stat-label">PLANTS ASIGNADOS</span>
            <strong className="stat-value text-purple">{plantsCommitted.toLocaleString()} PLANTS</strong>
            <span className="stat-sub">En desbloqueo lineal</span>
          </div>
        </article>

        <article className="stat-card" data-section="presale-mini-countdown" data-label="PRESALE COUNTDOWN">
          <div className="stat-icon-slot">
            <span>⏳</span>
          </div>
          <div className="countdown-mini">
            <div data-section="mini-days">
              <strong>{timeParts.days}</strong>
              <small>DÍAS</small>
            </div>
            <div data-section="mini-hours">
              <strong>{timeParts.hours}</strong>
              <small>HORAS</small>
            </div>
            <div data-section="mini-minutes">
              <strong>{timeParts.minutes}</strong>
              <small>MIN</small>
            </div>
            <div data-section="mini-seconds">
              <strong>{timeParts.seconds}</strong>
              <small>SEG</small>
            </div>
          </div>
        </article>
      </section>

      {/* =====================================================
           MAIN GRID: PACKS + HOW IT WORKS
           ===================================================== */}
      <section className="main-grid">
        {/* Packs Grid */}
        <div className="packs-grid" data-section="presale-packs-grid" data-label="PRESALE PACKS">
          {PRESALE_PACKS.map((pack) => {
            const stockKey =
              pack.id === 'pack_pionero_10' ? 'pionero' : pack.id === 'pack_campeon_25' ? 'campeon' : 'leyenda'
            const stockLeft = marketState?.presaleStocks?.[stockKey] ?? pack.maxStock
            const isSoldOut = stockLeft <= 0
            const canAfford = userTokens >= pack.gemsPrice

            return (
              <article
                key={pack.id}
                className={`pack-card ${
                  pack.id === 'pack_pionero_10' ? 'pioneer' : pack.id === 'pack_campeon_25' ? 'champion' : 'legend'
                }`}
                data-section={pack.id}
                data-label={pack.title.toUpperCase()}
              >
                {/* Badge if Champion or Legend */}
                {pack.popular && (
                  <div className="pack-badge-slot" data-section={`${pack.id}-badge`}>
                    ⭐ MÁS POPULAR / RECOMENDADO
                  </div>
                )}
                {pack.id === 'pack_leyenda_50' && (
                  <div className="pack-badge-slot" data-section={`${pack.id}-badge`}>
                    👑 ESTATUS VIP MÁXIMO
                  </div>
                )}

                {/* Header Slot */}
                <div className="pack-header-slot">
                  <span className="pack-card-tag" style={{ color: pack.accentColor }}>
                    {pack.tag} FUNDADOR
                  </span>
                  <h3 className="pack-card-title">{pack.name}</h3>
                </div>

                {/* Image Slot */}
                <div className="pack-image-slot" data-slot={`presale-${pack.id}`}>
                  <span className="pack-image-placeholder-icon">
                    {pack.id === 'pack_pionero_10' ? '🥉' : pack.id === 'pack_campeon_25' ? '🥈' : '👑'}
                  </span>
                </div>

                {/* Price Slot */}
                <div className="pack-price-slot">
                  <div className="pack-price-primary">${pack.priceUsdt} USDT</div>
                  <div className="pack-price-secondary">o {pack.gemsPrice.toLocaleString()} Gemas 💎</div>
                </div>

                {/* Benefits Slot */}
                <div className="pack-benefits-slot">
                  <div className="pack-benefit-hero">
                    <span className="pack-plants-num">+{pack.plantsAmount.toLocaleString()}</span>
                    <span className="pack-plants-lbl">PLANTS</span>
                  </div>
                  <div className="pack-vesting-rate">
                    Vesting Lineal 45 Días · <strong>+{pack.dailyRate} PLANTS/día</strong>
                  </div>
                  <ul className="pack-benefits-list">
                    <li>💎 <strong>+{pack.gemsReward.toLocaleString()} Gemas</strong> de bono inmediato ({((pack.gemsReward / pack.gemsPrice) * 100).toFixed(0)}% retorno directo)</li>
                    <li>🎁 <strong>{pack.bonusItemTitle}</strong></li>
                    <li>🌾 {pack.bonusItemDesc}</li>
                    <li>📈 Inyecta <strong>+${(pack.priceUsdt * 0.6).toFixed(1)} USDT</strong> al pool público</li>
                    <li>🔥 Acceso directo a <strong>Super Sink (+20% Gemas)</strong></li>
                  </ul>
                </div>

                {/* Stock Slot */}
                <div className="pack-stock-slot">
                  <div className="pack-stock-bar">
                    <div
                      className="pack-stock-fill"
                      style={{ width: `${Math.max(10, (stockLeft / pack.maxStock) * 100)}%` }}
                    />
                  </div>
                  <span className="pack-stock-text">
                    {isSoldOut ? 'AGOTADO' : `${stockLeft} de ${pack.maxStock} packs disponibles`}
                  </span>
                </div>

                {/* Button Slot */}
                <button
                  type="button"
                  className="pack-button-slot"
                  data-action={`buy-${pack.id}`}
                  disabled={isSoldOut || isSubmitting}
                  onClick={() => onBuyPack(pack)}
                >
                  {isSoldOut
                    ? 'AGOTADO'
                    : isSubmitting
                    ? 'PROCESANDO...'
                    : !canAfford
                    ? `FALTAN ${(pack.gemsPrice - userTokens).toLocaleString()} 💎`
                    : `ADQUIRIR POR ${pack.gemsPrice.toLocaleString()} 💎`}
                </button>
              </article>
            )
          })}
        </div>

        {/* How it Works Aside */}
        <aside className="how-panel" data-section="how-it-works" data-label="HOW IT WORKS">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">¿CÓMO FUNCIONA LA PREVENTA?</h4>
            <span className="panel-heading-badge">GUÍA RÁPIDA</span>
          </div>

          <div className="how-list">
            <div className="how-step" data-section="how-step-buy">
              <div className="how-number-slot">1</div>
              <div className="how-icon-slot">
                <span>🛒</span>
              </div>
              <div className="how-copy-slot">
                <strong>1. Elige tu Pack Fundador</strong>
                <p>Usa tus Gemas o USDT para adquirir uno de los 20 packs génesis. El 60% va al pool de liquidez.</p>
              </div>
            </div>

            <div className="how-step" data-section="how-step-vesting">
              <div className="how-number-slot">2</div>
              <div className="how-icon-slot">
                <span>🛡️</span>
              </div>
              <div className="how-copy-slot">
                <strong>2. Vesting Lineal de 45 Días</strong>
                <p>Tus tokens se custodian en una bóveda segura que libera el 2.22% cada 24 horas.</p>
              </div>
            </div>

            <div className="how-step" data-section="how-step-daily-release">
              <div className="how-number-slot">3</div>
              <div className="how-icon-slot">
                <span>⚡</span>
              </div>
              <div className="how-copy-slot">
                <strong>3. Reclamo Diario a Saldo Líquido</strong>
                <p>Entra diariamente a la pestaña Vesting y pulsa 'Reclamar Hoy' para transferir a tu saldo líquido.</p>
              </div>
            </div>

            <div className="how-step" data-section="how-step-withdraw-or-convert">
              <div className="how-number-slot">4</div>
              <div className="how-icon-slot">
                <span>🔄</span>
              </div>
              <div className="how-copy-slot">
                <strong>4. Retiro BEP-20 o Bono +20%</strong>
                <p>Retira tus ganancias en USDT (Arena 3+) o canjea por Gemas con un +20% de regalo en Super Sink.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* =====================================================
           COMPARISON + PROMO
           ===================================================== */}
      <section className="compare-grid">
        <article className="compare-panel" data-section="pack-comparison" data-label="PACK COMPARISON">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">TABLA COMPARATIVA DETALLADA DE PACKS</h4>
            <span className="panel-heading-badge text-cyan">DESGLOSE COMPLETO</span>
          </div>

          <div className="compare-table">
            {/* Header */}
            <div className="compare-cell header" data-section="comparison-label-header">
              CARACTERÍSTICA
            </div>
            <div className="compare-cell header" data-section="comparison-pioneer-header">
              PIONERO ($10 / 1,000 💎)
            </div>
            <div className="compare-cell header" data-section="comparison-champion-header">
              CAMPEÓN ($25 / 2,500 💎)
            </div>
            <div className="compare-cell header" data-section="comparison-legend-header">
              LEYENDA ($50 / 5,000 💎)
            </div>

            {/* Row 1: PLANTS Totales */}
            <div className="compare-cell" data-section="comparison-plants-total-label">
              Total Tokens PLANTS
            </div>
            <div className="compare-cell text-cyan" data-section="comparison-pioneer-plants">
              +2,500 PLANTS
            </div>
            <div className="compare-cell text-purple" data-section="comparison-champion-plants">
              +6,500 PLANTS (+16% extra)
            </div>
            <div className="compare-cell text-gold" data-section="comparison-legend-plants">
              +14,000 PLANTS (+25% extra)
            </div>

            {/* Row 2: Tasa Diaria Vesting */}
            <div className="compare-cell" data-section="comparison-vesting-label">
              Liberación Diaria (45 Días)
            </div>
            <div className="compare-cell" data-section="comparison-pioneer-vesting">
              +55.56 PLANTS / día
            </div>
            <div className="compare-cell" data-section="comparison-champion-vesting">
              +144.44 PLANTS / día
            </div>
            <div className="compare-cell" data-section="comparison-legend-vesting">
              +311.11 PLANTS / día
            </div>

            {/* Row 3: Bono Gemas */}
            <div className="compare-cell" data-section="comparison-bonus-gems-label">
              Bono en Gemas Inmediato
            </div>
            <div className="compare-cell text-cyan" data-section="comparison-pioneer-bonus-gems">
              +600 💎 (60% retorno)
            </div>
            <div className="compare-cell text-purple" data-section="comparison-champion-bonus-gems">
              +1,600 💎 (64% retorno)
            </div>
            <div className="compare-cell text-gold" data-section="comparison-legend-bonus-gems">
              +3,500 💎 (70% retorno)
            </div>

            {/* Row 4: Recompensas Jardín */}
            <div className="compare-cell" data-section="comparison-pack-rewards-label">
              Sobres & Recursos de Cultivo
            </div>
            <div className="compare-cell" data-section="comparison-pioneer-rewards">
              1 Sobre Épico + 500 Abono
            </div>
            <div className="compare-cell" data-section="comparison-champion-rewards">
              1 Sobre Legendario + 1,500 Abono
            </div>
            <div className="compare-cell" data-section="comparison-legend-rewards">
              2 Sobres Legendarios + 3,500 Abono
            </div>

            {/* Row 5: Aporte a Liquidez */}
            <div className="compare-cell" data-section="comparison-liquidity-label">
              Inyección al Pool USDT (60%)
            </div>
            <div className="compare-cell text-green" data-section="comparison-pioneer-liquidity">
              +$6.00 USDT al pool
            </div>
            <div className="compare-cell text-green" data-section="comparison-champion-liquidity">
              +$15.00 USDT al pool
            </div>
            <div className="compare-cell text-green" data-section="comparison-legend-liquidity">
              +$30.00 USDT al pool
            </div>

            {/* Row 6: Super Sink */}
            <div className="compare-cell" data-section="comparison-super-sink-label">
              Acceso a Super Sink (+20%)
            </div>
            <div className="compare-cell text-green" data-section="comparison-pioneer-super-sink">
              ✓ Activo Día 1
            </div>
            <div className="compare-cell text-green" data-section="comparison-champion-super-sink">
              ✓ Activo Día 1
            </div>
            <div className="compare-cell text-green" data-section="comparison-legend-super-sink">
              ✓ Activo Día 1 (Prioritario)
            </div>
          </div>
        </article>

        <aside
          className="promo-panel"
          data-section="presale-bottom-promo"
          data-label="BOTTOM PROMO"
          style={
            TOKEN_ASSETS.presaleBottomPromo
              ? { backgroundImage: `url(${TOKEN_ASSETS.presaleBottomPromo})`, backgroundSize: 'cover' }
              : {}
          }
        >
          <div className="promo-panel__content">
            <span className="promo-badge">🛡️ COMPROMISO DE LIQUIDEZ Y TRANSPARENCIA</span>
            <h4 className="promo-title">GARANTÍA DE RESERVA PÚBLICA</h4>
            <p className="promo-desc">
              Cada pack adquirido respalda directamente el pool público en USDT y eleva el precio spot del token PLANTS mediante la bonding curve. Una vez completada la preventa, no habrá nuevas rondas de descuento.
            </p>
            <button
              type="button"
              className="token-action-btn token-action-btn--primary"
              onClick={() => onTabChange('vesting')}
            >
              🌱 REVISAR MIS DESBLOQUEOS EN VESTING
            </button>
          </div>
        </aside>
      </section>
    </div>
  )
}
