import { describe, it, expect } from 'vitest'
import { getScaledPlantConfig, PLANT_CONFIGS, EQUIPPABLE_PLANT_ITEMS } from './gameConstants'
import { FARMING_ITEM_DEFINITIONS, EMPTY_FARMING_INVENTORY } from './pvpRewardManager'
import { FARMING_ITEM_MIN_PRICES } from './marketplaceManager'

describe('Sistema de Sombrero de Bruja (Kernelpult / Lanzamaíz)', () => {
  it('tiene definiciones correctas en recursos de cultivo y marketplace', () => {
    expect(FARMING_ITEM_DEFINITIONS.witch_hat).toBeDefined()
    expect(FARMING_ITEM_DEFINITIONS.witch_hat.label).toBe('Sombrero de Bruja')
    expect(FARMING_ITEM_DEFINITIONS.witch_hat.icon).toBe('/game-assets/farming/witch_hat.png')
    expect(EMPTY_FARMING_INVENTORY.witch_hat).toBe(0)
    expect(FARMING_ITEM_MIN_PRICES.witch_hat).toBeGreaterThanOrEqual(10)
  })

  it('EQUIPPABLE_PLANT_ITEMS contiene la definición de witch_hat para kernelpult', () => {
    const itemDef = EQUIPPABLE_PLANT_ITEMS.witch_hat
    expect(itemDef).toBeDefined()
    expect(itemDef.targetPlantId).toBe('kernelpult')
    expect(itemDef.equippedPlantName).toBe('Lanzamaíz Bruja')
    expect(itemDef.statBonusText).toContain('+200 HP')
    expect(itemDef.statBonusText).toContain('+25 Daño')
  })

  it('Lanzamaíz base sin sombrero mantiene estadísticas originales', () => {
    const baseConfig = PLANT_CONFIGS.kernelpult
    const scaled = getScaledPlantConfig('kernelpult', 0, null)

    expect(scaled.maxHp).toBe(baseConfig.maxHp)
    expect(scaled.damage).toBe(baseConfig.damage)
    expect(scaled.sprite).toBe(baseConfig.sprite)
    expect(scaled.icon).toBe(baseConfig.icon)
  })

  it('Lanzamaíz con Sombrero de Bruja gana +200 HP, +25 DMG y cambia de asset', () => {
    const baseConfig = PLANT_CONFIGS.kernelpult
    const equipped = getScaledPlantConfig('kernelpult', 0, 'witch_hat')

    expect(equipped.maxHp).toBe(baseConfig.maxHp + 200)
    expect(equipped.damage).toBe((baseConfig.damage ?? 0) + 25)
    expect(equipped.sprite).toBe('/game-assets/auction/kernel_witch.png')
    expect(equipped.icon).toBe('/game-assets/auction/kernel_witch.png')
    expect(equipped.packetActive).toBe('/game-assets/auction/kernel_witch.png')
    expect(equipped.packetDisabled).toBe('/game-assets/auction/kernel_witch.png')
  })

  it('El sombrero de bruja se suma acumulativamente a las fusiones de Lanzamaíz', () => {
    // Con rolls de fusión: 1 roll de daño (+15%) y 1 roll de salud (+15%)
    const fusedWithoutHat = getScaledPlantConfig('kernelpult', ['damage', 'hp'], null)
    const fusedWithHat = getScaledPlantConfig('kernelpult', ['damage', 'hp'], 'witch_hat')

    // El bonus del sombrero (+200 HP, +25 DMG) debe sumarse al resultado de la fusión
    expect(fusedWithHat.maxHp).toBe(fusedWithoutHat.maxHp + 200)
    expect(fusedWithHat.damage).toBe((fusedWithoutHat.damage ?? 0) + 25)
    expect(fusedWithHat.sprite).toBe('/game-assets/auction/kernel_witch.png')
  })

  it('El sombrero de bruja NO aplica bonuses a otras plantas (exclusivo para Lanzamaíz)', () => {
    const peaBase = PLANT_CONFIGS.peashooter
    const peaWithHat = getScaledPlantConfig('peashooter', 0, 'witch_hat')

    expect(peaWithHat.maxHp).toBe(peaBase.maxHp)
    expect(peaWithHat.damage).toBe(peaBase.damage)
    expect(peaWithHat.sprite).toBe(peaBase.sprite)
    expect(peaWithHat.icon).toBe(peaBase.icon)

    const bonkBase = PLANT_CONFIGS.bonkchoy
    const bonkWithHat = getScaledPlantConfig('bonkchoy', 0, 'witch_hat')

    expect(bonkWithHat.maxHp).toBe(bonkBase.maxHp)
    expect(bonkWithHat.damage).toBe(bonkBase.damage)
    expect(bonkWithHat.sprite).toBe(bonkBase.sprite)
  })

  it('El mazo de la sala preserva y resuelve el sombrero de bruja para Lanzamaíz', async () => {
    const { leerMazo, mejorasDeLaCartaEnSlot } = await import('../engine/mazoDeLaSala')
    const { crearPlantaPropia } = await import('../engine/simulate')

    const rawDeck = [
      { plantId: 'peashooter', slot: 0, level: 0, statRolls: [] },
      { plantId: 'kernelpult', slot: 1, level: 1, statRolls: ['damage'], equippedItem: 'witch_hat' },
    ]

    const mazo = leerMazo(rawDeck)
    expect(mazo).toHaveLength(2)
    expect(mazo![1].equippedItem).toBe('witch_hat')

    const mejoras = mejorasDeLaCartaEnSlot(mazo, 'kernelpult', 1)
    expect(mejoras.equippedItem).toBe('witch_hat')

    const mockState: any = { tick: 10, entityCounter: 0 }
    const planta = crearPlantaPropia(mockState, 'kernelpult', 0, 2, mejoras.statRolls, mejoras.level, mejoras.equippedItem)
    expect(planta.equippedItem).toBe('witch_hat')
    expect(planta.spriteOverride).toBe('/game-assets/auction/kernel_witch.png')
    expect(planta.maxHp).toBeGreaterThan(PLANT_CONFIGS.kernelpult.maxHp)
    expect(planta.damage).toBeGreaterThan(PLANT_CONFIGS.kernelpult.damage!)
  })

  it('La reconstrucción asíncrona (reconstruirPartidaAsync) preserva el sombrero de bruja sin degradar la planta', async () => {
    const { validarYNormalizarAccionesP1Ranked } = await import('../engine/asyncP1History')

    const rawActions = [
      {
        seq: 1,
        issuedTick: 10,
        tick: 16,
        kind: 'plant',
        plantId: 'kernelpult',
        slot: 1,
        lane: 1,
        col: 0,
        statRolls: ['damage'],
        level: 1,
        equippedItem: 'witch_hat',
      },
    ]

    const valRes = validarYNormalizarAccionesP1Ranked(rawActions)
    expect(valRes.ok).toBe(true)
    if (valRes.ok) {
      expect(valRes.acciones[0].equippedItem).toBe('witch_hat')
    }

    const { reconstruirHasta } = await import('../engine/reconstruir')
    const jugadas: any[] = [
      {
        id: 1,
        mia: true,
        tick: 10,
        kind: 'plant',
        plantId: 'kernelpult',
        lane: 1,
        col: 0,
        statRolls: ['damage'],
        level: 1,
        equippedItem: 'witch_hat',
      },
    ]

    const estado = reconstruirHasta(12345, jugadas, 50)
    const maiz = estado.plants.find((p) => p.plantId === 'kernelpult')
    expect(maiz).toBeDefined()
    expect(maiz?.equippedItem).toBe('witch_hat')
    expect(maiz?.spriteOverride).toBe('/game-assets/auction/kernel_witch.png')
  })
})
