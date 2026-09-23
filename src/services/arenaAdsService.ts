import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { ArenaAdsLoot } from '../utils/arenaAdsManager'

export interface EnterArenaAdsResult {
  success: boolean
  cost?: number
  newGoldBalance?: number
  error?: string
}

export interface ClaimArenaAdsLootResult {
  success: boolean
  newGoldBalance?: number
  newGemsBalance?: number
  error?: string
}

export const arenaAdsService = {
  /**
   * Valida en el backend y descuenta atómicamente 100 de Oro de profiles.gold_balance
   */
  async enterArenaAds(): Promise<EnterArenaAdsResult> {
    if (!isSupabaseConfigured()) {
      return { success: true }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        // Modo local / invitado
        return { success: true }
      }

      const { data, error } = await (supabase.rpc as any)('enter_arena_ads')
      if (error) {
        console.error('[arenaAdsService] enter_arena_ads error:', error)
        const isInsufficient =
          error.message?.includes('INSUFFICIENT_GOLD') ||
          error.message?.includes('insuficiente')
        return {
          success: false,
          error: isInsufficient
            ? 'No tienes suficiente Oro en tu cuenta (se requieren 100 🪙).'
            : (error.message || 'Error al validar la entrada en el servidor.'),
        }
      }

      return {
        success: true,
        cost: data?.cost ?? 100,
        newGoldBalance: data?.new_gold_balance,
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
   * Reclama el botín acumulado de la mazmorra acreditándolo en la base de datos
   */
  async claimLoot(loot: ArenaAdsLoot): Promise<ClaimArenaAdsLootResult> {
    if (!isSupabaseConfigured()) {
      return { success: true }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        return { success: true }
      }

      const { data, error } = await (supabase.rpc as any)('claim_arena_ads_loot', {
        p_gold: loot.gold || 0,
        p_gems: loot.gems || 0,
        p_items: loot.items || {},
      })

      if (error) {
        console.error('[arenaAdsService] claim_arena_ads_loot error:', error)
        return { success: false, error: error.message }
      }

      return {
        success: true,
        newGoldBalance: data?.new_gold_balance,
        newGemsBalance: data?.new_gems_balance,
      }
    } catch (err: any) {
      console.error('[arenaAdsService] claimLoot exception:', err)
      return { success: false, error: err.message }
    }
  },
}
