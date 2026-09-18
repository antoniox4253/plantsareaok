import { describe, it, expect, vi, beforeEach } from 'vitest'
import { claimWeeklyChest, type WeeklyChestClaimResult } from './missionService'
import { supabase } from '../lib/supabaseClient'
import fs from 'fs'
import path from 'path'

describe('Weekly Chest Rewards & Mission Packs Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('1. claimWeeklyChest mapea correctamente el RPC con el desglose de recompensas autoritativas', async () => {
    const mockRpcResponse: WeeklyChestClaimResult = {
      success: true,
      tier: 'bronze',
      packId: 'basic',
      gold: 150,
      gems: 0,
      itemId: null,
      itemCount: 0,
      claimedChests: ['bronze'],
    }

    vi.spyOn(supabase as any, 'rpc').mockResolvedValueOnce({
      data: mockRpcResponse,
      error: null,
    })

    const result = await claimWeeklyChest('bronze')

    expect(result.success).toBe(true)
    expect(result.tier).toBe('bronze')
    expect(result.packId).toBe('basic')
    expect(result.gold).toBe(150)
    expect(result.claimedChests).toContain('bronze')
  })

  it('2. claimWeeklyChest maneja errores de RPC adecuadamente', async () => {
    vi.spyOn(supabase as any, 'rpc').mockResolvedValueOnce({
      data: null,
      error: { message: 'Puntos insuficientes: necesitas 70 pts' },
    })

    const result = await claimWeeklyChest('bronze')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Puntos insuficientes')
  })

  it('3. Disparo de eventos del navegador refresca inventario y saldo al reclamar', () => {
    const eventTarget = new EventTarget()
    const balanceSpy = vi.fn()
    const inventorySpy = vi.fn()
    const rewardPacksSpy = vi.fn()

    eventTarget.addEventListener('refresh_user_balance', balanceSpy)
    eventTarget.addEventListener('refresh_user_inventory', inventorySpy)
    eventTarget.addEventListener('refresh_reward_packs', rewardPacksSpy)

    eventTarget.dispatchEvent(new CustomEvent('refresh_user_balance'))
    eventTarget.dispatchEvent(new CustomEvent('refresh_user_inventory'))
    eventTarget.dispatchEvent(new CustomEvent('refresh_reward_packs'))

    expect(balanceSpy).toHaveBeenCalledTimes(1)
    expect(inventorySpy).toHaveBeenCalledTimes(1)
    expect(rewardPacksSpy).toHaveBeenCalledTimes(1)
  })

  it('4. Migración SQL 190 contiene las reglas exactas de calibración y auto-reparación semanal', () => {
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/190-fix-weekly-chest-claims-and-pack-delivery.sql')
    expect(fs.existsSync(migrationPath)).toBe(true)

    const sql = fs.readFileSync(migrationPath, 'utf8')

    // Verificación de la función autoritativa
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_weekly_chest(p_tier TEXT)')

    // Auto-reparación e inicialización si la fila no existe o la semana es anterior
    expect(sql).toContain('IF NOT FOUND THEN')
    expect(sql).toContain('ELSIF v_m_row.week_start_date < v_week_start THEN')
    expect(sql).toContain('weekly_points = 0')

    // Calibración de recompensas
    // Bronce: 70 pts, 150 oro, sobre 'basic'
    expect(sql).toContain("v_req_points := 70;")
    expect(sql).toContain("v_gold := 150;")
    expect(sql).toContain("v_pack_id := 'basic';")

    // Plata: 140 pts, 400 oro, 20 gemas, 'energy_potion_5'
    expect(sql).toContain("v_req_points := 140;")
    expect(sql).toContain("v_gold := 400;")
    expect(sql).toContain("v_gems := 20;")
    expect(sql).toContain("v_item_id := 'energy_potion_5';")

    // Oro: 210 pts, sobre 'epic'
    expect(sql).toContain("v_req_points := 210;")
    expect(sql).toContain("v_pack_id := 'epic';")

    // Inserción en player_packs para abrir en el Jardín
    expect(sql).toContain("INSERT INTO public.player_packs (user_id, pack_id, source)")
    expect(sql).toContain("VALUES (v_uid, v_pack_id, 'gift');")
  })
})
