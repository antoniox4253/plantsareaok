import React from 'react'
import type { TokenHubSharedProps } from '../types'
import { TOKEN_ASSETS } from '../tokenAssets'

export const TokenomicsTab: React.FC<TokenHubSharedProps> = ({
  spotPrice,
  poolUsdt,
  totalBurned,
  marketState,
}) => {
  return (
    <div className="token-tokenomics-screen">
      {/* =====================================================
           1. HERO BANNER
           ===================================================== */}
      <section
        className="summary-hero-banner tokenomics-hero-banner"
        data-section="tokenomics-hero"
        style={
          TOKEN_ASSETS.tokenomicsHeroBanner
            ? { backgroundImage: `url(${TOKEN_ASSETS.tokenomicsHeroBanner})` }
            : {}
        }
      >
        <div className="summary-hero-banner__fallback-overlay">
          <div className="summary-hero-badge-wrap">
            <span className="summary-hero-pill">📊 ECONOMÍA CIRCULAR SOSTENIBLE DE PLANTS ARENA</span>
          </div>
        </div>
      </section>

      {/* =====================================================
           2. KPI ROW (5 CARDS)
           ===================================================== */}
      <section className="summary-kpi-grid tokenomics-kpi-grid" data-section="tokenomics-kpi-row">
        {/* SUPPLY MÁXIMO */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--green">
            <span className="summary-kpi-emoji">🌱</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">SUPPLY MÁXIMO</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-green">1,000,000 PLANTS</strong>
            </div>
            <span className="summary-kpi-sub">Suministro total y definitivo</span>
          </div>
        </article>

        {/* PRECIO SPOT */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--mint">
            <span className="summary-kpi-emoji">💲</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PRECIO SPOT</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-mint">${spotPrice.toFixed(6)} USDT</strong>
              <span className="summary-kpi-tag summary-kpi-tag--green">LIVE AMM</span>
            </div>
            <span className="summary-kpi-sub">5,000 PLANTS = $1.00 USDT</span>
          </div>
        </article>

        {/* LIQUIDEZ */}
        <article className="summary-kpi-card">
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

        {/* PLANTS QUEMADOS */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--orange">
            <span className="summary-kpi-emoji">🔥</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PLANTS QUEMADOS</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-orange">{totalBurned.toLocaleString()} PLANTS</strong>
            </div>
            <span className="summary-kpi-sub">Super Sink (+20% Gemas)</span>
          </div>
        </article>

        {/* FASE DE HALVING */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--gold">
            <span className="summary-kpi-emoji">🪙</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">FASE DE HALVING</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-gold">FASE {marketState?.currentHalvingEra ?? 1} / 5</strong>
              <span className="summary-kpi-tag summary-kpi-tag--gold">100% RECOMPENSAS</span>
            </div>
            <span className="summary-kpi-sub">Tope actual: 500,000 PLANTS</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           3. MID GRID: FLUJO ECONÓMICO (65%) + FASES DE HALVING (35%)
           ===================================================== */}
      <section className="tokenomics-mid-grid">
        {/* FLUJO ECONÓMICO */}
        <article className="tokenomics-panel">
          <div className="tokenomics-panel-header">
            <span className="tokenomics-panel-icon">⚙️</span>
            <div>
              <h4 className="tokenomics-panel-title">FLUJO ECONÓMICO</h4>
              <p className="tokenomics-panel-sub">Un ciclo diseñado para crecer, recompensar y ser sostenible en el tiempo.</p>
            </div>
          </div>

          <div className="tokenomics-flow-nodes">
            {/* 1. USDT */}
            <div className="tokenomics-flow-card tokenomics-flow-card--usdt">
              <span className="tokenomics-node-icon">💵</span>
              <strong>USDT</strong>
              <p>Compra de gemas · Preventa</p>
            </div>
            <span className="tokenomics-flow-arrow">➔</span>

            {/* 2. GEMAS */}
            <div className="tokenomics-flow-card tokenomics-flow-card--gems">
              <span className="tokenomics-node-icon">💎</span>
              <strong>GEMAS</strong>
              <p>60% a Preventa · 70% a Liquidez AMM</p>
            </div>
            <span className="tokenomics-flow-arrow">➔</span>

            {/* 3. POOL DE LIQUIDEZ */}
            <div className="tokenomics-flow-card tokenomics-flow-card--pool">
              <span className="tokenomics-node-icon">🪙</span>
              <strong>POOL DE LIQUIDEZ</strong>
              <p>PLANTS / USDT · 100% respaldado en AMM</p>
            </div>
            <span className="tokenomics-flow-arrow">➔</span>

            {/* 4. PLANTS */}
            <div className="tokenomics-flow-card tokenomics-flow-card--plants">
              <span className="tokenomics-node-icon">🌱</span>
              <strong>PLANTS</strong>
              <p>Recompensas · Vesting (45d) · Uso en Arena 3+</p>
            </div>
            <span className="tokenomics-flow-arrow">➔</span>

            {/* 5. SWAP */}
            <div className="tokenomics-flow-card tokenomics-flow-card--swap">
              <span className="tokenomics-node-icon">🔄</span>
              <strong>SWAP / CASH-OUT</strong>
              <p>Intercambio en AMM · Uso en USDT</p>
            </div>
            <span className="tokenomics-flow-arrow">➔</span>

            {/* 6. BURN */}
            <div className="tokenomics-flow-card tokenomics-flow-card--burn">
              <span className="tokenomics-node-icon">🔥</span>
              <strong>BURN</strong>
              <p>Super Sink +20% Gemas · Reduce supply</p>
            </div>
          </div>
        </article>

        {/* FASES DE HALVING */}
        <article className="tokenomics-panel tokenomics-panel--halving">
          <div className="tokenomics-panel-header">
            <span className="tokenomics-panel-icon">🏆</span>
            <div>
              <h4 className="tokenomics-panel-title">FASES DE HALVING</h4>
              <p className="tokenomics-panel-sub">Las recompensas se reducen por fases para asegurar la escasez.</p>
            </div>
          </div>

          <div className="tokenomics-halving-list">
            <div className="tokenomics-halving-row tokenomics-halving-row--fase1">
              <span className="halving-badge">FASE 1</span>
              <span className="halving-range">0 - 500,000 PLANTS</span>
              <strong className="halving-pct text-green">100%</strong>
            </div>

            <div className="tokenomics-halving-row tokenomics-halving-row--fase2">
              <span className="halving-badge">FASE 2</span>
              <span className="halving-range">500,000 - 750,000 PLANTS</span>
              <strong className="halving-pct text-gold">50%</strong>
            </div>

            <div className="tokenomics-halving-row tokenomics-halving-row--fase3">
              <span className="halving-badge">FASE 3</span>
              <span className="halving-range">750,000 - 875,000 PLANTS</span>
              <strong className="halving-pct text-orange">25%</strong>
            </div>

            <div className="tokenomics-halving-row tokenomics-halving-row--fase4">
              <span className="halving-badge">FASE 4</span>
              <span className="halving-range">875,000 - 937,500 PLANTS</span>
              <strong className="halving-pct text-purple">12.5%</strong>
            </div>

            <div className="tokenomics-halving-row tokenomics-halving-row--fase5">
              <span className="halving-badge">FASE 5</span>
              <span className="halving-range">937,500 - 1,000,000 PLANTS</span>
              <strong className="halving-pct text-cyan">6.25%</strong>
            </div>
          </div>
        </article>
      </section>

      {/* =====================================================
           4. BOTTOM GRID: 3 PANELS (33% CADA UNO)
           ===================================================== */}
      <section className="tokenomics-bottom-grid">
        {/* FUENTES DEL POOL DE LIQUIDEZ */}
        <article className="tokenomics-card">
          <div className="tokenomics-card-header">
            <span className="tokenomics-card-icon">🪙</span>
            <div>
              <h5 className="tokenomics-card-title">FUENTES DEL POOL DE LIQUIDEZ</h5>
              <p className="tokenomics-card-sub">El pool se alimenta de múltiples fuentes del ecosistema.</p>
            </div>
          </div>

          <div className="tokenomics-sources-list">
            <div className="tokenomics-source-row">
              <div>
                <strong>60% Preventa</strong>
                <p>De las gemas gastadas en preventa</p>
              </div>
              <span className="source-tag source-tag--green">PRINCIPAL</span>
            </div>

            <div className="tokenomics-source-row">
              <div>
                <strong>70% Compras de gemas</strong>
                <p>De todas las compras en el juego</p>
              </div>
              <span className="source-tag source-tag--cyan">CONSTANTE</span>
            </div>

            <div className="tokenomics-source-row">
              <div>
                <strong>Fees del ecosistema</strong>
                <p>Comisiones de marketplace y acciones</p>
              </div>
              <span className="source-tag source-tag--blue">ADICIONAL</span>
            </div>

            <div className="tokenomics-source-row">
              <div>
                <strong>Super Sink (opcional)</strong>
                <p>Parte de gemas destinadas a quemas</p>
              </div>
              <span className="source-tag source-tag--orange">DEFLACIONARIO</span>
            </div>
          </div>
        </article>

        {/* DISTRIBUCIÓN Y UTILIDADES */}
        <article className="tokenomics-card">
          <div className="tokenomics-card-header">
            <span className="tokenomics-card-icon">⚙️</span>
            <div>
              <h5 className="tokenomics-card-title">DISTRIBUCIÓN Y UTILIDADES</h5>
              <p className="tokenomics-card-sub">PLANTS tiene múltiples utilidades dentro y fuera del juego.</p>
            </div>
          </div>

          <div className="tokenomics-utilities-grid">
            <div className="tokenomics-util-box">
              <span className="util-icon">⚔️</span>
              <div>
                <strong>Uso en Arena 3+</strong>
                <p>Recompensas en PLANTS por victorias y torneos</p>
              </div>
            </div>

            <div className="tokenomics-util-box">
              <span className="util-icon">🔒</span>
              <div>
                <strong>Vesting 45 días</strong>
                <p>PLANTS adquiridos sujetos a vesting por 45 días</p>
              </div>
            </div>

            <div className="tokenomics-util-box">
              <span className="util-icon">📈</span>
              <div>
                <strong>AMM Spot</strong>
                <p>Trading en tiempo real en el pool PLANTS / USDT</p>
              </div>
            </div>

            <div className="tokenomics-util-box">
              <span className="util-icon">🔥</span>
              <div>
                <strong>Super Sink</strong>
                <p>Quema de PLANTS con +20% de gemas inyectadas</p>
              </div>
            </div>
          </div>
        </article>

        {/* ESTADO DEL SUMINISTRO (DONUT CHART) */}
        <article className="tokenomics-card">
          <div className="tokenomics-card-header">
            <span className="tokenomics-card-icon">📊</span>
            <div>
              <h5 className="tokenomics-card-title">ESTADO DEL SUMINISTRO</h5>
              <p className="tokenomics-card-sub">Distribución actual del suministro total.</p>
            </div>
          </div>

          <div className="tokenomics-donut-container">
            {/* SVG Donut Chart */}
            <div className="tokenomics-donut-wrap">
              <svg viewBox="0 0 160 160" className="tokenomics-donut-svg">
                {/* Background Ring */}
                <circle cx="80" cy="80" r="60" fill="transparent" stroke="#061920" strokeWidth="22" />
                {/* 80% Recompensas (Gold) */}
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="transparent"
                  stroke="#facc15"
                  strokeWidth="22"
                  strokeDasharray="301.6 377"
                  strokeDashoffset="0"
                />
                {/* 15% Vesting (Purple) */}
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="transparent"
                  stroke="#a855f7"
                  strokeWidth="22"
                  strokeDasharray="56.5 377"
                  strokeDashoffset="-301.6"
                />
                {/* 5% Otros (Cyan) */}
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="transparent"
                  stroke="#38bdf8"
                  strokeWidth="22"
                  strokeDasharray="18.8 377"
                  strokeDashoffset="-358.1"
                />
              </svg>
              <div className="tokenomics-donut-center">
                <strong>1,000,000</strong>
                <small>PLANTS</small>
                <span>Total Supply</span>
              </div>
            </div>

            {/* Legend List */}
            <div className="tokenomics-legend-list">
              <div className="tokenomics-legend-item">
                <span className="legend-dot" style={{ background: '#38bdf8' }} />
                <span>En circulación</span>
                <strong>0% · 0</strong>
              </div>
              <div className="tokenomics-legend-item">
                <span className="legend-dot" style={{ background: '#facc15' }} />
                <span>Recompensas</span>
                <strong>80% · 800,000</strong>
              </div>
              <div className="tokenomics-legend-item">
                <span className="legend-dot" style={{ background: '#a855f7' }} />
                <span>Vesting</span>
                <strong>15% · 150,000</strong>
              </div>
              <div className="tokenomics-legend-item">
                <span className="legend-dot" style={{ background: '#ef4444' }} />
                <span>Quemados</span>
                <strong>0% · 0</strong>
              </div>
              <div className="tokenomics-legend-item">
                <span className="legend-dot" style={{ background: '#94a3b8' }} />
                <span>Otros</span>
                <strong>5% · 50,000</strong>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
