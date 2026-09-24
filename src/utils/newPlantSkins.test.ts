import { describe, it, expect } from 'vitest'
import {
  getScaledPlantConfig,
  getEquippableItemDef,
  getEquippableItemsForPlant,
  PLANT_CONFIGS,
} from './gameConstants'
import {
  ArenaAdsManager,
  generateRewardOptions,
  generateLevelPrep,
} from './arenaAdsManager'

describe('Nuevas Skins e Ítems Equipables (Protocolo 7 Capas)', () => {
  it('1. Gafas de Sol para Girasol (sunflower_glasses)', () => {
    const itemDef = getEquippableItemDef('sunflower_glasses')
    expect(itemDef).toBeDefined()
    expect(itemDef?.targetPlantId).toBe('sunflower')
    expect(itemDef?.statBonusText).toBe('+5 Soles')

    const base = PLANT_CONFIGS.sunflower
    const equipped = getScaledPlantConfig('sunflower', 0, 'sunflower_glasses')
    expect(equipped.sprite).toBe('/game-assets/skins/gafasgirasol.webp')
    expect(equipped.icon).toBe('/game-assets/skins/gafasgirasol.webp')
    expect(equipped.packetActive).toBe('/game-assets/skins/gafasgirasol.webp')

    // No se equipa a otras plantas
    const wrong = getScaledPlantConfig('peashooter', 0, 'sunflower_glasses')
    expect(wrong.sprite).not.toBe('/game-assets/skins/gafasgirasol.webp')
  })

  it('2. Armadura de Cactus (cactus_armor)', () => {
    const itemDef = getEquippableItemDef('cactus_armor')
    expect(itemDef).toBeDefined()
    expect(itemDef?.targetPlantId).toBe('chomper')

    const base = PLANT_CONFIGS.chomper
    const equipped = getScaledPlantConfig('chomper', 0, 'cactus_armor')
    expect(equipped.damage).toBe((base.damage ?? 35) + 15)
    expect(equipped.sprite).toBe('/game-assets/skins/armaduraconcactus.webp')
  })

  it('3. Skins de Superhéroes para Nuez (+200 HP)', () => {
    const baseHp = PLANT_CONFIGS.wallnut.maxHp // 1200

    // Superman
    const superman = getScaledPlantConfig('wallnut', 0, 'superman_suit')
    expect(superman.maxHp).toBe(baseHp + 200)
    expect(superman.sprite).toBe('/game-assets/skins/papasuperman.webp')

    // Spiderman
    const spiderman = getScaledPlantConfig('wallnut', 0, 'spiderman_suit')
    expect(spiderman.maxHp).toBe(baseHp + 200)
    expect(spiderman.sprite).toBe('/game-assets/skins/papaspiderman.webp')

    // Batman
    const batman = getScaledPlantConfig('wallnut', 0, 'batman_suit')
    expect(batman.maxHp).toBe(baseHp + 200)
    expect(batman.sprite).toBe('/game-assets/skins/papabatman.webp')

    // Iron Man
    const ironman = getScaledPlantConfig('wallnut', 0, 'ironman_suit')
    expect(ironman.maxHp).toBe(baseHp + 200)
    expect(ironman.sprite).toBe('/game-assets/skins/papaironman.webp')
  })

  it('4. Nuez de Oro 24K (+300 HP y -2s recarga)', () => {
    const base = PLANT_CONFIGS.wallnut
    const gold = getScaledPlantConfig('wallnut', 0, 'gold_24k')
    expect(gold.maxHp).toBe(base.maxHp + 300)
    expect(gold.cooldownMs).toBe(base.cooldownMs - 2000)
    expect(gold.sprite).toBe('/game-assets/skins/papa24k.webp')
  })

  it('5. Armadura Samurái para Squash / Garlic (-1.5s recarga)', () => {
    const base = PLANT_CONFIGS.garlic
    const samurai = getScaledPlantConfig('garlic', 0, 'samurai_armor')
    expect(samurai.cooldownMs).toBe(base.cooldownMs - 1500)
    expect(samurai.sprite).toBe('/game-assets/skins/squashsamurai.webp')
  })

  it('6. getEquippableItemsForPlant lista todos los ítems de una planta', () => {
    const wallnutItems = getEquippableItemsForPlant('wallnut')
    const ids = wallnutItems.map((i) => i.id)
    expect(ids).toContain('superman_suit')
    expect(ids).toContain('spiderman_suit')
    expect(ids).toContain('batman_suit')
    expect(ids).toContain('ironman_suit')
    expect(ids).toContain('gold_24k')
    expect(ids).toContain('knight_helmet')
  })

  it('7. Economía de Arena ADS: Multiplicador 2x para entrada con 200 Gemas', () => {
    const runGold = ArenaAdsManager.startNewRun('gold')
    expect(runGold.multiplier).toBe(1)
    expect(runGold.paymentType).toBe('gold')

    const runGems = ArenaAdsManager.startNewRun('gems')
    expect(runGems.multiplier).toBe(2)
    expect(runGems.paymentType).toBe('gems')

    // Al generar recompensas con multiplicador 2, los montos base se duplican
    const rewards = generateRewardOptions(1, 2)
    expect(rewards.length).toBe(1)
    expect(rewards[0].amount).toBeGreaterThan(0)
  })

  it('8. Revivir en Arena ADS conserva botín y da 1 vida extra', () => {
    const run = ArenaAdsManager.startNewRun('gold')
    run.accumulatedRewards.gold = 350
    run.accumulatedRewards.gems = 25
    run.level = 5

    const revived = ArenaAdsManager.reviveRun(run)
    expect(revived.lives).toBe(2)
    expect(revived.status).toBe('prep')
    expect(revived.level).toBe(5)
    expect(revived.accumulatedRewards.gold).toBe(350)
    expect(revived.accumulatedRewards.gems).toBe(25)
  })
})
