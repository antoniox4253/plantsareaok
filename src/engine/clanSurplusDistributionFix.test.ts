import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ClanManager } from '../utils/clanManager'

describe('Regresión y Endurecimiento de Reparto de Gemas del Clan (Migración 428)', () => {
  const migration428Path = join(
    process.cwd(),
    'supabase',
    'migrations',
    '428-fix-clan-surplus-distribution-and-shares.sql'
  )

  it('1. Migración 428 corrige cálculo NULL de nuevos miembros y valida rol leader', () => {
    const sql = readFileSync(migration428Path, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.distribute_clan_surplus_earnings(p_clan_id UUID)')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.update_clan_reward_shares(')
    expect(sql).toContain('WHEN v_has_configured_shares THEN COALESCE(cm.reward_percentage, 0.0)')
    expect(sql).toContain("IF v_clan.leader_id IS DISTINCT FROM v_uid AND COALESCE(v_caller_role, '') <> 'leader' THEN")
    expect(sql).toContain('IF (v_total_distributed + v_member_share) > v_distributable_pool THEN')
  })

  it('2. ClanManager.computeSurplusGems protege estrictamente la reserva de 2,800 Gemas', () => {
    expect(ClanManager.computeSurplusGems(0)).toBe(0)
    expect(ClanManager.computeSurplusGems(2800)).toBe(0)
    expect(ClanManager.computeSurplusGems(2800.99)).toBeCloseTo(0.99, 2)
    expect(ClanManager.computeSurplusGems(8598.01)).toBeCloseTo(5798.01, 2)
    expect(ClanManager.computeSurplusGems(13057.94)).toBeCloseTo(10257.94, 2)
  })

  it('3. ClanManager.buildEquitableRewardShares suma exactamente 100% para cualquier cantidad de miembros', () => {
    for (const count of [1, 2, 3, 7, 10, 15, 17, 18, 25]) {
      const members = Array.from({ length: count }, (_, i) => ({ id: `user-${i}` }))
      const shares = ClanManager.buildEquitableRewardShares(members)
      expect(ClanManager.calculateRewardSharesTotal(members, shares)).toBe(100)
      for (const m of members) {
        expect(shares[m.id]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('4. ClanManager.initializeRewardSharesMap usa cuotas existentes si están configuradas y equitativo si no', () => {
    const unconfigured = [{ id: 'a', rewardPercentage: 0 }, { id: 'b', rewardPercentage: 0 }, { id: 'c' }]
    const initUnconfigured = ClanManager.initializeRewardSharesMap(unconfigured)
    expect(ClanManager.calculateRewardSharesTotal(unconfigured, initUnconfigured)).toBe(100)
    expect(initUnconfigured).toEqual({ a: 34, b: 33, c: 33 })

    const configured = [{ id: 'a', rewardPercentage: 100 }, { id: 'b', rewardPercentage: 0 }, { id: 'c' }]
    const initConfigured = ClanManager.initializeRewardSharesMap(configured)
    expect(initConfigured).toEqual({ a: 100, b: 0, c: 0 })
    expect(ClanManager.calculateRewardSharesTotal(configured, initConfigured)).toBe(100)
  })

  it('5. Clan.tsx y supabaseService.ts verifican guardado de cuotas antes de repartir y refrescan auth', () => {
    const clanCode = readFileSync(join(process.cwd(), 'src', 'components', 'Clan', 'Clan.tsx'), 'utf8')
    const serviceCode = readFileSync(join(process.cwd(), 'src', 'services', 'supabaseService.ts'), 'utf8')

    // Confirm modal opens before server mutation; sharesRes.success checked before distributeClanSurplusEarnings
    expect(clanCode).toContain('if (!sharesRes?.success)')
    expect(clanCode).toContain('disabled={isDistributingSurplus}')
    expect(clanCode).not.toContain('disabled={isDistributingSurplus || !isSumValid}')

    // supabaseService uses callAuthRpc and retries on NOT_AUTHENTICATED JSON payloads
    expect(serviceCode).toContain("this.callAuthRpc<any>('distribute_clan_surplus_earnings'")
    expect(serviceCode).toContain("this.callAuthRpc<any>('update_clan_reward_shares'")
    expect(serviceCode).toContain("error === 'NOT_AUTHENTICATED'")
  })
})
