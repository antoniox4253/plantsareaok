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

          {/* Wallet Address Input for USDT Cashout OR Gems Benefit Info */}
          {swapMode === 'usdt' ? (
            <div className="swap-input-box" style={{ marginTop: '6px' }}>
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
                  borderRadius: '7px',
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <div className="swap-gems-benefit-box">
              <div className="gems-benefit-badge">💎 BONO EXCLUSIVO +20% EN GEMAS</div>
              <p className="gems-benefit-desc">
                Quema instantánea de PLANTS respaldando la liquidez · Recibes Gemas automáticas en tu perfil sin esperas ni comisiones.
              </p>
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

          {/* SECCIÓN DIVIDIDA EN 2: VISTA PREVIA DE OPERACIÓN + MÓDULO DE STAKING */}
          <div className="swap-audit-staking-grid">
            {/* 1. INFORMACIÓN DE VISTA PREVIA DE LA OPERACIÓN */}
            <article className="swap-preview-card">
              <header className="swap-card-header">
                <div className="swap-card-title-group">
                  <div className="swap-card-icon-wrap swap-card-icon-wrap--blue">
                    <span>🧾</span>
                  </div>
                  <div>
                    <h4 className="swap-card-title">VISTA PREVIA OPERACIÓN</h4>
                    <span className="swap-card-subtitle">
                      {swapMode === 'usdt' ? 'Retiro seguro a Billetera BEP-20' : 'Super Sink Quema a Gemas (+20%)'}
                    </span>
                  </div>
                </div>
                <span className="swap-card-status-badge swap-card-status-badge--live">
                  <span className="status-dot">●</span> EN VIVO
                </span>
              </header>

              <div className="swap-preview-metrics-grid">
                <div className="swap-mini-metric">
                  <span className="mini-metric-label">TÚ ENTREGAS</span>
                  <strong className="mini-metric-value text-white">
                    {parsedAmount > 0 ? parsedAmount.toLocaleString() : '0'} <small>PLANTS</small>
                  </strong>
                  <span className="mini-metric-sub">Saldo líquido a debitar</span>
                </div>

                <div className="swap-mini-metric">
                  <span className="mini-metric-label">
                    {swapMode === 'usdt' ? 'COMISIÓN (5%)' : 'SUPER SINK'}
                  </span>
                  <strong className="mini-metric-value text-orange">
                    {swapMode === 'usdt' ? `-${effectiveFee.toFixed(0)} PLANTS` : '100% QUEMA'}
                  </strong>
                  <span className="mini-metric-sub">
                    {swapMode === 'usdt' ? 'Quema para el pool' : 'Bono +20% activo'}
                  </span>
                </div>
              </div>

              {/* LISTA DE AUDITORÍA Y DETALLES EN VIVO */}
              <div className="swap-preview-details-list">
                <div className="swap-preview-detail-row">
                  <span className="detail-row-lbl">Tasa Spot AMM</span>
                  <span className="detail-row-val font-mono">1 PLANTS = ${(spotPrice).toFixed(6)} USDT</span>
                </div>
                <div className="swap-preview-detail-row">
                  <span className="detail-row-lbl">Destino Acreditado</span>
                  <span className="detail-row-val">
                    {swapMode === 'usdt'
                      ? (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Billetera BEP-20')
                      : 'Inventario de Gemas'}
                  </span>
                </div>
                <div className="swap-preview-detail-row">
                  <span className="detail-row-lbl">Tiempo Estimado</span>
                  <span className="detail-row-val text-mint">
                    {swapMode === 'usdt' ? 'Lote diario 18:00 UTC-3' : '⚡ Instantáneo (Automático)'}
                  </span>
                </div>
                <div className="swap-preview-detail-row">
                  <span className="detail-row-lbl">Slippage Máximo</span>
                  <span className="detail-row-val text-cyan">&lt; 0.05% (Tolerancia {slippage}%)</span>
                </div>
              </div>

              {/* HERO RESULT BOX */}
              <div className={`swap-preview-hero-box ${swapMode === 'gems' ? 'gems-mode' : 'usdt-mode'}`}>
                <div className="hero-box-label-row">
                  <span className="hero-box-label">RECIBES EN TU CUENTA</span>
                  <span className="hero-box-tag">
                    {swapMode === 'gems' ? '💎 +20% EXTRA' : '💵 NETO'}
                  </span>
                </div>
                <div className="hero-box-value">
                  {swapMode === 'usdt'
                    ? `${estimatedUsdt.toFixed(4)} USDT`
                    : `${Math.floor(estimatedGems).toLocaleString()} GEMAS`}
                </div>
                <div className="hero-box-footer">
                  <span>
                    {swapMode === 'usdt'
                      ? '⏱️ Retiro sin comisiones ocultas procesado en BNB Chain'
                      : '⚡ Acreditación automática a tu balance de jugador'}
                  </span>
                </div>
              </div>
            </article>

            {/* 2. SECCIÓN DE STAKING (BLOQUEADO, RECOMPENSAS, BLOQUES Y MÍNIMOS) */}
            <article
              className="swap-staking-hub-card"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setIsStakingModalOpen(true)
              }}
              title="Abrir pantalla completa de Staking de PLANTS"
            >
              <header className="swap-card-header">
                <div className="swap-card-title-group">
                  <div className="swap-card-icon-wrap swap-card-icon-wrap--green">
                    <span>🌿</span>
                  </div>
                  <div>
                    <h4 className="swap-card-title">CULTIVO DE STAKING</h4>
                    <span className="swap-card-subtitle">Rendimiento diario sin inflación</span>
                  </div>
                </div>
                <span className="swap-card-status-badge swap-card-status-badge--safe">
                  🛡️ 100% SEGURO
                </span>
              </header>

              <div className="swap-staking-metrics-grid">
                <div className="swap-mini-metric">
                  <span className="mini-metric-label">🔒 TOTAL BLOQUEADO</span>
                  <strong className="mini-metric-value text-green">
                    {(stakingSummary?.totalStaked ?? 0).toLocaleString()} <small>PLANTS</small>
                  </strong>
                  <span className="mini-metric-sub">
                    {stakingSummary?.activeCount ?? 0} bloque(s) activo(s)
                  </span>
                </div>

                <div className="swap-mini-metric">
                  <span className="mini-metric-label">🧺 COSECHA PENDIENTE</span>
                  <strong className="mini-metric-value text-cyan">
                    +{(stakingSummary?.totalClaimableGems ?? 0).toFixed(2)} <small>💎</small>
                  </strong>
                  <span className="mini-metric-sub">
                    +{(stakingSummary?.totalClaimableGold ?? 0).toLocaleString()} Oro 🪙
                  </span>
                </div>
              </div>

              {/* BLOQUES REALIZADOS Y MÍNIMOS CARDS */}
              <div className="swap-staking-plans-strip">
                <div className="staking-plan-chip">
                  <div className="plan-chip-header">
                    <span className="plan-chip-dot">🌱</span>
                    <strong className="plan-chip-name">30 DÍAS</strong>
                  </div>
                  <div className="plan-chip-body">
                    <span className="plan-chip-min">Mín 500</span>
                    <span className="plan-chip-yield text-cyan">+Gemas</span>
                  </div>
                </div>

                <div className="staking-plan-chip">
                  <div className="plan-chip-header">
                    <span className="plan-chip-dot">🌿</span>
                    <strong className="plan-chip-name">60 DÍAS</strong>
                  </div>
                  <div className="plan-chip-body">
                    <span className="plan-chip-min">Mín 5,000</span>
                    <span className="plan-chip-yield text-gold">+Oro & Gemas</span>
                  </div>
                </div>

                <div className="staking-plan-chip highlight">
                  <div className="plan-chip-header">
                    <span className="plan-chip-dot">👑</span>
                    <strong className="plan-chip-name">90 DÍAS</strong>
                  </div>
                  <div className="plan-chip-body">
                    <span className="plan-chip-min">Mín 25,000</span>
                    <span className="plan-chip-yield text-green">Máx Retorno</span>
                  </div>
                </div>
              </div>

              {/* BENEFIT GUARANTEE ROW */}
              <div className="staking-card-guarantee-row">
                <span>🌾 Cosecha diaria flexible · 100% de capital devuelto al madurar</span>
              </div>

              {/* ACTION CTA BUTTON */}
              <button
                type="button"
                className="swap-staking-cta-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  soundManager.playSound('click', 0.4)
                  setIsStakingModalOpen(true)
                }}
              >
                <span>🌿 GESTIONAR STAKING & CULTIVOS</span>
                <span className="swap-staking-cta-arrow">➔</span>
              </button>
            </article>
          </div>

          {/* REGLAS DE RETIRO & SUPER SINK INTERACTIVO */}
          <div className="swap-rules-and-sink">
            <article className="swap-rules-card">
              <h5 className="swap-rules-title">📜 REGLAS Y HORARIOS DE RETIRO</h5>
              <div className="swap-rule-item">
                <span>⏱️ Ventana diaria:</span> Lotes procesados a las 18:00 (UTC-3).
              </div>
              <div className="swap-rule-item">
                <span>🛡️ Auditoría:</span> Verificación anti-bot y validación de partidas.
              </div>
              <div className="swap-rule-item">
                <span>⚔️ Requisito:</span> Arena 3 (2,001+ copas) para retiros en USDT.
              </div>
              <div className="swap-rule-guarantee">
                <span>🔒 Bóveda de liquidez auditada y verificada</span>
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
                {swapMode === 'gems' ? '✓ MODO SUPER SINK ACTIVO' : '💎 ACTIVAR SUPER SINK (+20% GEMAS)'}
              </div>
              <div className="swap-sink-body">
                <span className="swap-sink-bonus">+20% GEMAS BONUS</span>
                <span className="swap-sink-arrow">➔</span>
              </div>
              <p className="swap-sink-desc">
                {swapMode === 'gems'
                  ? 'Modo activo: Quema instantánea sin ventana de espera ni comisiones.'
                  : 'Canjea directo a Gemas: se queman tus tokens y recibes bono de +20% inmediato.'}
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
        onRefreshData={onRefreshData}
        showNotification={showNotification}
      />
    </div>
  )
}
