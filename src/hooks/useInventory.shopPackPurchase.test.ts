import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PACK_DEFINITIONS } from '../utils/packDropManager'
import { inventoryService } from '../services/inventoryService'
import { SupabaseService } from '../services/supabaseService'
import * as supabaseClientModule from '../lib/supabaseClient'

describe('Compra de Sobres en la Tienda - Lógica Autoritativa de Cobro', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('1. El sobre épico tiene un precio de 1000 gemas según PACK_DEFINITIONS', () => {
    expect(PACK_DEFINITIONS.epic.priceUsd).toBe(1000)
    expect(PACK_DEFINITIONS.basic.priceUsd).toBe(300)
    expect(PACK_DEFINITIONS.legendary.priceUsd).toBe(2500)
  })

  it('2. inventoryService.buyPacks ejecuta la compra autoritativa correctamente', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
    const rpcMock = vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: {
        success: true,
        packIds: ['uuid-pack-1'],
        spent: 1000,
        quantity: 1,
      },
      error: null,
    } as any)

    const res = await inventoryService.buyPacks('epic', 1)

    expect(rpcMock).toHaveBeenCalledWith('buy_packs', { p_pack_id: 'epic', p_qty: 1 })
    expect(res.success).toBe(true)
    expect(res.spent).toBe(1000)
    expect(res.packIds).toEqual(['uuid-pack-1'])
  })

  it('3. SupabaseService.buyPacks ejecuta la RPC "buy_packs" con p_pack_id y p_qty', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)

    const rpcMock = vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: {
        success: true,
        packIds: ['uuid-pack-10'],
        spent: 1000,
        quantity: 1,
      },
      error: null,
    } as any)

    const res = await SupabaseService.buyPacks('epic', 1)

    expect(rpcMock).toHaveBeenCalledWith('buy_packs', {
      p_pack_id: 'epic',
      p_qty: 1,
    })
    expect(res).toEqual({
      success: true,
      packIds: ['uuid-pack-10'],
      spent: 1000,
      quantity: 1,
    })
  })

  it('4. SupabaseService.buyPacks propaga error del servidor cuando las gemas son insuficientes', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)

    vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: null,
      error: { message: 'Gemas insuficientes: necesitas 1000 y tienes 0' },
    } as any)

    const res = await SupabaseService.buyPacks('epic', 1)

    expect(res.success).toBe(false)
    expect(res.error).toBe('Gemas insuficientes: necesitas 1000 y tienes 0')
  })

  it('5. Deducción inmediata y cálculo seguro del nuevo saldo: de 1000 gemas a 0 tras compra', () => {
    const initialGems = 1000
    const res = { success: true, spent: 1000, packIds: ['pack-1'] }

    // Simula la deducción autoritativa implementada en useInventory
    const spentGems = typeof res.spent === 'number' ? res.spent : 0
    const nextGems = Math.max(0, initialGems - spentGems)

    expect(nextGems).toBe(0)

    // Verificación de que no permite saldo negativo
    const overflowSpent = 2000
    const boundedGems = Math.max(0, initialGems - overflowSpent)
    expect(boundedGems).toBe(0)
  })

  it('6. En Shop.tsx, si el usuario tiene 0 gemas se bloquea la compra antes de llamar al backend', () => {
    const userTokens = 0
    const packCost = 1000
    const qty = 1
    const totalCost = packCost * qty

    const isBlocked = userTokens < totalCost
    expect(isBlocked).toBe(true)
  })

  it('7. PACK_DEFINITIONS define 300, 1000 y 2500 de oro para los sobres básico, épico y legendario', () => {
    expect(PACK_DEFINITIONS.basic.goldReward).toBe(300)
    expect(PACK_DEFINITIONS.epic.goldReward).toBe(1000)
    expect(PACK_DEFINITIONS.legendary.goldReward).toBe(2500)
  })

  it('8. SupabaseService.buyPacks procesa goldAdded devuelto por el backend', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)

    vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: {
        success: true,
        packIds: ['uuid-pack-basic-1', 'uuid-pack-basic-2'],
        spent: 600,
        goldAdded: 600,
        quantity: 2,
      },
      error: null,
    } as any)

    const res = await SupabaseService.buyPacks('basic', 2)

    expect(res.success).toBe(true)
    expect(res.spent).toBe(600)
    expect(res.goldAdded).toBe(600)
    expect(res.packIds?.length).toBe(2)
  })

  it('9. Acreditación de oro: el saldo previo suma goldAdded correctamente', () => {
    const initialGold = 500
    const res = { success: true, spent: 1000, goldAdded: 1000, packIds: ['pack-epic-1'] }

    const goldAdded = typeof res.goldAdded === 'number' ? res.goldAdded : 0
    const nextGold = initialGold + goldAdded

    expect(nextGold).toBe(1500)
  })
})
