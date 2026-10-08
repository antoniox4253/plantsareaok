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
import { TokenStakingTab } from './tabs/TokenStakingTab'
import { TokenSwapTab } from './tabs/TokenSwapTab'
import { TokenomicsTab } from './tabs/TokenomicsTab'
import { TokenGuideTab } from './tabs/TokenGuideTab'
import logoImg from '../../assets/images/logo.webp'
import gemaImg from '../../assets/ico/gema.webp'
import monedaImg from '../../assets/ico/moneda.webp'
import ajustesIcon from '../../assets/ico/ajustes.webp'
import { getPlayerAvatarUrl } from '../../utils/userManager'
import './PlantsTokenHub.css'

interface PlantsTokenHubProps {
  onBack: () => void
  userTokens?: number // Gemas
  userGold?: number
  userElo?: number
  hasVipPass?: boolean
  playerEnergy?: number
  maxPlayerEnergy?: number
  userProfile?: {
    id?: string
    username?: string
    avatar_id?: string
    avatar_url?: string
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
  playerEnergy = 20,
  maxPlayerEnergy = 20,
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

  const displayAvatar = getPlayerAvatarUrl(
    userProfile?.avatar_id || userProfile?.avatar_url || 'peashooter'
  )
  const displayName = userProfile?.username || 'Admin'

  return (
    <div className="plants-token-root">
      <div className="plants-token-shell">
        {/* =====================================================
             TOPBAR (IDÉNTICO A LA PÁGINA DE INICIO CON DATOS REALES)
             ===================================================== */}
        <header className="token-topbar">
          {/* Logo / Botón Volver al Menú Principal */}
          <button
            type="button"
            className="token-topbar-logo-btn"
            onClick={onBack}
            title="Volver al Menú Principal"
          >
            <img src={TOKEN_ASSETS.logo || logoImg} alt="Plant Arena" className="token-topbar-logo-img" />
            <span className="token-topbar-logo-text">PLANT ARENA</span>
          </button>

          <div className="token-topbar-pills">
            {/* 1. Perfil del Jugador */}
            <div className="token-topbar-pill token-topbar-pill--profile" title="Mi Perfil">
              <div className="token-topbar-avatar-wrap">
                <img
                  src={displayAvatar}
                  alt="Avatar"
                  className="token-topbar-avatar-img"
                  onError={(e) => {
                    e.currentTarget.src = '/game-assets/greenfoot/peashooterpacket1.webp'
                  }}
                />
              </div>
              <span className="token-topbar-player-name">{displayName}</span>
            </div>

            {/* 2. Pase de Batalla */}
            <div className="token-topbar-pill token-topbar-pill--vip" title="Pase de Batalla VIP">
              <span className="token-topbar-vip-crown" role="img" aria-label="Corona">👑</span>
              <div className="token-topbar-vip-info">
                <div className="token-topbar-vip-title-row">
                  <span>{hasVipPass ? 'PASE VIP' : 'PASE'}</span>
                  <span>NV 0/20</span>
                </div>
                <div className="token-topbar-vip-bar-track">
                  <div className="token-topbar-vip-bar-fill" style={{ width: '0%' }} />
                </div>
              </div>
            </div>

            {/* 3. Energía */}
            <div className="token-topbar-pill token-topbar-pill--energy" title="Energía">
              <span className="token-topbar-energy-icon">⚡</span>
              <span className="token-topbar-stat-val token-topbar-stat-val--energy">
                {playerEnergy}/{maxPlayerEnergy}
              </span>
            </div>

            {/* 4. Oro */}
            <div className="token-topbar-pill token-topbar-pill--gold" title="Monedas de Oro">
              <img src={monedaImg} alt="Oro" className="token-topbar-stat-icon" />
              <span className="token-topbar-stat-val token-topbar-stat-val--gold">
                {userGold.toLocaleString()}
              </span>
            </div>

            {/* 5. Gemas */}
            <div className="token-topbar-pill token-topbar-pill--gems" title="Gemas">
              <img src={gemaImg} alt="Gemas" className="token-topbar-stat-icon" />
              <span className="token-topbar-stat-val token-topbar-stat-val--gems">
                {userTokens.toLocaleString()}
              </span>
            </div>

            {/* 6. Ajustes / Volver */}
            <button
              type="button"
              className="token-topbar-pill token-topbar-pill--settings"
              onClick={onBack}
              title="Ajustes / Volver al Menú Principal"
            >
              <img src={ajustesIcon} alt="Ajustes" className="token-topbar-settings-img" />
            </button>
          </div>
        </header>

        {/* =====================================================
             BANNER EN ALTA DEFINICIÓN (SÓLO EN RESUMEN, SIN OVERLAYS)
             ===================================================== */}
        {activeTab === 'summary' && (
          <div
            className="token-summary-hd-banner"
            style={{
              backgroundImage: `url(${TOKEN_ASSETS.summaryHeroBanner})`,
            }}
          />
        )}

        {/* =====================================================
             SUB-NAVEGACIÓN GAMING DE PESTAÑAS (NO MUY GRANDES)
             Debajo del banner en Resumen, o debajo del header en las demás
             ===================================================== */}
        <nav className="token-nav-bar">
          <button
            type="button"
            className={`token-nav-tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => handleTabChange('summary')}
          >
            <span className="token-nav-tab-icon">🌱</span>
            <span>RESUMEN</span>
          </button>

          <button
            type="button"
            className={`token-nav-tab ${activeTab === 'presale' ? 'active' : ''}`}
            onClick={() => handleTabChange('presale')}
          >
            <span className="token-nav-tab-icon">🛒</span>
            <span>PREVENTA</span>
          </button>

          <button
            type="button"
            className={`token-nav-tab ${activeTab === 'vesting' ? 'active' : ''}`}
            onClick={() => handleTabChange('vesting')}
          >
            <span className="token-nav-tab-icon">🪙</span>
            <span>MIS PLANTS</span>
            {claimableNow > 0 && <span className="token-nav-badge">DISPONIBLE</span>}
          </button>

          <button
            type="button"
            className={`token-nav-tab ${activeTab === 'swap' ? 'active' : ''}`}
            onClick={() => handleTabChange('swap')}
          >
            <span className="token-nav-tab-icon">🔄</span>
            <span>SWAP</span>
          </button>

          <button
            type="button"
            className={`token-nav-tab ${activeTab === 'tokenomics' ? 'active' : ''}`}
            onClick={() => handleTabChange('tokenomics')}
          >
            <span className="token-nav-tab-icon">📊</span>
            <span>TOKENOMICS</span>
          </button>

          <button
            type="button"
            className={`token-nav-tab ${activeTab === 'guide' ? 'active' : ''}`}
            onClick={() => handleTabChange('guide')}
          >
            <span className="token-nav-tab-icon">📜</span>
            <span>GUÍA</span>
          </button>
        </nav>

        {/* =====================================================
             ÁREA DE CONTENIDO DE PESTAÑA (COMPACTA, SIN SCROLL)
             ===================================================== */}
        <main className="token-tab-content-area">
          {activeTab === 'summary' && <TokenSummaryTab {...sharedProps} />}
          {activeTab === 'presale' && <TokenPresaleTab {...sharedProps} />}
          {activeTab === 'vesting' && <TokenVestingTab {...sharedProps} />}
          {activeTab === 'staking' && <TokenStakingTab {...sharedProps} />}
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
