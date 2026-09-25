import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { ArenaAdsLoot } from '../utils/arenaAdsManager'

export interface EnterArenaAdsResult {
  success: boolean
  cost?: number
  currency?: 'gold' | 'gems'
  multiplier?: number
  newGoldBalance?: number
  newGemsBalance?: number
  claimedArenaAdsLevels?: number[]
  error?: string
}

export interface ReviveArenaAdsResult {
  success: boolean
  cost?: number
  newGemsBalance?: number
  error?: string
}

export interface ClaimArenaAdsLootResult {
  success: boolean
  multiplier?: number
  newGoldBalance?: number
  newGemsBalance?: number
  claimedArenaAdsLevels?: number[]
  error?: string
}

export interface ArenaAdsItemStockDef {
  itemId: string
  name: string
  targetPlant: string
  maxStock: number
  remainingStock: number
  claimedCount: number
}

export interface ArenaAdsLeaderboardEntry {
  rank: number
  userId: string
  username: string
  avatar: string
  levelReached: number
  playtimeSeconds: number
  spentGems: boolean
  gemsSpent: number
  revived: boolean
  reviveCount: number
  totalRewards: {
    gold: number
    gems: number
    items?: Partial<Record<string, number>>
  }
  updatedAt: string
}

export const arenaAdsService = {
  /**
   * Valida en el backend y descuenta atómicamente la entrada a Arena ADS:
   * - 350 de Oro (Multiplicador 1x)
   * - 200 Gemas (Multiplicador 2x de botín)
   */
  async enterArenaAds(paymentType: 'gold' | 'gems' = 'gold'): Promise<EnterArenaAdsResult> {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        cost: paymentType === 'gems' ? 200 : 350,
        currency: paymentType,
        multiplier: paymentType === 'gems' ? 2 : 1,
        claimedArenaAdsLevels: [],
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        // Modo local / invitado
        return {
          success: true,
          cost: paymentType === 'gems' ? 200 : 350,
          currency: paymentType,
          multiplier: paymentType === 'gems' ? 2 : 1,
          claimedArenaAdsLevels: [],
        }
      }

      const { data, error } = await (supabase.rpc as any)('enter_arena_ads', {
        p_payment_type: paymentType,
      })
      if (error) {
        console.error('[arenaAdsService] enter_arena_ads error:', error)
        const isInsufficient =
          error.message?.includes('insuficiente') ||
          error.message?.includes('INSUFFICIENT')
        return {
          success: false,
          error: isInsufficient
            ? paymentType === 'gems'
              ? 'Gemas insuficientes para la entrada potenciada (se requieren 200 💎).'
              : 'Oro insuficiente para entrar a la mazmorra (se requieren 350 🪙).'
            : (error.message || 'Error al validar la entrada en el servidor.'),
        }
      }

      return {
        success: true,
        cost: data?.cost ?? (paymentType === 'gems' ? 200 : 350),
        currency: (data?.currency as 'gold' | 'gems') || paymentType,
        multiplier: data?.multiplier ?? (paymentType === 'gems' ? 2 : 1),
        newGoldBalance: data?.new_gold_balance,
        newGemsBalance: data?.new_gems_balance,
        claimedArenaAdsLevels: Array.isArray(data?.claimed_arena_ads_levels) ? data.claimed_arena_ads_levels : [],
      }
    } catch (err: any) {
      console.error('[arenaAdsService] enterArenaAds exception:', err)
      return {
        success: false,
        error: err.message || 'Error de conexión con el servidor.',
      }
    }
  },

  /**
   * Cobra 150 gemas atómicamente en el servidor para revivir en el nivel actual con 1 vida extra.
   */
  async reviveArenaAds(): Promise<ReviveArenaAdsResult> {
    if (!isSupabaseConfigured()) {
      return { success: true, cost: 150 }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        return { success: true, cost: 150 }
      }

      const { data, error } = await (supabase.rpc as any)('revive_arena_ads')
      if (error) {
        console.error('[arenaAdsService] revive_arena_ads error:', error)
        const isInsufficient =
          error.message?.includes('insuficiente') ||
          error.message?.includes('INSUFFICIENT')
        return {
          success: false,
          error: isInsufficient
            ? 'Gemas insuficientes para revivir (se requieren 150 💎).'
            : (error.message || 'Error al procesar la resurrección en el servidor.'),
        }
      }

      return {
        success: true,
        cost: data?.cost ?? 150,
        newGemsBalance: data?.new_gems_balance,
      }
    } catch (err: any) {
      console.error('[arenaAdsService] reviveArenaAds exception:', err)
      return {
        success: false,
        error: err.message || 'Error de conexión con el servidor.',
      }
    }
  },

  /**
   * Reclama el botín acumulado de la mazmorra acreditándolo en la base de datos con multiplicador
   * y consolidando permanentemente los pisos superados en claimed_arena_ads_levels.
   */
  async claimLoot(
    loot: ArenaAdsLoot,
    multiplier: number = 1,
    claimedLevels: number[] = []
  ): Promise<ClaimArenaAdsLootResult> {
    if (!isSupabaseConfigured()) {
      return { success: true, multiplier, claimedArenaAdsLevels: claimedLevels }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        return { success: true, multiplier, claimedArenaAdsLevels: claimedLevels }
      }

      const { data, error } = await (supabase.rpc as any)('claim_arena_ads_loot', {
        p_gold: loot.gold || 0,
        p_gems: loot.gems || 0,
        p_items: loot.items || {},
        p_multiplier: multiplier || 1,
        p_claimed_levels: claimedLevels,
      })

      if (error) {
        console.error('[arenaAdsService] claim_arena_ads_loot error:', error)
        return { success: false, error: error.message }
      }

      return {
        success: true,
        multiplier: data?.multiplier ?? multiplier,
        newGoldBalance: data?.new_gold_balance,
        newGemsBalance: data?.new_gems_balance,
        claimedArenaAdsLevels: Array.isArray(data?.claimed_arena_ads_levels) ? data.claimed_arena_ads_levels : claimedLevels,
      }
    } catch (err: any) {
      console.error('[arenaAdsService] claimLoot exception:', err)
      return { success: false, error: err.message }
    }
  },

  /**
   * Obtiene el stock disponible de los ítems exclusivos de Arena ADS (máximo 5 de cada uno)
   */
  async getStock(): Promise<Record<string, ArenaAdsItemStockDef>> {
    if (!isSupabaseConfigured()) {
      return {}
    }

    try {
      const { data, error } = await (supabase.rpc as any)('get_arena_ads_stock')
      if (error) {
        console.error('[arenaAdsService] get_arena_ads_stock error:', error)
        return {}
      }
      return (data as Record<string, ArenaAdsItemStockDef>) || {}
    } catch (err) {
      console.error('[arenaAdsService] getStock exception:', err)
      return {}
    }
  },

  /**
   * Obtiene la tabla de líderes de Arena ADS ordenada por nivel alcanzado
   */
  async getLeaderboard(limit = 50): Promise<ArenaAdsLeaderboardEntry[]> {
    if (!isSupabaseConfigured()) {
      return []
    }

    try {
      const { data, error } = await (supabase.rpc as any)('get_arena_ads_leaderboard', {
        p_limit: limit,
      })
      if (error) {
        console.error('[arenaAdsService] get_arena_ads_leaderboard error:', error)
        return []
      }
      return (data as ArenaAdsLeaderboardEntry[]) || []
    } catch (err) {
      console.error('[arenaAdsService] getLeaderboard exception:', err)
      return []
    }
  },

  /**
   * Registra o actualiza el récord personal del usuario en Arena ADS
   */
  async recordRun(params: {
    level: number
    playtimeSeconds?: number
    spentGems?: boolean
    gemsSpent?: number
    revived?: boolean
    reviveCount?: number
    totalRewards?: { gold: number; gems: number; items?: Partial<Record<string, number>> }
    status?: 'completed' | 'active' | 'retired'
  }): Promise<{ success: boolean; newBest?: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: true }
    }

    try {
      const { data, error } = await (supabase.rpc as any)('record_arena_ads_run', {
        p_level: params.level,
        p_playtime_seconds: params.playtimeSeconds || 0,
        p_spent_gems: Boolean(params.spentGems),
        p_gems_spent: params.gemsSpent || 0,
        p_revived: Boolean(params.revived),
        p_revive_count: params.reviveCount || 0,
        p_total_rewards: params.totalRewards || { gold: 0, gems: 0, items: {} },
        p_status: params.status || 'completed',
      })

      if (error) {
        console.error('[arenaAdsService] record_arena_ads_run error:', error)
        return { success: false, error: error.message }
      }

      return {
        success: Boolean(data?.success),
        newBest: Boolean(data?.new_best),
      }
    } catch (err: any) {
      console.error('[arenaAdsService] recordRun exception:', err)
      return { success: false, error: err?.message || 'Error al registrar récord' }
    }
  },
}
