import type { PlantId, PlantStatKey } from '../types/game'
import type { CartaDeMazo } from '../engine/mazoDeLaSala'
import type { FarmingItemId } from './pvpRewardManager'
import { PLANT_CONFIGS } from './gameConstants'

export const ARENA_ADS_ENTRY_FEE_GOLD = 100
export const ARENA_ADS_STORAGE_KEY = 'plant_arena_ads_run'

export interface ArenaAdsRewardOption {
  type: 'gold' | 'gems' | 'item'
  amount: number
  itemId?: FarmingItemId
  label: string
  icon: string
}

export interface ArenaAdsPlantOption {
  plantId: PlantId
  name: string
  isFused: boolean
  level: number
  statRolls: PlantStatKey[]
  description: string
}

export interface ArenaAdsPrepChoice {
  rewardOption: ArenaAdsRewardOption
  normalPlantOptions: ArenaAdsPlantOption[]
  fusedPlantOptions: ArenaAdsPlantOption[]
}

export interface ArenaAdsLoot {
  gold: number
  gems: number
  items: Partial<Record<FarmingItemId, number>>
}

export interface ArenaAdsRun {
  id: string
  level: number
  seed: number
  status: 'prep' | 'battle' | 'level_cleared' | 'game_over'
  deck: CartaDeMazo[]
  accumulatedRewards: ArenaAdsLoot
  currentPrepChoice: ArenaAdsPrepChoice | null
  chosenAdvantage?: {
    type: 'reward' | 'plant_normal' | 'plant_fused'
    rewardClaimed?: ArenaAdsRewardOption
    plantChosen?: ArenaAdsPlantOption
  }
  updatedAt: number
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
]

const FARMING_REWARD_ITEMS: Array<{ id: FarmingItemId; label: string; icon: string }> = [
  { id: 'water', label: 'Agua Mágica', icon: '💧' },
  { id: 'fertilizer', label: 'Super Fertilizante', icon: '🌱' },
  { id: 'shovel_fragment', label: 'Fragmento de Pala', icon: '⛏️' },
  { id: 'pesticide', label: 'Pesticida Botánico', icon: '🧪' },
  { id: 'energy_potion_5', label: 'Poción de Energía (+5)', icon: '⚡' },
]

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Genera la opción de recompensa para el nivel actual.
 */
export function generateRewardOption(level: number): ArenaAdsRewardOption {
  const roll = Math.random()
  if (roll < 0.45) {
    // Oro
    const amount = 50 + level * 25
    return {
      type: 'gold',
      amount,
      label: `+${amount} Oro`,
      icon: '🪙',
    }
  } else if (roll < 0.75) {
    // Gemas
    const amount = 5 + Math.floor(level * 2.5)
    return {
      type: 'gems',
      amount,
      label: `+${amount} Gemas`,
      icon: '💎',
    }
  } else {
    // Ítem de cultivo
    const item = FARMING_REWARD_ITEMS[Math.floor(Math.random() * FARMING_REWARD_ITEMS.length)]
    const amount = 1 + (level >= 5 ? 1 : 0)
    return {
      type: 'item',
      amount,
      itemId: item.id,
      label: `+${amount} ${item.label}`,
      icon: item.icon,
    }
  }
}

/**
 * Genera opciones de plantas normales (3 opciones aleatorias).
 */
export function generateNormalPlantOptions(): ArenaAdsPlantOption[] {
  const picked = shuffleArray(ALL_NON_SUNFLOWER_PLANTS).slice(0, 3)
  return picked.map((plantId) => {
    const cfg = PLANT_CONFIGS[plantId]
    return {
      plantId,
      name: cfg?.name || plantId,
      isFused: false,
      level: 1,
      statRolls: [],
      description: cfg?.description || 'Planta de combate estándar.',
    }
  })
}

/**
 * Genera opciones de plantas fusionadas con estadísticas potenciadas (3 opciones).
 */
export function generateFusedPlantOptions(level: number): ArenaAdsPlantOption[] {
  const picked = shuffleArray(ALL_NON_SUNFLOWER_PLANTS).slice(0, 3)
  const rollPool: PlantStatKey[] = ['damage', 'hp', 'attackSpeed', 'cooldown']

  return picked.map((plantId) => {
    const cfg = PLANT_CONFIGS[plantId]
    // 2 o 3 mejoras aleatorias según el nivel
    const rollCount = Math.min(4, 2 + Math.floor(level / 3))
    const statRolls: PlantStatKey[] = []
    for (let i = 0; i < rollCount; i++) {
      statRolls.push(rollPool[Math.floor(Math.random() * rollPool.length)])
    }

    const bonusSummary = statRolls.map((s) => {
      if (s === 'damage') return '+15% Daño'
      if (s === 'hp') return '+15% Vida'
      if (s === 'attackSpeed') return '+15% Cadencia'
      return '-15% Recarga'
    }).join(' • ')

    return {
      plantId,
      name: `${cfg?.name || plantId} [FUSIÓN]`,
      isFused: true,
      level: 2 + Math.floor(level / 4),
      statRolls,
      description: `Versión mejorada: ${bonusSummary}`,
    }
  })
}

/**
 * Genera la fase de preparación completa para un nivel dado.
 */
export function generateLevelPrep(level: number): ArenaAdsPrepChoice {
  return {
    rewardOption: generateRewardOption(level),
    normalPlantOptions: generateNormalPlantOptions(),
    fusedPlantOptions: generateFusedPlantOptions(level),
  }
}

/**
 * Genera un mazo de 5 cartas garantizando siempre el Girasol.
 * Si se incluye una planta elegida (normal o fusionada), se asegura en el mazo.
 */
export function buildArenaAdsDeck(chosenPlant?: ArenaAdsPlantOption): CartaDeMazo[] {
  const deck: CartaDeMazo[] = []

  // 1. Girasol SIEMPRE en el primer slot (slot 0)
  deck.push({
    plantId: 'sunflower',
    slot: 0,
    level: 1,
    statRolls: [],
  })

  // 2. Si eligió una planta especial, entra al slot 1
  const usedPlantIds = new Set<string>(['sunflower'])
  if (chosenPlant) {
    deck.push({
      plantId: chosenPlant.plantId,
      slot: 1,
      level: chosenPlant.level,
      statRolls: chosenPlant.statRolls,
    })
    usedPlantIds.add(chosenPlant.plantId)
  }

  // 3. Completar las restantes hasta 5 con plantas aleatorias únicas
  const availablePool = ALL_NON_SUNFLOWER_PLANTS.filter((p) => !usedPlantIds.has(p))
  const randomFill = shuffleArray(availablePool)

  while (deck.length < 5 && randomFill.length > 0) {
    const nextPlant = randomFill.pop()!
    deck.push({
      plantId: nextPlant,
      slot: deck.length,
      level: 1,
      statRolls: [],
    })
  }

  return deck
}

/**
 * Genera el mazo del Bot rival para el nivel actual.
 */
export function generateBotDeckForLevel(level: number): CartaDeMazo[] {
  const deck: CartaDeMazo[] = []
  deck.push({
    plantId: 'sunflower',
    slot: 0,
    level: 1 + Math.floor(level / 5),
    statRolls: [],
  })

  const shuffled = shuffleArray(ALL_NON_SUNFLOWER_PLANTS)
  for (let i = 1; i < 5; i++) {
    const plantId = shuffled[i - 1]
    const rollsCount = Math.floor(level / 4)
    const rolls: PlantStatKey[] = Array.from({ length: rollsCount }, () => 'damage')
    deck.push({
      plantId,
      slot: i,
      level: 1 + Math.floor(level / 3),
      statRolls: rolls,
    })
  }
  return deck
}

/**
 * Calcula los atributos del bot rival para el nivel actual de la mazmorra.
 */
export function getBotStatsForLevel(level: number): {
  botElo: number
  botBaseHp: number
  botName: string
  botDeck: CartaDeMazo[]
} {
  // Nivel 1 = 1000 Elo, Nivel 2 = 1200, Nivel 3 = 1400... Nivel 10+ = 2800+
  const botElo = Math.min(3200, 1000 + (level - 1) * 200)
  const botBaseHp = 600 + (level - 1) * 60
  const botDeck = generateBotDeckForLevel(level)

  const titles = ['Novato', 'Guardián', 'Centinela', 'Gladiador', 'Veterano', 'Campeón', 'Titán', 'Coloso', 'Señor Supremo']
  const titleIdx = Math.min(titles.length - 1, Math.floor((level - 1) / 2))
  const botName = `Bot ${titles[titleIdx]} (Nv.${level})`

  return { botElo, botBaseHp, botName, botDeck }
}

export class ArenaAdsManager {
  /**
   * Obtiene la run almacenada en caché local, si existe.
   */
  static getStoredRun(): ArenaAdsRun | null {
    try {
      const raw = localStorage.getItem(ARENA_ADS_STORAGE_KEY)
      if (!raw) return null
      const parsed: ArenaAdsRun = JSON.parse(raw)
      if (parsed && typeof parsed.level === 'number' && parsed.status) {
        return parsed
      }
    } catch (e) {
      console.warn('[ArenaAdsManager] Error al leer caché de la run:', e)
    }
    return null
  }

  /**
   * Guarda el estado actual de la run en la caché local.
   */
  static saveRun(run: ArenaAdsRun): void {
    try {
      run.updatedAt = Date.now()
      localStorage.setItem(ARENA_ADS_STORAGE_KEY, JSON.stringify(run))
    } catch (e) {
      console.warn('[ArenaAdsManager] Error al guardar caché de la run:', e)
    }
  }

  /**
   * Elimina la run activa del caché local.
   */
  static clearRun(): void {
    try {
      localStorage.removeItem(ARENA_ADS_STORAGE_KEY)
    } catch (e) {
      console.warn('[ArenaAdsManager] Error al limpiar caché de la run:', e)
    }
  }

  /**
   * Inicia una nueva run de Mazmorra Infinita (Nivel 1).
   */
  static startNewRun(seed = Date.now()): ArenaAdsRun {
    const prep = generateLevelPrep(1)
    const initialDeck = buildArenaAdsDeck()

    const run: ArenaAdsRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      level: 1,
      seed,
      status: 'prep',
      deck: initialDeck,
      accumulatedRewards: {
        gold: 0,
        gems: 0,
        items: {},
      },
      currentPrepChoice: prep,
      updatedAt: Date.now(),
    }

    this.saveRun(run)
    return run
  }

  /**
   * Aplica la elección de ventaja hecha por el jugador en la fase de preparación:
   * - Si eligió 'reward', acumula el recurso y regenera el mazo con Sunflower + aleatorias.
   * - Si eligió 'plant_normal' o 'plant_fused', inyecta la planta elegida al mazo.
   */
  static applyAdvantageChoice(
    run: ArenaAdsRun,
    choice:
      | { type: 'reward'; option: ArenaAdsRewardOption }
      | { type: 'plant_normal'; option: ArenaAdsPlantOption }
      | { type: 'plant_fused'; option: ArenaAdsPlantOption }
  ): ArenaAdsRun {
    if (choice.type === 'reward') {
      const opt = choice.option
      if (opt.type === 'gold') {
        run.accumulatedRewards.gold += opt.amount
      } else if (opt.type === 'gems') {
        run.accumulatedRewards.gems += opt.amount
      } else if (opt.type === 'item' && opt.itemId) {
        run.accumulatedRewards.items[opt.itemId] = (run.accumulatedRewards.items[opt.itemId] || 0) + opt.amount
      }
      run.deck = buildArenaAdsDeck()
      run.chosenAdvantage = {
        type: 'reward',
        rewardClaimed: opt,
      }
    } else {
      run.deck = buildArenaAdsDeck(choice.option)
      run.chosenAdvantage = {
        type: choice.type,
        plantChosen: choice.option,
      }
    }

    this.saveRun(run)
    return run
  }

  /**
   * Marca el inicio del combate para el nivel actual.
   */
  static startBattle(run: ArenaAdsRun): ArenaAdsRun {
    run.status = 'battle'
    this.saveRun(run)
    return run
  }

  /**
   * Procesa la victoria del nivel actual:
   * Pasa a estado 'level_cleared' y otorga un bono automático de victoria de nivel (+20 de oro).
   */
  static completeLevelVictory(run: ArenaAdsRun): ArenaAdsRun {
    run.status = 'level_cleared'
    run.accumulatedRewards.gold += 20 + run.level * 10
    this.saveRun(run)
    return run
  }

  /**
   * Avanza al siguiente nivel de la mazmorra (Nivel + 1) e inicializa la nueva fase de preparación.
   */
  static advanceToNextLevel(run: ArenaAdsRun): ArenaAdsRun {
    run.level += 1
    run.status = 'prep'
    run.currentPrepChoice = generateLevelPrep(run.level)
    run.chosenAdvantage = undefined
    // Regenerar mazo para nuevo nivel con girasol siempre presente
    run.deck = buildArenaAdsDeck()
    this.saveRun(run)
    return run
  }
}
