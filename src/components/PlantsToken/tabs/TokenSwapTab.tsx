import React, { useState, useMemo } from 'react'
import type { TokenHubSharedProps, Timeframe } from '../types'

export const TokenSwapTab: React.FC<TokenHubSharedProps> = ({
  liquidPlants,
  spotPrice,
  poolUsdt,
  totalBurned,
  priceHistory,
  countdownSeconds,
  isSubmitting,
  onSwapToGems,
  onCashoutUsdt,
  showNotification,
}) => {
  const [swapMode, setSwapMode] = useState<'usdt' | 'gems'>('usdt')
  const [amountStr, setAmountStr] = useState<string>('10000')
  const [slippage, setSlippage] = useState<number>(1)
  const [timeframe, setTimeframe] = useState<Timeframe>('24H')
  const [walletAddress, setWalletAddress] = useState<string>('')

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amountStr)
    return isNaN(n) || n <= 0 ? 0 : n
  }, [amountStr])

  const effectiveFee = parsedAmount * 0.05
  const netPlants = Math.max(0, parsedAmount - effectiveFee)
  const estimatedUsdt = netPlants * spotPrice
  const estimatedGems = parsedAmount * (1 / spotPrice) * 1.2 // +20% bonus

  // Formato para temporizador de ventana
  const formatTimer = (secs: number) => {
    const total = secs > 0 ? secs : 3600 * 6 + 60 * 31 + 43
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Gráfica AMM
  const chartPoints = useMemo(() => {
    const history = priceHistory.length > 0 ? priceHistory : []
    const pointsCount = Math.max(history.length, 14)
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < pointsCount; i++) {
      const x = 30 + (i / (pointsCount - 1)) * 580
      const factor = 0.88 + (i / pointsCount) * 0.35
      const p = spotPrice * factor
      const minP = spotPrice * 0.6
      const maxP = spotPrice * 1.5
      const norm = Math.max(0, Math.min(1, (p - minP) / (maxP - minP || 1)))
      const y = 145 - norm * 105
      pts.push({ x, y })
    }
    return pts
  }, [priceHistory, spotPrice])

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
    return `M ${first.x} 165 L ${first.x} ${first.y} ${chartPoints
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ')} L ${last.x} 165 Z`
  }, [chartPoints])

  const handleMaxClick = () => {
    setAmountStr(String(Math.floor(liquidPlants || 250000)))
  }

  const handleSubmit = async () => {
    if (parsedAmount <= 0) return
    if (swapMode === 'gems') {
      await onSwapToGems(parsedAmount)
    } else {
      const targetWallet = walletAddress.trim()
      if (!targetWallet || targetWallet.length < 10) {
        showNotification('Por favor ingresa una dirección de wallet BEP-20 válida para el retiro.', 'error')
        return
      }
      await onCashoutUsdt(parsedAmount, targetWallet)
    }
  }

  return (
    <div className="token-swap-screen">
      {/* =====================================================
           1. KPI ROW (5 CARDS)
           ===================================================== */}
      <section className="summary-kpi-grid swap-kpi-grid" data-section="swap-kpi-row">
        {/* PRECIO SPOT */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--green">
            <span className="summary-kpi-emoji">💲</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PRECIO SPOT</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-green">${spotPrice.toFixed(6)} USDT</strong>
              <span className="summary-kpi-tag summary-kpi-tag--green">LIVE AMM</span>
            </div>
            <span className="summary-kpi-sub">5,000 PLANTS = $1.00 USDT</span>
          </div>
        </article>

        {/* POOL DE LIQUIDEZ */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--blue">
            <span className="summary-kpi-emoji">💧</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">POOL DE LIQUIDEZ</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-cyan">${poolUsdt.toFixed(2)} USDT</strong>
              <span className="summary-kpi-tag summary-kpi-tag--blue">100% RESPALDADO</span>
            </div>
            <span className="summary-kpi-sub">60% Preventas + 70% Gemas Inyectadas</span>
          </div>
        </article>

        {/* PLANTS QUEMADOS HOY */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--orange">
            <span className="summary-kpi-emoji">🔥</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PLANTS QUEMADOS HOY</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-orange">{(totalBurned || 1245000).toLocaleString()} PLANTS</strong>
            </div>
            <span className="summary-kpi-sub">Super Sink (+20% Gemas)</span>
          </div>
        </article>

        {/* COMISIÓN CASH-OUT */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--gold">
            <span className="summary-kpi-emoji">🪙</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">COMISIÓN CASH-OUT</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-gold">5%</strong>
              <span className="summary-kpi-tag summary-kpi-tag--gold">QUEMA DE PLANTS</span>
            </div>
            <span className="summary-kpi-sub">Se quema al realizar el retiro</span>
          </div>
        </article>

        {/* PRÓXIMA VENTANA */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--mint">
            <span className="summary-kpi-emoji">⏱️</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PRÓXIMA VENTANA</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-mint">{formatTimer(countdownSeconds)}</strong>
            </div>
            <span className="summary-kpi-sub">HOY 18:00 (UTC-3)</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           3. MAIN GRID: SWAP WIDGET (45%) + AMM CHART & AUDIT (55%)
           ===================================================== */}
      <section className="swap-main-grid">
        {/* LEFT COLUMN: SWAP WIDGET */}
        <article className="swap-widget-card">
          <div className="swap-widget-header">
            <span className="swap-widget-icon">🔄</span>
            <div>
              <h3 className="swap-widget-title">REALIZAR SWAP</h3>
              <p className="swap-widget-desc">Convierte tus PLANTS a USDT o Gemas de forma segura</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="swap-mode-tabs">
            <button
              type="button"
              className={`swap-mode-btn ${swapMode === 'usdt' ? 'active active--usdt' : ''}`}
              onClick={() => setSwapMode('usdt')}
            >
              🌱 PLANTS ➔ USDT
            </button>
            <button
              type="button"
              className={`swap-mode-btn ${swapMode === 'gems' ? 'active active--gems' : ''}`}
              onClick={() => setSwapMode('gems')}
            >
              💎 PLANTS ➔ GEMAS
            </button>
          </div>

          {/* Pay Input Box */}
          <div className="swap-input-box">
            <div className="swap-input-top">
              <span className="swap-input-label">Tú pagas</span>
              <span className="swap-input-balance">
                Balance: {(liquidPlants || 250000).toLocaleString()}{' '}
                <button type="button" className="swap-max-btn" onClick={handleMaxClick}>MÁX</button>
              </span>
            </div>
            <div className="swap-input-main">
              <div className="swap-token-badge">
                <span>🌱 PLANTS</span>
              </div>
              <input
                type="number"
                className="swap-field"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.0"
              />
            </div>
          </div>

          {/* Swap Direction Icon */}
          <div className="swap-arrow-divider">
            <button type="button" className="swap-arrow-circle" onClick={() => setSwapMode(prev => prev === 'usdt' ? 'gems' : 'usdt')}>
              ⇅
            </button>
          </div>

          {/* Receive Output Box */}
          <div className="swap-input-box">
            <div className="swap-input-top">
              <span className="swap-input-label">Tú recibes (estimado)</span>
              <span className="swap-rate-note">
                1 PLANTS = {(spotPrice * 0.95).toFixed(6)} USDT
              </span>
            </div>
            <div className="swap-input-main">
              <div className="swap-token-badge swap-token-badge--receive">
                <span>{swapMode === 'usdt' ? '💵 USDT' : '💎 GEMAS'}</span>
              </div>
              <div className="swap-receive-val">
                {swapMode === 'usdt' ? estimatedUsdt.toFixed(4) : Math.floor(estimatedGems).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Wallet Address Input for USDT Cashout */}
          {swapMode === 'usdt' && (
            <div className="swap-input-box" style={{ marginTop: '8px' }}>
              <div className="swap-input-top">
                <span className="swap-input-label">Dirección Wallet de Retiro (BEP-20 / BNB Chain)</span>
              </div>
              <input
                type="text"
                placeholder="0x... (Tu wallet BEP-20 de MetaMask/Trust)"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(2, 6, 23, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Slippage Control */}
          <div className="swap-slippage-row">
            <span className="swap-slippage-lbl">⚙️ Slippage</span>
            <div className="swap-slippage-pills">
              {[0.5, 1, 3].map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`swap-slip-pill ${slippage === val ? 'active' : ''}`}
                  onClick={() => setSlippage(val)}
                >
                  {val}%
                </button>
              ))}
              <button type="button" className="swap-slip-pill">Personalizado</button>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="button"
            className="swap-confirm-btn"
            disabled={isSubmitting || parsedAmount <= 0}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'PROCESANDO...' : '🔄 CONFIRMAR SWAP'}
          </button>
        </article>

        {/* RIGHT COLUMN: AMM CHART & AUDIT */}
        <div className="swap-right-col">
          {/* AMM Mini Chart */}
          <article className="summary-chart-card swap-chart-card">
            <div className="summary-chart-header">
              <div className="summary-chart-title-wrap">
                <span className="summary-chart-title">📈 CURVA AMM PLANTS / USDT</span>
                <span className="summary-chart-formula">P = R / V (K = 200M)</span>
              </div>
              <div className="summary-chart-filters">
                {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`summary-tf-btn ${timeframe === tf ? 'active' : ''}`}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="summary-chart-canvas">
              <svg viewBox="0 0 640 170" className="summary-chart-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="swapChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#19d99c" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#19d99c" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line x1="30" y1="40" x2="620" y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="30" y1="90" x2="620" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="30" y1="140" x2="620" y2="140" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                {svgAreaD && <path d={svgAreaD} fill="url(#swapChartGrad)" />}
                {svgPathD && <path d={svgPathD} fill="none" stroke="#20dba4" strokeWidth="3" />}
              </svg>
            </div>
          </article>

          {/* VISTA PREVIA DE LA OPERACIÓN */}
          <article className="swap-audit-card">
            <div className="swap-audit-header">
              <span className="swap-audit-icon">📄</span>
              <h4 className="swap-audit-title">VISTA PREVIA DE LA OPERACIÓN</h4>
            </div>

            <div className="swap-audit-rows">
              <div className="swap-audit-line">
                <span>Cantidad de PLANTS a vender</span>
                <strong>{parsedAmount.toLocaleString()} PLANTS</strong>
              </div>
              <div className="swap-audit-line">
                <span>Comisión de cash-out (5%)</span>
                <strong className="text-orange">- {effectiveFee.toFixed(0)} PLANTS</strong>
              </div>
              <div className="swap-audit-line">
                <span>🔥 PLANTS que se quemarán</span>
                <strong className="text-orange">{effectiveFee.toFixed(0)} PLANTS</strong>
              </div>
              <div className="swap-audit-line">
                <span>Precio estimado</span>
                <strong>1 PLANTS = {(spotPrice * 0.95).toFixed(6)} USDT</strong>
              </div>
              <div className="swap-audit-line highlight">
                <span>Recibirás (estimado)</span>
                <strong className="text-green">
                  {swapMode === 'usdt' ? `${estimatedUsdt.toFixed(4)} USDT` : `${Math.floor(estimatedGems).toLocaleString()} GEMAS`}
                </strong>
              </div>
            </div>
          </article>

          {/* REGLAS DE RETIRO & SUPER SINK */}
          <div className="swap-rules-and-sink">
            <article className="swap-rules-card">
              <h5 className="swap-rules-title">📜 REGLAS DE RETIRO</h5>
              <div className="swap-rule-item">
                <span>⏱️ Ventanas de retiro:</span> Cada 24 horas (18:00 UTC-3)
              </div>
              <div className="swap-rule-item">
                <span>🛡️ Proceso de revisión:</span> Los retiros se procesan en 24h
              </div>
              <div className="swap-rule-item">
                <span>🔥 Se quema PLANTS:</span> El cash-out quema tokens de forma permanente
              </div>
            </article>

            {/* SUPER SINK BANNER */}
            <article className="swap-sink-card" onClick={() => setSwapMode('gems')}>
              <div className="swap-sink-badge">💎 SUPER SINK (PLANTS ➔ GEMAS)</div>
              <div className="swap-sink-body">
                <span className="swap-sink-bonus">+20% GEMAS</span>
                <span className="swap-sink-arrow">➔</span>
              </div>
              <p className="swap-sink-desc">Mejor valor y apoyo directo al ecosistema</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  )
}
