import React, { useState } from 'react'
import type { TokenHubSharedProps } from '../types'
import { TOKEN_ASSETS } from '../tokenAssets'

export const TokenGuideTab: React.FC<TokenHubSharedProps> = ({ onTabChange }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(1)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <div className="guide-screen">
      {/* =====================================================
           GUIDE HERO BANNER
           ===================================================== */}
      <section
        className="guide-hero"
        data-section="guide-hero"
        data-label="GUIDE HERO"
        style={
          TOKEN_ASSETS.guideHeroBanner
            ? { backgroundImage: `url(${TOKEN_ASSETS.guideHeroBanner})`, backgroundSize: 'cover' }
            : {}
        }
      >
        <div className="guide-hero__content">
          <div className="guide-hero__tag">📖 GUÍA OFICIAL, REGLAS & MANUAL DE SEGURIDAD</div>
          <h1 className="guide-hero__title">MANUAL PARA GLADIADORES & REGLAS DEL SISTEMA</h1>
          <p className="guide-hero__desc">
            Aprende cómo funciona la economía del Token PLANTS, los requisitos obligatorios de juego limpio,
            el sistema de vesting y las políticas anti-trampas diseñadas para proteger a los jugadores reales y
            garantizar la solvencia permanente del pool de liquidez en USDT.
          </p>

          <div className="guide-hero__chips" style={{ marginBottom: '6px' }}>
            <span className="hero-chip">⚔️ Arena 3 Mínima (2,001+ Copas) para Retiros USDT</span>
            <span className="hero-chip">🛡️ Protocolo Anti-Bots de Tolerancia Cero</span>
            <span className="hero-chip">💎 Super Sink: +20% Bonus en Gemas para Todos</span>
            <span className="hero-chip">⚡ Vesting Lineal de 45 Días Seguro</span>
          </div>
        </div>
      </section>

      {/* =====================================================
           SUMMARY CARDS ROW
           ===================================================== */}
      <section className="summary-grid" data-section="guide-summary-row" data-label="GUIDE SUMMARY">
        <article className="summary-card" data-section="guide-minimum-arena" data-label="MINIMUM ARENA">
          <div className="summary-icon-slot">🏆</div>
          <div className="summary-content-slot">
            <span className="summary-label">ARENA MÍNIMA</span>
            <strong className="summary-value text-gold">2,001+ COPAS</strong>
            <span className="summary-sub">Arena 3 requerida para retiros</span>
          </div>
        </article>

        <article className="summary-card" data-section="guide-vesting" data-label="VESTING">
          <div className="summary-icon-slot">⏳</div>
          <div className="summary-content-slot">
            <span className="summary-label">VESTING LINEAL</span>
            <strong className="summary-value text-cyan">45 DÍAS</strong>
            <span className="summary-sub">2.22% liberado cada 24 horas</span>
          </div>
        </article>

        <article className="summary-card" data-section="guide-cashout" data-label="CASH-OUT">
          <div className="summary-icon-slot">💵</div>
          <div className="summary-content-slot">
            <span className="summary-label">CASH-OUT USDT</span>
            <strong className="summary-value text-green">RED BEP-20</strong>
            <span className="summary-sub">Directo a billetera BNB Chain</span>
          </div>
        </article>

        <article className="summary-card" data-section="guide-gem-bonus" data-label="GEM BONUS">
          <div className="summary-icon-slot">💎</div>
          <div className="summary-content-slot">
            <span className="summary-label">SUPER SINK</span>
            <strong className="summary-value text-purple">+20% EXTRA</strong>
            <span className="summary-sub">En Gemas con quema total</span>
          </div>
        </article>

        <article className="summary-card" data-section="guide-anti-farming" data-label="ANTI-FARMING">
          <div className="summary-icon-slot">🛡️</div>
          <div className="summary-content-slot">
            <span className="summary-label">ANTI-FARMING</span>
            <strong className="summary-value text-red">TOLERANCIA CERO</strong>
            <span className="summary-sub">Baneo inmediato a bots</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           MAIN ROW: GUIDE STEPS + FAQ
           ===================================================== */}
      <section className="main-grid">
        {/* Guide Steps List */}
        <article className="guide-list" data-section="guide-steps" data-label="GUIDE STEPS">
          {/* Step 1 */}
          <div className="guide-step" data-section="guide-step-start">
            <div className="step-number-slot">1</div>
            <div className="step-image-slot" data-slot="guideStep1">
              <span style={{ fontSize: '24px' }}>🚀</span>
            </div>
            <div className="step-copy-slot">
              <h4>1. Entra en la Preventa de Fundadores</h4>
              <p>
                Adquiere uno de los 20 packs génesis (Pionero, Campeón o Leyenda). El 60% de tu pago ingresa directamente a respaldar la reserva pública en USDT, y recibes recompensas inmediatas de Gemas (hasta 70% de retorno), sobres legendarios y abono.
              </p>
            </div>
            <div className="step-arrow-slot">➔</div>
          </div>

          {/* Step 2 */}
          <div className="guide-step" data-section="guide-step-earn-plants">
            <div className="step-number-slot">2</div>
            <div className="step-image-slot" data-slot="guideStep2">
              <span style={{ fontSize: '24px' }}>⚡</span>
            </div>
            <div className="step-copy-slot">
              <h4>2. Libera tus PLANTS Diariamente en Vesting</h4>
              <p>
                Cada 24 horas, entra a la pestaña <strong>Vesting</strong> y pulsa <strong>'Reclamar Hoy'</strong> para transferir tu cuota del 2.22% a tu saldo líquido sin comisiones. Los tokens líquidos quedan listos para su uso de inmediato.
              </p>
            </div>
            <div className="step-arrow-slot">➔</div>
          </div>

          {/* Step 3 */}
          <div className="guide-step" data-section="guide-step-withdraw-or-convert">
            <div className="step-number-slot">3</div>
            <div className="step-image-slot" data-slot="guideStep3">
              <span style={{ fontSize: '24px' }}>🏆</span>
            </div>
            <div className="step-copy-slot">
              <h4>3. Asciende a Arena 3 en el Coliseo Ranked</h4>
              <p>
                Para procesar retiros a billetera externa en USDT BEP-20, tu cuenta debe haber alcanzado al menos <strong>Arena 3 (2,001+ copas)</strong>. Este requisito fundamental asegura que la liquidez premie a jugadores reales y protege la economía contra granjas automatizadas.
              </p>
            </div>
            <div className="step-arrow-slot">➔</div>
          </div>

          {/* Step 4 */}
          <div className="guide-step" data-section="guide-step-important-rules">
            <div className="step-number-slot">4</div>
            <div className="step-image-slot" data-slot="guideStep4">
              <span style={{ fontSize: '24px' }}>🔄</span>
            </div>
            <div className="step-copy-slot">
              <h4>4. Retira en USDT o Quema en Super Sink (+20%)</h4>
              <p>
                En la pestaña <strong>Swap</strong>, puedes retirar a tu dirección BEP-20 con una tarifa del 5% que se quema al 100%. Si prefieres mejorar tus plantas, canjea por Gemas con un <strong>+20% extra de bonus</strong> sin importar tu rango de arena.
              </p>
            </div>
            <div className="step-arrow-slot">➔</div>
          </div>

          {/* Step 5 */}
          <div className="guide-step" data-section="guide-step-anti-farming">
            <div className="step-number-slot">5</div>
            <div className="step-image-slot" data-slot="guideStep5">
              <span style={{ fontSize: '24px' }}>🛡️</span>
            </div>
            <div className="step-copy-slot">
              <h4>5. Respeta las Reglas de Fair Play Anti-Trampas</h4>
              <p>
                Está terminantemente prohibido el uso de emuladores con macros, granjas de multicuentas o emparejamientos pactados (win-trading). Las cuentas infractoras son detectadas automáticamente por el servidor y pierden de inmediato el acceso a retiros.
              </p>
            </div>
            <div className="step-arrow-slot">✓</div>
          </div>
        </article>

        {/* FAQ Panel */}
        <aside className="faq-panel" data-section="faq" data-label="FAQ">
          <div className="panel-heading-slot" data-section="faq-heading">
            <h4 className="panel-heading-title">PREGUNTAS FRECUENTES (FAQ)</h4>
            <span className="panel-heading-badge text-gold">DUDAS COMUNES</span>
          </div>

          <div className="faq-list">
            <div
              className={`faq-row ${openFaq === 1 ? 'open' : ''}`}
              data-section="faq-what-is-plants"
              onClick={() => toggleFaq(1)}
            >
              <div className="faq-icon-slot">❓</div>
              <div className="faq-copy-slot">
                <strong>¿Qué es el Token PLANTS y en qué se diferencia de las Gemas?</strong>
                {openFaq === 1 && (
                  <p className="faq-ans">
                    El Token PLANTS es el activo de gobernanza y respaldo económico de Plants Arena, respaldado por una reserva real de USDT en la curva AMM. Mientras que las Gemas son la moneda in-game para compras de jardín, el Token PLANTS puede retirarse en USDT a tu billetera BEP-20 o canjearse por Gemas con un +20% de bonus.
                  </p>
                )}
              </div>
              <div className="faq-arrow-slot">{openFaq === 1 ? '▲' : '▼'}</div>
            </div>

            <div
              className={`faq-row ${openFaq === 2 ? 'open' : ''}`}
              data-section="faq-vesting-time"
              onClick={() => toggleFaq(2)}
            >
              <div className="faq-icon-slot">⏳</div>
              <div className="faq-copy-slot">
                <strong>¿Por qué existe un Vesting Lineal de 45 días?</strong>
                {openFaq === 2 && (
                  <p className="faq-ans">
                    El vesting lineal del 2.22% diario previene caídas abruptas de precio causadas por ventas masivas en el día 1. Esto asegura que la liquidez en USDT crezca sostenidamente y que los fundadores disfruten de un precio ascendente y estable a lo largo del tiempo.
                  </p>
                )}
              </div>
              <div className="faq-arrow-slot">{openFaq === 2 ? '▲' : '▼'}</div>
            </div>

            <div
              className={`faq-row ${openFaq === 3 ? 'open' : ''}`}
              data-section="faq-convert-to-gems"
              onClick={() => toggleFaq(3)}
            >
              <div className="faq-icon-slot">💎</div>
              <div className="faq-copy-slot">
                <strong>¿Cómo funciona el Super Sink (+20% Gemas)?</strong>
                {openFaq === 3 && (
                  <p className="faq-ans">
                    El Super Sink permite a cualquier jugador (sin requisito de copas) convertir sus PLANTS a Gemas con una tasa bonificada del 20% extra. El 100% de los tokens PLANTS canjeados se destruyen de forma irreversible, lo que disminuye el suministro y eleva el precio spot para toda la comunidad.
                  </p>
                )}
              </div>
              <div className="faq-arrow-slot">{openFaq === 3 ? '▲' : '▼'}</div>
            </div>

            <div
              className={`faq-row ${openFaq === 4 ? 'open' : ''}`}
              data-section="faq-prohibited-actions"
              onClick={() => toggleFaq(4)}
            >
              <div className="faq-icon-slot">🏆</div>
              <div className="faq-copy-slot">
                <strong>¿Por qué se requiere Arena 3 (2,001+ copas) para retirar USDT?</strong>
                {openFaq === 4 && (
                  <p className="faq-ans">
                    El requisito de 2,001 copas actúa como una barrera anti-bot y anti-fraude fundamental. Garantiza que solo jugadores reales que compiten y dominan la arena accedan a los retiros de USDT, previniendo que scripts automáticos drenen la tesorería pública.
                  </p>
                )}
              </div>
              <div className="faq-arrow-slot">{openFaq === 4 ? '▲' : '▼'}</div>
            </div>

            <div
              className={`faq-row ${openFaq === 5 ? 'open' : ''}`}
              data-section="faq-fees-info"
              onClick={() => toggleFaq(5)}
            >
              <div className="faq-icon-slot">⚖️</div>
              <div className="faq-copy-slot">
                <strong>¿Cuáles son las comisiones de retiro y a dónde van?</strong>
                {openFaq === 5 && (
                  <p className="faq-ans">
                    Existe una tarifa de protocolo fija del 5% al retirar USDT a tu billetera BEP-20. El 100% de esta comisión se destina a quemar tokens PLANTS, reduciendo el suministro circulante y retroalimentando el valor del ecosistema.
                  </p>
                )}
              </div>
              <div className="faq-arrow-slot">{openFaq === 5 ? '▲' : '▼'}</div>
            </div>

            <div
              className={`faq-row ${openFaq === 6 ? 'open' : ''}`}
              data-section="faq-prohibited-behavior"
              onClick={() => toggleFaq(6)}
            >
              <div className="faq-icon-slot">🚫</div>
              <div className="faq-copy-slot">
                <strong>¿Qué conductas están prohibidas y sancionadas?</strong>
                {openFaq === 6 && (
                  <p className="faq-ans">
                    Está terminantemente prohibido: (1) Crear granjas de multicuentas para farmear tokens, (2) Pactar victorias o derrotas en matchmaking Ranked (win-trading), y (3) Utilizar emuladores con scripts de clics o trampas. Las cuentas infractoras son baneadas definitivamente y sus fondos confiscados al pool de la comunidad.
                  </p>
                )}
              </div>
              <div className="faq-arrow-slot">{openFaq === 6 ? '▲' : '▼'}</div>
            </div>
          </div>
        </aside>
      </section>

      {/* =====================================================
           CTA ROW
           ===================================================== */}
      <section className="cta-grid" data-section="guide-primary-cta-row" data-label="GUIDE CTAs">
        <button
          type="button"
          className="cta-placeholder cta-placeholder--presale"
          data-action="open-presale"
          onClick={() => onTabChange('presale')}
        >
          <span>🛒 PARTICIPAR EN LA PREVENTA GÉNESIS</span>
        </button>

        <button
          type="button"
          className="cta-placeholder cta-placeholder--swap"
          data-action="open-swap"
          onClick={() => onTabChange('swap')}
        >
          <span>🔄 IR AL MERCADO SWAP & CASHOUT</span>
        </button>

        <button
          type="button"
          className="cta-placeholder cta-placeholder--tokenomics"
          data-action="open-tokenomics"
          onClick={() => onTabChange('tokenomics')}
        >
          <span>📊 VER ARQUITECTURA TOKENOMICS</span>
        </button>
      </section>
    </div>
  )
}
