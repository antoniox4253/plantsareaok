import { useState, useEffect, useCallback, useMemo } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  getRemainingTimeString,
  calculateInstantUnlockGoldCost,
  type FreePackSlot,
} from '../../utils/freePackManager'
import { toggleFullscreen } from '../../utils/fullscreen'
import { BATTLE_PASS_LEVELS } from '../../utils/battlePassManager'
import { UserManager, type PlayerProfile, getPlayerAvatarUrl } from '../../utils/userManager'
import ProfileModal, { type ProfileTab } from '../ProfileModal/ProfileModal'
import ModeSelectorModal from '../ModeSelector/ModeSelectorModal'
import ArenaAdsModal from '../ArenaAds/ArenaAdsModal'
import type { ArenaAdsRun, ArenaAdsLoot } from '../../utils/arenaAdsManager'
import TournamentModal from '../Tournament/TournamentModal'
import GlobalChat from '../GlobalChat/GlobalChat'
import AuctionModal from '../Auction/AuctionModal'
import MisionesModal from '../Misiones/MisionesModal'
import LotteryModal from '../Lottery/LotteryModal'
import KeybindingsModal from '../KeybindingsModal/KeybindingsModal'
import NotificationModal from '../Notifications/NotificationModal'
import { SupabaseService, type PlayerNotificationItem } from '../../services/supabaseService'
import moneda from '../../assets/ico/moneda.webp'
import gema from '../../assets/ico/gema.webp'
import ranking from '../../assets/ico/Ranking.webp'
import ajustesIcon from '../../assets/ico/ajustes.webp'
import { tournamentService } from '../../services/tournamentService'
import { SeasonManager } from '../../utils/seasonManager'
import type { PlantId, TournamentModel, PlantCardInstance } from '../../types/game'
import './MainMenu.css'
import './BosqueRenovado.css'

interface MainMenuProps {
  userProfile?: {
    id?: string
    username?: string
    avatar_id?: string
    avatar_url?: string
    elo_rating?: number
    gems_balance?: number
    gold_balance?: number
    is_returning_churn?: boolean
    returning_bonus_available?: boolean
    has_purchased_starter_pack?: boolean
    energy_current?: number
    has_vip_pass?: boolean
  } | null
  userElo?: number
  userXp?: number
  userTokens?: number
  userGold?: number
  hasVipPass?: boolean
  unlockedPlants?: PlantId[]
  plantInstances?: PlantCardInstance[]
  claimedVipLevels?: number[]
  claimedArenaAdsLevels?: number[]
  freePackSlots?: FreePackSlot[]
  onPlay: () => void
  /** Duelo amistoso: código de sala privada y apuesta opcional. */
  onPlayFriendly?: (roomCode: string, betGems: number) => void
  onStartArenaAdsBattle?: (run: ArenaAdsRun) => void
  onClaimArenaAdsLoot?: (loot: ArenaAdsLoot, multiplier?: number, newlyClaimedLevels?: number[]) => Promise<any> | void
  onStartTournamentMatch?: (opponentName: string, tournamentId: string, tournamentDeck?: PlantId[]) => void
  onOpenCollection?: () => void
  onOpenJardin?: () => void
  onOpenShop?: (tab?: 'packs' | 'pass' | 'gold' | 'energy' | 'market') => void
  onOpenRanking?: () => void
  onOpenMisPartidas?: () => void
  onOpenBattlePass?: () => void
  onOpenClan?: () => void
  onOpenMarketplace?: () => void
  onOpenMisiones?: () => void
  onOpenLoteria?: () => void
  onOpenPlantsToken?: (tab?: 'summary' | 'presale' | 'vesting' | 'swap' | 'tokenomics' | 'guide') => void
  onOpenStreaming?: () => void
  onOpenLanding?: () => void
  onOpenAdmin?: () => void
  onOpenStrategicPlaytest?: () => void
  onOpenBetaInfo?: () => void
  isAdmin?: boolean
  onSignOut?: () => void
  onStartSlotUnlock?: (slotId: number) => { success: boolean; error?: string }
  onFastUnlockSlot?: (slotId: number) => Promise<{ success: boolean; goldSpent?: number; error?: string }>
  onOpenSlotPack?: (slotId: number) => void
  playerEnergy?: number
  maxPlayerEnergy?: number
  onDeductTokens?: (amountUsd: number) => boolean
  onDeductGold?: (amount: number) => boolean
  onlineUsersCount?: number
  reopenTournamentModal?: boolean
  onResetReopenTournamentModal?: () => void
  reopenArenaAdsModal?: boolean
  onResetReopenArenaAdsModal?: () => void
  reopenModeSelector?: boolean
  onResetReopenModeSelector?: () => void
  onRewardsChanged?: () => Promise<void> | void
}

export default function MainMenu({
  userProfile,
  onlineUsersCount = 25,
  userElo = 1000,
  userXp = 0,
  userTokens = 0,
  userGold = 0,
  hasVipPass = false,
  playerEnergy = 20,
  maxPlayerEnergy = 20,
  unlockedPlants,
  plantInstances,
  claimedVipLevels = [],
  claimedArenaAdsLevels = [],
  freePackSlots = [],
  onPlay,
  onPlayFriendly,
  onStartArenaAdsBattle,
  onClaimArenaAdsLoot,
  onStartTournamentMatch,
  onOpenCollection,
  onOpenJardin,
  onOpenShop,
  onOpenRanking,
  onOpenMisPartidas,
  onOpenBattlePass,
  onOpenClan,
  onOpenMisiones,
  onOpenLoteria,
  onOpenPlantsToken,
  onOpenStreaming,
  onOpenLanding,
  onOpenAdmin,
  onOpenStrategicPlaytest,
  onOpenBetaInfo,
  isAdmin = false,
  onSignOut,
  onStartSlotUnlock,
  onFastUnlockSlot,
  onOpenSlotPack,
  onDeductTokens,
  onDeductGold,
  reopenTournamentModal,
  onResetReopenTournamentModal,
  reopenArenaAdsModal,
  onResetReopenArenaAdsModal,
  reopenModeSelector,
  onResetReopenModeSelector,
  onRewardsChanged,
}: MainMenuProps) {
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(() => UserManager.getProfile())
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [profileInitialTab, setProfileInitialTab] = useState<ProfileTab>('profile')
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false)
  const [isArenaAdsModalOpen, setIsArenaAdsModalOpen] = useState<boolean>(false)
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false)
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false)
  const [globalChatUnreadCount, setGlobalChatUnreadCount] = useState(0)
  const [showLotteryModal, setShowLotteryModal] = useState(false)
  const [lotteryInitialTab, setLotteryInitialTab] = useState<'wheel' | 'auction' | 'code'>('wheel')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isKeybindingsOpen, setIsKeybindingsOpen] = useState(false)
  const [newsModal, setNewsModal] = useState<{
    title: string
    message: string | React.ReactNode
    actionLabel?: string
    onAction?: () => void
  } | null>(null)

  // Centro de Notificaciones del Jugador
  const [notifications, setNotifications] = useState<PlayerNotificationItem[]>([])
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState<boolean>(false)
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(false)

  const refreshNotifications = useCallback(async () => {
    if (!userProfile?.id) return
    setNotificationsLoading(true)
    try {
      const res = await SupabaseService.getPlayerNotifications(30)
      if (res && res.success) {
        setNotifications(res.notifications || [])
        setUnreadNotificationsCount(res.unreadCount || 0)
      }
    } catch (e) {
      console.warn('Error cargando notificaciones del jugador:', e)
    } finally {
      setNotificationsLoading(false)
    }
  }, [userProfile?.id])

  useEffect(() => {
    void refreshNotifications()
    const intv = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void refreshNotifications()
    }, 30000)
    return () => clearInterval(intv)
  }, [refreshNotifications])

  const handleMarkAllNotificationsRead = async () => {
    try {
      await SupabaseService.markPlayerNotificationsRead()
      setUnreadNotificationsCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch (e) {
      console.warn('Error marcando notificaciones leídas:', e)
    }
  }

  useEffect(() => {
    const handleOpenLottery = (e: any) => {
      setLotteryInitialTab(e?.detail?.tab || 'wheel')
      setShowLotteryModal(true)
    }
    window.addEventListener('open_lottery_modal', handleOpenLottery)
    return () => window.removeEventListener('open_lottery_modal', handleOpenLottery)
  }, [])

  const handleToggleGlobalChat = () => {
    setIsGlobalChatOpen((prev) => {
      const next = !prev
      if (next) {
        setGlobalChatUnreadCount(0)
      }
      return next
    })
    soundManager.playSound('click', 0.5)
  }

  useEffect(() => {
    if (reopenTournamentModal) {
      setIsTournamentModalOpen(true)
      if (onResetReopenTournamentModal) {
        onResetReopenTournamentModal()
      }
    }
  }, [reopenTournamentModal, onResetReopenTournamentModal])

  useEffect(() => {
    if (reopenArenaAdsModal) {
      setIsArenaAdsModalOpen(true)
      if (onResetReopenArenaAdsModal) {
        onResetReopenArenaAdsModal()
      }
    }
  }, [reopenArenaAdsModal, onResetReopenArenaAdsModal])

  useEffect(() => {
    if (reopenModeSelector) {
      setIsModeSelectorOpen(true)
      if (onResetReopenModeSelector) {
        onResetReopenModeSelector()
      }
    }
  }, [reopenModeSelector, onResetReopenModeSelector])

  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isMuted())
  const [ticker, setTicker] = useState<number>(0)
  const [upcomingTournament, setUpcomingTournament] = useState<TournamentModel | null>(null)
  const [activeAlert, setActiveAlert] = useState<{
    title: string
    message: string
    icon: string
    actionLabel?: string
    onAction?: () => void
  } | null>(null)
  const [slotToAccelerate, setSlotToAccelerate] = useState<FreePackSlot | null>(null)
  const [isAccelerating, setIsAccelerating] = useState<boolean>(false)
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState<boolean>(false)
  const [isMisionesModalOpen, setIsMisionesModalOpen] = useState<boolean>(false)

  const handleCloseGlobalChat = useCallback(() => setIsGlobalChatOpen(false), [])
  const handleCloseAuctionModal = useCallback(() => setIsAuctionModalOpen(false), [])
  const handleCloseMisionesModal = useCallback(() => setIsMisionesModalOpen(false), [])
  const handleCloseLotteryModal = useCallback(() => setShowLotteryModal(false), [])

  const handleConfirmAccelerate = async () => {
    if (!slotToAccelerate || !onFastUnlockSlot || isAccelerating) return
    setIsAccelerating(true)
    try {
      const res = await onFastUnlockSlot(slotToAccelerate.slotId)
      setSlotToAccelerate(null)
      if (!res.success) {
        setActiveAlert({
          title: 'ORO INSUFICIENTE',
          message: res.error || 'No se pudo acelerar el sobre',
          icon: '⚠️',
        })
      } else {
        soundManager.playSound('victory', 0.8)
      }
    } catch (err: any) {
      setSlotToAccelerate(null)
      setActiveAlert({
        title: 'ERROR AL ACELERAR',
        message: err?.message || 'Error inesperado al acelerar el sobre',
        icon: '⚠️',
      })
    } finally {
      setIsAccelerating(false)
    }
  }

  const isReturningUser = Boolean(
    userProfile?.is_returning_churn &&
    (!userProfile?.has_purchased_starter_pack || userProfile?.returning_bonus_available)
  )

  const handlePlayClick = () => {
    soundManager.playSound('click', 0.5)
    if (userProfile?.is_returning_churn && !userProfile?.has_purchased_starter_pack) {
      setActiveAlert({
        title: 'PACK STARTER REQUERIDO',
        message: '¡Bienvenido de vuelta! Al haber estado inactivo se reiniciaron tus cartas anteriores. Adquiere el Pack Starter en la Tienda con tu 30% de bono extra para volver a combatir y farmear.',
        icon: '🌱',
      })
      return
    }
    setIsModeSelectorOpen(true)
  }

  const handleSlotClick = (slot?: FreePackSlot) => {
    if (!slot) return
    if (slot.status === 'locked' && onStartSlotUnlock) {
      const res = onStartSlotUnlock(slot.slotId)
      if (!res.success && res.error) {
        setActiveAlert({ title: 'SLOT OCUPADO', message: res.error, icon: '⏳' })
      } else {
        soundManager.playSound('click', 0.5)
      }
    } else if (
      slot.status === 'ready' ||
      (slot.status === 'unlocking' &&
        slot.unlockStartedAt &&
        Date.now() - slot.unlockStartedAt >= slot.durationHours * 3600 * 1000)
    ) {
      if (onOpenSlotPack) {
        soundManager.playSound('click', 0.5)
        onOpenSlotPack(slot.slotId)
      }
    } else if (slot.status === 'unlocking') {
      if (onFastUnlockSlot) {
        soundManager.playSound('click', 0.5)
        setSlotToAccelerate(slot)
      }
    }
  }

  const handleOpenNews = (
    title: string,
    message: string | React.ReactNode,
    actionLabel?: string,
    onAction?: () => void
  ) => {
    soundManager.playSound('click', 0.5)
    setNewsModal({ title, message, actionLabel, onAction })
  }

  const handleOpenPlantsTokenNews = () => {
    soundManager.playSound('click', 0.5)
    setNewsModal({
      title: 'Token PLANTS: Preventa Génesis y Packs Fundadores',
      actionLabel: '🌱 IR A LA PREVENTA',
      onAction: () => {
        soundManager.playSound('click', 0.5)
        onOpenPlantsToken?.()
      },
      message: (
        <div className="bosque-plants-news">
          <div className="bosque-plants-news__hero">
            <div className="bosque-plants-news__avatar-wrap">
              <img
                src="/game-assets/token/logo.webp"
                alt="Token PLANTS"
                className="bosque-plants-news__avatar-img"
              />
            </div>
            <div className="bosque-plants-news__hero-info">
              <span className="bosque-plants-news__hero-tag">🌱 ECO-FINANZAS · FASE PREVENTA (5 DÍAS)</span>
              <h4 className="bosque-plants-news__hero-title">¡Lanzamiento Oficial del Token PLANTS!</h4>
              <p className="bosque-plants-news__hero-sub">
                Participa en la <strong>Preventa Génesis</strong> exclusiva. Cada compra inyecta un <strong>60% directamente al Pool de Liquidez en USDT</strong>, otorga sobres, oro masivo y activa un vesting diario de 45 días al finalizar la beta.
              </p>
            </div>
          </div>

          <div className="bosque-plants-news__packs-grid">
            {/* PACK BÁSICO */}
            <div className="bosque-plants-news__pack-card bosque-plants-news__pack-card--common">
              <div className="bosque-plants-news__pack-header">
                <span className="bosque-plants-news__pack-badge">PACK BÁSICO</span>
                <span className="bosque-plants-news__pack-gems text-gems">+200 Gemas 💎</span>
              </div>
              <div className="bosque-plants-news__pack-body">
                <div className="bosque-plants-news__stat-row">
                  <span>Recompensas:</span>
                  <strong>1 Sobre Común + 1,000 Oro</strong>
                </div>
                <div className="bosque-plants-news__stat-row">
                  <span>Inyección Pool:</span>
                  <strong className="text-usdt">$6.0 USDT (60%)</strong>
                </div>
                <div className="bosque-plants-news__stat-row">
                  <span>Vesting (45d):</span>
                  <strong className="text-plants">+55.56 PLANTS / día</strong>
                </div>
              </div>
            </div>

            {/* PACK ÉPICO */}
            <div className="bosque-plants-news__pack-card bosque-plants-news__pack-card--epic">
              <div className="bosque-plants-news__pack-header">
                <span className="bosque-plants-news__pack-badge bosque-plants-news__pack-badge--epic">PACK ÉPICO</span>
                <span className="bosque-plants-news__pack-gems text-gems">+500 Gemas 💎</span>
              </div>
              <div className="bosque-plants-news__pack-body">
                <div className="bosque-plants-news__stat-row">
                  <span>Recompensas:</span>
                  <strong>1 Sobre Épico + 2,500 Oro</strong>
                </div>
                <div className="bosque-plants-news__stat-row">
                  <span>Inyección Pool:</span>
                  <strong className="text-usdt">$15.0 USDT (60%)</strong>
                </div>
                <div className="bosque-plants-news__stat-row">
                  <span>Vesting (45d):</span>
                  <strong className="text-plants">+166.67 PLANTS / día</strong>
                </div>
              </div>
            </div>

            {/* PACK LEGENDARIO */}
            <div className="bosque-plants-news__pack-card bosque-plants-news__pack-card--legendary">
              <div className="bosque-plants-news__pack-header">
                <span className="bosque-plants-news__pack-badge bosque-plants-news__pack-badge--legendary">PACK LEGENDARIO</span>
                <span className="bosque-plants-news__pack-gems text-gems">+1,000 Gemas 💎</span>
              </div>
              <div className="bosque-plants-news__pack-body">
                <div className="bosque-plants-news__stat-row">
                  <span>Recompensas:</span>
                  <strong>1 Sobre Legendario + 4,000 Oro</strong>
                </div>
                <div className="bosque-plants-news__stat-row">
                  <span>Inyección Pool:</span>
                  <strong className="text-usdt">$30.0 USDT (60%)</strong>
                </div>
                <div className="bosque-plants-news__stat-row">
                  <span>Vesting (45d):</span>
                  <strong className="text-plants">+333.33 PLANTS / día</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="bosque-plants-news__guarantees">
            <div className="bosque-plants-news__guarantee-item">
              <span className="bosque-plants-news__guarantee-icon">💧</span>
              <div>
                <strong>Respaldo de Liquidez Real</strong>
                <p>El 60% de cada compra se inyecta directamente al Pool USDT de respaldo para garantizar valor de intercambio.</p>
              </div>
            </div>
            <div className="bosque-plants-news__guarantee-item">
              <span className="bosque-plants-news__guarantee-icon">📊</span>
              <div>
                <strong>Economía y Vesting Diario</strong>
                <p>Tokens liberados gradualmente durante 45 días sin inflación descontrolada para proteger a los jugadores.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    })
  }

  const handleOpenSecretCodeNews = () => {
    soundManager.playSound('click', 0.5)
    setNewsModal({
      title: 'Código Secreto: ¡Ronda #6 en Vivo!',
      actionLabel: '🔐 JUGAR CÓDIGO SECRETO',
      onAction: () => {
        soundManager.playSound('click', 0.5)
        setLotteryInitialTab('code')
        setShowLotteryModal(true)
      },
      message: (
        <div className="bosque-code-news">
          <div className="bosque-code-news__hero">
            <div className="bosque-code-news__avatar-wrap">
              <span className="bosque-code-news__avatar-icon">🔐</span>
            </div>
            <div className="bosque-code-news__hero-info">
              <span className="bosque-code-news__hero-tag">✨ MINIJUEGO TÁCTICO · RONDA 6 EN VIVO</span>
              <h4 className="bosque-code-news__hero-title">El Desafío Mental de la Arena</h4>
              <p className="bosque-code-news__hero-sub">
                ¡Descifra la combinación secreta de <strong>5 plantas únicas</strong>! Pon a prueba tu deducción lógica y llévate el gran bote de gemas.
              </p>
            </div>
          </div>

          <div className="bosque-code-news__prizes-grid">
            <div className="bosque-code-news__prize-card bosque-code-news__prize-card--jackpot">
              <span className="bosque-code-news__prize-badge">GRAN BOTE TOP #1 👑</span>
              <div className="bosque-code-news__prize-val text-gems">50 Gemas 💎</div>
              <p className="bosque-code-news__prize-hint">Para el primer guerrero que acierte el 100% de la combinación exacta.</p>
            </div>

            <div className="bosque-code-news__prize-card bosque-code-news__prize-card--ranking">
              <span className="bosque-code-news__prize-badge bosque-code-news__prize-badge--ranking">PREMIOS TOP 2 AL 10 💰</span>
              <div className="bosque-code-news__prize-val text-gold">Hasta 100 Oro 🪙</div>
              <p className="bosque-code-news__prize-hint">Reparto escalonado según tu mejor porcentaje de aciertos en la tabla.</p>
            </div>
          </div>

          <div className="bosque-code-news__rules-grid">
            <div className="bosque-code-news__rule-item">
              <span className="bosque-code-news__rule-icon">🎟️</span>
              <div>
                <strong>3 Intentos Gratuitos</strong>
                <p>Todos los jugadores reciben 3 intentos sin costo para iniciar la ronda.</p>
              </div>
            </div>
            <div className="bosque-code-news__rule-item">
              <span className="bosque-code-news__rule-icon">🟢</span>
              <div>
                <strong>Semáforo Táctico (Wordle)</strong>
                <p>Verde = planta y posición correcta · Amarillo = planta en otra casilla · Rojo = descarte.</p>
              </div>
            </div>
            <div className="bosque-code-news__rule-item">
              <span className="bosque-code-news__rule-icon">🕵️</span>
              <div>
                <strong>Pistas Deductivas (10 💎)</strong>
                <p>Descarta plantas o confirma la presencia de especies clave para resolver el enigma.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    })
  }

  useEffect(() => {
    const syncProfile = () => setPlayerProfile(UserManager.getProfile())
    window.addEventListener('player_profile_updated', syncProfile)
    return () => window.removeEventListener('player_profile_updated', syncProfile)
  }, [])

  const currentPassXp = userXp ?? 0
  const highestClaimed = claimedVipLevels.length > 0 ? Math.max(...claimedVipLevels) : 0
  const highestLevelReached = Math.max(
    highestClaimed,
    BATTLE_PASS_LEVELS.filter((l) => currentPassXp >= l.requiredXp).length
  )
  const claimableCount = hasVipPass
    ? BATTLE_PASS_LEVELS.filter(
        (l) => currentPassXp >= l.requiredXp && !claimedVipLevels.includes(l.level)
      ).length
    : 0

  useEffect(() => {
    soundManager.playBgm('menu')
    const unsubscribe = soundManager.subscribe((muted) => setIsMuted(muted))
    return () => unsubscribe()
  }, [])

  // Tick cada segundo para actualizar temporizadores
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker((t) => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadUpcomingTournament = useCallback(async () => {
    try {
      const list = await tournamentService.listTournaments()
      const now = Date.now()

      const liveTourney = list.find((t) => {
        if (t.status === 'live') return true
        const start = new Date(t.start_time).getTime()
        const end = new Date(t.end_time).getTime()
        return now >= start && now < end
      })

      if (liveTourney) {
        setUpcomingTournament(liveTourney)
        return
      }

      const scheduled = list
        .filter((t) => {
          if (t.status === 'ended' || t.status === 'cancelled') return false
          const start = new Date(t.start_time).getTime()
          return start > now
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

      setUpcomingTournament(scheduled[0] || null)
    } catch (err) {
      console.warn('Error al cargar próximo torneo:', err)
    }
  }, [])

  useEffect(() => {
    void loadUpcomingTournament()
    const intv = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void loadUpcomingTournament()
    }, 60000)
    return () => clearInterval(intv)
  }, [loadUpcomingTournament])

  useEffect(() => {
    if (!isTournamentModalOpen) {
      void loadUpcomingTournament()
    }
  }, [isTournamentModalOpen, loadUpcomingTournament])

  const upcomingTourneyInfo = useMemo(() => {
    if (!upcomingTournament) return null
    const now = Date.now()
    const startMs = new Date(upcomingTournament.start_time).getTime()
    const endMs = new Date(upcomingTournament.end_time).getTime()

    const isLive = upcomingTournament.status === 'live' || (now >= startMs && now < endMs)
    const isScheduled = now < startMs

    if (!isLive && !isScheduled) return null

    const targetMs = isLive ? endMs : startMs
    const diffSecs = Math.max(0, Math.floor((targetMs - now) / 1000))
    const days = Math.floor(diffSecs / 86400)
    const h = Math.floor((diffSecs % 86400) / 3600)
    const m = Math.floor((diffSecs % 3600) / 60)
    const s = diffSecs % 60

    let countdownStr = ''
    if (days > 0) {
      countdownStr = `${days}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`
    } else if (h > 0) {
      countdownStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    } else {
      countdownStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return {
      isLive,
      countdownStr,
      title: upcomingTournament.title,
    }
  }, [ticker, upcomingTournament])

  const seasonStatus = useMemo(() => {
    return SeasonManager.getSeasonStatus()
  }, [ticker])

  const [bannerSlide, setBannerSlide] = useState<number>(0)
  // Banner recordatorio de torneo (inicializado en true para que cada vez que carguen o actualicen la página aparezca)
  const [showTournamentBanner, setShowTournamentBanner] = useState<boolean>(true)

  useEffect(() => {
    if (isReturningUser || showTournamentBanner) return
    const timer = setInterval(() => {
      setBannerSlide((prev) => (prev + 1) % 5)
    }, 10000)
    return () => clearInterval(timer)
  }, [isReturningUser, showTournamentBanner])

  const displayAvatar = getPlayerAvatarUrl(
    userProfile?.avatar_id || userProfile?.avatar_url || playerProfile.avatar
  )
  const displayName = userProfile?.username || playerProfile.name || 'Jugador'

  return (
    <div className="bosque-dashboard" aria-label="Dashboard Plants Arena">
      {/* ── 1. HITBOXES INTERACTIVOS PRINCIPALES (BASADOS EN EL REPOSITORIO DESCARGADO) ── */}

      {/* Menú lateral izquierdo */}
      <button
        type="button"
        className="hit"
        data-action="inicio"
        aria-label="inicio"
        title="Inicio (Lobby)"
        onClick={() => soundManager.playSound('click', 0.4)}
      >
        inicio
      </button>
      <button
        type="button"
        className="hit"
        data-action="jardin"
        aria-label="jardin"
        title="Jardín y Recursos de Cultivo"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenJardin?.()
        }}
      >
        jardin
      </button>
      <button
        type="button"
        className="hit"
        data-action="coleccion"
        aria-label="coleccion"
        title="Colección y Mazo"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenCollection?.()
        }}
      >
        coleccion
      </button>
      <button
        type="button"
        className="hit"
        data-action="ranking"
        aria-label="ranking"
        title="Ranking y Camino de Copas"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenRanking?.()
        }}
      >
        ranking
      </button>
      <button
        type="button"
        className="hit"
        data-action="tienda"
        aria-label="tienda"
        title="Tienda de Sobres y Recursos"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenShop?.()
        }}
      >
        tienda
      </button>
      <button
        type="button"
        className="hit"
        data-action="mis-partidas"
        aria-label="mis partidas"
        title="Mis Partidas y Repeticiones"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenMisPartidas?.()
        }}
      >
        mis-partidas
      </button>
      <button
        type="button"
        className="hit"
        data-action="misiones"
        aria-label="misiones"
        title="Misiones Diarias y Racha"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          if (onOpenMisiones) onOpenMisiones()
          else setIsMisionesModalOpen(true)
        }}
      >
        misiones
      </button>
      <button
        type="button"
        className="hit"
        data-action="clan"
        aria-label="clan"
        title="Clanes y Batallas de Clan"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenClan?.()
        }}
      >
        clan
      </button>
      <button
        type="button"
        className="hit"
        data-action="loteria"
        aria-label="loteria"
        title="Ruleta de la Suerte, Subastas y Lotería"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          if (onOpenLoteria) onOpenLoteria()
          else setShowLotteryModal(true)
        }}
      >
        loteria
        <span className="bosque-loteria-pulse-badge">🔥 EN VIVO</span>
      </button>

      {/* ── BARRA SUPERIOR DINÁMICA (Pills 3D RPG con datos 100% reales de la base de datos) ── */}
      <button
        type="button"
        className="hit"
        data-action="logo"
        aria-label="logo"
        title="Volver a Portada / Landing"
        onClick={() => {
          soundManager.playSound('click', 0.4)
          onOpenLanding?.()
        }}
      >
        logo
      </button>

      {/* 1. Perfil del Jugador */}
      <button
        type="button"
        className="topbar-pill topbar-pill--profile"
        data-action="perfil"
        aria-label="perfil"
        title="Mi Perfil, Depositar y Retirar"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          setProfileInitialTab('profile')
          setIsProfileModalOpen(true)
        }}
      >
        <div className="topbar-avatar-wrap">
          <img
            src={displayAvatar}
            alt="Avatar"
            className="topbar-avatar-img"
            onError={(e) => {
              e.currentTarget.src = '/game-assets/greenfoot/peashooterpacket1.webp'
            }}
          />
        </div>
        <span className="topbar-player-name">{displayName}</span>
      </button>

      {/* 2. Pase VIP */}
      <button
        type="button"
        className={`topbar-pill topbar-pill--vip ${!hasVipPass ? 'topbar-pill--vip-locked' : ''}`}
        data-action="pase-vip"
        aria-label="pase vip"
        title={
          hasVipPass
            ? `Pase VIP Activo — Nivel ${highestLevelReached}/20 (${currentPassXp.toLocaleString()} / 3,300 XP)`
            : `Pase VIP — ${currentPassXp.toLocaleString()} XP acumulada (${highestLevelReached}/20 niveles alcanzados listos para cobrar al activar)`
        }
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenBattlePass?.()
        }}
      >
        <span className="topbar-vip-crown" role="img" aria-label={hasVipPass ? 'Corona VIP' : 'Pase VIP'}>
          👑
        </span>
        <div className="topbar-vip-info">
          <div className="topbar-vip-title-row">
            <span>PASE VIP</span>
            {hasVipPass ? (
              <span>
                NV {highestLevelReached}/20
                {claimableCount > 0 && ` (✨ ${claimableCount})`}
              </span>
            ) : (
              <span className="topbar-vip-locked-tag">
                {highestLevelReached > 0 ? `🎁 ${highestLevelReached} LISTOS` : `${currentPassXp} XP`}
              </span>
            )}
          </div>
          <div className="topbar-vip-bar-track">
            <div
              className="topbar-vip-bar-fill"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(currentPassXp > 0 ? 5 : 0, Math.round((currentPassXp / 3300) * 100))
                )}%`,
              }}
            />
          </div>
        </div>
      </button>

      {/* 3. Energías (Sincronizado con Supabase / profiles.energy_current) */}
      <div
        className="topbar-pill topbar-pill--energy topbar-pill--static"
        data-action="energia"
        aria-label="energia"
        title={`Energía Diaria (${typeof playerEnergy === 'number' ? playerEnergy : (userProfile?.energy_current ?? 20)}/${(hasVipPass || userProfile?.has_vip_pass) ? 25 : maxPlayerEnergy}⚡)`}
      >
        <span className="topbar-energy-icon">⚡</span>
        <span className="topbar-stat-val topbar-stat-val--energy">
          {typeof playerEnergy === 'number' ? playerEnergy : (userProfile?.energy_current ?? 20)}/
          {(hasVipPass || userProfile?.has_vip_pass) ? 25 : maxPlayerEnergy}
        </span>
      </div>

      {/* 4. Oro */}
      <div
        className="topbar-pill topbar-pill--gold topbar-pill--static"
        data-action="oro"
        aria-label="oro"
        title="Monedas de Oro"
      >
        <img src={moneda} alt="Oro" className="topbar-stat-icon" />
        <span className="topbar-stat-val topbar-stat-val--gold">
          {userGold.toLocaleString()}
        </span>
      </div>

      {/* 5. Gemas */}
      <div
        className="topbar-pill topbar-pill--gems topbar-pill--static"
        data-action="gemas"
        aria-label="gemas"
        title="Gemas"
      >
        <img src={gema} alt="Gemas" className="topbar-stat-icon" />
        <span className="topbar-stat-val topbar-stat-val--gems">
          {userTokens.toLocaleString()}
        </span>
      </div>

      {/* 6. Notificaciones */}
      <button
        type="button"
        className={`topbar-pill topbar-pill--notifications ${unreadNotificationsCount > 0 ? 'topbar-pill--notifications-active' : ''}`}
        data-action="notificaciones"
        aria-label="notificaciones"
        title={unreadNotificationsCount > 0 ? `Tienes ${unreadNotificationsCount} notificación(es) sin leer` : 'Centro de Notificaciones'}
        onClick={() => {
          soundManager.playSound('click', 0.5)
          setIsNotificationsModalOpen(true)
        }}
      >
        <span className="topbar-notif-bell-icon">🔔</span>
        {unreadNotificationsCount > 0 && (
          <span className="topbar-notif-badge">
            {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* 7. Ajustes */}
      <button
        type="button"
        className="topbar-pill topbar-pill--settings"
        data-action="ajustes"
        aria-label="ajustes"
        title="Ajustes y Opciones"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          setIsSettingsOpen((prev) => !prev)
        }}
      >
        <img src={ajustesIcon} alt="Ajustes" className="topbar-settings-img" />
      </button>

      {/* ── CENTRO / BANNER ROTATIVO CADA 10S (TEMPORADA, TELEGRAM, EN LÍNEA) ── */}
      <div
        className="bosque-season-banner"
        data-action="banner-superior"
        role="button"
        tabIndex={0}
        aria-label={
          showTournamentBanner
            ? 'Prueba de torneo dentro 4 horas :) atentos para el registro'
            : isReturningUser
            ? 'Por regresar cuentas con un 30% en tu primera compra'
            : bannerSlide === 0
            ? `Temporada ${seasonStatus.seasonNumber}: quedan ${seasonStatus.daysLeft} días, ${seasonStatus.hoursLeft} horas`
            : bannerSlide === 1
            ? 'Canal Oficial de Telegram: Únete para noticias y torneos'
            : bannerSlide === 3
            ? 'Token PLANTS: Preventa Fundadores activa'
            : bannerSlide === 4
            ? 'Streaming VIP & BOT: Cuentas Premium y Códigos al instante'
            : `${onlineUsersCount} Jugadores en línea jugando en la Arena`
        }
        title={
          showTournamentBanner
            ? 'Prueba de torneo dentro 4 horas :) atentos para el registro (Clic para ver torneos)'
            : isReturningUser
            ? 'Por regresar cuentas con un 30% en tu primera compra (Clic para comprar Gemas y desbloquear tu Pack Starter)'
            : bannerSlide === 0
            ? `Temporada ${seasonStatus.seasonNumber} - Clic para ver ranking y recompensas`
            : bannerSlide === 1
            ? 'Comunidad Oficial de Telegram - Clic para unirte'
            : bannerSlide === 3
            ? 'Token PLANTS · Preventa Génesis y Respaldo USDT (Clic para entrar)'
            : bannerSlide === 4
            ? 'Streaming VIP & BOT · Cuentas Premium y Verificador de Códigos al instante (Clic para entrar)'
            : 'Jugadores en línea - Clic para entrar a la Arena'
        }
        onClick={() => {
          soundManager.playSound('click', 0.5)
          if (showTournamentBanner) {
            setIsTournamentModalOpen(true)
          } else if (isReturningUser) {
            setProfileInitialTab('deposit')
            setIsProfileModalOpen(true)
          } else if (bannerSlide === 0) {
            onOpenRanking?.()
          } else if (bannerSlide === 1) {
            window.open('https://t.me/+HY1gbZZKmAE5ZDcx', '_blank')
          } else if (bannerSlide === 3) {
            onOpenPlantsToken?.()
          } else if (bannerSlide === 4) {
            onOpenStreaming?.()
          } else {
            handlePlayClick()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            soundManager.playSound('click', 0.5)
            if (showTournamentBanner) {
              setIsTournamentModalOpen(true)
            } else if (isReturningUser) {
              setProfileInitialTab('deposit')
              setIsProfileModalOpen(true)
            } else if (bannerSlide === 0) onOpenRanking?.()
            else if (bannerSlide === 1) window.open('https://t.me/+HY1gbZZKmAE5ZDcx', '_blank')
            else if (bannerSlide === 3) onOpenPlantsToken?.()
            else if (bannerSlide === 4) onOpenStreaming?.()
            else handlePlayClick()
          }
        }}
      >
        {/* BANNER DESTACADO DE PRUEBA DE TORNEO (CON CIERRE 'X') */}
        {showTournamentBanner ? (
          <div className="bosque-banner-slide bosque-banner-slide--clean bosque-banner-slide--tournament">
            <div className="bosque-clean-banner__icon-wrap bosque-clean-banner__icon-wrap--tournament">
              <span className="bosque-clean-banner__icon">🏆</span>
            </div>
            <div className="bosque-clean-banner__content">
              <div className="bosque-clean-banner__header-row">
                <span className="bosque-clean-banner__badge bosque-clean-banner__badge--tournament">
                  <span className="bosque-clean-banner__radar-dot bosque-clean-banner__radar-dot--gold" /> PRUEBA DE TORNEO
                </span>
                <span className="bosque-clean-banner__live-tag bosque-clean-banner__live-tag--tournament">
                  ⏰ DENTRO DE 4 HORAS
                </span>
              </div>
              <span className="bosque-clean-banner__title bosque-clean-banner__title--tournament">
                Prueba de torneo dentro 4 horas :) atentos para el registro
              </span>
              <span className="bosque-clean-banner__subtitle">
                ¡Prepara tu mazo y tus mejores plantas! Clic aquí para entrar al lobby de torneos
              </span>
            </div>
            <button
              type="button"
              className="bosque-banner-close-btn"
              aria-label="Cerrar recordatorio de torneo"
              title="Cerrar recordatorio"
              onClick={(e) => {
                e.stopPropagation()
                soundManager.playSound('click', 0.4)
                setShowTournamentBanner(false)
              }}
            >
              ✕
            </button>
          </div>
        ) : isReturningUser ? (
          <div className="bosque-banner-slide bosque-banner-slide--clean bosque-banner-slide--returning">
            <div className="bosque-clean-banner__icon-wrap bosque-clean-banner__icon-wrap--returning">
              <span className="bosque-clean-banner__icon">🎁</span>
            </div>
            <div className="bosque-clean-banner__content">
              <div className="bosque-clean-banner__header-row">
                <span className="bosque-clean-banner__badge bosque-clean-banner__badge--returning">
                  ⭐ OFERTA POR REGRESAR
                </span>
                <span className="bosque-clean-banner__tag--returning">
                  +30% EXTRA GEMAS
                </span>
              </div>
              <span className="bosque-clean-banner__title bosque-clean-banner__title--returning">
                Por regresar cuentas con un 30% en tu primera compra
              </span>
              <span className="bosque-clean-banner__subtitle">
                ¡Compra gemas con bono del 30%, desbloquea tu Pack Starter y vuelve al combate! Clic aquí
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* SLIDE 0: TEMPORADA 2 */}
            {bannerSlide === 0 && (
              <div className="bosque-banner-slide bosque-banner-slide--season">
                <div className="bosque-season-banner__left">
                  <div className="bosque-season-banner__icon-wrap">
                    <span className="bosque-season-banner__icon">🏆</span>
                  </div>
                  <div className="bosque-season-banner__titles">
                    <span className="bosque-season-banner__badge">TEMPORADA {seasonStatus.seasonNumber}</span>
                    <span className="bosque-season-banner__main-title">{seasonStatus.seasonNumber >= 2 ? `TEMPORADA ${seasonStatus.seasonNumber}` : 'FIN DE TEMPORADA'}</span>
                  </div>
                </div>

                <div className="bosque-season-banner__countdown-wrap">
                  <div className="bosque-season-banner__countdown-label">
                    <span className="bosque-season-banner__pulse-dot" />
                    <span>TIEMPO RESTANTE</span>
                  </div>
                  <div className="bosque-season-banner__timer-boxes">
                    <div className="bosque-season-timer-unit">
                      <span className="bosque-season-timer-val">{String(seasonStatus.daysLeft).padStart(2, '0')}</span>
                      <span className="bosque-season-timer-lbl">DÍAS</span>
                    </div>
                    <span className="bosque-season-timer-sep">:</span>
                    <div className="bosque-season-timer-unit">
                      <span className="bosque-season-timer-val">{String(seasonStatus.hoursLeft).padStart(2, '0')}</span>
                      <span className="bosque-season-timer-lbl">HRS</span>
                    </div>
                    <span className="bosque-season-timer-sep">:</span>
                    <div className="bosque-season-timer-unit">
                      <span className="bosque-season-timer-val">{String(seasonStatus.minutesLeft).padStart(2, '0')}</span>
                      <span className="bosque-season-timer-lbl">MIN</span>
                    </div>
                    <span className="bosque-season-timer-sep">:</span>
                    <div className="bosque-season-timer-unit">
                      <span className="bosque-season-timer-val">{String(seasonStatus.secondsLeft).padStart(2, '0')}</span>
                      <span className="bosque-season-timer-lbl">SEG</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SLIDE 1: COMUNIDAD TELEGRAM (LIMPIO, SIN BOTÓN, CLIC ABRE ENLACE) */}
            {bannerSlide === 1 && (
              <div className="bosque-banner-slide bosque-banner-slide--clean">
                <div className="bosque-clean-banner__icon-wrap bosque-clean-banner__icon-wrap--telegram">
                  <span className="bosque-clean-banner__icon">✈️</span>
                </div>
                <div className="bosque-clean-banner__content">
                  <div className="bosque-clean-banner__header-row">
                    <span className="bosque-clean-banner__badge bosque-clean-banner__badge--telegram">
                      COMUNIDAD OFICIAL
                    </span>
                    <span className="bosque-clean-banner__url">t.me/+HY1gbZZKmAE5ZDcx ↗</span>
                  </div>
                  <span className="bosque-clean-banner__title bosque-clean-banner__title--telegram">
                    ¡ÚNETE A NUESTRO CANAL DE TELEGRAM!
                  </span>
                  <span className="bosque-clean-banner__subtitle">
                    Sorteos semanales, notas de balance y torneos oficiales para la comunidad
                  </span>
                </div>
              </div>
            )}

            {/* SLIDE 2: JUGADORES EN LÍNEA (LIMPIO, SIN BOTÓN, INFO DESTACADA) */}
            {bannerSlide === 2 && (
              <div className="bosque-banner-slide bosque-banner-slide--clean">
                <div className="bosque-clean-banner__icon-wrap bosque-clean-banner__icon-wrap--online">
                  <span className="bosque-clean-banner__icon">⚔️</span>
                </div>
                <div className="bosque-clean-banner__content">
                  <div className="bosque-clean-banner__header-row">
                    <span className="bosque-clean-banner__badge bosque-clean-banner__badge--online">
                      <span className="bosque-clean-banner__radar-dot" /> EN VIVO EN LA ARENA
                    </span>
                    <span className="bosque-clean-banner__live-tag">MATCHMAKING ACTIVO</span>
                  </div>
                  <span className="bosque-clean-banner__title bosque-clean-banner__title--online">
                    <strong className="bosque-clean-banner__count">{onlineUsersCount}</strong> JUGADORES CONECTADOS AHORA
                  </span>
                  <span className="bosque-clean-banner__subtitle">
                    ¡Rivales listos en tiempo real! Haz clic para entrar a la batalla y subir copas
                  </span>
                </div>
              </div>
            )}

            {/* SLIDE 3: TOKEN PLANTS (SIMPLE Y DIRECTO) */}
            {bannerSlide === 3 && (
              <div className="bosque-banner-slide bosque-banner-slide--clean">
                <div className="bosque-clean-banner__icon-wrap bosque-clean-banner__icon-wrap--plants">
                  <span className="bosque-clean-banner__icon">🌱</span>
                </div>
                <div className="bosque-clean-banner__content">
                  <div className="bosque-clean-banner__header-row">
                    <span className="bosque-clean-banner__badge bosque-clean-banner__badge--plants">
                      🚀 PREVENTA GÉNESIS
                    </span>
                    <span className="bosque-clean-banner__tag--plants">
                      20 PACKS EXCLUSIVOS
                    </span>
                  </div>
                  <span className="bosque-clean-banner__title bosque-clean-banner__title--plants">
                    TOKEN PLANTS · PACKS FUNDADORES
                  </span>
                  <span className="bosque-clean-banner__subtitle">
                    ¡Desbloqueo diario, respaldo en USDT y +20% bono en Gemas! Clic para entrar
                  </span>
                </div>
              </div>
            )}

            {/* SLIDE 4: STREAMING VIP & BOT DE CÓDIGOS */}
            {bannerSlide === 4 && (
              <div className="bosque-banner-slide bosque-banner-slide--clean">
                <div
                  className="bosque-clean-banner__icon-wrap"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.4), rgba(15, 23, 42, 0.9))',
                    border: '1px solid rgba(74, 222, 128, 0.7)',
                  }}
                >
                  <span className="bosque-clean-banner__icon">🎬</span>
                </div>
                <div className="bosque-clean-banner__content">
                  <div className="bosque-clean-banner__header-row">
                    <span
                      className="bosque-clean-banner__badge"
                      style={{
                        background: 'rgba(34, 197, 94, 0.25)',
                        color: '#4ade80',
                        border: '1px solid rgba(34, 197, 94, 0.5)',
                      }}
                    >
                      🍿 TIENDA VIP &amp; BOT
                    </span>
                    <span
                      className="bosque-clean-banner__live-tag"
                      style={{
                        background: 'rgba(99, 102, 241, 0.25)',
                        color: '#a5b4fc',
                        border: '1px solid rgba(99, 102, 241, 0.5)',
                      }}
                    >
                      ENTREGA 24/7
                    </span>
                  </div>
                  <span className="bosque-clean-banner__title" style={{ color: '#ffffff' }}>
                    STREAMING VIP · NETFLIX, DISNEY, MAX &amp; MÁS
                  </span>
                  <span className="bosque-clean-banner__subtitle">
                    Cuentas premium garantizadas y BOT de verificación de códigos al instante. ¡Clic para entrar!
                  </span>
                </div>
              </div>
            )}

            {/* INDICADORES DE CARRUSEL (PUNTOS NAVEGABLES) */}
            <div className="bosque-banner-dots">
              {[0, 1, 2, 3, 4].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`bosque-banner-dot ${bannerSlide === idx ? 'bosque-banner-dot--active' : ''}`}
                  aria-label={`Ir al banner ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    soundManager.playSound('click', 0.4)
                    setBannerSlide(idx)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="hit"
        data-action="jugar"
        aria-label="jugar"
        title="¡JUGAR PARTIDA!"
        onClick={handlePlayClick}
      >
        jugar
      </button>

      {/* ── SLOTS DE COFRES Y SOBRES REACTIVOS (CLASH ROYALE STYLE) ── */}
      {[0, 1, 2, 3].map((slotIdx) => {
        const slot = freePackSlots[slotIdx]
        const actionName = `slot-${slotIdx + 1}`
        const slotClassName = `bosque-slot bosque-slot--${slotIdx + 1}`

        if (!slot || slot.status === 'empty') {
          return (
            <div
              key={slotIdx}
              className={`${slotClassName} bosque-slot--empty`}
              data-action={actionName}
              title="Slot Vacío (Gana partidas multijugador para obtener sobres)"
              onClick={() => handleSlotClick(slot)}
            >
              <span className="bosque-slot__empty-icon">📦</span>
              <span className="bosque-slot__empty-label">VACÍO</span>
            </div>
          )
        }

        const isTimerFinished = Boolean(
          slot.status === 'unlocking' &&
            slot.unlockStartedAt &&
            Date.now() - slot.unlockStartedAt >= slot.durationHours * 3600 * 1000
        )
        const isSlotReady = slot.status === 'ready' || isTimerFinished
        const remainingText = isSlotReady ? '¡LISTO!' : getRemainingTimeString(slot)

        return (
          <div
            key={slotIdx}
            data-action={actionName}
            className={`${slotClassName} ${
              isSlotReady
                ? 'bosque-slot--ready'
                : slot.status === 'unlocking'
                ? 'bosque-slot--unlocking'
                : 'bosque-slot--locked'
            }`}
            title={`Sobre Arena ${slot.arenaLevel} - ${isSlotReady ? 'Listo para abrir' : slot.status}`}
            onClick={() => handleSlotClick(slot)}
          >
            <span className={`bosque-slot__tag ${isSlotReady ? 'bosque-slot__tag--ready' : ''}`}>
              ARENA {slot.arenaLevel}
            </span>
            <img
              src="/game-assets/greenfoot/seed_pack_pvp.webp"
              alt="Sobre PvP"
              className={`bosque-slot__img ${
                isSlotReady
                  ? 'bosque-slot__img--glow'
                  : slot.status === 'unlocking'
                  ? 'bosque-slot__img--pulse'
                  : ''
              }`}
            />
            {slot.status === 'locked' && (
              <>
                <span className="bosque-slot__timer">⏳ {slot.durationHours}h</span>
                <span className="bosque-slot__btn bosque-slot__btn--unlock">DESBLOQUEAR</span>
              </>
            )}
            {slot.status === 'unlocking' && !isSlotReady && (
              <>
                <span className="bosque-slot__timer bosque-slot__timer--active">⏱️ {remainingText}</span>
                <span className="bosque-slot__btn bosque-slot__btn--accelerate">⚡ ACELERAR</span>
              </>
            )}
            {isSlotReady && (
              <>
                <span className="bosque-slot__timer bosque-slot__timer--active">¡LISTO!</span>
                <span className="bosque-slot__btn bosque-slot__btn--ready">✨ ABRIR</span>
              </>
            )}
          </div>
        )
      })}

      {/* ── PANEL LATERAL DERECHO ── */}

      {/* 1. Barra Dedicada de Ranking (Debajo de Oro, Gemas y Ajustes) */}
      <button
        type="button"
        className="bosque-ranking-banner"
        data-action="trofeos"
        title="Ver Camino de Arenas y Clasificación Global"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenRanking?.()
        }}
      >
        <div className="bosque-ranking-banner__left">
          <img src={ranking} alt="Trofeo" className="bosque-ranking-banner__trophy" />
          <div className="bosque-ranking-banner__info">
            <span className="bosque-ranking-banner__title">RANKING GLOBAL</span>
            <span className="bosque-ranking-banner__subtitle">Camino de Arenas</span>
          </div>
        </div>
        <div className="bosque-ranking-banner__right">
          <span className="bosque-ranking-banner__elo-val">{userElo}</span>
          <span className="bosque-ranking-banner__trophy-icon">🏆</span>
        </div>
      </button>

      {/* 2. Tarjeta de Torneo con Ilustración Limpia y Cuenta Regresiva */}
      <div
        className="bosque-tourney-card"
        data-action="torneo"
        title="Lobby de Torneos"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          setIsTournamentModalOpen(true)
        }}
      >
        <div className="bosque-tourney-card__header">
          <span className="bosque-tourney-card__header-icon">🏆</span>
          <span className="bosque-tourney-card__header-title">TORNEO PRÓXIMO</span>
        </div>
        <div className="bosque-tourney-card__art-wrap">
          <img
            src="/game-assets/dashboard/torneo-arena.webp"
            alt="Torneo Arena"
            className="bosque-tourney-card__art"
          />
          <div className="bosque-tourney-card__badge-row">
            <span
              className={`bosque-tourney-card__status-btn ${
                upcomingTourneyInfo?.isLive
                  ? 'bosque-tourney-card__status-btn--live'
                  : 'bosque-tourney-card__status-btn--upcoming'
              }`}
            >
              {upcomingTourneyInfo?.isLive ? '🔥 EN VIVO' : '🏆 PRÓXIMO'}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="hit"
        data-action="noticias"
        aria-label="noticias"
        title="Noticias y Actualizaciones"
        onClick={() =>
          handleOpenNews(
            '¡Preventa Oficial del Token PLANTS!',
            '¡El Token PLANTS ya está disponible! Adquiere Packs Fundadores con hasta +1,000 Gemas de bono, sobres de cartas, oro y vesting diario respaldado en liquidez USDT.',
            '🌱 VER PREVENTA',
            () => {
              onOpenPlantsToken?.()
            }
          )
        }
      >
        noticias
      </button>

      {/* Tarjeta Interactiva Viva: Lanzamiento Token PLANTS */}
      <div
        className="bosque-news-item--plants"
        data-action="noticia-arena"
        role="button"
        tabIndex={0}
        aria-label="Token PLANTS: Preventa activa con Packs Fundadores y respaldo USDT"
        title="Preventa Token PLANTS (Clic para ver detalles y adquirir packs)"
        onClick={handleOpenPlantsTokenNews}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleOpenPlantsTokenNews()
          }
        }}
      >
        <div className="bosque-news-plants__art-wrap">
          <img
            src="/game-assets/token/logo.webp"
            alt="Token PLANTS"
            className="bosque-news-plants__img"
          />
        </div>
        <div className="bosque-news-plants__content">
          <div className="bosque-news-plants__top-row">
            <span className="bosque-news-plants__badge">🌱 PREVENTA ACTIVA</span>
            <span className="bosque-news-plants__type-tag">TOKEN PLANTS</span>
          </div>
          <span className="bosque-news-plants__title">Packs Fundadores PLANTS</span>
          <span className="bosque-news-plants__desc">
            Vesting Diario · Bono Gemas 💎 y Respaldo USDT 💧
          </span>
        </div>
        <span className="bosque-news-plants__arrow">➔</span>
      </div>
      {/* Tarjeta Interactiva Viva: Código Secreto Ronda 6 */}
      <div
        className="bosque-news-item--code"
        data-action="noticia-jardin"
        role="button"
        tabIndex={0}
        aria-label="Código Secreto Ronda 6: Bote de 50 Gemas y 3 intentos gratuitos"
        title="Código Secreto Ronda #6 (Clic para ver detalles y jugar)"
        onClick={handleOpenSecretCodeNews}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleOpenSecretCodeNews()
          }
        }}
      >
        <div className="bosque-news-code__art-wrap">
          <span className="bosque-news-code__lock-icon">🔐</span>
        </div>
        <div className="bosque-news-code__content">
          <div className="bosque-news-code__top-row">
            <span className="bosque-news-code__badge">✨ RONDA #6 EN VIVO</span>
            <span className="bosque-news-code__type-tag">MINIJUEGO</span>
          </div>
          <span className="bosque-news-code__title">Código Secreto: Ronda 6</span>
          <span className="bosque-news-code__desc">
            Bote 50 💎 · 3 Intentos Gratis · ¡Adivina!
          </span>
        </div>
        <span className="bosque-news-code__arrow">➔</span>
      </div>
      <div
        className="bosque-plants-token-banner"
        data-action="banner-lateral"
        role="button"
        tabIndex={0}
        aria-label="Token Plants"
        title="Token Plants (Clic para abrir el mercado y preventa)"
        onClick={() => {
          soundManager.playSound('click', 0.5)
          onOpenPlantsToken?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            soundManager.playSound('click', 0.5)
            onOpenPlantsToken?.()
          }
        }}
      >
        <div className="bosque-plants-token-banner__glow" />
        <div className="bosque-plants-token-banner__content">
          <span className="bosque-plants-token-banner__title">Token Plants</span>
        </div>
        <span className="bosque-plants-token-banner__arrow">➔</span>
      </div>

      {/* ── 3. MENÚ DESPLEGABLE DE AJUSTES (GEAR ICON) ── */}
      {isSettingsOpen && (
        <div className="bosque-settings-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="bosque-settings-menu" onClick={(e) => e.stopPropagation()}>
            <h4 className="bosque-settings-menu__title">AJUSTES</h4>
            <button
              type="button"
              className="bosque-settings-menu__btn"
              onClick={() => {
                soundManager.toggleMute()
                setIsMuted(soundManager.isMuted())
              }}
            >
              {isMuted ? '🔇 Activar Música' : '🔊 Silenciar Música'}
            </button>
            <button type="button" className="bosque-settings-menu__btn" onClick={toggleFullscreen}>
              ⛶ Pantalla Completa
            </button>
            <button
              type="button"
              className="bosque-settings-menu__btn"
              onClick={() => {
                setIsSettingsOpen(false)
                setIsKeybindingsOpen(true)
              }}
            >
              🎮 Controles de Teclado
            </button>
            {onOpenBetaInfo && (
              <button
                type="button"
                className="bosque-settings-menu__btn"
                onClick={() => {
                  setIsSettingsOpen(false)
                  onOpenBetaInfo()
                }}
              >
                🧪 Info Temporada {seasonStatus.seasonNumber}
              </button>
            )}
            {onOpenStreaming && (
              <button
                type="button"
                className="bosque-settings-menu__btn"
                style={{ color: '#4ade80' }}
                onClick={() => {
                  soundManager.playSound('click', 0.5)
                  setIsSettingsOpen(false)
                  onOpenStreaming()
                }}
              >
                🎬 Streaming VIP &amp; Códigos
              </button>
            )}
            {isAdmin && onOpenAdmin && (
              <button
                type="button"
                className="bosque-settings-menu__btn"
                onClick={() => {
                  setIsSettingsOpen(false)
                  onOpenAdmin()
                }}
              >
                🛡️ Panel de Admin
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                className="bosque-settings-menu__btn bosque-settings-menu__btn--danger"
                onClick={() => {
                  setIsSettingsOpen(false)
                  onSignOut()
                }}
              >
                🚪 Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 4. MODAL DE NOTICIAS / ANUNCIOS ── */}
      {newsModal && (
        <div className="bosque-news-modal-backdrop" onClick={() => setNewsModal(null)}>
          <div className="bosque-news-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="bosque-news-modal-header">
              <h3 className="bosque-news-modal-title">📰 {newsModal.title}</h3>
              <button
                type="button"
                className="bosque-news-modal-close"
                onClick={() => setNewsModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="bosque-news-modal-body">{newsModal.message}</div>
            <div className="bosque-news-modal-actions">
              <button
                type="button"
                className="bosque-news-modal-btn bosque-news-modal-btn--secondary"
                onClick={() => setNewsModal(null)}
              >
                CERRAR
              </button>
              {newsModal.actionLabel && newsModal.onAction && (
                <button
                  type="button"
                  className="bosque-news-modal-btn bosque-news-modal-btn--action"
                  onClick={() => {
                    const act = newsModal.onAction
                    setNewsModal(null)
                    act?.()
                  }}
                >
                  {newsModal.actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. CONFIRMACIÓN ACELERAR SOBRE CON ORO ── */}
      {slotToAccelerate &&
        (() => {
          const goldCost = calculateInstantUnlockGoldCost(slotToAccelerate)
          const hasEnoughGold = (userGold ?? 0) >= goldCost
          const missingGold = goldCost - (userGold ?? 0)
          const remainingTime = getRemainingTimeString(slotToAccelerate)

          return (
            <div
              className="main-menu-dialog-backdrop"
              onClick={() => {
                if (!isAccelerating) setSlotToAccelerate(null)
              }}
            >
              <div className="main-menu-dialog-card" onClick={(e) => e.stopPropagation()}>
                <div className="main-menu-dialog-header">
                  <div className="main-menu-dialog-icon">⚡</div>
                  <h3 className="main-menu-dialog-title">DESBLOQUEAR AL INSTANTE</h3>
                  <button
                    type="button"
                    className="main-menu-dialog-close"
                    onClick={() => {
                      if (!isAccelerating) setSlotToAccelerate(null)
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div className="game-dialog-pack-preview">
                  <img
                    src="/game-assets/greenfoot/seed_pack_pvp.webp"
                    alt="Sobre PvP"
                    className="game-dialog-pack-img"
                  />
                  <div className="game-dialog-pack-meta">
                    <span className="game-dialog-pack-tag">ARENA {slotToAccelerate.arenaLevel}</span>
                    <span className="game-dialog-pack-name">Sobre de Victoria PvP</span>
                    <span className="game-dialog-pack-timer">⏱️ Restante: {remainingTime}</span>
                  </div>
                </div>

                <div className="game-dialog-gold-box">
                  <div className="game-dialog-gold-row">
                    <span className="game-dialog-gold-label">Costo de aceleración:</span>
                    <strong className="game-dialog-gold-val game-dialog-gold-val--cost">
                      {goldCost} 💰 Oro
                    </strong>
                  </div>
                  <div className="game-dialog-gold-row">
                    <span className="game-dialog-gold-label">Tu saldo actual:</span>
                    <strong className="game-dialog-gold-val">{userGold ?? 0} 💰</strong>
                  </div>
                  {!hasEnoughGold && (
                    <div className="game-dialog-gold-warning">
                      ⚠️ Te faltan {missingGold} de Oro para acelerar este sobre.
                    </div>
                  )}
                </div>

                <div className="main-menu-dialog-actions">
                  <button
                    type="button"
                    className="main-menu-dialog-btn main-menu-dialog-btn--cancel"
                    disabled={isAccelerating}
                    onClick={() => setSlotToAccelerate(null)}
                  >
                    CANCELAR
                  </button>
                  <button
                    type="button"
                    className={`main-menu-dialog-btn main-menu-dialog-btn--confirm ${
                      !hasEnoughGold ? 'main-menu-dialog-btn--disabled' : ''
                    }`}
                    disabled={isAccelerating || !hasEnoughGold}
                    onClick={handleConfirmAccelerate}
                  >
                    {isAccelerating
                      ? 'PROCESANDO...'
                      : hasEnoughGold
                      ? `PAGAR ${goldCost} 💰`
                      : 'ORO INSUFICIENTE'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

      {/* ── 6. ALERTAS PERSONALIZADAS ── */}
      {activeAlert && (
        <div className="main-menu-dialog-backdrop" onClick={() => setActiveAlert(null)}>
          <div className="main-menu-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="main-menu-dialog-header">
              <div className="main-menu-dialog-icon">{activeAlert.icon}</div>
              <h3 className="main-menu-dialog-title">{activeAlert.title}</h3>
              <button
                type="button"
                className="main-menu-dialog-close"
                onClick={() => setActiveAlert(null)}
              >
                ✕
              </button>
            </div>
            <p className="main-menu-dialog-msg">{activeAlert.message}</p>
            <div className="main-menu-dialog-actions">
              <button
                type="button"
                className="main-menu-dialog-btn"
                onClick={() => setActiveAlert(null)}
              >
                ENTENDIDO
              </button>
              {activeAlert.actionLabel && activeAlert.onAction && (
                <button
                  type="button"
                  className="main-menu-dialog-btn main-menu-dialog-btn--confirm"
                  onClick={() => {
                    const fn = activeAlert.onAction
                    setActiveAlert(null)
                    fn?.()
                  }}
                >
                  {activeAlert.actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. MODALES DEL JUEGO (100% PRESERVADOS) ── */}

      {/* Perfil del Jugador */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        userElo={userElo}
        userTokens={userTokens}
        hasVipPass={hasVipPass}
        unlockedPlants={unlockedPlants}
        initialTab={profileInitialTab}
        onClose={() => setIsProfileModalOpen(false)}
        onOpenSwap={() => {
          setIsProfileModalOpen(false)
          onOpenPlantsToken?.('swap')
        }}
      />

      {/* Selector de Modo */}
      <ModeSelectorModal
        isOpen={isModeSelectorOpen}
        onClose={() => setIsModeSelectorOpen(false)}
        userElo={userElo}
        userTokens={userTokens}
        playerEnergy={playerEnergy}
        maxPlayerEnergy={maxPlayerEnergy}
        onSelectRanked={onPlay}
        onSelectArenaAds={() => setIsArenaAdsModalOpen(true)}
        onSelectTournament={() => setIsTournamentModalOpen(true)}
        onSelectFriendly={onPlayFriendly}
        onSelectStrategicPlaytest={onOpenStrategicPlaytest}
        onOpenShop={onOpenShop}
      />

      {/* Arena Ads */}
      <ArenaAdsModal
        isOpen={isArenaAdsModalOpen}
        onClose={() => setIsArenaAdsModalOpen(false)}
        userGold={userGold}
        userGems={userTokens}
        claimedLevels={claimedArenaAdsLevels}
        onDeductGold={(amount) => {
          if (onDeductGold) return onDeductGold(amount)
          return false
        }}
        onDeductGems={(amount) => {
          if (onDeductTokens) return onDeductTokens(amount)
          return false
        }}
        onStartArenaAdsBattle={(run) => {
          if (onStartArenaAdsBattle) onStartArenaAdsBattle(run)
        }}
        onClaimLoot={(loot, multiplier, newlyClaimed) => {
          if (onClaimArenaAdsLoot) return onClaimArenaAdsLoot(loot, multiplier, newlyClaimed)
        }}
        onRefreshBalances={onRewardsChanged}
      />

      

      {/* Torneos */}
      <TournamentModal
        isOpen={isTournamentModalOpen}
        onClose={() => setIsTournamentModalOpen(false)}
        userTokens={userTokens}
        userGold={userGold}
        isAdmin={isAdmin}
        unlockedPlants={unlockedPlants}
        plantInstances={plantInstances}
        onDeductTokens={(amount) => {
          if (onDeductTokens) return onDeductTokens(amount)
          return false
        }}
        onDeductGold={(amount) => {
          if (onDeductGold) return onDeductGold(amount)
          return false
        }}
        onStartTournamentMatch={(oppName, tourneyId, tourneyDeck) => {
          if (onStartTournamentMatch) onStartTournamentMatch(oppName, tourneyId, tourneyDeck)
        }}
      />

      {/* Chat Global Flotante */}
      {!isGlobalChatOpen && (
        <div className="global-chat-floating-btn-wrapper">
          <button
            type="button"
            className="global-chat-toggle-btn"
            onClick={handleToggleGlobalChat}
            title="Abrir Chat Global"
          >
            <span className="global-chat-icon">💬</span>
            {globalChatUnreadCount > 0 && (
              <span className="global-chat-badge">
                {globalChatUnreadCount > 99 ? '99+' : globalChatUnreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      <GlobalChat
        isOpen={isGlobalChatOpen}
        onClose={handleCloseGlobalChat}
        currentUser={{
          name: playerProfile.name || userProfile?.username || 'Guerrero',
          hasVipPass: Boolean(hasVipPass),
          avatarId: playerProfile.avatar || userProfile?.avatar_id || 'peashooter',
          id: userProfile?.id,
        }}
        onlineUsersCount={onlineUsersCount}
        onNewUnreadMessage={() => {
          setGlobalChatUnreadCount((prev) => prev + 1)
        }}
      />

      {/* Subastas */}
      <AuctionModal
        isOpen={isAuctionModalOpen}
        onClose={handleCloseAuctionModal}
        userTokens={userTokens}
        onTokensDeducted={(newTokens) => {
          if (onDeductTokens) onDeductTokens(userTokens - newTokens)
        }}
        userId={userProfile?.id}
        username={userProfile?.username || playerProfile.name}
      />

      {/* Misiones */}
      <MisionesModal
        isOpen={isMisionesModalOpen}
        onClose={handleCloseMisionesModal}
        userGems={userTokens}
        userGold={userGold}
        onRewardClaimed={onRewardsChanged}
      />

      {/* Lotería */}
      {showLotteryModal && (
        <LotteryModal
          isOpen={showLotteryModal}
          onClose={handleCloseLotteryModal}
          userTokens={userTokens}
          userGold={userGold}
          isAdmin={isAdmin}
          onOpenAdmin={onOpenAdmin}
          onRewardsChanged={onRewardsChanged}
          userId={userProfile?.id}
          username={userProfile?.username}
          userElo={userElo}
          initialTab={lotteryInitialTab}
        />
      )}

      {/* Controles y Atajos de Teclado */}
      <KeybindingsModal
        isOpen={isKeybindingsOpen}
        onClose={() => setIsKeybindingsOpen(false)}
      />

      {/* Centro de Notificaciones del Jugador */}
      <NotificationModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotificationsCount}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onRefresh={refreshNotifications}
        loading={notificationsLoading}
      />
    </div>
  )
}
