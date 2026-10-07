import React, { useState, useEffect, useCallback } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  plantsTokenService,
  type PlantsMarketState,
  type PlantsPriceHistoryPoint,
  type PresalePackDefinition,
  type PlantsVestingSummary,
} from '../../services/plantsTokenService'
import type { TokenTabType, TokenHubSharedProps } from './types'
import { TOKEN_ASSETS } from './tokenAssets'
import { TokenSummaryTab } from './tabs/TokenSummaryTab'
import { TokenPresaleTab } from './tabs/TokenPresaleTab'
import { TokenVestingTab } from './tabs/TokenVestingTab'
import { TokenSwapTab } from './tabs/TokenSwapTab'
import { TokenomicsTab } from './tabs/TokenomicsTab'
import { TokenGuideTab } from './tabs/TokenGuideTab'
import logoImg from '../../assets/images/logo.webp'
import gemaImg from '../../assets/ico/gema.webp'
import monedaImg from '../../assets/ico/moneda.webp'
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
  initialTab?: TokenTabType
}

export const PlantsTokenHub: React.FC<PlantsTokenHubProps> = ({
  onBack,
  userTokens = 0,
  userGold = 0,
  userElo = 1000,
  hasVipPass = false,
  userProfile,
  onRefreshProfile,
  initialTab = 'summary',
}) => {
  const [activeTab, setActiveTab] = useState<TokenTabType>(initialTab)
  const [marketState, setMarketState] = useState<PlantsMarketState | null>(null)
  const [priceHistory, setPriceHistory] = useState<PlantsPriceHistoryPoint[]>([])
  const [vestingSummary, setVestingSummary] = useState<PlantsVestingSummary | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0)
  const [, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClaimingVesting, setIsClaimingVesting] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Saldos y métricas del usuario
  const liquidPlants = Number(userProfile?.plants_balance ?? vestingSummary?.liquidBalance ?? 0)
  const lockedVestingPlants = Number(userProfile?.plants_vesting_locked ?? vestingSummary?.vestingLocked ?? 0)
  const totalPlants = liquidPlants + lockedVestingPlants
  const currentElo = Number(userProfile?.elo_rating ?? userElo ?? 1000)
  const isArena3Plus = currentElo >= 2001

  // Precios y métricas AMM
  const spotPrice = marketState?.spotPrice ?? 0.0002
  const poolUsdt = marketState?.usdtPool ?? 200
  const virtualPlants = marketState?.virtualPlants ?? 1000000
  const totalBurned = marketState?.totalBurned ?? 0
  const totalMinted = marketState?.totalMinted ?? 0
  const circulating = marketState?.circulatingSupply ?? Math.max(0, totalMinted - totalBurned)

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 5000)
  }

  // Cargar datos del servicio
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
    const interval = setInterval(loadData, 12000)
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

  // Manejador de cambio de pestaña con sonido
  const handleTabChange = (tab: TokenTabType) => {
    soundManager.playSound('click', 0.4)
    setActiveTab(tab)
  }

  // Comprar pack de preventa
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
        setActiveTab('vesting')
      } else {
        showNotification(res.error || 'Error al procesar la compra', 'error')
      }
    } catch (err: any) {
      showNotification(err.message || 'Error de conexión', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reclamar vesting diario
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

  // Canjear PLANTS por Gemas (+20% Super Sink)
  const handleSwapToGems = async (amount: number) => {
    setIsSubmitting(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await plantsTokenService.swapPlantsForGems(amount)
      if (res.success) {
        soundManager.playSound('claim', 0.7)
        showNotification(
          `¡Canje exitoso! Quemaste ${amount.toLocaleString()} PLANTS y recibiste +${res.data?.gemsCredited ?? 0} Gemas 💎 (+20% Bonus aplicado)`,
          'success'
        )
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

  // Retirar en USDT (Cash-out)
  const handleCashoutUsdt = async (amount: number, wallet: string) => {
    setIsSubmitting(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await plantsTokenService.requestCashout(amount, wallet)
      if (res.success) {
        soundManager.playSound('claim', 0.8)
        showNotification(
          `¡Solicitud enviada! Retiro de ${amount.toFixed(2)} PLANTS (~$${(amount * 0.95 * spotPrice).toFixed(2)} USDT) procesado hacia ${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
          'success'
        )
        await loadData()
        onRefreshProfile?.()
      } else {
        showNotification(res.error || 'No se pudo procesar el retiro', 'error')
      }
    } catch (err: any) {
      showNotification(err.message || 'Error inesperado', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Propiedades compartidas entre pestañas
  const sharedProps: TokenHubSharedProps = {
    userTokens,
    userGold,
    userElo,
    hasVipPass,
    userProfile,
    marketState,
    priceHistory,
    vestingSummary,
    countdownSeconds,
    isSubmitting,
    isClaimingVesting,
    liquidPlants,
    lockedVestingPlants,
    totalPlants,
    spotPrice,
    poolUsdt,
    virtualPlants,
    totalBurned,
    totalMinted,
    circulating,
    isArena3Plus,
    onTabChange: handleTabChange,
    onBuyPack: handleBuyPack,
    onClaimDailyVesting: handleClaimDailyVesting,
    onSwapToGems: handleSwapToGems,
    onCashoutUsdt: handleCashoutUsdt,
    onRefreshData: loadData,
    showNotification,
  }

  const claimableNow = vestingSummary?.claimablePlantsNow ?? 0

  return (
    <div className="plants-token-root">
      <div className="plants-token-shell">
        {/* =====================================================
             TOP STATUS BAR (MATCHING WIREFRAMES)
             data-section="top-status-bar"
             ===================================================== */}
        <header className="top-status" data-section="top-status-bar" data-label="TOP STATUS BAR">
          {/* LOGO */}
          <div
            className="status-box status-box--brand"
            data-section="brand-logo-slot"
            data-label="LOGO"
            onClick={() => handleTabChange('summary')}
            title="Ir al Resumen Principal"
          >
            <img src={TOKEN_ASSETS.logo || logoImg} alt="Plants Arena Logo" className="status-brand-img" />
            <div>
              <span className="status-brand-title">TOKEN PLANTS</span>
              <span className="status-brand-sub">AMM HUB</span>
            </div>
          </div>

          {/* PLAYER */}
          <div className="status-box" data-section="player-profile-slot" data-label="PLAYER">
            <span className="status-item-icon">👤</span>
            <div className="status-item-data">
              <span className="status-item-lbl">JUGADOR</span>
              <strong className="status-item-val">{userProfile?.username || 'Gladiador'}</strong>
            </div>
          </div>

          {/* PASS */}
          <div className="status-box" data-section="battle-pass-slot" data-label="PASS">
            <span className="status-item-icon">🎟️</span>
            <div className="status-item-data">
              <span className="status-item-lbl">PASE BATALLA</span>
              <strong className={`status-item-val ${hasVipPass ? 'text-gold' : 'text-cyan'}`}>
                {hasVipPass ? 'VIP ACTIVO' : 'PASE GRATIS'}
              </strong>
            </div>
          </div>

          {/* ARENA / RANKING */}
          <div className="status-box" data-section="energy-slot" data-label="ENERGY">
            <span className="status-item-icon">🏆</span>
            <div className="status-item-data">
              <span className="status-item-lbl">RANGO RANKED</span>
              <strong className={`status-item-val ${isArena3Plus ? 'text-green' : 'text-gold'}`}>
                {currentElo.toLocaleString()} COPAS {isArena3Plus ? '(ARENA 3+)' : '(ARENA 1-2)'}
              </strong>
            </div>
          </div>

          {/* GOLD */}
          <div className="status-box" data-section="gold-slot" data-label="GOLD">
            <span className="status-item-icon">
              <img src={monedaImg} alt="Oro" />
            </span>
            <div className="status-item-data">
              <span className="status-item-lbl">ORO DISPONIBLE</span>
              <strong className="status-item-val text-gold">{userGold.toLocaleString()}</strong>
            </div>
          </div>

          {/* GEMS */}
          <div className="status-box" data-section="gems-slot" data-label="GEMS">
            <span className="status-item-icon">
              <img src={gemaImg} alt="Gemas" />
            </span>
            <div className="status-item-data">
              <span className="status-item-lbl">GEMAS</span>
              <strong className="status-item-val text-cyan">{userTokens.toLocaleString()} 💎</strong>
            </div>
          </div>

          {/* PLANTS WALLET */}
          <div className="status-box" data-section="plants-wallet-slot" data-label="PLANTS">
            <span className="status-item-icon">🌱</span>
            <div className="status-item-data">
              <span className="status-item-lbl">BILLETERA PLANTS</span>
              <strong className="status-item-val text-green">
                {liquidPlants.toFixed(1)} <small>({totalPlants.toFixed(1)})</small>
              </strong>
            </div>
          </div>

          {/* BACK BUTTON */}
          <button
            type="button"
            className="status-box status-box--back-btn"
            data-section="settings-slot"
            data-label="SALIR"
            onClick={() => {
              soundManager.playSound('click', 0.5)
              onBack()
            }}
            title="Volver al menú principal"
          >
            ✕
          </button>
        </header>

        {/* =====================================================
             TOKEN SUB-NAVIGATION TABS (ALL 6 TABS)
             data-section="token-navigation"
             ===================================================== */}
        <nav className="token-nav" data-section="token-navigation" data-label="TOKEN NAVIGATION">
          <button
            type="button"
            className={`token-tab ${activeTab === 'summary' ? 'active' : ''}`}
            data-target="summary"
            onClick={() => handleTabChange('summary')}
          >
            <span className="token-tab__icon">🌐</span>
            <span>RESUMEN</span>
          </button>

          <button
            type="button"
            className={`token-tab ${activeTab === 'presale' ? 'active' : ''}`}
            data-target="presale"
            onClick={() => handleTabChange('presale')}
          >
            <span className="token-tab__icon">🛒</span>
            <span>PREVENTA</span>
            <span className="token-tab__badge">20 PACKS</span>
          </button>

          <button
            type="button"
            className={`token-tab ${activeTab === 'vesting' ? 'active' : ''}`}
            data-target="vesting"
            onClick={() => handleTabChange('vesting')}
          >
            <span className="token-tab__icon">🌱</span>
            <span>VESTING</span>
            {claimableNow > 0 && <span className="token-tab__badge">¡LIBERAR!</span>}
          </button>

          <button
            type="button"
            className={`token-tab ${activeTab === 'swap' ? 'active' : ''}`}
            data-target="swap"
            onClick={() => handleTabChange('swap')}
          >
            <span className="token-tab__icon">🔄</span>
            <span>SWAP AMM</span>
          </button>

          <button
            type="button"
            className={`token-tab ${activeTab === 'tokenomics' ? 'active' : ''}`}
            data-target="tokenomics"
            onClick={() => handleTabChange('tokenomics')}
          >
            <span className="token-tab__icon">📊</span>
            <span>TOKENOMICS</span>
          </button>

          <button
            type="button"
            className={`token-tab ${activeTab === 'guide' ? 'active' : ''}`}
            data-target="guide"
            onClick={() => handleTabChange('guide')}
          >
            <span className="token-tab__icon">📖</span>
            <span>GUÍA & REGLAS</span>
          </button>
        </nav>

        {/* =====================================================
             ACTIVE TAB CONTENT RENDERING
             ===================================================== */}
        <main className="token-content-body">
          {activeTab === 'summary' && <TokenSummaryTab {...sharedProps} />}
          {activeTab === 'presale' && <TokenPresaleTab {...sharedProps} />}
          {activeTab === 'vesting' && <TokenVestingTab {...sharedProps} />}
          {activeTab === 'swap' && <TokenSwapTab {...sharedProps} />}
          {activeTab === 'tokenomics' && <TokenomicsTab {...sharedProps} />}
          {activeTab === 'guide' && <TokenGuideTab {...sharedProps} />}
        </main>

        {/* FEEDBACK FLOATING NOTIFICATION */}
        {feedback && (
          <div className={`token-feedback-toast token-feedback-toast--${feedback.type}`}>
            <span>{feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '⚠' : 'ℹ'}</span>
            <span>{feedback.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlantsTokenHub
