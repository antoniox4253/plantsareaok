import type { PlantId, PlantStatKey } from '../types/game'
import type { CartaDeMazo } from '../engine/mazoDeLaSala'
import type { FarmingItemId } from './pvpRewardManager'
import { PLANT_CONFIGS } from './gameConstants'

export const ARENA_ADS_ENTRY_FEE_GOLD = 100
export const ARENA_ADS_ENTRY_FEE_GEMS = 200
export const ARENA_ADS_REVIVE_FEE_GEMS = 150
export const ARENA_ADS_STORAGE_KEY = 'plant_arena_ads_run'

export interface ArenaAdsRewardOption {
  type: 'gold' | 'gems' | 'item'
  amount: number
  itemId?: FarmingItemId
  label: string
  icon: string
  isExclusiveItem?: boolean
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
  rewardOptions: ArenaAdsRewardOption[]
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
  paymentType: 'gold' | 'gems'
  multiplier: number // 1 si pagó 100 oro, 2 si pagó 200 gemas
  lives: number // Vidas extra acumuladas por revivir
  baseDeck: CartaDeMazo[]
  deck: CartaDeMazo[]
  accumulatedRewards: ArenaAdsLoot
  currentPrepChoice: ArenaAdsPrepChoice | null
  chosenAdvantage?: {
    type: 'none' | 'reward' | 'plant_normal' | 'plant_fused'
    rewardClaimed?: ArenaAdsRewardOption | ArenaAdsRewardOption[]
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

// Ítems equipables exclusivos limitados a 5 drops cada uno
export const EXCLUSIVE_ARENA_ITEMS: Array<{ id: FarmingItemId; label: string; icon: string; targetPlant: PlantId }> = [
  { id: 'sunflower_glasses', label: 'Gafas de Sol (Girasol)', icon: '🕶️', targetPlant: 'sunflower' },
  { id: 'cactus_armor', label: 'Armadura de Cactus', icon: '🌵', targetPlant: 'chomper' },
  { id: 'superman_suit', label: 'Capa de Superman (Nuez)', icon: '🦸', targetPlant: 'wallnut' },
  { id: 'spiderman_suit', label: 'Traje de Spiderman (Nuez)', icon: '🕷️', targetPlant: 'wallnut' },
  { id: 'batman_suit', label: 'Armadura de Batman (Nuez)', icon: '🦇', targetPlant: 'wallnut' },
  { id: 'ironman_suit', label: 'Reactor de Iron Man (Nuez)', icon: '🦾', targetPlant: 'wallnut' },
  { id: 'gold_24k', label: 'Bañado en Oro 24K (Nuez)', icon: '👑', targetPlant: 'wallnut' },
  { id: 'samurai_armor', label: 'Armadura Samurái (Squash)', icon: '⚔️', targetPlant: 'garlic' },
]

// Pools de recompensas exactas solicitadas por el usuario
const GOLD_POOL = [20, 50, 75, 100]
const GEMS_POOL = [2, 5, 7, 12, 15, 18]
const WATER_POOL = [3, 5, 7, 10]
const FERTILIZER_POOL = [2, 5, 8, 12]

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Genera una sola opción individual de recompensa según los pools balanceados
 */
export function generateSingleRewardItem(level: number, multiplier = 1): ArenaAdsRewardOption {
  // A partir de nivel 10 y cada 5 niveles (10, 15, 20, 25...), tirar probabilidad de ítem exclusivo
  const isMilestoneLevel = level >= 10 && level % 5 === 0
  if (isMilestoneLevel && Math.random() < 0.65) {
    const exclusive = randomPick(EXCLUSIVE_ARENA_ITEMS)
    return {
      type: 'item',
      amount: 1, // Los ítems exclusivos se entregan de 1 en 1
      itemId: exclusive.id,
      label: `${exclusive.label} (Exclusivo)`,
      icon: exclusive.icon,
      isExclusiveItem: true,
    }
  }

  const categoryRoll = Math.random()
  if (categoryRoll < 0.35) {
    // Oro (35%)
    const baseGold = randomPick(GOLD_POOL)
    const amount = baseGold * multiplier
    return {
      type: 'gold',
      amount,
      label: `+${amount} Oro`,
      icon: '🪙',
    }
  } else if (categoryRoll < 0.65) {
    // Gemas (30%)
    const baseGems = randomPick(GEMS_POOL)
    const amount = baseGems * multiplier
    return {
      type: 'gems',
      amount,
      label: `+${amount} Gemas`,
      icon: '💎',
    }
  } else if (categoryRoll < 0.85) {
    // Agua o Fertilizante (20%)
    if (Math.random() < 0.5) {
      const baseWater = randomPick(WATER_POOL)
      const amount = baseWater * multiplier
      return {
        type: 'item',
        amount,
        itemId: 'water',
        label: `+${amount} Agua`,
        icon: '💧',
      }
    } else {
      const baseFertilizer = randomPick(FERTILIZER_POOL)
      const amount = baseFertilizer * multiplier
      return {
        type: 'item',
        amount,
        itemId: 'fertilizer',
        label: `+${amount} Fertilizante`,
        icon: '🌱',
      }
    }
  } else {
    // Consumibles / Fragmentos especiales (15%)
    const specialPick = Math.random()
    if (specialPick < 0.35) {
      const amount = 1 * multiplier
      return {
        type: 'item',
        amount,
        itemId: 'shovel_fragment',
        label: `+${amount} Fragmento de Pala`,
        icon: '⛏️',
      }
    } else if (specialPick < 0.7) {
      const amount = 1 * multiplier
      return {
        type: 'item',
        amount,
        itemId: 'scarecrow_fragment',
        label: `+${amount} Frag. Espantapájaros`,
        icon: '🌾',
      }
    } else {
      const amount = 1 * multiplier
      return {
        type: 'item',
        amount,
        itemId: 'energy_potion_5',
        label: `+${amount} Poción de Energía (5⚡)`,
        icon: '⚡',
      }
    }
  }
}

/**
 * Genera el paquete de recompensas para la fase de preparación:
 * - Niveles 1-9: 1 recompensa.
 * - Niveles 10-19: 2 recompensas.
 * - Niveles 20+: 3 recompensas (añade 1 cada 10 niveles).
 */
export function generateRewardOptions(level: number, multiplier = 1): ArenaAdsRewardOption[] {
  let count = 1
  if (level >= 10 && level < 20) {
    count = 2
  } else if (level >= 20) {
    count = 2 + Math.floor((level - 10) / 10)
  }

  const list: ArenaAdsRewardOption[] = []
  for (let i = 0; i < count; i++) {
    list.push(generateSingleRewardItem(level, multiplier))
  }
  return list
}

/**
 * Genera opciones de plantas normales (3 opciones aleatorias a Nivel 1).
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
      description: 'Nivel 1 básico (Sin fusiones)',
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
    const rollCount = Math.min(4, 2 + Math.floor(level / 3))
    const statRolls: PlantStatKey[] = []
    for (let i = 0; i < rollCount; i++) {
      statRolls.push(rollPool[Math.floor(Math.random() * rollPool.length)])
    }

    const bonusSummary = statRolls
      .map((s) => {
        if (s === 'damage') return '+15% Daño'
        if (s === 'hp') return '+15% Vida'
        if (s === 'attackSpeed') return '+15% Cadencia'
        return '-15% Recarga'
      })
      .join(' • ')

    const fusionLevel = Math.max(2, statRolls.length)

    return {
      plantId,
      name: cfg?.name || plantId,
      isFused: true,
      level: fusionLevel,
      statRolls,
      description: `⭐${fusionLevel} Fusión: ${bonusSummary}`,
    }
  })
}

/**
 * Genera la fase de preparación completa para un nivel dado.
 */
export function generateLevelPrep(level: number, multiplier = 1): ArenaAdsPrepChoice {
  const rewardOptions = generateRewardOptions(level, multiplier)
  return {
    rewardOption: rewardOptions[0],
    rewardOptions,
    normalPlantOptions: generateNormalPlantOptions(),
    fusedPlantOptions: generateFusedPlantOptions(level),
  }
}

/**
 * Genera o sincroniza el mazo de 5 cartas garantizando siempre el Girasol.
 */
export function buildArenaAdsDeck(
  chosenPlant?: ArenaAdsPlantOption,
  baseDeck?: CartaDeMazo[]
): CartaDeMazo[] {
  if (baseDeck && baseDeck.length === 5 && chosenPlant) {
    const deck = baseDeck.map((c) => ({ ...c }))
    const existingIdx = deck.findIndex((c) => c.plantId === chosenPlant.plantId)
    if (existingIdx > 0) {
      deck[existingIdx] = {
        ...deck[existingIdx],
        level: chosenPlant.level,
        statRolls: [...chosenPlant.statRolls],
      }
    } else {
      deck[1] = {
        plantId: chosenPlant.plantId,
        slot: 1,
        level: chosenPlant.level,
        statRolls: [...chosenPlant.statRolls],
      }
    }
    return deck
  }

  const deck: CartaDeMazo[] = []

  // Girasol SIEMPRE en el primer slot (slot 0)
  deck.push({
    plantId: 'sunflower',
    slot: 0,
    level: 1,
    statRolls: [],
  })

  const usedPlantIds = new Set<string>(['sunflower'])
  if (chosenPlant) {
    deck.push({
      plantId: chosenPlant.plantId,
      slot: 1,
      level: chosenPlant.level,
      statRolls: [...chosenPlant.statRolls],
    })
    usedPlantIds.add(chosenPlant.plantId)
  }

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
  const botElo = Math.min(3200, 1000 + (level - 1) * 200)
  const botBaseHp = 600 + (level - 1) * 60
  const botDeck = generateBotDeckForLevel(level)

  const titles = ['Novato', 'Guardián', 'Centinela', 'Gladiador', 'Veterano', 'Campeón', 'Titán', 'Coloso', 'Señor Supremo']
  const titleIdx = Math.min(titles.length - 1, Math.floor((level - 1) / 2))
  const botName = `Bot ${titles[titleIdx]} (Nv.${level})`

  return { botElo, botBaseHp, botName, botDeck }
}

export class ArenaAdsManager {
  static getStoredRun(): ArenaAdsRun | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(ARENA_ADS_STORAGE_KEY)
      if (!raw) return null
      const parsed: ArenaAdsRun = JSON.parse(raw)
      if (parsed && typeof parsed.level === 'number' && parsed.status) {
        if (!parsed.baseDeck || parsed.baseDeck.length === 0) {
          parsed.baseDeck = parsed.deck ? [...parsed.deck] : buildArenaAdsDeck()
        }
        if (!parsed.multiplier) {
          parsed.multiplier = parsed.paymentType === 'gems' ? 2 : 1
        }
        return parsed
      }
    } catch (e) {
      console.warn('[ArenaAdsManager] Error al leer caché de la run:', e)
    }
    return null
  }

  static saveRun(run: ArenaAdsRun): void {
    if (typeof localStorage === 'undefined') return
    try {
      run.updatedAt = Date.now()
      localStorage.setItem(ARENA_ADS_STORAGE_KEY, JSON.stringify(run))
    } catch (e) {
      console.warn('[ArenaAdsManager] Error al guardar caché de la run:', e)
    }
  }

  static clearRun(): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.removeItem(ARENA_ADS_STORAGE_KEY)
    } catch (e) {
      console.warn('[ArenaAdsManager] Error al limpiar caché de la run:', e)
    }
  }

  /**
   * Inicia una nueva run de Mazmorra Infinita.
   * Permite elegir pagar 100 de Oro (1x) o 200 Gemas (2x multiplicador de botín).
   */
  static startNewRun(paymentTypeOrSeed: 'gold' | 'gems' | number = 'gold', seed = Date.now()): ArenaAdsRun {
    let paymentType: 'gold' | 'gems' = 'gold'
    let actualSeed = seed
    if (typeof paymentTypeOrSeed === 'number') {
      actualSeed = paymentTypeOrSeed
    } else if (paymentTypeOrSeed === 'gems' || paymentTypeOrSeed === 'gold') {
      paymentType = paymentTypeOrSeed
    }

    const multiplier = paymentType === 'gems' ? 2 : 1
    const prep = generateLevelPrep(1, multiplier)
    const initialDeck = buildArenaAdsDeck()

    const run: ArenaAdsRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      level: 1,
      seed: actualSeed,
      status: 'prep',
      paymentType,
      multiplier,
      lives: 1,
      baseDeck: initialDeck,
      deck: initialDeck,
      accumulatedRewards: {
        gold: 0,
        gems: 0,
        items: {},
      },
      currentPrepChoice: prep,
      chosenAdvantage: {
        type: 'none',
      },
      updatedAt: Date.now(),
    }

    this.saveRun(run)
    return run
  }

  /**
   * Aplica la elección de ventaja hecha por el jugador en la fase de preparación.
   */
  static applyAdvantageChoice(
    run: ArenaAdsRun,
    choice:
      | { type: 'reward'; option?: ArenaAdsRewardOption; options?: ArenaAdsRewardOption[] }
      | { type: 'plant_normal'; option: ArenaAdsPlantOption }
      | { type: 'plant_fused'; option: ArenaAdsPlantOption }
  ): ArenaAdsRun {
    if (!run.baseDeck || run.baseDeck.length === 0) {
      run.baseDeck = run.deck ? [...run.deck] : buildArenaAdsDeck()
    }

    if (choice.type === 'reward') {
      run.deck = run.baseDeck.map((c) => ({ ...c }))
      const rewardVal = choice.options ? choice.options : choice.option
      run.chosenAdvantage = {
        type: 'reward',
        rewardClaimed: rewardVal,
        plantChosen: undefined,
      }
    } else {
      run.deck = buildArenaAdsDeck(choice.option, run.baseDeck)
      run.chosenAdvantage = {
        type: choice.type,
        plantChosen: choice.option,
        rewardClaimed: undefined,
      }
    }

    this.saveRun(run)
    return run
  }

  /**
   * Inicia el combate del nivel actual consolidando las recompensas elegidas si aplica.
   */
  static startBattle(run: ArenaAdsRun): ArenaAdsRun {
    run.status = 'battle'

    if (run.chosenAdvantage?.type === 'reward' && run.chosenAdvantage.rewardClaimed) {
      const raw = run.chosenAdvantage.rewardClaimed
      const opts = Array.isArray(raw) ? raw : [raw]
      for (const opt of opts) {
        if (opt.type === 'gold') {
          run.accumulatedRewards.gold += opt.amount
        } else if (opt.type === 'gems') {
          run.accumulatedRewards.gems += opt.amount
        } else if (opt.type === 'item' && opt.itemId) {
          run.accumulatedRewards.items[opt.itemId] =
            (run.accumulatedRewards.items[opt.itemId] || 0) + opt.amount
        }
      }
    }

    this.saveRun(run)
    return run
  }

  /**
   * Procesa la victoria del nivel actual y añade bono de victoria escalado por multiplicador.
   */
  static completeLevelVictory(run: ArenaAdsRun): ArenaAdsRun {
    run.status = 'level_cleared'
    const bonusGold = (20 + run.level * 10) * run.multiplier
    run.accumulatedRewards.gold += bonusGold
    this.saveRun(run)
    return run
  }

  /**
   * Revive al jugador en el nivel actual tras pagar 150 gemas, conservando todo el progreso.
   */
  static reviveRun(run: ArenaAdsRun): ArenaAdsRun {
    run.lives = (run.lives || 1) + 1
    run.status = 'prep'
    this.saveRun(run)
    return run
  }

  /**
   * Avanza al siguiente nivel de la mazmorra (Nivel + 1) e inicializa la fase de preparación.
   */
  static advanceToNextLevel(run: ArenaAdsRun): ArenaAdsRun {
    run.level += 1
    run.status = 'prep'
    run.currentPrepChoice = generateLevelPrep(run.level, run.multiplier)
    run.chosenAdvantage = { type: 'none' }

    const newBaseDeck = buildArenaAdsDeck()
    run.baseDeck = newBaseDeck
    run.deck = newBaseDeck

    this.saveRun(run)
    return run
  }
}
