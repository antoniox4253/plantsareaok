import { describe, it, expect } from 'vitest'
import { getScaledPlantConfig, PLANT_CONFIGS } from './gameConstants'
import { FARMING_ITEM_DEFINITIONS, EMPTY_FARMING_INVENTORY } from './pvpRewardManager'
import { FARMING_ITEM_MIN_PRICES } from './marketplaceManager'

describe('Sistema de Cinturón de Campeón (Bonk Choy)', () => {
  it('tiene definiciones correctas en recursos de cultivo y marketplace', () => {
    expect(FARMING_ITEM_DEFINITIONS.champion_belt).toBeDefined()
    expect(FARMING_ITEM_DEFINITIONS.champion_belt.label).toBe('Cinturón de Campeón')
    expect(FARMING_ITEM_DEFINITIONS.champion_belt.icon).toBe('/game-assets/farming/champion_belt.png')
    expect(EMPTY_FARMING_INVENTORY.champion_belt).toBe(0)
    expect(FARMING_ITEM_MIN_PRICES.champion_belt).toBeGreaterThanOrEqual(10)
  })

  it('Bonk Choy base sin cinturón mantiene estadísticas originales', () => {
    const baseConfig = PLANT_CONFIGS.bonkchoy
    const scaled = getScaledPlantConfig('bonkchoy', 0, null)

    expect(scaled.maxHp).toBe(baseConfig.maxHp)
    expect(scaled.damage).toBe(baseConfig.damage)
    expect(scaled.sprite).toBe(baseConfig.sprite)
    expect(scaled.icon).toBe(baseConfig.icon)
  })

  it('Bonk Choy con Cinturón de Campeón gana +150 HP, +15 DMG y cambia de asset', () => {
    const baseConfig = PLANT_CONFIGS.bonkchoy
    const equipped = getScaledPlantConfig('bonkchoy', 0, 'champion_belt')

    expect(equipped.maxHp).toBe(baseConfig.maxHp + 150)
    expect(equipped.damage).toBe((baseConfig.damage ?? 0) + 15)
    expect(equipped.sprite).toBe('/game-assets/greenfoot/bonkchoy_champion.png')
    expect(equipped.icon).toBe('/game-assets/greenfoot/bonkchoy_champion.png')
  })

  it('El cinturón de campeón se suma acumulativamente a las fusiones de Bonk Choy', () => {
    // Con rolls de fusión: 1 roll de daño (+15%) y 1 roll de salud (+15%)
    const fusedWithoutBelt = getScaledPlantConfig('bonkchoy', ['damage', 'hp'], null)
    const fusedWithBelt = getScaledPlantConfig('bonkchoy', ['damage', 'hp'], 'champion_belt')

    // El bonus del cinturón (+150 HP, +15 DMG) debe sumarse al resultado de la fusión
    expect(fusedWithBelt.maxHp).toBe(fusedWithoutBelt.maxHp + 150)
    expect(fusedWithBelt.damage).toBe((fusedWithoutBelt.damage ?? 0) + 15)
    expect(fusedWithBelt.sprite).toBe('/game-assets/greenfoot/bonkchoy_champion.png')
  })

  it('El cinturón de campeón NO aplica bonuses a otras plantas (exclusivo para Bonk Choy)', () => {
    const peaBase = PLANT_CONFIGS.peashooter
    const peaWithBelt = getScaledPlantConfig('peashooter', 0, 'champion_belt')

    expect(peaWithBelt.maxHp).toBe(peaBase.maxHp)
    expect(peaWithBelt.damage).toBe(peaBase.damage)
    expect(peaWithBelt.sprite).toBe(peaBase.sprite)
    expect(peaWithBelt.icon).toBe(peaBase.icon)
  })
})
