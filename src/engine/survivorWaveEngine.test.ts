import { describe, it, expect } from 'vitest'
import {
  getSurvivorPoolForLevel,
  getCustomMoveSpeed,
  generateSurvivorLevel,
  spawnSurvivorEnemyEntity,
} from './survivorWaveEngine'
import { createBattleState, NIVEL_POR_DEFECTO } from './simulate'

describe('survivorWaveEngine', () => {
  it('correctly stages melee plant pools across levels', () => {
    // Levels 1-2: cactus (chomper) + bonk choy
    const pool1 = getSurvivorPoolForLevel(1)
    expect(pool1).toContain('chomper')
    expect(pool1).toContain('bonkchoy')
    expect(pool1).not.toContain('garlic')
    expect(pool1).not.toContain('ghostpepper')

    // Levels 3-4: + squash (garlic)
    const pool3 = getSurvivorPoolForLevel(3)
    expect(pool3).toContain('garlic')
    expect(pool3).not.toContain('ghostpepper')

    // Levels 5-6: + ghostpepper
    const pool5 = getSurvivorPoolForLevel(5)
    expect(pool5).toContain('ghostpepper')
    expect(pool5).not.toContain('explodeonut')

    // Levels 7-8: + explodeonut
    const pool7 = getSurvivorPoolForLevel(7)
    expect(pool7).toContain('explodeonut')
    expect(pool7).not.toContain('guacodile')

    // Levels 9-10: + guacodile
    const pool9 = getSurvivorPoolForLevel(9)
    expect(pool9).toContain('guacodile')
    expect(pool9).not.toContain('toadstool')

    // Levels 11-14: + toadstool
    const pool11 = getSurvivorPoolForLevel(11)
    expect(pool11).toContain('toadstool')
    expect(pool11).not.toContain('aloe')

    // Level 15+: aloe curanderas
    const pool15 = getSurvivorPoolForLevel(15)
    expect(pool15).toContain('aloe')
  })

  it('halves movement speeds for Guacodile and Toadstool', () => {
    // Guacodile standard speed is 6.2 -> reduced to 3.1
    expect(getCustomMoveSpeed('guacodile')).toBe(3.1)
    // Toadstool standard speed is 3.5 -> reduced to 1.75
    expect(getCustomMoveSpeed('toadstool')).toBe(1.75)
    // Other plants return undefined (use base config)
    expect(getCustomMoveSpeed('bonkchoy')).toBeUndefined()
    expect(getCustomMoveSpeed('chomper')).toBeUndefined()
  })

  it('generates 3 waves per level (Suave, Difícil, Con Presión)', () => {
    const config = generateSurvivorLevel(1, 12345)
    expect(config.level).toBe(1)
    expect(config.waves.length).toBe(3)

    // Wave 1: Suave
    expect(config.waves[0].waveNumber).toBe(1)
    expect(config.waves[0].name).toContain('Suave')
    expect(config.waves[0].spawns.length).toBeGreaterThanOrEqual(2)

    // Wave 2: Difícil
    expect(config.waves[1].waveNumber).toBe(2)
    expect(config.waves[1].name).toContain('Difícil')
    expect(config.waves[1].spawns.length).toBeGreaterThan(config.waves[0].spawns.length)

    // Wave 3: Con Presión
    expect(config.waves[2].waveNumber).toBe(3)
    expect(config.waves[2].name).toContain('Presión')
    expect(config.waves[2].spawns.length).toBeGreaterThanOrEqual(config.waves[1].spawns.length)
  })

  it('spawns enemy entity with appropriate speed and position', () => {
    const state = createBattleState(
      12345,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      3,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      1
    )

    const spawn = {
      tick: 50,
      plantId: 'guacodile' as const,
      lane: 1,
      moveSpeed: 3.1,
      isBacklineHealer: false,
    }

    const entity = spawnSurvivorEnemyEntity(state, spawn, 1)
    expect(entity.plantId).toBe('guacodile')
    expect(entity.lane).toBe(1)
    expect(entity.moveSpeed).toBe(3.1)
    expect(entity.isWalking).toBe(true)
  })

  it('places Aloe in backline (col = 11) for level 15+ support', () => {
    const state = createBattleState(
      12345,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      3,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      15
    )

    const aloeSpawn = {
      tick: 100,
      plantId: 'aloe' as const,
      lane: 2,
      isBacklineHealer: true,
    }

    const entity = spawnSurvivorEnemyEntity(state, aloeSpawn, 15)
    expect(entity.plantId).toBe('aloe')
    expect(entity.col).toBe(11) // Placed on enemy base line
    expect(entity.isWalking).toBe(false)
  })
})
