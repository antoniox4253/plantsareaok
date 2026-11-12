// Configuración de los 20 Niveles del Modo Historia (Invasión de los Mapaches)
// Reglas estrictas:
// - Niveles 1-5: Mapache 1 (PumPum) y 2 (Garritas) en diferentes líneas; Jefe Final (Rey Garra) en Oleada 3.
// - Niveles 6-10: Mapaches 2 (Garritas), 3 (Puños) y 4 (Navajas); Jefe Final en Oleada 3.
// - Niveles 11-20: Salen todos los mapaches (1, 2, 3, 4 + Rey Garra) con dificultad y oleadas escaladas.

import type { MapacheKey } from './mapachesData'

export interface MapacheSpawnPlan {
  delayMs: number
  key: MapacheKey
  lane: number // 0 a 4 (5 carriles estándar de jardín)
}

export interface StoryWaveConfig {
  waveNumber: 1 | 2 | 3
  title: string
  subtitle: string
  hasBoss?: boolean
  spawns: MapacheSpawnPlan[]
}

export interface StoryLevelConfig {
  level: number
  title: string
  description: string
  lanesCount: number
  allowedMapaches: MapacheKey[]
  bossMaxHp: number
  hpMultiplier: number
  damageMultiplier: number
  initialSun: number
  waves: [StoryWaveConfig, StoryWaveConfig, StoryWaveConfig]
  rewards: {
    gold: number
    gems: number
    tokens: number
  }
}

export interface StoryProgress {
  maxUnlockedLevel: number
  completedLevels: number[]
  levelStars: Record<number, number>
}

export interface StoryExpeditionRun {
  runId: string
  currentLevel: number
  claimedLevels: number[]
  totalTokensEarned: number
  status: 'active' | 'completed' | 'abandoned'
  startedAt: number
}

export const STORY_MODE_ENTRY_FEE_GEMS = 50
export const STORY_EXPEDITION_STORAGE_KEY = 'plants_arena_story_expedition'

export function getActiveStoryExpedition(): StoryExpeditionRun | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORY_EXPEDITION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.status === 'active') {
      return parsed
    }
  } catch {}
  return null
}

export function saveActiveStoryExpedition(run: StoryExpeditionRun): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORY_EXPEDITION_STORAGE_KEY, JSON.stringify(run))
  } catch {}
}

export function clearActiveStoryExpedition(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORY_EXPEDITION_STORAGE_KEY)
  } catch {}
}

export function startStoryExpedition(runId: string): StoryExpeditionRun {
  const run: StoryExpeditionRun = {
    runId,
    currentLevel: 1,
    claimedLevels: [],
    totalTokensEarned: 0,
    status: 'active',
    startedAt: Date.now(),
  }
  saveActiveStoryExpedition(run)
  return run
}

const STORAGE_KEY = 'plants_arena_story_mode_progress'

export function getStoryProgress(): StoryProgress {
  if (typeof localStorage === 'undefined') {
    return { maxUnlockedLevel: 1, completedLevels: [], levelStars: {} }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        maxUnlockedLevel: Math.max(1, Math.min(20, parsed.maxUnlockedLevel || 1)),
        completedLevels: Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [],
        levelStars: parsed.levelStars || {},
      }
    }
  } catch (e) {
    console.warn('Error leyendo progreso de Modo Historia:', e)
  }
  return { maxUnlockedLevel: 1, completedLevels: [], levelStars: {} }
}

export function saveStoryProgress(level: number, stars: number = 3): StoryProgress {
  const current = getStoryProgress()
  const completedSet = new Set(current.completedLevels)
  completedSet.add(level)

  const newMax = Math.max(current.maxUnlockedLevel, Math.min(20, level + 1))
  const newStars = { ...current.levelStars, [level]: Math.max(current.levelStars[level] || 0, stars) }

  const updated: StoryProgress = {
    maxUnlockedLevel: newMax,
    completedLevels: Array.from(completedSet).sort((a, b) => a - b),
    levelStars: newStars,
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    console.warn('Error guardando progreso de Modo Historia:', e)
  }
  return updated
}

/**
 * Genera la configuración determinista y equilibrada para cualquiera de los 20 niveles.
 */
export function getStoryLevelConfig(level: number): StoryLevelConfig {
  const clampedLevel = Math.max(1, Math.min(20, level))
  const lanesCount = 3

  // 1. Grupo y elenco de enemigos según las reglas
  let allowedMapaches: MapacheKey[]
  let groupTitle = ''

  if (clampedLevel <= 5) {
    allowedMapaches = ['pumpum', 'garritas']
    groupTitle = 'Patrulla de Avanzada'
  } else if (clampedLevel <= 10) {
    allowedMapaches = ['garritas', 'punos', 'navajas']
    groupTitle = 'Escuadrón de Choque'
  } else {
    allowedMapaches = ['pumpum', 'garritas', 'punos', 'navajas']
    groupTitle = 'Invasión Total'
  }

  // 2. Escalado de vida y daño
  // - Niveles 1-5: Se mantienen como están.
  // - Niveles 6-10: Sube la dificultad.
  // - Niveles 11-20: Sube aún más la dificultad a partir de la 2ª oleada.
  const isMediumDifficulty = clampedLevel >= 6 && clampedLevel <= 10
  const isHighDifficulty = clampedLevel >= 11

  let hpMultiplier: number
  let damageMultiplier: number
  let bossMaxHp: number

  if (clampedLevel <= 5) {
    hpMultiplier = 1 + (clampedLevel - 1) * 0.08
    damageMultiplier = 1 + (clampedLevel - 1) * 0.05
    bossMaxHp = Math.round(50 + (clampedLevel - 1) * 15)
  } else if (isMediumDifficulty) {
    hpMultiplier = 1 + 4 * 0.08 + (clampedLevel - 5) * 0.16
    damageMultiplier = 1 + 4 * 0.05 + (clampedLevel - 5) * 0.10
    bossMaxHp = Math.round(110 + (clampedLevel - 5) * 25)
  } else {
    // Niveles 11 a 20: Alta resistencia y daño base
    hpMultiplier = 1 + 4 * 0.08 + 5 * 0.16 + (clampedLevel - 10) * 0.22
    damageMultiplier = 1 + 4 * 0.05 + 5 * 0.10 + (clampedLevel - 10) * 0.14
    bossMaxHp = Math.round(235 + (clampedLevel - 10) * 35)
  }

  // 3. Generación de las 3 oleadas
  // Oleada 1 (Exploración / Plante inicial para girasoles y defensas)
  const w1Count = clampedLevel <= 5
    ? 2 + Math.floor(clampedLevel * 0.35)
    : isMediumDifficulty
    ? 3 + Math.floor(clampedLevel * 0.35)
    : 3 + Math.floor((clampedLevel - 10) * 0.25)
  const w1Spawns: MapacheSpawnPlan[] = []
  let w1Time = 3000

  for (let i = 0; i < w1Count; i++) {
    const key = allowedMapaches[i % allowedMapaches.length]
    const lane = (i * 2 + 1) % lanesCount
    w1Spawns.push({ delayMs: w1Time, key, lane })
    w1Time += Math.max(2200, 4500 - clampedLevel * 120)
  }

  // Oleada 2 (Refuerzos / Incursión múltiple - En 11-20 dificultad masiva)
  const w2Count = clampedLevel <= 5
    ? 4 + Math.floor(clampedLevel * 0.6)
    : isMediumDifficulty
    ? 6 + Math.floor(clampedLevel * 0.7)
    : 10 + Math.floor((clampedLevel - 10) * 1.1)
  const w2Spawns: MapacheSpawnPlan[] = []
  let w2Time = isHighDifficulty ? 2000 : 2500

  for (let i = 0; i < w2Count; i++) {
    const key = allowedMapaches[(i + 1) % allowedMapaches.length]
    const lane = (i * 3 + (clampedLevel % 2)) % lanesCount
    w2Spawns.push({ delayMs: w2Time, key, lane })
    w2Time += Math.max(isHighDifficulty ? 1000 : 1600, (isHighDifficulty ? 2500 : 3600) - clampedLevel * 100)

    // Incursión coordinada:
    // Niveles 6-10: cada 3 enemigos
    // Niveles 11-20: cada 2 enemigos a partir de la 2da oleada
    const coordinateInterval = isHighDifficulty ? 2 : 3
    if ((isMediumDifficulty || isHighDifficulty) && i > 0 && i % coordinateInterval === 0) {
      const extraKey = allowedMapaches[i % allowedMapaches.length]
      const extraLane = (lane + 2) % lanesCount
      w2Spawns.push({ delayMs: Math.max(500, w2Time - 400), key: extraKey, lane: extraLane })
    }
  }

  // Oleada 3 (¡El Jefe Final Rey Garra y su Escolta!)
  const w3Count = clampedLevel <= 5
    ? 4 + Math.floor(clampedLevel * 0.8)
    : isMediumDifficulty
    ? 6 + Math.floor(clampedLevel * 0.9)
    : 10 + clampedLevel
  const w3Spawns: MapacheSpawnPlan[] = []
  let w3Time = isHighDifficulty ? 1500 : 2000

  // REY GARRA ENTRA EN LA TERCERA OLEADA EN TODOS LOS NIVELES
  w3Spawns.push({
    delayMs: 1200,
    key: 'reygarra',
    lane: 1, // Carril central para patrullar (3 carriles: 0, 1, 2)
  })

  for (let i = 0; i < w3Count; i++) {
    const key = allowedMapaches[i % allowedMapaches.length]
    const lane = (i + 1 + (i % 2)) % lanesCount
    w3Spawns.push({ delayMs: w3Time, key, lane })
    w3Time += Math.max(isHighDifficulty ? 800 : 1300, (isHighDifficulty ? 2200 : 3000) - clampedLevel * 80)

    // En niveles 11-20: doble spawn frecuente en oleada 3
    if (isHighDifficulty && i > 0 && i % 2 === 0) {
      const extraKey = allowedMapaches[(i + 2) % allowedMapaches.length]
      const extraLane = (lane + 1) % lanesCount
      w3Spawns.push({ delayMs: Math.max(400, w3Time - 200), key: extraKey, lane: extraLane })
    }
  }

  const waves: [StoryWaveConfig, StoryWaveConfig, StoryWaveConfig] = [
    {
      waveNumber: 1,
      title: 'Oleada 1: Incursión Inicial',
      subtitle: 'Coloca tus girasoles y primeras defensas',
      spawns: w1Spawns,
    },
    {
      waveNumber: 2,
      title: 'Oleada 2: Refuerzos Mapache',
      subtitle: isHighDifficulty ? '¡Horda mapache masiva en los 3 carriles!' : 'La banda intensifica el ataque por varias líneas',
      spawns: w2Spawns,
    },
    {
      waveNumber: 3,
      title: 'Oleada 3: ¡REY GARRA AL FRENTE!',
      subtitle: '¡Derrota al Rey Garra y a su horda para superar el nivel!',
      hasBoss: true,
      spawns: w3Spawns,
    },
  ]

  return {
    level: clampedLevel,
    title: `Nivel ${clampedLevel} - ${groupTitle}`,
    description:
      clampedLevel <= 5
        ? 'Afronta las primeras escaramuzas de PumPum y Garritas en diferentes líneas. En la 3ª oleada, el temible Rey Garra liderará el asalto.'
        : clampedLevel <= 10
        ? 'Garritas, Puños encolerizado y Navajas atacan con mayor agresividad. Mantén tu jardín protegido antes de que llegue el Rey Garra.'
        : '¡Invasión total a máxima dificultad! Desde la 2ª oleada la horda ataca sin descanso con dobles incursiones y Rey Garra reforzado.',
    lanesCount,
    allowedMapaches,
    bossMaxHp,
    hpMultiplier,
    damageMultiplier,
    initialSun: clampedLevel >= 10 ? 200 : 250,
    waves,
    rewards: {
      gold: 0,
      gems: 0,
      tokens: 5, // 5 PLANTS para 3⭐, 3 PLANTS para 2⭐, 1 PLANTS para 1⭐
    },
  }
}
