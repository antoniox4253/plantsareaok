import { describe, it, expect } from 'vitest'
import { createBattleState, crearPlantaDelRival, crearPlantaPropia } from './simulate'
import { NIVEL_POR_DEFECTO } from './bot'
import { PLANT_CONFIGS, getScaledPlantConfig } from '../utils/gameConstants'
import type { PlantId } from '../types/game'

describe('NPC Fortresses layouts and configurations', () => {
  it('all standard NPC plant types exist in PLANT_CONFIGS and have valid scaled configs', () => {
    const plants: PlantId[] = [
      'bonkchoy',
      'twinsunflower',
      'sunflower',
      'repeater',
      'iceberglettuce',
      'tallnut',
      'garlic',
      'wallnut',
      'peashooter',
    ]

    for (const p of plants) {
      expect(PLANT_CONFIGS[p]).toBeDefined()
      expect(PLANT_CONFIGS[p].category).toBeDefined()
      const scaled = getScaledPlantConfig(p, ['damage', 'hp', 'attackSpeed'])
      expect(scaled).toBeDefined()
      expect(scaled.category).toBeDefined()
      expect(scaled.maxHp).toBeGreaterThan(0)
    }
  })

  it('can spawn all plants in a 5-lane battle state without throwing', () => {
    const state = createBattleState(
      42,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1500,
      1500,
      null,
      null,
      5,
      true
    )

    const plants: (PlantId | string)[] = [
      'bonkchoy',
      'twinsunflower',
      'sunflower',
      'repeater',
      'iceberglettuce',
      'tallnut',
      'garlic',
      'wallnut',
      'peashooter',
      'snowpea', // legacy fallback test
    ]

    for (let lane = 0; lane < 5; lane++) {
      for (const plantId of plants) {
        expect(() => {
          const entity = crearPlantaDelRival(state, plantId as PlantId, lane, 2, ['hp'], 2)
          state.enemyPlants.push(entity)
        }).not.toThrow()
        expect(() => {
          const ownEntity = crearPlantaPropia(state, plantId as PlantId, lane, 1, ['damage'], 1)
          state.plants.push(ownEntity)
        }).not.toThrow()
      }
    }

    expect(state.enemyPlants.length).toBe(50)
    expect(state.plants.length).toBe(50)
  })

  it('safely handles unknown plant ids via peashooter fallback', () => {
    const fallback = getScaledPlantConfig('unknown_plant_xyz' as any)
    expect(fallback).toBeDefined()
    expect(fallback.id).toBe('peashooter')
    expect(fallback.category).toBe('ranged')

    const legacySnowpea = getScaledPlantConfig('snowpea')
    expect(legacySnowpea).toBeDefined()
    expect(legacySnowpea.category).toBe('ranged')
  })
})
