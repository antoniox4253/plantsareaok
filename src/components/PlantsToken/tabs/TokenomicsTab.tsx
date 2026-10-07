import React from 'react'
import type { TokenHubSharedProps } from '../types'
import { TOKEN_ASSETS } from '../tokenAssets'

export const TokenomicsTab: React.FC<TokenHubSharedProps> = ({
  marketState,
  spotPrice,
  poolUsdt,
  totalBurned,
  circulating,
  virtualPlants,
}) => {
  const currentEra = marketState?.currentHalvingEra ?? 1

  return (
    <div className="tokenomics-screen">
      {/* =====================================================
           TOKENOMICS HERO BANNER
           ===================================================== */}
      <section
        className="tokenomics-hero"
        data-section="tokenomics-hero"
        data-label="TOKENOMICS HERO"
        style={
          TOKEN_ASSETS.tokenomicsHeroBanner
            ? { backgroundImage: `url(${TOKEN_ASSETS.tokenomicsHeroBanner})`, backgroundSize: 'cover' }
            : {}
        }
      >
        <div className="tokenomics-hero__content">
          <div className="tokenomics-hero__tag">📊 MODELO ECONÓMICO FINITO, RESGUARDADO & DEFLACIONARIO</div>
          <h1 className="tokenomics-hero__title">ARQUITECTURA DE VALOR, HALVINGS & QUEMAS</h1>
          <p className="tokenomics-hero__desc">
            Suministro tope inmutable de <strong>1,000,000 PLANTS</strong>. El ecosistema fue diseñado con una política monetaria transparente basada en: <strong>Halving cuatripartito</strong> para frenar la inflación, <strong>respaldo en USDT real</strong> mediante inyecciones del 60% de preventas y 70% de compras en tienda, y <strong>mecanismos perpetuos de quema</strong> que reducen el circulante activo.
          </p>

          <div className="tokenomics-hero__chips" style={{ marginBottom: '6px' }}>
            <span className="hero-chip">🔒 Tope Máximo Cerrado: 1,000,000 PLANTS</span>
            <span className="hero-chip">📉 5 Eras de Halving Programadas</span>
            <span className="hero-chip">🏦 Respaldo Permanente en Bóveda USDT</span>
            <span className="hero-chip">🔥 Reducción Progresiva del Suministro Circulante</span>
          </div>
        </div>
      </section>

      {/* =====================================================
           TOKENOMICS KPIs ROW
           ===================================================== */}
      <section className="kpi-grid" data-section="tokenomics-kpi-row" data-label="TOKENOMICS KPIs">
        <article className="kpi-card" data-section="kpi-max-supply" data-label="MAX SUPPLY">
          <div className="kpi-icon-slot">🔒</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">SUMINISTRO MÁXIMO</span>
            <strong className="kpi-value text-gold">1,000,000 PLANTS</strong>
            <span className="kpi-sub">Circulante: {circulating.toLocaleString()} PLANTS</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-spot-price" data-label="SPOT PRICE">
          <div className="kpi-icon-slot">💎</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">PRECIO SPOT AMM</span>
            <strong className="kpi-value">${spotPrice.toFixed(6)} USDT</strong>
            <span className="kpi-sub">AMM (V: {virtualPlants.toLocaleString()} vPLANTS)</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-liquidity" data-label="LIQUIDITY">
          <div className="kpi-icon-slot">🏦</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">RESPALDO LIQUIDEZ</span>
            <strong className="kpi-value text-green">${poolUsdt.toFixed(2)} USDT</strong>
            <span className="kpi-sub">Reserva real en tesorería</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-burned" data-label="BURNED">
          <div className="kpi-icon-slot">🔥</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">TOTAL QUEMADOS</span>
            <strong className="kpi-value text-orange">{totalBurned.toLocaleString()} PLANTS</strong>
            <span className="kpi-sub">Incinerados de por vida</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-halving-phase" data-label="HALVING PHASE">
          <div className="kpi-icon-slot">⏳</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">FASE DE HALVING</span>
            <strong className="kpi-value text-cyan">ERA {currentEra} / 5</strong>
            <span className="kpi-sub">100% Recompensas de Minado</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           MAIN ROW: ECONOMIC FLOW + HALVING PHASES
           ===================================================== */}
      <section className="main-grid">
        {/* Economic Flow Panel */}
        <article className="economy-panel" data-section="economic-flow" data-label="ECONOMIC FLOW">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">CICLO ECONÓMICO CIRCULAR CERRADO</h4>
            <span className="panel-heading-badge text-cyan">6 FASES CLAVE</span>
          </div>

          <div className="flow-grid">
            <div className="flow-card" data-section="flow-usdt">
              <div className="flow-icon-slot">💵</div>
              <div className="flow-title-slot">
                <strong>1. Depósitos USDT</strong>
              </div>
              <div className="flow-copy-slot">
                <p>Compras de packs de preventa y paquetes de tienda inyectan capital externo.</p>
              </div>
            </div>

            <div className="flow-card" data-section="flow-gems">
              <div className="flow-icon-slot">💎</div>
              <div className="flow-title-slot">
                <strong>2. Consumo de Gemas</strong>
              </div>
              <div className="flow-copy-slot">
                <p>Utilidad masiva en pases, mejoras de jardín, sobres y desbloqueos.</p>
              </div>
            </div>

            <div className="flow-card" data-section="flow-liquidity-pool">
              <div className="flow-icon-slot">🏦</div>
              <div className="flow-title-slot">
                <strong>3. Pool de Liquidez</strong>
              </div>
              <div className="flow-copy-slot">
                <p>El 60% de preventas y el 70% de compras van al pool público respaldando el AMM.</p>
              </div>
            </div>

            <div className="flow-card" data-section="flow-plants">
              <div className="flow-icon-slot">🌱</div>
              <div className="flow-title-slot">
                <strong>4. Minado en Batalla</strong>
              </div>
              <div className="flow-copy-slot">
                <p>Los gladiadores ganan PLANTS en el Coliseo y Arena con vesting de 45 días.</p>
              </div>
            </div>

            <div className="flow-card" data-section="flow-swap">
              <div className="flow-icon-slot">🔄</div>
              <div className="flow-title-slot">
                <strong>5. Mercado AMM</strong>
              </div>
              <div className="flow-copy-slot">
                <p>Intercambio directo por USDT en BEP-20 (Arena 3+) o canje con +20% en Gemas.</p>
              </div>
            </div>

            <div className="flow-card" data-section="flow-burn">
              <div className="flow-icon-slot">🔥</div>
              <div className="flow-title-slot">
                <strong>6. Quema Deflacionaria</strong>
              </div>
              <div className="flow-copy-slot">
                <p>El Super Sink y las comisiones de retiro queman tokens aumentando el precio de los restantes.</p>
              </div>
            </div>
          </div>
        </article>

        {/* Halving Phases Panel */}
        <aside className="halving-panel" data-section="halving-phases" data-label="HALVING PHASES">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">PROGRAMA DE HALVINGS</h4>
            <span className="panel-heading-badge text-gold">5 ERAS</span>
          </div>

          <div className="halving-list">
            <div className={`halving-row ${currentEra === 1 ? 'active' : ''}`}>
              <div className="halving-cell font-bold text-green">ERA 1 (Actual)</div>
              <div className="halving-cell">0 a 200,000 PLANTS</div>
              <div className="halving-cell text-green">100% REW</div>
            </div>

            <div className={`halving-row ${currentEra === 2 ? 'active' : ''}`}>
              <div className="halving-cell font-bold text-gold">ERA 2</div>
              <div className="halving-cell">200,001 a 400,000 PLANTS</div>
              <div className="halving-cell text-gold">50% REW</div>
            </div>

            <div className={`halving-row ${currentEra === 3 ? 'active' : ''}`}>
              <div className="halving-cell font-bold text-orange">ERA 3</div>
              <div className="halving-cell">400,001 a 600,000 PLANTS</div>
              <div className="halving-cell text-orange">25% REW</div>
            </div>

            <div className={`halving-row ${currentEra === 4 ? 'active' : ''}`}>
              <div className="halving-cell font-bold text-purple">ERA 4</div>
              <div className="halving-cell">600,001 a 800,000 PLANTS</div>
              <div className="halving-cell text-purple">12.5% REW</div>
            </div>

            <div className={`halving-row ${currentEra === 5 ? 'active' : ''}`}>
              <div className="halving-cell font-bold text-cyan">ERA 5</div>
              <div className="halving-cell">800,001 a 1,000,000 PLANTS</div>
              <div className="halving-cell text-cyan">6.25% REW</div>
            </div>
          </div>
        </aside>
      </section>

      {/* =====================================================
           BOTTOM ROW: POOL SOURCES + UTILITY + SUPPLY STATUS
           ===================================================== */}
      <section className="bottom-grid">
        {/* Pool Sources Panel */}
        <article className="pool-panel" data-section="pool-sources" data-label="POOL SOURCES">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">FUENTES DE INYECCIÓN AL POOL</h4>
            <span className="panel-heading-badge text-green">RESPALDO USDT</span>
          </div>

          <div className="pool-list">
            <div className="pool-row">
              <div className="pool-icon-slot">🛒</div>
              <div className="pool-copy-slot">
                <strong>Preventas Génesis</strong>
                <small>60% de cada pack va directo a reserva</small>
              </div>
              <div className="pool-tag-slot text-green">+60% USDT</div>
            </div>

            <div className="pool-row">
              <div className="pool-icon-slot">💎</div>
              <div className="pool-copy-slot">
                <strong>Tienda de Gemas In-Game</strong>
                <small>70% de compras de jugadores en tienda</small>
              </div>
              <div className="pool-tag-slot text-green">+70% USDT</div>
            </div>

            <div className="pool-row">
              <div className="pool-icon-slot">⚖️</div>
              <div className="pool-copy-slot">
                <strong>Tarifas de Protocolo</strong>
                <small>5% de retiros a BEP-20 quemado al 100%</small>
              </div>
              <div className="pool-tag-slot text-cyan">100% Quema</div>
            </div>
          </div>
        </article>

        {/* Game Utility Panel */}
        <article className="utility-panel" data-section="game-utility" data-label="GAME UTILITY">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">UTILIDAD REAL EN EL JUEGO</h4>
            <span className="panel-heading-badge text-gold">DEMANDA CONTINUA</span>
          </div>

          <div className="utility-grid">
            <div className="utility-card">
              <div className="utility-icon-slot">📦</div>
              <div className="utility-copy-slot">
                <strong>Packs Exclusivos</strong>
                <small>Acceso prioritario a cartas élite</small>
              </div>
            </div>

            <div className="utility-card">
              <div className="utility-icon-slot">⚡</div>
              <div className="utility-copy-slot">
                <strong>Fusiones Míticas</strong>
                <small>Descuentos y aumentos de atributos</small>
              </div>
            </div>

            <div className="utility-card">
              <div className="utility-icon-slot">🥊</div>
              <div className="utility-copy-slot">
                <strong>Skins Equipables</strong>
                <small>Cinturones y cosméticos con bonos</small>
              </div>
            </div>

            <div className="utility-card">
              <div className="utility-icon-slot">🏆</div>
              <div className="utility-copy-slot">
                <strong>Torneos Ranked</strong>
                <small>Entrada a copas con premios en USDT</small>
              </div>
            </div>
          </div>
        </article>

        {/* Supply Status Panel */}
        <article className="supply-panel" data-section="supply-status" data-label="SUPPLY STATUS">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">DISTRIBUCIÓN DEL SUMINISTRO TOTAL</h4>
            <span className="panel-heading-badge text-purple">1,000,000 TOKENS</span>
          </div>

          <div className="supply-layout">
            <div className="donut-slot" data-slot="supply-donut">
              <div className="donut-center">
                <strong>1,000,000</strong>
                <small>PLANTS</small>
              </div>
            </div>

            <div className="supply-list">
              <div className="supply-row">
                <span className="supply-dot" style={{ background: '#1b8ac1' }} />
                <span>Recompensas PvP & Coliseo Ranked</span>
                <strong>40%</strong>
                <small>400k</small>
              </div>

              <div className="supply-row">
                <span className="supply-dot" style={{ background: '#f1c434' }} />
                <span>Preventa Génesis & Liquidez AMM</span>
                <strong>30%</strong>
                <small>300k</small>
              </div>

              <div className="supply-row">
                <span className="supply-dot" style={{ background: '#9a4fe9' }} />
                <span>Torneos, Eventos & Guerras de Clan</span>
                <strong>15%</strong>
                <small>150k</small>
              </div>

              <div className="supply-row">
                <span className="supply-dot" style={{ background: '#19d99c' }} />
                <span>Bóveda de Reserva Estratégica</span>
                <strong>15%</strong>
                <small>150k</small>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
