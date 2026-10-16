import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface EnterSurvivorAdsResult {
  success: boolean
  cost?: number
  currency?: 'gems'
  newGemsBalance?: number
  newLockedGemsBalance?: number
  error?: string
}

export interface ClaimSurvivorAdsLootResult {
  success: boolean
  levelsCleared?: number
  tokensAwarded?: number
  basicPacksAwarded?: number
  rareCardsAwarded?: number
  rareCardIds?: string[]
  newPlantsBalance?: number
  error?: string
}

export const survivorAdsService = {
  /**
   * Valida en el backend y descuenta atómicamente la entrada a Survivor ADS (50 Gemas 💎)
   */
  async enterSurvivorAds(): Promise<EnterSurvivorAdsResult> {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        cost: 50,
        currency: 'gems',
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        return {
          success: true,
          cost: 50,
          currency: 'gems',
        }
      }

      const { data, error } = await (supabase.rpc as any)('enter_survivor_ads')
      if (error) {
        console.error('[survivorAdsService] enter_survivor_ads error:', error)
        const isInsufficient =
          error.message?.includes('insuficiente') ||
          error.message?.includes('INSUFFICIENT')
        return {
          success: false,
          error: isInsufficient
            ? 'Gemas insuficientes para entrar a Survivor ADS. Se requieren 50 💎 Gemas.'
            : (error.message || 'Error al validar la entrada en el servidor.'),
        }
      }

      if (data && data.success === false) {
        return {
          success: false,
          error: data.error || 'Gemas insuficientes para entrar a Survivor ADS. Se requieren 50 💎 Gemas.',
        }
      }

      return {
        success: true,
        cost: data?.cost ?? 50,
        currency: 'gems',
        newGemsBalance: data?.newGemsBalance,
        newLockedGemsBalance: data?.newLockedGemsBalance,
      }
    } catch (err: any) {
      console.error('[survivorAdsService] enterSurvivorAds exception:', err)
      return {
        success: false,
        error: err.message || 'Error de conexión con el servidor.',
      }
    }
  },

  /**
   * Reclama el botín acumulado de Survivor ADS en el backend:
   * - 2 Token PLANTS por cada nivel superado (minteo auditable en plants_price_history y plants_balance)
   * - 1 Sobre Básico cada 10 niveles en player_packs
   * - 1 Carta Rara aleatoria cada 25 niveles en plant_instances (sin Jalapeño ni Nuez Explosiva)
   */
  async claimLoot(
    levelsCleared: number,
    runId?: string
  ): Promise<ClaimSurvivorAdsLootResult> {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        levelsCleared,
        tokensAwarded: levelsCleared * 2,
        basicPacksAwarded: Math.floor(levelsCleared / 10),
        rareCardsAwarded: Math.floor(levelsCleared / 25),
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        return {
          success: true,
          levelsCleared,
          tokensAwarded: levelsCleared * 2,
          basicPacksAwarded: Math.floor(levelsCleared / 10),
          rareCardsAwarded: Math.floor(levelsCleared / 25),
        }
      }

      const { data, error } = await (supabase.rpc as any)('claim_survivor_ads_loot', {
        p_levels_cleared: levelsCleared,
        p_run_id: runId || null,
      })

      if (error) {
        console.error('[survivorAdsService] claim_survivor_ads_loot error:', error)
        return { success: false, error: error.message }
      }

      return {
        success: true,
        levelsCleared: data?.levelsCleared ?? levelsCleared,
        tokensAwarded: data?.tokensAwarded ?? (levelsCleared * 2),
        basicPacksAwarded: data?.basicPacksAwarded ?? Math.floor(levelsCleared / 10),
        rareCardsAwarded: data?.rareCardsAwarded ?? Math.floor(levelsCleared / 25),
        rareCardIds: Array.isArray(data?.rareCardIds) ? data.rareCardIds : [],
        newPlantsBalance: data?.newPlantsBalance,
      }
    } catch (err: any) {
      console.error('[survivorAdsService] claimLoot exception:', err)
      return { success: false, error: err.message }
    }
  },

  /**
   * Obtiene la tabla de clasificación de Survivor ADS ordenada por nivel alcanzado
   */
  async getLeaderboard(limit = 50): Promise<any[]> {
    if (!isSupabaseConfigured()) {
      return []
    }

    try {
      const { data, error } = await (supabase.rpc as any)('get_survivor_ads_leaderboard', {
        p_limit: limit,
      })
      if (error) {
        console.error('[survivorAdsService] get_survivor_ads_leaderboard error:', error)
        return []
      }
      return (data as any[]) || []
    } catch (err) {
      console.error('[survivorAdsService] getLeaderboard exception:', err)
      return []
    }
  },

  /**
   * Registra o actualiza el récord personal del usuario en Survivor ADS
   */
  async recordRun(params: {
    level: number
    playtimeSeconds?: number
    spentGems?: boolean
    gemsSpent?: number
    revived?: boolean
    reviveCount?: number
    totalRewards?: {
      gold?: number
      gems?: number
      items?: Partial<Record<string, number>>
      tokenPlants?: number
      basicPacks?: number
      rareCards?: number
    }
    status?: 'completed' | 'active' | 'retired'
  }): Promise<{ success: boolean; newBest?: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: true }
    }

    try {
      const { data, error } = await (supabase.rpc as any)('record_survivor_ads_run', {
        p_level: params.level,
        p_playtime_seconds: params.playtimeSeconds || 0,
        p_spent_gems: params.spentGems ?? true,
        p_gems_spent: params.gemsSpent ?? 50,
        p_revived: params.revived ?? false,
        p_revive_count: params.reviveCount || 0,
        p_total_rewards: params.totalRewards || {
          tokenPlants: params.level * 2,
          basicPacks: Math.floor(params.level / 10),
          rareCards: Math.floor(params.level / 25),
        },
        p_status: params.status || 'completed',
      })

      if (error) {
        console.error('[survivorAdsService] record_survivor_ads_run error:', error)
        return { success: false, error: error.message }
      }

      return {
        success: Boolean(data?.success),
        newBest: Boolean(data?.new_best),
      }
    } catch (err: any) {
      console.error('[survivorAdsService] recordRun exception:', err)
      return { success: false, error: err?.message || 'Error al registrar récord' }
    }
  },
}

