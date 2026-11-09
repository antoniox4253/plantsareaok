import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Sistema de Reparto de Excedente de Ganancias del Clan (Migración 419)', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase',
    'migrations',
    '419-clan-surplus-distribution-system.sql'
  )

  it('1. El archivo de migración 419 existe y define distribute_clan_surplus_earnings', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.distribute_clan_surplus_earnings(p_clan_id UUID)')
  })

  it('2. Valida la Reserva Operativa de Guerra fija de 2,800 Gemas', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('c_WAR_RESERVE         CONSTANT NUMERIC := 2800.0;')
    expect(sql).toContain('v_surplus := GREATEST(0.0, COALESCE(v_clan.vault_gems, 0.0) - c_WAR_RESERVE);')
  })

  it('3. Valida autorización exclusiva del Líder del Clan', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain("IF v_clan.leader_id <> v_uid AND COALESCE(v_caller_role, '') <> 'Líder'")
    expect(sql).toContain('UNAUTHORIZED_LEADER_ONLY')
  })

  it('4. Distribuye porcentualmente a cada miembro y actualiza profiles.gems_balance', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('v_member_share := FLOOR(v_surplus * (v_member_pct / 100.0));')
    expect(sql).toContain('UPDATE public.profiles')
    expect(sql).toContain('SET gems_balance = gems_balance + v_member_share')
  })

  it('5. Registra auditoría contable en clan_audit_logs con acción SURPLUS_DISTRIBUTED', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain("'SURPLUS_DISTRIBUTED'")
    expect(sql).toContain('INSERT INTO public.clan_audit_logs')
  })
})
