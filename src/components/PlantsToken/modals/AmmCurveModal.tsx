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

export const AmmCurveModal: React.FC<AmmCurveModalProps> = ({
  isOpen,
  onClose,
  spotPrice,
  priceHistory = [],
  marketState,
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('24H')

  const handleClose = () => {
    soundManager.playSound('click', 0.4)
    onClose()
  }

  // Cálculo de puntos de la curva AMM con anclaje al punto de inicio (Semilla Génesis: $0.00020000)
  const { chartPoints, minDisplayPrice, maxDisplayPrice, xAxisLabels } = useMemo(() => {
    const now = Date.now()
    let cutoff = 0
    let labels: string[] = []

    if (timeframe === '1H') {
      cutoff = now - 3600 * 1000
      labels = ['-60m', '-45m', '-30m', '-15m', 'Ahora']
    } else if (timeframe === '24H') {
      cutoff = now - 24 * 3600 * 1000
      labels = ['-24h', '-18h', '-12h', '-6h', 'Ahora (En Vivo)']
    } else if (timeframe === '7D') {
      cutoff = now - 7 * 24 * 3600 * 1000
      labels = ['Día -7', 'Día -5', 'Día -3', 'Día -1', 'Hoy']
    } else {
      cutoff = 0 // ALL
      labels = ['Semilla Génesis', 'Fase Inicial', 'Halving PvP', 'Actual']
    }

    const validHistory = (priceHistory || []).filter((p) => {
      const t = new Date(p.created_at).getTime()
      return isNaN(t) || t >= cutoff
    })

    const genesisPrice = 0.0002
    const currentPrice = spotPrice > 0 ? spotPrice : genesisPrice

    const sampleCount = 20
    const pts: { x: number; y: number; price: number }[] = []
    let prices: number[] = []

    if (validHistory.length >= sampleCount) {
      prices = validHistory.slice(-sampleCount).map((p) => p.spot_price)
    } else if (validHistory.length > 1) {
      prices = validHistory.map((p) => p.spot_price)
      while (prices.length < sampleCount) {
        prices.push(currentPrice)
      }
    } else {
      for (let i = 0; i < sampleCount; i++) {
        const progress = i / (sampleCount - 1)
        const p = genesisPrice + (currentPrice - genesisPrice) * progress
        prices.push(p)
      }
    }

    const minP = Math.min(genesisPrice * 0.95, ...prices) * 0.98
    const maxP = Math.max(currentPrice * 1.05, ...prices) * 1.02
    const range = maxP - minP || 0.0001

    // Espacio de trazado: x de 60 a 820, y de 180 (min) a 35 (max)
    for (let i = 0; i < prices.length; i++) {
      const x = 60 + (i / (prices.length - 1)) * 760
      const p = prices[i]
      const norm = Math.max(0, Math.min(1, (p - minP) / range))
      const y = 180 - norm * 140
      pts.push({ x, y, price: p })
    }

    return {
      chartPoints: pts,
      minDisplayPrice: minP,
      maxDisplayPrice: maxP,
      xAxisLabels: labels,
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

  const usdtReserves = marketState?.usdtPool ?? 37000
  const circulating = marketState?.circulatingSupply ?? 185000000

  return (
    <div className="token-modal-backdrop" onClick={handleClose}>
      <div className="token-modal-card amm-curve-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="token-modal-header">
          <div className="token-modal-header-left">
            <span className="token-modal-icon">📈</span>
            <div>
              <h3 className="token-modal-title">CURVA DE PRECIO AMM PLANTS / USDT</h3>
              <p className="token-modal-subtitle">
                Creador de Mercado Automatizado (AMM Bonding Curve) · P = R / V · Semilla Génesis: $0.00020000
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
              <strong className="amm-modal-kpi-val text-green">${spotPrice.toFixed(6)}</strong>
              <span className="amm-modal-kpi-tag text-mint">● EN VIVO</span>
            </div>
            <span className="amm-modal-kpi-sub">Actualización instantánea</span>
          </div>

          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">SEMILLA GÉNESIS</span>
            <div className="amm-modal-kpi-val-row">
              <strong className="amm-modal-kpi-val text-gold">$0.00020000</strong>
              <span className="amm-modal-kpi-tag text-gold">BASE</span>
            </div>
            <span className="amm-modal-kpi-sub">Punto de partida oficial</span>
          </div>

          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">RESERVA DE RESPALDO</span>
            <div className="amm-modal-kpi-val-row">
              <strong className="amm-modal-kpi-val text-cyan">${usdtReserves.toLocaleString()} USDT</strong>
            </div>
            <span className="amm-modal-kpi-sub">37% de recaudación USDT</span>
          </div>

          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">SUMINISTRO CIRCULANTE</span>
            <div className="amm-modal-kpi-val-row">
              <strong className="amm-modal-kpi-val text-white">{circulating.toLocaleString()} PLANTS</strong>
            </div>
            <span className="amm-modal-kpi-sub">Inventario en circulación</span>
          </div>

          <div className="amm-modal-kpi-card">
            <span className="amm-modal-kpi-lbl">MECÁNICA SUPER SINK</span>
            <div className="amm-modal-kpi-val-row">
              <strong className="amm-modal-kpi-val text-mint">+20% GEMAS</strong>
            </div>
            <span className="amm-modal-kpi-sub">100% Quema Anti-Inflación</span>
          </div>
        </section>

        {/* Chart Viewport */}
        <div className="amm-modal-chart-container">
          <svg viewBox="0 0 880 215" className="amm-modal-chart-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ammModalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#19d99c" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#19d99c" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#19d99c" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="ammLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#20dba4" />
                <stop offset="100%" stopColor="#4ade80" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Price Labels */}
            <line x1="55" y1="40" x2="835" y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <text x="12" y="44" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
              ${maxDisplayPrice.toFixed(6)}
            </text>

            <line x1="55" y1="88" x2="835" y2="88" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <text x="12" y="92" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
              ${((maxDisplayPrice * 0.67) + (minDisplayPrice * 0.33)).toFixed(6)}
            </text>

            <line x1="55" y1="135" x2="835" y2="135" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <text x="12" y="139" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
              ${((maxDisplayPrice * 0.33) + (minDisplayPrice * 0.67)).toFixed(6)}
            </text>

            <line x1="55" y1="180" x2="835" y2="180" stroke="rgba(255,255,255,0.08)" />
            <text x="12" y="184" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
              ${minDisplayPrice.toFixed(6)}
            </text>

            {/* Genesis Reference Line */}
            <line
              x1="55"
              y1={180 - Math.max(0, Math.min(1, (0.0002 - minDisplayPrice) / (maxDisplayPrice - minDisplayPrice || 0.0001))) * 140}
              x2="835"
              y2={180 - Math.max(0, Math.min(1, (0.0002 - minDisplayPrice) / (maxDisplayPrice - minDisplayPrice || 0.0001))) * 140}
              stroke="rgba(250, 204, 21, 0.25)"
              strokeDasharray="4 4"
            />

            {/* Area Fill */}
            {svgAreaD && <path d={svgAreaD} fill="url(#ammModalGrad)" />}

            {/* Price Curve Line */}
            {svgPathD && (
              <path
                d={svgPathD}
                fill="none"
                stroke="url(#ammLineGrad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Circles on Nodes */}
            {chartPoints.map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={idx === chartPoints.length - 1 ? 5.5 : 2.5}
                fill={idx === chartPoints.length - 1 ? '#4ade80' : '#20dba4'}
                stroke="#041217"
                strokeWidth={idx === chartPoints.length - 1 ? 2.5 : 1}
              />
            ))}

            {/* Tooltip on Current Point */}
            {chartPoints.length > 0 && (
              <g
                transform={`translate(${Math.min(715, Math.max(70, chartPoints[chartPoints.length - 1].x - 110))}, ${Math.max(
                  15,
                  chartPoints[chartPoints.length - 1].y - 35
                )})`}
              >
                <rect width="115" height="26" rx="6" fill="#041a20" stroke="#20dba4" strokeWidth="1.5" />
                <text x="8" y="14" fill="#20dba4" fontSize="10" fontWeight="bold">
                  ${spotPrice.toFixed(6)} USDT
                </text>
                <text x="8" y="23" fill="#94a3b8" fontSize="7.5">
                  Spot · Tiempo Real
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
            ℹ️ Todo intercambio y retiro aplica la fórmula estricta P = R / V. La tarifa del 5% en retiros se quema permanentemente protegiendo la liquidez.
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
