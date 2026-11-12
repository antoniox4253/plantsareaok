import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface EnterStoryModeResult {
  success: boolean
  runId?: string
  newGemsBalance?: number
  error?: string
}

export interface ClaimStoryLevelRewardResult {
  success: boolean
  level?: number
  stars?: number
  baseTokens?: number
  goldenCardsCount?: number
  goldenBonusPct?: number
  tokensAwarded?: number
  newPlantsBalance?: number
  alreadyClaimed?: boolean
  error?: string
}

export const storyModeService = {
  /**
   * Descuenta autoritativamente 50 gemas en Supabase y crea una nueva expedición de Modo Historia.
   */
  async enterStoryMode(): Promise<EnterStoryModeResult> {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        runId: `local_story_${Date.now()}`,
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        return {
          success: true,
          runId: `local_story_${Date.now()}`,
        }
      }

      const { data, error } = await (supabase.rpc as any)('enter_story_mode')
      if (error) {
        console.error('[storyModeService] enter_story_mode error:', error)
        const isInsufficient =
          error.message?.includes('insuficiente') || error.message?.includes('INSUFFICIENT')
        return {
          success: false,
          error: isInsufficient
            ? 'Gemas insuficientes para entrar al Modo Historia. Se requieren 50 💎 Gemas.'
            : (error.message || 'Error al validar la entrada en el servidor.'),
        }
      }

      if (data && data.success === false) {
        return {
          success: false,
          error: data.error || 'No se pudo iniciar la expedición.',
        }
      }

      return {
        success: true,
        runId: data.runId,
        newGemsBalance: data.newGemsBalance,
      }
    } catch (err: any) {
      console.error('[storyModeService] enterStoryMode exception:', err)
      return {
        success: false,
        error: err?.message || 'Error de conexión al iniciar Modo Historia.',
      }
    }
  },

  /**
   * Reclama y liquida atómicamente el botín de un nivel superado (Tokens PLANTS + Bono Doradas).
   */
  async claimLevelReward(params: {
    runId: string
    level: number
    stars: number
    goldenCardsCount?: number
  }): Promise<ClaimStoryLevelRewardResult> {
    if (!isSupabaseConfigured()) {
      const base = params.stars === 3 ? 5 : params.stars === 2 ? 3 : 1
      const goldenBonus = Math.min(6, params.goldenCardsCount || 0) * 10
      const total = Number((base * (1 + goldenBonus / 100)).toFixed(2))
      return {
        success: true,
        level: params.level,
        stars: params.stars,
        baseTokens: base,
        goldenCardsCount: params.goldenCardsCount || 0,
        goldenBonusPct: goldenBonus,
        tokensAwarded: total,
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.user) {
        const base = params.stars === 3 ? 5 : params.stars === 2 ? 3 : 1
        const goldenBonus = Math.min(6, params.goldenCardsCount || 0) * 10
        const total = Number((base * (1 + goldenBonus / 100)).toFixed(2))
        return {
          success: true,
          level: params.level,
          stars: params.stars,
          baseTokens: base,
          goldenCardsCount: params.goldenCardsCount || 0,
          goldenBonusPct: goldenBonus,
          tokensAwarded: total,
        }
      }

      const { data, error } = await (supabase.rpc as any)('claim_story_mode_reward', {
        p_run_id: params.runId,
        p_level: params.level,
        p_stars: params.stars,
        p_golden_cards_count: params.goldenCardsCount || 0,
      })

      if (error) {
        console.error('[storyModeService] claim_story_mode_reward error:', error)
        return {
          success: false,
          error: error.message || 'Error al reclamar botín del nivel.',
        }
      }

      if (data && data.success === false) {
        return {
          success: false,
          alreadyClaimed: Boolean(data.alreadyClaimed),
          error: data.error || 'No se pudo acreditar la recompensa.',
        }
      }

      return {
        success: true,
        level: data.level,
        stars: data.stars,
        baseTokens: data.baseTokens,
        goldenCardsCount: data.goldenCardsCount,
        goldenBonusPct: data.goldenBonusPct,
        tokensAwarded: data.tokensAwarded,
        newPlantsBalance: data.newPlantsBalance,
      }
    } catch (err: any) {
      console.error('[storyModeService] claimLevelReward exception:', err)
      return {
        success: false,
        error: err?.message || 'Error de conexión al reclamar recompensa.',
      }
    }
  },

  /**
   * Marca la expedición como abandonada en backend.
   */
  async abandonRun(runId: string): Promise<{ success: boolean }> {
    if (!isSupabaseConfigured() || !runId) return { success: true }
    try {
      await (supabase.rpc as any)('abandon_story_mode_run', { p_run_id: runId })
      return { success: true }
    } catch (err) {
      console.warn('[storyModeService] abandonRun exception:', err)
      return { success: true }
    }
  },
}
