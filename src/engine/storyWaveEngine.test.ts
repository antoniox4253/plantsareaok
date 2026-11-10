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
  it('inicializa el estado de combate en Modo Historia con 3 carriles y base invulnerable p2', () => {
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
      3, // 3 carriles como PvP
      false,
      250, // economía inicial de soles estilo PvZ / Survivor ADS
      undefined,
      undefined,
      undefined,
      false,
      1,
      true, // isStoryMode
      1 // storyLevel
    )

    expect(state.isStoryMode).toBe(true)
    expect(state.lanesCount).toBe(3)
    expect(state.p2BaseHp).toBe(99999)
    expect(state.sunBank).toBe(250)
    expect(state.storyConfig).toBeDefined()
    expect(state.storyWaveIndex).toBe(0)
    expect(state.storyWavesCompleted).toBe(false)

    // Todos los spawns del nivel deben operar estrictamente en los 3 carriles (0, 1, 2)
    for (const wave of state.storyConfig!.waves) {
      for (const spawn of wave.spawns) {
        expect([0, 1, 2]).toContain(spawn.lane)
      }
    }
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
      3,
      false,
      9999,
      undefined,
      undefined,
      undefined,
      false,
      1,
      true,
      1
    )

    // Avanzar 800 tics (~26.6 segundos) para que empiece la oleada 1 (inicio a 25s / 750 tics)
    for (let t = 0; t < 800; t++) {
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
  it('mapache melee (garritas) daña el árbol y desaparece al llegar a x<=16', () => {
    const sonar = () => {}
    const state = createBattleState(1234, false, false, undefined, 'auth-v2', 1000, 1000, null, null, 3, false, 250, undefined, undefined, undefined, false, 1, true, 1)

    // Colocar un Garritas cerca del árbol madre (x = 18) en carril 0 sin plantas defensivas
    state.enemyPlants.push({
      id: 'test_garritas',
      plantId: 'bonkchoy',
      mapacheKey: 'garritas',
      lane: 0,
      x: 18,
      hp: 200,
      maxHp: 200,
      damage: 25,
      moveSpeed: 3.2,
      lastActionTime: 0,
      isWalking: true,
      state: 'walking',
    })

    const initialTreeHp = state.p1BaseHp

    // Simular avance hacia el árbol (x <= 16)
    for (let t = 0; t < 60; t++) {
      stepTick(state, sonar)
    }

    // Debe haber dañado el árbol y muerto (hp = 0 o desaparecido)
    expect(state.p1BaseHp).toBeLessThan(initialTreeHp)
    const garritas = state.enemyPlants.find(e => e.id === 'test_garritas')
    expect(garritas?.hp ?? 0).toBe(0)
  })

    it('en Modo Historia las plantas a distancia NO disparan si no hay enemigos en su carril', () => {
    const sonar = () => {}
    const state = createBattleState(1234, false, false, undefined, 'auth-v2', 1000, 1000, null, null, 3, false, 250, undefined, undefined, undefined, false, 1, true, 1)

    // Colocar un Peashooter en el carril 0 a x=25 sin mapaches en ningún carril
    state.plants.push({
      id: 'peashooter_p1',
      plantId: 'peashooter',
      lane: 0,
      x: 25,
      hp: 300,
      maxHp: 300,
      lastActionTime: 0,
      isWalking: false,
      state: 'idle',
    })

    // Simular 50 tics (~1.6s, mayor a la cadencia de 1.2s)
    for (let t = 0; t < 50; t++) {
      stepTick(state, sonar)
    }

    // No debe haber disparado proyectiles porque el carril está vacío
    expect(state.projectiles.filter(p => p.lane === 0).length).toBe(0)

    // Ahora colocamos un enemigo en el carril 1 (distinto carril)
    state.enemyPlants.push({
      id: 'enemy_lane_1',
      plantId: 'bonkchoy',
      mapacheKey: 'garritas',
      lane: 1,
      x: 70,
      hp: 200,
      maxHp: 200,
      moveSpeed: 0,
      lastActionTime: 0,
      isWalking: true,
      state: 'walking',
    })

    for (let t = 0; t < 50; t++) {
      stepTick(state, sonar)
    }

    // Peashooter en carril 0 sigue sin disparar porque el enemigo está en el carril 1
    expect(state.projectiles.filter(p => p.lane === 0).length).toBe(0)

    // Ahora colocamos un mapache en el carril 0 delante del Peashooter (x=70)
    state.enemyPlants.push({
      id: 'enemy_lane_0',
      plantId: 'bonkchoy',
      mapacheKey: 'garritas',
      lane: 0,
      x: 70,
      hp: 200,
      maxHp: 200,
      moveSpeed: 0,
      lastActionTime: 0,
      isWalking: true,
      state: 'walking',
    })

    for (let t = 0; t < 50; t++) {
      stepTick(state, sonar)
    }

    // Ahora SÍ debe haber disparado proyectiles en el carril 0
    expect(state.projectiles.filter(p => p.lane === 0).length).toBeGreaterThan(0)
  })

  it('Threepeater en Modo Historia dispara si hay enemigo en su carril o en carriles adyacentes', () => {
    const sonar = () => {}
    const state = createBattleState(1234, false, false, undefined, 'auth-v2', 1000, 1000, null, null, 3, false, 250, undefined, undefined, undefined, false, 1, true, 1)

    // Threepeater en carril 1 (cubre 0, 1, 2)
    state.plants.push({
      id: 'threepeater_p1',
      plantId: 'threepeater',
      lane: 1,
      x: 25,
      hp: 300,
      maxHp: 300,
      lastActionTime: 0,
      isWalking: false,
      state: 'idle',
    })

    // Sin enemigos: no dispara
    for (let t = 0; t < 50; t++) {
      stepTick(state, sonar)
    }
    expect(state.projectiles.length).toBe(0)

    // Añadir enemigo en carril 0 (adyacente a carril 1)
    state.enemyPlants.push({
      id: 'enemy_lane_0',
      plantId: 'bonkchoy',
      mapacheKey: 'garritas',
      lane: 0,
      x: 75,
      hp: 200,
      maxHp: 200,
      moveSpeed: 0,
      lastActionTime: 0,
      isWalking: true,
      state: 'walking',
    })

    for (let t = 0; t < 50; t++) {
      stepTick(state, sonar)
    }

    // Debe disparar proyectiles cubriendo sus 3 carriles
    expect(state.projectiles.length).toBeGreaterThan(0)
  })

  it('en modo PvP (isStoryMode: false) las plantas a distancia sí disparan por un carril vacío hacia la base', () => {
    const sonar = () => {}
    // isStoryMode = false
    const state = createBattleState(1234, false, false, undefined, 'auth-v2', 1000, 1000, null, null, 3, false, 100, undefined, undefined, undefined, false, 1, false)

    state.plants.push({
      id: 'pvp_peashooter',
      plantId: 'peashooter',
      lane: 0,
      x: 25,
      hp: 300,
      maxHp: 300,
      lastActionTime: 0,
      isWalking: false,
      state: 'idle',
    })

    for (let t = 0; t < 50; t++) {
      stepTick(state, sonar)
    }

    // En PvP sí dispara para dañar la base rival
    expect(state.projectiles.filter(p => p.lane === 0).length).toBeGreaterThan(0)
  })
});