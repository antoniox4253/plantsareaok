import { describe, it, expect, vi, beforeEach } from 'vitest'
import { inventoryService } from '../services/inventoryService'
import { SupabaseService } from '../services/supabaseService'
import * as supabaseClientModule from '../lib/supabaseClient'

describe('Conversión de Plantas en Copias (50 Gemas) - Lógica y Servicios', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('1. SupabaseService.convertPlantToCopy invoca la RPC convert_plant_to_copy con p_instance_id', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
    const rpcMock = vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: {
        success: true,
        instanceId: 'inst-123',
        plantId: 'peashooter',
        newCopies: 3,
        newGemsBalance: 150,
        wasInDeck: false,
        refundedItem: null,
      },
      error: null,
    } as any)

    const res = await SupabaseService.convertPlantToCopy('inst-123')

    expect(rpcMock).toHaveBeenCalledWith('convert_plant_to_copy', {
      p_instance_id: 'inst-123',
    })
    expect(res.success).toBe(true)
    expect(res.plantId).toBe('peashooter')
    expect(res.newCopies).toBe(3)
    expect(res.newGemsBalance).toBe(150)
  })

  it('2. inventoryService.convertPlantToCopy delega en SupabaseService', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
    const rpcMock = vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: {
        success: true,
        instanceId: 'inst-456',
        plantId: 'bonkchoy',
        newCopies: 5,
        newGemsBalance: 200,
        wasInDeck: true,
        refundedItem: 'champion_belt',
      },
      error: null,
    } as any)

    const res = await inventoryService.convertPlantToCopy('inst-456')

    expect(rpcMock).toHaveBeenCalledWith('convert_plant_to_copy', {
      p_instance_id: 'inst-456',
    })
    expect(res.success).toBe(true)
    expect(res.refundedItem).toBe('champion_belt')
    expect(res.wasInDeck).toBe(true)
  })

  it('3. Rechaza la operación si el backend retorna error de límite de 5 copias', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
    vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: {
        success: false,
        error: 'Ya posees el límite máximo de 5 copias para esta planta.',
      },
      error: null,
    } as any)

    const res = await inventoryService.convertPlantToCopy('inst-789')
    expect(res.success).toBe(false)
    expect(res.error).toContain('límite máximo de 5 copias')
  })

  it('4. Rechaza la operación si el backend retorna error de saldo insuficiente (<50 gemas)', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
    vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: {
        success: false,
        error: 'Gemas insuficientes: requieres 50 gemas y tu saldo disponible es de 20 💎',
      },
      error: null,
    } as any)

    const res = await inventoryService.convertPlantToCopy('inst-999')
    expect(res.success).toBe(false)
    expect(res.error).toContain('Gemas insuficientes')
  })

  it('5. Maneja error de red o de Supabase RPC adecuadamente', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
    vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    } as any)

    const res = await inventoryService.convertPlantToCopy('inst-000')
    expect(res.success).toBe(false)
    expect(res.error).toBe('Database connection failed')
  })

  it('6. Rechaza la operación si solo posee la carta base (requiere al menos 2 cartas de esa especie)', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
    vi.spyOn(supabaseClientModule.supabase, 'rpc' as any).mockResolvedValue({
      data: {
        success: false,
        error: 'No puedes usar el bote si solo tienes la carta base. Debes poseer al menos 2 cartas de esta especie para poder convertir una en copia.',
      },
      error: null,
    } as any)

    const res = await inventoryService.convertPlantToCopy('inst-only-base')
    expect(res.success).toBe(false)
    expect(res.error).toContain('solo tienes la carta base')
  })
})
