import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Liquidación de Guerra de Clanes, Reparto de Gemas a Tesoros y Reinicio de Temporada (Migración 324)', () => {
  const migration324Path = join(
    process.cwd(),
    'supabase',
    'migrations',
    '324-settle-clan-war-season-and-distribute-gems.sql'
  )

  it('1. El archivo de migración 324 existe y es accesible', () => {
    expect(existsSync(migration324Path)).toBe(true)
  })

  it('2. Define la tabla histórica clan_season_settlements con RLS habilitado', () => {
    const sql = readFileSync(migration324Path, 'utf8')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.clan_season_settlements')
    expect(sql).toContain('season_number INTEGER NOT NULL')
    expect(sql).toContain('clan_id UUID NOT NULL')
    expect(sql).toContain('rank INTEGER NOT NULL')
    expect(sql).toContain('gems_awarded NUMERIC NOT NULL')
    expect(sql).toContain('ALTER TABLE public.clan_season_settlements ENABLE ROW LEVEL SECURITY')
  })

  it('3. settle_clan_season_rewards aplica la escala oficial de gemas a los tesoros del Top 5', () => {
    const sql = readFileSync(migration324Path, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.settle_clan_season_rewards()')
    // Top 1: 5,000 gemas
    expect(sql).toContain('v_gems_pool := 5000')
    // Top 2: 3,000 gemas
    expect(sql).toContain('v_gems_pool := 3000')
    // Top 3: 1,500 gemas
    expect(sql).toContain('v_gems_pool := 1500')
    // Top 4: 1,000 gemas
    expect(sql).toContain('v_gems_pool := 1000')
    // Top 5: 500 gemas
    expect(sql).toContain('v_gems_pool := 500')
    // Depósito en vault_gems
    expect(sql).toContain('vault_gems = vault_gems + v_gems_pool')
  })

  it('4. Registra auditoría oficial en clan_audit_logs con SEASON_REWARD', () => {
    const sql = readFileSync(migration324Path, 'utf8')
    expect(sql).toContain('INSERT INTO public.clan_audit_logs')
    expect(sql).toContain("'SEASON_REWARD'")
    expect(sql).toContain("'Sistema'")
  })

  it('5. Reinicia el daño acumulado de todos los clanes competitivos a 0 y habilita reclamos del nuevo ciclo', () => {
    const sql = readFileSync(migration324Path, 'utf8')
    expect(sql).toContain('UPDATE public.clans')
    expect(sql).toContain('damage_dealt = 0')
    expect(sql).toContain('daily_damage_dealt = 0')
    expect(sql).toContain('season_payout_claimed_members')
    expect(sql).toContain('COALESCE(is_npc, FALSE) = FALSE')
  })
})
