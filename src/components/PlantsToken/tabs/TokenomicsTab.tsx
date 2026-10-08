import React, { useState, useEffect } from 'react'
import { soundManager } from '../../../utils/audioManager'
import type { TokenHubSharedProps } from '../types'
import {
  plantsTokenService,
  type PlantsTopHoldersData,
  type PlantsMintingEvent,
} from '../../../services/plantsTokenService'
import { TokenHoldersModal } from '../modals/TokenHoldersModal'
import { TokenMintingHistoryModal } from '../modals/TokenMintingHistoryModal'
import { getPlayerAvatarUrl } from '../../../utils/userManager'

export const TokenomicsTab: React.FC<TokenHubSharedProps> = ({
  spotPrice,
  poolUsdt,
  totalBurned,
  marketState,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'holders' | 'minting'>('holders')
  const [isHoldersModalOpen, setIsHoldersModalOpen] = useState(false)
  const [isMintingModalOpen, setIsMintingModalOpen] = useState(false)

  // Datos reales desde la base de datos
  const [holdersData, setHoldersData] = useState<PlantsTopHoldersData | null>(null)
  const [mintingEvents, setMintingEvents] = useState<PlantsMintingEvent[]>([])

  useEffect(() => {
    let isMounted = true

    Promise.all([plantsTokenService.getTopHolders(10), plantsTokenService.getMintingHistory(10)])
      .then(([holders, events]) => {
        if (isMounted) {
          if (holders) setHoldersData(holders)
          if (events) setMintingEvents(events)
        }
      })
      .catch((err) => {
        console.warn('Error loading tokenomics real data:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleOpenHolders = () => {
    soundManager.playSound('click', 0.5)
    setIsHoldersModalOpen(true)
  }

  const handleOpenMinting = () => {
    soundManager.playSound('click', 0.5)
    setIsMintingModalOpen(true)
  }

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
            <span className="summary-kpi-sub">Suministro total definitivo (Deflacionario)</span>
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
            <span className="summary-kpi-sub">
              {spotPrice > 0 ? `${Math.round(1 / spotPrice).toLocaleString()} PLANTS = $1.00 USDT` : '5,000 PLANTS = $1.00 USDT'}
            </span>
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
            <p className="tokenomics-panel-sub">
              Circulación sostenible y respaldada: cada token generado proviene del juego limpio o preventa, con quema permanente de salidas.
            </p>
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
            <p>Recompensas Ranked PvP & Vesting 45d</p>
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
        {/* LEFT: SECCIÓN DE HOLDERS Y DISTRIBUCIÓN REAL */}
        <article className="tokenomics-card">
          <div className="tokenomics-card-header-tabs">
            <div className="tokenomics-header-left">
              <span className="tokenomics-card-icon">👥</span>
              <h5 className="tokenomics-card-title">DISTRIBUCIÓN Y AUDITORÍA REAL</h5>
            </div>
            <div className="tokenomics-subtab-pills">
              <button
                type="button"
                className={`tokenomics-subtab-pill ${activeSubTab === 'holders' ? 'active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setActiveSubTab('holders')
                }}
              >
                Top Holders
              </button>
              <button
                type="button"
                className={`tokenomics-subtab-pill ${activeSubTab === 'minting' ? 'active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setActiveSubTab('minting')
                }}
              >
                Historial de Minteo
              </button>
            </div>
          </div>

          {activeSubTab === 'holders' ? (
            <div className="tokenomics-holders-view">
              <div className="tokenomics-donut-row">
                {/* SVG Donut con distribución REAL 1M (Sin staking pool) */}
                <div className="tokenomics-donut-mini-wrap">
                  <svg viewBox="0 0 140 140" className="tokenomics-donut-svg">
                    <circle cx="70" cy="70" r="50" fill="transparent" stroke="#061920" strokeWidth="18" />
                    {/* 50% Bóveda Recompensas PvP (Gold #facc15): 157.08 de 314.16 */}
                    <circle
                      cx="70"
                      cy="70"
                      r="50"
                      fill="transparent"
                      stroke="#facc15"
                      strokeWidth="18"
                      strokeDasharray="157.08 314.16"
                      strokeDashoffset="0"
                    />
                    {/* 37% Reserva AMM & Respaldo (Cyan #38bdf8): 116.24 de 314.16 */}
                    <circle
                      cx="70"
                      cy="70"
                      r="50"
                      fill="transparent"
                      stroke="#38bdf8"
                      strokeWidth="18"
                      strokeDasharray="116.24 314.16"
                      strokeDashoffset="-157.08"
                    />
                    {/* 13% Asignación Preventa Fundadores (Purple #a855f7): 40.84 de 314.16 */}
                    <circle
                      cx="70"
                      cy="70"
                      r="50"
                      fill="transparent"
                      stroke="#a855f7"
                      strokeWidth="18"
                      strokeDasharray="40.84 314.16"
                      strokeDashoffset="-273.32"
                    />
                  </svg>
                  <div className="tokenomics-donut-mini-center">
                    <strong>1M</strong>
                    <small>PLANTS</small>
                  </div>
                </div>

                {/* Tabla de Top Holders / Bóvedas reales */}
                <div className="tokenomics-holders-table-wrap">
                  <div className="tokenomics-holder-row">
                    <span className="holder-rank">#1</span>
                    <div className="holder-info">
                      <strong>Bóveda Recompensas PvP & Halving</strong>
                      <small>0x12b8...4a29 · Minteo por victorias competitivas</small>
                    </div>
                    <span className="holder-amount text-gold font-bold">500,000 PLANTS (50.0%)</span>
                  </div>

                  <div className="tokenomics-holder-row">
                    <span className="holder-rank">#2</span>
                    <div className="holder-info">
                      <strong>Reserva de Liquidez AMM (Contrato Público)</strong>
                      <small>0x7f3a...91e4 · Respaldo 100% USDT P = R / V</small>
                    </div>
                    <span className="holder-amount text-cyan font-bold">370,000 PLANTS (37.0%)</span>
                  </div>

                  <div className="tokenomics-holder-row">
                    <span className="holder-rank">#3</span>
                    <div className="holder-info">
                      <strong>Asignación Preventa Fundadores</strong>
                      <small>0x48e2...bc71 · Vesting lineal 45 días (20 Packs)</small>
                    </div>
                    <span className="holder-amount text-purple font-bold">130,000 PLANTS (13.0%)</span>
                  </div>

                  {/* Fila del jugador o primer holder real si existe */}
                  {holdersData && holdersData.holders.length > 0 ? (
                    <div className="tokenomics-holder-row tokenomics-holder-row--player">
                      <span className="holder-rank">#4</span>
                      <div className="holder-info" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img
                          src={getPlayerAvatarUrl(holdersData.holders[0].avatar)}
                          alt={holdersData.holders[0].username}
                          style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.src = '/game-assets/greenfoot/peashooterpacket1.webp'
                          }}
                        />
                        <div>
                          <strong>Top Jugador: {holdersData.holders[0].username}</strong>
                          <small>🏆 {holdersData.holders[0].eloRating} ELO · Billetera Verificada</small>
                        </div>
                      </div>
                      <span className="holder-amount text-mint font-bold">
                        {holdersData.holders[0].totalPlants.toLocaleString()} PLANTS
                      </span>
                    </div>
                  ) : (
                    <div className="tokenomics-holder-row tokenomics-holder-row--empty">
                      <span className="holder-rank">#4</span>
                      <div className="holder-info">
                        <strong>Salón de Jugadores Gladiadores</strong>
                        <small>Gana en Arena 3+ o adquiere un pack para reclamar el puesto</small>
                      </div>
                      <span className="holder-amount text-muted">0 Jugadores activos</span>
                    </div>
                  )}

                  {/* Botón directo para abrir modal de pantalla completa */}
                  <div className="tokenomics-modal-open-row">
                    <button
                      type="button"
                      className="tokenomics-open-modal-btn"
                      onClick={handleOpenHolders}
                    >
                      🔍 ABRIR PANTALLA COMPLETA DE TOP HOLDERS ➔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW HISTORIAL DE MINTEO */
            <div className="tokenomics-minting-preview-wrap">
              <div className="tokenomics-minting-table-wrap">
                {mintingEvents.length === 0 ? (
                  <div className="mint-event-row">
                    <span className="mint-block-badge">GÉNESIS</span>
                    <div className="mint-event-info">
                      <strong>Emisión Génesis de Reserva AMM</strong>
                      <small>Semilla inicial del contrato autorizado</small>
                    </div>
                    <strong className="mint-amount text-green">+200 USDT / 1M PLANTS</strong>
                    <span className="mint-time">07/10/2026</span>
                  </div>
                ) : (
                  mintingEvents.slice(0, 4).map((evt) => {
                    const isPos = evt.deltaPlants > 0
                    const isNeg = evt.deltaPlants < 0
                    return (
                      <div key={evt.id} className="mint-event-row">
                        <span
                          className={`mint-block-badge ${
                            isNeg ? 'mint-block-badge--burn' : evt.eventType === 'pvp_reward' ? 'mint-block-badge--pvp' : ''
                          }`}
                        >
                          #{String(evt.id).padStart(3, '0')}
                        </span>
                        <div className="mint-event-info">
                          <strong>
                            {evt.eventType === 'pvp_reward'
                              ? `Victoria PvP: ${evt.username}`
                              : evt.eventType === 'presale_pack'
                              ? `Pack Preventa: ${evt.username}`
                              : evt.eventType === 'swap_gems'
                              ? `Super Sink Canje a Gemas: ${evt.username}`
                              : evt.eventType === 'cashout'
                              ? `Retiro USDT: ${evt.username}`
                              : `Emisión Génesis AMM`}
                          </strong>
                          <small>
                            Spot: ${evt.spotPrice.toFixed(6)} · Pool: ${evt.usdtPool.toFixed(2)} USDT
                          </small>
                        </div>
                        <strong className={`mint-amount ${isPos ? 'text-green' : isNeg ? 'text-orange' : 'text-cyan'}`}>
                          {isPos ? `+${evt.deltaPlants.toLocaleString()}` : evt.deltaPlants.toLocaleString()} PLANTS
                        </strong>
                        <span className="mint-time">
                          {new Date(evt.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Botón directo para abrir modal de auditoría de minteo */}
              <div className="tokenomics-modal-open-row">
                <button
                  type="button"
                  className="tokenomics-open-modal-btn tokenomics-open-modal-btn--mint"
                  onClick={handleOpenMinting}
                >
                  📜 ABRIR AUDITORÍA COMPLETA DE MINTEO Y QUEMAS ➔
                </button>
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
              <p className="tokenomics-card-sub">
                Reducción programada de emisiones para impulsar la escasez del token en 5 eras de 100k a 500k.
              </p>
            </div>
          </div>

          <div className="tokenomics-halving-compact-list">
            <div className="tokenomics-halving-row tokenomics-halving-row--fase1">
              <span className="halving-badge">FASE 1 (ACTIVA)</span>
              <span className="halving-range">0 - 500k PLANTS</span>
              <strong className="halving-pct text-green">100% RECOMPENSAS (2-6 PLANTS/WIN)</strong>
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
              <strong className="halving-pct text-cyan">12.5% a 6.25% Máxima Escasez</strong>
            </div>
          </div>

          <div className="tokenomics-liquidity-compact-footer">
            <div className="source-mini-tag">
              <span>💧 60% Preventas al Pool</span>
            </div>
            <div className="source-mini-tag">
              <span>💎 70% Gemas Inyectadas</span>
            </div>
            <div className="source-mini-tag">
              <span>🛡️ 100% Solvencia en USDT</span>
            </div>
          </div>
        </article>
      </section>

      {/* MODAL 1: TOP HOLDERS EN PANTALLA COMPLETA */}
      <TokenHoldersModal
        isOpen={isHoldersModalOpen}
        onClose={() => setIsHoldersModalOpen(false)}
      />

      {/* MODAL 2: HISTORIAL Y AUDITORÍA DE MINTEO EN PANTALLA COMPLETA */}
      <TokenMintingHistoryModal
        isOpen={isMintingModalOpen}
        onClose={() => setIsMintingModalOpen(false)}
      />
    </div>
  )
}
