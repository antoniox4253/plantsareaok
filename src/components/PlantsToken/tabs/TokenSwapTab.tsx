import React, { useState, useMemo, useEffect } from 'react'
import { soundManager } from '../../../utils/audioManager'
import type { TokenHubSharedProps } from '../types'
import { AmmCurveModal } from '../modals/AmmCurveModal'
import { StakingModal } from '../modals/StakingModal'
import { plantsTokenService, type StakingSummary } from '../../../services/plantsTokenService'

export const TokenSwapTab: React.FC<TokenHubSharedProps> = ({
  liquidPlants,
  spotPrice,
  poolUsdt,
  totalBurned,
  priceHistory,
  marketState,
  countdownSeconds,
  isSubmitting,
  onSwapToGems,
  onCashoutUsdt,
  onTabChange,
  onRefreshData,
  showNotification,
}) => {
  const [swapMode, setSwapMode] = useState<'usdt' | 'gems'>('usdt')
  const [amountStr, setAmountStr] = useState<string>(liquidPlants > 0 ? String(Math.floor(liquidPlants)) : '1000')
  const [slippage, setSlippage] = useState<number>(1)
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [isAmmModalOpen, setIsAmmModalOpen] = useState<boolean>(false)
  const [isStakingModalOpen, setIsStakingModalOpen] = useState<boolean>(false)
  const [stakingSummary, setStakingSummary] = useState<StakingSummary | null>(null)

  useEffect(() => {
    let isMounted = true
    plantsTokenService.getMyStakingPositions().then((summary) => {
      if (isMounted && summary) setStakingSummary(summary)
    })
    const timer = setInterval(() => {
      plantsTokenService.getMyStakingPositions().then((summary) => {
        if (isMounted && summary) setStakingSummary(summary)
      })
    }, 10000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

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

        {/* RIGHT COLUMN: AMM LAUNCHER, AUDIT & RULES */}
        <div className="swap-right-col">
          {/* BOTÓN / TARJETA INTERACTIVA DE ACCESO A LA PANTALLA DEDICADA DE CURVA AMM */}
          <article
            className="swap-amm-launcher-card"
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setIsAmmModalOpen(true)
            }}
            title="Abrir la Curva AMM en pantalla completa dedicada"
          >
            <div className="swap-amm-launcher-top">
              <div className="swap-amm-launcher-title-wrap">
                <span className="swap-amm-launcher-icon">📈</span>
                <div>
                  <h4 className="swap-amm-launcher-title">CURVA AMM PLANTS / USDT</h4>
                  <span className="swap-amm-launcher-sub">
                    P = R / V · Semilla Génesis: $0.00020000
                  </span>
                </div>
              </div>
              <div className="swap-amm-launcher-price-badge">
                <span className="swap-amm-launcher-price-lbl">SPOT</span>
                <strong className="swap-amm-launcher-price-val">${spotPrice.toFixed(6)}</strong>
              </div>
            </div>

            <div className="swap-amm-launcher-preview">
              <div className="swap-amm-launcher-stats">
                <span>🛡️ Respaldo: $37,000 USDT</span>
                <span>💎 Paridad: 1.00x</span>
                <span>🪙 185M Circulante</span>
              </div>
              <button
                type="button"
                className="swap-amm-launcher-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  soundManager.playSound('click', 0.4)
                  setIsAmmModalOpen(true)
                }}
              >
                <span>📊 VER CURVA AMM COMPLETA</span>
                <span className="swap-amm-launcher-arrow">➔</span>
              </button>
            </div>
          </article>

          {/* SECCIÓN DIVIDIDA EN 2: VISTA PREVIA DE OPERACIÓN + SECCIÓN DE STAKING */}
          <div className="swap-audit-staking-grid">
            {/* 1. INFORMACIÓN DE VISTA PREVIA DE LA OPERACIÓN */}
            <article className="swap-audit-card">
              <div className="swap-audit-header">
                <span className="swap-audit-icon">📄</span>
                <h4 className="swap-audit-title">VISTA PREVIA OPERACIÓN</h4>
              </div>

              <div className="swap-audit-rows">
                <div className="swap-audit-line">
                  <span>Monto a convertir</span>
                  <strong>{parsedAmount.toLocaleString()} PLANTS</strong>
                </div>
                {swapMode === 'usdt' && (
                  <>
                    <div className="swap-audit-line">
                      <span>Comisión (5%)</span>
                      <strong className="text-orange">- {effectiveFee.toFixed(0)} PLANTS</strong>
                    </div>
                    <div className="swap-audit-line">
                      <span>🔥 Quema de retiro</span>
                      <strong className="text-orange">{effectiveFee.toFixed(0)} PLANTS</strong>
                    </div>
                  </>
                )}
                {swapMode === 'gems' && (
                  <div className="swap-audit-line">
                    <span>🔥 Quema Super Sink</span>
                    <strong className="text-orange">{parsedAmount.toLocaleString()} PLANTS</strong>
                  </div>
                )}
                <div className="swap-audit-line highlight">
                  <span>Recibirás</span>
                  <strong className={swapMode === 'gems' ? 'text-gold' : 'text-green'}>
                    {swapMode === 'usdt'
                      ? `${estimatedUsdt.toFixed(4)} USDT`
                      : `${Math.floor(estimatedGems).toLocaleString()} GEMAS`}
                  </strong>
                </div>
              </div>
            </article>

            {/* 2. SECCIÓN DE STAKING (BLOQUEADO, RECOMPENSAS, BLOQUES Y MÍNIMOS) */}
            <article
              className="swap-staking-card"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setIsStakingModalOpen(true)
              }}
              title="Abrir la sección de Staking de PLANTS"
            >
              <div className="swap-staking-header">
                <div className="swap-staking-title-wrap">
                  <span className="swap-staking-icon">🌿</span>
                  <div>
                    <h4 className="swap-staking-title">STAKING PLANTS</h4>
                    <span className="swap-staking-sub">Rendimiento diario sin riesgo</span>
                  </div>
                </div>
                <div className="swap-staking-badge">
                  <span>{stakingSummary?.activeCount ?? 0} BLOQUES</span>
                </div>
              </div>

              <div className="swap-staking-stats-body">
                <div className="swap-staking-stat-row">
                  <span className="swap-staking-lbl">🔒 Cant. Bloqueada:</span>
                  <strong className="swap-staking-val text-white">
                    {(stakingSummary?.totalStaked ?? 0).toLocaleString()} PLANTS
                  </strong>
                </div>
                <div className="swap-staking-stat-row">
                  <span className="swap-staking-lbl">💎 Ganancias hoy:</span>
                  <strong className="swap-staking-val text-mint">
                    +{(stakingSummary?.totalClaimableGems ?? 0).toFixed(2)} 💎 / +{(stakingSummary?.totalClaimableGold ?? 0).toLocaleString()} 🪙
                  </strong>
                </div>
                <div className="swap-staking-stat-row">
                  <span className="swap-staking-lbl">🧱 Bloques & Mín:</span>
                  <span className="swap-staking-val text-gold">
                    30d (500) · 60d (5k) · 90d (25k)
                  </span>
                </div>
              </div>

              <div className="swap-staking-actions-row">
                <button
                  type="button"
                  className="swap-staking-open-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    soundManager.playSound('click', 0.4)
                    setIsStakingModalOpen(true)
                  }}
                  title="Abrir la pantalla de Staking con todos los bloques y recompensas"
                >
                  <span>🌿 ABRIR STAKING</span>
                  <span className="swap-staking-arrow">➔</span>
                </button>
                {onTabChange && (
                  <button
                    type="button"
                    className="swap-staking-tab-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      soundManager.playSound('click', 0.4)
                      onTabChange('staking')
                    }}
                    title="Ir directamente a la pestaña completa de Staking"
                  >
                    PESTAÑA ↗
                  </button>
                )}
              </div>
            </article>
          </div>

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

      {/* PANTALLA DEDICADA / MODAL DE LA CURVA AMM */}
      <AmmCurveModal
        isOpen={isAmmModalOpen}
        onClose={() => setIsAmmModalOpen(false)}
        spotPrice={spotPrice}
        priceHistory={priceHistory}
        marketState={marketState}
      />

      {/* MODAL DE CULTIVO Y STAKING DE PLANTS */}
      <StakingModal
        isOpen={isStakingModalOpen}
        onClose={() => setIsStakingModalOpen(false)}
        liquidPlants={liquidPlants}
        onTabChange={onTabChange}
        onRefreshData={onRefreshData}
        showNotification={showNotification}
      />
    </div>
  )
}
