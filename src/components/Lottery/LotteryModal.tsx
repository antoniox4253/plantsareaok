import { useState, useEffect, useMemo } from 'react'
import type { PlantId } from '../../types/game'
import type { CodeRoundPrizeTier } from '../../types/database.types'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import { soundManager } from '../../utils/audioManager'
import { lotteryService } from '../../services/lotteryService'
import { AuctionTabPane } from './AuctionTabPane'
import './LotteryModal.css'

interface LotteryModalProps {
  isOpen?: boolean
  onClose?: () => void
  onBack?: () => void
  userTokens: number
  userGold?: number
  isAdmin?: boolean
  onOpenAdmin?: () => void
  // Las recompensas ya no se conceden desde el cliente: las entrega el
  // servidor y onRewardsChanged sólo las trae a pantalla.
  /** Recarga saldo e inventario desde el servidor tras un premio. El premio ya
   *  está entregado en la base: esto sólo lo trae a la pantalla. */
  onRewardsChanged?: () => Promise<void> | void
  userId?: string
  username?: string
  userElo?: number
  initialTab?: 'wheel' | 'auction' | 'code'
}

interface WheelSector {
  id: string
  label: string
  shortLabel?: string
  icon: string
  color: string
  textColor: string
  type: 'token' | 'gold' | 'pack' | 'plant' | 'item' | 'none'
  valueUsd?: number
  goldAmount?: number
  packId?: string
  packQty?: number
  plantId?: string
  plantQty?: number
  itemId?: string
  itemQty?: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'jackpot'
}

export const SPIN_COST_GOLD = 500
export const SPIN_COST_GEMS_VIP = 50

const DEFAULT_GOLD_WHEEL_SECTORS: WheelSector[] = [
  {
    id: 'gold_jalapeno',
    label: 'Jalapeño 🌶️',
    shortLabel: 'Jalapeño',
    icon: '🌶️',
    color: '#dc2626',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'jalapeno',
    plantQty: 1,
    rarity: 'jackpot',
  },
  {
    id: 'gold_none_1',
    label: 'Sigue Intentando 🍀',
    shortLabel: 'Suerte 🍀',
    icon: '💨',
    color: '#334155',
    textColor: '#ffffff',
    type: 'none',
    rarity: 'common',
  },
  {
    id: 'gold_peashooter',
    label: 'Lanza-guisantes 🌱',
    shortLabel: 'Guisante',
    icon: '🌱',
    color: '#16a34a',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'peashooter',
    plantQty: 1,
    rarity: 'common',
  },
  {
    id: 'gold_bonkchoy',
    label: 'Bonk Choy 🥊',
    shortLabel: 'Bonk Choy',
    icon: '🥊',
    color: '#ea580c',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'bonkchoy',
    plantQty: 1,
    rarity: 'rare',
  },
  {
    id: 'gold_none_2',
    label: 'Sigue Intentando 🍀',
    shortLabel: 'Suerte 🍀',
    icon: '💨',
    color: '#334155',
    textColor: '#ffffff',
    type: 'none',
    rarity: 'common',
  },
  {
    id: 'gold_sunflower',
    label: 'Girasol 🌻',
    shortLabel: 'Girasol',
    icon: '🌻',
    color: '#ca8a04',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'sunflower',
    plantQty: 1,
    rarity: 'common',
  },
  {
    id: 'gold_gems_5',
    label: '5 Gemas 💎',
    shortLabel: '5 Gemas',
    icon: '💎',
    color: '#0284c7',
    textColor: '#ffffff',
    type: 'token',
    valueUsd: 5.0,
    rarity: 'common',
  },
  {
    id: 'gold_repeater',
    label: 'Repetidora 🌿',
    shortLabel: 'Repetidor',
    icon: '🌿',
    color: '#15803d',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'repeater',
    plantQty: 1,
    rarity: 'rare',
  },
  {
    id: 'gold_none_3',
    label: 'Sigue Intentando 🍀',
    shortLabel: 'Suerte 🍀',
    icon: '💨',
    color: '#334155',
    textColor: '#ffffff',
    type: 'none',
    rarity: 'common',
  },
  {
    id: 'gold_wallnut',
    label: 'Nuez 🥜',
    shortLabel: 'Nuez',
    icon: '🥜',
    color: '#92400e',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'wallnut',
    plantQty: 1,
    rarity: 'common',
  },
  {
    id: 'gold_garlic',
    label: 'Ajo Desviador 🧄',
    shortLabel: 'Ajo',
    icon: '🧄',
    color: '#4f46e5',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'garlic',
    plantQty: 1,
    rarity: 'rare',
  },
  {
    id: 'gold_none_4',
    label: 'Sigue Intentando 🍀',
    shortLabel: 'Suerte 🍀',
    icon: '💨',
    color: '#334155',
    textColor: '#ffffff',
    type: 'none',
    rarity: 'common',
  },
  {
    id: 'gold_chomper',
    label: 'Cactus 🌵',
    shortLabel: 'Cactus',
    icon: '🌵',
    color: '#059669',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'chomper',
    plantQty: 1,
    rarity: 'common',
  },
  {
    id: 'gold_squash',
    label: 'Apisonaflor 💥',
    shortLabel: 'Squash',
    icon: '💥',
    color: '#d97706',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'squash',
    plantQty: 1,
    rarity: 'rare',
  },
  {
    id: 'gold_gems_10',
    label: '10 Gemas 💎',
    shortLabel: '10 Gemas',
    icon: '💎',
    color: '#0891b2',
    textColor: '#ffffff',
    type: 'token',
    valueUsd: 10.0,
    rarity: 'epic',
  },
  {
    id: 'gold_melonpult',
    label: 'Melonpulta 🍉',
    shortLabel: 'Melón',
    icon: '🍉',
    color: '#047857',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'melonpult',
    plantQty: 1,
    rarity: 'rare',
  },
]

const DEFAULT_GEMS_WHEEL_SECTORS: WheelSector[] = [
  {
    id: 'gems_jalapeno',
    label: 'Jalapeño 🌶️',
    shortLabel: 'Jalapeño',
    icon: '🌶️',
    color: '#dc2626',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'jalapeno',
    plantQty: 1,
    rarity: 'jackpot',
  },
  {
    id: 'gems_none_1',
    label: 'Sigue Intentando 🍀',
    shortLabel: 'Suerte 🍀',
    icon: '💨',
    color: '#334155',
    textColor: '#ffffff',
    type: 'none',
    rarity: 'common',
  },
  {
    id: 'gems_peashooter_2x',
    label: '2x Lanza-guisantes 🌱',
    shortLabel: '2x Guisante',
    icon: '🌱',
    color: '#16a34a',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'peashooter',
    plantQty: 2,
    rarity: 'rare',
  },
  {
    id: 'gems_bonkchoy',
    label: 'Bonk Choy 🥊',
    shortLabel: 'Bonk Choy',
    icon: '🥊',
    color: '#ea580c',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'bonkchoy',
    plantQty: 1,
    rarity: 'rare',
  },
  {
    id: 'gems_reing_50',
    label: '50 Gemas 💎',
    shortLabel: '50 💎',
    icon: '💎',
    color: '#0284c7',
    textColor: '#ffffff',
    type: 'token',
    valueUsd: 50.0,
    rarity: 'jackpot',
  },
  {
    id: 'gems_none_2',
    label: 'Sigue Intentando 🍀',
    shortLabel: 'Suerte 🍀',
    icon: '💨',
    color: '#334155',
    textColor: '#ffffff',
    type: 'none',
    rarity: 'common',
  },
  {
    id: 'gems_sunflower_2x',
    label: '2x Girasol 🌻',
    shortLabel: '2x Girasol',
    icon: '🌻',
    color: '#ca8a04',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'sunflower',
    plantQty: 2,
    rarity: 'rare',
  },
  {
    id: 'gems_repeater',
    label: 'Repetidora 🌿',
    shortLabel: 'Repetidor',
    icon: '🌿',
    color: '#15803d',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'repeater',
    plantQty: 1,
    rarity: 'rare',
  },
  {
    id: 'gems_reing_25',
    label: '25 Gemas 💎',
    shortLabel: '25 💎',
    icon: '💎',
    color: '#0891b2',
    textColor: '#ffffff',
    type: 'token',
    valueUsd: 25.0,
    rarity: 'epic',
  },
  {
    id: 'gems_none_3',
    label: 'Sigue Intentando 🍀',
    shortLabel: 'Suerte 🍀',
    icon: '💨',
    color: '#334155',
    textColor: '#ffffff',
    type: 'none',
    rarity: 'common',
  },
  {
    id: 'gems_wallnut_2x',
    label: '2x Nuez 🥜',
    shortLabel: '2x Nuez',
    icon: '🥜',
    color: '#92400e',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'wallnut',
    plantQty: 2,
    rarity: 'rare',
  },
  {
    id: 'gems_garlic',
    label: 'Ajo Desviador 🧄',
    shortLabel: 'Ajo',
    icon: '🧄',
    color: '#4f46e5',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'garlic',
    plantQty: 1,
    rarity: 'rare',
  },
  {
    id: 'gems_chomper_2x',
    label: '2x Cactus 🌵',
    shortLabel: '2x Cactus',
    icon: '🌵',
    color: '#059669',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'chomper',
    plantQty: 2,
    rarity: 'rare',
  },
  {
    id: 'gems_none_4',
    label: 'Sigue Intentando 🍀',
    shortLabel: 'Suerte 🍀',
    icon: '💨',
    color: '#334155',
    textColor: '#ffffff',
    type: 'none',
    rarity: 'common',
  },
  {
    id: 'gems_squash',
    label: 'Apisonaflor 💥',
    shortLabel: 'Squash',
    icon: '💥',
    color: '#d97706',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'squash',
    plantQty: 1,
    rarity: 'rare',
  },
  {
    id: 'gems_melonpult',
    label: 'Melonpulta 🍉',
    shortLabel: 'Melón',
    icon: '🍉',
    color: '#047857',
    textColor: '#ffffff',
    type: 'plant',
    plantId: 'melonpult',
    plantQty: 1,
    rarity: 'rare',
  },
]


const ALL_PLANTS_LIST: PlantId[] = Object.keys(PLANT_CONFIGS) as PlantId[]


/**
 * Claves obsoletas del minijuego. La primera guardaba EL CÓDIGO SECRETO en el
 * navegador del jugador, así que hay que borrarla activamente de los navegadores
 * que ya la tengan: dejarla ahí no sirve para nada y expone el código de la
 * última ronda local.
 */
const LEGACY_CODE_KEYS = [
  'plant_arena_lottery_secret_code',
  'plant_arena_lottery_code_attempts',
  'plant_arena_lottery_code_last_free_reset',
  'plant_arena_lottery_code_free_used',
  'plant_arena_lottery_code_extra_attempts',
]

export const SECRET_CODE_LENGTH = 5

/** Ronda tal como la devuelve secret_code_state(). Sin el secreto, que no sale
 *  de Postgres. */
interface CodeRound {
  id: string
  roundNumber: number
  status: 'open' | 'finished' | 'cancelled'
  freeAttempts: number
  prizePool: number
  prizes: number[]
  prizesConfig?: CodeRoundPrizeTier[]
  winnerId: string | null
  codeVersion?: number
  plantCount?: number
  createdAt: string
  finishedAt: string | null
}

/** Un intento propio, con su secuencia: es del jugador, puede verla. */
interface ServerAttempt {
  id: string
  sequence: string[]
  exactCount: number
  wrongPosCount: number
  slotResults?: ('exact' | 'wrong' | 'miss')[]
  pct: number
  wasFree: boolean
  createdAt: string
}

/** Una fila de la clasificación. Nótese que NO hay secuencia: sólo el %. Es lo
 *  que permite competir sin que se copien las jugadas. */
interface BoardEntry {
  userId: string
  username: string
  avatarId: string
  bestPct: number
  attempts: number
  place: number
  isMe: boolean
}

// Helper para mapear sectores de Supabase sobre la plantilla visual
const mapDbSectors = (
  dbSectors: any[] | null,
  fallbackList: WheelSector[]
): WheelSector[] => {
  if (!dbSectors || dbSectors.length === 0) return fallbackList

  return fallbackList.map((tpl) => {
    const row = dbSectors.find((r: any) => r.sector_id === tpl.id)
    if (!row) return tpl
    return {
      ...tpl,
      label: row.label || tpl.label,
      valueUsd: row.reward_type === 'gems' ? (Number(row.gems_amount) || tpl.valueUsd) : undefined,
      plantId: row.plant_id || tpl.plantId,
      plantQty: row.plant_qty ?? tpl.plantQty,
    }
  })
}

export default function LotteryModal({
  isOpen = true,
  onClose,
  onBack,
  userTokens,
  userGold = 0,
  isAdmin,
  onOpenAdmin,
  onRewardsChanged,
  userId,
  username,
  userElo: _userElo,
  initialTab,
}: LotteryModalProps) {
  const [activeTab, setActiveTab] = useState<'wheel' | 'auction' | 'code'>(initialTab || 'wheel')

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // --- TAB 1: WHEEL DUAL MODE & MULTI-SPIN STATE ---
  const REEL_ITEM_HEIGHT = 72
  const [wheelMode, setWheelMode] = useState<'gold' | 'gems'>('gold')
  const [spinMultiplier, setSpinMultiplier] = useState<number>(1)
  const [goldSectors, setGoldSectors] = useState<WheelSector[]>(DEFAULT_GOLD_WHEEL_SECTORS)
  const [gemsSectors, setGemsSectors] = useState<WheelSector[]>(DEFAULT_GEMS_WHEEL_SECTORS)
  const [isSpinning, setIsSpinning] = useState(false)
  const [reelTranslateY, setReelTranslateY] = useState(0)
  const [isTransitionActive, setIsTransitionActive] = useState(false)
  const [winningSector, setWinningSector] = useState<WheelSector | null>(null)
  const [showPrizeModal, setShowPrizeModal] = useState(false)
  const [showConfirmCodeBuyModal, setShowConfirmCodeBuyModal] = useState(false)
  const [recentWinners, setRecentWinners] = useState<Array<{
    id: string
    username: string
    description: string
    created_at: string
  }>>([])

  // Multi-spin batch state
  const [batchResults, setBatchResults] = useState<Array<{
    spinIndex: number
    sectorId: string
    label: string
    rewardType: string
    plantId?: string
    plantQty?: number
    gemsAmount?: number
    granted?: any
  }>>([])
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0)
  const [showBatchSummaryModal, setShowBatchSummaryModal] = useState(false)
  const [batchCurrency, setBatchCurrency] = useState<'gold' | 'gems'>('gold')
  const [batchTotalSpent, setBatchTotalSpent] = useState<number>(0)

  // Saldo visual reactivo e instantáneo para reflejar descuentos en tiempo real
  const [currentGems, setCurrentGems] = useState(userTokens)
  useEffect(() => {
    setCurrentGems(userTokens)
  }, [userTokens])

  const [currentGold, setCurrentGold] = useState(userGold ?? 0)
  useEffect(() => {
    setCurrentGold(userGold ?? 0)
  }, [userGold])

  const activeSectors = useMemo(() => {
    return wheelMode === 'gold' ? goldSectors : gemsSectors
  }, [wheelMode, goldSectors, gemsSectors])

  // Inicializar o reajustar posición del reel centrando el sector 0 en la vuelta 2
  useEffect(() => {
    if (!isSpinning && activeSectors.length > 0) {
      setIsTransitionActive(false)
      const initialY = - (2 * activeSectors.length + 0) * REEL_ITEM_HEIGHT + REEL_ITEM_HEIGHT
      setReelTranslateY(initialY)
    }
  }, [wheelMode, activeSectors.length])

  const batchSummary = useMemo(() => {
    if (!batchResults || batchResults.length === 0) return null

    let totalGemsWon = 0
    let noneCount = 0
    const plantsMap: Record<string, { plantId: string; name: string; qty: number; icon: string }> = {}

    for (const r of batchResults) {
      if (r.rewardType === 'gems' && r.gemsAmount) {
        totalGemsWon += Number(r.gemsAmount)
      } else if (r.rewardType === 'none') {
        noneCount += 1
      } else if (r.rewardType === 'plant' && r.plantId) {
        const pId = r.plantId
        const cfg = PLANT_CONFIGS[pId as PlantId]
        const name = cfg?.name || r.label.replace(/^[0-9x\s]+/, '').replace(/[\p{Emoji}\u200d]+/gu, '').trim()
        const icon =
          pId === 'jalapeno' ? '🌶️' :
          pId === 'peashooter' ? '🌱' :
          pId === 'sunflower' ? '🌻' :
          pId === 'wallnut' ? '🥜' :
          pId === 'chomper' ? '🌵' :
          pId === 'bonkchoy' ? '🥊' :
          pId === 'repeater' ? '🌿' :
          pId === 'garlic' ? '🧄' :
          pId === 'squash' ? '💥' :
          pId === 'melonpult' ? '🍉' : '🌱'
        const qty = r.plantQty ?? 1
        if (!plantsMap[pId]) {
          plantsMap[pId] = { plantId: pId, name, qty, icon }
        } else {
          plantsMap[pId].qty += qty
        }
      }
    }

    return {
      totalGemsWon,
      noneCount,
      plants: Object.values(plantsMap),
      totalSpins: batchResults.length,
    }
  }, [batchResults])

  // ── TAB 2: CÓDIGO SECRETO — TODO DESDE EL SERVIDOR ────────────────────────
  const [codeRound, setCodeRound] = useState<CodeRound | null>(null)
  const [codeAttemptsLeft, setCodeAttemptsLeft] = useState(0)
  const [codeFreeUsed, setCodeFreeUsed] = useState(0)
  const [codeExtra, setCodeExtra] = useState(0)
  const [codeHistory, setCodeHistory] = useState<ServerAttempt[]>([])
  const [codeBoard, setCodeBoard] = useState<BoardEntry[]>([])
  const [codeHints, setCodeHints] = useState<{ id: string; hintText: string; createdAt: string }[]>([])
  const [buyingHint, setBuyingHint] = useState(false)
  const [roundsList, setRoundsList] = useState<any[]>([])
  const [selectedRankingRoundId, setSelectedRankingRoundId] = useState<string | null>(null)
  const [rankingBoard, setRankingBoard] = useState<BoardEntry[]>([])
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [codeMyPayout, setCodeMyPayout] = useState<{ place: number; gems: number; tiedWith: number } | null>(null)
  const [codeBusy, setCodeBusy] = useState(false)

  const [selectedSequence, setSelectedSequence] = useState<(PlantId | null)[]>(
    () => Array(SECRET_CODE_LENGTH).fill(null)
  )
  const [codeWonPrize, setCodeWonPrize] = useState(false)
  const [codeBannerNotice, setCodeBannerNotice] = useState<string | null>(null)
  const [codeSubTab, setCodeSubTab] = useState<'play' | 'history' | 'ranking'>('play')

  // Intentos restantes: los calcula el servidor, aquí sólo se muestran.
  const freeAttemptsLeft = Math.max(0, (codeRound?.freeAttempts ?? 0) - codeFreeUsed)
  const totalAttemptsAvailable = codeAttemptsLeft
  const roundIsOpen = codeRound?.status === 'open'

  // Carga el estado de la ronda, la clasificación y las pistas.
  const loadCodeData = async () => {
    const [st, board, rounds] = await Promise.all([
      lotteryService.secretCodeState(),
      lotteryService.secretCodeLeaderboard(),
      lotteryService.getSecretCodeRounds(),
    ])
    if (st) {
      const newRound = (st.round as CodeRound) ?? null
      setCodeRound((prevRound) => {
        if (newRound?.id !== prevRound?.id) {
          setSelectedSequence(Array(SECRET_CODE_LENGTH).fill(null))
          setCodeWonPrize(false)
        } else if (newRound?.status === 'open' && prevRound?.status !== 'open') {
          setSelectedSequence(Array(SECRET_CODE_LENGTH).fill(null))
          setCodeWonPrize(false)
        }
        return newRound
      })
      setCodeAttemptsLeft(st.attemptsLeft ?? 0)
      setCodeFreeUsed(st.freeUsed ?? 0)
      setCodeExtra(st.extraAttempts ?? 0)
      setCodeHistory((st.attempts as ServerAttempt[]) ?? [])
      setCodeHints(st.hints ?? [])
      setCodeMyPayout(st.myPayout ?? null)
    }
    const safeBoard = (board as BoardEntry[]) || []
    setCodeBoard(safeBoard)
    setRankingBoard(safeBoard)

    if (rounds && Array.isArray(rounds)) {
      setRoundsList(rounds)
      if (rounds.length > 0 && !selectedRankingRoundId) {
        setSelectedRankingRoundId(rounds[0].id)
      }
    }
  }

  const loadRoundLeaderboard = async (roundId: string) => {
    setLoadingRanking(true)
    try {
      const b = await lotteryService.secretCodeLeaderboard(roundId)
      setRankingBoard((b as BoardEntry[]) || [])
    } catch (_) {
    } finally {
      setLoadingRanking(false)
    }
  }

  const handleBuyHint = async () => {
    if (currentGems < 10) {
      alert('Gemas insuficientes. Se requieren 10 💎 para adquirir una pista.')
      return
    }
    setBuyingHint(true)
    soundManager.playSound('click', 0.4)
    const res = await lotteryService.buySecretCodeHint()
    setBuyingHint(false)
    if (res.success && res.hint) {
      soundManager.playSound('victory', 0.6)
      setCurrentGems((g) => Math.max(0, g - 10))
      setCodeHints((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          hintText: res.hint!,
          createdAt: new Date().toISOString(),
        },
      ])
      onRewardsChanged?.()
    } else {
      alert(`⚠️ ${res.error || 'No se pudo comprar la pista.'}`)
    }
  }

  // Recompensas dinámicas calculadas según la configuración del creador/admin en Supabase
  const configuredTiers: CodeRoundPrizeTier[] = useMemo(() => {
    let raw = codeRound?.prizesConfig || (codeRound as any)?.prizes_config
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch (_) {}
    }
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return raw.map((t: any, i: number) => ({
        place: Number(t.place) || (i + 1),
        amount: Number(t.amount) || 0,
        currency: t.currency === 'gold' ? 'gold' : 'gems',
      }))
    }
    // Si la ronda no tiene prizesConfig guardado, usamos ÚNICAMENTE los premios reales configurados
    const pool = codeRound?.prizes?.[0] ?? codeRound?.prizePool ?? 50
    const list: CodeRoundPrizeTier[] = [{ place: 1, amount: pool, currency: 'gems' }]
    if (codeRound?.prizes?.[1] && codeRound.prizes[1] > 0) {
      list.push({ place: 2, amount: codeRound.prizes[1], currency: 'gold' })
    }
    if (codeRound?.prizes?.[2] && codeRound.prizes[2] > 0) {
      list.push({ place: 3, amount: codeRound.prizes[2], currency: 'gold' })
    }
    return list
  }, [codeRound])

  const top1Tier = configuredTiers.find((t) => t.place === 1) || configuredTiers[0]
  const top1Amount = top1Tier?.amount ?? (codeRound?.prizePool ?? 50)
  const top1Currency = top1Tier?.currency ?? 'gems'
  const top1CurrencyLabel = top1Currency === 'gems' ? 'Gemas 💎' : 'Oro 💰'
  const top1PrizeBadge = `${top1Amount} ${top1Currency === 'gems' ? '💎' : '💰'}`

  // Ronda actualmente seleccionada en la pestaña Ranking
  const selectedRankingRound = useMemo(() => {
    if (!selectedRankingRoundId) return codeRound
    const found = roundsList.find((r) => r.id === selectedRankingRoundId)
    return found || codeRound
  }, [selectedRankingRoundId, roundsList, codeRound])

  // Premios de la ronda seleccionada en Ranking
  const rankingConfiguredTiers: CodeRoundPrizeTier[] = useMemo(() => {
    const targetRound = selectedRankingRound
    let raw = targetRound?.prizesConfig || (targetRound as any)?.prizes_config
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch (_) {}
    }
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return raw.map((t: any, i: number) => ({
        place: Number(t.place) || (i + 1),
        amount: Number(t.amount) || 0,
        currency: t.currency === 'gold' ? 'gold' : 'gems',
      }))
    }
    const pool = targetRound?.prize_1st ?? (targetRound as any)?.prize1st ?? targetRound?.prizes?.[0] ?? targetRound?.prizePool ?? targetRound?.prize_pool_gems ?? 50
    const list: CodeRoundPrizeTier[] = [{ place: 1, amount: pool, currency: 'gems' }]
    if (targetRound?.prize_2nd && targetRound.prize_2nd > 0) {
      list.push({ place: 2, amount: targetRound.prize_2nd, currency: 'gold' })
    }
    if (targetRound?.prize_3rd && targetRound.prize_3rd > 0) {
      list.push({ place: 3, amount: targetRound.prize_3rd, currency: 'gold' })
    }
    return list
  }, [selectedRankingRound])

  // Calcula el premio correspondiente y su reparto equitativo entre jugadores empatados en el mismo puesto
  const boardWithDividedPrizes = useMemo(() => {
    const activeBoard = rankingBoard && rankingBoard.length > 0 ? rankingBoard : codeBoard
    if (!activeBoard || activeBoard.length === 0) return []

    // Contar cuántos jugadores hay empatados en cada puesto
    const placeCounts = new Map<number, number>()
    for (const e of activeBoard) {
      const p = e.place || 1
      placeCounts.set(p, (placeCounts.get(p) || 0) + 1)
    }

    return activeBoard.map((e) => {
      const place = e.place || 1
      const tiedCount = placeCounts.get(place) || 1

      const configuredPrize = rankingConfiguredTiers.find((p) => p.place === place)
      let totalPrize = 0
      let currency: 'gems' | 'gold' = 'gold'

      if (configuredPrize) {
        totalPrize = configuredPrize.amount
        currency = configuredPrize.currency
      } else {
        totalPrize = 0
        currency = 'gold'
      }

      // Su parte individual dividida equitativamente entre los empatados
      const myShare = tiedCount > 0 && totalPrize > 0
        ? Number((totalPrize / tiedCount).toFixed(2))
        : totalPrize

      return {
        ...e,
        tiedCount,
        totalPrize,
        myShare,
        currency,
      }
    })
  }, [rankingBoard, codeBoard, rankingConfiguredTiers])

  // Carga y sincroniza los sectores reales de la ruleta desde Supabase
  const loadWheelSectors = async () => {
    try {
      const [dbGold, dbGems] = await Promise.all([
        lotteryService.getLotterySectors('gold'),
        lotteryService.getLotterySectors('gems'),
      ])
      if (dbGold && dbGold.length > 0) {
        setGoldSectors(mapDbSectors(dbGold, DEFAULT_GOLD_WHEEL_SECTORS))
      }
      if (dbGems && dbGems.length > 0) {
        setGemsSectors(mapDbSectors(dbGems, DEFAULT_GEMS_WHEEL_SECTORS))
      }
    } catch (e) {
      console.warn('[LotteryModal] error al sincronizar sectores de ruleta:', e)
    }
  }

  // Se recarga al abrir el modal y al entrar en la pestaña del código, para que
  // la clasificación refleje los intentos de los demás y la ruleta los premios actuales.
  useEffect(() => {
    if (!isOpen) return
    LEGACY_CODE_KEYS.forEach((k) => localStorage.removeItem(k))
    setCodeWonPrize(false)
    void loadCodeData()
    void loadWheelSectors()
    void (lotteryService as any).getRecentLotteryWinners(10).then((w: any) => {
      if (w && Array.isArray(w)) setRecentWinners(w)
    })
  }, [isOpen, activeTab])

  // Sondeo de sincronización automática en la pestaña del código secreto cada 4s
  useEffect(() => {
    if (!isOpen || activeTab !== 'code') return
    const interval = setInterval(() => {
      void loadCodeData()
    }, 4000)
    return () => clearInterval(interval)
  }, [isOpen, activeTab])

  if (!isOpen) return null

  // ===================== WHEEL ACTIONS =====================
  const executeSingleSpinInBatch = (
    results: Array<{
      spinIndex: number
      sectorId: string
      label: string
      rewardType: string
      plantId?: string
      plantQty?: number
      gemsAmount?: number
      granted?: any
    }>,
    index: number,
    sectorsList: WheelSector[]
  ) => {
    const item = results[index]
    if (!item) {
      setIsSpinning(false)
      return
    }

    setIsSpinning(true)
    const targetIndex = sectorsList.findIndex((s) => s.id === item.sectorId)
    const safeIndex = targetIndex !== -1 ? targetIndex : 0
    const sectorToWin = sectorsList[safeIndex]

    // Cinemática del rodillo vertical: desplazamiento continuo hacia abajo
    const startRound = 9
    const endRound = 2
    const startY = - (startRound * sectorsList.length + safeIndex) * REEL_ITEM_HEIGHT + REEL_ITEM_HEIGHT
    const endY = - (endRound * sectorsList.length + safeIndex) * REEL_ITEM_HEIGHT + REEL_ITEM_HEIGHT

    setIsTransitionActive(false)
    setIsSpinning(true)
    setReelTranslateY(startY)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsTransitionActive(true)
        setReelTranslateY(endY)
        soundManager.playSound('click', 0.6)
      })
    })

    // Animación de 4.3 segundos
    setTimeout(() => {
      setIsSpinning(false)
      const enrichedSector: WheelSector = {
        ...sectorToWin,
        label: item.label || sectorToWin.label,
        plantQty: item.plantQty ?? sectorToWin.plantQty,
        valueUsd: item.gemsAmount ? Number(item.gemsAmount) : sectorToWin.valueUsd,
      }
      setWinningSector(enrichedSector)
      setShowPrizeModal(true)

      // Si el tiro dio gemas, acreditar en saldo visual inmediatamente
      if (item.rewardType === 'gems' && item.gemsAmount) {
        setCurrentGems((prev) => prev + Number(item.gemsAmount))
      }

      if (enrichedSector.type === 'none') {
        soundManager.playSound('defeat', 0.4)
      } else if (enrichedSector.rarity === 'jackpot' || enrichedSector.plantId === 'jalapeno') {
        soundManager.playSound('victory', 1.0)
      } else {
        soundManager.playSound('victory', 0.8)
      }

      void onRewardsChanged?.()
    }, 4300)
  }

  const handleStartSpin = async () => {
    if (isSpinning) return

    const singleCost = wheelMode === 'gold' ? SPIN_COST_GOLD : SPIN_COST_GEMS_VIP
    const totalCost = singleCost * spinMultiplier

    if (wheelMode === 'gold' && currentGold < totalCost) {
      alert(
        `Oro insuficiente. Se requieren ${totalCost.toLocaleString()} 🪙 Oro para ${spinMultiplier} ${spinMultiplier === 1 ? 'tiro' : 'tiros'}. (Tienes: ${currentGold.toLocaleString()} 🪙)`
      )
      return
    }

    if (wheelMode === 'gems' && currentGems < totalCost) {
      alert(
        `Gemas insuficientes. Se requieren ${totalCost} 💎 Gemas para ${spinMultiplier} ${spinMultiplier === 1 ? 'tiro' : 'tiros'}. (Tienes: ${currentGems} 💎)`
      )
      return
    }

    setIsSpinning(true)
    soundManager.playSound('click', 0.6)

    // Descuento visual inmediato
    if (wheelMode === 'gold') {
      setCurrentGold((prev) => Math.max(0, prev - totalCost))
    } else {
      setCurrentGems((prev) => Math.max(0, prev - totalCost))
    }

    const res = await lotteryService.spinLotteryMulti(wheelMode, spinMultiplier)

    if (!res.success || !res.results || res.results.length === 0) {
      setIsSpinning(false)
      // Restaurar saldo visual si falló
      if (wheelMode === 'gold') {
        setCurrentGold(userGold ?? 0)
      } else {
        setCurrentGems(userTokens)
      }
      alert(`⚠️ ${res.error || 'No se pudo girar la ruleta.'}`)
      return
    }

    setBatchResults(res.results)
    setCurrentBatchIndex(0)
    setBatchCurrency(wheelMode)
    setBatchTotalSpent(res.totalSpent ?? totalCost)

    // Iniciar animación en el primer tiro de la tanda
    executeSingleSpinInBatch(res.results, 0, activeSectors)
  }

  const handleNextSpinInBatch = () => {
    setShowPrizeModal(false)
    const nextIdx = currentBatchIndex + 1
    if (nextIdx < batchResults.length) {
      setCurrentBatchIndex(nextIdx)
      executeSingleSpinInBatch(batchResults, nextIdx, activeSectors)
    } else {
      if (batchResults.length > 1) {
        setShowBatchSummaryModal(true)
      }
      void onRewardsChanged?.()
    }
  }

  const handleFinishPrizeModal = () => {
    setShowPrizeModal(false)
    if (batchResults.length > 1) {
      setShowBatchSummaryModal(true)
    }
    void onRewardsChanged?.()
  }

  // ===================== CODE (SECUENCIA) ACTIONS =====================
  const handleSelectPlantForSlot = (plantId: PlantId) => {
    if (!roundIsOpen) {
      soundManager.playSound('defeat', 0.2)
      setCodeBannerNotice('⏸️ La ronda anterior finalizó. Espera un momento mientras inicia la siguiente ronda.')
      setTimeout(() => setCodeBannerNotice(null), 3500)
      return
    }
    if (codeWonPrize) {
      setCodeWonPrize(false)
    }
    if (selectedSequence.includes(plantId)) {
      setCodeBannerNotice('⚠️ Esta planta ya está incluida en la secuencia actual.')
      setTimeout(() => setCodeBannerNotice(null), 2000)
      return
    }
    soundManager.playSound('click', 0.3)
    const firstEmptyIndex = selectedSequence.findIndex((s) => s === null)
    if (firstEmptyIndex !== -1) {
      const next = [...selectedSequence]
      next[firstEmptyIndex] = plantId
      setSelectedSequence(next)
    } else {
      // Replace last slot
      const next = [...selectedSequence]
      next[SECRET_CODE_LENGTH - 1] = plantId
      setSelectedSequence(next)
    }
  }

  const handleClearSlot = (index: number) => {
    if (!roundIsOpen) return
    if (codeWonPrize) setCodeWonPrize(false)
    soundManager.playSound('click', 0.3)
    const next = [...selectedSequence]
    next[index] = null
    setSelectedSequence(next)
  }

  const handleClearAllSlots = () => {
    if (!roundIsOpen) return
    if (codeWonPrize) setCodeWonPrize(false)
    soundManager.playSound('click', 0.3)
    setSelectedSequence(Array(SECRET_CODE_LENGTH).fill(null))
  }

  /**
   * Compra 2 intentos por 1 gema. El precio está en shop_config y el cobro es
   * atómico en el servidor: antes descontaba gemas en el navegador que el
   * servidor no sabía que se habían gastado, y el siguiente refresco las
   * devolvía.
   */
  const handleBuyCodeAttempts = async () => {
    if (codeBusy || !roundIsOpen) return
    setCodeBusy(true)
    const res = await lotteryService.buySecretCodeAttempts()
    setCodeBusy(false)

    if (!res.success) {
      setCodeBannerNotice(`⚠️ ${res.error || 'No se pudieron comprar intentos.'}`)
      setTimeout(() => setCodeBannerNotice(null), 4000)
      return
    }

    // Reflejo visual inmediato del descuento de gemas
    setCurrentGems((prev) => Math.max(0, prev - (res.spent ?? 5)))
    void onRewardsChanged?.()

    soundManager.playSound('plantation', 0.8)
    setCodeBannerNotice(`¡+${res.attemptsAdded} intentos por ${res.spent} 💎! 🎯`)
    setTimeout(() => setCodeBannerNotice(null), 3000)

    await loadCodeData()
    await onRewardsChanged?.()
  }

  /**
   * Prueba la secuencia.
   *
   * La comparación la hace guess_secret_code() en Postgres contra el secreto de
   * la ronda, descuenta un intento y, si son los 5 exactos, cierra la ronda y
   * reparte el bote en la misma transacción. Aquí sólo se muestra el resultado.
   */
  const handleCheckCode = async () => {
    if (codeBusy) return

    if (selectedSequence.some((p) => p === null)) {
      setCodeBannerNotice(`⚠️ Elige ${SECRET_CODE_LENGTH} plantas para completar la secuencia.`)
      setTimeout(() => setCodeBannerNotice(null), 3000)
      return
    }

    if (!roundIsOpen) {
      setCodeBannerNotice('⚠️ Ronda cerrada: ¡El código ya ha sido descifrado! Espera la próxima ronda.')
      setTimeout(() => setCodeBannerNotice(null), 4000)
      return
    }

    if (totalAttemptsAvailable <= 0) {
      setShowConfirmCodeBuyModal(true)
      return
    }

    setCodeBusy(true)
    const res = await lotteryService.guessSecretCode(selectedSequence as string[])
    setCodeBusy(false)

    if (!res.success) {
      setCodeBannerNotice(`⚠️ ${res.error || 'No se pudo comprobar el código.'}`)
      setTimeout(() => setCodeBannerNotice(null), 4000)
      await loadCodeData()
      return
    }

    if (res.solved) {
      soundManager.playSound('victory', 1.0)
      setCodeWonPrize(true)
      setCodeBannerNotice('🏆 ¡Código descifrado! La ronda se ha cerrado y el premio está repartido.')
    } else {
      soundManager.playSound('defeat', 0.4)
      const missCount = Math.max(0, SECRET_CODE_LENGTH - (res.exactCount || 0) - (res.wrongPosCount || 0))
      setCodeBannerNotice(
        `🎯 Radar Táctico: 🟢 ${res.exactCount || 0} en posición · 🟡 ${res.wrongPosCount || 0} fuera de lugar · 🔴 ${missCount} descartadas`
      )
      setTimeout(() => setCodeBannerNotice(null), 5000)
    }

    setSelectedSequence(Array(SECRET_CODE_LENGTH).fill(null))
    await loadCodeData()
    await onRewardsChanged?.()
  }

  if (!isOpen && !onBack) return null

  const innerContent = (
    <>
      {/* TOP NAVIGATION TABS */}
      <div className="lottery-tabs-bar">
          <button
            type="button"
            className={`lottery-tab-btn ${activeTab === 'wheel' ? 'lottery-tab-btn--active' : ''}`}
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setActiveTab('wheel')
            }}
          >
            🎡 RULETA DE LA SUERTE
          </button>
          <button
            type="button"
            className={`lottery-tab-btn ${activeTab === 'auction' ? 'lottery-tab-btn--active' : ''}`}
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setActiveTab('auction')
            }}
          >
            🔨 SUBASTAS
          </button>
          <button
            type="button"
            className={`lottery-tab-btn ${activeTab === 'code' ? 'lottery-tab-btn--active' : ''}`}
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setActiveTab('code')
            }}
          >
            {`🔐 CÓDIGO SECRETO (¡BOTE ${top1PrizeBadge}!)`}
          </button>
        </div>

        {/* ===================== TAB 1: WHEEL ===================== */}
        {(() => {
          const renderWheelVisual = () => {
            const REEL_ROUNDS = 12
            return (
              <div className={`lottery-roller-wrapper ${wheelMode === 'gems' ? 'lottery-roller-wrapper--vip' : ''}`}>
                <div className="lottery-roller-header">
                  <span className="lottery-roller-title-tag">
                    {wheelMode === 'gems' ? '💎 RODILLO VIP DE OBJETOS' : '🪙 RODILLO DE RECOMPENSAS'}
                  </span>
                </div>

                <div className="lottery-roller-container">
                  {/* Vignettes superior e inferior para efecto 3D de profundidad cilíndrica */}
                  <div className="lottery-roller-vignette lottery-roller-vignette--top" />
                  <div className="lottery-roller-vignette lottery-roller-vignette--bottom" />

                  {/* Marco / Contorno selector fijo en el centro con flechas indicadoras */}
                  <div className={`lottery-reel-target-frame ${wheelMode === 'gems' ? 'lottery-reel-target-frame--vip' : ''} ${isSpinning ? 'lottery-reel-target-frame--spinning' : ''}`}>
                    <span className="lottery-reel-arrow lottery-reel-arrow--left">▶</span>
                    <div className="lottery-reel-frame-glow" />
                    <span className="lottery-reel-arrow lottery-reel-arrow--right">◀</span>
                  </div>

                  {/* Pista de tarjetas desplazándose verticalmente */}
                  <div
                    className="lottery-reel-track"
                    style={{
                      transform: `translateY(${reelTranslateY}px)`,
                      transition: isTransitionActive ? 'transform 4.2s cubic-bezier(0.12, 0.85, 0.2, 1)' : 'none',
                    }}
                  >
                    {Array.from({ length: REEL_ROUNDS }).map((_, roundIdx) => (
                      <div key={`round_${roundIdx}`} className="lottery-reel-round-group">
                        {activeSectors.map((sec, secIdx) => {
                          const plantConfig = sec.plantId ? PLANT_CONFIGS[sec.plantId as PlantId] : null
                          const isWinner = winningSector?.id === sec.id && !isSpinning
                          return (
                            <div
                              key={`${roundIdx}_${sec.id}_${secIdx}`}
                              className={`lottery-reel-item lottery-reel-item--${sec.rarity} ${isWinner ? 'lottery-reel-item--winner' : ''}`}
                            >
                              <div className="lottery-reel-item-icon-box">
                                {plantConfig ? (
                                  <img
                                    src={plantConfig.icon || plantConfig.sprite}
                                    alt={plantConfig.name}
                                    className="lottery-reel-item-img"
                                  />
                                ) : sec.type === 'token' ? (
                                  <span className="lottery-reel-item-emoji">💎</span>
                                ) : (
                                  <span className="lottery-reel-item-emoji">{sec.icon || '🍀'}</span>
                                )}
                              </div>
                              <div className="lottery-reel-item-info">
                                <div className="lottery-reel-item-name">
                                  {sec.label || plantConfig?.name}
                                </div>
                                <div className="lottery-reel-item-meta">
                                  <span className={`lottery-reel-rarity-pill lottery-pill--${sec.rarity}`}>
                                    {sec.rarity === 'jackpot'
                                      ? '🔥 ¡JACKPOT!'
                                      : sec.rarity === 'epic'
                                      ? '🔮 ÉPICO'
                                      : sec.rarity === 'rare'
                                      ? '⭐ POCO COMÚN'
                                      : sec.rarity === 'common' && sec.type === 'plant'
                                      ? '🌱 COMÚN'
                                      : sec.type === 'token'
                                      ? '💎 GEMAS'
                                      : '🍀 SUERTE'}
                                  </span>
                                  {sec.type === 'plant' && (
                                    <span className="lottery-reel-item-sub">x{sec.plantQty || 1} Carta</span>
                                  )}
                                  {sec.type === 'token' && (
                                    <span className="lottery-reel-item-sub">+{sec.valueUsd} Gemas</span>
                                  )}
                                </div>
                              </div>
                              <div className="lottery-reel-item-side-badge">
                                {sec.rarity === 'jackpot'
                                  ? '🌶️ TOP'
                                  : sec.type === 'plant'
                                  ? `x${sec.plantQty || 1}`
                                  : sec.type === 'token'
                                  ? `+${sec.valueUsd}`
                                  : '🍀'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lottery-roller-status-footer">
                  <span>{isSpinning ? '🌀 Rodillo girando hacia abajo...' : '🎯 El objeto dentro del contorno es el premio obtenido'}</span>
                </div>
              </div>
            )
          }

          const renderWheelInfoAndActions = () => (
            <>
              {/* 1. MODO SWITCHER */}
              <div className="lottery-wheel-mode-switcher">
                <button
                  type="button"
                  className={`lottery-mode-btn lottery-mode-btn--gold ${wheelMode === 'gold' ? 'lottery-mode-btn--active' : ''}`}
                  disabled={isSpinning}
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setWheelMode('gold')
                  }}
                >
                  <span className="lottery-mode-icon">🪙</span>
                  <div className="lottery-mode-info">
                    <strong>MODO ORO</strong>
                    <small>{SPIN_COST_GOLD} Oro / tiro</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={`lottery-mode-btn lottery-mode-btn--vip ${wheelMode === 'gems' ? 'lottery-mode-btn--active' : ''}`}
                  disabled={isSpinning}
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setWheelMode('gems')
                  }}
                >
                  <span className="lottery-mode-icon">💎</span>
                  <div className="lottery-mode-info">
                    <strong style={{ color: '#38bdf8' }}>SUERTE VIP</strong>
                    <small>{SPIN_COST_GEMS_VIP} Gemas / tiro</small>
                  </div>
                  <span className="lottery-vip-tag">0% FALLO</span>
                </button>
              </div>

              {/* 2. HERO CARD */}
              <div className={`lottery-wheel-hero-card ${wheelMode === 'gems' ? 'lottery-wheel-hero-card--vip' : ''}`}>
                {wheelMode === 'gold' ? (
                  <>
                    <div className="lottery-wheel-hero-badge">🪙 QUEMA DE ORO</div>
                    <h3>¡CONVIERTE TU ORO EN CARTAS Y JACKPOTS!</h3>
                    <p>
                      Costo: <strong>{SPIN_COST_GOLD} Oro por giro</strong>. Gana copias de plantas, gemas directas y el <strong>Gran Jackpot Jalapeño 🌶️</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="lottery-wheel-hero-badge lottery-wheel-hero-badge--vip">👑 MODO SUERTE VIP</div>
                    <h3 style={{ color: '#38bdf8' }}>¡RULETA VIP · PLANTAS DOBLES Y JACKPOT!</h3>
                    <p>
                      Costo: <strong>{SPIN_COST_GEMS_VIP} Gemas por giro</strong>. <strong>0.5% Jalapeño 🌶️</strong>, copias dobles (2x) de plantas y reintegros de gemas.
                    </p>
                  </>
                )}
              </div>

              {/* 3. MULTIPLIER SELECTOR */}
              <div className="lottery-multiplier-wrapper">
                <span className="lottery-multiplier-label">⚡ CANTIDAD DE TIROS:</span>
                <div className="lottery-multiplier-selector">
                  {[1, 3, 5, 10].map((mult) => {
                    const isSelected = spinMultiplier === mult
                    const cost = mult * (wheelMode === 'gold' ? SPIN_COST_GOLD : SPIN_COST_GEMS_VIP)
                    return (
                      <button
                        key={mult}
                        type="button"
                        className={`lottery-mult-btn ${isSelected ? 'lottery-mult-btn--active' : ''}`}
                        disabled={isSpinning}
                        onClick={() => {
                          soundManager.playSound('click', 0.3)
                          setSpinMultiplier(mult)
                        }}
                      >
                        <span className="lottery-mult-count">x{mult}</span>
                        <span className="lottery-mult-cost">
                          {wheelMode === 'gold' ? `${cost.toLocaleString()} 🪙` : `${cost} 💎`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 4. SPIN BUTTON & BALANCE */}
              <div className="lottery-spin-action-box">
                <button
                  type="button"
                  className={`lottery-spin-btn ${wheelMode === 'gold' ? 'lottery-spin-btn--gold' : 'lottery-spin-btn--vip'}`}
                  disabled={
                    isSpinning ||
                    (wheelMode === 'gold' && currentGold < spinMultiplier * SPIN_COST_GOLD) ||
                    (wheelMode === 'gems' && currentGems < spinMultiplier * SPIN_COST_GEMS_VIP)
                  }
                  onClick={handleStartSpin}
                >
                  <span className="lottery-btn-sparkle">
                    {wheelMode === 'gold' ? '🪙' : '✨'}
                  </span>
                  <span>
                    {isSpinning
                      ? 'GIRANDO RULETA...'
                      : wheelMode === 'gold'
                      ? `GIRAR ${spinMultiplier} ${spinMultiplier === 1 ? 'TIRO' : 'TIROS'} (${(spinMultiplier * SPIN_COST_GOLD).toLocaleString()} ORO)`
                      : `GIRAR ${spinMultiplier} ${spinMultiplier === 1 ? 'TIRO VIP' : 'TIROS VIP'} (${spinMultiplier * SPIN_COST_GEMS_VIP} GEMAS)`}
                  </span>
                </button>

                <div className="lottery-balance-reminder">
                  <span>Tu saldo:</span>
                  <strong style={{ color: '#facc15' }}>🪙 {currentGold.toLocaleString()} Oro</strong>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <strong style={{ color: '#38bdf8' }}>💎 {currentGems.toLocaleString()} Gemas</strong>
                </div>
              </div>

              {/* 5. PREVIEW HIGHLIGHTS */}
              <div className="lottery-prizes-preview-box">
                <span className="lottery-prizes-title">🎁 PREMIOS ({wheelMode === 'gold' ? 'MODO ORO' : 'MODO GEMAS VIP'}):</span>
                <div className="lottery-prizes-tags-grid">
                  {wheelMode === 'gold' ? (
                    <>
                      <div className="lottery-prize-tag lottery-prize-tag--jackpot">
                        🌶️ Jalapeño (0.5% Jackpot)
                      </div>
                      <div className="lottery-prize-tag lottery-prize-tag--legendary">
                        💎 10 y 5 Gemas
                      </div>
                      <div className="lottery-prize-tag lottery-prize-tag--plant">
                        🌱 4 Comunes (Guisante, Girasol, Nuez, Cactus)
                      </div>
                      <div className="lottery-prize-tag lottery-prize-tag--plant">
                        🥊 5 Poco Comunes (Bonk Choy, Repetidor, Ajo, Squash, Melón)
                      </div>
                      <div className="lottery-prize-tag lottery-prize-tag--none">
                        🍀 Sigue Intentando (60% Quema)
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="lottery-prize-tag lottery-prize-tag--jackpot">
                        🌶️ Jalapeño (0.5% Jackpot VIP)
                      </div>
                      <div className="lottery-prize-tag lottery-prize-tag--legendary">
                        💎 Reintegros de 25 y 50 Gemas
                      </div>
                      <div className="lottery-prize-tag lottery-prize-tag--plant">
                        🌱 4 Comunes Dobles (2x Copias)
                      </div>
                      <div className="lottery-prize-tag lottery-prize-tag--plant">
                        🥊 5 Poco Comunes (Bonk Choy, Repetidor, Ajo, Squash, Melón)
                      </div>
                      <div className="lottery-prize-tag lottery-prize-tag--none">
                        🍀 Sigue Intentando (35% Fallo)
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )

          if (activeTab !== 'wheel') return null

          const isScreen = Boolean(onBack)

          return (
            <div className="lottery-wheel-tab-pane" style={isScreen ? { padding: '8px 0' } : undefined}>
              {recentWinners.length > 0 && (
                <div className="lottery-modal-marquee-banner">
                  <span className="lottery-modal-marquee-tag">🔥 PREMIOS EN VIVO:</span>
                  <div className="lottery-modal-marquee-track">
                    {recentWinners.map((w, idx) => (
                      <span key={w.id || idx} className="lottery-modal-marquee-item">
                        <strong style={{ color: '#ffffff' }}>{w.username}</strong>:{' '}
                        <span style={{ color: '#38bdf8' }}>{w.description.replace(/^Premio de Ruleta:\s*/i, '')}</span>
                        {idx < recentWinners.length - 1 && <span style={{ color: '#f59e0b', margin: '0 8px' }}>•</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="lottery-wheel-content-grid">
                <div className="lottery-wheel-visual-col">
                  {renderWheelVisual()}
                </div>
                <div className="lottery-wheel-info-col">
                  {renderWheelInfoAndActions()}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ===================== TAB: SUBASTAS ===================== */}
        {activeTab === 'auction' && (
          <AuctionTabPane
            userGold={userGold}
            userTokens={currentGems}
            userId={userId}
            username={username}
            onRewardsChanged={onRewardsChanged}
          />
        )}

        {/* ===================== TAB 2: CODE (PLANT SEQUENCE) ===================== */}
        {activeTab === 'code' && (
          <div className="lottery-code-tab-pane">
            {codeBannerNotice && (
              <div className="lottery-code-alert-banner">{codeBannerNotice}</div>
            )}

            {/* SUB-TABS: JUEGA | HISTORIAL | RANKING | ADMIN */}
            <div className="lottery-code-subtabs">
              <button
                type="button"
                className={`lottery-code-subtab-btn ${codeSubTab === 'play' ? 'lottery-code-subtab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setCodeSubTab('play')
                }}
              >
                🎮 JUEGA
              </button>
              <button
                type="button"
                className={`lottery-code-subtab-btn ${codeSubTab === 'history' ? 'lottery-code-subtab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setCodeSubTab('history')
                }}
              >
                📜 HISTORIAL ({codeHistory.length})
              </button>
              <button
                type="button"
                className={`lottery-code-subtab-btn ${codeSubTab === 'ranking' ? 'lottery-code-subtab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setCodeSubTab('ranking')
                }}
              >
                🏆 RANKING ({codeBoard.length})
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="lottery-code-subtab-btn"
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: '#facc15',
                    border: '1px solid #eab308',
                    fontWeight: 800,
                  }}
                  onClick={() => {
                    soundManager.playSound('click', 0.3)
                    onClose?.()
                    onOpenAdmin?.()
                  }}
                  title="Configurar Bote, Coste e Iniciar Nuevo Acertijo desde Panel de Administrador"
                >
                  🛡️ ADMINISTRAR
                </button>
              )}
            </div>

            {/* SUBTAB 1: JUEGA */}
            {codeSubTab === 'play' && (
              !roundIsOpen ? (
                /* BANNER Y PANTALLA DE CÓDIGO DESCIFRADO / RONDA FINALIZADA */
                <div className="lottery-code-solved-container">
                  <div className="lottery-code-solved-banner">
                    <div className="lottery-code-solved-badge">🏆 ¡CÓDIGO DESCIFRADO!</div>
                    <h3>Espera la siguiente ronda...</h3>
                    <p>
                      {codeRound?.winnerId
                        ? `¡Un jugador descifró la secuencia secreta de la Ronda #${codeRound.roundNumber} y se ha repartido el bote!`
                        : `La Ronda #${codeRound?.roundNumber ?? ''} ha concluido y las recompensas han sido acreditadas.`}
                    </p>

                    <div className="lottery-code-solved-details">
                      <div className="lottery-code-detail-item">
                        <span className="lottery-code-detail-label">Ronda</span>
                        <span className="lottery-code-detail-value">#{codeRound?.roundNumber ?? '—'}</span>
                      </div>
                      <div className="lottery-code-detail-item">
                        <span className="lottery-code-detail-label">Bote 1er Puesto</span>
                        <span className="lottery-code-detail-value lottery-code-detail-value--gold">
                          {top1Amount} {top1CurrencyLabel}
                        </span>
                      </div>
                      <div className="lottery-code-detail-item">
                        <span className="lottery-code-detail-label">Estado</span>
                        <span className="lottery-code-detail-value lottery-code-detail-value--green">
                          ✅ Repartido
                        </span>
                      </div>
                    </div>

                    {/* Resumen dinámico de premios configurados */}
                    {configuredTiers.length > 0 && (
                      <div style={{ margin: '12px 0', padding: '8px 12px', background: 'rgba(0,0,0,0.35)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#facc15', marginBottom: '6px' }}>
                          🏆 Premios acreditados de la ronda:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                          {configuredTiers.map((t) => (
                            <span
                              key={t.place}
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: t.place === 1 ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255,255,255,0.05)',
                                border: t.place === 1 ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.1)',
                              }}
                            >
                              #{t.place}: <strong style={{ color: t.currency === 'gems' ? '#38bdf8' : '#f59e0b' }}>{t.amount} {t.currency === 'gems' ? '💎' : '💰'}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="lottery-code-solved-notice">
                      📢 El Administrador abrirá una nueva ronda de 5 plantas próximamente. Puedes consultar el ranking final o tu historial mientras tanto.
                    </div>

                    <div className="lottery-code-solved-actions">
                      <button
                        type="button"
                        className="lottery-code-check-btn"
                        onClick={() => setCodeSubTab('ranking')}
                      >
                        🏆 Ver Clasificación y Ganadores
                      </button>
                      <button
                        type="button"
                        className="lottery-code-clear-btn"
                        onClick={() => setCodeSubTab('history')}
                      >
                        📜 Ver Mi Historial
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="lottery-code-subtab-btn"
                          style={{
                            background: 'rgba(234, 179, 8, 0.2)',
                            color: '#facc15',
                            border: '1.5px solid #eab308',
                            fontWeight: 800,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            soundManager.playSound('click', 0.3)
                            onClose?.()
                            onOpenAdmin?.()
                          }}
                        >
                          🛡️ Iniciar Nueva Ronda (Panel Admin)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lottery-code-layout-grid">
                  {/* LEFT: PLANT PICKER */}
                  <div className="lottery-code-picker-pane">
                    <div className="lottery-code-pane-header">
                      <h4>🌱 SELECCIONA TUS PLANTAS</h4>
                      <small>Haz clic para añadir a la combinación</small>
                    </div>

                    <div className="lottery-plants-compact-grid">
                      {ALL_PLANTS_LIST.map((plantId) => {
                        const conf = PLANT_CONFIGS[plantId]
                        const iconSrc = conf?.packetActive || conf?.icon
                        const isAlreadySelected = selectedSequence.includes(plantId)
                        return (
                          <button
                            key={plantId}
                            type="button"
                            className={`lottery-mini-plant-card ${isAlreadySelected ? 'lottery-mini-plant-card--in-use' : ''}`}
                            disabled={isAlreadySelected}
                            onClick={() => handleSelectPlantForSlot(plantId)}
                            title={
                              isAlreadySelected
                                ? `${conf.name} (Ya añadida a la combinación)`
                                : conf.name
                            }
                          >
                            <img src={iconSrc} alt={conf.name} className="lottery-mini-plant-img" />
                            <span className="lottery-mini-plant-name">{conf.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* RIGHT: SEQUENCE SLOTS & CONTROLS */}
                  <div className="lottery-code-game-pane">
                    {/* PROMO HERO BANNER */}
                    <div className="lottery-code-promo-banner">
                      <div className="lottery-promo-badge">
                        {`🔐 RONDA #${codeRound?.roundNumber ?? ''} · BOTE: ${top1PrizeBadge}`}
                      </div>
                      <h3>¡ADIVINA LA SECUENCIA!</h3>
                    </div>

                    {/* 5 ACTIVE SLOTS */}
                    <div className="lottery-code-slots-row">
                      {selectedSequence.map((plantId, idx) => {
                        const conf = plantId ? PLANT_CONFIGS[plantId] : null
                        const iconSrc = conf ? conf.packetActive || conf.icon : null

                        return (
                          <div
                            key={idx}
                            className={`lottery-code-slot ${plantId ? 'lottery-code-slot--filled' : ''}`}
                            onClick={() => plantId && handleClearSlot(idx)}
                            title={plantId ? `Quitar ${conf?.name}` : `Slot #${idx + 1} vacío`}
                          >
                            <span className="lottery-slot-num">{idx + 1}</span>
                            {iconSrc ? (
                              <div className="lottery-slot-filled-content">
                                <img src={iconSrc} alt={conf?.name} className="lottery-slot-img" />
                                <span className="lottery-slot-plant-name">{conf?.name}</span>
                                <span className="lottery-slot-remove-badge">✕</span>
                              </div>
                            ) : (
                              <span className="lottery-slot-empty-icon">❓</span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* ACTIONS & ATTEMPTS STATUS */}
                    <div className="lottery-code-controls-row">
                      <button
                        type="button"
                        className="lottery-code-clear-btn"
                        onClick={handleClearAllSlots}
                        disabled={selectedSequence.every((s) => s === null)}
                      >
                        🧹 LIMPIAR
                      </button>

                      <div className="lottery-attempts-indicator">
                        <span>Intentos:</span>
                        <strong>
                          {totalAttemptsAvailable} ({freeAttemptsLeft} gratis + {codeExtra} extra)
                        </strong>
                      </div>

                      <button
                        type="button"
                        className="lottery-code-buy-btn"
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setShowConfirmCodeBuyModal(true)
                        }}
                        disabled={currentGems < 5.0}
                        title="Pagar 5 Gemas 💎 por 1 intento adicional"
                      >
                        ⚡ +1 INTENTO (5 💎 Gemas)
                      </button>

                      <button
                        type="button"
                        className="lottery-code-check-btn"
                        onClick={() => {
                          if (totalAttemptsAvailable <= 0) {
                            setShowConfirmCodeBuyModal(true)
                            return
                          }
                          handleCheckCode()
                        }}
                        disabled={selectedSequence.some((s) => s === null)}
                      >
                        🔮 VERIFICAR CÓDIGO
                      </button>
                    </div>

                    {/* ÚLTIMO INTENTO REALIZADO (PREVIEW MASTERMIND CIEGO) */}
                    {codeHistory.length > 0 && (() => {
                      const lastAtt = codeHistory[0]
                      const missCount = Math.max(0, (lastAtt.sequence?.length || SECRET_CODE_LENGTH) - lastAtt.exactCount - lastAtt.wrongPosCount)
                      return (
                        <div className="lottery-code-last-attempt-card">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#fbbf24' }}>Último Intento:</span>
                            <div className="lottery-history-cards">
                              {lastAtt.sequence.map((pId, pIdx) => {
                                const pConf = PLANT_CONFIGS[pId as PlantId]
                                const pIcon = pConf ? pConf.packetActive || pConf.icon : ''
                                return (
                                  <div key={pIdx} className="lottery-hist-mini-card" title={pConf?.name || `Planta #${pIdx + 1}`}>
                                    <img src={pIcon} alt={pConf?.name} />
                                  </div>
                                )
                              })}
                            </div>
                            <div className="lottery-history-badges">
                              <span className="lottery-count-badge lottery-count-badge--exact" title={`${lastAtt.exactCount} plantas en posición exacta`}>
                                🟢 {lastAtt.exactCount} {lastAtt.exactCount === 1 ? 'Exacta' : 'Exactas'}
                              </span>
                              <span className="lottery-count-badge lottery-count-badge--wrong" title={`${lastAtt.wrongPosCount} plantas en otra casilla`}>
                                🟡 {lastAtt.wrongPosCount} {lastAtt.wrongPosCount === 1 ? 'Desubicada' : 'Desubicadas'}
                              </span>
                              <span className="lottery-count-badge lottery-count-badge--miss" title={`${missCount} plantas descartadas`}>
                                🔴 {missCount} {missCount === 1 ? 'Descartada' : 'Descartadas'}
                              </span>
                            </div>
                            <strong className="lottery-history-pct" style={{ fontSize: '11px', marginLeft: 'auto' }}>
                              {Number(lastAtt.pct).toFixed(1)}%
                            </strong>
                          </div>
                        </div>
                      )
                    })()}

                    {/* CHAT / FEED DE PISTAS DEDUCTIVAS */}
                    <div className="lottery-code-hints-section">
                      <div className="lottery-code-hints-header">
                        <div className="lottery-code-hints-title">
                          <span style={{ fontSize: '11px', fontWeight: 900, color: '#facc15' }}>📡 PISTAS DE INTELIGENCIA</span>
                          <span style={{ fontSize: '9px', color: '#94a3b8' }}>Deduce la combinación secreta</span>
                        </div>
                        <button
                          type="button"
                          className="lottery-code-buy-hint-btn"
                          onClick={handleBuyHint}
                          disabled={buyingHint || currentGems < 10 || !roundIsOpen}
                          title="Pagar 10 Gemas 💎 para adquirir una pista deductiva"
                        >
                          {buyingHint ? '⏳ Comprando...' : '📡 COMPRAR PISTA (10 💎)'}
                        </button>
                      </div>

                      <div className="lottery-code-hints-chat">
                        {codeHints.length === 0 ? (
                          <div className="lottery-hints-empty">
                            <span>📡 ¿Sin pistas? Adquiere inteligencia táctica por 10 💎 para descartar sospechosas o revelar familias clave.</span>
                          </div>
                        ) : (
                          codeHints.map((h, i) => (
                            <div key={h.id || i} className="lottery-hint-bubble">
                              <span className="lottery-hint-tag">Pista #{i + 1}</span>
                              <span className="lottery-hint-text">{h.hintText}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* SUBTAB 2: HISTORIAL */}
            {codeSubTab === 'history' && (
              <div className="lottery-code-full-pane">
                <div className="lottery-code-history-box" style={{ flex: 1 }}>
                  <div className="lottery-history-header">
                    <h5>📜 HISTORIAL Y RADAR DE DETECCIÓN:</h5>
                    <div className="lottery-pins-legend">
                      <span className="pin-tag pin-tag--exact">🟢 Posición Exacta</span>
                      <span className="pin-tag pin-tag--wrong">🟡 En otra Casilla</span>
                      <span className="pin-tag pin-tag--miss">🔴 Descartada</span>
                    </div>
                  </div>

                  <div className="lottery-history-list" style={{ minHeight: '260px', maxHeight: '380px' }}>
                    {codeHistory.length === 0 ? (
                      <div className="lottery-history-empty">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                          <span>Aún no has realizado intentos en esta ronda. ¡Elige {SECRET_CODE_LENGTH} plantas y pon a prueba tu deducción!</span>
                          <button
                            type="button"
                            className="lottery-code-check-btn"
                            style={{ fontSize: '11px', padding: '6px 14px' }}
                            onClick={() => setCodeSubTab('play')}
                          >
                            🎮 ¡Probar Primera Combinación!
                          </button>
                        </div>
                      </div>
                    ) : (
                      codeHistory.map((att, idx) => {
                        const missCount = Math.max(0, (att.sequence?.length || SECRET_CODE_LENGTH) - att.exactCount - att.wrongPosCount)
                        return (
                          <div key={att.id} className="lottery-history-row">
                            <span className="lottery-history-num">#{codeHistory.length - idx}</span>
                            <div className="lottery-history-cards">
                              {att.sequence.map((pId, pIdx) => {
                                const pConf = PLANT_CONFIGS[pId as PlantId]
                                const pIcon = pConf ? pConf.packetActive || pConf.icon : ''
                                return (
                                  <div key={pIdx} className="lottery-hist-mini-card" title={pConf?.name || `Planta #${pIdx + 1}`}>
                                    <img src={pIcon} alt={pConf?.name} />
                                  </div>
                                )
                              })}
                            </div>

                            <div className="lottery-history-badges">
                              <span className="lottery-count-badge lottery-count-badge--exact" title={`${att.exactCount} plantas en posición exacta`}>
                                🟢 {att.exactCount} {att.exactCount === 1 ? 'Exacta' : 'Exactas'}
                              </span>
                              <span className="lottery-count-badge lottery-count-badge--wrong" title={`${att.wrongPosCount} plantas en el código pero en otra casilla`}>
                                🟡 {att.wrongPosCount} {att.wrongPosCount === 1 ? 'Desubicada' : 'Desubicadas'}
                              </span>
                              <span className="lottery-count-badge lottery-count-badge--miss" title={`${missCount} plantas descartadas`}>
                                🔴 {missCount} {missCount === 1 ? 'Descartada' : 'Descartadas'}
                              </span>
                            </div>

                            <strong
                              className="lottery-history-pct"
                              style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}
                              title="Acercamiento acumulado"
                            >
                              {Number(att.pct).toFixed(1)}%
                            </strong>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 3: RANKING */}
            {codeSubTab === 'ranking' && (
              <div className="lottery-code-full-pane">
                <div className="lottery-code-history-box" style={{ flex: 1 }}>
                  {/* SELECTOR DE RONDA: ACTUAL VS PASADAS */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 12px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: '8px',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#facc15' }}>🗂️ Consultar Ronda:</span>
                      <select
                        value={selectedRankingRoundId || ''}
                        onChange={(e) => {
                          const rId = e.target.value
                          setSelectedRankingRoundId(rId)
                          loadRoundLeaderboard(rId)
                        }}
                        style={{
                          background: '#0f172a',
                          color: '#ffffff',
                          border: '1px solid #38bdf8',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {roundsList.length === 0 && codeRound && (
                          <option value={codeRound.id}>
                            Ronda #{codeRound.roundNumber} {codeRound.status === 'open' ? '🟢 (En curso)' : '✅ (Finalizada)'}
                          </option>
                        )}
                        {roundsList.map((r) => {
                          const rNum = r.round_number ?? r.roundNumber
                          const rStatus = r.status === 'open' ? '🟢 (En curso)' : '✅ (Finalizada)'
                          const t1 = r.prizes_config?.find((p: any) => p.place === 1)
                          const t1Badge = t1 ? `${t1.amount} ${t1.currency === 'gems' ? '💎' : '💰'}` : `${r.prize_pool_gems || 50} 💎`
                          return (
                            <option key={r.id} value={r.id}>
                              Ronda #{rNum} {rStatus} · Bote: {t1Badge}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                    {loadingRanking && (
                      <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700 }}>⏳ Cargando clasificación...</span>
                    )}
                  </div>

                  <div className="lottery-history-header">
                    <h5>🏆 CLASIFICACIÓN RONDA #{selectedRankingRound?.round_number ?? selectedRankingRound?.roundNumber ?? ''}:</h5>
                    <div className="lottery-pins-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {rankingConfiguredTiers.slice(0, 3).map((p) => (
                        <span
                          key={p.place}
                          className="pin-tag pin-tag--exact"
                          style={{
                            border: p.place === 1 ? '1px solid #facc15' : undefined,
                            background: p.place === 1 ? 'rgba(250, 204, 21, 0.2)' : undefined,
                          }}
                        >
                          {p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : '🥉'} {p.amount} {p.currency === 'gold' ? '💰' : '💎'}
                        </span>
                      ))}
                      {rankingConfiguredTiers.length > 3 && (
                        <span className="pin-tag pin-tag--wrong">
                          Top 4-{rankingConfiguredTiers.length}: Recompensas
                        </span>
                      )}
                      <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}>
                        (🤝 Los empates dividen el premio)
                      </span>
                    </div>
                  </div>

                  <div className="lottery-history-list" style={{ minHeight: '260px', maxHeight: '380px' }}>
                    {boardWithDividedPrizes.length === 0 ? (
                      <div className="lottery-history-empty">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                          <span>Nadie ha probado todavía en esta ronda. ¡Sé el primero en jugar!</span>
                          <button
                            type="button"
                            className="lottery-code-check-btn"
                            style={{ fontSize: '11px', padding: '6px 14px' }}
                            onClick={() => setCodeSubTab('play')}
                          >
                            🎮 ¡Comenzar a Jugar!
                          </button>
                        </div>
                      </div>
                    ) : (
                      boardWithDividedPrizes.map((e) => {
                        const isTied = e.tiedCount > 1
                        return (
                          <div
                            key={e.userId}
                            className="lottery-history-row"
                            style={{
                              ...(e.isMe ? { outline: '1px solid #6366f1', background: 'rgba(99, 102, 241, 0.2)' } : {}),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                            }}
                          >
                            {/* Puesto: si hay empate, cada jugador ocupa su propia fila (uno debajo del otro) con el mismo puesto */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', minWidth: isTied ? 36 : 20 }}>
                              <span className="lottery-history-num" style={{ width: 'auto' }}>
                                {e.place === 1 ? '🥇' : e.place === 2 ? '🥈' : e.place === 3 ? '🥉' : `#${e.place}`}
                              </span>
                              {isTied && (
                                <span
                                  style={{
                                    fontSize: '8px',
                                    fontWeight: 800,
                                    color: '#facc15',
                                    background: 'rgba(250, 204, 21, 0.15)',
                                    border: '1px solid rgba(250, 204, 21, 0.3)',
                                    padding: '1px 3px',
                                    borderRadius: '3px',
                                    lineHeight: 1,
                                  }}
                                  title={`Empate en puesto #${e.place} (${e.tiedCount} jugadores)`}
                                >
                                  empate
                                </span>
                              )}
                            </div>

                            {/* Nombre del jugador */}
                            <span style={{ flex: 1, fontWeight: e.isMe ? 800 : 500, color: e.isMe ? '#a5b4fc' : '#ffffff', marginLeft: 6 }}>
                              {e.username}{e.isMe ? ' (tú)' : ''}
                            </span>

                            {/* Intentos realizados */}
                            <span
                              style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.75, marginRight: 10 }}
                              title="Intentos realizados"
                            >
                              {e.attempts} int.
                            </span>

                            {/* Porcentaje de acierto */}
                            <strong style={{ fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' }}>
                              {Number(e.bestPct).toFixed(1)}%
                            </strong>

                            {/* Premio: su parte individual asignada */}
                            {e.myShare > 0 && (
                              <span
                                style={{
                                  marginLeft: 10,
                                  fontVariantNumeric: 'tabular-nums',
                                  color: e.currency === 'gems' ? '#38bdf8' : '#f59e0b',
                                  fontWeight: 800,
                                  minWidth: 54,
                                  textAlign: 'right',
                                }}
                                title={
                                  isTied
                                    ? `Su parte: +${e.myShare} ${e.currency === 'gems' ? 'Gemas' : 'Oro'} (premio base de ${e.totalPrize} dividido entre ${e.tiedCount} jugadores)`
                                    : `Premio Top #${e.place} (+${e.myShare} ${e.currency === 'gems' ? 'Gemas' : 'Oro'})`
                                }
                              >
                                +{e.myShare} {e.currency === 'gold' ? '💰' : '💎'}
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {codeMyPayout && (
                    <div className="lottery-code-alert-banner" style={{ marginTop: 10 }}>
                      🏅 Cobraste {codeMyPayout.gems > 0 ? `${codeMyPayout.gems} 💎 ` : ''}{(codeMyPayout as any).gold > 0 ? `+${(codeMyPayout as any).gold} 💰 Oro ` : ''}por el puesto #{codeMyPayout.place}
                      {codeMyPayout.tiedWith > 1 && ` (empate entre ${codeMyPayout.tiedWith})`}.
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px 14px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      borderRadius: '8px',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      boxShadow: 'inset 0 0 14px rgba(56, 189, 248, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#facc15', letterSpacing: '0.5px' }}>
                        🎮 TABLA OFICIAL DE RECOMPENSAS (RONDA #{selectedRankingRound?.round_number ?? selectedRankingRound?.roundNumber ?? ''}):
                      </span>
                      <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 700 }}>
                        {rankingConfiguredTiers.length} puestos premiados
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {rankingConfiguredTiers.map((t) => (
                        <span
                          key={t.place}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            background: t.place === 1
                              ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.3) 0%, rgba(245, 158, 11, 0.15) 100%)'
                              : t.place === 2
                              ? 'rgba(148, 163, 184, 0.15)'
                              : t.place === 3
                              ? 'rgba(217, 119, 6, 0.15)'
                              : 'rgba(0, 0, 0, 0.45)',
                            border: t.place === 1
                              ? '1px solid #eab308'
                              : t.place === 2
                              ? '1px solid #94a3b8'
                              : t.place === 3
                              ? '1px solid #d97706'
                              : '1px solid rgba(255, 255, 255, 0.12)',
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                            boxShadow: t.place === 1 ? '0 0 8px rgba(234, 179, 8, 0.3)' : undefined,
                          }}
                        >
                          <span style={{ color: t.place === 1 ? '#facc15' : t.place === 2 ? '#e2e8f0' : t.place === 3 ? '#fb923c' : '#94a3b8', marginRight: '4px' }}>
                            {t.place === 1 ? '🥇 #1' : t.place === 2 ? '🥈 #2' : t.place === 3 ? '🥉 #3' : `#${t.place}`}
                          </span>
                          <strong style={{ color: t.currency === 'gems' ? '#38bdf8' : '#facc15' }}>
                            {t.amount} {t.currency === 'gems' ? '💎 Gemas' : '💰 Oro'}
                          </strong>
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, opacity: 0.85, margin: 0, lineHeight: 1.5 }}>
                      El primer lugar que descifre el 100% se lleva{' '}
                      <strong style={{ color: rankingConfiguredTiers[0]?.currency === 'gems' ? '#38bdf8' : '#f59e0b' }}>
                        {rankingConfiguredTiers[0]?.amount ?? 50} {rankingConfiguredTiers[0]?.currency === 'gems' ? 'Gemas 💎' : 'Oro 💰'}
                      </strong>
                      . Los empates en cualquier puesto se reparten equitativamente el premio asignado a dicho puesto.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== PRIZE POPUP MODAL (WHEEL) ===================== */}
        {showPrizeModal && winningSector && (
          <div className="lottery-prize-overlay" onClick={() => { if (!isSpinning) handleFinishPrizeModal() }}>
            <div className="lottery-prize-box" onClick={(e) => e.stopPropagation()}>
              <div className="lottery-prize-confetti">
                {winningSector.type === 'none' ? '💨 🍀 ✨' : '🎉 🎊 ✨'}
              </div>
              <div
                className="lottery-prize-badge"
                style={
                  winningSector.type === 'none'
                    ? { background: '#64748b', color: '#ffffff' }
                    : winningSector.rarity === 'jackpot'
                    ? { background: '#ef4444', color: '#ffffff', boxShadow: '0 0 16px rgba(239, 68, 68, 0.8)' }
                    : undefined
                }
              >
                {batchResults.length > 1
                  ? `TIRO ${currentBatchIndex + 1} DE ${batchResults.length}`
                  : winningSector.type === 'none'
                  ? '¡SIGUE INTENTANDO!'
                  : '¡FELICITACIONES!'}
              </div>
              {(() => {
                const plantCfg = winningSector.plantId ? PLANT_CONFIGS[winningSector.plantId as PlantId] : null
                if (plantCfg) {
                  return (
                    <div className={`lottery-prize-card-frame lottery-prize-card-frame--${winningSector.rarity}`}>
                      <img
                        src={plantCfg.icon || plantCfg.sprite}
                        alt={plantCfg.name}
                        className="lottery-prize-card-img"
                      />
                      {(winningSector.plantQty ?? 1) > 1 && (
                        <span className="lottery-prize-card-qty-badge">
                          x{winningSector.plantQty}
                        </span>
                      )}
                    </div>
                  )
                }
                if (winningSector.type === 'token') {
                  return (
                    <div className="lottery-prize-card-frame lottery-prize-card-frame--gems">
                      <span className="lottery-prize-gem-emoji">💎</span>
                      <span className="lottery-prize-card-qty-badge">
                        +{winningSector.valueUsd?.toFixed(0)}
                      </span>
                    </div>
                  )
                }
                return (
                  <div className="lottery-prize-icon">{winningSector?.icon || '🎁'}</div>
                )
              })()}
              <h3 className="lottery-prize-name">{winningSector?.label || ''}</h3>
              <p className="lottery-prize-desc">
                {winningSector.type === 'none'
                  ? '¡La suerte no estuvo de tu lado en este tiro! Sigue intentando.'
                  : winningSector.type === 'token'
                  ? `¡Se han acreditado +${winningSector.valueUsd?.toFixed(0)} Gemas 💎 a tu cuenta!`
                  : winningSector.type === 'gold'
                  ? `¡Has ganado +${winningSector.goldAmount?.toLocaleString()} Monedas de Oro!`
                  : winningSector.type === 'pack'
                  ? `¡Se ha añadido ${winningSector.packQty}x ${winningSector.label} a tus sobres pendientes!`
                  : winningSector.type === 'plant'
                  ? `¡Has recibido +${winningSector.plantQty ?? 1}x ${winningSector.label} para tu colección y jardín!`
                  : winningSector.type === 'item'
                  ? `¡Se ha añadido ${winningSector.label} a tu inventario de cultivo!`
                  : `¡Recompensa acreditada con éxito!`}
              </p>

              {currentBatchIndex < batchResults.length - 1 ? (
                <button
                  type="button"
                  className="lottery-prize-claim-btn"
                  onClick={handleNextSpinInBatch}
                >
                  SIGUIENTE TIRO ({currentBatchIndex + 2}/{batchResults.length}) ⏩
                </button>
              ) : batchResults.length > 1 ? (
                <button
                  type="button"
                  className="lottery-prize-claim-btn lottery-prize-claim-btn--summary"
                  onClick={handleFinishPrizeModal}
                >
                  VER RESUMEN DE BOTÍN 🏆
                </button>
              ) : (
                <button
                  type="button"
                  className="lottery-prize-claim-btn"
                  onClick={handleFinishPrizeModal}
                >
                  {winningSector.type === 'none' ? 'ENTENDIDO' : 'RECLAMAR RECOMPENSA'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===================== BATCH SUMMARY POPUP ===================== */}
        {showBatchSummaryModal && batchSummary && (
          <div className="lottery-prize-overlay" onClick={() => setShowBatchSummaryModal(false)}>
            <div className="lottery-summary-box" onClick={(e) => e.stopPropagation()}>
              <div className="lottery-prize-confetti">👑 🎁 💎 ✨</div>
              <div className="lottery-summary-badge">
                🏆 BOTÍN DE SESIÓN ({batchSummary.totalSpins} TIROS)
              </div>
              <h3 className="lottery-summary-title">¡RESULTADOS DE TU SORTEO!</h3>

              <div className="lottery-summary-spent-bar">
                <span>Inversión realizada:</span>
                <strong>
                  {batchCurrency === 'gold'
                    ? `${batchTotalSpent.toLocaleString()} 🪙 Oro`
                    : `${batchTotalSpent} 💎 Gemas`}
                </strong>
              </div>

              <div className="lottery-summary-rewards-list">
                {batchSummary.totalGemsWon > 0 && (
                  <div className="lottery-summary-item lottery-summary-item--gems">
                    <span className="lottery-summary-item-icon">💎</span>
                    <div className="lottery-summary-item-info">
                      <strong>Gemas Ganadas</strong>
                      <small>Acreditadas a tu cuenta</small>
                    </div>
                    <span className="lottery-summary-item-qty">+{batchSummary.totalGemsWon} 💎</span>
                  </div>
                )}

                {batchSummary.plants.map((p) => {
                  const pConfig = p.plantId ? PLANT_CONFIGS[p.plantId as PlantId] : null
                  return (
                    <div
                      key={p.plantId}
                      className={`lottery-summary-item ${p.plantId === 'jalapeno' ? 'lottery-summary-item--jackpot' : 'lottery-summary-item--plant'}`}
                    >
                      <div className="lottery-summary-item-icon-box">
                        {pConfig ? (
                          <img
                            src={pConfig.icon || pConfig.sprite}
                            alt={p.name}
                            className="lottery-summary-plant-img"
                          />
                        ) : (
                          <span className="lottery-summary-item-icon">{p.icon}</span>
                        )}
                      </div>
                      <div className="lottery-summary-item-info">
                        <strong>{p.name}</strong>
                        <small>{p.plantId === 'jalapeno' ? '¡GRAN JACKPOT!' : 'Copias para mazo/jardín'}</small>
                      </div>
                      <span className="lottery-summary-item-qty">+{p.qty}x</span>
                    </div>
                  )
                })}

                {batchSummary.noneCount > 0 && (
                  <div className="lottery-summary-item lottery-summary-item--none">
                    <span className="lottery-summary-item-icon">💨</span>
                    <div className="lottery-summary-item-info">
                      <strong>Sigue Intentando</strong>
                      <small>Tiros sin premio directo</small>
                    </div>
                    <span className="lottery-summary-item-qty">{batchSummary.noneCount}x</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="lottery-prize-claim-btn"
                onClick={() => {
                  soundManager.playSound('victory', 0.6)
                  setShowBatchSummaryModal(false)
                  setBatchResults([])
                  void onRewardsChanged?.()
                }}
              >
                ¡RECOGER TODO EL BOTÍN! 🎉
              </button>
            </div>
          </div>
        )}
        {/* ===================== CONFIRM CODE ATTEMPTS POPUP ===================== */}
        {showConfirmCodeBuyModal && (
          <div className="lottery-prize-overlay" onClick={() => setShowConfirmCodeBuyModal(false)}>
            <div className="lottery-confirm-box" onClick={(e) => e.stopPropagation()}>
              <div className="lottery-confirm-icon">🎯</div>
              <h3>COMPRAR INTENTOS DE CÓDIGO</h3>
              <p>
                ¿Deseas pagar <strong>5 Gemas 💎</strong> para adquirir <strong>1 INTENTO ADICIONAL</strong> y descifrar la secuencia para ganar el <strong>Gran Premio de {top1Amount} {top1CurrencyLabel}</strong>?
              </p>
              <div className="lottery-confirm-balance">
                Saldo actual: <strong>{currentGems} Gemas 💎</strong> (Recibes: +1 Intento)
              </div>
              <div className="lottery-confirm-actions">
                <button
                  type="button"
                  className="lottery-confirm-cancel-btn"
                  onClick={() => setShowConfirmCodeBuyModal(false)}
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  className="lottery-confirm-accept-btn"
                  onClick={() => {
                    setShowConfirmCodeBuyModal(false)
                    handleBuyCodeAttempts()
                  }}
                  disabled={currentGems < 5.0}
                >
                  SÍ, COMPRAR 1 INTENTO (5 💎)
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  )

  if (onBack) {
    return (
      <div className="lottery-screen-view">
        {/* SCREEN HEADER */}
        <div className="lottery-screen-header">
          <button
            type="button"
            className="lottery-screen-back-btn"
            onClick={onBack}
            title="Volver al Menú Principal"
          >
            <span>⬅</span>
            <span>Volver al Menú</span>
          </button>

          <div className="lottery-screen-title-box">
            <span style={{ fontSize: '1.8rem' }}>🎰</span>
            <h2>RULETA & CÓDIGO BOTÁNICO</h2>
          </div>

          <div className="lottery-screen-balances">
            <div className="lottery-screen-balance-tag" title="Monedas de Oro">
              🪙 {(currentGold ?? 0).toLocaleString()} Oro
            </div>
            <div className="lottery-screen-balance-tag" title="Gemas Disponibles">
              💎 {currentGems.toLocaleString()} Gemas
            </div>
            <button
              type="button"
              className="ranking-mute-btn"
              onClick={() => soundManager.toggleMute()}
              title="Silenciar / Activar Sonido"
            >
              🔊
            </button>
          </div>
        </div>

        {innerContent}
      </div>
    )
  }

  return (
    <div className="lottery-backdrop" onClick={onClose}>
      <div className="lottery-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="lottery-header">
          <div className="lottery-header__title-box">
            <span className="lottery-header__icon">🎰</span>
            <div>
              <h2 className="lottery-header__title">RULETA & CÓDIGO BOTÁNICO</h2>
              <p className="lottery-header__subtitle">
                Gira la Ruleta de la Suerte y Descifra el Código Secreto para ganar Gemas 💎 y grandes recompensas
              </p>
            </div>
          </div>

          <div className="lottery-header__right">
            <div className="lottery-user-balance" style={{ borderColor: '#facc15' }}>
              <span>🪙 Oro:</span>
              <strong style={{ color: '#facc15' }}>{(currentGold ?? 0).toLocaleString()}</strong>
            </div>
            <div className="lottery-user-balance">
              <span>💎 Gemas:</span>
              <strong>{currentGems}</strong>
            </div>
            <button type="button" className="lottery-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {innerContent}
      </div>
    </div>
  )
}
