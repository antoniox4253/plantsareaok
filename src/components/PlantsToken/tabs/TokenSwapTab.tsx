import React, { useState, useMemo } from 'react'
import { soundManager } from '../../../utils/audioManager'
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
  const [amountStr, setAmountStr] = useState<string>(liquidPlants > 0 ? String(Math.floor(liquidPlants)) : '1000')
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
  // 1 Gema = 0.01 USDT ($10 = 1,000 gemas). Con +20% bono:
  const estimatedGems = parsedAmount > 0 ? (parsedAmount * spotPrice * 1.20) / 0.01 : 0

  // Formato para temporizador de ventana de retiros
  const formatTimer = (secs: number) => {
    const total = secs > 0 ? secs : 3600 * 6 + 60 * 31 + 43
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Filtrado y renderizado dinámico de la Curva AMM según Timeframe y Genesis Seed
  const { chartPoints, minDisplayPrice, maxDisplayPrice, xAxisLabels } = useMemo(() => {
    const now = Date.now()
    let cutoff = 0
    let labels: string[] = []

    if (timeframe === '1H') {
      cutoff = now - 3600 * 1000
      labels = ['-60m', '-45m', '-30m', '-15m', 'Ahora']
    } else if (timeframe === '24H') {
      cutoff = now - 24 * 3600 * 1000
      labels = ['-24h', '-18h', '-12h', '-6h', 'Ahora']
    } else if (timeframe === '7D') {
      cutoff = now - 7 * 24 * 3600 * 1000
      labels = ['Día -7', 'Día -5', 'Día -3', 'Día -1', 'Hoy']
    } else {
      cutoff = 0 // ALL
      labels = ['Génesis Seed', 'Fase Inicial', 'Halving 1', 'Actual']
    }

    // Filtrar puntos por tiempo
    const validHistory = (priceHistory || []).filter((p) => {
      const t = new Date(p.created_at).getTime()
      return isNaN(t) || t >= cutoff
    })

    // El punto de partida de génesis es siempre 0.00020000 USDT
    const genesisPrice = 0.0002
    const currentPrice = spotPrice > 0 ? spotPrice : genesisPrice

    // Si hay pocos puntos históricos, generamos una curva interpolada desde el punto de inicio
    const sampleCount = 14
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
      // Desde el punto de partida (Génesis: 0.00020000) hasta el spot actual
      for (let i = 0; i < sampleCount; i++) {
        const progress = i / (sampleCount - 1)
        const p = genesisPrice + (currentPrice - genesisPrice) * progress
        prices.push(p)
      }
    }

    const minP = Math.min(genesisPrice * 0.95, ...prices) * 0.98
    const maxP = Math.max(currentPrice * 1.05, ...prices) * 1.02
    const range = maxP - minP || 0.0001

    for (let i = 0; i < prices.length; i++) {
      const x = 40 + (i / (prices.length - 1)) * 560
      const p = prices[i]
      const norm = Math.max(0, Math.min(1, (p - minP) / range))
      const y = 145 - norm * 105
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
    return `M ${first.x} 155 L ${first.x} ${first.y} ${chartPoints
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ')} L ${last.x} 155 Z`
  }, [chartPoints])

  const handleMaxClick = () => {
    soundManager.playSound('click', 0.4)
    setAmountStr(String(Math.floor(liquidPlants)))
  }

  const handleSelectSuperSink = () => {
    soundManager.playSound('click', 0.5)
    setSwapMode('gems')
    showNotification(
      '🔥 Super Sink seleccionado: Recibirás un +20% de bono en Gemas y el 100% de tus PLANTS serán quemados.',
      'info'
    )
  }

  const handleSubmit = async () => {
    if (parsedAmount <= 0) {
      showNotification('Por favor ingresa una cantidad válida de PLANTS para canjear.', 'error')
      return
    }
    if (parsedAmount > liquidPlants) {
      showNotification(
        `Saldo líquido insuficiente. Tienes ${liquidPlants.toLocaleString()} PLANTS disponibles para canje o retiro.`,
        'error'
      )
      return
    }

    if (swapMode === 'gems') {
      await onSwapToGems(parsedAmount)
    } else {
      const targetWallet = walletAddress.trim()
      if (!targetWallet || targetWallet.length < 10) {
        showNotification('Por favor ingresa una dirección de wallet BEP-20 válida (BNB Chain) para el retiro.', 'error')
        return
      }
      await onCashoutUsdt(parsedAmount, targetWallet)
    }
  }

  return (
    <div className="token-swap-screen">
      {/* =====================================================
           1. KPI ROW (5 CARDS) - DATOS REALES DE LA BASE DE DATOS
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
            <span className="summary-kpi-sub">
              {spotPrice > 0 ? `${Math.round(1 / spotPrice).toLocaleString()} PLANTS = $1.00 USDT` : '5,000 PLANTS = $1.00 USDT'}
            </span>
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

        {/* PLANTS QUEMADOS TOTAL */}
        <article className="summary-kpi-card">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--orange">
            <span className="summary-kpi-emoji">🔥</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PLANTS QUEMADOS TOTAL</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-orange">{totalBurned.toLocaleString()} PLANTS</strong>
            </div>
            <span className="summary-kpi-sub">Super Sink (+20% Gemas) & Retiros</span>
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
              <span className="summary-kpi-tag summary-kpi-tag--gold">QUEMA DE RETIRO</span>
            </div>
            <span className="summary-kpi-sub">Se quema para resguardo del pool</span>
          </div>
        </article>

        {/* VENTANA DE RETIROS */}
        <article className="summary-kpi-card" title="Cada 24h a las 18:00 UTC-3 se procesa el lote de transferencias USDT a billeteras BEP-20">
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--mint">
            <span className="summary-kpi-emoji">🏦</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">VENTANA DE RETIROS</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-mint">{formatTimer(countdownSeconds)}</strong>
            </div>
            <span className="summary-kpi-sub">Lote diario USDT (18:00 UTC-3)</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           2. MAIN GRID: SWAP WIDGET (45%) + AMM CHART & AUDIT (55%)
           ===================================================== */}
      <section className="swap-main-grid">
        {/* LEFT COLUMN: SWAP WIDGET */}
        <article className="swap-widget-card">
          <div className="swap-widget-header">
            <span className="swap-widget-icon">🔄</span>
            <div>
              <h3 className="swap-widget-title">CONVERTIDOR Y RETIRO DE PLANTS</h3>
              <p className="swap-widget-desc">Canjea a USDT (BEP-20) o aprovecha el Super Sink a Gemas con bono</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="swap-mode-tabs">
            <button
              type="button"
              className={`swap-mode-btn ${swapMode === 'usdt' ? 'active active--usdt' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSwapMode('usdt')
              }}
            >
              💵 PLANTS ➔ USDT (Retiro)
            </button>
            <button
              type="button"
              className={`swap-mode-btn ${swapMode === 'gems' ? 'active active--gems' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSwapMode('gems')
              }}
            >
              💎 PLANTS ➔ GEMAS (+20%)
            </button>
          </div>

          {/* Pay Input Box */}
          <div className="swap-input-box">
            <div className="swap-input-top">
              <span className="swap-input-label">Tú pagas</span>
              <span className="swap-input-balance">
                Líquido disponible: {liquidPlants.toLocaleString()}{' '}
                <button type="button" className="swap-max-btn" onClick={handleMaxClick}>
                  MÁX
                </button>
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
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Swap Direction Icon */}
          <div className="swap-arrow-divider">
            <button
              type="button"
              className="swap-arrow-circle"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSwapMode((prev) => (prev === 'usdt' ? 'gems' : 'usdt'))
              }}
              title="Cambiar modo de conversión"
            >
              ⇅
            </button>
          </div>

          {/* Receive Output Box */}
          <div className="swap-input-box">
            <div className="swap-input-top">
              <span className="swap-input-label">Tú recibes (estimado)</span>
              <span className="swap-rate-note">
                {swapMode === 'usdt'
                  ? `1 PLANTS = ${(spotPrice * 0.95).toFixed(6)} USDT (neto)`
                  : `1 PLANTS = ${(spotPrice * 1.20 / 0.01).toFixed(3)} Gemas (+20%)`}
              </span>
            </div>
            <div className="swap-input-main">
              <div
                className={`swap-token-badge ${
                  swapMode === 'gems' ? 'swap-token-badge--gems' : 'swap-token-badge--receive'
                }`}
              >
                <span>{swapMode === 'usdt' ? '💵 USDT' : '💎 GEMAS (+20%)'}</span>
              </div>
              <div className="swap-receive-val">
                {swapMode === 'usdt'
                  ? `${estimatedUsdt.toFixed(4)} USDT`
                  : `${Math.floor(estimatedGems).toLocaleString()} Gemas`}
              </div>
            </div>
          </div>

          {/* Wallet Address Input for USDT Cashout */}
          {swapMode === 'usdt' && (
            <div className="swap-input-box" style={{ marginTop: '8px' }}>
              <div className="swap-input-top">
                <span className="swap-input-label">Dirección de Billetera de Retiro (BEP-20 / BNB Chain)</span>
              </div>
              <input
                type="text"
                placeholder="0x... (Tu wallet BEP-20 de MetaMask, Trust o Binance)"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(2, 6, 23, 0.7)',
                  border: '1px solid rgba(20, 137, 109, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '11.5px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Slippage Control */}
          <div className="swap-slippage-row">
            <span className="swap-slippage-lbl">⚙️ Tolerancia de Slippage</span>
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
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="button"
            className="swap-confirm-btn"
            disabled={isSubmitting || parsedAmount <= 0}
            onClick={handleSubmit}
          >
            {isSubmitting
              ? 'PROCESANDO...'
              : swapMode === 'gems'
              ? '💎 CANJEAR POR GEMAS (+20% BONO)'
              : '💵 SOLICITAR RETIRO EN USDT'}
          </button>
        </article>

        {/* RIGHT COLUMN: AMM CHART & AUDIT */}
        <div className="swap-right-col">
          {/* AMM Chart with Timeframe Switchers and Genesis Seed */}
          <article className="summary-chart-card swap-chart-card">
            <div className="summary-chart-header">
              <div className="summary-chart-title-wrap">
                <span className="summary-chart-title">📈 CURVA AMM PLANTS / USDT</span>
                <span className="summary-chart-formula">
                  P = R / V · Semilla Génesis: $0.00020000
                </span>
              </div>
              <div className="summary-chart-filters">
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
            </div>

            <div className="summary-chart-canvas">
              <svg viewBox="0 0 640 170" className="summary-chart-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="swapChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#19d99c" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#19d99c" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Guías horizontales con valores de precio reales */}
                <line x1="40" y1="40" x2="600" y2="40" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <text x="42" y="36" fill="rgba(255,255,255,0.35)" fontSize="8.5">
                  ${maxDisplayPrice.toFixed(6)}
                </text>

                <line x1="40" y1="92" x2="600" y2="92" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <text x="42" y="88" fill="rgba(255,255,255,0.35)" fontSize="8.5">
                  ${((maxDisplayPrice + minDisplayPrice) / 2).toFixed(6)}
                </text>

                <line x1="40" y1="145" x2="600" y2="145" stroke="rgba(255,255,255,0.08)" />
                <text x="42" y="141" fill="rgba(255,255,255,0.35)" fontSize="8.5">
                  ${minDisplayPrice.toFixed(6)}
                </text>

                {/* Área y Curva */}
                {svgAreaD && <path d={svgAreaD} fill="url(#swapChartGrad)" />}
                {svgPathD && <path d={svgPathD} fill="none" stroke="#20dba4" strokeWidth="3" />}

                {/* Marcadores de puntos */}
                {chartPoints.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={idx === 0 || idx === chartPoints.length - 1 ? 4.5 : 2}
                    fill={idx === 0 ? '#38bdf8' : idx === chartPoints.length - 1 ? '#20dba4' : '#20dba4'}
                  />
                ))}

                {/* Tooltip en punto actual */}
                {chartPoints.length > 0 && (
                  <g transform={`translate(${chartPoints[chartPoints.length - 1].x - 90}, ${chartPoints[chartPoints.length - 1].y - 32})`}>
                    <rect width="95" height="22" rx="4" fill="#041a20" stroke="#20dba4" strokeWidth="1" />
                    <text x="8" y="15" fill="#20dba4" fontSize="9" fontWeight="bold">
                      ${spotPrice.toFixed(6)}
                    </text>
                  </g>
                )}
              </svg>

              {/* Etiquetas del eje X según el marco temporal */}
              <div className="summary-chart-x-labels">
                {xAxisLabels.map((lbl, idx) => (
                  <span key={idx}>{lbl}</span>
                ))}
              </div>
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
                <span>Cantidad a convertir</span>
                <strong>{parsedAmount.toLocaleString()} PLANTS</strong>
              </div>
              {swapMode === 'usdt' && (
                <>
                  <div className="swap-audit-line">
                    <span>Comisión de resguardo (5%)</span>
                    <strong className="text-orange">- {effectiveFee.toFixed(0)} PLANTS</strong>
                  </div>
                  <div className="swap-audit-line">
                    <span>🔥 Tokens que se quemarán</span>
                    <strong className="text-orange">{effectiveFee.toFixed(0)} PLANTS</strong>
                  </div>
                </>
              )}
              {swapMode === 'gems' && (
                <div className="swap-audit-line">
                  <span>🔥 Quema Super Sink (100%)</span>
                  <strong className="text-orange">{parsedAmount.toLocaleString()} PLANTS</strong>
                </div>
              )}
              <div className="swap-audit-line highlight">
                <span>Recibirás (estimado)</span>
                <strong className={swapMode === 'gems' ? 'text-gold' : 'text-green'}>
                  {swapMode === 'usdt'
                    ? `${estimatedUsdt.toFixed(4)} USDT`
                    : `${Math.floor(estimatedGems).toLocaleString()} GEMAS (+20% BONO)`}
                </strong>
              </div>
            </div>
          </article>

          {/* REGLAS DE RETIRO & SUPER SINK INTERACTIVO */}
          <div className="swap-rules-and-sink">
            <article className="swap-rules-card">
              <h5 className="swap-rules-title">📜 REGLAS Y HORARIOS DE RETIRO</h5>
              <div className="swap-rule-item">
                <span>⏱️ Ventana de retiros:</span> Lotes diarios a las 18:00 (UTC-3).
              </div>
              <div className="swap-rule-item">
                <span>🛡️ Auditoría:</span> Verificación contra bots y partidas fraudulentas.
              </div>
              <div className="swap-rule-item">
                <span>⚔️ Requisito:</span> Arena 3 (2,001+ copas) para retiros en USDT.
              </div>
            </article>

            {/* BOTÓN INTERACTIVO DE SUPER SINK */}
            <button
              type="button"
              className={`swap-sink-card ${swapMode === 'gems' ? 'swap-sink-card--active' : ''}`}
              onClick={handleSelectSuperSink}
              title="Activar canje a Gemas con bono +20%"
            >
              <div className="swap-sink-badge">
                {swapMode === 'gems' ? '✓ MODO SUPER SINK SELECCIONADO' : '💎 ACTIVAR SUPER SINK (PLANTS ➔ GEMAS)'}
              </div>
              <div className="swap-sink-body">
                <span className="swap-sink-bonus">+20% GEMAS BONUS</span>
                <span className="swap-sink-arrow">➔</span>
              </div>
              <p className="swap-sink-desc">
                {swapMode === 'gems'
                  ? 'Modo activo: El monto ingresado se canjeará por gemas con +20% extra.'
                  : 'Haz clic aquí para seleccionar el canje directo a gemas y quemar tus tokens.'}
              </p>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
