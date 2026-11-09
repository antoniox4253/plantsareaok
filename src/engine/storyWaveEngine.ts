import type { PlantEntity, ProjectileEntity, PlantId } from '../types/game.ts'
import { BASE_RIGHT_START_X } from '../utils/gameConstants.ts'
import { entityId, createRng, nextFloat } from './rng.ts'
import type { GameState, SonarFn } from './simulate.ts'
import { msToTicks } from './time.ts'

export type MapacheKey = 'pumpum' | 'garritas' | 'punos' | 'navajas' | 'reygarra'

export interface StoryEnemySpawn {
  tick: number
  lane: number
  mapacheKey: MapacheKey
  moveSpeed?: number
  hpMultiplier?: number
  damageMultiplier?: number
  isBoss?: boolean
}

export interface StoryWave {
  waveNumber: 1 | 2 | 3
  name: string
  subtitle: string
  startTick: number
  spawns: StoryEnemySpawn[]
}

export interface StoryLevelConfig {
  level: number
  totalWaves: 3
  waves: [StoryWave, StoryWave, StoryWave]
  allowedMapaches: MapacheKey[]
  rewards: {
    gold: number
    gems: number
    tokens: number
  }
}

/**
 * Mapeo de fallback para compatibilidad con el motor base.
 */
export function mapacheToPlantId(key: MapacheKey): PlantId {
  switch (key) {
    case 'pumpum':
      return 'peashooter'
    case 'garritas':
      return 'bonkchoy'
    case 'punos':
      return 'bonkchoy'
    case 'navajas':
      return 'repeater'
    case 'reygarra':
      return 'bonkchoy'
  }
}

/**
 * Conjunto de mapaches permitidos por nivel según las reglas estrictas del usuario:
 * - Niveles 1 al 5: Solo Mapache 1 (PumPum) y 2 (Garritas).
 * - Niveles 6 al 10: Mapaches 2 (Garritas), 3 (Puños) y 4 (Navajas).
 * - Niveles 11 al 20: Todos los mapaches (PumPum, Garritas, Puños, Navajas) en dificultades progresivas.
 */
export function getAllowedMapachesForLevel(level: number): MapacheKey[] {
  if (level <= 5) {
    return ['pumpum', 'garritas']
  }
  if (level <= 10) {
    return ['garritas', 'punos', 'navajas']
  }
  return ['pumpum', 'garritas', 'punos', 'navajas']
}

export function getMapacheBaseHp(key: MapacheKey): number {
  switch (key) {
    case 'pumpum':
      return 350
    case 'garritas':
      return 400
    case 'punos':
      return 750
    case 'navajas':
      return 380
    case 'reygarra':
      return 2200
  }
}

export function getMapacheBaseDamage(key: MapacheKey): number {
  switch (key) {
    case 'pumpum':
      return 45
    case 'garritas':
      return 40
    case 'punos':
      return 65
    case 'navajas':
      return 50
    case 'reygarra':
      return 120
  }
}

export function getMapacheBaseSpeed(key: MapacheKey): number {
  switch (key) {
    case 'pumpum':
      return 1.8
    case 'garritas':
      return 3.2
    case 'punos':
      return 2.2
    case 'navajas':
      return 2.8
    case 'reygarra':
      return 1.4
  }
}

/**
 * Genera la configuración de las 3 oleadas de un nivel en Modo Historia:
 * - Determinista mediante semilla RNG
 * - 3 oleadas por nivel
 * - El Jefe Final (Rey Garra) SIEMPRE sale en la 3era oleada
 */
export function generateStoryLevel(level: number, seed: number = 1000 + level): StoryLevelConfig {
  const lanesCount = 3
  const rng = createRng(seed ^ (level * 7919))
  const nextRng = () => nextFloat(rng)

  const allowedMapaches = getAllowedMapachesForLevel(level)
  const hpMult = 1.0 + (level - 1) * 0.12
  const dmgMult = 1.0 + (level - 1) * 0.08

  const pickEnemy = (): MapacheKey => {
    const idx = Math.floor(nextRng() * allowedMapaches.length)
    return allowedMapaches[idx] || allowedMapaches[0]
  }

  // ── OLEADA 1: INCURSIÓN DIRECTA (Sin economía previa) ──────────────────────
  const w1Count = Math.min(8, 3 + Math.floor(level / 3))
  const wave1Spawns: StoryEnemySpawn[] = []
  let w1Tick = 90 // Comienza a los ~3s directamente por oleadas

  for (let i = 0; i < w1Count; i++) {
    const mapacheKey = pickEnemy()
    const lane = (i * 2 + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave1Spawns.push({
      tick: w1Tick,
      lane,
      mapacheKey,
      moveSpeed: getMapacheBaseSpeed(mapacheKey),
      hpMultiplier: hpMult,
      damageMultiplier: dmgMult,
    })
    const delay = Math.max(75, 140 - level * 3 + Math.floor(nextRng() * 40))
    w1Tick += delay
  }

  const wave1: StoryWave = {
    waveNumber: 1,
    name: 'Oleada 1 (Incursión)',
    subtitle: 'Repele la primera oleada mapache',
    startTick: 90,
    spawns: wave1Spawns,
  }

  // ── OLEADA 2: EMBOSCADA Y PRESIÓN ──────────────────────────────────────────
  const w2Count = Math.min(14, 5 + Math.floor(level / 2))
  const wave2Spawns: StoryEnemySpawn[] = []
  let w2Tick = Math.max(w1Tick + 90, 800)

  for (let i = 0; i < w2Count; i++) {
    const mapacheKey = pickEnemy()
    const lane = (i * 2 + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave2Spawns.push({
      tick: w2Tick,
      lane,
      mapacheKey,
      moveSpeed: getMapacheBaseSpeed(mapacheKey),
      hpMultiplier: hpMult,
      damageMultiplier: dmgMult,
    })

    // Ataque coordinado en niveles >= 8 cada 3 mapaches
    if (level >= 8 && i > 0 && i % 3 === 0) {
      const secondLane = (lane + 1 + Math.floor(nextRng() * (lanesCount - 1))) % lanesCount
      const secondMapache = pickEnemy()
      wave2Spawns.push({
        tick: w2Tick,
        lane: secondLane,
        mapacheKey: secondMapache,
        moveSpeed: getMapacheBaseSpeed(secondMapache),
        hpMultiplier: hpMult,
        damageMultiplier: dmgMult,
      })
    }

    const delay = Math.max(60, 110 - level * 2 + Math.floor(nextRng() * 30))
    w2Tick += delay
  }

  const wave2: StoryWave = {
    waveNumber: 2,
    name: 'Oleada 2 (Emboscada)',
    subtitle: 'Asalto de refuerzos en los 3 carriles',
    startTick: Math.max(w1Tick + 90, 800),
    spawns: wave2Spawns,
  }

  // ── OLEADA 3: OLEADA FINAL CON EL JEFE REY GARRA ───────────────────────────
  const w3Count = Math.min(16, 6 + Math.floor(level / 2))
  const wave3Spawns: StoryEnemySpawn[] = []
  let w3Tick = Math.max(w2Tick + 120, 1600)

  // Escolta previa al jefe
  for (let i = 0; i < w3Count; i++) {
    const mapacheKey = pickEnemy()
    const lane = (i + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave3Spawns.push({
      tick: w3Tick,
      lane,
      mapacheKey,
      moveSpeed: getMapacheBaseSpeed(mapacheKey),
      hpMultiplier: hpMult * 1.1,
      damageMultiplier: dmgMult * 1.05,
    })
    const delay = Math.max(45, 80 - level * 2 + Math.floor(nextRng() * 25))
    w3Tick += delay
  }

  // EL JEFE FINAL REY GARRA APARECE EN LA OLEADA 3 EN EL CARRIL CENTRAL (LANE 1)
  const bossHpMultiplier = hpMult * (1.2 + level * 0.08)
  const bossDamageMultiplier = dmgMult * 1.2
  const bossLane = 1 // Carril central en un tablero de 3 líneas (0, 1, 2)
  wave3Spawns.push({
    tick: w3Tick + 30,
    lane: bossLane,
    mapacheKey: 'reygarra',
    moveSpeed: getMapacheBaseSpeed('reygarra'),
    hpMultiplier: bossHpMultiplier,
    damageMultiplier: bossDamageMultiplier,
    isBoss: true,
  })

  // Escolta pesada que acompaña al Rey Garra (carriles flanqueantes 0 y 2)
  wave3Spawns.push({
    tick: w3Tick + 45,
    lane: 0,
    mapacheKey: allowedMapaches.includes('punos') ? 'punos' : 'garritas',
    moveSpeed: 2.2,
    hpMultiplier: hpMult,
    damageMultiplier: dmgMult,
  })
  wave3Spawns.push({
    tick: w3Tick + 45,
    lane: 2,
    mapacheKey: allowedMapaches.includes('pumpum') ? 'pumpum' : 'garritas',
    moveSpeed: 2.0,
    hpMultiplier: hpMult,
    damageMultiplier: dmgMult,
  })

  const wave3: StoryWave = {
    waveNumber: 3,
    name: 'Oleada 3 (Jefe Final)',
    subtitle: '👑 ¡REY GARRA HA LLEGADO!',
    startTick: Math.max(w2Tick + 150, 2600),
    spawns: wave3Spawns,
  }

  return {
    level,
    totalWaves: 3,
    waves: [wave1, wave2, wave3],
    allowedMapaches,
    rewards: {
      gold: 150 + level * 50,
      gems: 10 + Math.floor(level * 2.5),
      tokens: 15 + level * 5,
    },
  }
}

/**
 * Instancia una entidad enemiga mapache en el motor de combate.
 */
export function spawnStoryEnemyEntity(
  state: GameState,
  spawn: StoryEnemySpawn,
  level: number
): PlantEntity {
  const baseHp = getMapacheBaseHp(spawn.mapacheKey)
  const scaledHp = Math.round(baseHp * (spawn.hpMultiplier ?? 1))
  const baseDmg = getMapacheBaseDamage(spawn.mapacheKey)
  const scaledDmg = Math.round(baseDmg * (spawn.damageMultiplier ?? 1))
  const plantId = mapacheToPlantId(spawn.mapacheKey)

  const entity: PlantEntity = {
    id: entityId(`mapache-${spawn.mapacheKey}`, state.tick, state.entityCounter++),
    plantId,
    mapacheKey: spawn.mapacheKey,
    level,
    statRolls: [],
    lane: spawn.lane,
    x: BASE_RIGHT_START_X - 1,
    hp: scaledHp,
    maxHp: scaledHp,
    damage: scaledDmg,
    attackSpeedMs: spawn.mapacheKey === 'garritas' ? 800 : spawn.mapacheKey === 'punos' ? 1000 : 1200,
    moveSpeed: spawn.moveSpeed ?? getMapacheBaseSpeed(spawn.mapacheKey),
    isWalking: true,
    state: 'walking',
    lastActionTime: state.tick,
    isBoss: Boolean(spawn.isBoss),
  }

  return entity
}

/**
 * Procesa la lógica de oleadas del Modo Historia en cada tic:
 * - Genera apariciones programadas de mapaches
 * - Gestiona el paso de Oleada 1 -> Oleada 2 -> Oleada 3 (Jefe Rey Garra)
 * - Ejecuta las habilidades únicas de los 5 Mapaches
 * - Detecta victoria total al derrotar al Rey Garra y a todos los mapaches
 */
export function processStoryWaves(
  state: GameState,
  sonar: SonarFn
): void {
  if (!state.isStoryMode || !state.storyConfig) return

  // 1. Desencadenar apariciones programadas de la oleada activa
  if (state.storySpawnsQueue && state.storySpawnsQueue.length > 0) {
    const disparar: StoryEnemySpawn[] = []
    const pendientes: StoryEnemySpawn[] = []

    for (const spawn of state.storySpawnsQueue) {
      if (spawn.tick <= state.tick) {
        disparar.push(spawn)
      } else {
        pendientes.push(spawn)
      }
    }

    if (disparar.length > 0) {
      state.storySpawnsQueue = pendientes
      for (const sp of disparar) {
        const entity = spawnStoryEnemyEntity(state, sp, state.storyConfig.level)
        state.enemyPlants.push(entity)
        if (sp.isBoss) {
          sonar('level_select', 1.0)
        } else {
          sonar('plantation', 0.6)
        }
      }
    }
  }

  const currentWaveIdx = state.storyWaveIndex ?? 0
  const livingEnemies = state.enemyPlants.filter((p: PlantEntity) => p.hp > 0).length
  const spawnsLeftInCurrentWave = (state.storySpawnsQueue || []).length

  // 2. Transición de Oleadas:
  if (currentWaveIdx === 0) {
    const wave2 = state.storyConfig.waves[1]
    const shouldStartWave2 = (spawnsLeftInCurrentWave === 0 && livingEnemies === 0) || state.tick >= wave2.startTick
    if (shouldStartWave2 && state.tick >= 270) {
      state.storyWaveIndex = 1
      state.wave = 2
      state.waveBanner = '🦝 ¡OLEADA 2 (EMBOSCADA)!'
      state.pending.push({ atTick: state.tick + 90, kind: 'clear_wave_banner' })
      sonar('pea_hit', 0.8)
      const offset = Math.max(0, state.tick - wave2.startTick)
      state.storySpawnsQueue = wave2.spawns.map((s: StoryEnemySpawn) => ({
        ...s,
        tick: Math.max(state.tick + 30, s.tick + offset),
      }))
    }
  } else if (currentWaveIdx === 1) {
    const wave3 = state.storyConfig.waves[2]
    const shouldStartWave3 = (spawnsLeftInCurrentWave === 0 && livingEnemies === 0) || state.tick >= wave3.startTick
    if (shouldStartWave3 && state.tick >= 540) {
      state.storyWaveIndex = 2
      state.wave = 3
      state.waveBanner = '👑 ¡OLEADA 3: JEFE FINAL REY GARRA!'
      state.pending.push({ atTick: state.tick + 120, kind: 'clear_wave_banner' })
      sonar('level_select', 1.0)
      const offset = Math.max(0, state.tick - wave3.startTick)
      state.storySpawnsQueue = wave3.spawns.map((s: StoryEnemySpawn) => ({
        ...s,
        tick: Math.max(state.tick + 45, s.tick + offset),
      }))
    }
  } else if (currentWaveIdx === 2) {
    if (spawnsLeftInCurrentWave === 0) {
      state.storyWavesCompleted = true
    }
  }

  // 3. Procesar Habilidades Especiales de los 5 Mapaches:
  for (const enemy of state.enemyPlants) {
    if (enemy.hp <= 0 || !enemy.mapacheKey) continue

    // 🐾 HABILIDAD DE GARRITAS: Salto acrobático sobre defensas
    if (enemy.mapacheKey === 'garritas' && !enemy.hasJumped) {
      const plantEnfrente = state.plants.find(
        (p) => p.lane === enemy.lane && p.hp > 0 && Math.abs(p.x - enemy.x) <= 6.5
      )
      if (plantEnfrente && (plantEnfrente.plantId === 'wallnut' || plantEnfrente.plantId === 'tallnut')) {
        // Ejecutar salto por encima de la nuez
        enemy.x = Math.max(16, plantEnfrente.x - 7.5)
        enemy.hasJumped = true
        sonar('plantation', 0.8)
      }
    }

    // 🥊 HABILIDAD DE PUÑOS: Modo Furia
    if (enemy.mapacheKey === 'punos') {
      if (enemy.isFury && enemy.furyEndTick && state.tick >= enemy.furyEndTick) {
        enemy.isFury = false
      }
    }

    // 💣 HABILIDAD DE PUMPUM: Disparo de balas de cañón explosivas
    if (enemy.mapacheKey === 'pumpum') {
      const targetPlant = state.plants
        .filter((p) => p.lane === enemy.lane && p.hp > 0 && p.x < enemy.x)
        .sort((a, b) => b.x - a.x)[0]

      const dist = targetPlant ? enemy.x - targetPlant.x : (enemy.x - 15)
      if (dist >= 12 && dist <= 38) {
        if (state.tick - (enemy.lastShootTick || 0) >= msToTicks(3200)) {
          enemy.lastShootTick = state.tick
          enemy.state = 'attacking'
          const targetX = targetPlant ? targetPlant.x : 15
          const newProj: ProjectileEntity = {
            id: entityId('cannonball', state.tick, state.entityCounter++),
            type: 'cannonball',
            targetTeam: 'p1',
            lane: enemy.lane,
            originLane: enemy.lane,
            originX: enemy.x,
            targetX,
            x: enemy.x,
            y: 20 + enemy.lane * 19.33 + 7,
            speed: 24,
            damage: enemy.damage || 55,
            isSplash: true,
          }
          state.projectiles.push(newProj)
          sonar('pea_shoot', 0.8)
        }
      }
    }

    // 🗡️ HABILIDAD DE NAVAJAS: Cuchillos voladores a distancia
    if (enemy.mapacheKey === 'navajas') {
      const targetPlant = state.plants
        .filter((p) => p.lane === enemy.lane && p.hp > 0 && p.x < enemy.x)
        .sort((a, b) => b.x - a.x)[0]

      const dist = targetPlant ? enemy.x - targetPlant.x : (enemy.x - 15)
      if (dist >= 14 && dist <= 42) {
        if (state.tick - (enemy.lastShootTick || 0) >= msToTicks(2400)) {
          enemy.lastShootTick = state.tick
          enemy.state = 'attacking'
          const targetX = targetPlant ? targetPlant.x : 15
          const newProj: ProjectileEntity = {
            id: entityId('knife', state.tick, state.entityCounter++),
            type: 'knife',
            targetTeam: 'p1',
            lane: enemy.lane,
            originLane: enemy.lane,
            originX: enemy.x,
            targetX,
            x: enemy.x,
            y: 20 + enemy.lane * 19.33 + 7,
            speed: 36,
            damage: enemy.damage || 45,
          }
          state.projectiles.push(newProj)
          sonar('pea_shoot', 0.7)
        }
      }
    }

    // 👑 HABILIDAD DEL REY GARRA: Rugido y llamada de esbirros
    if (enemy.mapacheKey === 'reygarra' && enemy.isBoss) {
      // Rugido potenciador cada 12 segundos (~360 tics)
      if (state.tick > 0 && state.tick % msToTicks(12000) === 0) {
        for (const ally of state.enemyPlants) {
          if (ally.hp > 0) {
            ally.isCommandoAura = true
            ally.commandoAuraEndTick = state.tick + msToTicks(5000)
          }
        }
        sonar('level_select', 0.9)
      }

      // Invocación de Garritas cada 18 segundos (~540 tics) en uno de los 3 carriles
      if (state.tick > 0 && state.tick % msToTicks(18000) === 0 && livingEnemies < 8) {
        const lanesPool = [0, 1, 2]
        const summonLane = lanesPool[Math.floor(nextFloat(state.rng) * lanesPool.length)]
        const summonSpawn: StoryEnemySpawn = {
          tick: state.tick,
          lane: summonLane,
          mapacheKey: 'garritas',
          moveSpeed: 3.2,
          hpMultiplier: 1.0,
          damageMultiplier: 1.0,
        }
        const minion = spawnStoryEnemyEntity(state, summonSpawn, state.storyConfig.level)
        state.enemyPlants.push(minion)
        sonar('plantation', 0.7)
      }
    }
  }

  // Verificación de Derrota en Story: Si el árbol madre del jugador cae a 0 HP
  if (state.p1BaseHp <= 0) {
    if (state.status === 'playing') {
      state.status = 'defeat'
    }
    return
  }

  // 4. Verificación de Victoria: Las 3 oleadas se completaron Y no quedan enemigos vivos (incluido el Rey Garra) Y el jugador sobrevivió
  if (state.storyWavesCompleted && livingEnemies === 0 && state.status === 'playing' && state.p1BaseHp > 0) {
    state.status = 'victory'
    sonar('victory', 1.0)
  }
}
