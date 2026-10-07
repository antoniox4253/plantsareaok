import type {
  PlantsMarketState,
  PlantsPriceHistoryPoint,
  PlantsVestingSummary,
  PresalePackDefinition,
} from '../../services/plantsTokenService'

export type TokenTabType = 'summary' | 'presale' | 'vesting' | 'staking' | 'swap' | 'tokenomics' | 'guide'
export type Timeframe = '1H' | '24H' | '7D' | 'ALL'

export interface TokenHubSharedProps {
  userTokens: number // Gemas
  userGold: number
  userElo: number
  hasVipPass: boolean
  userProfile?: {
    id?: string
    username?: string
    plants_balance?: number
    plants_vesting_locked?: number
    last_plants_cashout_at?: string | null
    elo_rating?: number
    gems_balance?: number
  } | null
  marketState: PlantsMarketState | null
  priceHistory: PlantsPriceHistoryPoint[]
  vestingSummary: PlantsVestingSummary | null
  countdownSeconds: number
  isSubmitting: boolean
  isClaimingVesting: boolean
  liquidPlants: number
  lockedVestingPlants: number
  totalPlants: number
  spotPrice: number
  poolUsdt: number
  virtualPlants: number
  totalBurned: number
  totalMinted: number
  circulating: number
  isArena3Plus: boolean
  onTabChange: (tab: TokenTabType) => void
  onBuyPack: (pack: PresalePackDefinition) => Promise<void>
  onClaimDailyVesting: () => Promise<void>
  onSwapToGems: (amount: number) => Promise<void>
  onCashoutUsdt: (amount: number, wallet: string) => Promise<void>
  onRefreshData: () => Promise<void>
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void
}
