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
  const lanesCount = 5

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
  const hpMultiplier = 1 + (clampedLevel - 1) * 0.08
  const damageMultiplier = 1 + (clampedLevel - 1) * 0.05
  const bossMaxHp = Math.round(50 + (clampedLevel - 1) * 15 + (clampedLevel >= 15 ? 40 : 0))

  // 3. Generación de las 3 oleadas
  // Oleada 1 (Exploración / Plante inicial)
  const w1Count = 2 + Math.floor(clampedLevel * 0.35)
  const w1Spawns: MapacheSpawnPlan[] = []
  let w1Time = 3000 // Da 3 segundos para que caiga sol y se plante

  for (let i = 0; i < w1Count; i++) {
    const key = allowedMapaches[i % allowedMapaches.length]
    const lane = (i * 2 + 1) % lanesCount
    w1Spawns.push({ delayMs: w1Time, key, lane })
    w1Time += Math.max(2200, 4500 - clampedLevel * 120)
  }

  // Oleada 2 (Refuerzos / Incursión múltiple)
  const w2Count = 4 + Math.floor(clampedLevel * 0.6)
  const w2Spawns: MapacheSpawnPlan[] = []
  let w2Time = 2500

  for (let i = 0; i < w2Count; i++) {
    const key = allowedMapaches[(i + 1) % allowedMapaches.length]
    const lane = (i * 3 + (clampedLevel % 2)) % lanesCount
    w2Spawns.push({ delayMs: w2Time, key, lane })
    w2Time += Math.max(1600, 3600 - clampedLevel * 100)

    // A partir de nivel 11: Incursión doble cada 3 enemigos
    if (clampedLevel >= 11 && i > 0 && i % 3 === 0) {
      const extraKey = allowedMapaches[i % allowedMapaches.length]
      const extraLane = (lane + 2) % lanesCount
      w2Spawns.push({ delayMs: w2Time - 400, key: extraKey, lane: extraLane })
    }
  }

  // Oleada 3 (¡El Jefe Final Rey Garra y su Escolta!)
  const w3Count = 4 + Math.floor(clampedLevel * 0.8)
  const w3Spawns: MapacheSpawnPlan[] = []
  let w3Time = 2000

  // REY GARRA ENTRA EN LA TERCERA OLEADA EN TODOS LOS NIVELES
  w3Spawns.push({
    delayMs: 1500,
    key: 'reygarra',
    lane: 2, // Carril central para patrullar
  })

  for (let i = 0; i < w3Count; i++) {
    const key = allowedMapaches[i % allowedMapaches.length]
    const lane = (i + 1 + (i % 2)) % lanesCount
    w3Spawns.push({ delayMs: w3Time, key, lane })
    w3Time += Math.max(1300, 3000 - clampedLevel * 80)

    // En niveles altos (15+), incursión adicional
    if (clampedLevel >= 15 && i % 2 === 0) {
      const extraKey = allowedMapaches[(i + 2) % allowedMapaches.length]
      const extraLane = (lane + 3) % lanesCount
      w3Spawns.push({ delayMs: w3Time - 200, key: extraKey, lane: extraLane })
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
      subtitle: 'La banda intensifica el ataque por varias líneas',
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
        ? 'Garritas, Puños encolerizado y Navajas atacan coordinados. Mantén tu jardín protegido antes de que llegue el Rey Garra.'
        : '¡La invasión total de los 4 mapaches con el Rey Garra! Máxima dificultad táctica: prepara defensas robustas y contraataques rápidos.',
    lanesCount,
    allowedMapaches,
    bossMaxHp,
    hpMultiplier,
    damageMultiplier,
    initialSun: clampedLevel >= 10 ? 200 : 250,
    waves,
    rewards: {
      gold: 50 + clampedLevel * 25,
      gems: clampedLevel % 5 === 0 ? 30 : 10,
      tokens: clampedLevel % 5 === 0 ? 5 : 2,
    },
  }
}
