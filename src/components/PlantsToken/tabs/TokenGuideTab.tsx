import React, { useState } from 'react'
import { soundManager } from '../../../utils/audioManager'
import type { TokenHubSharedProps } from '../types'

interface FaqItem {
  id: string
  category: string
  icon: string
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'what-is-plants',
    category: 'RESPALDO & LIQUIDEZ',
    icon: '🌱',
    question: '¿Qué es el token PLANTS y cómo está respaldado en USDT?',
    answer:
      'PLANTS es el activo oficial de Plant Arena. Su cotización se calcula matemáticamente mediante un contrato AMM de bonding curve (P = R / V con K = 200M). Cada token en circulación está respaldado al 100% por una reserva pública en USDT que se nutre con el 60% de todas las preventas y el 70% de las gemas inyectadas al ecosistema.',
  },
  {
    id: 'vesting-time',
    category: 'CALENDARIO DE VESTING',
    icon: '⏳',
    question: '¿Cómo funciona la liberación diaria de 45 días?',
    answer:
      'Tus packs de preventa se liberan de forma lineal y acumulativa a razón de 2.22% cada 24 horas. Puedes entrar diariamente a la pestaña "Mis Plants" y presionar "Reclamar Hoy" para transferir los tokens desbloqueados directamente a tu saldo líquido sin ninguna comisión.',
  },
  {
    id: 'convert-gems',
    category: 'SUPER SINK & DEFLACIÓN',
    icon: '💎',
    question: '¿Qué es el Super Sink (+20% Gemas) y por qué quema tokens?',
    answer:
      'El Super Sink es el mayor motor deflacionario del juego: te permite canjear tus PLANTS directamente por Gemas con un +20% de bono sobre el precio spot de mercado. El 100% de los tokens PLANTS canjeados son destruidos e incinerados permanentemente del suministro total, elevando la escasez del ecosistema.',
  },
  {
    id: 'staking-rule',
    category: 'STAKING & EMISIÓN',
    icon: '🌾',
    question: '¿Habrá staking de PLANTS o piscinas de rendimiento?',
    answer:
      'NO. En Plant Arena NO se otorgan tokens PLANTS mediante staking. Para proteger el valor del token y evitar la inflación desmedida típica de otros juegos, los tokens solo se mintean mediante victorias legítimas en Arena 3+ o en la Preventa Fundadores. No existe inflación por staking.',
  },
  {
    id: 'withdrawal-window',
    category: 'RETIROS & SEGURIDAD',
    icon: '🏦',
    question: '¿Qué requisitos aplican para el retiro a USDT y qué es la Ventana Diaria?',
    answer:
      'Para solicitar un retiro a tu billetera externa BEP-20 (BNB Chain) debes haber alcanzado Arena 3 (2,001+ copas). Cada solicitud pasa por una auditoría anti-bots y se liquida en la "Ventana de Retiros" diaria a las 18:00 (UTC-3), aplicando un 5% de quema de resguardo para proteger la reserva.',
  },
  {
    id: 'halvings',
    category: 'ESCASEZ PROGRAMADA',
    icon: '⚔️',
    question: '¿Cómo funcionan las 5 Eras de Halving en recompensas PvP?',
    answer:
      'El suministro total está estrictamente limitado a 1,000,000 PLANTS. Las recompensas de victoria en Arena 3 se reducen automáticamente conforme avanza la emisión: Fase 1 (100% · 2 a 6 PLANTS/victoria), Fase 2 (50% al llegar a 500k), Fase 3 (25% al llegar a 750k), Fase 4 (12.5%) y Fase 5 (6.25%).',
  },
]

export const TokenGuideTab: React.FC<TokenHubSharedProps> = ({ onTabChange }) => {
  const [viewMode, setViewMode] = useState<'both' | 'faq' | 'steps'>('both')
  const [openFaq, setOpenFaq] = useState<string | null>('what-is-plants')

  const toggleFaq = (id: string) => {
    soundManager.playSound('click', 0.3)
    setOpenFaq((prev) => (prev === id ? null : id))
  }

  return (
    <div className="token-guide-screen">
      {/* =====================================================
           1. SUMMARY KPI ROW (5 CARDS)
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

      {/* Subtab Switcher */}
      <div className="guide-view-switcher">
        <button
          type="button"
          className={`guide-view-btn ${viewMode === 'both' ? 'active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.3)
            setViewMode('both')
          }}
        >
          Vista Combinada (Guía + FAQ)
        </button>
        <button
          type="button"
          className={`guide-view-btn ${viewMode === 'faq' ? 'active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.3)
            setViewMode('faq')
          }}
        >
          ❓ Solo Preguntas Frecuentes (FAQ)
        </button>
        <button
          type="button"
          className={`guide-view-btn ${viewMode === 'steps' ? 'active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.3)
            setViewMode('steps')
          }}
        >
          📜 Solo Pasos de Funcionamiento
        </button>
      </div>

      {/* =====================================================
           2. MAIN CONTENT: 5 STEPS (LEFT) + PREMIUM FAQ (RIGHT)
           ===================================================== */}
      <section className={`guide-main-grid ${viewMode === 'faq' ? 'guide-main-grid--faq-only' : viewMode === 'steps' ? 'guide-main-grid--steps-only' : ''}`}>
        {/* LEFT: 5 GUIDE STEPS */}
        {(viewMode === 'both' || viewMode === 'steps') && (
          <article className="guide-steps-list">
            <div className="guide-steps-header">
              <span className="guide-steps-title-icon">🧭</span>
              <h4 className="guide-steps-title">CÓMO FUNCIONA EL TOKEN PLANTS (5 PASOS)</h4>
            </div>

            {/* STEP 1 */}
            <div className="guide-step-row guide-step-row--step1">
              <div className="guide-step-badge">1</div>
              <span className="guide-step-icon">🛒</span>
              <div className="guide-step-info">
                <strong>Adquiere tu Pack en Preventa</strong>
                <p>El 60% de tu compra inyecta liquidez directa al pool en USDT. Recibes bono de hasta +80% en gemas.</p>
              </div>
              <span className="guide-step-arrow">➔</span>
            </div>

            {/* STEP 2 */}
            <div className="guide-step-row guide-step-row--step2">
              <div className="guide-step-badge">2</div>
              <span className="guide-step-icon">⏳</span>
              <div className="guide-step-info">
                <strong>Desbloqueo Diario de Vesting (45 Días)</strong>
                <p>Cada 24 horas se libera 2.22% de tus tokens. Pulsa "Reclamar Hoy" en Mis Plants sin comisiones.</p>
              </div>
              <span className="guide-step-arrow">➔</span>
            </div>

            {/* STEP 3 */}
            <div className="guide-step-row guide-step-row--step3">
              <div className="guide-step-badge">3</div>
              <span className="guide-step-icon">🔄</span>
              <div className="guide-step-info">
                <strong>Retira a USDT o Canjea por Gemas</strong>
                <p>Envía USDT a tu wallet BEP-20 o elige el Super Sink a gemas con +20% de bono y quema permanente.</p>
              </div>
              <span className="guide-step-arrow">➔</span>
            </div>

            {/* STEP 4 */}
            <div className="guide-step-row guide-step-row--step4">
              <div className="guide-step-badge">4</div>
              <span className="guide-step-icon">⚔️</span>
              <div className="guide-step-info">
                <strong>Requisito Arena 3 (2,001+ Copas)</strong>
                <p>El retiro externo en USDT requiere Arena 3 para asegurar recompensas exclusivamente a jugadores activos.</p>
              </div>
              <span className="guide-step-arrow">➔</span>
            </div>

            {/* STEP 5 */}
            <div className="guide-step-row guide-step-row--step5">
              <div className="guide-step-badge">5</div>
              <span className="guide-step-icon">🛡️</span>
              <div className="guide-step-info">
                <strong>Protocolo Anti-Bots & Ventana Diaria</strong>
                <p>Retiros liquidados en lotes diarios (18:00 UTC-3) con auditoría automatizada y 5% de quema de resguardo.</p>
              </div>
              <span className="guide-step-arrow">➔</span>
            </div>
          </article>
        )}

        {/* RIGHT: REDESIGNED PREMIUM FAQ PANEL */}
        {(viewMode === 'both' || viewMode === 'faq') && (
          <aside className="guide-faq-panel">
            <div className="guide-faq-header">
              <div className="guide-faq-header-left">
                <span className="guide-faq-title-icon">❓</span>
                <div>
                  <h4 className="guide-faq-title">PREGUNTAS FRECUENTES (FAQ)</h4>
                  <p className="guide-faq-sub">Respuestas claras y oficiales sobre la economía, retiros y reglas</p>
                </div>
              </div>
              <span className="guide-faq-badge-count">{FAQ_ITEMS.length} Preguntas</span>
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
                      <div className="guide-faq-item-title-wrap">
                        <span className="guide-faq-category-tag">{item.category}</span>
                        <strong className="guide-faq-question">{item.question}</strong>
                      </div>
                      <span className="guide-faq-chevron">{isOpen ? '▲' : '▼'}</span>
                    </div>
                    {isOpen && (
                      <div className="guide-faq-answer-wrap">
                        <p className="guide-faq-answer">{item.answer}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </aside>
        )}
      </section>

      {/* =====================================================
           3. BOTTOM CTA BUTTONS
           ===================================================== */}
      <footer className="guide-actions-bar">
        <button
          type="button"
          className="guide-action-btn guide-action-btn--presale"
          onClick={() => onTabChange('presale')}
        >
          🛒 IR A LA PREVENTA FUNDADORES ➔
        </button>

        <button
          type="button"
          className="guide-action-btn guide-action-btn--vesting"
          onClick={() => onTabChange('vesting')}
        >
          🪙 VER MI CALENDARIO DE LIBERACIÓN ➔
        </button>

        <button
          type="button"
          className="guide-action-btn guide-action-btn--swap"
          onClick={() => onTabChange('swap')}
        >
          🔄 CONVERTIDOR & SWAP ➔
        </button>
      </footer>
    </div>
  )
}
