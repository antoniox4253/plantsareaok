import React, { useState, useMemo } from 'react'
import type { TokenHubSharedProps, Timeframe } from '../types'
import { TOKEN_ASSETS } from '../tokenAssets'

export const TokenSwapTab: React.FC<TokenHubSharedProps> = ({
  userTokens,
  userElo,
  priceHistory,
  liquidPlants,
  totalPlants,
  spotPrice,
  poolUsdt,
  totalBurned,
  isArena3Plus,
  isSubmitting,
  onSwapToGems,
  onCashoutUsdt,
  showNotification,
}) => {
  const [swapMode, setSwapMode] = useState<'plants-usdt' | 'plants-gems'>('plants-usdt')
  const [payAmount, setPayAmount] = useState<string>('')
  const [slippage, setSlippage] = useState<number>(1)
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [timeframe, setTimeframe] = useState<Timeframe>('24H')

  const parsedAmount = parseFloat(payAmount) || 0

  // Cálculo de recepción
  const feeRate = 0.05 // 5% fee de retiro (100% a quema)
  const feePlants = parsedAmount * feeRate
  const netPlants = Math.max(0, parsedAmount - feePlants)

  // En modo USDT: precio spot * netPlants
  const estimatedUsdt = netPlants * spotPrice

  // En modo Gemas: PLANTS quemados * factor de gemas (+20% bonus)
  // Base: 1000 gemas / 2500 plants = 0.40 gemas/plant. Con +20% extra = 0.48 gemas/plant
  const gemsPerPlant = 0.48
  const estimatedGems = Math.round(parsedAmount * gemsPerPlant)

  const handleMaxClick = () => {
    if (swapMode === 'plants-usdt') {
      setPayAmount(String(Math.floor(liquidPlants * 100) / 100))
    } else {
      setPayAmount(String(Math.floor(totalPlants * 100) / 100))
    }
  }

  const handleExecute = async () => {
    if (parsedAmount <= 0) {
      showNotification('Ingresa un monto válido mayor a 0 para realizar la operación', 'error')
      return
    }

    if (swapMode === 'plants-usdt') {
      if (!isArena3Plus) {
        showNotification(
          `El retiro en USDT requiere alcanzar al menos Arena 3 (2,001+ copas). Tu ELO actual es de ${userElo} copas`,
          'error'
        )
        return
      }
      if (parsedAmount > liquidPlants) {
        showNotification(
          `Saldo líquido insuficiente para retiro. Tienes ${liquidPlants.toFixed(2)} PLANTS líquidos disponibles (los tokens en vesting se liberan diariamente)`,
          'error'
        )
        return
      }
      const trimmed = walletAddress.trim()
      if (!trimmed || !trimmed.startsWith('0x') || trimmed.length !== 42) {
        showNotification('Ingresa una dirección de billetera BEP-20 válida (formato 0x... de 42 caracteres)', 'error')
        return
      }
      await onCashoutUsdt(parsedAmount, trimmed)
      setPayAmount('')
    } else {
      // Modo Gemas
      if (parsedAmount > totalPlants) {
        showNotification(`Saldo insuficiente. Tienes ${totalPlants.toFixed(2)} PLANTS en tu cuenta`, 'error')
        return
      }
      await onSwapToGems(parsedAmount)
      setPayAmount('')
    }
  }

  // Gráfica SVG AMM
  const chartPoints = useMemo(() => {
    const history = priceHistory.length > 0 ? priceHistory : []
    const pointsCount = Math.max(history.length, 14)
    const pts: { x: number; y: number }[] = []

    for (let i = 0; i < pointsCount; i++) {
      const x = 30 + (i / (pointsCount - 1)) * 580
      let p = spotPrice
      if (history[i]) {
        p = history[i].spot_price
      } else {
        const factor = 0.94 + Math.sin(i * 0.6) * 0.06 + (i / pointsCount) * 0.1
        p = spotPrice * factor
      }
      const minP = spotPrice * 0.8
      const maxP = spotPrice * 1.3
      const norm = Math.max(0, Math.min(1, (p - minP) / (maxP - minP || 1)))
      const y = 180 - norm * 120
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

  return (
    <div className="swap-screen">
      {/* =====================================================
           SWAP HERO BANNER
           ===================================================== */}
      <section
        className="swap-hero"
        data-section="swap-hero"
        data-label="SWAP HERO"
        style={
          TOKEN_ASSETS.swapHeroBanner
            ? { backgroundImage: `url(${TOKEN_ASSETS.swapHeroBanner})`, backgroundSize: 'cover' }
            : {}
        }
      >
        <div className="swap-hero__content">
          <div className="swap-hero__tag">🔄 MERCADO AMM & SUPER SINK DEFLACIONARIO</div>
          <h1 className="swap-hero__title">INTERCAMBIO DE TOKENS, RETIROS & QUEMAS</h1>
          <p className="swap-hero__desc">
            Intercambia tus tokens PLANTS con liquidez pública garantizada en la curva AMM. Si decides retirar a tu billetera BEP-20 en <strong>USDT</strong>, requieres alcanzar <strong>Arena 3 (2,001+ copas)</strong> para proteger la economía. Si prefieres potenciar tu jardín, usa <strong>Super Sink</strong> para recibir un <strong>+20% extra en Gemas</strong> con quema instantánea de tokens.
          </p>

          <div className="swap-hero__chips" style={{ marginBottom: '6px' }}>
            <span className="hero-chip">💵 Retiros a Billetera BEP-20 (BSC)</span>
            <span className="hero-chip">🔥 100% de la Comisión (5%) Quemada de por Vida</span>
            <span className="hero-chip">💎 Super Sink: +20% Bono en Gemas Sin Restricción de Arena</span>
          </div>
        </div>
      </section>

      {/* =====================================================
           SWAP KPIs ROW
           ===================================================== */}
      <section className="kpi-grid" data-section="swap-kpi-row" data-label="SWAP KPIs">
        <article className="kpi-card" data-section="kpi-spot-price" data-label="SPOT PRICE">
          <div className="kpi-icon-slot">💎</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">PRECIO SPOT AMM</span>
            <strong className="kpi-value">${spotPrice.toFixed(6)} USDT</strong>
            <span className="kpi-sub">Curva P = R / V en tiempo real</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-liquidity-pool" data-label="LIQUIDITY POOL">
          <div className="kpi-icon-slot">🏦</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">FONDO DE RESERVA USDT</span>
            <strong className="kpi-value text-green">${poolUsdt.toFixed(2)} USDT</strong>
            <span className="kpi-sub">Respaldo total disponible</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-burned-today" data-label="BURNED TODAY">
          <div className="kpi-icon-slot">🔥</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">TOKENS QUEMADOS TOTAL</span>
            <strong className="kpi-value text-orange">{totalBurned.toLocaleString()} PLANTS</strong>
            <span className="kpi-sub">Super Sink + fees incinerados</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-cashout-fee" data-label="CASHOUT FEE">
          <div className="kpi-icon-slot">⚖️</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">TARIFA DE RETIRO</span>
            <strong className="kpi-value text-cyan">5% (100% Destinado a Quema)</strong>
            <span className="kpi-sub">Deflación para sostener el precio</span>
          </div>
        </article>

        <article className="kpi-card" data-section="kpi-next-window" data-label="NEXT WINDOW">
          <div className="kpi-icon-slot">🚪</div>
          <div className="kpi-content-slot">
            <span className="kpi-label">ESTADO DE RETIRO BEP-20</span>
            <strong className={`kpi-value ${isArena3Plus ? 'text-green' : 'text-gold'}`}>
              {isArena3Plus ? 'HABILITADO (ARENA 3+)' : 'BLOQUEADO (REQUIERE ARENA 3)'}
            </strong>
            <span className="kpi-sub">Tus copas: {userElo} / 2,001 requeridas</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           MAIN ROW: SWAP FORM + CHART & DETAILS
           ===================================================== */}
      <section className="main-grid">
        {/* Swap Form Panel */}
        <article className="swap-panel" data-section="swap-form" data-label="SWAP FORM">
          <div className="panel-heading-slot" data-section="swap-form-heading">
            <h4 className="panel-heading-title">INTERCAMBIAR TOKENS</h4>
            <span className="panel-heading-badge text-green">OPERACIÓN SEGURA</span>
          </div>

          <div className="swap-mode-tabs" data-section="swap-mode-tabs">
            <button
              type="button"
              className={`swap-mode ${swapMode === 'plants-usdt' ? 'active' : ''}`}
              data-mode="plants-usdt"
              onClick={() => setSwapMode('plants-usdt')}
            >
              💵 PLANTS ➔ USDT (RETIRO BEP-20)
            </button>
            <button
              type="button"
              className={`swap-mode ${swapMode === 'plants-gems' ? 'active' : ''}`}
              data-mode="plants-gems"
              onClick={() => setSwapMode('plants-gems')}
            >
              💎 PLANTS ➔ GEMAS (+20% SUPER SINK)
            </button>
          </div>

          {/* Input Pagar */}
          <div className="swap-input-card" data-section="swap-pay-section">
            <div className="swap-input-label-slot">
              <span>Pagas (Desde tu saldo):</span>
              <span className="text-gold">
                Disponible:{' '}
                {swapMode === 'plants-usdt' ? `${liquidPlants.toFixed(2)} Líquidos` : `${totalPlants.toFixed(2)} Totales`}
              </span>
            </div>

            <div className="swap-input-content">
              <div className="swap-asset-slot" data-section="swap-pay-asset">
                <span className="asset-token-badge">🌱 PLANTS</span>
              </div>

              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="swap-value-slot"
                data-section="swap-pay-value"
              />

              <button
                type="button"
                className="swap-max-slot"
                data-section="swap-max-button"
                onClick={handleMaxClick}
              >
                MÁX
              </button>
            </div>
          </div>

          {/* Direction Arrow */}
          <div className="swap-arrow-slot" data-section="swap-direction-control">
            <span>↓</span>
          </div>

          {/* Output Recibir */}
          <div className="swap-input-card" data-section="swap-receive-section">
            <div className="swap-input-label-slot">
              <span>Recibes estimado:</span>
              <span className="text-cyan">
                {swapMode === 'plants-usdt' ? 'Respaldo 100% USDT en Bóveda' : `Tienes: ${userTokens.toLocaleString()} 💎 (+20% bonus aplicado)`}
              </span>
            </div>

            <div className="swap-input-content">
              <div className="swap-asset-slot" data-section="swap-receive-asset">
                <span className="asset-token-badge">
                  {swapMode === 'plants-usdt' ? '💵 USDT BEP-20' : '💎 GEMAS'}
                </span>
              </div>

              <div className="swap-value-slot text-green" data-section="swap-receive-value">
                {swapMode === 'plants-usdt' ? `$${estimatedUsdt.toFixed(4)} USDT` : `+${estimatedGems.toLocaleString()} 💎`}
              </div>

              <div className="swap-max-slot text-muted" data-section="swap-rate-preview">
                {swapMode === 'plants-usdt' ? 'Tarifa: 5%' : '+20% Extra'}
              </div>
            </div>
          </div>

          {/* Wallet address if USDT */}
          {swapMode === 'plants-usdt' && (
            <div className="swap-wallet-input-wrap">
              <label className="swap-wallet-label">DIRECCIÓN BILLETERA BEP-20 (BNB SMART CHAIN):</label>
              <input
                type="text"
                placeholder="0x... (Pega tu dirección pública de 42 caracteres)"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="swap-wallet-input"
              />
              {!isArena3Plus && (
                <div className="swap-arena-warning">
                  ⚠️ El retiro de USDT a billetera externa requiere alcanzar <strong>Arena 3 (2,001+ copas)</strong> para prevenir bots. Tu ELO actual es de {userElo} copas. Puedes canjear en cualquier momento a <strong>Gemas con +20% bonus</strong> sin restricción de copa.
                </div>
              )}
            </div>
          )}

          {/* Slippage Selector */}
          <div className="slippage-row" data-section="slippage-control">
            <div className="slippage-slot label" data-section="slippage-label">
              Tolerancia Deslizamiento:
            </div>
            {[0.5, 1, 3].map((val) => (
              <button
                key={val}
                type="button"
                className={`slippage-slot btn ${slippage === val ? 'active' : ''}`}
                data-slippage={val}
                onClick={() => setSlippage(val)}
              >
                {val}%
              </button>
            ))}
            <button
              type="button"
              className={`slippage-slot btn ${slippage === 5 ? 'active' : ''}`}
              data-slippage="custom"
              onClick={() => setSlippage(5)}
            >
              5%
            </button>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            className="swap-confirm"
            data-action="confirm-swap"
            disabled={isSubmitting || parsedAmount <= 0}
            onClick={handleExecute}
          >
            {isSubmitting
              ? 'PROCESANDO TRANSACCIÓN EN BÓVEDA...'
              : swapMode === 'plants-usdt'
              ? !isArena3Plus
                ? 'BLOQUEADO: REQUIERE ARENA 3 (2,001+ COPAS)'
                : `RETIRAR $${estimatedUsdt.toFixed(2)} USDT A BILLETERA`
              : `CANJEAR POR +${estimatedGems.toLocaleString()} GEMAS (+20% BONUS)`}
          </button>
        </article>

        {/* Chart + Details Column */}
        <section className="swap-chart-col">
          <article className="chart-panel" data-section="amm-chart" data-label="AMM CHART">
            <div className="chart-toolbar">
              <div className="chart-title-slot" data-section="amm-chart-title">
                <span className="chart-title-text">PROFUNDIDAD DE LIQUIDEZ & IMPACTO DE PRECIO</span>
              </div>
              <div className="chart-filter-slot" data-section="amm-chart-filters">
                {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`chart-tf-btn ${timeframe === tf ? 'active' : ''}`}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="chart-area" data-section="amm-chart-area">
              <svg viewBox="0 0 640 220" className="chart-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="swapChartGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#20dda3" />
                    <stop offset="100%" stopColor="#29bdf6" />
                  </linearGradient>
                </defs>

                <line x1="30" y1="50" x2="610" y2="50" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <line x1="30" y1="110" x2="610" y2="110" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <line x1="30" y1="170" x2="610" y2="170" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />

                {svgPathD && <path d={svgPathD} fill="none" stroke="url(#swapChartGrad)" strokeWidth="3" />}
                {chartPoints.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={idx === chartPoints.length - 1 ? 5 : 3}
                    className={idx === chartPoints.length - 1 ? 'chart-point-pulse' : 'chart-point'}
                  />
                ))}
              </svg>
            </div>
          </article>

          {/* Info Grid: Operation preview + Super Sink */}
          <div className="info-grid">
            <article className="operation-panel" data-section="operation-preview" data-label="OPERATION PREVIEW">
              <div className="panel-heading-slot">
                <h5 className="panel-heading-title">DESGLOSE DE LA OPERACIÓN</h5>
                <span className="panel-heading-badge text-cyan">AUDITORÍA</span>
              </div>

              <div className="operation-list">
                <div className="operation-row" data-section="operation-amount">
                  <span className="op-label">Monto Bruto a Operar:</span>
                  <strong className="op-val">{parsedAmount.toFixed(2)} PLANTS</strong>
                </div>

                <div className="operation-row" data-section="operation-fee">
                  <span className="op-label">Comisión de Protocolo (5%):</span>
                  <strong className="op-val text-orange">-{feePlants.toFixed(2)} PLANTS</strong>
                </div>

                <div className="operation-row" data-section="operation-burn">
                  <span className="op-label">Quema Efectiva de Suministro:</span>
                  <strong className="op-val text-red">
                    {swapMode === 'plants-gems' ? `🔥 ${parsedAmount.toFixed(2)} PLANTS (100%)` : `🔥 ${feePlants.toFixed(2)} PLANTS (5%)`}
                  </strong>
                </div>

                <div className="operation-row" data-section="operation-estimated-price">
                  <span className="op-label">Cotización Spot AMM:</span>
                  <strong className="op-val text-green">${spotPrice.toFixed(6)} USDT</strong>
                </div>

                <div className="operation-row" data-section="operation-net">
                  <span className="op-label">Recibes Neto Estimado:</span>
                  <strong className="op-val text-gold">
                    {swapMode === 'plants-usdt' ? `$${estimatedUsdt.toFixed(2)} USDT` : `+${estimatedGems.toLocaleString()} Gemas 💎`}
                  </strong>
                </div>
              </div>
            </article>

            <div className="right-stack">
              <aside className="super-sink-panel" data-section="super-sink-panel" data-label="SUPER SINK">
                <div className="super-sink-image-slot">
                  <span className="super-sink-icon">🔥💎</span>
                </div>
                <div className="super-sink-copy-slot">
                  <strong>SUPER SINK (+20% GEMAS)</strong>
                  <p>
                    Canjea tus PLANTS por Gemas para recibir un bono inmediato del <strong>+20%</strong>. El 100% de los tokens canjeados son incinerados para siempre, reduciendo el suministro y elevando el valor de los restantes.
                  </p>
                </div>
                <div className="super-sink-arrow-slot">⚡</div>
              </aside>
            </div>
          </div>
        </section>
      </section>
    </div>
  )
}
