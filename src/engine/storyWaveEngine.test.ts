import { describe, it, expect } from 'vitest'
import {
  generateStoryLevel,
  getAllowedMapachesForLevel,
  getMapacheBaseHp,
  getMapacheBaseDamage,
  getMapacheBaseSpeed,
  mapacheToPlantId,
} from './storyWaveEngine'
import { createBattleState, stepTick } from './simulate'

describe('StoryWaveEngine - Reglas y Niveles', () => {
  it('Niveles 1 al 5 solo permiten mapache 1 (PumPum) y 2 (Garritas)', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const allowed = getAllowedMapachesForLevel(lvl)
      expect(allowed).toEqual(['pumpum', 'garritas'])

      const config = generateStoryLevel(lvl, 1000 + lvl)
      expect(config.totalWaves).toBe(3)
      expect(config.waves.length).toBe(3)

      // Oleadas 1 y 2 solo deben contener pumpum o garritas
      for (const spawn of config.waves[0].spawns) {
        expect(['pumpum', 'garritas']).toContain(spawn.mapacheKey)
      }
      for (const spawn of config.waves[1].spawns) {
        expect(['pumpum', 'garritas']).toContain(spawn.mapacheKey)
      }

      // Oleada 3 siempre contiene al jefe final Rey Garra
      const hasBossInWave3 = config.waves[2].spawns.some(
        (s) => s.mapacheKey === 'reygarra' && s.isBoss
      )
      expect(hasBossInWave3).toBe(true)
    }
  })

  it('Niveles 6 al 10 solo permiten mapaches 2 (Garritas), 3 (Puños) y 4 (Navajas)', () => {
    for (let lvl = 6; lvl <= 10; lvl++) {
      const allowed = getAllowedMapachesForLevel(lvl)
      expect(allowed).toEqual(['garritas', 'punos', 'navajas'])

      const config = generateStoryLevel(lvl, 1000 + lvl)
      for (const spawn of config.waves[0].spawns) {
        expect(['garritas', 'punos', 'navajas']).toContain(spawn.mapacheKey)
      }
      for (const spawn of config.waves[1].spawns) {
        expect(['garritas', 'punos', 'navajas']).toContain(spawn.mapacheKey)
      }

      // Oleada 3 contiene al Rey Garra
      const hasBossInWave3 = config.waves[2].spawns.some(
        (s) => s.mapacheKey === 'reygarra' && s.isBoss
      )
      expect(hasBossInWave3).toBe(true)
    }
  })

  it('Niveles 11 al 20 permiten todos los mapaches y jefe final en oleada 3', () => {
    for (let lvl = 11; lvl <= 20; lvl++) {
      const allowed = getAllowedMapachesForLevel(lvl)
      expect(allowed).toEqual(['pumpum', 'garritas', 'punos', 'navajas'])

      const config = generateStoryLevel(lvl, 1000 + lvl)
      const hasBossInWave3 = config.waves[2].spawns.some(
        (s) => s.mapacheKey === 'reygarra' && s.isBoss
      )
      expect(hasBossInWave3).toBe(true)
    }
  })

  it('generateStoryLevel es 100% determinista ante la misma semilla', () => {
    const c1 = generateStoryLevel(5, 4242)
    const c2 = generateStoryLevel(5, 4242)
    expect(c1).toEqual(c2)
  })

  it('las estadísticas base y mapeos de plantas son coherentes', () => {
    expect(getMapacheBaseHp('reygarra')).toBeGreaterThan(getMapacheBaseHp('punos'))
    expect(getMapacheBaseHp('punos')).toBeGreaterThan(getMapacheBaseHp('garritas'))
    expect(getMapacheBaseDamage('reygarra')).toBeGreaterThan(getMapacheBaseDamage('pumpum'))
    expect(getMapacheBaseSpeed('garritas')).toBeGreaterThan(getMapacheBaseSpeed('reygarra'))

    expect(mapacheToPlantId('pumpum')).toBe('peashooter')
    expect(mapacheToPlantId('garritas')).toBe('bonkchoy')
    expect(mapacheToPlantId('navajas')).toBe('repeater')
    expect(mapacheToPlantId('reygarra')).toBe('bonkchoy')
  })
})

describe('StoryWaveEngine - Simulación en el Motor', () => {
  it('inicializa el estado de combate en Modo Historia con 5 carriles y base invulnerable p2', () => {
    const state = createBattleState(
      1234,
      false,
      false,
      undefined,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5, // 5 carriles
      false,
      150, // soles iniciales
      undefined,
      undefined,
      undefined,
      false,
      1,
      true, // isStoryMode
      1 // storyLevel
    )

    expect(state.isStoryMode).toBe(true)
    expect(state.lanesCount).toBe(5)
    expect(state.p2BaseHp).toBe(99999)
    expect(state.sunBank).toBe(150)
    expect(state.storyConfig).toBeDefined()
    expect(state.storyWaveIndex).toBe(0)
    expect(state.storyWavesCompleted).toBe(false)
  })

  it('simula la aparición de mapaches y disparo de proyectiles de cañón / navaja', () => {
    const sonar = () => {}
    const state = createBattleState(
      1234,
      false,
      false,
      undefined,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5,
      false,
      200,
      undefined,
      undefined,
      undefined,
      false,
      1,
      true,
      1
    )

    // Avanzar 500 tics (~16 segundos) para que empiece la oleada 1
    for (let t = 0; t < 500; t++) {
      stepTick(state, sonar)
    }

    expect(state.enemyPlants.length).toBeGreaterThan(0)
    const primerEnemigo = state.enemyPlants[0]
    expect(primerEnemigo.mapacheKey).toBeDefined()
    expect(['pumpum', 'garritas']).toContain(primerEnemigo.mapacheKey)
  })

  it('si la base p1 cae a 0 HP en Modo Historia, el estado pasa a defeat', () => {
    const sonar = () => {}
    const state = createBattleState(
      1234,
      false,
      false,
      undefined,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5,
      false,
      150,
      undefined,
      undefined,
      undefined,
      false,
      1,
      true,
      1
    )

    state.p1BaseHp = 0
    stepTick(state, sonar)
    expect(state.status).toBe('defeat')
  })
})
