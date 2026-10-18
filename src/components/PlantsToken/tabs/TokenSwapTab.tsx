import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { soundManager } from '../../../utils/audioManager'
import type { TokenHubSharedProps } from '../types'
import { AmmCurveModal } from '../modals/AmmCurveModal'
import { StakingModal } from '../modals/StakingModal'
import {
  plantsTokenService,
  type StakingSummary,
  type CashoutRequestItem,
} from '../../../services/plantsTokenService'

export const TokenSwapTab: React.FC<TokenHubSharedProps> = ({
  liquidPlants,
  spotPrice,
  poolUsdt,
  totalBurned,
  priceHistory,
  marketState,
  countdownSeconds: _countdownSeconds,
  isSubmitting,
  onSwapToGems,
  onCashoutUsdt: _onCashoutUsdt,
  onSwapPlantsForUsdt,
  onRequestUsdtWithdrawal,
  onRefreshData,
  showNotification,
  userUsdtBalance = 0,
  hasVipPass = false,
  userElo = 1000,
  isArena3Plus = false,
  onOpenMintingHistory,
  onOpenBattlePass,
  onBuyVipPass,
}) => {
  const [swapMode, setSwapMode] = useState<'usdt' | 'gems' | 'withdraw'>('usdt')
  const [amountStr, setAmountStr] = useState<string>(liquidPlants > 0 ? String(Math.floor(liquidPlants)) : '1000')
  const [withdrawUsdtStr, setWithdrawUsdtStr] = useState<string>(
    userUsdtBalance >= 1 ? userUsdtBalance.toFixed(2) : '10.00'
  )
  const [withdrawWallet, setWithdrawWallet] = useState<string>('')
  const [slippage, setSlippage] = useState<number>(1)
  const [isAmmModalOpen, setIsAmmModalOpen] = useState<boolean>(false)
  const [isStakingModalOpen, setIsStakingModalOpen] = useState<boolean>(false)
  const [stakingSummary, setStakingSummary] = useState<StakingSummary | null>(null)
  const [myRequests, setMyRequests] = useState<CashoutRequestItem[]>([])
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Cargar resumen de staking
  useEffect(() => {
    let isMounted = true
    plantsTokenService.getMyStakingPositions().then((summary) => {
      if (isMounted && summary) setStakingSummary(summary)
    })
    const timer = setInterval(() => {
      plantsTokenService.getMyStakingPositions().then((summary) => {
        if (isMounted && summary) setStakingSummary(summary)
      })
    }, 12000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  // Cargar solicitudes de retiro del usuario
  const loadMyCashoutRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const requests = await plantsTokenService.getMyCashoutRequests(20)
      setMyRequests(requests)
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  useEffect(() => {
    loadMyCashoutRequests()
    const interval = setInterval(loadMyCashoutRequests, 15000)
    return () => clearInterval(interval)
  }, [loadMyCashoutRequests])

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amountStr)
    return isNaN(n) || n <= 0 ? 0 : n
  }, [amountStr])

  const parsedWithdrawUsdt = useMemo(() => {
    const n = parseFloat(withdrawUsdtStr)
    return isNaN(n) || n <= 0 ? 0 : n
  }, [withdrawUsdtStr])

  const effectiveFee = parsedAmount * 0.05
  // Cálculo canónico AMM idéntico al contrato SQL (K = R * V)
  const virtualPlants = marketState?.virtualPlants || (spotPrice > 0 ? poolUsdt / spotPrice : 425600.9166)
  const grossUsdtAmm = (poolUsdt > 0 && virtualPlants > 0 && parsedAmount > 0)
    ? (poolUsdt * parsedAmount) / (virtualPlants + parsedAmount)
    : 0
  const estimatedUsdt = grossUsdtAmm * 0.95
  // 1 Gema = 0.01 USDT ($10 = 1,000 gemas). Con +20% bono in-game:
  const ratePlantsPerGem = useMemo(() => {
    return spotPrice > 0 ? 0.01 / (spotPrice * 1.2) : 7.54
  }, [spotPrice])
  const estimatedGems = parsedAmount > 0 ? (parsedAmount * spotPrice * 1.2) / 0.01 : 0
  const creditedGems = Number(estimatedGems.toFixed(2))

  const handleMaxPlantsClick = () => {
    soundManager.playSound('click', 0.4)
    setAmountStr(String(Math.floor(liquidPlants)))
  }

  const handleMaxWithdrawClick = () => {
    soundManager.playSound('click', 0.4)
    setWithdrawUsdtStr(userUsdtBalance > 0 ? userUsdtBalance.toFixed(2) : '0.00')
  }

  const handleCopy = (text: string, id: string) => {
    soundManager.playSound('click', 0.3)
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      showNotification('Copiado al portapapeles', 'info')
    }
  }

  // Ejecutar conversión o retiro
  const handleSubmit = async () => {
    if (swapMode === 'gems') {
      if (parsedAmount <= 0) {
        showNotification('Ingresa una cantidad válida de PLANTS para canjear a Gemas.', 'error')
        return
      }
      if (creditedGems < 0.01) {
        showNotification(
          'Monto insuficiente para recibir al menos 0.01 Gemas.',
          'error'
        )
        return
      }
      if (parsedAmount > liquidPlants) {
        showNotification(`Saldo líquido insuficiente. Tienes ${liquidPlants.toLocaleString()} PLANTS.`, 'error')
        return
      }
      await onSwapToGems(parsedAmount)
      return
    }

    if (swapMode === 'usdt') {
      if (parsedAmount <= 0) {
        showNotification('Ingresa una cantidad válida de PLANTS para convertir a saldo USDT.', 'error')
        return
      }
      if (parsedAmount > liquidPlants) {
        showNotification(`Saldo líquido insuficiente. Tienes ${liquidPlants.toLocaleString()} PLANTS.`, 'error')
        return
      }

      if (onSwapPlantsForUsdt) {
        const ok = await onSwapPlantsForUsdt(parsedAmount)
        if (ok) {
          setAmountStr('')
          await loadMyCashoutRequests()
        }
      } else {
        const res = await plantsTokenService.swapPlantsForUsdt(parsedAmount)
        if (res.success) {
          soundManager.playSound('claim', 0.8)
          showNotification(
            `¡Canje exitoso! Convertiste ${parsedAmount.toLocaleString()} PLANTS a saldo USDT.`,
            'success'
          )
          setAmountStr('')
          await onRefreshData()
          await loadMyCashoutRequests()
        } else {
          showNotification(res.error || 'Error al canjear PLANTS a USDT', 'error')
        }
      }
      return
    }

    // Modo 'withdraw' (Retiro de USDT a wallet externa)
    if (swapMode === 'withdraw') {
      if (!isArena3Plus && userElo < 2001) {
        showNotification(
          `⚔️ Requieres estar en Arena 3 (2,001+ copas) para solicitar retiros. Tu elo actual: ${userElo}.`,
          'error'
        )
        return
      }
      if (parsedWithdrawUsdt < 1.0) {
        showNotification('El monto mínimo de retiro es de 1.00 USDT.', 'error')
        return
      }
      if (parsedWithdrawUsdt > userUsdtBalance) {
        showNotification(
          `Saldo USDT insuficiente. Tu saldo actual es de $${userUsdtBalance.toFixed(2)} USDT.`,
          'error'
        )
        return
      }
      const targetWallet = withdrawWallet.trim()
      const bep20Regex = /^0x[a-fA-F0-9]{40}$/
      if (!targetWallet || !bep20Regex.test(targetWallet)) {
        showNotification(
          'Por favor ingresa una dirección de billetera BEP-20 válida (42 caracteres hexadecimales iniciando con 0x).',
          'error'
        )
        return
      }

      if (onRequestUsdtWithdrawal) {
        const ok = await onRequestUsdtWithdrawal(parsedWithdrawUsdt, targetWallet)
        if (ok) {
          setWithdrawWallet('')
          await loadMyCashoutRequests()
        }
      } else {
        const res = await plantsTokenService.requestUsdtWithdrawal(parsedWithdrawUsdt, targetWallet)
        if (res.success) {
          soundManager.playSound('claim', 0.8)
          showNotification(
            `¡Solicitud enviada! Retiro de $${parsedWithdrawUsdt.toFixed(2)} USDT en proceso de revisión.`,
            'success'
          )
          setWithdrawWallet('')
          await onRefreshData()
          await loadMyCashoutRequests()
        } else {
          showNotification(res.error || 'Error al registrar retiro de USDT', 'error')
        }
      }
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
            <span className="summary-kpi-sub">60% Preventas + AMM Contractual</span>
          </div>
        </article>

        {/* PLANTS QUEMADOS TOTAL */}
        <article
          className="summary-kpi-card"
          style={{ cursor: onOpenMintingHistory ? 'pointer' : 'default' }}
          onClick={() => {
            if (onOpenMintingHistory) onOpenMintingHistory('burns')
          }}
          title="Ver registro y auditoría en vivo de minteos y quemas de tokens"
        >
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--orange">
            <span className="summary-kpi-emoji">🔥</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">PLANTS QUEMADOS</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-orange">{totalBurned.toFixed(2)} PLANTS</strong>
              {onOpenMintingHistory && (
                <span className="summary-kpi-tag summary-kpi-tag--orange">AUDITORÍA 📜</span>
              )}
            </div>
            <span className="summary-kpi-sub">{totalBurned.toFixed(4)} quemados · Clic para auditar</span>
          </div>
        </article>

        {/* MI SALDO USDT DISPONIBLE */}
        <article className="summary-kpi-card" style={{ border: '1px solid rgba(16, 185, 129, 0.4)' }}>
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--gold">
            <span className="summary-kpi-emoji">💵</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">MI SALDO USDT</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-mint">${userUsdtBalance.toFixed(2)} USDT</strong>
              <span className="summary-kpi-tag summary-kpi-tag--green">DISPONIBLE</span>
            </div>
            <span className="summary-kpi-sub">Convertido listo para retiro BEP-20</span>
          </div>
        </article>

        {/* FRANJA HORARIA DE RETIRO */}
        <article
          className={`summary-kpi-card ${!hasVipPass && (onOpenBattlePass || onBuyVipPass) ? 'summary-kpi-card--clickable' : ''}`}
          title={
            hasVipPass
              ? 'Pase VIP activo: franja de revisión prioritaria de 24 horas'
              : 'Cuenta Gratuita: franja estándar de 72 horas (Clic para ver y activar Pase VIP)'
          }
          onClick={!hasVipPass ? (onOpenBattlePass || onBuyVipPass) : undefined}
          style={!hasVipPass && (onOpenBattlePass || onBuyVipPass) ? { cursor: 'pointer' } : undefined}
        >
          <div className="summary-kpi-icon-wrap summary-kpi-icon-wrap--mint">
            <span className="summary-kpi-emoji">{hasVipPass ? '👑' : '🛡️'}</span>
          </div>
          <div className="summary-kpi-content">
            <span className="summary-kpi-label">FRANJA DE RETIRO</span>
            <div className="summary-kpi-val-row">
              <strong className="summary-kpi-value text-gold">{hasVipPass ? '24 HORAS' : '72 HORAS'}</strong>
              <span className={`summary-kpi-tag ${hasVipPass ? 'summary-kpi-tag--gold' : 'summary-kpi-tag--blue'}`}>
                {hasVipPass ? 'VIP PASS' : 'FREE'}
              </span>
            </div>
            <span className="summary-kpi-sub">{hasVipPass ? 'Revisión rápida prioritaria' : 'Auditoría estándar programada'}</span>
          </div>
        </article>
      </section>

      {/* =====================================================
           2. MAIN GRID: SWAP / WITHDRAW WIDGET (45%) + AMM & RULES (55%)
           ===================================================== */}
      <section className="swap-main-grid">
        {/* LEFT COLUMN: SWAP / WITHDRAW WIDGET */}
        <article className="swap-widget-card">
          <div className="swap-widget-header">
            <span className="swap-widget-icon">🔄</span>
            <div>
              <h3 className="swap-widget-title">CONVERTIDOR Y RETIRO DE TOKENS</h3>
              <p className="swap-widget-desc">Canjea tus PLANTS a USDT o Gemas, y retira tu balance a BEP-20</p>
            </div>
          </div>

          {/* Mode Switcher con 3 opciones */}
          <div className="swap-mode-tabs" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <button
              type="button"
              className={`swap-mode-btn ${swapMode === 'usdt' ? 'active active--usdt' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSwapMode('usdt')
              }}
              title="Convierte tus tokens PLANTS a saldo USDT disponible"
            >
              💵 PLANTS ➔ USDT
            </button>

            <button
              type="button"
              className={`swap-mode-btn ${swapMode === 'gems' ? 'active active--gems' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSwapMode('gems')
              }}
              title="Quema instantánea con bono +20% a Gemas de juego"
            >
              💎 ➔ GEMAS (+20%)
            </button>

            <button
              type="button"
              className={`swap-mode-btn swap-mode-btn--withdraw ${swapMode === 'withdraw' ? 'active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSwapMode('withdraw')
              }}
              title="Retira tus USDT convertidos a tu billetera BEP-20"
            >
              💸 RETIRAR USDT
            </button>
          </div>

          {/* CONTENIDO SEGÚN MODO SELECCIONADO */}
          {swapMode === 'withdraw' ? (
            /* =====================================================
                 MODO RETIRO USDT A WALLET EXTERNA
                 ===================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Tarjeta de Saldo USDT Disponible */}
              <div className="swap-usdt-balance-card">
                <div className="swap-usdt-balance-left">
                  <span className="swap-usdt-balance-lbl">Saldo USDT Disponible para Retiro</span>
                  <strong className="swap-usdt-balance-val">${userUsdtBalance.toFixed(2)} USDT</strong>
                </div>
                <span className="swap-usdt-balance-badge">100% RESPALDADO</span>
              </div>

              {/* Notice de Franja Horaria y Requisito Arena */}
              <div
                className={`swap-tier-notice ${hasVipPass ? 'swap-tier-notice--vip' : 'swap-tier-notice--free'}`}
                style={!hasVipPass && (onOpenBattlePass || onBuyVipPass) ? { cursor: 'pointer' } : undefined}
                onClick={!hasVipPass ? (onOpenBattlePass || onBuyVipPass) : undefined}
                title={!hasVipPass ? 'Clic para ver y activar Pase VIP (Franja 24h prioritaria)' : undefined}
              >
                <span>{hasVipPass ? '👑 Cuenta VIP:' : '🛡️ Cuenta Free:'}</span>
                <span>{hasVipPass ? 'Franja de retiro prioritaria (24 horas)' : 'Franja de retiro estándar (72 horas) — Activar VIP ➔'}</span>
              </div>

              {!isArena3Plus && userElo < 2001 ? (
                <div className="swap-tier-notice swap-tier-notice--locked">
                  <span>⚔️ Requisito:</span>
                  <span>Arena 3 requerida (2,001+ copas). Tu elo actual: {userElo}.</span>
                </div>
              ) : (
                <div className="swap-tier-notice" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#6ee7b7' }}>
                  <span>⚔️ Arena 3+ Verificada:</span>
                  <span>Apto para retiros a Binance / Trust / MetaMask</span>
                </div>
              )}

              {/* Monto de USDT a retirar */}
              <div className="swap-input-box">
                <div className="swap-input-top">
                  <span className="swap-input-label">Monto a Retirar (Mínimo $1.00 USDT)</span>
                  <span className="swap-input-balance">
                    Disponible: ${userUsdtBalance.toFixed(2)} USDT{' '}
                    <button type="button" className="swap-max-btn" onClick={handleMaxWithdrawClick}>
                      MÁX
                    </button>
                  </span>
                </div>
                <div className="swap-input-main">
                  <div className="swap-token-badge">
                    <span>💵 USDT</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="swap-field"
                    value={withdrawUsdtStr}
                    onChange={(e) => setWithdrawUsdtStr(e.target.value)}
                    placeholder="10.00"
                  />
                </div>
              </div>

              {/* Dirección de Billetera BEP-20 */}
              <div className="swap-input-box">
                <div className="swap-input-top">
                  <span className="swap-input-label">Dirección de Billetera BEP-20 (BNB Chain)</span>
                </div>
                <input
                  type="text"
                  placeholder="0x... (Tu wallet BEP-20 en MetaMask, Binance o Trust)"
                  value={withdrawWallet}
                  onChange={(e) => setWithdrawWallet(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(2, 6, 23, 0.7)',
                    border: '1px solid rgba(20, 137, 109, 0.5)',
                    borderRadius: '7px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          ) : (
            /* =====================================================
                 MODO SWAP (PLANTS A USDT O GEMAS)
                 ===================================================== */
            <>
              {/* Pay Input Box */}
              <div className="swap-input-box">
                <div className="swap-input-top">
                  <span className="swap-input-label">Tú pagas</span>
                  <span className="swap-input-balance">
                    Líquido disponible: {liquidPlants.toLocaleString()}{' '}
                    <button type="button" className="swap-max-btn" onClick={handleMaxPlantsClick}>
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
                  title="Alternar entre saldo USDT y Gemas"
                >
                  ⇅
                </button>
              </div>

              {/* Receive Output Box */}
              <div className="swap-input-box">
                <div className="swap-input-top">
                  <span className="swap-input-label">Tú recibes (exacto respaldado)</span>
                  <span className="swap-rate-note">
                    {swapMode === 'usdt'
                      ? `1 PLANTS = ${(spotPrice * 0.95).toFixed(6)} USDT (neto)`
                      : `~${ratePlantsPerGem.toFixed(2)} PLANTS = 1 💎 (+20% Bono)`}
                  </span>
                </div>
                <div className="swap-input-main">
                  <div
                    className={`swap-token-badge ${
                      swapMode === 'gems' ? 'swap-token-badge--gems' : 'swap-token-badge--receive'
                    }`}
                  >
                    <span>{swapMode === 'usdt' ? '💵 SALDO USDT' : '💎 GEMAS (+20%)'}</span>
                  </div>
                  <div className="swap-receive-val">
                    {swapMode === 'usdt'
                      ? `${estimatedUsdt.toFixed(4)} USDT`
                      : `${creditedGems.toFixed(2)} Gemas`}
                  </div>
                </div>
              </div>

              {swapMode === 'gems' ? (
                <div className="swap-gems-benefit-box">
                  <div className="gems-benefit-badge">💎 BONO EXCLUSIVO +20% EN GEMAS (SUPER SINK)</div>
                  <p className="gems-benefit-desc">
                    Quema directa de PLANTS por Gemas in-game con <strong>+20% de bono de respaldo</strong> sin redondeos (precisión exacta a 2 decimales).
                    <br />
                    Tasa actual: <strong>~{ratePlantsPerGem.toFixed(2)} PLANTS = 1.00 Gema</strong> (ej: 5 PLANTS = {(5 / ratePlantsPerGem).toFixed(2)} 💎, 10 PLANTS = {(10 / ratePlantsPerGem).toFixed(2)} 💎).
                  </p>
                  {parsedAmount > 0 && creditedGems < 0.01 && (
                    <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', fontSize: '11px', color: '#fca5a5' }}>
                      ⚠️ <strong>Monto insuficiente:</strong> Ingresa una cantidad mayor para recibir al menos 0.01 Gemas.
                    </div>
                  )}
                  {onOpenMintingHistory && (
                    <button
                      type="button"
                      onClick={() => onOpenMintingHistory('burns')}
                      style={{
                        marginTop: '8px',
                        background: 'rgba(234, 88, 12, 0.15)',
                        border: '1px solid rgba(234, 88, 12, 0.4)',
                        color: '#fb923c',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        fontWeight: 600,
                      }}
                    >
                      📜 Ver Auditoría de Quemas y Minteo en Vivo ({totalBurned.toFixed(2)} PLANTS quemados)
                    </button>
                  )}
                </div>
              ) : (
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
              )}
            </>
          )}

          {/* Submit Action Button */}
          <button
            type="button"
            className="swap-confirm-btn"
            disabled={
              isSubmitting ||
              (swapMode === 'gems' && (parsedAmount <= 0 || creditedGems < 0.01)) ||
              (swapMode === 'usdt' && parsedAmount <= 0) ||
              (swapMode === 'withdraw' && (parsedWithdrawUsdt <= 0 || userUsdtBalance < 1 || (!isArena3Plus && userElo < 2001)))
            }
            onClick={handleSubmit}
          >
            {isSubmitting
              ? 'PROCESANDO...'
              : swapMode === 'withdraw'
              ? '💸 SOLICITAR RETIRO EN USDT'
              : swapMode === 'gems'
              ? '💎 CANJEAR POR GEMAS (+20% BONO)'
              : '💵 CONVERTIR A SALDO USDT'}
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
                <span>🛡️ Pool: ${poolUsdt.toFixed(2)} USDT</span>
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
                      {swapMode === 'withdraw'
                        ? 'Retiro BEP-20 a Billetera Externa'
                        : swapMode === 'usdt'
                        ? 'Conversión a saldo USDT interno'
                        : 'Super Sink Quema a Gemas (+20%)'}
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
                    {swapMode === 'withdraw'
                      ? `${parsedWithdrawUsdt > 0 ? parsedWithdrawUsdt.toFixed(2) : '0.00'} USDT`
                      : `${parsedAmount > 0 ? parsedAmount.toLocaleString() : '0'} PLANTS`}
                  </strong>
                  <span className="mini-metric-sub">
                    {swapMode === 'withdraw' ? 'Débito de tu saldo USDT' : 'Saldo líquido a debitar'}
                  </span>
                </div>

                <div className="swap-mini-metric">
                  <span className="mini-metric-label">
                    {swapMode === 'withdraw' ? 'COMISIÓN RED' : swapMode === 'usdt' ? 'COMISIÓN (5%)' : 'SUPER SINK'}
                  </span>
                  <strong className="mini-metric-value text-orange">
                    {swapMode === 'withdraw' ? '$0.00 USDT' : swapMode === 'usdt' ? `-${effectiveFee.toFixed(0)} PLANTS` : '100% QUEMA'}
                  </strong>
                  <span className="mini-metric-sub">
                    {swapMode === 'withdraw' ? 'Sin comisiones ocultas' : swapMode === 'usdt' ? 'Quema para el pool' : 'Bono +20% activo'}
                  </span>
                </div>
              </div>

              {/* LISTA DE AUDITORÍA Y DETALLES EN VIVO */}
              <div className="swap-preview-details-list">
                <div className="swap-preview-detail-row">
                  <span className="detail-row-lbl">Tasa Spot AMM</span>
                  <span className="detail-row-val font-mono">1 PLANTS = ${spotPrice.toFixed(6)} USDT</span>
                </div>
                <div className="swap-preview-detail-row">
                  <span className="detail-row-lbl">Destino Acreditado</span>
                  <span className="detail-row-val">
                    {swapMode === 'withdraw'
                      ? withdrawWallet
                        ? `${withdrawWallet.slice(0, 6)}...${withdrawWallet.slice(-4)}`
                        : 'Billetera Externa BEP-20'
                      : swapMode === 'usdt'
                      ? 'Saldo USDT de tu Cuenta'
                      : 'Inventario de Gemas'}
                  </span>
                </div>
                <div className="swap-preview-detail-row">
                  <span className="detail-row-lbl">Franja Horaria</span>
                  <span className="detail-row-val text-mint">
                    {swapMode === 'withdraw'
                      ? hasVipPass
                        ? '👑 VIP (24 Horas)'
                        : '🛡️ Free (72 Horas)'
                      : '⚡ Instantáneo (Automático)'}
                  </span>
                </div>
              </div>

              {/* HERO RESULT BOX */}
              <div className={`swap-preview-hero-box ${swapMode === 'gems' ? 'gems-mode' : 'usdt-mode'}`}>
                <div className="hero-box-label-row">
                  <span className="hero-box-label">
                    {swapMode === 'withdraw' ? 'TRANSFERENCIA EN CAMINO' : 'RECIBES EN TU CUENTA'}
                  </span>
                  <span className="hero-box-tag">
                    {swapMode === 'gems' ? '💎 +20% EXTRA' : '💵 NETO'}
                  </span>
                </div>
                <div className="hero-box-value">
                  {swapMode === 'withdraw'
                    ? `$${parsedWithdrawUsdt.toFixed(2)} USDT`
                    : swapMode === 'usdt'
                    ? `$${estimatedUsdt.toFixed(4)} USDT`
                    : `${Math.floor(estimatedGems).toLocaleString()} GEMAS`}
                </div>
                <div className="hero-box-footer">
                  <span>
                    {swapMode === 'withdraw'
                      ? `⏱️ Solicitud auditada y liquidada según tu franja (${hasVipPass ? '24h VIP' : '72h Free'})`
                      : swapMode === 'usdt'
                      ? '⚡ Acreditado directamente a tu saldo USDT'
                      : '⚡ Acreditación automática a tu balance de jugador'}
                  </span>
                </div>
              </div>
            </article>

            {/* 2. SECCIÓN DE STAKING */}
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

          {/* 2 COLUMNAS: REGLAS DE RETIRO Y HORARIOS DE RETIRO */}
          <div className="swap-rules-and-sink">
            <article className="swap-rules-card">
              <h5 className="swap-rules-title">📜 REGLAS DE RETIRO</h5>
              <div className="swap-rule-item">
                <span>⚔️ Requisito:</span> Arena 3 (2,001+ copas) para retiros en USDT.
              </div>
              <div className="swap-rule-item">
                <span>🛡️ Auditoría:</span> Verificación anti-bot y validación de partidas.
              </div>
              <div className="swap-rule-item">
                <span>💵 Mínimo:</span> 1.00 USDT por retiro a billeteras BEP-20.
              </div>
              <div className="swap-rule-guarantee">
                <span>🔒 Aplica a saldo USDT convertido libremente</span>
              </div>
            </article>

            <article className="swap-rules-card swap-schedules-card">
              <h5 className="swap-rules-title">⏱️ FRANJAS HORARIAS</h5>
              <div className="swap-rule-item">
                <span>👑 Jugadores VIP:</span> Franja rápida de 24 horas.
              </div>
              <div className="swap-rule-item">
                <span>🛡️ Jugadores Free:</span> Franja estándar de 72 horas.
              </div>
              <div className="swap-rule-item">
                <span>💰 Reembolso:</span> Si un retiro es rechazado, se reembolsa al 100%.
              </div>
              <div className="swap-rule-guarantee">
                <span>🔒 Bóveda respaldada 100% USDT en BNB Chain</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* =====================================================
           3. ESTADO DE SOLICITUDES DE RETIRO (ABAJO DE LA PANTALLA)
           ===================================================== */}
      <section className="swap-withdrawal-status-section">
        <div className="withdrawal-status-header">
          <div className="withdrawal-status-title-group">
            <h4 className="withdrawal-status-title">
              <span>📋</span> ESTADO DE MIS SOLICITUDES DE RETIRO (USDT BEP-20)
            </h4>
            <span className="withdrawal-status-badge-count">
              {myRequests.length} {myRequests.length === 1 ? 'registro' : 'registros'}
            </span>
            <span className="withdrawal-status-desc">
              Seguimiento en vivo respetando tu franja ({hasVipPass ? 'VIP 24h' : 'Free 72h'})
            </span>
          </div>

          <button
            type="button"
            className="withdrawal-refresh-btn"
            onClick={() => {
              soundManager.playSound('click', 0.4)
              loadMyCashoutRequests()
            }}
            disabled={loadingRequests}
          >
            {loadingRequests ? '🔄 Consultando...' : '🔄 Actualizar Estado'}
          </button>
        </div>

        {myRequests.length === 0 ? (
          <div className="withdrawal-empty-state">
            <span>ℹ️ No tienes solicitudes de retiro registradas. Convierte tus tokens PLANTS a saldo USDT y solicita tu retiro arriba.</span>
          </div>
        ) : (
          <div className="withdrawal-requests-table">
            {myRequests.map((req) => {
              const isVipReq = req.userIsVip
              const isPending = req.status === 'pending'
              const isCompleted = req.status === 'completed'
              const isRejected = req.status === 'rejected'

              const formattedDate = new Date(req.createdAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div key={req.id} className="withdrawal-req-item">
                  {/* Columna ID & Fecha */}
                  <div className="withdrawal-req-col-id">
                    <span className="withdrawal-req-id-tag">#WD-{req.id.slice(0, 8).toUpperCase()}</span>
                    <span className="withdrawal-req-date">{formattedDate}</span>
                  </div>

                  {/* Columna Monto */}
                  <div className="withdrawal-req-col-amount">
                    <strong className="withdrawal-req-amount-val">${req.netUsdt.toFixed(2)} USDT</strong>
                    <span className="withdrawal-req-fee-sub">Comisión: ${req.feeUsdt.toFixed(2)}</span>
                  </div>

                  {/* Columna Destino / Tx / Razón */}
                  <div className="withdrawal-req-col-dest">
                    <div className="withdrawal-req-wallet">
                      <span>Destino:</span>
                      <strong title={req.walletAddress}>
                        {req.walletAddress.slice(0, 8)}...{req.walletAddress.slice(-6)}
                      </strong>
                      <button
                        type="button"
                        className="withdrawal-copy-tag"
                        onClick={() => handleCopy(req.walletAddress, req.id)}
                        title="Copiar wallet"
                      >
                        {copiedId === req.id ? '✓' : '📋'}
                      </button>
                    </div>

                    {isCompleted && req.txHash && (
                      <a
                        href={`https://bscscan.com/tx/${req.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="withdrawal-req-tx"
                        title="Ver en BscScan"
                      >
                        🔗 Ver Tx: {req.txHash.slice(0, 10)}... ↗
                      </a>
                    )}

                    {isRejected && req.rejectReason && (
                      <span className="withdrawal-req-reason">
                        Motivo: {req.rejectReason} (Reembolsado a tu saldo)
                      </span>
                    )}
                  </div>

                  {/* Columna Estado & Franja */}
                  <div className="withdrawal-req-col-status">
                    {isPending && (
                      <span className="withdrawal-pill withdrawal-pill--pending">
                        ⏳ EN REVISIÓN
                      </span>
                    )}
                    {isCompleted && (
                      <span className="withdrawal-pill withdrawal-pill--completed">
                        ✅ PAGADO
                      </span>
                    )}
                    {isRejected && (
                      <span className="withdrawal-pill withdrawal-pill--rejected">
                        ❌ RECHAZADO
                      </span>
                    )}
                    <span className="withdrawal-window-sub">
                      {isVipReq ? '👑 Franja VIP (24h)' : '🛡️ Franja Free (72h)'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
