import { describe, it, expect } from 'vitest'
import {
  getSurvivorPoolForLevel,
  getCustomMoveSpeed,
  generateSurvivorLevel,
  spawnSurvivorEnemyEntity,
} from './survivorWaveEngine'
import { createBattleState, NIVEL_POR_DEFECTO, stepTick } from './simulate'

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

  it('tunes movement speeds for all melee enemy plants to a manageable zombie pace', () => {
    // Guacodile standard speed is 6.2 -> reduced to 2.2
    expect(getCustomMoveSpeed('guacodile')).toBe(2.2)
    // Toadstool standard speed is 3.5 -> reduced to 1.4
    expect(getCustomMoveSpeed('toadstool')).toBe(1.4)
    // Bonk Choy reduced to 2.4
    expect(getCustomMoveSpeed('bonkchoy')).toBe(2.4)
    // Cactus (chomper) reduced to 2.2
    expect(getCustomMoveSpeed('chomper')).toBe(2.2)
    // Squash (garlic) reduced to 2.8
    expect(getCustomMoveSpeed('garlic')).toBe(2.8)
    // Ghost pepper reduced to 2.2
    expect(getCustomMoveSpeed('ghostpepper')).toBe(2.2)
    // Explodeonut reduced to 2.5
    expect(getCustomMoveSpeed('explodeonut')).toBe(2.5)
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

  it('guarantees 25 seconds (750 ticks) grace period for sunflower planting before wave 1 attacks', () => {
    const config = generateSurvivorLevel(1, 9999)
    // 25s * 30 ticks/s = 750 ticks
    expect(config.waves[0].startTick).toBe(750)
    expect(config.waves[0].spawns[0].tick).toBeGreaterThanOrEqual(750)
  })

  it('applies normal (non-doubled) damage against player mother tree when melee plants attack in survivor mode', () => {
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
      true, // isSurvivorMode
      1
    )

    expect(state.isSurvivorMode).toBe(true)
    expect(state.p1BaseHp).toBe(1000)

    // Simulate an enemy melee plant reaching the base
    // Spawn an enemy cactus at lane 0 near P1 base
    state.enemyPlants.push({
      id: 'enemy-cactus-test',
      plantId: 'chomper',
      lane: 0,
      x: 10,
      hp: 100,
      maxHp: 100,
      lastActionTime: 0,
      isWalking: true,
      state: 'walking',
    })

    const initialHp = state.p1BaseHp
    // Cactus base damage is 40. Normal damage (40 damage) is applied without 2x multiplier.
    state.enemyPlants[0].x = 10.5
    stepTick(state, () => {})
    expect(state.p1BaseHp).toBe(initialHp - 40)
    // Cactus does NOT suicide; it remains alive attacking the base
    expect(state.enemyPlants[0].hp).toBe(100)
    expect(state.enemyPlants[0].state).toBe('attacking')
  })

  it('guarantees 250 initial suns exclusively in survivor mode', () => {
    // Survivor mode starts with 250 suns
    const survivorState = createBattleState(
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
      true, // isSurvivorMode
      1
    )
    expect(survivorState.sunBank).toBe(250)

    // Standard mode starts with 0 suns (INITIAL_SUN)
    const standardState = createBattleState(
      12345,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000
    )
    expect(standardState.sunBank).toBe(0)
  })

  it('strictly triggers defeat when mother tree falls and prevents false victory', () => {
    const state = createBattleState(
      12345,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      30, // Only 30 HP on tree
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

    state.enemyPlants.push({
      id: 'enemy-cactus-defeat',
      plantId: 'chomper',
      lane: 0,
      x: 10.5,
      hp: 100,
      maxHp: 100,
      lastActionTime: 0,
      isWalking: true,
      state: 'walking',
    })

    // Cactus deals 40 normal damage, reducing tree HP from 30 to 0
    stepTick(state, () => {})
    expect(state.p1BaseHp).toBe(0)
    expect(state.status).toBe('defeat')
  })

  it('requires p1BaseHp > 0 and livingEnemies === 0 for victory', () => {
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

    state.survivorWavesCompleted = true
    state.enemyPlants = [] // All enemies dead
    state.p1BaseHp = 500 // Tree is alive

    stepTick(state, () => {})
    expect(state.status).toBe('victory')
  })

  it('ramps up pressure starting from Level 6 with higher spawn density and simultaneous incursions', () => {
    const configLvl1 = generateSurvivorLevel(1, 12345)
    const configLvl6 = generateSurvivorLevel(6, 12345)

    // Level 6 has more spawns in Wave 1, Wave 2, and Wave 3 than Level 1
    expect(configLvl6.waves[0].spawns.length).toBeGreaterThan(configLvl1.waves[0].spawns.length)
    expect(configLvl6.waves[1].spawns.length).toBeGreaterThan(configLvl1.waves[1].spawns.length)
    expect(configLvl6.waves[2].spawns.length).toBeGreaterThan(configLvl1.waves[2].spawns.length)

    // Level 6 includes ghostpepper in its pool
    expect(configLvl6.allowedPlants).toContain('ghostpepper')

    // Level 6 Wave 3 features simultaneous multi-lane incursions (multiple spawns at the same tick)
    const wave3Spawns = configLvl6.waves[2].spawns
    const spawnTicks = wave3Spawns.map((s) => s.tick)
    const hasSimultaneousSpawns = spawnTicks.some((tick, idx) => spawnTicks.indexOf(tick) !== idx)
    expect(hasSimultaneousSpawns).toBe(true)

    // Level 6 has higher HP and Damage multipliers due to level pressure bonus
    const w3FirstSpawn = wave3Spawns[0]
    expect(w3FirstSpawn.hpMultiplier).toBeGreaterThan(1.2)
    expect(w3FirstSpawn.damageMultiplier).toBeGreaterThan(1.15)
  })

  it('removes player melee plants when they reach the rival end in survivor mode so they do not linger', () => {
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
      true, // isSurvivorMode
      1
    )

    // Add a player Bonk Choy marching right, near the rival base (x = 87.5)
    state.plants.push({
      id: 'p1-bonkchoy-test',
      plantId: 'bonkchoy',
      lane: 1,
      x: 87.5,
      hp: 600,
      maxHp: 600,
      lastActionTime: 0,
      isWalking: true,
      state: 'walking',
    })

    // Also add a player Toadstool marching right, near the rival base
    state.plants.push({
      id: 'p1-toadstool-test',
      plantId: 'toadstool',
      lane: 0,
      x: 87.5,
      hp: 500,
      maxHp: 500,
      lastActionTime: 0,
      isWalking: true,
      state: 'walking',
    })

    expect(state.plants.length).toBe(2)

    // Advance 1 tick
    stepTick(state, () => {})

    // In survivor mode, rival has no tree; player's melee plants reach the right end and MUST disappear
    expect(state.plants.find((p) => p.id === 'p1-bonkchoy-test')).toBeUndefined()
    expect(state.plants.find((p) => p.id === 'p1-toadstool-test')).toBeUndefined()
    expect(state.plants.length).toBe(0)
  })

  it('increases enemy plant quantity and difficulty significantly starting from Level 12', () => {
    const configLvl6 = generateSurvivorLevel(6, 12345)
    const configLvl12 = generateSurvivorLevel(12, 12345)

    // Level 12 has significantly more plants in all 3 waves than Level 6
    expect(configLvl12.waves[0].spawns.length).toBeGreaterThan(configLvl6.waves[0].spawns.length)
    expect(configLvl12.waves[1].spawns.length).toBeGreaterThan(configLvl6.waves[1].spawns.length)
    expect(configLvl12.waves[2].spawns.length).toBeGreaterThan(configLvl6.waves[2].spawns.length)

    // Wave 2 at Level 12 now contains simultaneous spawns
    const wave2SpawnTicks = configLvl12.waves[1].spawns.map((s) => s.tick)
    const hasW2Simultaneous = wave2SpawnTicks.some((tick, idx) => wave2SpawnTicks.indexOf(tick) !== idx)
    expect(hasW2Simultaneous).toBe(true)

    // Total plant count in Level 12 is over 45+ plants (vs ~30 in Level 6)
    const totalPlantsLvl12 = configLvl12.waves[0].spawns.length + configLvl12.waves[1].spawns.length + configLvl12.waves[2].spawns.length
    expect(totalPlantsLvl12).toBeGreaterThanOrEqual(45)

    // Health and damage multipliers are substantially higher
    const w3FirstSpawn = configLvl12.waves[2].spawns[0]
    expect(w3FirstSpawn.hpMultiplier).toBeGreaterThan(1.7)
    expect(w3FirstSpawn.damageMultiplier).toBeGreaterThan(1.6)
  })

  it('validates 9 P1 columns and 5 P2 columns for Survivor ADS while preserving 7/7 for ranked/standard', async () => {
    const { TOTAL_COLUMNS, P1_COLUMNS, P2_COLUMNS, SURVIVOR_P1_COLUMNS, SURVIVOR_P2_COLUMNS } = await import(
      '../utils/gameConstants'
    )

    // Standard / Ranked isolation
    expect(P1_COLUMNS).toBe(7)
    expect(P2_COLUMNS).toBe(7)
    expect(P1_COLUMNS + P2_COLUMNS).toBe(TOTAL_COLUMNS)

    // Survivor ADS dimensions
    expect(SURVIVOR_P1_COLUMNS).toBe(9)
    expect(SURVIVOR_P2_COLUMNS).toBe(5)
    expect(SURVIVOR_P1_COLUMNS + SURVIVOR_P2_COLUMNS).toBe(TOTAL_COLUMNS)
  })
})

