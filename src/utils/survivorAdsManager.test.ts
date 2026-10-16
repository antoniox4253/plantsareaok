import { describe, it, expect } from 'vitest'
import {
  calculateSurvivorRewards,
  SurvivorAdsManager,
  SURVIVOR_ADS_ENTRY_FEE_GEMS,
  SURVIVOR_RARE_CARDS_POOL,
} from './survivorAdsManager'

describe('survivorAdsManager', () => {
  it('enforces 50 gems entry fee', () => {
    expect(SURVIVOR_ADS_ENTRY_FEE_GEMS).toBe(50)
  })

  it('calculates rewards: 2 tokens per level, 1 pack every 10 levels, 1 rare card every 25 levels', () => {
    // 0 levels cleared
    const loot0 = calculateSurvivorRewards(0)
    expect(loot0.plantsTokens).toBe(0)
    expect(loot0.basicPacks).toBe(0)
    expect(loot0.rareCards).toBe(0)
    expect(loot0.rareCardIds).toHaveLength(0)

    // 1 level cleared
    const loot1 = calculateSurvivorRewards(1)
    expect(loot1.plantsTokens).toBe(2)
    expect(loot1.basicPacks).toBe(0)
    expect(loot1.rareCards).toBe(0)

    // 5 levels cleared
    const loot5 = calculateSurvivorRewards(5)
    expect(loot5.plantsTokens).toBe(10)
    expect(loot5.basicPacks).toBe(0)

    // 10 levels cleared
    const loot10 = calculateSurvivorRewards(10)
    expect(loot10.plantsTokens).toBe(20)
    expect(loot10.basicPacks).toBe(1)
    expect(loot10.rareCards).toBe(0)

    // 25 levels cleared
    const loot25 = calculateSurvivorRewards(25)
    expect(loot25.plantsTokens).toBe(50)
    expect(loot25.basicPacks).toBe(2)
    expect(loot25.rareCards).toBe(1)
    expect(loot25.rareCardIds).toHaveLength(1)

    // 50 levels cleared (max run)
    const loot50 = calculateSurvivorRewards(50)
    expect(loot50.plantsTokens).toBe(100)
    expect(loot50.basicPacks).toBe(5)
    expect(loot50.rareCards).toBe(2)
    expect(loot50.rareCardIds).toHaveLength(2)
  })

  it('strictly excludes Jalapeño and Nuez Explosiva from the rare card pool', () => {
    expect(SURVIVOR_RARE_CARDS_POOL).not.toContain('jalapeno')
    expect(SURVIVOR_RARE_CARDS_POOL).not.toContain('explodeonut')
    expect(SURVIVOR_RARE_CARDS_POOL).toEqual([
      'twinsunflower',
      'kernelpult',
      'torchwood',
      'marigold',
      'guacodile',
      'toadstool',
    ])
  })

  it('handles defeat with single attempt rule: player keeps accumulated loot from cleared levels', () => {
    const run = SurvivorAdsManager.startNewRun(9999)
    run.level = 7 // Player is fighting on level 7 and falls

    const defeatedRun = SurvivorAdsManager.registerDefeat(run)
    expect(defeatedRun.status).toBe('game_over')
    // Cleared 6 levels (7 - 1)
    expect(defeatedRun.accumulatedLoot.plantsTokens).toBe(12) // 6 * 2
    expect(defeatedRun.accumulatedLoot.basicPacks).toBe(0) // Math.floor(6 / 10)
  })

  it('handles victory progression and rewards calculation', () => {
    const run = SurvivorAdsManager.startNewRun(8888)
    expect(run.level).toBe(1)

    const updated = SurvivorAdsManager.completeLevelVictory(run)
    expect(updated.level).toBe(2)
    expect(updated.accumulatedLoot.plantsTokens).toBe(2) // 1 * 2
  })
})
