import type { PlantId, PlantStatKey } from '../types/game'
import type { CartaDeMazo } from '../engine/mazoDeLaSala'
import { PLANT_CONFIGS } from './gameConstants'

export const SURVIVOR_ADS_ENTRY_FEE_GEMS = 50
export const SURVIVOR_ADS_STORAGE_KEY = 'plant_survivor_ads_run'
// Compatibilidad con el almacenamiento previo
export const ARENA_ADS_STORAGE_KEY = 'plant_arena_ads_run'

/** Pool estricto de cartas raras para recompensas cada 25 niveles (excluye Jalapeño y Nuez Explosiva) */
export const SURVIVOR_RARE_CARDS_POOL: PlantId[] = [
  'twinsunflower',
  'kernelpult',
  'torchwood',
  'marigold',
  'guacodile',
  'toadstool',
]

export interface SurvivorAdsPlantOption {
  plantId: PlantId
  name: string
  isFused: boolean
  level: number
  statRolls: PlantStatKey[]
  description: string
}

export interface SurvivorAdsTacticalColumn {
  tier: 1 | 2 | 3
  tierLabel: string
  plant: SurvivorAdsPlantOption
  requiresAd: boolean
  badge: string
  color: 'normal' | 'tactical' | 'supreme'
}

export interface SurvivorAdsPrepChoice {
  normalPlantOptions: SurvivorAdsPlantOption[]
  fusedPlantOptions: SurvivorAdsPlantOption[]
  tacticalColumns?: [SurvivorAdsTacticalColumn, SurvivorAdsTacticalColumn, SurvivorAdsTacticalColumn]
}

export interface SurvivorAdsLoot {
  plantsTokens: number
  basicPacks: number
  rareCards: number
  rareCardIds: PlantId[]
  // Compatibilidad con formatos previos
  gold: number
  gems: number
  items: Record<string, number>
}

export interface SurvivorAdsRun {
  id: string
  level: number
  seed: number
  status: 'prep' | 'battle' | 'level_cleared' | 'game_over'
  costGems: number
  baseDeck: CartaDeMazo[]
  deck: CartaDeMazo[]
  accumulatedLoot: SurvivorAdsLoot
  currentPrepChoice: SurvivorAdsPrepChoice | null
  chosenAdvantage?: {
    plantChosen?: SurvivorAdsPlantOption
  }
  updatedAt: number
  startedAt: number
  createdAt: number
}

const ALL_NON_SUNFLOWER_PLANTS: PlantId[] = [
  'peashooter',
  'repeater',
  'wallnut',
  'melonpult',
  'chomper',
  'bonkchoy',
  'garlic',
  'squash',
  'twinsunflower',
  'threepeater',
  'tallnut',
  'jalapeno',
  'iceberglettuce',
  'aloe',
  'kernelpult',
  'explodeonut',
  'gatlingpea',
  'ghostpepper',
  'guacodile',
  'marigold',
  'pickledpepper',
  'snowpea',
  'toadstool',
  'torchwood',
]

export function buildSurvivorInitialDeck(): CartaDeMazo[] {
  const defaults: PlantId[] = ['sunflower', 'peashooter', 'wallnut', 'chomper']
  return defaults.map((plantId) => ({
    plantId,
    level: 0,
    statRolls: [],
    equippedItem: null,
  }))
}

/**
 * Calcula las recompensas acumuladas según los niveles superados:
 * - 2 Token PLANTS por cada nivel superado
 * - 1 Sobre Básico cada 10 niveles
 * - 1 Carta Rara Aleatoria cada 25 niveles (sin Jalapeño ni Nuez Explosiva)
 */
export function calculateSurvivorRewards(levelsCleared: number, seed = 12345): SurvivorAdsLoot {
  const safeCleared = Math.max(0, levelsCleared)
  const plantsTokens = safeCleared * 2
  const basicPacks = Math.floor(safeCleared / 10)
  const rareCards = Math.floor(safeCleared / 25)

  const rareCardIds: PlantId[] = []
  let rngSeed = (seed ^ (safeCleared * 8191)) >>> 0
  for (let i = 0; i < rareCards; i++) {
    rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0
    const idx = Math.floor((rngSeed / 4294967296) * SURVIVOR_RARE_CARDS_POOL.length)
    rareCardIds.push(SURVIVOR_RARE_CARDS_POOL[Math.min(idx, SURVIVOR_RARE_CARDS_POOL.length - 1)])
  }

  return {
    plantsTokens,
    basicPacks,
    rareCards,
    rareCardIds,
    gold: 0,
    gems: 0,
    items: {},
  }
}

export class SurvivorAdsManager {
  static getStoredRun(): SurvivorAdsRun | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(SURVIVOR_ADS_STORAGE_KEY) || localStorage.getItem(ARENA_ADS_STORAGE_KEY)
      if (!raw) return null
      const parsed: SurvivorAdsRun = JSON.parse(raw)
      if (parsed && typeof parsed.level === 'number' && parsed.status) {
        if (parsed.status === 'game_over') {
          this.clearRun()
          return null
        }
        if (!parsed.baseDeck || parsed.baseDeck.length === 0) {
          parsed.baseDeck = parsed.deck ? [...parsed.deck] : buildSurvivorInitialDeck()
        }
        if (!parsed.accumulatedLoot) {
          parsed.accumulatedLoot = calculateSurvivorRewards(Math.max(0, parsed.level - 1), parsed.seed)
        }
        return parsed
      }
    } catch (e) {
      console.warn('[SurvivorAdsManager] Error al leer caché de la run:', e)
    }
    return null
  }

  static saveRun(run: SurvivorAdsRun): void {
    if (typeof localStorage === 'undefined') return
    try {
      run.updatedAt = Date.now()
      const serialized = JSON.stringify(run)
      localStorage.setItem(SURVIVOR_ADS_STORAGE_KEY, serialized)
      localStorage.setItem(ARENA_ADS_STORAGE_KEY, serialized)
    } catch (e) {
      console.warn('[SurvivorAdsManager] Error al guardar run:', e)
    }
  }

  static clearRun(): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.removeItem(SURVIVOR_ADS_STORAGE_KEY)
      localStorage.removeItem(ARENA_ADS_STORAGE_KEY)
    } catch (e) {
      console.warn('[SurvivorAdsManager] Error al limpiar run:', e)
    }
  }

  static startNewRun(seed: number = Date.now()): SurvivorAdsRun {
    const baseDeck = buildSurvivorInitialDeck()
    const run: SurvivorAdsRun = {
      id: `survivor_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      level: 1,
      seed,
      status: 'prep',
      costGems: SURVIVOR_ADS_ENTRY_FEE_GEMS,
      baseDeck: [...baseDeck],
      deck: [...baseDeck],
      accumulatedLoot: calculateSurvivorRewards(0, seed),
      currentPrepChoice: null,
      updatedAt: Date.now(),
      startedAt: Date.now(),
      createdAt: Date.now(),
    }
    run.currentPrepChoice = this.generatePrepChoices(run)
    this.saveRun(run)
    return run
  }

  static generatePrepChoices(run: SurvivorAdsRun): SurvivorAdsPrepChoice {
    const seed = run.seed + run.level * 97
    let currentSeed = seed
    const nextRng = (): number => {
      currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0
      return currentSeed / 4294967296
    }

    const currentDeckPlantIds = new Set(run.deck.map((c) => c.plantId))
    const availablePool = ALL_NON_SUNFLOWER_PLANTS.filter((p) => !currentDeckPlantIds.has(p))
    const pool = availablePool.length >= 3 ? availablePool : ALL_NON_SUNFLOWER_PLANTS

    const pickPlantId = (): PlantId => {
      const idx = Math.floor(nextRng() * pool.length)
      return pool[idx] || 'peashooter'
    }

    const p1 = pickPlantId()
    let p2 = pickPlantId()
    while (p2 === p1) p2 = pickPlantId()
    let p3 = pickPlantId()
    while (p3 === p1 || p3 === p2) p3 = pickPlantId()

    const normalPlant: SurvivorAdsPlantOption = {
      plantId: p1,
      name: PLANT_CONFIGS[p1]?.name || p1,
      isFused: false,
      level: 1,
      statRolls: [],
      description: PLANT_CONFIGS[p1]?.description || 'Planta de apoyo estándar.',
    }

    const tacticalPlant: SurvivorAdsPlantOption = {
      plantId: p2,
      name: PLANT_CONFIGS[p2]?.name || p2,
      isFused: false,
      level: 2,
      statRolls: ['hp', 'damage'],
      description: `Versión mejorada Nv.2 con bonificaciones directas de combate.`,
    }

    const supremePlant: SurvivorAdsPlantOption = {
      plantId: p3,
      name: PLANT_CONFIGS[p3]?.name || p3,
      isFused: true,
      level: 3,
      statRolls: ['hp', 'damage', 'attackSpeed'],
      description: `Planta Fusionada Nv.3 con stats multiplicados para oleadas de alta presión.`,
    }

    const tacticalColumns: [SurvivorAdsTacticalColumn, SurvivorAdsTacticalColumn, SurvivorAdsTacticalColumn] = [
      {
        tier: 1,
        tierLabel: 'Planta Estándar',
        plant: normalPlant,
        requiresAd: false,
        badge: 'GRATIS',
        color: 'normal',
      },
      {
        tier: 2,
        tierLabel: 'Refuerzo Nv.2',
        plant: tacticalPlant,
        requiresAd: true,
        badge: 'PATROCINADA',
        color: 'tactical',
      },
      {
        tier: 3,
        tierLabel: 'Planta Suprema Nv.3',
        plant: supremePlant,
        requiresAd: true,
        badge: 'SUPREMA',
        color: 'supreme',
      },
    ]

    return {
      normalPlantOptions: [normalPlant],
      fusedPlantOptions: [tacticalPlant, supremePlant],
      tacticalColumns,
    }
  }

  static applyAdvantageChoice(
    run: SurvivorAdsRun,
    choice: { plantChosen?: SurvivorAdsPlantOption }
  ): SurvivorAdsRun {
    run.chosenAdvantage = choice
    if (choice.plantChosen) {
      const chosen = choice.plantChosen
      const existingIdx = run.deck.findIndex((c) => c.plantId === chosen.plantId)
      if (existingIdx >= 0) {
        run.deck[existingIdx] = {
          plantId: chosen.plantId,
          level: Math.max(run.deck[existingIdx].level ?? 0, chosen.level ?? 0),
          statRolls: Array.from(new Set([...(run.deck[existingIdx].statRolls || []), ...(chosen.statRolls || [])])),
          equippedItem: run.deck[existingIdx].equippedItem,
        }
      } else {
        run.deck.push({
          plantId: chosen.plantId,
          level: chosen.level,
          statRolls: chosen.statRolls,
          equippedItem: null,
        })
      }
    }
    this.saveRun(run)
    return run
  }

  static completeLevelVictory(run: SurvivorAdsRun): SurvivorAdsRun {
    const levelsCleared = run.level
    run.accumulatedLoot = calculateSurvivorRewards(levelsCleared, run.seed)
    run.level += 1
    run.status = 'prep'
    run.chosenAdvantage = undefined
    run.currentPrepChoice = this.generatePrepChoices(run)
    this.saveRun(run)
    return run
  }

  static registerDefeat(run: SurvivorAdsRun): SurvivorAdsRun {
    // Si muere en el nivel X, superó X - 1 niveles.
    // "solo un intento si muere se lleva eso ganado"
    const levelsCleared = Math.max(0, run.level - 1)
    run.accumulatedLoot = calculateSurvivorRewards(levelsCleared, run.seed)
    run.status = 'game_over'
    this.saveRun(run)
    return run
  }
}
