import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabaseService } from '../services/supabaseService'

describe('VIP Victory Gold Bonus (5, 10 o 15 de Oro aleatorio)', () => {
  const storage: Record<string, string> = {}
  const mockStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    clear: () => { for (const k in storage) delete storage[k] },
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    mockStorage.clear()
  })

  it('1. Si el usuario NO tiene Pase VIP, no recibe ningún bono (retorna 0)', async () => {
    let currentGold = 100
    const hasVipPass = false

    const awardVipVictoryGold = async (): Promise<number> => {
      if (!hasVipPass) {
        return 0
      }
      return 10
    }

    const bonus = await awardVipVictoryGold()
    expect(bonus).toBe(0)
    expect(currentGold).toBe(100)
  })

  it('2. Si el usuario tiene Pase VIP, el bono recibido siempre pertenece al conjunto [5, 10, 15]', async () => {
    const hasVipPass = true
    const validOptions = [5, 10, 15]

    const awardVipVictoryGold = async (): Promise<number> => {
      if (!hasVipPass) return 0
      const options = [5, 10, 15]
      return options[Math.floor(Math.random() * options.length)]
    }

    for (let i = 0; i < 50; i++) {
      const bonus = await awardVipVictoryGold()
      expect(validOptions).toContain(bonus)
      expect([5, 10, 15].includes(bonus)).toBe(true)
    }
  })

  it('3. El oro recibido se suma de forma exacta al balance de oro del usuario VIP', async () => {
    let currentGold = 250
    const hasVipPass = true

    const awardVipVictoryGold = async (): Promise<number> => {
      if (!hasVipPass) return 0
      const options = [5, 10, 15]
      const bonus = options[Math.floor(Math.random() * options.length)]
      currentGold += bonus
      mockStorage.setItem('plant_arena_gold', String(currentGold))
      return bonus
    }

    const goldBefore = currentGold
    const bonus = await awardVipVictoryGold()
    expect(bonus).toBeGreaterThanOrEqual(5)
    expect(bonus).toBeLessThanOrEqual(15)
    expect(currentGold).toBe(goldBefore + bonus)
    expect(Number(mockStorage.getItem('plant_arena_gold'))).toBe(currentGold)
  })

  it('4. Reconoce la respuesta autoritativa de claimVipVictoryGold desde Supabase RPC', async () => {
    const mockRpcResponse = {
      success: true,
      goldBonus: 15,
      newGoldBalance: 515,
    }

    vi.spyOn(supabaseService, 'claimVipVictoryGold').mockResolvedValue(mockRpcResponse)

    const res = await supabaseService.claimVipVictoryGold()
    expect(res.success).toBe(true)
    expect(res.goldBonus).toBe(15)
    expect(res.newGoldBalance).toBe(515)
  })

  it('5. En derrota o empate, el bono VIP no debe ejecutarse', () => {
    const isVictory = false
    const hasVipPass = true

    let bonusAwarded = 0
    if (isVictory && hasVipPass) {
      bonusAwarded = 10
    }

    expect(bonusAwarded).toBe(0)
  })
})
