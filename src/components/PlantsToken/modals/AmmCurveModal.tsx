import React, { useState, useMemo } from 'react'
import { soundManager } from '../../../utils/audioManager'
import type { PlantsPriceHistoryPoint, PlantsMarketState } from '../../../services/plantsTokenService'

type Timeframe = '1H' | '24H' | '7D' | 'ALL'

interface AmmCurveModalProps {
  isOpen: boolean
  onClose: () => void
  spotPrice: number
  priceHistory?: PlantsPriceHistoryPoint[]
  marketState?: PlantsMarketState | null
}

interface ProcessedPoint {
  x: number
  y: number
  price: number
  timestamp: number
  dateStr: string
  eventType: string
  eventLabel: string
  eventIcon: string
  deltaUsdt: number
  deltaPlants: number
}

function getEventMeta(eventType: string, deltaUsdt: number) {
  switch (eventType) {
    case 'cashout_payout':
      return {
        label: `Retiro USDT (${deltaUsdt < 0 ? deltaUsdt.toFixed(2) : `+${deltaUsdt.toFixed(2)}`} $)`,
        icon: '💰',
      }
    case 'swap_usdt':
      return {
        label: `Swap USDT (${deltaUsdt < 0 ? deltaUsdt.toFixed(3) : `+${deltaUsdt.toFixed(3)}`} $)`,
        icon: '🔄',
      }
    case 'swap_gems':
      return {
        label: 'Swap Gemas (Quema)',
        icon: '💎',
      }
    case 'pvp_reward':
      return {
        label: 'Recompensa de Combate PvP',
        icon: '⚔️',
      }
    case 'genesis':
      return {
        label: 'Semilla Génesis (AMM Launch)',
        icon: '🌱',
      }
    default:
      return {
        label: eventType.replace(/_/g, ' '),
        icon: '📈',
      }
  }
}

export const AmmCurveModal: React.FC<AmmCurveModalProps> = ({
  isOpen,
  onClose,
  spotPrice,
  priceHistory = [],
  marketState,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('24H')
  const [hoveredPoint, setHoveredPoint] = useState<ProcessedPoint | null>(null)

  const handleClose = () => {
    soundManager.playSound('click', 0.4)
    onClose()
  }

  // Cálculo detallado y dinámico de puntos de la curva
  const {
    chartPoints,
    minDisplayPrice,
    maxDisplayPrice,
    xAxisLabels,
    priceChangePct,
    isPositiveTrend,
    startPrice,
    endPrice,
  } = useMemo(() => {
    const now = Date.now()
    let cutoff = 0
    let labels: string[] = []

    if (timeframe === '1H') {
      cutoff = now - 3600 * 1000
      labels = ['-60m', '-45m', '-30m', '-15m', 'Ahora (En Vivo)']
    } else if (timeframe === '24H') {
      cutoff = now - 24 * 3600 * 1000
      labels = ['-24h', '-18h', '-12h', '-6h', 'Ahora (En Vivo)']
    } else if (timeframe === '7D') {
      cutoff = now - 7 * 24 * 3600 * 1000
      labels = ['Día -7', 'Día -5', 'Día -3', 'Día -1', 'Hoy (En Vivo)']
    } else {
      cutoff = 0 // ALL
      labels = ['Semilla Génesis ($0.0002)', 'Fase Inicial', 'Halving PvP', 'Actual']
    }

    // Filtrar historial por el rango de tiempo seleccionado
    const rawFiltered = (priceHistory || []).filter((p) => {
      const t = new Date(p.created_at).getTime()
      return !isNaN(t) && (cutoff === 0 || t >= cutoff)
    })

    const genesisPrice = 0.0002
    const currentPrice = spotPrice > 0 ? spotPrice : (rawFiltered.length > 0 ? rawFiltered[rawFiltered.length - 1].spot_price : genesisPrice)

    // Crear lista de puntos base asegurando orden cronológico
    const items: Array<{
      price: number
      timestamp: number
      eventType: string
      deltaUsdt: number
      deltaPlants: number
    }> = []

    if (timeframe === 'ALL') {
      // Agregar siempre el génesis oficial al inicio
      items.push({
        price: genesisPrice,
        timestamp: new Date('2026-09-01T00:00:00Z').getTime(),
        eventType: 'genesis',
        deltaUsdt: 0,
        deltaPlants: 0,
      })
    } else if (rawFiltered.length === 0) {
      // Si no hay puntos en el timeframe exacto, buscar el último precio anterior como referencia
      const lastBefore = [...(priceHistory || [])]
        .reverse()
        .find((p) => new Date(p.created_at).getTime() < cutoff)
      const baseP = lastBefore ? lastBefore.spot_price : currentPrice
      items.push({
        price: baseP,
        timestamp: cutoff,
        eventType: 'history_baseline',
        deltaUsdt: 0,
        deltaPlants: 0,
      })
    }

    for (const p of rawFiltered) {
      items.push({
        price: p.spot_price,
        timestamp: new Date(p.created_at).getTime(),
        eventType: p.event_type,
        deltaUsdt: p.delta_usdt ?? 0,
        deltaPlants: p.delta_plants ?? 0,
      })
    }

    // Asegurar que el punto actual en vivo siempre esté al final
    items.push({
      price: currentPrice,
      timestamp: now,
      eventType: rawFiltered.length > 0 ? rawFiltered[rawFiltered.length - 1].event_type : 'current_spot',
      deltaUsdt: 0,
      deltaPlants: 0,
    })

    // Extraer array de precios para calibrar escala Y dinámica
    const allPrices = items.map((i) => i.price)
    const rawMin = Math.min(...allPrices)
    const rawMax = Math.max(...allPrices)
    const priceSpread = rawMax - rawMin

    let minP = rawMin
    let maxP = rawMax

    if (timeframe === 'ALL') {
      minP = Math.min(genesisPrice * 0.95, rawMin * 0.95)
      maxP = rawMax * 1.05
    } else {
      // Zoom dinámico para 1H, 24H y 7D:
      // Si la variación es muy pequeña (< 1%), expandir margen simétrico del 2.5% para que no sea una línea plana
      if (priceSpread < rawMin * 0.01) {
        const margin = Math.max(0.00001, rawMin * 0.025)
        minP = Math.max(0, rawMin - margin)
        maxP = rawMax + margin
      } else {
        const margin = priceSpread * 0.15
        minP = Math.max(0, rawMin - margin)
        maxP = rawMax + margin
      }
    }

    const range = maxP - minP || 0.0001

    // Mapear coordenadas SVG (x de 60 a 820, y de 180 a 35)
    const pts: ProcessedPoint[] = []
    const totalCount = items.length

    for (let i = 0; i < totalCount; i++) {
      const it = items[i]
      const x = totalCount === 1 ? 440 : 60 + (i / (totalCount - 1)) * 760
      const norm = Math.max(0, Math.min(1, (it.price - minP) / range))
      const y = 180 - norm * 145

      const meta = getEventMeta(it.eventType, it.deltaUsdt)
      const d = new Date(it.timestamp)
      const dateStr = d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })

      pts.push({
        x,
        y,
        price: it.price,
        timestamp: it.timestamp,
        dateStr,
        eventType: it.eventType,
        eventLabel: meta.label,
        eventIcon: meta.icon,
        deltaUsdt: it.deltaUsdt,
        deltaPlants: it.deltaPlants,
      })
    }

    const sPrice = pts[0]?.price ?? genesisPrice
    const ePrice = pts[pts.length - 1]?.price ?? currentPrice
    const diff = ePrice - sPrice
    const pct = sPrice > 0 ? (diff / sPrice) * 100 : 0

    return {
      chartPoints: pts,
      minDisplayPrice: minP,
      maxDisplayPrice: maxP,
      xAxisLabels: labels,
      priceChangePct: pct,
      isPositiveTrend: diff >= 0,
      startPrice: sPrice,
      endPrice: ePrice,
    }
  }, [priceHistory, spotPrice, timeframe])

  const svgPathD = useMemo(() => {
    if (chartPoints.length === 0) return ''
    return chartPoints.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
    }, '')
  }, [chartPoints])

  const svgAreaD = useMemo(() => {
    if (chartPoints.length === 0) return ''
    const first = chartPoints[0]
    const last = chartPoints[chartPoints.length - 1]
    return `M ${first.x} 190 L ${first.x} ${first.y} ${chartPoints
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ')} L ${last.x} 190 Z`
  }, [chartPoints])

  if (!isOpen) return null

  const usdtReserves = marketState?.usdtPool ?? 457.8687
  const circulating = marketState?.circulatingSupply ?? 185000000

  // Punto activo para el tooltip (por defecto el último punto en vivo)
  const activePoint = hoveredPoint || (chartPoints.length > 0 ? chartPoints[chartPoints.length - 1] : null)

  const strokeColor = isPositiveTrend ? '#20dba4' : '#ef4444'
  const gradStop1 = isPositiveTrend ? '#19d99c' : '#f87171'

  return (
    <div className="token-modal-backdrop" onClick={handleClose}>
      <div className="token-modal-card amm-curve-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="token-modal-header">
          <div className="token-modal-header-left">
            <span className="token-modal-icon">📈</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="token-modal-title">CURVA DE PRECIO AMM PLANTS / USDT</h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: isPositiveTrend ? 'rgba(32, 219, 164, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isPositiveTrend ? '#20dba4' : '#ef4444',
                    border: `1px solid ${isPositiveTrend ? 'rgba(32, 219, 164, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  }}
                >
                  {isPositiveTrend ? '▲' : '▼'} {Math.abs(priceChangePct).toFixed(2)}% ({timeframe})
                </span>
              </div>
              <p className="token-modal-subtitle">
                Creador de Mercado Automatizado (Bonding Curve) · P = R / V · Escala dinámica y eventos en tiempo real
              </p>
            </div>
          </div>

          <div className="amm-modal-header-actions">
            <div className="summary-chart-filters amm-modal-filters">
              {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={`summary-tf-btn ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setTimeframe(tf)
                    setHoveredPoint(null)
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>

            <button type="button" className="token-modal-close-btn" onClick={handleClose} title="Cerrar">
              ✕
            </button>
          </div>
        </header>

        {/* KPIs Strip */}
        <section className="amm-modal-kpis">
          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">PRECIO SPOT ACTUAL</span>
            <div className="amm-modal-kpi-val-row">
              <strong className="amm-modal-kpi-val text-green">${spotPrice.toFixed(8)}</strong>
              <span className="amm-modal-kpi-tag text-mint">● EN VIVO</span>
            </div>
            <span className="amm-modal-kpi-sub">Fórmula estricta P = R / V</span>
          </div>

          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">VARIACIÓN ({timeframe})</span>
            <div className="amm-modal-kpi-val-row">
              <strong
                className="amm-modal-kpi-val"
                style={{ color: isPositiveTrend ? '#20dba4' : '#ef4444' }}
              >
                {isPositiveTrend ? '+' : ''}
                {priceChangePct.toFixed(2)}%
              </strong>
              <span
                className="amm-modal-kpi-tag"
                style={{
                  background: isPositiveTrend ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  borderColor: isPositiveTrend ? '#10b981' : '#ef4444',
                  color: isPositiveTrend ? '#20dba4' : '#ef4444',
                }}
              >
                {timeframe}
              </span>
            </div>
            <span className="amm-modal-kpi-sub">
              ${startPrice.toFixed(6)} → ${endPrice.toFixed(6)}
            </span>
          </div>

          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">FONDO DE CAPITAL USDT</span>
            <div className="amm-modal-kpi-val-row">
              <strong className="amm-modal-kpi-val text-cyan">${usdtReserves.toFixed(2)} USDT</strong>
            </div>
            <span className="amm-modal-kpi-sub">Descuentos de retiros liquidados</span>
          </div>

          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">SUMINISTRO CIRCULANTE</span>
            <div className="amm-modal-kpi-val-row">
              <strong className="amm-modal-kpi-val text-white">{circulating.toLocaleString()} PLANTS</strong>
            </div>
            <span className="amm-modal-kpi-sub">En manos de la comunidad</span>
          </div>

          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">SEMILLA GÉNESIS</span>
            <div className="amm-modal-kpi-val-row">
              <strong className="amm-modal-kpi-val text-gold">$0.00020000</strong>
              <span className="amm-modal-kpi-tag text-gold">BASE</span>
            </div>
            <span className="amm-modal-kpi-sub">Punto de lanzamiento</span>
          </div>
        </section>

        {/* Chart Viewport */}
        <div
          className="amm-modal-chart-container"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <svg viewBox="0 0 880 215" className="amm-modal-chart-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ammModalDynamicGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradStop1} stopOpacity="0.4" />
                <stop offset="60%" stopColor={gradStop1} stopOpacity="0.1" />
                <stop offset="100%" stopColor={gradStop1} stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="ammLineDynamicGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={isPositiveTrend ? '#38bdf8' : '#f87171'} />
                <stop offset="50%" stopColor={isPositiveTrend ? '#20dba4' : '#ef4444'} />
                <stop offset="100%" stopColor={isPositiveTrend ? '#4ade80' : '#dc2626'} />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Price Labels */}
            <line x1="55" y1="40" x2="835" y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <text x="8" y="44" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">
              ${maxDisplayPrice.toFixed(6)}
            </text>

            <line x1="55" y1="88" x2="835" y2="88" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <text x="8" y="92" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">
              ${((maxDisplayPrice * 0.67) + (minDisplayPrice * 0.33)).toFixed(6)}
            </text>

            <line x1="55" y1="135" x2="835" y2="135" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <text x="8" y="139" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">
              ${((maxDisplayPrice * 0.33) + (minDisplayPrice * 0.67)).toFixed(6)}
            </text>

            <line x1="55" y1="180" x2="835" y2="180" stroke="rgba(255,255,255,0.08)" />
            <text x="8" y="184" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="monospace">
              ${minDisplayPrice.toFixed(6)}
            </text>

            {/* Genesis Reference Line (solo si queda dentro del rango visual) */}
            {0.0002 >= minDisplayPrice && 0.0002 <= maxDisplayPrice && (
              <line
                x1="55"
                y1={180 - Math.max(0, Math.min(1, (0.0002 - minDisplayPrice) / (maxDisplayPrice - minDisplayPrice || 0.0001))) * 145}
                x2="835"
                y2={180 - Math.max(0, Math.min(1, (0.0002 - minDisplayPrice) / (maxDisplayPrice - minDisplayPrice || 0.0001))) * 145}
                stroke="rgba(250, 204, 21, 0.3)"
                strokeDasharray="4 4"
              />
            )}

            {/* Area Fill */}
            {svgAreaD && <path d={svgAreaD} fill="url(#ammModalDynamicGrad)" />}

            {/* Price Curve Line */}
            {svgPathD && (
              <path
                d={svgPathD}
                fill="none"
                stroke="url(#ammLineDynamicGrad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Guideline vertical si hay un punto seleccionado */}
            {activePoint && (
              <line
                x1={activePoint.x}
                y1={35}
                x2={activePoint.x}
                y2={185}
                stroke="rgba(32, 219, 164, 0.4)"
                strokeDasharray="2 2"
                strokeWidth="1.5"
              />
            )}

            {/* Círculos interactivos en cada punto */}
            {chartPoints.map((pt, idx) => {
              const isHovered = hoveredPoint === pt
              const isLast = idx === chartPoints.length - 1
              return (
                <g key={idx}>
                  {/* Zona de impacto táctil invisible más amplia */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={12}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(pt)}
                  />
                  {/* Punto visual */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6.5 : isLast ? 5 : 3}
                    fill={isHovered ? '#38bdf8' : isLast ? strokeColor : '#20dba4'}
                    stroke="#041217"
                    strokeWidth={isHovered ? 3 : isLast ? 2 : 1}
                    style={{ transition: 'r 0.15s ease' }}
                  />
                </g>
              )
            })}

            {/* Tooltip flotante con detalles completos del punto */}
            {activePoint && (
              <g
                transform={`translate(${Math.min(700, Math.max(70, activePoint.x - 90))}, ${Math.max(
                  10,
                  activePoint.y - 48
                )})`}
                style={{ pointerEvents: 'none' }}
              >
                <rect
                  width="180"
                  height="42"
                  rx="6"
                  fill="#041a20"
                  stroke={activePoint === hoveredPoint ? '#38bdf8' : '#20dba4'}
                  strokeWidth="1.5"
                  filter="drop-shadow(0 4px 10px rgba(0,0,0,0.6))"
                />
                <text x="10" y="16" fill="#ffffff" fontSize="10.5" fontWeight="bold">
                  ${activePoint.price.toFixed(8)} USDT
                </text>
                <text x="10" y="28" fill="#38bdf8" fontSize="8" fontWeight="600">
                  {activePoint.eventIcon} {activePoint.eventLabel}
                </text>
                <text x="10" y="38" fill="#94a3b8" fontSize="7">
                  {activePoint.dateStr}
                </text>
              </g>
            )}
          </svg>

          {/* X Axis Labels */}
          <div className="amm-modal-x-labels">
            {xAxisLabels.map((lbl, idx) => (
              <span key={idx} className={idx === xAxisLabels.length - 1 ? 'active' : ''}>
                {lbl}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="token-modal-footer">
          <span className="token-modal-footer-note">
            ℹ️ Todo intercambio y retiro aplica la fórmula estricta P = R / V. El fondo de capital refleja los retiros liquidados y protege la paridad de liquidez de PLANTS.
          </span>
          <button type="button" className="token-modal-btn-primary" onClick={handleClose}>
            ✕ CERRAR
          </button>
        </footer>
      </div>
    </div>
  )
}

export default AmmCurveModal
