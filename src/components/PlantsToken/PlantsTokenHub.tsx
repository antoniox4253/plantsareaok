import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  plantsTokenService,
  PRESALE_PACKS,
  HALVING_TIERS,
  type PlantsMarketState,
  type PlantsPriceHistoryPoint,
  type PresalePackDefinition,
  type PlantsVestingSummary,
} from '../../services/plantsTokenService'
import moneda from '../../assets/ico/moneda.webp'
import gema from '../../assets/ico/gema.webp'
import './PlantsTokenHub.css'

interface PlantsTokenHubProps {
  onBack: () => void
  userTokens?: number // Gemas
  userGold?: number
  userElo?: number
  hasVipPass?: boolean
  userProfile?: {
    id?: string
    username?: string
    plants_balance?: number
    plants_vesting_locked?: number
    last_plants_cashout_at?: string | null
    elo_rating?: number
    gems_balance?: number
  } | null
  onRefreshProfile?: () => void
}

type TabType = 'presale' | 'my_tokens' | 'swap' | 'tokenomics' | 'info'
type Timeframe = '1H' | '24H' | '7D' | 'ALL'

export const PlantsTokenHub: React.FC<PlantsTokenHubProps> = ({
  onBack,
  userTokens = 0,
  userGold = 0,
  userElo = 1000,
  hasVipPass = false,
  userProfile,
  onRefreshProfile,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('presale')
  const [timeframe, setTimeframe] = useState<Timeframe>('24H')
  const [marketState, setMarketState] = useState<PlantsMarketState | null>(null)
  const [priceHistory, setPriceHistory] = useState<PlantsPriceHistoryPoint[]>([])
  const [vestingSummary, setVestingSummary] = useState<PlantsVestingSummary | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClaimingVesting, setIsClaimingVesting] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Formularios de canje y retiro
  const [swapAmount, setSwapAmount] = useState<string>('')
  const [cashoutAmount, setCashoutAmount] = useState<string>('')
  const [cashoutWallet, setCashoutWallet] = useState<string>('')

  // Saldos del usuario
  const liquidPlants = Number(userProfile?.plants_balance ?? vestingSummary?.liquidBalance ?? 0)
  const lockedVestingPlants = Number(userProfile?.plants_vesting_locked ?? vestingSummary?.vestingLocked ?? 0)
  const totalPlants = liquidPlants + lockedVestingPlants
  const currentElo = Number(userProfile?.elo_rating ?? userElo ?? 1000)
  const isArena3Plus = currentElo >= 2001

  const loadData = useCallback(async () => {
    try {
      const [market, history, vesting] = await Promise.all([
        plantsTokenService.getMarketState(),
        plantsTokenService.getPriceHistory(50),
        plantsTokenService.getUserVestingSummary(),
      ])
      if (market) setMarketState(market)
      if (history) setPriceHistory(history)
      if (vesting) {
        setVestingSummary(vesting)
        setCountdownSeconds(vesting.secondsToNextUnlock)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [loadData])

  // Temporizador local de cuenta regresiva
  useEffect(() => {
    if (countdownSeconds <= 0) return
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdownSeconds])

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 5000)
  }

  const formatCountdown = (secs: number) => {
    if (secs <= 0) return 'Disponible ahora'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  }

  // Precios y métricas AMM
  const spotPrice = marketState?.spotPrice ?? 0.0002
  const poolUsdt = marketState?.usdtPool ?? 200
  const virtualPlants = marketState?.virtualPlants ?? 1000000
  const totalBurned = marketState?.totalBurned ?? 0
  const totalMinted = marketState?.totalMinted ?? 0
  const circulating = marketState?.circulatingSupply ?? Math.max(0, totalMinted - totalBurned)

  // ── MANEJADORES DE ACCIONES ──
  const handleBuyPack = async (pack: PresalePackDefinition) => {
    if (userTokens < pack.gemsPrice) {
      soundManager.playSound('click', 0.5)
      showNotification(
        `Gemas insuficientes. Tienes ${userTokens.toLocaleString()} 💎 y requieres ${pack.gemsPrice.toLocaleString()} 💎`,
        'error'
      )
      return
    }

    setIsSubmitting(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await plantsTokenService.buyPresalePack(pack.id, 'gems')
      if (res.success) {
        soundManager.playSound('claim', 0.7)
        showNotification(
          `¡Éxito! Adquiriste ${pack.title}. +${pack.plantsAmount.toLocaleString()} PLANTS (Vesting 45 días a ${pack.dailyRate} PLANTS/día) y +${pack.gemsReward.toLocaleString()} 💎 acreditadas.`,
          'success'
        )
        await loadData()
        onRefreshProfile?.()
        setActiveTab('my_tokens')
      } else {
        showNotification(res.error || 'Error al procesar la compra', 'error')
      }
    } catch (err: any) {
      showNotification(err.message || 'Error de conexión', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClaimDailyVesting = async () => {
    if (isClaimingVesting) return
    setIsClaimingVesting(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await plantsTokenService.claimDailyVestingPlants()
      if (res.success) {
        soundManager.playSound('claim', 0.8)
        showNotification(
          `¡Reclamo completado! Se liberaron +${res.unlockedPlants?.toFixed(2)} PLANTS a tu saldo líquido disponible para retiro.`,
          'success'
        )
        await loadData()
        onRefreshProfile?.()
      } else {
        showNotification(res.error || 'No se pudieron liberar tokens en este momento', 'error')
      }
    } catch (err: any) {
      showNotification(err.message || 'Error inesperado', 'error')
    } finally {
      setIsClaimingVesting(false)
    }
  }

  const handleSwapToGems = async () => {
    const num = parseFloat(swapAmount)
    if (isNaN(num) || num <= 0) {
      showNotification('Ingresa una cantidad válida de PLANTS para canjear', 'error')
      return
    }

    if (num > totalPlants) {
      showNotification(`Saldo insuficiente. Tienes ${totalPlants.toLocaleString()} PLANTS en total`, 'error')
      return
    }

    setIsSubmitting(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await plantsTokenService.swapPlantsForGems(num)
      if (res.success) {
        soundManager.playSound('claim', 0.7)
        showNotification(
          `¡Canje exitoso! Quemaste ${num.toLocaleString()} PLANTS y recibiste +${res.data?.gemsCredited ?? 0} Gemas 💎 (+20% Bonus aplicado)`,
          'success'
        )
        setSwapAmount('')
        await loadData()
        onRefreshProfile?.()
      } else {
        showNotification(res.error || 'Error al canjear por gemas', 'error')
      }
    } catch (err: any) {
      showNotification(err.message || 'Error inesperado', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCashoutUsdt = async () => {
    if (!isArena3Plus) {
      showNotification(
        `El retiro de USDT requiere alcanzar al menos Arena 3 (2,001+ copas). Tu ELO actual es ${currentElo}`,
        'error'
      )
      return
    }

    const num = parseFloat(cashoutAmount)
    if (isNaN(num) || num <= 0) {
      showNotification('Ingresa una cantidad válida de PLANTS para retiro', 'error')
      return
    }

    if (num > liquidPlants) {
      showNotification(
        `Saldo líquido insuficiente para retiro. Tienes ${liquidPlants.toFixed(1)} PLANTS líquidos (los tokens en vesting de preventa se liberan diariamente a 45 días)`,
        'error'
      )
      return
    }

    const wallet = cashoutWallet.trim()
    if (!wallet || !wallet.startsWith('0x') || wallet.length !== 42) {
      showNotification('Ingresa una dirección de wallet BEP20 válida (0x... de 42 caracteres)', 'error')
      return
    }

    setIsSubmitting(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await plantsTokenService.requestCashout(num, wallet)
      if (res.success) {
        soundManager.playSound('claim', 0.7)
        showNotification(
          `¡Solicitud de retiro registrada! Recibirás ${res.data?.netUsdt ?? 0} USDT en tu wallet tras la confirmación.`,
          'success'
        )
        setCashoutAmount('')
        setCashoutWallet('')
        await loadData()
        onRefreshProfile?.()
      } else {
        showNotification(res.error || 'Error al solicitar retiro', 'error')
      }
    } catch (err: any) {
      showNotification(err.message || 'Error inesperado', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Previsualizaciones de Swap y Retiro
  const swapGemsPreview = useMemo(() => {
    const num = parseFloat(swapAmount) || 0
    if (num <= 0) return 0
    const usdtVal = num * spotPrice
    const bonusUsdt = usdtVal * 1.2
    return Math.max(1, Math.round(bonusUsdt / 0.01))
  }, [swapAmount, spotPrice])

  const cashoutPreview = useMemo(() => {
    const num = parseFloat(cashoutAmount) || 0
    if (num <= 0 || !marketState) return { gross: 0, net: 0, fee: 0 }
    const newV = virtualPlants + num
    const newR = (200 * 1000000) / newV // K = R * V
    const gross = Math.max(0, poolUsdt - newR)
    const fee = gross * 0.1
    const net = gross * 0.9
    return { gross, net, fee }
  }, [cashoutAmount, virtualPlants, poolUsdt, marketState])

  // Datos para la gráfica interactiva en SVG
  const chartPoints = useMemo(() => {
    if (priceHistory.length === 0) {
      return [{ x: 50, y: 150, price: spotPrice, time: 'Ahora' }]
    }

    const minPrice = Math.min(...priceHistory.map((p) => p.spot_price), spotPrice * 0.95)
    const maxPrice = Math.max(...priceHistory.map((p) => p.spot_price), spotPrice * 1.05)
    const priceRange = Math.max(0.00001, maxPrice - minPrice)

    const width = 640
    const height = 220
    const padding = 35

    return priceHistory.map((item, idx) => {
      const x = padding + (idx / Math.max(1, priceHistory.length - 1)) * (width - padding * 2)
      const normalizedY = (item.spot_price - minPrice) / priceRange
      const y = height - padding - normalizedY * (height - padding * 2)
      return {
        x,
        y,
        price: item.spot_price,
        pool: item.usdt_pool,
        event: item.event_type,
        time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    })
  }, [priceHistory, spotPrice])

  const svgPathD = useMemo(() => {
    if (chartPoints.length < 2) return ''
    return chartPoints.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`
    }, '')
  }, [chartPoints])

  const svgAreaD = useMemo(() => {
    if (chartPoints.length < 2) return ''
    const first = chartPoints[0]
    const last = chartPoints[chartPoints.length - 1]
    const bottomY = 190
    return `${svgPathD} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`
  }, [chartPoints, svgPathD])

  const hasClaimableVesting = (vestingSummary?.claimablePlantsNow ?? 0) > 0

  return (
    <div className="plants-hub">
      {/* ── TOPBAR DE ACCESO Y SALDOS ── */}
      <header className="plants-hub__header">
        <button
          type="button"
          className="plants-hub__back-btn"
          onClick={() => {
            soundManager.playSound('click', 0.4)
            onBack()
          }}
        >
          <span className="plants-hub__back-arrow">‹</span> VOLVER AL MENÚ
        </button>

        <div className="plants-hub__title-wrap">
          <span className="plants-hub__title-icon">🌱</span>
          <div className="plants-hub__title-content">
            <h1 className="plants-hub__title">TOKEN PLANTS</h1>
            <span className="plants-hub__subtitle">BONDING CURVE AMM & VESTING 45 DÍAS</span>
          </div>
        </div>

        <div className="plants-hub__user-pills">
          <div
            className="plants-hub__pill plants-hub__pill--plants"
            title="Tus tokens PLANTS (Clic para ver saldo y vesting)"
            onClick={() => setActiveTab('my_tokens')}
            style={{ cursor: 'pointer' }}
          >
            <span className="plants-hub__pill-icon">🌱</span>
            <div className="plants-hub__pill-info">
              <span className="plants-hub__pill-label">LÍQUIDO</span>
              <span className="plants-hub__pill-val">{liquidPlants.toFixed(1)}</span>
            </div>
            {lockedVestingPlants > 0 && (
              <span className="plants-hub__vesting-badge" title="Tokens en Vesting (45 días)">
                🔒 {lockedVestingPlants.toFixed(1)}v
              </span>
            )}
          </div>

          <div className="plants-hub__pill plants-hub__pill--gems" title="Tus Gemas disponibles">
            <img src={gema} alt="Gemas" className="plants-hub__pill-img" />
            <div className="plants-hub__pill-info">
              <span className="plants-hub__pill-label">GEMAS</span>
              <span className="plants-hub__pill-val">{userTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── TICKER GLOBAL AMM ── */}
      <section className="plants-hub__ticker-bar">
        <div className="plants-hub__ticker-item">
          <span className="plants-hub__ticker-label">PRECIO SPOT</span>
          <div className="plants-hub__ticker-val-row">
            <strong className="plants-hub__spot-price">${spotPrice.toFixed(6)} USDT</strong>
            <span className="plants-hub__ticker-badge plants-hub__ticker-badge--live">LIVE AMM</span>
          </div>
          <small className="plants-hub__ticker-sub">5,000 PLANTS = $1.00 USDT</small>
        </div>

        <div className="plants-hub__ticker-sep" />

        <div className="plants-hub__ticker-item">
          <span className="plants-hub__ticker-label">RESPALDO LIQUIDEZ</span>
          <div className="plants-hub__ticker-val-row">
            <strong className="plants-hub__pool-val">${poolUsdt.toFixed(2)} USDT</strong>
            <span className="plants-hub__ticker-badge plants-hub__ticker-badge--pool">100% RESPALDADO</span>
          </div>
          <small className="plants-hub__ticker-sub">60% Preventas + 70% Gemas inyectadas</small>
        </div>

        <div className="plants-hub__ticker-sep" />

        <div className="plants-hub__ticker-item">
          <span className="plants-hub__ticker-label">TOKENS QUEMADOS</span>
          <div className="plants-hub__ticker-val-row">
            <strong className="plants-hub__burn-val">🔥 {totalBurned.toLocaleString()} PLANTS</strong>
          </div>
          <small className="plants-hub__ticker-sub">Super Sink (+20% Gemas)</small>
        </div>

        <div className="plants-hub__ticker-sep" />

        <div className="plants-hub__ticker-item">
          <span className="plants-hub__ticker-label">ERA DE HALVING</span>
          <div className="plants-hub__ticker-val-row">
            <strong className="plants-hub__era-val">FASE 1 / 5</strong>
            <span className="plants-hub__ticker-badge plants-hub__ticker-badge--era">100% RECOMPENSAS</span>
          </div>
          <small className="plants-hub__ticker-sub">Tope Total: 1,000,000 PLANTS</small>
        </div>
      </section>

      {/* ── FEEDBACK FLOTANTE ── */}
      {feedback && (
        <div className={`plants-hub__alert plants-hub__alert--${feedback.type}`}>
          <span>{feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '⚠' : 'ℹ'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── CUERPO PRINCIPAL CON GRÁFICA Y PESTAÑAS ── */}
      <div className="plants-hub__body">
        {/* PANEL IZQUIERDO: GRÁFICA INTERACTIVA AMM */}
        <section className="plants-hub__chart-card">
          <div className="plants-hub__chart-header">
            <div className="plants-hub__chart-title-box">
              <span className="plants-hub__chart-title">CURVA BONDING AMM (PLANTS / USDT)</span>
              <span className="plants-hub__chart-formula-pill">P = R / V (K = {((200 * 1000000) / 1000000).toFixed(0)}M)</span>
            </div>

            <div className="plants-hub__timeframe-selector">
              {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={`plants-hub__tf-btn ${timeframe === tf ? 'plants-hub__tf-btn--active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Gráfico SVG */}
          <div className="plants-hub__svg-container">
            <svg viewBox="0 0 640 220" className="plants-hub__svg-chart" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>

              {/* Grid Lines Horizontales */}
              <line x1="35" y1="45" x2="605" y2="45" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              <line x1="35" y1="95" x2="605" y2="95" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              <line x1="35" y1="145" x2="605" y2="145" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              <line x1="35" y1="190" x2="605" y2="190" stroke="rgba(255,255,255,0.15)" />

              {/* Área y Línea */}
              {svgAreaD && <path d={svgAreaD} fill="url(#chartGradient)" />}
              {svgPathD && <path d={svgPathD} fill="none" stroke="url(#lineGradient)" strokeWidth="3" />}

              {/* Puntos clave */}
              {chartPoints.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={idx === chartPoints.length - 1 ? 5 : 3}
                  className={idx === chartPoints.length - 1 ? 'plants-hub__chart-point-pulse' : 'plants-hub__chart-point'}
                />
              ))}
            </svg>
          </div>

          <div className="plants-hub__chart-footer">
            <div className="plants-hub__chart-stat">
              <span>PRESIÓN DE COMPRA:</span>
              <strong className="plants-hub__stat-green">+60% Preventas / +70% Gemas</strong>
            </div>
            <div className="plants-hub__chart-stat">
              <span>CIRCULANTE:</span>
              <strong>{circulating.toLocaleString()} PLANTS</strong>
            </div>
            <div className="plants-hub__chart-stat">
              <span>RESERVA VIRTUAL (V):</span>
              <strong>{virtualPlants.toLocaleString()} vPLANTS</strong>
            </div>
          </div>
        </section>

        {/* PANEL DERECHO: PESTAÑAS DE OPERACIÓN */}
        <div className="plants-hub__content-card">
          <nav className="plants-hub__tabs">
            <button
              type="button"
              className={`plants-hub__tab-btn ${activeTab === 'presale' ? 'plants-hub__tab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setActiveTab('presale')
              }}
            >
              🛒 PREVENTA
            </button>
            <button
              type="button"
              className={`plants-hub__tab-btn ${activeTab === 'my_tokens' ? 'plants-hub__tab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setActiveTab('my_tokens')
              }}
            >
              🌱 MIS TOKENS & VESTING
              {hasClaimableVesting && <span className="plants-hub__tab-badge">¡LIBERAR!</span>}
            </button>
            <button
              type="button"
              className={`plants-hub__tab-btn ${activeTab === 'swap' ? 'plants-hub__tab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setActiveTab('swap')
              }}
            >
              🔄 SWAP & CASH-OUT
            </button>
            <button
              type="button"
              className={`plants-hub__tab-btn ${activeTab === 'tokenomics' ? 'plants-hub__tab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setActiveTab('tokenomics')
              }}
            >
              📊 TOKENOMICS
            </button>
            <button
              type="button"
              className={`plants-hub__tab-btn ${activeTab === 'info' ? 'plants-hub__tab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setActiveTab('info')
              }}
            >
              ℹ️ GUÍA & REGLAS
            </button>
          </nav>

          <div className="plants-hub__tab-pane">
            {/* ── TAB 1: PREVENTA FUNDADORES ── */}
            {activeTab === 'presale' && (
              <div className="plants-hub__presale-pane">
                <div className="plants-hub__presale-banner">
                  <div className="plants-hub__presale-banner-info">
                    <h3>🚀 PREVENTA EXCLUSIVA DE FUNDADORES</h3>
                    <p>
                      Solo <strong>20 Packs Limitados</strong>. El <strong>60% de tu aporte</strong> ingresa al{' '}
                      <strong>Pool de Liquidez USDT</strong> elevando el precio spot. Recibes tus PLANTS con{' '}
                      <strong>Vesting lineal de 45 días</strong> (liberación diaria para retiro) y ¡acceso instantáneo a{' '}
                      <strong>Super Sink (+20% Gemas)</strong> desde el día 1!
                    </p>
                  </div>
                  <div className="plants-hub__presale-banner-badge">
                    <span>FONDO INICIAL</span>
                    <strong>$200 USDT</strong>
                  </div>
                </div>

                <div className="plants-hub__packs-grid">
                  {PRESALE_PACKS.map((pack) => {
                    const stockKey =
                      pack.id === 'pack_pionero_10'
                        ? 'pionero'
                        : pack.id === 'pack_campeon_25'
                        ? 'campeon'
                        : 'leyenda'
                    const stockLeft = marketState?.presaleStocks?.[stockKey] ?? pack.maxStock
                    const isSoldOut = stockLeft <= 0

                    return (
                      <div
                        key={pack.id}
                        className={`plants-hub__pack-card ${pack.popular ? 'plants-hub__pack-card--popular' : ''} ${
                          isSoldOut ? 'plants-hub__pack-card--soldout' : ''
                        }`}
                        style={{ '--pack-accent': pack.accentColor } as React.CSSProperties}
                      >
                        {pack.popular && <div className="plants-hub__pack-popular-ribbon">⭐ {pack.tag}</div>}

                        <div className="plants-hub__pack-header">
                          <span className="plants-hub__pack-tag">{pack.tag}</span>
                          <h4 className="plants-hub__pack-name">{pack.name}</h4>
                          <div className="plants-hub__pack-price-row">
                            <span className="plants-hub__pack-usd">${pack.priceUsdt} USDT</span>
                            <span className="plants-hub__pack-or">o</span>
                            <span className="plants-hub__pack-gems">{pack.gemsPrice.toLocaleString()} 💎</span>
                          </div>
                        </div>

                        <div className="plants-hub__pack-reward-box">
                          <div className="plants-hub__pack-plants-hero">
                            <span className="plants-hub__pack-plants-amount">+{pack.plantsAmount.toLocaleString()}</span>
                            <span className="plants-hub__pack-plants-token">PLANTS</span>
                          </div>
                          <span className="plants-hub__pack-vesting-sub">
                            Vesting 45 días · <strong>+{pack.dailyRate} PLANTS/día</strong>
                          </span>
                        </div>

                        <ul className="plants-hub__pack-features">
                          <li>
                            <span className="plants-hub__feat-icon">💎</span>
                            <span>
                              <strong>+{pack.gemsReward.toLocaleString()} Gemas</strong> de bono inmediato
                            </span>
                          </li>
                          <li>
                            <span className="plants-hub__feat-icon">🎁</span>
                            <span>{pack.bonusItemTitle}</span>
                          </li>
                          <li>
                            <span className="plants-hub__feat-icon">📈</span>
                            <span>
                              Inyecta <strong>+${(pack.priceUsdt * 0.6).toFixed(1)} USDT</strong> al Pool
                            </span>
                          </li>
                          <li>
                            <span className="plants-hub__feat-icon">⚡</span>
                            <span>Canje a Gemas (+20% bonus) sin esperar los 45d</span>
                          </li>
                        </ul>

                        <div className="plants-hub__pack-stock-bar">
                          <div className="plants-hub__pack-stock-info">
                            <span>Disponibilidad:</span>
                            <strong>
                              {stockLeft} de {pack.maxStock} restantes
                            </strong>
                          </div>
                          <div className="plants-hub__pack-stock-track">
                            <div
                              className="plants-hub__pack-stock-fill"
                              style={{ width: `${(stockLeft / pack.maxStock) * 100}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="plants-hub__pack-buy-btn"
                          disabled={isSoldOut || isSubmitting}
                          onClick={() => handleBuyPack(pack)}
                        >
                          {isSoldOut ? (
                            'AGOTADO'
                          ) : (
                            <>
                              <img src={gema} alt="Gemas" className="plants-hub__btn-gema" />
                              <span>COMPRAR CON {pack.gemsPrice.toLocaleString()} 💎</span>
                            </>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── TAB 2: MIS TOKENS & VESTING (NUEVA SECCIÓN DEDICADA) ── */}
            {activeTab === 'my_tokens' && (
              <div className="plants-hub__my-tokens-pane">
                {/* Métricas y desglose de saldo */}
                <div className="plants-hub__my-tokens-overview">
                  <div className="plants-hub__my-token-card plants-hub__my-token-card--liquid">
                    <div className="plants-hub__my-token-card-header">
                      <span className="plants-hub__card-chip plants-hub__card-chip--green">🟢 SALDO LÍQUIDO</span>
                      <span className="plants-hub__card-est">≈ ${(liquidPlants * spotPrice).toFixed(4)} USDT</span>
                    </div>
                    <div className="plants-hub__my-token-num">
                      <strong>{liquidPlants.toFixed(2)}</strong>
                      <span>PLANTS</span>
                    </div>
                    <p className="plants-hub__my-token-desc">
                      Disponible para <strong>Retiro en USDT (BEP20)</strong> o <strong>Canje por Gemas (+20%)</strong>.
                    </p>
                    <button
                      type="button"
                      className="plants-hub__my-token-btn"
                      onClick={() => setActiveTab('swap')}
                    >
                      🔄 GESTIONAR O RETIRAR
                    </button>
                  </div>

                  <div className="plants-hub__my-token-card plants-hub__my-token-card--locked">
                    <div className="plants-hub__my-token-card-header">
                      <span className="plants-hub__card-chip plants-hub__card-chip--gold">🔒 EN VESTING (45 DÍAS)</span>
                      <span className="plants-hub__card-est">≈ ${(lockedVestingPlants * spotPrice).toFixed(4)} USDT</span>
                    </div>
                    <div className="plants-hub__my-token-num">
                      <strong>{lockedVestingPlants.toFixed(2)}</strong>
                      <span>PLANTS</span>
                    </div>
                    <p className="plants-hub__my-token-desc">
                      Se liberan linealmente a diario a razón de <strong>1/45 por día</strong>.
                    </p>
                    <button
                      type="button"
                      className="plants-hub__my-token-btn plants-hub__my-token-btn--bonus"
                      onClick={() => setActiveTab('swap')}
                    >
                      🔥 CANJEAR AHORA (+20% GEMAS)
                    </button>
                  </div>

                  <div className="plants-hub__my-token-card plants-hub__my-token-card--rate">
                    <div className="plants-hub__my-token-card-header">
                      <span className="plants-hub__card-chip plants-hub__card-chip--blue">⚡ LIBERACIÓN DIARIA</span>
                      <span className="plants-hub__card-est">45 DÍAS LINEAL</span>
                    </div>
                    <div className="plants-hub__my-token-num">
                      <strong>+{(vestingSummary?.dailyAccrualRate ?? 0).toFixed(2)}</strong>
                      <span>PLANTS / DÍA</span>
                    </div>
                    <p className="plants-hub__my-token-desc">
                      Tasa consolidada de desbloqueo sumando todos tus packs activos.
                    </p>
                    <div className="plants-hub__my-token-countdown-tag">
                      ⏱️ Próximo ciclo: <strong>{formatCountdown(countdownSeconds)}</strong>
                    </div>
                  </div>
                </div>

                {/* Banner de Acción: Reclamo Diario de Vesting */}
                {hasClaimableVesting ? (
                  <div className="plants-hub__claim-box plants-hub__claim-box--active">
                    <div className="plants-hub__claim-info">
                      <span className="plants-hub__claim-badge">🎁 TOKENS DESBLOQUEADOS LISTOS</span>
                      <h3 className="plants-hub__claim-title">
                        +{vestingSummary?.claimablePlantsNow.toFixed(2)} PLANTS Disponibles para Transferir
                      </h3>
                      <p className="plants-hub__claim-desc">
                        Tus paquetes han cumplido ciclos diarios de 24h. Transfiere estos tokens a tu saldo líquido
                        para poder retirarlos en USDT o utilizarlos libremente.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="plants-hub__claim-btn"
                      disabled={isClaimingVesting}
                      onClick={handleClaimDailyVesting}
                    >
                      {isClaimingVesting ? (
                        'LIBERANDO...'
                      ) : (
                        `🎁 RECLAMAR (+${vestingSummary?.claimablePlantsNow.toFixed(2)} PLANTS)`
                      )}
                    </button>
                  </div>
                ) : lockedVestingPlants > 0 ? (
                  <div className="plants-hub__claim-box plants-hub__claim-box--waiting">
                    <div className="plants-hub__claim-info">
                      <span className="plants-hub__claim-badge plants-hub__claim-badge--waiting">⏱️ VESTING EN CURSO</span>
                      <h3 className="plants-hub__claim-title">Tus tokens se están liberando cada 24 horas</h3>
                      <p className="plants-hub__claim-desc">
                        Ya estás al día con los reclamos disponibles. Tu siguiente cuota diaria se habilitará en:{' '}
                        <strong>{formatCountdown(countdownSeconds)}</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="plants-hub__claim-box plants-hub__claim-box--empty">
                    <div className="plants-hub__claim-info">
                      <span className="plants-hub__claim-badge">🌱 COMIENZA CON UN PACK</span>
                      <h3 className="plants-hub__claim-title">No tienes paquetes en Vesting actualmente</h3>
                      <p className="plants-hub__claim-desc">
                        Adquiere un Pack de Fundadores en la Preventa para recibir tokens PLANTS respaldados en USDT
                        con liberación lineal diaria a 45 días y bonos exclusivos.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="plants-hub__empty-action-btn"
                      onClick={() => setActiveTab('presale')}
                    >
                      🛒 VER PREVENTA DE FUNDADORES
                    </button>
                  </div>
                )}

                {/* Lista de Paquetes en Vesting */}
                <div className="plants-hub__orders-section">
                  <div className="plants-hub__orders-header">
                    <h4>📦 TUS PAQUETES ADQUIRIDOS ({vestingSummary?.orders?.length ?? 0})</h4>
                    <span className="plants-hub__orders-subtitle">
                      Progreso individual de liberación a 45 días
                    </span>
                  </div>

                  {vestingSummary?.orders && vestingSummary.orders.length > 0 ? (
                    <div className="plants-hub__orders-grid">
                      {vestingSummary.orders.map((order) => {
                        const packDef = PRESALE_PACKS.find((p) => p.id === order.packId)
                        const packTitle = packDef?.title || 'Pack Fundador'
                        const pctDone = Math.min(100, Math.round((order.vestingClaimedDays / 45) * 100))

                        return (
                          <div
                            key={order.id}
                            className={`plants-hub__order-card ${
                              order.isCompleted ? 'plants-hub__order-card--completed' : ''
                            }`}
                          >
                            <div className="plants-hub__order-card-top">
                              <span className="plants-hub__order-title">{packTitle}</span>
                              <span
                                className={`plants-hub__order-status ${
                                  order.isCompleted
                                    ? 'plants-hub__order-status--done'
                                    : 'plants-hub__order-status--active'
                                }`}
                              >
                                {order.isCompleted ? '✓ 100% LIBERADO' : `DÍA ${order.daysElapsed} / 45`}
                              </span>
                            </div>

                            <div className="plants-hub__order-progress-wrap">
                              <div className="plants-hub__order-progress-track">
                                <div
                                  className="plants-hub__order-progress-fill"
                                  style={{ width: `${pctDone}%` }}
                                />
                              </div>
                              <span className="plants-hub__order-progress-text">{pctDone}% transferido</span>
                            </div>

                            <div className="plants-hub__order-stats-grid">
                              <div className="plants-hub__order-stat">
                                <small>TOTAL ASIGNADO</small>
                                <strong>{order.plantsAmount.toLocaleString()} 🌱</strong>
                              </div>
                              <div className="plants-hub__order-stat">
                                <small>TASA DIARIA</small>
                                <strong>+{order.vestingDailyRate.toFixed(2)}/día</strong>
                              </div>
                              <div className="plants-hub__order-stat">
                                <small>DÍAS RECLAMADOS</small>
                                <strong>{order.vestingClaimedDays} de 45</strong>
                              </div>
                              <div className="plants-hub__order-stat">
                                <small>COMPRADO EL</small>
                                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="plants-hub__no-orders">
                      <p>No se encontraron paquetes registrados en tu cuenta.</p>
                    </div>
                  )}
                </div>

                {/* Banner informativo de bypass Super Sink */}
                <div className="plants-hub__bypass-banner">
                  <span className="plants-hub__bypass-icon">⚡</span>
                  <div className="plants-hub__bypass-content">
                    <h4>¿Deseas usar tus tokens en el juego hoy mismo sin esperar los 45 días?</h4>
                    <p>
                      Con el <strong>Super Sink</strong> puedes convertir tus tokens en vesting inmediatamente a{' '}
                      <strong>Gemas del juego</strong> con un <strong>+20% de Bono adicional de regalo</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="plants-hub__bypass-btn"
                    onClick={() => setActiveTab('swap')}
                  >
                    🔥 CANJEAR AHORA CON +20%
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB 3: SWAP A GEMAS & RETIRO USDT ── */}
            {activeTab === 'swap' && (
              <div className="plants-hub__swap-pane">
                <div className="plants-hub__swap-grid">
                  {/* MÓDULO A: SUPER SINK (SWAP A GEMAS CON +20% BONUS) */}
                  <div className="plants-hub__action-box plants-hub__action-box--swap">
                    <div className="plants-hub__action-badge">🔥 SUPER SINK SIN RIESGO</div>
                    <h3 className="plants-hub__action-title">CANJEAR PLANTS POR GEMAS</h3>
                    <p className="plants-hub__action-desc">
                      Obtén un <strong>+20% de Bono adicional</strong> sobre el valor spot. Los tokens son{' '}
                      <strong>quemados al 100%</strong> y <strong>0 USDT salen del pool</strong>, fortaleciendo el precio.
                      ¡Acepta tokens líquidos y tokens en vesting sin penalización!
                    </p>

                    <div className="plants-hub__input-group">
                      <div className="plants-hub__input-header">
                        <label>Cantidad de PLANTS a canjear:</label>
                        <span className="plants-hub__input-max" onClick={() => setSwapAmount(totalPlants.toString())}>
                          MAX: {totalPlants.toFixed(1)} 🌱
                        </span>
                      </div>
                      <div className="plants-hub__input-wrapper">
                        <input
                          type="number"
                          placeholder="0.0"
                          value={swapAmount}
                          onChange={(e) => setSwapAmount(e.target.value)}
                        />
                        <span className="plants-hub__input-unit">PLANTS</span>
                      </div>
                    </div>

                    <div className="plants-hub__swap-preview-card">
                      <div className="plants-hub__preview-row">
                        <span>Valor Spot Real:</span>
                        <span>${((parseFloat(swapAmount) || 0) * spotPrice).toFixed(4)} USDT</span>
                      </div>
                      <div className="plants-hub__preview-row plants-hub__preview-row--bonus">
                        <span>Bono Super Sink (+20%):</span>
                        <span>+${((parseFloat(swapAmount) || 0) * spotPrice * 0.2).toFixed(4)} USDT</span>
                      </div>
                      <div className="plants-hub__preview-row plants-hub__preview-row--total">
                        <strong>Recibes al Instante:</strong>
                        <strong className="plants-hub__preview-gems">+{swapGemsPreview.toLocaleString()} 💎 Gemas</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="plants-hub__action-btn plants-hub__action-btn--swap"
                      disabled={isSubmitting || !swapAmount || parseFloat(swapAmount) <= 0}
                      onClick={handleSwapToGems}
                    >
                      {isSubmitting ? 'PROCESANDO...' : `🔥 QUEMAR Y CANJEAR POR GEMAS`}
                    </button>
                  </div>

                  {/* MÓDULO B: RETIRO USDT BEP20 */}
                  <div className="plants-hub__action-box plants-hub__action-box--cashout">
                    <div className="plants-hub__action-badge plants-hub__action-badge--cashout">💸 RETIRO DIRECTO USDT</div>
                    <h3 className="plants-hub__action-title">CASH-OUT EN USDT (BEP20)</h3>
                    <p className="plants-hub__action-desc">
                      Vende tus PLANTS líquidos directamente contra la curva AMM.{' '}
                      <strong>Requiere Arena 3+ (2,001+ copas)</strong>. Aplica fee del 10% (5% se queda en el pool
                      premiando a los que se quedan, 5% fee de mantenimiento).
                    </p>

                    {!isArena3Plus ? (
                      <div className="plants-hub__lock-notice">
                        <span className="plants-hub__lock-icon">🔒</span>
                        <div className="plants-hub__lock-info">
                          <strong>BLOQUEADO: REQUIERE ARENA 3</strong>
                          <span>
                            Tienes {currentElo} copas. Sube a 2,001+ copas en Ranked para habilitar retiros directos a
                            USDT.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="plants-hub__input-group">
                          <div className="plants-hub__input-header">
                            <label>PLANTS a vender:</label>
                            <span
                              className="plants-hub__input-max"
                              onClick={() => setCashoutAmount(liquidPlants.toString())}
                            >
                              MAX LÍQUIDO: {liquidPlants.toFixed(1)} 🌱
                            </span>
                          </div>
                          <div className="plants-hub__input-wrapper">
                            <input
                              type="number"
                              placeholder="0.0"
                              value={cashoutAmount}
                              onChange={(e) => setCashoutAmount(e.target.value)}
                            />
                            <span className="plants-hub__input-unit">PLANTS</span>
                          </div>
                        </div>

                        <div className="plants-hub__input-group">
                          <label>Dirección Wallet BEP20 (BNB Smart Chain):</label>
                          <input
                            type="text"
                            placeholder="0x... (Tu wallet receptora)"
                            className="plants-hub__input-text"
                            value={cashoutWallet}
                            onChange={(e) => setCashoutWallet(e.target.value)}
                          />
                        </div>

                        <div className="plants-hub__swap-preview-card">
                          <div className="plants-hub__preview-row">
                            <span>Monto Bruto AMM:</span>
                            <span>${cashoutPreview.gross.toFixed(4)} USDT</span>
                          </div>
                          <div className="plants-hub__preview-row">
                            <span>Fee de Protocolo (10%):</span>
                            <span>-${cashoutPreview.fee.toFixed(4)} USDT</span>
                          </div>
                          <div className="plants-hub__preview-row plants-hub__preview-row--total">
                            <strong>Recibes Neto en Wallet:</strong>
                            <strong className="plants-hub__preview-usdt">${cashoutPreview.net.toFixed(4)} USDT</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="plants-hub__action-btn plants-hub__action-btn--cashout"
                          disabled={isSubmitting || !cashoutAmount || parseFloat(cashoutAmount) <= 0 || !cashoutWallet}
                          onClick={handleCashoutUsdt}
                        >
                          {isSubmitting ? 'PROCESANDO...' : `SOLICITAR RETIRO EN USDT`}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: TOKENOMICS & HALVING ── */}
            {activeTab === 'tokenomics' && (
              <div className="plants-hub__tokenomics-pane">
                <div className="plants-hub__tokenomics-stats-grid">
                  <div className="plants-hub__t-stat-card">
                    <span className="plants-hub__t-stat-label">SUPPLY MÁXIMO</span>
                    <strong className="plants-hub__t-stat-val">1,000,000 PLANTS</strong>
                    <small>Fijo e inalterable en código</small>
                  </div>
                  <div className="plants-hub__t-stat-card">
                    <span className="plants-hub__t-stat-label">TOTAL MINTEADO</span>
                    <strong className="plants-hub__t-stat-val">{totalMinted.toLocaleString()} PLANTS</strong>
                    <small>{((totalMinted / 1000000) * 100).toFixed(2)}% del supply total</small>
                  </div>
                  <div className="plants-hub__t-stat-card">
                    <span className="plants-hub__t-stat-label">TOTAL QUEMADO</span>
                    <strong className="plants-hub__t-stat-val plants-hub__stat-red">
                      🔥 {totalBurned.toLocaleString()}
                    </strong>
                    <small>Retirado para siempre de circulación</small>
                  </div>
                  <div className="plants-hub__t-stat-card">
                    <span className="plants-hub__t-stat-label">FÓRMULA CONSTANTE</span>
                    <strong className="plants-hub__t-stat-val">K = R × V</strong>
                    <small>K = 200,000,000 respaldo inmutable</small>
                  </div>
                </div>

                <div className="plants-hub__halving-section">
                  <h4 className="plants-hub__section-subheading">ESCALERA DE HALVINGS (EMISIÓN POR JUEGO)</h4>
                  <div className="plants-hub__halving-ladder">
                    {HALVING_TIERS.map((tier) => (
                      <div
                        key={tier.tier}
                        className={`plants-hub__halving-step ${
                          tier.tier === (marketState?.currentHalvingEra ?? 1) ? 'plants-hub__halving-step--current' : ''
                        }`}
                      >
                        <div className="plants-hub__step-badge">FASE {tier.tier}</div>
                        <div className="plants-hub__step-range">{tier.range}</div>
                        <div className="plants-hub__step-reward">
                          <strong>{tier.rewardPct}</strong> de emisión
                        </div>
                        <div className="plants-hub__step-match">{tier.rewardPerMatch}</div>
                        {tier.tier === (marketState?.currentHalvingEra ?? 1) && (
                          <span className="plants-hub__step-active-tag">ACTIVO AHORA</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 5: GUÍA & REGLAS PVP (SECCIÓN INFORMATIVA DETALLADA) ── */}
            {activeTab === 'info' && (
              <div className="plants-hub__rules-pane">
                <div className="plants-hub__rules-hero">
                  <h3>ℹ️ GUÍA INTEGRAL: TOKEN PLANTS & ECONOMÍA CIRCULAR</h3>
                  <p>
                    Todo lo que necesitas saber sobre el respaldo en dólares reales, la liberación diaria de 45 días,
                    las ganancias en combate y los retiros a tu wallet.
                  </p>
                </div>

                <div className="plants-hub__rules-grid">
                  <div className="plants-hub__rule-card">
                    <span className="plants-hub__rule-icon">🏦</span>
                    <h4>1. Respaldo Real & Curva AMM</h4>
                    <p>
                      A diferencia de tokens inflacionarios sin fondo, cada PLANTS está respaldado por USDT real
                      mediante la fórmula <strong>P = R / V</strong>. El pool inició con <strong>$200 USDT</strong> y
                      recibe el <strong>60% de todas las preventas</strong> y el <strong>70% de las compras de Gemas</strong>.
                      ¡Cada inyección eleva el precio spot para toda la comunidad!
                    </p>
                  </div>

                  <div className="plants-hub__rule-card">
                    <span className="plants-hub__rule-icon">⏳</span>
                    <h4>2. Vesting a 45 Días & Liberación Diaria</h4>
                    <p>
                      Al adquirir un Pack de Preventa, tus PLANTS se liberan de forma lineal a lo largo de{' '}
                      <strong>45 días (1/45 diario)</strong>. Cada 24 horas puedes pulsar{' '}
                      <strong>RECLAMAR</strong> en la pestaña "Mis Tokens" para moverlos a tu saldo líquido.
                      ¡Desde el saldo líquido puedes retirarlos a USDT o canjearlos libremente!
                    </p>
                  </div>

                  <div className="plants-hub__rule-card">
                    <span className="plants-hub__rule-icon">💎</span>
                    <h4>3. Super Sink (+20% Gemas Sin Esperar)</h4>
                    <p>
                      ¿No quieres esperar 45 días para usar tus tokens en el juego? Puedes canjear tus tokens en vesting
                      de inmediato por <strong>Gemas del juego</strong> con un <strong>+20% de Bono adicional</strong>.
                      El token se quema para siempre, protegiendo el pool USDT.
                    </p>
                  </div>

                  <div className="plants-hub__rule-card">
                    <span className="plants-hub__rule-icon">⚔️</span>
                    <h4>4. Ganancias PvP en Arena 3+ (2,001+ Copas)</h4>
                    <p>
                      Arenas 1 y 2 no emiten tokens para frenar multicuentas. A partir de <strong>Arena 3 (2,001+ copas)</strong>,
                      cada victoria legítima (mínimo 45s y 4 plantas desplegadas) otorga de <strong>2.0 a 6.0 PLANTS</strong>{' '}
                      según tu Score competitivo.
                    </p>
                  </div>

                  <div className="plants-hub__rule-card">
                    <span className="plants-hub__rule-icon">⚡</span>
                    <h4>5. Bonus PvP en Vivo (+25% · Primeros 7 Días)</h4>
                    <p>
                      Durante la primera semana de lanzamiento, cada combate ganado contra un{' '}
                      <strong>jugador humano real en vivo</strong> recibe un multiplicador promocional de{' '}
                      <strong>1.25x (+25% BONUS)</strong> de forma automática.
                    </p>
                  </div>

                  <div className="plants-hub__rule-card">
                    <span className="plants-hub__rule-icon">💸</span>
                    <h4>6. Retiro Directo en USDT (BEP20)</h4>
                    <p>
                      Al alcanzar Arena 3+, puedes retirar tus PLANTS líquidos directamente a cualquier billetera BSC
                      (BEP20). Aplica un 10% de fee de protocolo: la mitad se queda en el pool premiando a los holders
                      y la otra mitad cubre servidores y desarrollo.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlantsTokenHub
