import React from 'react'
import type { TokenHubSharedProps } from '../types'
import { TOKEN_ASSETS } from '../tokenAssets'

export const TokenVestingTab: React.FC<TokenHubSharedProps> = ({
  vestingSummary,
  countdownSeconds,
  liquidPlants,
  lockedVestingPlants,
  totalPlants,
  isClaimingVesting,
  onClaimDailyVesting,
  onTabChange,
}) => {
  const formatCountdown = (secs: number) => {
    if (secs <= 0) return 'Disponible ahora'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  }

  const claimableNow = vestingSummary?.claimablePlantsNow ?? 0
  const dailyAccrual = vestingSummary?.dailyAccrualRate ?? 0
  const orders = vestingSummary?.orders ?? []
  const hasOrders = orders.length > 0

  return (
    <div className="vesting-screen">
      {/* =====================================================
           VESTING HERO BANNER
           ===================================================== */}
      <section
        className="vesting-hero"
        data-section="vesting-hero"
        data-label="VESTING HERO"
        style={
          TOKEN_ASSETS.vestingHeroBanner
            ? { backgroundImage: `url(${TOKEN_ASSETS.vestingHeroBanner})`, backgroundSize: 'cover' }
            : {}
        }
      >
        <div className="vesting-hero__content">
          <div className="vesting-hero__tag">🌱 BÓVEDA DE LIBERACIÓN LINEAL & CUSTODIA</div>
          <h1 className="vesting-hero__title">GESTIÓN DE VESTING & SALDOS LÍQUIDOS</h1>
          <p className="vesting-hero__desc">
            Cada pack de preventa adquirido se resguarda en un contrato de vesting lineal estricto de <strong>45 días</strong>. Cada 24 horas se desbloquea un <strong>2.22%</strong> de tu total de tokens. Al pulsar <strong>'Reclamar Hoy'</strong>, los tokens liberados se transfieren inmediatamente a tu saldo líquido sin comisiones, listos para <strong>Swap a USDT</strong> o <strong>Super Sink (+20% Gemas)</strong>.
          </p>

          <div className="vesting-hero__chips" style={{ marginBottom: '6px' }}>
            <span className="hero-chip">⏳ Duración Total: 45 Días Continuos</span>
            <span className="hero-chip">⚡ Cuota Fija: 2.222% Cada 24 Horas</span>
            <span className="hero-chip">🛡️ Cero Comisiones por Reclamo</span>
            <span className="hero-chip">💎 Compatible con Super Sink (+20%)</span>
          </div>
        </div>
      </section>

      {/* =====================================================
           VESTING KPIs ROW
           ===================================================== */}
      <section className="kpi-grid" data-section="vesting-kpi-row" data-label="VESTING KPIs">
        <article className="kpi-card" data-section="kpi-total-plants" data-label="TOTAL PLANTS">
          <div className="kpi-icon-slot">🌿</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">TOTAL PLANTS EN CUENTA</span>
            <strong className="kpi-value">{totalPlants.toFixed(2)}</strong>
            <span className="kpi-sub">Líquido + En Bóveda Vesting</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-liquid-plants" data-label="LIQUID PLANTS">
          <div className="kpi-icon-slot">🌱</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">SALDO LÍQUIDO DISPONIBLE</span>
            <strong className="kpi-value text-green">{liquidPlants.toFixed(2)}</strong>
            <span className="kpi-sub">Listo para Swap o Retiro</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-in-vesting" data-label="IN VESTING">
          <div className="kpi-icon-slot">🔒</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">EN VESTING (EN CUSTODIA)</span>
            <strong className="kpi-value text-gold">{lockedVestingPlants.toFixed(2)}</strong>
            <span className="kpi-sub">Desbloqueo gradual a 45 días</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-release-today" data-label="RELEASE TODAY">
          <div className="kpi-icon-slot">⚡</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">TASA DE LIBERACIÓN DIARIA</span>
            <strong className="kpi-value text-cyan">+{dailyAccrual.toFixed(2)} PLANTS / día</strong>
            <span className="kpi-sub">Acumulación fija cada 24h</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-next-unlock" data-label="NEXT UNLOCK">
          <div className="kpi-icon-slot">⏳</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">PRÓXIMO DESBLOQUEO</span>
            <strong className="kpi-value text-purple">{formatCountdown(countdownSeconds)}</strong>
            <span className="kpi-sub">{claimableNow > 0 ? '¡Listo para reclamar!' : 'Siguiente ventana en cuenta regresiva'}</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           MAIN ROW: RELEASE CALENDAR + WALLET SUMMARY
           ===================================================== */}
      <section className="main-grid">
        {/* Release Calendar Panel */}
        <article className="chart-panel" data-section="release-calendar" data-label="RELEASE CALENDAR">
          <div className="chart-toolbar">
            <div className="chart-title-slot" data-section="release-chart-title">
              <span className="chart-title-text">CALENDARIO DE LIBERACIÓN PROGRESIVA (DÍA 1 AL 45)</span>
            </div>
            <div className="chart-legend-slot" data-section="release-chart-legend">
              <span className="legend-chip legend-chip--green">Liberado a Líquido</span>
              <span className="legend-chip legend-chip--cyan">En Proceso Hoy</span>
              <span className="legend-chip legend-chip--gold">En Custodia Bóveda</span>
            </div>
          </div>

          <div className="chart-area" data-section="release-chart-area">
            <svg viewBox="0 0 640 200" className="chart-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="vestingGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1fcb94" />
                  <stop offset="100%" stopColor="#2d9cf7" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="40" y1="40" x2="600" y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="40" y1="90" x2="600" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="40" y1="140" x2="600" y2="140" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <line x1="40" y1="180" x2="600" y2="180" stroke="rgba(255,255,255,0.12)" />

              {/* Progress Line */}
              <path
                d="M 40 170 Q 200 130 350 90 T 600 30"
                fill="none"
                stroke="url(#vestingGrad)"
                strokeWidth="4"
              />

              {/* Day markers */}
              <circle cx="40" cy="170" r="5" fill="#1fcb94" />
              <circle cx="180" cy="135" r="4" fill="#20dba4" />
              <circle cx="320" cy="98" r="4" fill="#29bdf6" />
              <circle cx="460" cy="64" r="4" fill="#2d9cf7" />
              <circle cx="600" cy="30" r="6" fill="#f2c334" />
            </svg>
          </div>

          <div className="chart-stats-footer">
            <span>Día 1: <strong>Activación Génesis (2.22%)</strong></span>
            <span>Día 15: <strong>33.3% Liberado</strong></span>
            <span>Día 30: <strong>66.6% Liberado</strong></span>
            <span>Día 45: <strong>100% Saldo Disponible</strong></span>
          </div>
        </article>

        {/* Wallet Summary Aside */}
        <aside className="wallet-panel" data-section="wallet-summary" data-label="WALLET SUMMARY">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">RESUMEN DE BILLETERA</h4>
            <span className="panel-heading-badge text-gold">DETALLES</span>
          </div>

          <div className="wallet-list">
            <div className="wallet-row" data-section="wallet-pack-pioneer">
              <div className="wallet-icon-slot">🥉</div>
              <div className="wallet-copy-slot">
                <strong>Pack Pionero ($10)</strong>
                <small>55.56 PLANTS / día (45 días)</small>
              </div>
              <div className="wallet-value-slot text-cyan">
                {orders.filter((o) => o.packId === 'pack_pionero_10').length} Activo(s)
              </div>
            </div>

            <div className="wallet-row" data-section="wallet-pack-champion">
              <div className="wallet-icon-slot">🥈</div>
              <div className="wallet-copy-slot">
                <strong>Pack Campeón ($25)</strong>
                <small>144.44 PLANTS / día (45 días)</small>
              </div>
              <div className="wallet-value-slot text-purple">
                {orders.filter((o) => o.packId === 'pack_campeon_25').length} Activo(s)
              </div>
            </div>

            <div className="wallet-row" data-section="wallet-pack-legend">
              <div className="wallet-icon-slot">👑</div>
              <div className="wallet-copy-slot">
                <strong>Pack Leyenda ($50)</strong>
                <small>311.11 PLANTS / día (45 días)</small>
              </div>
              <div className="wallet-value-slot text-gold">
                {orders.filter((o) => o.packId === 'pack_leyenda_50').length} Activo(s)
              </div>
            </div>
          </div>

          <div className="wallet-summary-slot" data-section="wallet-summary-values">
            <div className="summary-value-row">
              <span>Listos para reclamar hoy:</span>
              <strong className="text-green">+{claimableNow.toFixed(2)} PLANTS</strong>
            </div>
            <div className="summary-value-row">
              <span>Pendientes en custodia:</span>
              <strong className="text-gold">{lockedVestingPlants.toFixed(2)} PLANTS</strong>
            </div>
          </div>

          <div className="wallet-actions">
            <button
              type="button"
              className="wallet-action claim"
              data-action="claim-today"
              disabled={isClaimingVesting || claimableNow <= 0}
              onClick={onClaimDailyVesting}
            >
              {isClaimingVesting
                ? 'RECLAMANDO...'
                : claimableNow > 0
                ? `⚡ RECLAMAR HOY (+${claimableNow.toFixed(1)})`
                : '✓ AL DÍA (SIN PENDIENTES)'}
            </button>

            <button
              type="button"
              className="wallet-action gems"
              data-action="convert-to-gems"
              onClick={() => onTabChange('swap')}
            >
              💎 CANJEAR POR GEMAS (+20%)
            </button>
          </div>
        </aside>
      </section>

      {/* =====================================================
           BOTTOM ROW: PRESALE PACKS TABLE + RECENT RELEASES
           ===================================================== */}
      <section className="bottom-grid">
        {/* Presale Packs Table */}
        <article className="table-panel" data-section="my-presale-packs" data-label="MY PRESALE PACKS">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">MIS PACKS DE PREVENTA EN VESTING</h4>
            <span className="panel-heading-badge">{orders.length} ADQUIRIDOS</span>
          </div>

          <div className="pack-table">
            {/* Headers */}
            <div className="table-cell header" data-section="packs-table-pack-header">
              PACK
            </div>
            <div className="table-cell header" data-section="packs-table-date-header">
              FECHA
            </div>
            <div className="table-cell header" data-section="packs-table-total-header">
              TOTAL PLANTS
            </div>
            <div className="table-cell header" data-section="packs-table-released-header">
              LIBERADOS
            </div>
            <div className="table-cell header" data-section="packs-table-pending-header">
              PENDIENTES
            </div>
            <div className="table-cell header" data-section="packs-table-daily-header">
              TASA DIARIA
            </div>
            <div className="table-cell header" data-section="packs-table-status-header">
              ESTADO
            </div>

            {hasOrders ? (
              orders.map((ord) => {
                const isCompleted = ord.isCompleted || ord.vestingClaimedDays >= ord.vestingDaysTotal
                const released = ord.vestingDailyRate * ord.vestingClaimedDays
                const pending = Math.max(0, ord.plantsAmount - released)

                return (
                  <React.Fragment key={ord.id}>
                    <div className="table-cell font-bold text-cyan" data-section={`pack-${ord.id}-name`}>
                      {ord.packId.includes('pionero')
                        ? 'Pionero'
                        : ord.packId.includes('campeon')
                        ? 'Campeón'
                        : 'Leyenda'}
                    </div>
                    <div className="table-cell" data-section={`pack-${ord.id}-date`}>
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </div>
                    <div className="table-cell" data-section={`pack-${ord.id}-total`}>
                      {ord.plantsAmount.toLocaleString()}
                    </div>
                    <div className="table-cell text-green" data-section={`pack-${ord.id}-released`}>
                      +{released.toFixed(1)}
                    </div>
                    <div className="table-cell text-gold" data-section={`pack-${ord.id}-pending`}>
                      {pending.toFixed(1)}
                    </div>
                    <div className="table-cell" data-section={`pack-${ord.id}-daily`}>
                      +{ord.vestingDailyRate}/d
                    </div>
                    <div className="table-cell" data-section={`pack-${ord.id}-status`}>
                      <span className={`status-pill ${isCompleted ? 'status-pill--done' : 'status-pill--active'}`}>
                        {isCompleted ? 'COMPLETADO' : `DÍA ${ord.daysElapsed} / 45`}
                      </span>
                    </div>
                  </React.Fragment>
                )
              })
            ) : (
              <div className="table-empty-row" style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px', color: '#78929b', fontSize: '13px' }}>
                  Aún no posees packs de preventa en vesting. Tus compras de preventa aparecerán aquí con su seguimiento día a día.
                </p>
                <button
                  type="button"
                  className="token-action-btn token-action-btn--primary"
                  onClick={() => onTabChange('presale')}
                >
                  🛒 ADQUIRIR UN PACK DE FUNDADOR
                </button>
              </div>
            )}
          </div>
        </article>

        {/* Recent Releases History */}
        <aside className="releases-panel" data-section="recent-releases" data-label="RECENT RELEASES">
          <div className="panel-heading-slot">
            <h4 className="panel-heading-title">HISTORIAL DE LIBERACIONES</h4>
            <span className="panel-heading-badge text-green">EN VIVO</span>
          </div>

          <div className="release-list">
            <div className="release-row header" data-section="release-row-header">
              <div className="release-cell">FECHA</div>
              <div className="release-cell">CONCEPTO</div>
              <div className="release-cell">MONTO</div>
              <div className="release-cell">ESTADO</div>
            </div>

            <div className="release-row" data-section="release-row-1">
              <div className="release-cell">Hoy</div>
              <div className="release-cell">Cuota 24h</div>
              <div className="release-cell text-green">+{dailyAccrual > 0 ? dailyAccrual.toFixed(1) : '55.6'}</div>
              <div className="release-cell text-cyan">Disponible</div>
            </div>

            <div className="release-row" data-section="release-row-2">
              <div className="release-cell">Ayer</div>
              <div className="release-cell">Cuota 24h</div>
              <div className="release-cell text-green">+{dailyAccrual > 0 ? dailyAccrual.toFixed(1) : '55.6'}</div>
              <div className="release-cell text-cyan">Acreditado</div>
            </div>

            <div className="release-row" data-section="release-row-3">
              <div className="release-cell">Hace 2d</div>
              <div className="release-cell">Cuota 24h</div>
              <div className="release-cell text-green">+{dailyAccrual > 0 ? dailyAccrual.toFixed(1) : '55.6'}</div>
              <div className="release-cell text-cyan">Acreditado</div>
            </div>

            <div className="release-row" data-section="release-row-4">
              <div className="release-cell">Génesis</div>
              <div className="release-cell">Asignación</div>
              <div className="release-cell text-purple">Fundador</div>
              <div className="release-cell text-green">Confirmado</div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
