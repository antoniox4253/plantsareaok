import { describe, it, expect, vi, beforeEach } from 'vitest'
import { arenaAdsService } from './arenaAdsService'
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

describe('arenaAdsService (Validación de Backend)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. En modo offline/sin configurar o sin sesión permite jugar localmente', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    const res = await arenaAdsService.enterArenaAds()
    expect(res.success).toBe(true)

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)
    const resGuest = await arenaAdsService.enterArenaAds()
    expect(resGuest.success).toBe(true)
  })

  it('2. enterArenaAds descuenta 350 de oro atómicamente si el backend responde con éxito', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
      error: null,
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, cost: 350, new_gold_balance: 9650, claimed_arena_ads_levels: [1, 2] },
      error: null,
    } as any)

    const res = await arenaAdsService.enterArenaAds()
    expect(res.success).toBe(true)
    expect(res.cost).toBe(350)
    expect(res.newGoldBalance).toBe(9650)
    expect(res.claimedArenaAdsLevels).toEqual([1, 2])
    expect(supabase.rpc).toHaveBeenCalledWith('enter_arena_ads', {
      p_payment_type: 'gold',
    })
  })

  it('3. enterArenaAds rechaza la entrada si el usuario no tiene suficiente oro en backend', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
      error: null,
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'INSUFFICIENT_GOLD: Se requieren 350 de Oro' },
    } as any)

    const res = await arenaAdsService.enterArenaAds()
    expect(res.success).toBe(false)
    expect(res.error).toContain('350 🪙')
  })

  it('4. enterArenaAds soporta entrada con 200 gemas para multiplicador 2x', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
      error: null,
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, cost: 200, currency: 'gems', multiplier: 2, new_gems_balance: 800 },
      error: null,
    } as any)

    const res = await arenaAdsService.enterArenaAds('gems')
    expect(res.success).toBe(true)
    expect(res.cost).toBe(200)
    expect(res.multiplier).toBe(2)
    expect(supabase.rpc).toHaveBeenCalledWith('enter_arena_ads', {
      p_payment_type: 'gems',
    })
  })

  it('5. reviveArenaAds cobra 150 gemas autoritativamente', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
      error: null,
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, cost: 150, new_gems_balance: 650 },
      error: null,
    } as any)

    const res = await arenaAdsService.reviveArenaAds()
    expect(res.success).toBe(true)
    expect(res.cost).toBe(150)
    expect(supabase.rpc).toHaveBeenCalledWith('revive_arena_ads')
  })

  it('6. claimLoot acredita botín en el backend autoritativo con multiplicador', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
      error: null,
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { success: true, new_gold_balance: 10200, new_gems_balance: 55, claimed_arena_ads_levels: [1, 2, 3] },
      error: null,
    } as any)

    const res = await arenaAdsService.claimLoot({
      gold: 550,
      gems: 10,
      items: { fertilizer: 2 },
    }, 2, [3])

    expect(res.success).toBe(true)
    expect(res.newGoldBalance).toBe(10200)
    expect(res.newGemsBalance).toBe(55)
    expect(res.claimedArenaAdsLevels).toEqual([1, 2, 3])
    expect(supabase.rpc).toHaveBeenCalledWith('claim_arena_ads_loot', {
      p_gold: 550,
      p_gems: 10,
      p_items: { fertilizer: 2 },
      p_multiplier: 2,
      p_claimed_levels: [3],
    })
  })
})
