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
}) => {
  const formatCountdown = (secs: number) => {
    const total = secs > 0 ? secs : 0
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

  const stockPioneer = marketState?.presaleStocks?.pionero ?? 10
  const stockChampion = marketState?.presaleStocks?.campeon ?? 6
  const stockLegend = marketState?.presaleStocks?.leyenda ?? 4

  const totalSold = marketState?.presalePacksSold ?? (20 - (stockPioneer + stockChampion + stockLegend))
  const totalRemaining = marketState?.presalePacksRemaining ?? (stockPioneer + stockChampion + stockLegend)
  const plantsCommitted =
    marketState?.presalePlantsCommitted && marketState.presalePlantsCommitted > 0
      ? marketState.presalePlantsCommitted
      : (10 - stockPioneer) * 2500 + (6 - stockChampion) * 7500 + (4 - stockLegend) * 15000

  return (
    <div className="token-presale-screen">
      {/* =====================================================
           1. MINI KPI ROW (5 ITEMS)
           ===================================================== */}
      <section className="presale-kpi-bar" data-section="presale-stats-row">
        {/* FONDO INICIAL */}
        <div className="presale-kpi-item">
          <span className="presale-kpi-icon text-green">💲</span>
          <div className="presale-kpi-data">
            <span className="presale-kpi-label">FONDO INICIAL (LIQUIDEZ)</span>
            <div className="presale-kpi-val-wrap">
              <strong className="presale-kpi-val text-green">${poolUsdt.toFixed(2)} USDT</strong>
              <span className="summary-kpi-tag summary-kpi-tag--blue">100% RESPALDADO</span>
            </div>
          </div>
        </div>

        {/* PACKS VENDIDOS */}
        <div className="presale-kpi-item">
          <span className="presale-kpi-icon text-cyan">🛒</span>
          <div className="presale-kpi-data">
            <span className="presale-kpi-label">PACKS VENDIDOS</span>
            <strong className="presale-kpi-val text-cyan">{totalSold} / 20</strong>
          </div>
        </div>

        {/* RESTANTES */}
        <div className="presale-kpi-item">
          <span className="presale-kpi-icon text-gold">📦</span>
          <div className="presale-kpi-data">
            <span className="presale-kpi-label">RESTANTES</span>
            <strong className="presale-kpi-val text-gold">{totalRemaining} / 20</strong>
          </div>
        </div>

        {/* PLANTS COMPROMETIDOS */}
        <div className="presale-kpi-item">
          <span className="presale-kpi-icon text-mint">🌱</span>
          <div className="presale-kpi-data">
            <span className="presale-kpi-label">PLANTS COMPROMETIDOS</span>
            <strong className="presale-kpi-val text-mint">{plantsCommitted.toLocaleString()} PLANTS</strong>
          </div>
        </div>

        {/* FIN DE PREVENTA COUNTDOWN */}
        <div className="presale-kpi-item presale-kpi-item--timer">
          <span className="presale-kpi-icon text-yellow">🏆</span>
          <div className="presale-kpi-data">
            <span className="presale-kpi-label">FIN DE PREVENTA</span>
            <div className="presale-mini-timer">
              <span>{timeParts.days}D</span> : <span>{timeParts.hours}H</span> : <span>{timeParts.minutes}M</span> : <span>{timeParts.seconds}S</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
           3. MAIN GRID: 3 PACK CARDS + ¿CÓMO FUNCIONA? ASIDE
           ===================================================== */}
      <section className="presale-main-grid">
        {/* PACKS COLUMN (3 CARDS) */}
        <div className="presale-packs-row">
          {PRESALE_PACKS.map((pack) => {
            const stockKey =
              pack.id === 'pack_pionero_10' ? 'pionero' : pack.id === 'pack_campeon_25' ? 'campeon' : 'leyenda'
            const stockLeft = marketState?.presaleStocks?.[stockKey] ?? pack.maxStock
            const isSoldOut = stockLeft <= 0
            const canAfford = userTokens >= pack.gemsPrice
            const chestImg =
              pack.id === 'pack_pionero_10'
                ? TOKEN_ASSETS.presalePackPioneer || '/game-assets/token/chest_pioneer.webp'
                : pack.id === 'pack_campeon_25'
                ? TOKEN_ASSETS.presalePackChampion || '/game-assets/token/chest_champion.webp'
                : TOKEN_ASSETS.presalePackLegend || '/game-assets/token/chest_legend.webp'

            const themeClass =
              pack.id === 'pack_pionero_10'
                ? 'presale-card--pioneer'
                : pack.id === 'pack_campeon_25'
                ? 'presale-card--champion'
                : 'presale-card--legend'

            return (
              <article key={pack.id} className={`presale-card ${themeClass}`}>
                {/* Badge if Popular or Legend */}
                {pack.popular && (
                  <div className="presale-badge-popular">⭐ MÁS POPULAR</div>
                )}
                {pack.id === 'pack_leyenda_50' && (
                  <div className="presale-badge-gold">👑 EDICIÓN ORO</div>
                )}

                {/* Card Title Header */}
                <div className="presale-card-header">
                  <h3 className="presale-card-title">{pack.name}</h3>
                  <span className="presale-card-subtag">{pack.tag}</span>
                </div>

                {/* Chest Image */}
                <div className="presale-card-image-wrap">
                  <img src={chestImg} alt={pack.name} className="presale-card-chest-img" />
                </div>

                {/* Price & Plants Row */}
                <div className="presale-card-price-row">
                  <span className="presale-price-val">💎 {pack.gemsPrice.toLocaleString()}</span>
                  <span className="presale-usdt-equiv">(${pack.priceUsdt} USDT)</span>
                  <span className="presale-plants-val">+{pack.plantsAmount.toLocaleString()} PLANTS</span>
                </div>

                {/* Bonus Gems Badge */}
                <div className="presale-card-gems-badge">
                  <span>💎 +{pack.gemsReward.toLocaleString()} Gemas de bono</span>
                </div>

                {/* Benefits List */}
                <ul className="presale-card-perks">
                  <li>🎁 {pack.bonusItemTitle}</li>
                  <li>💧 Inyecta ${(pack.priceUsdt * 0.6).toFixed(1)} USDT al Pool (60%)</li>
                  <li>📊 Vesting: +{pack.dailyRate} PLANTS/día (45d)</li>
                </ul>

                {/* Stock Bar */}
                <div className="presale-card-stock">
                  <div className="presale-stock-bar">
                    <div
                      className="presale-stock-fill"
                      style={{ width: `${Math.max(10, (stockLeft / pack.maxStock) * 100)}%` }}
                    />
                  </div>
                  <span className="presale-stock-txt">
                    Disponibles: {stockLeft} de {pack.maxStock}
                  </span>
                </div>

                {/* Action Buy Button */}
                <button
                  type="button"
                  className="presale-card-btn"
                  disabled={isSoldOut || isSubmitting}
                  onClick={() => onBuyPack(pack)}
                >
                  {isSoldOut
                    ? 'AGOTADO'
                    : isSubmitting
                    ? 'PROCESANDO...'
                    : !canAfford
                    ? `FALTAN ${(pack.gemsPrice - userTokens).toLocaleString()} 💎`
                    : `💎 COMPRAR CON ${pack.gemsPrice.toLocaleString()}`}
                </button>
              </article>
            )
          })}
        </div>

        {/* ASIDE: ¿CÓMO FUNCIONA? */}
        <aside className="presale-how-aside">
          <div className="presale-how-header">
            <span className="presale-how-icon">🌱</span>
            <h4 className="presale-how-title">¿CÓMO FUNCIONA?</h4>
          </div>

          <div className="presale-how-steps">
            <div className="presale-how-step">
              <span className="presale-how-num">1</span>
              <div className="presale-how-info">
                <strong>Compra tu Pack</strong>
                <p>Elige el pack que mejor se adapte a ti y completa la compra con USDT o gemas.</p>
              </div>
            </div>

            <div className="presale-how-step">
              <span className="presale-how-num">2</span>
              <div className="presale-how-info">
                <strong>Recibes PLANTS en vesting</strong>
                <p>Los PLANTS se asignan con vesting lineal de 45 días.</p>
              </div>
            </div>

            <div className="presale-how-step">
              <span className="presale-how-num">3</span>
              <div className="presale-how-info">
                <strong>Liberación diaria</strong>
                <p>Cada día se libera una parte de tus PLANTS automáticamente en tu cuenta.</p>
              </div>
            </div>

            <div className="presale-how-step">
              <span className="presale-how-num">4</span>
              <div className="presale-how-info">
                <strong>Retira o canjea</strong>
                <p>Puedes retirar tus PLANTS o canjear a gemas con +20% de bonus cuando quieras.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* =====================================================
           4. BOTTOM ROW: COMPARATIVA DE PACKS + PROMO BANNER
           ===================================================== */}
      <section className="presale-bottom-grid">
        {/* COMPARATIVA DE PACKS */}
        <article className="presale-compare-card">
          <div className="presale-compare-header">
            <span className="presale-compare-icon">⚖️</span>
            <h4 className="presale-compare-title">COMPARATIVA DE PACKS</h4>
          </div>

          <div className="presale-compare-table">
            <div className="presale-th">CARACTERÍSTICA</div>
            <div className="presale-th text-cyan">PIONERO</div>
            <div className="presale-th text-purple">CAMPEÓN</div>
            <div className="presale-th text-gold">LEYENDA</div>

            <div className="presale-td label">💎 Gemas de bono</div>
            <div className="presale-td text-cyan">+200 Gemas</div>
            <div className="presale-td text-purple">+500 Gemas</div>
            <div className="presale-td text-gold">+1,000 Gemas</div>

            <div className="presale-td label">🎁 Recompensas Exclusivas</div>
            <div className="presale-td">1 Sobre Común + 1,000 ORO</div>
            <div className="presale-td">1 Sobre Épico + 2,500 ORO</div>
            <div className="presale-td">1 Sobre Legendario + 4,000 ORO</div>

            <div className="presale-td label">💧 Inyección al Pool (60%)</div>
            <div className="presale-td">$6.0 USDT</div>
            <div className="presale-td">$15.0 USDT</div>
            <div className="presale-td">$30.0 USDT</div>

            <div className="presale-td label">📊 Vesting diario (45 días)</div>
            <div className="presale-td">+55.56 PLANTS/día</div>
            <div className="presale-td">+166.67 PLANTS/día</div>
            <div className="presale-td">+333.33 PLANTS/día</div>

            <div className="presale-td label">🔥 Acceso a Super Sink (+20%)</div>
            <div className="presale-td text-green">Incluido</div>
            <div className="presale-td text-green">Incluido</div>
            <div className="presale-td text-green">Incluido</div>
          </div>
        </article>

        {/* PROMO CARD RIGHT */}
        <article className="presale-promo-card">
          <div className="presale-promo-content">
            <span className="presale-promo-sprout">🌱</span>
            <div className="presale-promo-texts">
              <strong className="presale-promo-title">PLANTS HOY, PLANTS MAÑANA</strong>
              <span className="presale-promo-sub">UN ECOSISTEMA ETERNO</span>
            </div>
            <span className="presale-promo-shovel">🌾</span>
          </div>
        </article>
      </section>
    </div>
  )
}
