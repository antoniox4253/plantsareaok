import { describe, it, expect, beforeEach } from 'vitest'
import { ClanManager, type ClanData } from './clanManager'

const store: Record<string, string> = {}
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
}
;(globalThis as any).localStorage = mockLocalStorage

describe('Clan Damage Ranking & Daily Rewards', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
  })

  it('calcula las recompensas diarias exactas según el puesto del ranking', () => {
    // Top 1: 500 de oro por miembro + Pack PvP
    const top1 = ClanManager.getDailyRewardsForRank(1)
    expect(top1.goldPerMember).toBe(500)
    expect(top1.hasPvpPack).toBe(true)
    expect(top1.badge).toContain('500')
    expect(top1.badge).toContain('Pack PvP')

    // Top 2: 200 de oro por miembro
    const top2 = ClanManager.getDailyRewardsForRank(2)
    expect(top2.goldPerMember).toBe(200)
    expect(top2.hasPvpPack).toBe(false)

    // Top 3: 100 de oro por miembro
    const top3 = ClanManager.getDailyRewardsForRank(3)
    expect(top3.goldPerMember).toBe(100)
    expect(top3.hasPvpPack).toBe(false)

    // Top 4 al 10: 50 de oro por miembro
    for (let r = 4; r <= 10; r++) {
      const topN = ClanManager.getDailyRewardsForRank(r)
      expect(topN.goldPerMember).toBe(50)
      expect(topN.hasPvpPack).toBe(false)
    }

    // Top 11 en adelante: 0 oro
    const top11 = ClanManager.getDailyRewardsForRank(11)
    expect(top11.goldPerMember).toBe(0)
    expect(top11.hasPvpPack).toBe(false)
  })

  it('calcula los premios en gemas de fin de temporada para el Top 5 de clanes', () => {
    // Top 1: 5,000 gemas
    const top1Gems = ClanManager.getSeasonGemRewardsForRank(1)
    expect(top1Gems.gems).toBe(5000)
    expect(top1Gems.badge).toContain('5,000')

    // Top 2: 3,000 gemas
    const top2Gems = ClanManager.getSeasonGemRewardsForRank(2)
    expect(top2Gems.gems).toBe(3000)
    expect(top2Gems.badge).toContain('3,000')

    // Top 3: 1,500 gemas
    const top3Gems = ClanManager.getSeasonGemRewardsForRank(3)
    expect(top3Gems.gems).toBe(1500)
    expect(top3Gems.badge).toContain('1,500')

    // Top 4: 1,000 gemas
    const top4Gems = ClanManager.getSeasonGemRewardsForRank(4)
    expect(top4Gems.gems).toBe(1000)
    expect(top4Gems.badge).toContain('1,000')

    // Top 5: 500 gemas
    const top5Gems = ClanManager.getSeasonGemRewardsForRank(5)
    expect(top5Gems.gems).toBe(500)
    expect(top5Gems.badge).toContain('500')

    // Top 6 en adelante: 0 gemas
    const top6Gems = ClanManager.getSeasonGemRewardsForRank(6)
    expect(top6Gems.gems).toBe(0)
  })

  it('valida el temporizador estricto de 5 minutos para abrir el Pack PvP (no expira, solo recién se puede abrir)', () => {
    const now = Date.now()
    // 1. Pack recién emitido con cuenta regresiva de 5 minutos (faltan 4 minutos)
    const activeUnlockAt = now + 4 * 60 * 1000
    expect(ClanManager.isFlashPackUnlocked(activeUnlockAt)).toBe(false)
    expect(ClanManager.getFlashPackRemainingSeconds(activeUnlockAt)).toBeGreaterThan(0)
    expect(ClanManager.isFlashPackExpired(activeUnlockAt)).toBe(false)

    // 2. Pack cuyo temporizador estricto de 5 minutos ya finalizó
    const completedUnlockAt = now - 1000 // Pasó hace 1 segundo
    expect(ClanManager.isFlashPackUnlocked(completedUnlockAt)).toBe(true)
    expect(ClanManager.getFlashPackRemainingSeconds(completedUnlockAt)).toBe(0)

    // 3. Regla estricta del juego: NO EXPIRA NUNCA (incluso horas o días después)
    const longTimeAfter = now - 24 * 60 * 60 * 1000 // 1 día después
    expect(ClanManager.isFlashPackUnlocked(longTimeAfter)).toBe(true)
    expect(ClanManager.isFlashPackExpired(longTimeAfter)).toBe(false)
  })

  it('ordena los clanes prioritariamente por daño infligido descendente', () => {
    const mockClans: ClanData[] = [
      {
        id: '11111111-1111-4111-a111-111111111111',
        name: 'CLAN BETA',
        tag: '#BETA',
        badge: '🌿',
        description: 'Clan B',
        leader: 'Player2',
        members: [{ id: 'p2', name: 'Player2', role: 'Líder', elo: 1200, donatedCount: 0, joinedAt: '2026-01-01' }],
        vaultUsd: 100,
        status: 'active',
        wins: 10,
        losses: 2,
        createdAt: '2026-01-01',
        fullBonusClaimedMembers: [],
        seasonPayoutClaimedMembers: [],
        damageDealt: 1500,
        dailyDamageDealt: 400,
      },
      {
        id: '22222222-2222-4222-a222-222222222222',
        name: 'CLAN ALPHA',
        tag: '#ALPHA',
        badge: '👑',
        description: 'Clan A',
        leader: 'Player1',
        members: [{ id: 'p1', name: 'Player1', role: 'Líder', elo: 1500, donatedCount: 0, joinedAt: '2026-01-01' }],
        vaultUsd: 50,
        status: 'active',
        wins: 8,
        losses: 1,
        createdAt: '2026-01-01',
        fullBonusClaimedMembers: [],
        seasonPayoutClaimedMembers: [],
        damageDealt: 3500,
        dailyDamageDealt: 1200,
      },
    ]

    localStorage.setItem('plant_arena_clans_list', JSON.stringify(mockClans))
    const ranking = ClanManager.getClansRanking('22222222-2222-4222-a222-222222222222')

    expect(ranking.length).toBe(2)
    // CLAN ALPHA tiene 3500 de daño -> Puesto #1
    expect(ranking[0].name).toBe('CLAN ALPHA')
    expect(ranking[0].rank).toBe(1)
    expect(ranking[0].isUserClan).toBe(true)

    // CLAN BETA tiene 1500 de daño -> Puesto #2
    expect(ranking[1].name).toBe('CLAN BETA')
    expect(ranking[1].rank).toBe(2)
    expect(ranking[1].isUserClan).toBe(false)
  })
})
