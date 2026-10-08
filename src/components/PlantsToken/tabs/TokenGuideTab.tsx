import React from 'react'
import type { TokenHubSharedProps } from '../types'

export const TokenGuideTab: React.FC<TokenHubSharedProps> = ({ onTabChange }) => {
  return (
    <div className="token-guide-screen">
      {/* =====================================================
           1. MINI KPI REGLAS CLAVE (4 CARDS)
           ===================================================== */}
      <section className="guide-kpi-grid">
        <article className="summary-kpi-card guide-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--gold">
            <span className="summary-kpi-emoji">🏆</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">REQUISITO CASHOUT</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-gold">ARENA 3 (2,001+)</strong>
            </div>
            <span className="summary-kpi-sub">Solo gladiadores reales</span>
          </div>
        </article>

        <article className="summary-kpi-card guide-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--mint">
            <span className="summary-kpi-emoji">⏳</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">VESTING LINEAL</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-mint">45 DÍAS (2.22%/DÍA)</strong>
            </div>
            <span className="summary-kpi-sub">Desbloqueo diario automático</span>
          </div>
        </article>

        <article className="summary-kpi-card guide-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--blue">
            <span className="summary-kpi-emoji">🛡️</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">RESPALDO USDT</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-cyan">100% AUDITADO</strong>
            </div>
            <span className="summary-kpi-sub">Fórmula AMM P = R / V</span>
          </div>
        </article>

        <article className="summary-kpi-card guide-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--orange">
            <span className="summary-kpi-emoji">🔥</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">SUPER SINK GEMAS</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-orange">+20% BONO EXTRA</strong>
            </div>
            <span className="summary-kpi-sub">100% de quema deflacionaria</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           2. 4 MASTER RULES GAMING CARDS (2x2 GRID COMPACTO)
           ===================================================== */}
      <section className="guide-rules-grid">
        {/* CARD 1: PREVENTA & RESPALDO */}
        <article className="guide-rule-card guide-rule-card--presale">
          <div className="guide-rule-header">
            <div className="guide-rule-badge">PASO 1</div>
            <span className="guide-rule-icon">🚀</span>
          </div>
          <h4 className="guide-rule-title">Preventa Génesis & Respaldo 100%</h4>
          <p className="guide-rule-desc">
            Al adquirir un pack de fundador, el <strong>60% del costo</strong> ingresa inmediatamente al contrato público de liquidez en USDT.
            Recibes un bono inmediato de hasta <strong>+80% en Gemas</strong> y sobres legendarios sin esperas.
          </p>
          <div className="guide-rule-pill-footer">
            <span className="rule-pill-tag text-green">✓ Reserva USDT Garantizada</span>
            <span className="rule-pill-tag text-gold">✓ Edición Limitada 20 Packs</span>
          </div>
        </article>

        {/* CARD 2: VESTING 45 DÍAS */}
        <article className="guide-rule-card guide-rule-card--vesting">
          <div className="guide-rule-header">
            <div className="guide-rule-badge">PASO 2</div>
            <span className="guide-rule-icon">⏳</span>
          </div>
          <h4 className="guide-rule-title">Vesting Diario de 45 Días</h4>
          <p className="guide-rule-desc">
            Tus tokens PLANTS se liberan a razón de <strong>2.22% cada 24 horas</strong>.
            Puedes entrar diariamente a la pestaña <em>Mis Plants</em> y pulsar reclamar para mover tus tokens a saldo líquido sin comisiones.
          </p>
          <div className="guide-rule-pill-footer">
            <span className="rule-pill-tag text-cyan">✓ Sin penalizaciones de retiro</span>
            <span className="rule-pill-tag text-mint">✓ Protección anti-dumping</span>
          </div>
        </article>

        {/* CARD 3: REQUISITO ARENA 3 */}
        <article className="guide-rule-card guide-rule-card--ranked">
          <div className="guide-rule-header">
            <div className="guide-rule-badge">PASO 3</div>
            <span className="guide-rule-icon">⚔️</span>
          </div>
          <h4 className="guide-rule-title">Juego Limpio: Arena 3 (2,001+ Copas)</h4>
          <p className="guide-rule-desc">
            Para realizar Cash-out a billetera externa BEP-20, tu cuenta debe haber alcanzado al menos <strong>2,001 copas</strong> en el Coliseo Ranked.
            Esto protege el fondo contra granjas de bots y asegura que las ganancias vayan a jugadores legítimos.
          </p>
          <div className="guide-rule-pill-footer">
            <span className="rule-pill-tag text-orange">✓ Tolerancia Cero a Bots</span>
            <span className="rule-pill-tag text-gold">✓ Auditoría previa en 24h</span>
          </div>
        </article>

        {/* CARD 4: CASHOUT VS SUPER SINK */}
        <article className="guide-rule-card guide-rule-card--sink">
          <div className="guide-rule-header">
            <div className="guide-rule-badge">PASO 4</div>
            <span className="guide-rule-icon">💎</span>
          </div>
          <h4 className="guide-rule-title">Opciones: USDT o Super Sink (+20% Gemas)</h4>
          <p className="guide-rule-desc">
            Puedes retirar USDT directo a tu wallet BEP-20 (5% de quema de protección), o utilizar el <strong>Super Sink</strong> para convertir a Gemas con <strong>+20% extra</strong>.
            El 100% de los tokens canjeados se queman para siempre, reduciendo el supply.
          </p>
          <div className="guide-rule-pill-footer">
            <span className="rule-pill-tag text-purple">✓ +20% Bonus en Gemas</span>
            <span className="rule-pill-tag text-red">🔥 Quema Deflacionaria</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           3. ACTION BUTTONS BAR (COMPACTA)
           ===================================================== */}
      <footer className="guide-actions-bar">
        <button
          type="button"
          className="guide-action-btn guide-action-btn--presale"
          onClick={() => onTabChange('presale')}
        >
          🛒 IR A LA PREVENTA ➔
        </button>

        <button
          type="button"
          className="guide-action-btn guide-action-btn--vesting"
          onClick={() => onTabChange('vesting')}
        >
          🪙 RECLAMAR VESTING ➔
        </button>

        <button
          type="button"
          className="guide-action-btn guide-action-btn--swap"
          onClick={() => onTabChange('swap')}
        >
          🔄 IR AL SWAP & RETIRO ➔
        </button>
      </footer>
    </div>
  )
}
