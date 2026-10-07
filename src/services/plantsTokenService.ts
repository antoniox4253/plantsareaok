import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface PlantsMarketState {
  spotPrice: number
  usdtPool: number
  virtualPlants: number
  totalMinted: number
  totalBurned: number
  circulatingSupply: number
  marketCapUsdt: number
  currentHalvingEra: number
  presaleActive: boolean
  pvpBonusEndsAt: string | null
  pvpBonusPct: number
  presaleStocks: {
    pionero: number
    campeon: number
    leyenda: number
  }
}

export interface PlantsPriceHistoryPoint {
  id: number
  spot_price: number
  usdt_pool: number
  event_type: string
  delta_usdt: number
  delta_plants: number
  created_at: string
}

export interface PlantsVestingOrder {
  id: string
  packId: string
  priceUsdt: number
  plantsAmount: number
  gemsAmount: number
  vestingDailyRate: number
  vestingDaysTotal: number
  vestingClaimedDays: number
  daysElapsed: number
  claimableDays: number
  claimablePlants: number
  isCompleted: boolean
  createdAt: string
  secondsToNextUnlock: number
}

export interface PlantsVestingSummary {
  liquidBalance: number
  vestingLocked: number
  totalPlants: number
  claimablePlantsNow: number
  dailyAccrualRate: number
  activeOrdersCount: number
  secondsToNextUnlock: number
  orders: PlantsVestingOrder[]
}

export interface PresalePackDefinition {
  id: 'pack_pionero_10' | 'pack_campeon_25' | 'pack_leyenda_50'
  name: string
  title: string
  priceUsdt: number
  gemsPrice: number
  plantsAmount: number
  gemsReward: number
  dailyRate: number
  vestingDays: number
  maxStock: number
  bonusItemTitle: string
  bonusItemDesc: string
  accentColor: string
  tag: string
  popular?: boolean
}

export const PRESALE_PACKS: PresalePackDefinition[] = [
  {
    id: 'pack_pionero_10',
    name: 'Pack Pionero',
    title: 'Pionero Fundador',
    priceUsdt: 10,
    gemsPrice: 1000,
    plantsAmount: 2500,
    gemsReward: 600,
    dailyRate: 55.56,
    vestingDays: 45,
    maxStock: 10,
    bonusItemTitle: '1 Sobre Épico + 500 Abono',
    bonusItemDesc: 'Impulso directo para tu jardín y colección.',
    accentColor: '#38bdf8',
    tag: 'BRONCE',
  },
  {
    id: 'pack_campeon_25',
    name: 'Pack Campeón',
    title: 'Campeón Fundador',
    priceUsdt: 25,
    gemsPrice: 2500,
    plantsAmount: 7500,
    gemsReward: 1800,
    dailyRate: 166.67,
    vestingDays: 45,
    maxStock: 6,
    bonusItemTitle: '1 Sobre Legendario + 1,500 Abono',
    bonusItemDesc: 'Cartas legendarias y recursos de alta velocidad.',
    accentColor: '#a855f7',
    tag: 'MÁS POPULAR',
    popular: true,
  },
  {
    id: 'pack_leyenda_50',
    name: 'Pack Leyenda',
    title: 'Titán Legendario',
    priceUsdt: 50,
    gemsPrice: 5000,
    plantsAmount: 15000,
    gemsReward: 4000,
    dailyRate: 333.33,
    vestingDays: 45,
    maxStock: 4,
    bonusItemTitle: '2 Sobres Legendarios + 4,000 Abono + Título Exclusivo',
    bonusItemDesc: 'Máxima asignación inicial y título "Titán Fundador".',
    accentColor: '#fbbf24',
    tag: 'EDICIÓN ORO',
  },
]

export interface HalvingTierInfo {
  tier: number
  range: string
  rewardPct: string
  rewardPerMatch: string
  status: 'active' | 'upcoming' | 'completed'
}

export const HALVING_TIERS: HalvingTierInfo[] = [
  {
    tier: 1,
    range: '0 → 500,000 PLANTS',
    rewardPct: '100%',
    rewardPerMatch: '2.0 - 6.0 PLANTS',
    status: 'active',
  },
  {
    tier: 2,
    range: '500,000 → 750,000 PLANTS',
    rewardPct: '50%',
    rewardPerMatch: '1.0 - 3.0 PLANTS',
    status: 'upcoming',
  },
  {
    tier: 3,
    range: '750,000 → 875,000 PLANTS',
    rewardPct: '25%',
    rewardPerMatch: '0.5 - 1.5 PLANTS',
    status: 'upcoming',
  },
  {
    tier: 4,
    range: '875,000 → 937,500 PLANTS',
    rewardPct: '12.5%',
    rewardPerMatch: '0.25 - 0.75 PLANTS',
    status: 'upcoming',
  },
  {
    tier: 5,
    range: '937,500 → 1,000,000 PLANTS',
    rewardPct: '6.25%',
    rewardPerMatch: '0.12 - 0.37 PLANTS',
    status: 'upcoming',
  },
]

export const plantsTokenService = {
  /**
   * Obtiene el estado consolidado de la curva AMM, reservas de liquidez y stocks de preventa
   */
  async getMarketState(): Promise<PlantsMarketState | null> {
    if (!isSupabaseConfigured()) {
      return this.getFallbackMarketState()
    }

    try {
      const { data, error } = await supabase.rpc('get_plants_market_state')
      if (error) {
        console.warn('[plantsTokenService] getMarketState error:', error.message)
        return this.getFallbackMarketState()
      }

      if (data) {
        const d = data as any
        return {
          spotPrice: Number(d.spotPrice ?? 0.0002),
          usdtPool: Number(d.usdtPool ?? 200),
          virtualPlants: Number(d.virtualPlants ?? 1000000),
          totalMinted: Number(d.totalMinted ?? 0),
          totalBurned: Number(d.totalBurned ?? 0),
          circulatingSupply: Number(d.circulatingSupply ?? 0),
          marketCapUsdt: Number(d.marketCapUsdt ?? 40),
          currentHalvingEra: Number(d.currentHalvingEra ?? 1),
          presaleActive: Boolean(d.presaleActive ?? true),
          pvpBonusEndsAt: d.pvpBonusEndsAt ? String(d.pvpBonusEndsAt) : null,
          pvpBonusPct: Number(d.pvpBonusPct ?? 25),
          presaleStocks: {
            pionero: Number(d.presaleStocks?.pionero ?? 10),
            campeon: Number(d.presaleStocks?.campeon ?? 6),
            leyenda: Number(d.presaleStocks?.leyenda ?? 4),
          },
        }
      }
      return this.getFallbackMarketState()
    } catch (e) {
      console.warn('[plantsTokenService] getMarketState exception:', e)
      return this.getFallbackMarketState()
    }
  },

  /**
   * Historial de eventos / precios para renderizar velas y curva
   */
  async getPriceHistory(limit = 100): Promise<PlantsPriceHistoryPoint[]> {
    if (!isSupabaseConfigured()) {
      return this.getFallbackPriceHistory()
    }

    try {
      const { data, error } = await (supabase.rpc as any)('get_plants_price_history', { p_limit: limit })
      if (error) {
        console.warn('[plantsTokenService] getPriceHistory error:', error.message)
        return this.getFallbackPriceHistory()
      }
      if (Array.isArray(data) && data.length > 0) {
        return data.map((d: any) => ({
          id: Number(d.id),
          spot_price: Number(d.spot_price),
          usdt_pool: Number(d.usdt_pool),
          event_type: String(d.event_type),
          delta_usdt: Number(d.delta_usdt ?? 0),
          delta_plants: Number(d.delta_plants ?? 0),
          created_at: String(d.created_at),
        }))
      }
      return this.getFallbackPriceHistory()
    } catch (e) {
      console.warn('[plantsTokenService] getPriceHistory exception:', e)
      return this.getFallbackPriceHistory()
    }
  },

  /**
   * Compra de Pack de Preventa (descuenta Gemas o registra pago USDT)
   */
  async buyPresalePack(
    packId: string,
    paymentMethod: 'gems' | 'usdt' = 'gems'
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase no configurado' }
    }

    try {
      const { data, error } = await (supabase.rpc as any)('buy_plants_presale_pack', {
        p_pack_id: packId,
        p_payment_method: paymentMethod,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      window.dispatchEvent(new CustomEvent('refresh_user_balance'))
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al procesar compra del pack' }
    }
  },

  /**
   * Intercambio instantáneo de PLANTS a Gemas (+20% Super Sink)
   */
  async swapPlantsForGems(
    plantsAmount: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase no configurado' }
    }

    try {
      const { data, error } = await (supabase.rpc as any)('swap_plants_for_gems', {
        p_amount: plantsAmount,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      window.dispatchEvent(new CustomEvent('refresh_user_balance'))
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al canjear PLANTS por Gemas' }
    }
  },

  /**
   * Solicitud de Cash-out de PLANTS a USDT BEP20
   */
  async requestCashout(
    plantsAmount: number,
    walletAddress: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase no configurado' }
    }

    try {
      const { data, error } = await (supabase.rpc as any)('request_plants_cashout', {
        p_amount: plantsAmount,
        p_wallet: walletAddress,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      window.dispatchEvent(new CustomEvent('refresh_user_balance'))
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al procesar el retiro en USDT' }
    }
  },

  /**
   * Reclamo de PLANTS tras victoria PvP en Arena 3+
   */
  async claimPvpPlantsReward(params: {
    roomId: string
    matchDurationSec: number
    enemyKills: number
    sunsCollected: number
    plantsPlaced: number
    enemyPlantsPlaced: number
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase no configurado' }
    }

    try {
      const { data, error } = await (supabase.rpc as any)('claim_pvp_plants_reward', {
        p_room_id: params.roomId,
        p_match_duration_sec: params.matchDurationSec,
        p_enemy_kills: params.enemyKills,
        p_suns_collected: params.sunsCollected,
        p_plants_placed: params.plantsPlaced,
        p_enemy_plants_placed: params.enemyPlantsPlaced,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      window.dispatchEvent(new CustomEvent('refresh_user_balance'))
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al reclamar PLANTS de combate' }
    }
  },

  /**
   * Obtiene el resumen de vesting del jugador (tokens bloqueados, tasa diaria, órdenes y tokens reclamables)
   */
  async getUserVestingSummary(): Promise<PlantsVestingSummary | null> {
    if (!isSupabaseConfigured()) {
      return {
        liquidBalance: 0,
        vestingLocked: 0,
        totalPlants: 0,
        claimablePlantsNow: 0,
        dailyAccrualRate: 0,
        activeOrdersCount: 0,
        secondsToNextUnlock: 0,
        orders: [],
      }
    }

    try {
      const { data, error } = await (supabase.rpc as any)('get_user_plants_vesting_summary')
      if (error) {
        console.warn('[plantsTokenService] getUserVestingSummary error:', error.message)
        return null
      }
      if (data) {
        const d = data as any
        return {
          liquidBalance: Number(d.liquidBalance ?? 0),
          vestingLocked: Number(d.vestingLocked ?? 0),
          totalPlants: Number(d.totalPlants ?? 0),
          claimablePlantsNow: Number(d.claimablePlantsNow ?? 0),
          dailyAccrualRate: Number(d.dailyAccrualRate ?? 0),
          activeOrdersCount: Number(d.activeOrdersCount ?? 0),
          secondsToNextUnlock: Number(d.secondsToNextUnlock ?? 0),
          orders: Array.isArray(d.orders)
            ? d.orders.map((o: any) => ({
                id: String(o.id),
                packId: String(o.packId),
                priceUsdt: Number(o.priceUsdt ?? 0),
                plantsAmount: Number(o.plantsAmount ?? 0),
                gemsAmount: Number(o.gemsAmount ?? 0),
                vestingDailyRate: Number(o.vestingDailyRate ?? 0),
                vestingDaysTotal: Number(o.vestingDaysTotal ?? 45),
                vestingClaimedDays: Number(o.vestingClaimedDays ?? 0),
                daysElapsed: Number(o.daysElapsed ?? 0),
                claimableDays: Number(o.claimableDays ?? 0),
                claimablePlants: Number(o.claimablePlants ?? 0),
                isCompleted: Boolean(o.isCompleted),
                createdAt: String(o.createdAt),
                secondsToNextUnlock: Number(o.secondsToNextUnlock ?? 0),
              }))
            : [],
        }
      }
      return null
    } catch (e) {
      console.warn('[plantsTokenService] getUserVestingSummary exception:', e)
      return null
    }
  },

  /**
   * Reclama los tokens que se han liberado de vesting hasta la fecha
   */
  async claimDailyVestingPlants(): Promise<{
    success: boolean
    unlockedPlants?: number
    newLiquidBalance?: number
    remainingVestingLocked?: number
    error?: string
  }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase no configurado' }
    }

    try {
      const { data, error } = await (supabase.rpc as any)('claim_daily_vesting_plants')
      if (error) {
        return { success: false, error: error.message }
      }
      const d = data as any
      if (!d?.success) {
        return { success: false, error: d?.error || 'No fue posible reclamar tokens en este momento' }
      }

      window.dispatchEvent(new CustomEvent('refresh_user_balance'))
      return {
        success: true,
        unlockedPlants: Number(d.unlockedPlants ?? 0),
        newLiquidBalance: Number(d.newLiquidBalance ?? 0),
        remainingVestingLocked: Number(d.remainingVestingLocked ?? 0),
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al reclamar liberación de vesting' }
    }
  },

  // Fallbacks de desarrollo
  getFallbackMarketState(): PlantsMarketState {
    return {
      spotPrice: 0.0002,
      usdtPool: 200,
      virtualPlants: 1000000,
      totalMinted: 0,
      totalBurned: 0,
      circulatingSupply: 0,
      marketCapUsdt: 40,
      currentHalvingEra: 1,
      presaleActive: true,
      pvpBonusEndsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      pvpBonusPct: 25,
      presaleStocks: {
        pionero: 10,
        campeon: 6,
        leyenda: 4,
      },
    }
  },

  /**
   * Calcula el tiempo restante del bono PvP de lanzamiento (primeros 7 días)
   */
  getPvpBonusTimeRemaining(endsAt: string | null): {
    isActive: boolean
    days: number
    hours: number
    minutes: number
    seconds: number
    formatted: string
  } {
    if (!endsAt) {
      return { isActive: false, days: 0, hours: 0, minutes: 0, seconds: 0, formatted: 'Finalizado' }
    }
    const diff = new Date(endsAt).getTime() - Date.now()
    if (diff <= 0) {
      return { isActive: false, days: 0, hours: 0, minutes: 0, seconds: 0, formatted: 'Finalizado' }
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    const formatted = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
    return { isActive: true, days, hours, minutes, seconds, formatted }
  },

  getFallbackPriceHistory(): PlantsPriceHistoryPoint[] {
    const now = Date.now()
    return [
      {
        id: 1,
        spot_price: 0.0002,
        usdt_pool: 200,
        event_type: 'genesis',
        delta_usdt: 200,
        delta_plants: 0,
        created_at: new Date(now - 3600000 * 24).toISOString(),
      },
    ]
  },
}
