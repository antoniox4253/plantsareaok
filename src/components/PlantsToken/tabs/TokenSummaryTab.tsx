import React, { useState } from 'react'
import { soundManager } from '../../../utils/audioManager'
import type { TokenHubSharedProps } from '../types'
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

  return (
    <div className="token-summary-screen">
      {/* =====================================================
           1. KPI ROW (4 CARDS)
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
           2. FILA SUPERIOR: CUENTA REGRESIVA (28%) + PACKS DESTACADOS (72%)
           ===================================================== */}
      <section className="summary-presale-row">
        {/* FIN DE PREVENTA (CUENTA REGRESIVA) */}
        <article className="summary-countdown-panel">
          <div className="summary-panel-header">
            <span className="summary-panel-icon">🏆</span>
            <div>
              <h4 className="summary-panel-title">FIN DE PREVENTA</h4>
              <span className="summary-panel-subtitle">Cierre de fase inicial</span>
            </div>
            <span className="summary-badge-live">FASE 1</span>
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
            <div className="summary-countdown-progress-lbl">
              <span>Meta: 185,000,000 PLANTS</span>
              <strong className="text-mint">45% COMPLETADO</strong>
            </div>
          </div>
        </article>

        {/* PACKS DE PREVENTA EXCLUSIVOS (LOS 3 COFRES ACTUALIZADOS) */}
        <article className="summary-packs-panel">
          <div className="summary-panel-header">
            <div className="summary-panel-title-group">
              <span className="summary-panel-icon">🎁</span>
              <div>
                <h4 className="summary-panel-title">PACKS DE PREVENTA EXCLUSIVOS</h4>
                <span className="summary-panel-subtitle">Adquiere tokens con vesting lineal de 45 días</span>
              </div>
            </div>
            <button
              type="button"
              className="summary-see-all-btn"
              onClick={() => onTabChange('presale')}
            >
              <span>IR A PREVENTA</span>
              <span className="see-all-arrow">➔</span>
            </button>
          </div>

          <div className="summary-packs-cards-grid">
            {/* PACK PIONERO */}
            <div
              className="summary-pack-card summary-pack-card--pionero"
              onClick={() => onTabChange('presale')}
            >
              <div className="summary-pack-card-top">
                <span className="pack-tier-badge pack-tier-badge--pionero">🌱 BÁSICO</span>
                <strong className="pack-price-tag text-cyan">$10 USDT</strong>
              </div>
              <div className="summary-pack-img-wrap">
                <img
                  src={TOKEN_ASSETS.summaryPackPioneer || '/game-assets/token/chest_pioneer.webp'}
                  alt="Pack Pionero"
                  className="summary-pack-chest-img"
                />
              </div>
              <div className="summary-pack-details">
                <strong className="pack-name">Pack Pionero</strong>
                <span className="pack-plants-gain text-mint">+2,500 PLANTS</span>
                <span className="pack-bonus-tag text-cyan">+1x Sobre Básico</span>
              </div>
            </div>

            {/* PACK CAMPEÓN */}
            <div
              className="summary-pack-card summary-pack-card--campeon"
              onClick={() => onTabChange('presale')}
            >
              <div className="summary-pack-card-top">
                <span className="pack-tier-badge pack-tier-badge--campeon">🌿 POPULAR</span>
                <strong className="pack-price-tag text-purple">$25 USDT</strong>
              </div>
              <div className="summary-pack-img-wrap">
                <img
                  src={TOKEN_ASSETS.summaryPackChampion || '/game-assets/token/chest_champion.webp'}
                  alt="Pack Campeón"
                  className="summary-pack-chest-img"
                />
              </div>
              <div className="summary-pack-details">
                <strong className="pack-name">Pack Campeón</strong>
                <span className="pack-plants-gain text-mint">+7,500 PLANTS</span>
                <span className="pack-bonus-tag text-purple">+3x Sobres Básicos</span>
              </div>
            </div>

            {/* PACK LEYENDA */}
            <div
              className="summary-pack-card summary-pack-card--leyenda"
              onClick={() => onTabChange('presale')}
            >
              <div className="summary-pack-card-top">
                <span className="pack-tier-badge pack-tier-badge--leyenda">👑 VIP MÁXIMO</span>
                <strong className="pack-price-tag text-gold">$50 USDT</strong>
              </div>
              <div className="summary-pack-img-wrap">
                <img
                  src={TOKEN_ASSETS.summaryPackLegend || '/game-assets/token/chest_legend.webp'}
                  alt="Pack Leyenda"
                  className="summary-pack-chest-img"
                />
              </div>
              <div className="summary-pack-details">
                <strong className="pack-name">Pack Leyenda</strong>
                <span className="pack-plants-gain text-mint">+15,000 PLANTS</span>
                <span className="pack-bonus-tag text-gold">+Skin Oro 24K</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* =====================================================
           3. FILA INFERIOR: FLUJO DEL ECOSISTEMA (56%) + BENEFICIOS & AMM (44%)
           ===================================================== */}
      <section className="summary-ecosystem-row">
        {/* FLUJO DEL ECOSISTEMA */}
        <article className="summary-flow-panel">
          <div className="summary-panel-header">
            <span className="summary-panel-icon">⚙️</span>
            <div>
              <h4 className="summary-panel-title">FLUJO DEL ECOSISTEMA PLANTS</h4>
              <span className="summary-panel-subtitle">Ciclo económico de 4 fases sin inflación desmedida</span>
            </div>
          </div>

          <div className="summary-flow-steps">
            <div className="summary-flow-step">
              <div className="flow-step-num">1</div>
              <span className="flow-step-icon">🛒</span>
              <strong className="flow-step-title">Compra Preventa</strong>
              <span className="flow-step-desc">Packs con bono en USDT/Gemas</span>
            </div>
            <span className="flow-step-arrow">➔</span>

            <div className="summary-flow-step">
              <div className="flow-step-num">2</div>
              <span className="flow-step-icon">🌱</span>
              <strong className="flow-step-title">Vesting Seguro</strong>
              <span className="flow-step-desc">Bloqueo de 45 días auditado</span>
            </div>
            <span className="flow-step-arrow">➔</span>

            <div className="summary-flow-step">
              <div className="flow-step-num">3</div>
              <span className="flow-step-icon">📅</span>
              <strong className="flow-step-title">Cosecha Diaria</strong>
              <span className="flow-step-desc">Reclamo lineal a saldo líquido</span>
            </div>
            <span className="flow-step-arrow">➔</span>

            <div className="summary-flow-step">
              <div className="flow-step-num">4</div>
              <span className="flow-step-icon">🔄</span>
              <strong className="flow-step-title">Swap & Retiro</strong>
              <span className="flow-step-desc">USDT o Gemas (+20% bono)</span>
            </div>
          </div>
        </article>

        {/* BENEFICIOS CLAVE & ACCESO AMM */}
        <article className="summary-benefits-panel">
          <div className="summary-panel-header">
            <span className="summary-panel-icon">⭐</span>
            <div>
              <h4 className="summary-panel-title">BENEFICIOS & RESPALDO AMM</h4>
              <span className="summary-panel-subtitle">Garantías técnicas de la economía</span>
            </div>
          </div>

          <div className="summary-benefits-grid">
            <div className="summary-benefit-item">
              <span className="benefit-icon">💧</span>
              <div className="benefit-texts">
                <strong>60% al Pool USDT</strong>
                <span>Estabilidad y paridad</span>
              </div>
            </div>

            <div className="summary-benefit-item">
              <span className="benefit-icon">💎</span>
              <div className="benefit-texts">
                <strong>Super Sink (+20% Gemas)</strong>
                <span>Quema de tokens directa</span>
              </div>
            </div>

            <div className="summary-benefit-item">
              <span className="benefit-icon">📅</span>
              <div className="benefit-texts">
                <strong>Vesting Lineal 45 Días</strong>
                <span>Protección anti-ballenas</span>
              </div>
            </div>

            <div
              className="summary-benefit-item summary-benefit-item--amm-action"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setIsAmmModalOpen(true)
              }}
              title="Abrir la Curva AMM en pantalla completa"
            >
              <span className="benefit-icon">📈</span>
              <div className="benefit-texts">
                <strong className="text-mint">Curva AMM (P = R / V)</strong>
                <span>Ver gráfica completa ➔</span>
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
