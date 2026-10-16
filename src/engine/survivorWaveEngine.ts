import type { PlantId, PlantEntity } from '../types/game'
import { getScaledPlantConfig, PLANT_CONFIGS, BASE_RIGHT_START_X } from '../utils/gameConstants'
import { entityId } from './rng'
import type { GameState, SonarFn } from './simulate'

export interface SurvivorEnemySpawn {
  tick: number
  lane: number
  plantId: PlantId
  moveSpeed?: number
  isBacklineHealer?: boolean
  hpMultiplier?: number
  damageMultiplier?: number
}

export interface SurvivorWave {
  waveNumber: 1 | 2 | 3
  name: string
  subtitle: string
  startTick: number
  spawns: SurvivorEnemySpawn[]
}

export interface SurvivorLevelConfig {
  level: number
  totalWaves: 3
  waves: [SurvivorWave, SurvivorWave, SurvivorWave]
  allowedPlants: PlantId[]
}

/**
 * Obtiene el conjunto de plantas melé enemigas según el nivel del jugador en Survivor ADS.
 *
 * Reglas de progresión estrictas:
 * - Niveles 1-2: Cactus ('chomper') y Bonk Choy ('bonkchoy')
 * - Niveles 3-4: Se añade Squash ('garlic', la planta de aplastamiento)
 * - Niveles 5-6: Se mezcla Chile Fantasma ('ghostpepper')
 * - Niveles 7-8: Se añade Nuez Explosiva ('explodeonut')
 * - Niveles 9-10: Se añade Guacodilo ('guacodile') pero con velocidad de avance reducida al 50%
 * - Niveles 11-14: Se añade Seta Sapo ('toadstool') también con velocidad de avance al 50%
 * - Niveles 15+: Aloes curanderas ('aloe') en la retaguardia enemiga (col 11) curando a las plantas que avanzan
 */
export function getSurvivorPoolForLevel(level: number): PlantId[] {
  if (level <= 2) {
    return ['chomper', 'bonkchoy']
  }
  if (level <= 4) {
    return ['chomper', 'bonkchoy', 'garlic']
  }
  if (level <= 6) {
    return ['chomper', 'bonkchoy', 'garlic', 'ghostpepper']
  }
  if (level <= 8) {
    return ['chomper', 'bonkchoy', 'garlic', 'ghostpepper', 'explodeonut']
  }
  if (level <= 10) {
    return ['chomper', 'bonkchoy', 'garlic', 'ghostpepper', 'explodeonut', 'guacodile']
  }
  if (level <= 14) {
    return ['chomper', 'bonkchoy', 'garlic', 'ghostpepper', 'explodeonut', 'guacodile', 'toadstool']
  }
  return ['chomper', 'bonkchoy', 'garlic', 'ghostpepper', 'explodeonut', 'guacodile', 'toadstool', 'aloe']
}

/**
 * Velocidad de avance equilibrada para plantas enemigas en Survivor ADS:
 * - Reduce la velocidad de desplazamiento a una cadencia de horda clásica tipo PvZ (~1.4 a 2.8 %/s),
 *   otorgando al jugador margen táctico para sembrar economía (girasoles), plantar defensas y disparar.
 * - Seta Sapo: 1.4 %/s (avance lento de emboscada)
 * - Cactus: 2.2 %/s (dispara espinas mientras avanza a paso constante)
 * - Chile Fantasma: 2.2 %/s (flotación espectral pausada)
 * - Guacodilo: 2.2 %/s (reducido a la mitad de su velocidad rápida para control de oleada)
 * - Bonk Choy: 2.4 %/s (avance pausado con puñetazos)
 * - Nuez Explosiva: 2.5 %/s (rodamiento moderado)
 * - Squash: 2.8 %/s (salto de aplastamiento)
 */
export function getCustomMoveSpeed(plantId: PlantId): number | undefined {
  switch (plantId) {
    case 'toadstool':
      return 1.4
    case 'chomper':
    case 'ghostpepper':
    case 'guacodile':
      return 2.2
    case 'bonkchoy':
      return 2.4
    case 'explodeonut':
      return 2.5
    case 'garlic':
      return 2.8
    default:
      return 2.2
  }
}

/**
 * Genera la configuración de las 3 oleadas de un nivel en Survivor ADS:
 *
 * Cadencia tipo PvZ:
 * - Oleada 1 (Suave): Pocas plantas espaciadas para que el jugador plante economía y defensas iniciales.
 * - Oleada 2 (Difícil): Escalada en número y variedad de plantas a través de los 3 carriles.
 * - Oleada 3 (¡Con Presión!): Oleada masiva final con enjambre continuo y a partir de Nivel 15 con Aloe curandera en la retaguardia.
 */
export function generateSurvivorLevel(level: number, seed: number): SurvivorLevelConfig {
  const allowedPlants = getSurvivorPoolForLevel(level)
  const lanesCount = 3 // Carriles 0, 1, 2

  // Pseudorandom determinista con la semilla para consistencia en repeticiones
  let currentSeed = (seed ^ (level * 397)) >>> 0
  const nextRng = (): number => {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0
    return currentSeed / 4294967296
  }

  const pickPlant = (pool: PlantId[]): PlantId => {
    const idx = Math.floor(nextRng() * pool.length)
    return pool[Math.min(idx, pool.length - 1)]
  }

  // Multiplicadores leves de salud y daño que escalan gradualmente con el nivel
  const hpMult = 1 + Math.max(0, level - 1) * 0.04
  const dmgMult = 1 + Math.max(0, level - 1) * 0.03

  // ── OLEADA 1: SUAVE ────────────────────────────────────────────────────────
  // Comienza a los 25 segundos (tick 750) para dar tiempo a plantar girasoles y economía inicial.
  // Genera entre 2 y 4 plantas separadas por 4 a 6 segundos (120 a 180 ticks).
  const wave1Count = Math.min(4, 2 + Math.floor(level / 8))
  const wave1Spawns: SurvivorEnemySpawn[] = []
  let w1Tick = 750 // 25s de gracia inicial para plantar girasoles

  for (let i = 0; i < wave1Count; i++) {
    const plantId = pickPlant(allowedPlants)
    const lane = (i + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave1Spawns.push({
      tick: w1Tick,
      lane,
      plantId,
      moveSpeed: getCustomMoveSpeed(plantId),
      hpMultiplier: hpMult,
      damageMultiplier: dmgMult,
    })
    w1Tick += 120 + Math.floor(nextRng() * 60) // 4s a 6s
  }

  const wave1: SurvivorWave = {
    waveNumber: 1,
    name: 'Oleada 1 (Suave)',
    subtitle: 'Suave',
    startTick: 750,
    spawns: wave1Spawns,
  }

  // ── OLEADA 2: DIFÍCIL ──────────────────────────────────────────────────────
  // Comienza a los ~53 segundos (tick 1600) o cuando se limpien los enemigos previos.
  // Genera entre 4 y 7 plantas con mayor frecuencia (2.5s a 3.5s / 75 a 105 ticks).
  const wave2Count = Math.min(7, 4 + Math.floor(level / 5))
  const wave2Spawns: SurvivorEnemySpawn[] = []
  let w2Tick = Math.max(w1Tick + 90, 1600)

  for (let i = 0; i < wave2Count; i++) {
    const plantId = pickPlant(allowedPlants)
    const lane = (i * 2 + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave2Spawns.push({
      tick: w2Tick,
      lane,
      plantId,
      moveSpeed: getCustomMoveSpeed(plantId),
      hpMultiplier: hpMult,
      damageMultiplier: dmgMult,
    })
    w2Tick += 75 + Math.floor(nextRng() * 30) // 2.5s a 3.5s
  }

  const wave2: SurvivorWave = {
    waveNumber: 2,
    name: 'Oleada 2 (Difícil)',
    subtitle: 'Difícil',
    startTick: Math.max(w1Tick + 90, 1600),
    spawns: wave2Spawns,
  }

  // ── OLEADA 3: ¡CON PRESIÓN! (OLEADA FINAL) ─────────────────────────────────
  // Comienza alrededor del segundo 83 (tick 2500).
  // Genera entre 6 y 12 plantas en oleadas densas rápidas (1.5s a 2.5s / 45 a 75 ticks).
  const wave3Count = Math.min(12, 6 + Math.floor(level / 3))
  const wave3Spawns: SurvivorEnemySpawn[] = []
  let w3Tick = Math.max(w2Tick + 90, 2500)
  const wave3StartTick = w3Tick

  // A partir del nivel 15: se colocan Aloes curanderas en la retaguardia enemiga (col 11)
  if (level >= 15) {
    // 1 Aloe en carril 1 o 2 Aloes en carriles 0 y 2
    wave3Spawns.push({
      tick: w3Tick,
      lane: 1,
      plantId: 'aloe',
      isBacklineHealer: true,
      hpMultiplier: hpMult * 1.5,
    })
    if (level >= 25) {
      wave3Spawns.push({
        tick: w3Tick,
        lane: 0,
        plantId: 'aloe',
        isBacklineHealer: true,
        hpMultiplier: hpMult * 1.5,
      })
    }
  }

  for (let i = 0; i < wave3Count; i++) {
    const plantId = pickPlant(allowedPlants)
    const lane = (i + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave3Spawns.push({
      tick: w3Tick,
      lane,
      plantId,
      moveSpeed: getCustomMoveSpeed(plantId),
      hpMultiplier: hpMult,
      damageMultiplier: dmgMult,
    })
    // Enjambre rápido: cada 45 a 70 ticks (1.5s a 2.3s)
    w3Tick += 45 + Math.floor(nextRng() * 25)
  }

  const wave3: SurvivorWave = {
    waveNumber: 3,
    name: 'Oleada 3 (¡Con Presión!)',
    subtitle: '¡Con Presión!',
    startTick: wave3StartTick,
    spawns: wave3Spawns,
  }

  return {
    level,
    totalWaves: 3,
    waves: [wave1, wave2, wave3],
    allowedPlants,
  }
}

/**
 * Instancia una planta enemiga de la oleada en el campo de batalla.
 */
export function spawnSurvivorEnemyEntity(
  state: GameState,
  spawn: SurvivorEnemySpawn,
  level: number
): PlantEntity {
  const config = getScaledPlantConfig(spawn.plantId, [], null)
  const baseHp = config.maxHp
  const scaledHp = Math.round(baseHp * (spawn.hpMultiplier ?? 1))
  const baseDmg = config.damage ?? 0
  const scaledDmg = Math.round(baseDmg * (spawn.damageMultiplier ?? 1))

  // Si es Aloe curandera de retaguardia, se ubica estática en la columna 11 (borde derecho de la base enemiga)
  const isBackline = Boolean(spawn.isBacklineHealer)
  const x = isBackline ? 82.5 : BASE_RIGHT_START_X - 1
  const isWalking = !isBackline

  const entity: PlantEntity = {
    id: entityId('survivor-rival', state.tick, state.entityCounter++),
    plantId: spawn.plantId,
    level,
    statRolls: [],
    lane: spawn.lane,
    col: isBackline ? 11 : undefined,
    x,
    hp: scaledHp,
    maxHp: scaledHp,
    damage: scaledDmg,
    attackSpeedMs: config.attackSpeedMs,
    moveSpeed: spawn.moveSpeed ?? config.moveSpeed,
    isWalking,
    state: isWalking ? 'walking' : 'idle',
    lastActionTime: state.tick,
    spriteOverride: config.sprite !== PLANT_CONFIGS[spawn.plantId]?.sprite ? config.sprite : undefined,
  }

  return entity
}

/**
 * Procesa la lógica de oleadas en cada tic para Survivor ADS:
 * - Desencadena las apariciones programadas de la oleada activa
 * - Gestiona el avance dinámico tipo PvZ si el jugador extermina una oleada antes de tiempo
 * - Maneja el anuncio y fanfare de "¡OLEADA FINAL!"
 * - Detecta victoria total cuando todas las oleadas terminaron y todos los enemigos fueron destruidos
 */
export function processSurvivorWaves(
  state: GameState,
  sonar: SonarFn
): void {
  if (!state.isSurvivorMode || !state.survivorConfig) return

  // 1. Desencadenar apariciones programadas de la oleada activa
  if (state.survivorSpawnsQueue && state.survivorSpawnsQueue.length > 0) {
    const disparar: SurvivorEnemySpawn[] = []
    const pendientes: SurvivorEnemySpawn[] = []

    for (const spawn of state.survivorSpawnsQueue) {
      if (spawn.tick <= state.tick) {
        disparar.push(spawn)
      } else {
        pendientes.push(spawn)
      }
    }

    if (disparar.length > 0) {
      state.survivorSpawnsQueue = pendientes
      for (const sp of disparar) {
        const entity = spawnSurvivorEnemyEntity(state, sp, state.survivorConfig.level)
        state.enemyPlants.push(entity)
        sonar('plantation', 0.6)
      }
    }
  }

  const currentWaveIdx = state.survivorWaveIndex ?? 0
  const livingEnemies = state.enemyPlants.filter((p: PlantEntity) => p.hp > 0).length
  const spawnsLeftInCurrentWave = (state.survivorSpawnsQueue || []).length

  // 2. Transición de Oleadas: Si se eliminan todas las plantas de la oleada actual
  //    o si se alcanza el tiempo de inicio de la siguiente oleada:
  if (currentWaveIdx === 0) {
    const wave2 = state.survivorConfig.waves[1]
    const shouldStartWave2 = (spawnsLeftInCurrentWave === 0 && livingEnemies === 0) || state.tick >= wave2.startTick
    if (shouldStartWave2 && state.tick >= 270) {
      state.survivorWaveIndex = 1
      state.wave = 2
      state.waveBanner = '¡OLEADA 2 (DIFÍCIL)!'
      state.pending.push({ atTick: state.tick + 90, kind: 'clear_wave_banner' })
      sonar('pea_hit', 0.8)
      // Ajustar ticks de los spawns de ola 2 al tiempo actual si comenzó antes
      const offset = Math.max(0, state.tick - wave2.startTick)
      state.survivorSpawnsQueue = wave2.spawns.map((s: SurvivorEnemySpawn) => ({
        ...s,
        tick: Math.max(state.tick + 30, s.tick + offset),
      }))
    }
  } else if (currentWaveIdx === 1) {
    const wave3 = state.survivorConfig.waves[2]
    const shouldStartWave3 = (spawnsLeftInCurrentWave === 0 && livingEnemies === 0) || state.tick >= wave3.startTick
    if (shouldStartWave3 && state.tick >= 540) {
      state.survivorWaveIndex = 2
      state.wave = 3
      state.waveBanner = '⚠️ ¡OLEADA FINAL!'
      state.pending.push({ atTick: state.tick + 120, kind: 'clear_wave_banner' })
      sonar('level_select', 0.9)
      const offset = Math.max(0, state.tick - wave3.startTick)
      state.survivorSpawnsQueue = wave3.spawns.map((s: SurvivorEnemySpawn) => ({
        ...s,
        tick: Math.max(state.tick + 45, s.tick + offset),
      }))
    }
  } else if (currentWaveIdx === 2) {
    if (spawnsLeftInCurrentWave === 0) {
      state.survivorWavesCompleted = true
    }
  }

  // Verificación de Derrota en Survivor: Si el árbol madre cae a 0 HP
  if (state.p1BaseHp <= 0) {
    if (state.status === 'playing') {
      state.status = 'defeat'
    }
    return
  }

  // 3. Verificación de Victoria: Las 3 oleadas se completaron Y no quedan enemigos vivos Y el árbol madre sigue vivo
  if (state.survivorWavesCompleted && livingEnemies === 0 && state.status === 'playing' && state.p1BaseHp > 0) {
    state.status = 'victory'
    sonar('level_select', 0.9)
  }
}

