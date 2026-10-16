import { describe, it, expect, vi, beforeEach } from 'vitest'
import { survivorAdsService } from './survivorAdsService'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

vi.mock('../lib/supabaseClient', () => {
  return {
    isSupabaseConfigured: vi.fn(),
    supabase: {
      auth: {
        getSession: vi.fn(),
      },
      rpc: vi.fn(),
    },
  }
})

describe('survivorAdsService (Validación de Backend, Minteo de PLANTS y Leaderboard)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. En modo offline permite jugar localmente con coste predeterminado', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    const res = await survivorAdsService.enterSurvivorAds()
    expect(res.success).toBe(true)
    expect(res.cost).toBe(50)
    expect(res.currency).toBe('gems')

    const claimRes = await survivorAdsService.claimLoot(5)
    expect(claimRes.success).toBe(true)
    expect(claimRes.tokensAwarded).toBe(10)
    expect(claimRes.basicPacksAwarded).toBe(0)
    expect(claimRes.rareCardsAwarded).toBe(0)
  })

  it('2. enterSurvivorAds descuenta 50 Gemas atómicamente si el backend responde con éxito', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, cost: 50, currency: 'gems', newGemsBalance: 450, newLockedGemsBalance: 0 },
      error: null,
    } as any)

    const res = await survivorAdsService.enterSurvivorAds()
    expect(res.success).toBe(true)
    expect(res.cost).toBe(50)
    expect(res.newGemsBalance).toBe(450)
    expect(supabase.rpc).toHaveBeenCalledWith('enter_survivor_ads')
  })

  it('3. enterSurvivorAds rechaza la entrada si el usuario no tiene 50 Gemas', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: false, error: 'Gemas insuficientes para entrar a Survivor ADS. Se requieren 50 💎 Gemas.' },
      error: null,
    } as any)

    const res = await survivorAdsService.enterSurvivorAds()
    expect(res.success).toBe(false)
    expect(res.error).toContain('50 💎 Gemas')
  })

  it('4. claimLoot invoca claim_survivor_ads_loot y devuelve los Token PLANTS acreditados', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        success: true,
        levelsCleared: 10,
        tokensAwarded: 20,
        basicPacksAwarded: 1,
        rareCardsAwarded: 0,
        rareCardIds: [],
        newPlantsBalance: 25.5,
      },
      error: null,
    } as any)

    const res = await survivorAdsService.claimLoot(10, 'run-abc')
    expect(res.success).toBe(true)
    expect(res.levelsCleared).toBe(10)
    expect(res.tokensAwarded).toBe(20)
    expect(res.basicPacksAwarded).toBe(1)
    expect(res.newPlantsBalance).toBe(25.5)
    expect(supabase.rpc).toHaveBeenCalledWith('claim_survivor_ads_loot', {
      p_levels_cleared: 10,
      p_run_id: 'run-abc',
    })
  })

  it('5. getLeaderboard invoca get_survivor_ads_leaderboard y devuelve lista de supervivientes', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    const mockLeaderboard = [
      {
        rank: 1,
        userId: 'u1',
        username: 'ProSurvivor',
        avatar: 'bonkchoy',
        levelReached: 25,
        playtimeSeconds: 600,
        totalRewards: { tokenPlants: 50, basicPacks: 2, rareCards: 1 },
      },
    ]

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: mockLeaderboard,
      error: null,
    } as any)

    const res = await survivorAdsService.getLeaderboard(10)
    expect(res).toEqual(mockLeaderboard)
    expect(supabase.rpc).toHaveBeenCalledWith('get_survivor_ads_leaderboard', {
      p_limit: 10,
    })
  })

  it('6. recordRun invoca record_survivor_ads_run con el nivel y botín alcanzado', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, new_best: true, level_recorded: 5 },
      error: null,
    } as any)

    const res = await survivorAdsService.recordRun({
      level: 5,
      playtimeSeconds: 120,
      spentGems: true,
      gemsSpent: 50,
      revived: false,
      reviveCount: 0,
      totalRewards: {
        tokenPlants: 10,
        basicPacks: 0,
        rareCards: 0,
      },
      status: 'completed',
    })

    expect(res.success).toBe(true)
    expect(res.newBest).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith('record_survivor_ads_run', {
      p_level: 5,
      p_playtime_seconds: 120,
      p_spent_gems: true,
      p_gems_spent: 50,
      p_revived: false,
      p_revive_count: 0,
      p_total_rewards: {
        tokenPlants: 10,
        basicPacks: 0,
        rareCards: 0,
      },
      p_status: 'completed',
    })
  })
})
