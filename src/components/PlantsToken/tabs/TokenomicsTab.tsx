import React, { useState } from 'react'
import type { TokenHubSharedProps } from '../types'

export const TokenomicsTab: React.FC<TokenHubSharedProps> = ({
  spotPrice,
  poolUsdt,
  totalBurned,
  marketState,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'holders' | 'minting'>('holders')

  return (
    <div className="token-tokenomics-screen">
      {/* =====================================================
           1. KPI ROW (5 CARDS)
           ===================================================== */}
      <section className="summary-kpi-grid tokenomics-kpi-grid">
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
            <span className="summary-kpi-sub">Suministro total definitivo</span>
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
            <span className="summary-kpi-sub">60% Preventas + 70% Gemas</span>
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
           2. CHART DEL FLUJO DEL TOKEN (CENTRADO)
           ===================================================== */}
      <section className="tokenomics-flow-centered-panel">
        <div className="tokenomics-flow-centered-header">
          <span className="tokenomics-panel-icon">⚙️</span>
          <div>
            <h4 className="tokenomics-panel-title">CICLO DEL FLUJO ECONÓMICO DEL TOKEN PLANTS</h4>
            <p className="tokenomics-panel-sub">Circulación cerrada y sostenible: cada token generado está respaldado por reservas reales o quemado de forma deflacionaria.</p>
          </div>
        </div>

        <div className="tokenomics-flow-nodes-grid">
          {/* 1. USDT */}
          <div className="tokenomics-flow-card tokenomics-flow-card--usdt">
            <span className="tokenomics-node-icon">💵</span>
            <strong>1. USDT ENTRADA</strong>
            <p>Depósitos y Preventa Génesis</p>
          </div>
          <span className="tokenomics-flow-arrow">➔</span>

          {/* 2. GEMAS */}
          <div className="tokenomics-flow-card tokenomics-flow-card--gems">
            <span className="tokenomics-node-icon">💎</span>
            <strong>2. GEMAS RESPALDO</strong>
            <p>60% Preventas · 70% Gemas al Pool</p>
          </div>
          <span className="tokenomics-flow-arrow">➔</span>

          {/* 3. POOL DE LIQUIDEZ */}
          <div className="tokenomics-flow-card tokenomics-flow-card--pool">
            <span className="tokenomics-node-icon">🪙</span>
            <strong>3. POOL LIQUIDEZ</strong>
            <p>Reserva AMM P = R / V (100% Seguro)</p>
          </div>
          <span className="tokenomics-flow-arrow">➔</span>

          {/* 4. PLANTS */}
          <div className="tokenomics-flow-card tokenomics-flow-card--plants">
            <span className="tokenomics-node-icon">🌱</span>
            <strong>4. TOKEN PLANTS</strong>
            <p>Recompensas Ranked & Vesting 45d</p>
          </div>
          <span className="tokenomics-flow-arrow">➔</span>

          {/* 5. SWAP */}
          <div className="tokenomics-flow-card tokenomics-flow-card--swap">
            <span className="tokenomics-node-icon">🔄</span>
            <strong>5. SWAP & CASHOUT</strong>
            <p>Retiro BEP-20 (Arena 3+ 2001+ copas)</p>
          </div>
          <span className="tokenomics-flow-arrow">➔</span>

          {/* 6. BURN */}
          <div className="tokenomics-flow-card tokenomics-flow-card--burn">
            <span className="tokenomics-node-icon">🔥</span>
            <strong>6. QUEMA TOTAL</strong>
            <p>Super Sink (+20% Gemas) Deflacionario</p>
          </div>
        </div>
      </section>

      {/* =====================================================
           3. DUAL SECTION: HOLDERS & MINTING HISTORY + HALVING
           ===================================================== */}
      <section className="tokenomics-holders-minting-grid">
        {/* LEFT: SECCIÓN DE HOLDERS Y DISTRIBUCIÓN */}
        <article className="tokenomics-card">
          <div className="tokenomics-card-header-tabs">
            <div className="tokenomics-header-left">
              <span className="tokenomics-card-icon">👥</span>
              <h5 className="tokenomics-card-title">SECCIÓN DE HOLDERS & DISTRIBUCIÓN</h5>
            </div>
            <div className="tokenomics-subtab-pills">
              <button
                type="button"
                className={`tokenomics-subtab-pill ${activeSubTab === 'holders' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('holders')}
              >
                Top Holders
              </button>
              <button
                type="button"
                className={`tokenomics-subtab-pill ${activeSubTab === 'minting' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('minting')}
              >
                Historial de Minteo
              </button>
            </div>
          </div>

          {activeSubTab === 'holders' ? (
            <div className="tokenomics-holders-view">
              <div className="tokenomics-donut-row">
                {/* SVG Donut */}
                <div className="tokenomics-donut-mini-wrap">
                  <svg viewBox="0 0 140 140" className="tokenomics-donut-svg">
                    <circle cx="70" cy="70" r="50" fill="transparent" stroke="#061920" strokeWidth="18" />
                    {/* 40% Pool AMM (Mint) */}
                    <circle cx="70" cy="70" r="50" fill="transparent" stroke="#20dba4" strokeWidth="18" strokeDasharray="125.6 314" strokeDashoffset="0" />
                    {/* 35% Recompensas (Gold) */}
                    <circle cx="70" cy="70" r="50" fill="transparent" stroke="#facc15" strokeWidth="18" strokeDasharray="109.9 314" strokeDashoffset="-125.6" />
                    {/* 15% Preventa (Purple) */}
                    <circle cx="70" cy="70" r="50" fill="transparent" stroke="#a855f7" strokeWidth="18" strokeDasharray="47.1 314" strokeDashoffset="-235.5" />
                    {/* 10% Staking (Cyan) */}
                    <circle cx="70" cy="70" r="50" fill="transparent" stroke="#38bdf8" strokeWidth="18" strokeDasharray="31.4 314" strokeDashoffset="-282.6" />
                  </svg>
                  <div className="tokenomics-donut-mini-center">
                    <strong>1M</strong>
                    <small>PLANTS</small>
                  </div>
                </div>

                {/* Table of Top Holders */}
                <div className="tokenomics-holders-table-wrap">
                  <div className="tokenomics-holder-row">
                    <span className="holder-rank">#1</span>
                    <div className="holder-info">
                      <strong>Pool Reserva AMM (Contrato Público)</strong>
                      <small>0x7f3a...91e4 · Liquidez respaldada</small>
                    </div>
                    <span className="holder-amount text-mint">400,000 PLANTS (40.0%)</span>
                  </div>

                  <div className="tokenomics-holder-row">
                    <span className="holder-rank">#2</span>
                    <div className="holder-info">
                      <strong>Bóveda de Recompensas Ranked PvP</strong>
                      <small>0x12b8...4a29 · Coliseo y Torneos</small>
                    </div>
                    <span className="holder-amount text-gold">350,000 PLANTS (35.0%)</span>
                  </div>

                  <div className="tokenomics-holder-row">
                    <span className="holder-rank">#3</span>
                    <div className="holder-info">
                      <strong>Contrato Vesting Preventa Fundadores</strong>
                      <small>0x48e2...bc71 · Bloqueo 45 Días Lineal</small>
                    </div>
                    <span className="holder-amount text-purple">150,000 PLANTS (15.0%)</span>
                  </div>

                  <div className="tokenomics-holder-row">
                    <span className="holder-rank">#4</span>
                    <div className="holder-info">
                      <strong>Staking Pool & Fondo Comunitario</strong>
                      <small>0x99f0...3d82 · Recompensas de Bloque</small>
                    </div>
                    <span className="holder-amount text-cyan">100,000 PLANTS (10.0%)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* HISTORIAL DE MINTEO */
            <div className="tokenomics-minting-table-wrap">
              <div className="mint-event-row">
                <span className="mint-block-badge">BLOQUE #001</span>
                <div className="mint-event-info">
                  <strong>Emisión Génesis de Reserva AMM</strong>
                  <small>Génesis Pool Inicial · Contrato Autorizado</small>
                </div>
                <strong className="mint-amount text-green">+200,000 PLANTS</strong>
                <span className="mint-time">01/10/2026</span>
              </div>

              <div className="mint-event-row">
                <span className="mint-block-badge">BLOQUE #002</span>
                <div className="mint-event-info">
                  <strong>Pack Fundador Pionero #01</strong>
                  <small>Vesting Lineal 45 Días asignado</small>
                </div>
                <strong className="mint-amount text-cyan">+50,000 PLANTS</strong>
                <span className="mint-time">03/10/2026</span>
              </div>

              <div className="mint-event-row">
                <span className="mint-block-badge">BLOQUE #003</span>
                <div className="mint-event-info">
                  <strong>Pack Fundador Campeón #01</strong>
                  <small>Vesting Lineal 45 Días asignado</small>
                </div>
                <strong className="mint-amount text-purple">+125,000 PLANTS</strong>
                <span className="mint-time">05/10/2026</span>
              </div>

              <div className="mint-event-row">
                <span className="mint-block-badge mint-block-badge--burn">QUEMA #001</span>
                <div className="mint-event-info">
                  <strong>Super Sink Canje a Gemas</strong>
                  <small>Incineración permanente con +20% bono</small>
                </div>
                <strong className="mint-amount text-orange">-10,000 PLANTS 🔥</strong>
                <span className="mint-time">07/10/2026</span>
              </div>
            </div>
          )}
        </article>

        {/* RIGHT: HALVING & FUENTES DE LIQUIDEZ */}
        <article className="tokenomics-card">
          <div className="tokenomics-card-header">
            <span className="tokenomics-card-icon">🏆</span>
            <div>
              <h5 className="tokenomics-card-title">FASES DE HALVING & FUENTES</h5>
              <p className="tokenomics-card-sub">Reducción programada de emisiones para impulsar la escasez del token.</p>
            </div>
          </div>

          <div className="tokenomics-halving-compact-list">
            <div className="tokenomics-halving-row tokenomics-halving-row--fase1">
              <span className="halving-badge">FASE 1 (ACTIVA)</span>
              <span className="halving-range">0 - 500k PLANTS</span>
              <strong className="halving-pct text-green">100% RECOMPENSAS</strong>
            </div>

            <div className="tokenomics-halving-row">
              <span className="halving-badge">FASE 2</span>
              <span className="halving-range">500k - 750k PLANTS</span>
              <strong className="halving-pct text-gold">50% (-50% Halving)</strong>
            </div>

            <div className="tokenomics-halving-row">
              <span className="halving-badge">FASE 3</span>
              <span className="halving-range">750k - 875k PLANTS</span>
              <strong className="halving-pct text-orange">25% (-75% Halving)</strong>
            </div>

            <div className="tokenomics-halving-row">
              <span className="halving-badge">FASE 4 - 5</span>
              <span className="halving-range">875k - 1,000,000 PLANTS</span>
              <strong className="halving-pct text-cyan">12.5% a 6.25%</strong>
            </div>
          </div>

          <div className="tokenomics-liquidity-compact-footer">
            <div className="source-mini-tag">
              <span>💧 60% Preventas</span>
            </div>
            <div className="source-mini-tag">
              <span>💎 70% Gemas Inyectadas</span>
            </div>
            <div className="source-mini-tag">
              <span>🛡️ 100% Solvencia USDT</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
