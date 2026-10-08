import React, { useState } from 'react'
import type { TokenHubSharedProps } from '../types'

interface FaqItem {
  id: string
  icon: string
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'what-is-plants',
    icon: '🌱',
    question: '¿Qué es el token PLANTS y cómo está respaldado?',
    answer:
      'PLANTS es el token oficial de Plant Arena. Su precio se calcula mediante un contrato AMM (P = R / V), respaldado al 100% por una reserva pública en USDT alimentada por la preventa y la economía del juego.',
  },
  {
    id: 'vesting-time',
    icon: '⏳',
    question: '¿Cómo funciona el vesting de 45 días?',
    answer:
      'Tus tokens se desbloquean de forma lineal a razón de 2.22% cada 24 horas. Puedes entrar diariamente a "Mis Plants" y presionar "Reclamar" para moverlos a tu saldo líquido sin comisiones.',
  },
  {
    id: 'convert-gems',
    icon: '💎',
    question: '¿Cómo funciona el Super Sink (+20% Gemas)?',
    answer:
      'Puedes canjear tus tokens PLANTS líquidos directamente por Gemas del juego recibiendo un bono del +20%. El 100% de los PLANTS canjeados se queman permanentemente para generar deflación.',
  },
  {
    id: 'prohibited-actions',
    icon: '🛡️',
    question: '¿Qué requisitos y reglas aplican para el retiro?',
    answer:
      'Para solicitar retiro en USDT vía BEP-20 debes alcanzar Arena 3 (2,001+ copas). Cada solicitud pasa por una verificación de 24h para garantizar juego limpio contra bots. Se aplica una quema del 5% de protección.',
  },
]

export const TokenGuideTab: React.FC<TokenHubSharedProps> = ({ onTabChange }) => {
  const [openFaq, setOpenFaq] = useState<string | null>('what-is-plants')

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id))
  }

  return (
    <div className="token-guide-screen">
      {/* =====================================================
           1. SUMMARY KPI ROW (5 CARDS SEGÚN WIREFRAME)
           ===================================================== */}
      <section className="summary-kpi-grid guide-kpi-grid">
        {/* MINIMUM ARENA */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--gold">
            <span className="summary-kpi-emoji">🏆</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">MINIMUM ARENA</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-gold">ARENA 3 (2,001+)</strong>
            </div>
            <span className="summary-kpi-sub">Filtro gladiador real</span>
          </div>
        </article>

        {/* VESTING */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--mint">
            <span className="summary-kpi-emoji">⏳</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">VESTING</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-mint">45 DÍAS (2.22%/DÍA)</strong>
            </div>
            <span className="summary-kpi-sub">Desbloqueo lineal 24h</span>
          </div>
        </article>

        {/* CASH-OUT */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--blue">
            <span className="summary-kpi-emoji">💵</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">CASH-OUT</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-cyan">BEP-20 (BNB CHAIN)</strong>
            </div>
            <span className="summary-kpi-sub">5% quema de seguridad</span>
          </div>
        </article>

        {/* GEM BONUS */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--green">
            <span className="summary-kpi-emoji">💎</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">GEM BONUS</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-green">+20% EXTRA</strong>
            </div>
            <span className="summary-kpi-sub">Super Sink deflacionario</span>
          </div>
        </article>

        {/* ANTI-FARMING */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--orange">
            <span className="summary-kpi-emoji">🛡️</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">ANTI-FARMING</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-orange">FAIR PLAY 24H</strong>
            </div>
            <span className="summary-kpi-sub">Protección contra bots</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           2. MAIN CONTENT: 5 STEPS (LEFT) + FAQ PANEL (RIGHT)
           ===================================================== */}
      <section className="guide-main-grid">
        {/* LEFT: 5 GUIDE STEPS */}
        <article className="guide-steps-list">
          {/* STEP 1 */}
          <div className="guide-step-row guide-step-row--step1">
            <div className="guide-step-badge">1</div>
            <span className="guide-step-icon">🛒</span>
            <div className="guide-step-info">
              <strong>Adquiere tu Pack en Preventa</strong>
              <p>60% de tu compra inyecta liquidez directa al pool en USDT. Recibes bono de hasta +80% en gemas.</p>
            </div>
            <span className="guide-step-arrow">➔</span>
          </div>

          {/* STEP 2 */}
          <div className="guide-step-row guide-step-row--step2">
            <div className="guide-step-badge">2</div>
            <span className="guide-step-icon">⏳</span>
            <div className="guide-step-info">
              <strong>Desbloqueo Diario de Vesting</strong>
              <p>Cada 24 horas se libera 2.22% de tus tokens. Pulsa "Reclamar" en Mis Plants sin comisiones.</p>
            </div>
            <span className="guide-step-arrow">➔</span>
          </div>

          {/* STEP 3 */}
          <div className="guide-step-row guide-step-row--step3">
            <div className="guide-step-badge">3</div>
            <span className="guide-step-icon">🔄</span>
            <div className="guide-step-info">
              <strong>Retira a USDT o Canjea por Gemas</strong>
              <p>Envía USDT a tu wallet BEP-20 o elige el Super Sink a gemas con +20% de bono y quema 100%.</p>
            </div>
            <span className="guide-step-arrow">➔</span>
          </div>

          {/* STEP 4 */}
          <div className="guide-step-row guide-step-row--step4">
            <div className="guide-step-badge">4</div>
            <span className="guide-step-icon">⚔️</span>
            <div className="guide-step-info">
              <strong>Requisito Arena 3 (2,001+ Copas)</strong>
              <p>El retiro a billetera externa requiere alcanzar Arena 3 para asegurar recompensas a jugadores activos.</p>
            </div>
            <span className="guide-step-arrow">➔</span>
          </div>

          {/* STEP 5 */}
          <div className="guide-step-row guide-step-row--step5">
            <div className="guide-step-badge">5</div>
            <span className="guide-step-icon">🛡️</span>
            <div className="guide-step-info">
              <strong>Protocolo Anti-Farming & Seguridad</strong>
              <p>Retiros procesados en ventanas de 24h con auditoría automatizada y 5% de quema de resguardo.</p>
            </div>
            <span className="guide-step-arrow">➔</span>
          </div>
        </article>

        {/* RIGHT: FAQ ACCORDION PANEL */}
        <aside className="guide-faq-panel">
          <div className="guide-faq-header">
            <span className="guide-faq-title-icon">❓</span>
            <h4 className="guide-faq-title">PREGUNTAS FRECUENTES (FAQ)</h4>
          </div>

          <div className="guide-faq-list">
            {FAQ_ITEMS.map((item) => {
              const isOpen = openFaq === item.id
              return (
                <div
                  key={item.id}
                  className={`guide-faq-item ${isOpen ? 'active' : ''}`}
                  onClick={() => toggleFaq(item.id)}
                >
                  <div className="guide-faq-item-header">
                    <span className="guide-faq-item-icon">{item.icon}</span>
                    <strong className="guide-faq-question">{item.question}</strong>
                    <span className="guide-faq-chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && <p className="guide-faq-answer">{item.answer}</p>}
                </div>
              )
            })}
          </div>
        </aside>
      </section>

      {/* =====================================================
           3. BOTTOM CTA BUTTONS (COMPACTOS)
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
