import { describe, it, expect, vi, beforeEach } from 'vitest'
import { storyModeService } from './storyModeService'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    rpc: vi.fn(),
  },
  isSupabaseConfigured: vi.fn(),
}))

describe('storyModeService - Expedición y Recompensas Modo Historia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user-123' } } as any },
      error: null,
    })
  })

  it('1. enterStoryMode invoca enter_story_mode en Supabase y cobra 50 gemas', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, runId: 'story_12345678', newGemsBalance: 200 },
      error: null,
    } as any)

    const res = await storyModeService.enterStoryMode()
    expect(res.success).toBe(true)
    expect(res.runId).toBe('story_12345678')
    expect(res.newGemsBalance).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledWith('enter_story_mode')
  })

  it('2. claimLevelReward acredita 5 tokens base con 3 estrellas sin doradas', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        success: true,
        level: 1,
        stars: 3,
        baseTokens: 5.0,
        goldenCardsCount: 0,
        goldenBonusPct: 0,
        tokensAwarded: 5.0,
        newPlantsBalance: 105.0,
      },
      error: null,
    } as any)

    const res = await storyModeService.claimLevelReward({
      runId: 'story_run_1',
      level: 1,
      stars: 3,
      goldenCardsCount: 0,
    })

    expect(res.success).toBe(true)
    expect(res.tokensAwarded).toBe(5.0)
    expect(supabase.rpc).toHaveBeenCalledWith('claim_story_mode_reward', {
      p_run_id: 'story_run_1',
      p_level: 1,
      p_stars: 3,
      p_golden_cards_count: 0,
    })
  })

  it('3. claimLevelReward aplica bono de cartas doradas (+10% cada una, hasta +60%)', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        success: true,
        level: 5,
        stars: 3,
        baseTokens: 5.0,
        goldenCardsCount: 2,
        goldenBonusPct: 20,
        tokensAwarded: 6.0,
        newPlantsBalance: 111.0,
      },
      error: null,
    } as any)

    const res = await storyModeService.claimLevelReward({
      runId: 'story_run_1',
      level: 5,
      stars: 3,
      goldenCardsCount: 2,
    })

    expect(res.success).toBe(true)
    expect(res.goldenBonusPct).toBe(20)
    expect(res.tokensAwarded).toBe(6.0)
  })

  it('4. claimLevelReward escala a 3 tokens con 2 estrellas y 1 token con 1 estrella', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)

    const res2Stars = await storyModeService.claimLevelReward({
      runId: 'local_run',
      level: 2,
      stars: 2,
      goldenCardsCount: 0,
    })
    expect(res2Stars.tokensAwarded).toBe(3)

    const res1Star = await storyModeService.claimLevelReward({
      runId: 'local_run',
      level: 3,
      stars: 1,
      goldenCardsCount: 0,
    })
    expect(res1Star.tokensAwarded).toBe(1)
  })

  it('5. abandonRun invoca abandon_story_mode_run con el runId', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true },
      error: null,
    } as any)

    const res = await storyModeService.abandonRun('story_run_abandon')
    expect(res.success).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith('abandon_story_mode_run', {
      p_run_id: 'story_run_abandon',
    })
  })
})
