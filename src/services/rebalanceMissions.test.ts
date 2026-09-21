import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Rebalanceo Calibrado de Oro en Misiones y Cofres (Migración 199)', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/199-rebalance-mission-gold-rewards.sql')
  const modalPath = path.resolve(__dirname, '../components/Misiones/MisionesModal.tsx')

  it('1. Existe la migración 199 con las funciones autoritativas de misiones y cofres', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const sql = fs.readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public._generate_daily_missions')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_weekly_chest')
  })

  it('2. Las misiones diarias han sido reducidas al 50% para frenar la inflación de oro', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // Misión 1 (play_12_pvp): Reducida de 100 a 50 Oro
    expect(sql).toContain("'id', 'play_12_pvp'")
    expect(sql).toContain("'rewardGold', 50")

    // Misión 2 (win_3_with_plant): Reducida de 200 a 100 Oro
    expect(sql).toContain("'id', 'win_3_with_plant'")
    expect(sql).toContain("'rewardGold', 100")

    // Misión 0 (win_10_pvp): Mantiene su 1 Gema y 0 Oro
    expect(sql).toContain("'id', 'win_10_pvp'")
    expect(sql).toContain("'rewardGems', 1")
    expect(sql).toContain("'rewardGold', 0")
  })

  it('3. Los cofres semanales han sido recalibrados a 100 Oro y 200 Oro', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // Bronce: 70 pts -> 100 Oro + 1 Sobre Básico
    expect(sql).toContain("WHEN 'bronze' THEN")
    expect(sql).toContain("v_req_points := 70;")
    expect(sql).toContain("v_gold := 100;")
    expect(sql).toContain("v_pack_id := 'basic';")

    // Plata: 140 pts -> 200 Oro + 20 Gemas + energy_potion_5
    expect(sql).toContain("WHEN 'silver' THEN")
    expect(sql).toContain("v_req_points := 140;")
    expect(sql).toContain("v_gold := 200;")
    expect(sql).toContain("v_gems := 20;")
    expect(sql).toContain("v_item_id := 'energy_potion_5';")

    // Oro: 210 pts -> Sobre Épico
    expect(sql).toContain("WHEN 'gold' THEN")
    expect(sql).toContain("v_req_points := 210;")
    expect(sql).toContain("v_pack_id := 'epic';")
  })

  it('4. MisionesModal.tsx muestra los nuevos valores en la interfaz visual', () => {
    expect(fs.existsSync(modalPath)).toBe(true)
    const modalCode = fs.readFileSync(modalPath, 'utf8')

    expect(modalCode).toContain('100 Oro + 1 Sobre Básico')
    expect(modalCode).toContain('200 Oro + 20 Gemas + 1⚡')
    expect(modalCode).toContain('title="Cofre de Bronce (70 Pts): 100 Oro + 1 Sobre Básico"')
    expect(modalCode).toContain('title="Cofre de Plata (140 Pts): 200 Oro + 20 Gemas + 1 Poción 5⚡"')
  })
})
