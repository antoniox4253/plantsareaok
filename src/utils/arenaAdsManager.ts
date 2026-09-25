import type { PlantId, PlantStatKey } from '../types/game'
import type { CartaDeMazo } from '../engine/mazoDeLaSala'
import type { FarmingItemId } from './pvpRewardManager'
import { PLANT_CONFIGS } from './gameConstants'

export const ARENA_ADS_ENTRY_FEE_GOLD = 350
export const ARENA_ADS_ENTRY_FEE_GEMS = 200
export const ARENA_ADS_REVIVE_FEE_GEMS = 150
export const ARENA_ADS_STORAGE_KEY = 'plant_arena_ads_run'

export interface ArenaAdsRewardOption {
  type: 'gold' | 'gems' | 'item' | 'pack'
  amount: number
  itemId?: FarmingItemId
  packId?: 'basic' | 'epic' | 'legendary' | 'pvp'
  label: string
  icon: string
  isExclusiveItem?: boolean
  isRepeatFloor?: boolean
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
  eventType: 'reward' | 'plant'
  rewardOption: ArenaAdsRewardOption
  rewardOptions: ArenaAdsRewardOption[]
  normalPlantOptions: ArenaAdsPlantOption[]
  fusedPlantOptions: ArenaAdsPlantOption[]
  canDoubleReward?: boolean
}

export interface ArenaAdsLoot {
  gold: number
  gems: number
  items: Partial<Record<FarmingItemId | string, number>>
}

export interface ArenaAdsRun {
  id: string
  level: number
  seed: number
  status: 'prep' | 'battle' | 'level_cleared' | 'game_over'
  paymentType: 'gold' | 'gems'
  multiplier: number // 1 si pagó 350 oro, 2 si pagó 200 gemas
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
  alreadyClaimedLevels?: number[] // Niveles ya superados históricamente en la cuenta
  newlyClaimedLevels?: number[] // Niveles superados por primera vez en esta expedición
  updatedAt: number
  startedAt?: number
  createdAt?: number
  reviveCount?: number
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
  { id: 'cactus_armor', label: 'Armadura de Cactus (Cactus)', icon: '🌵', targetPlant: 'chomper' },
  { id: 'superman_suit', label: 'Capa de Superman (Nuez)', icon: '🦸', targetPlant: 'wallnut' },
  { id: 'spiderman_suit', label: 'Traje de Spiderman (Nuez)', icon: '🕷️', targetPlant: 'wallnut' },
  { id: 'batman_suit', label: 'Armadura de Batman (Nuez)', icon: '🦇', targetPlant: 'wallnut' },
  { id: 'ironman_suit', label: 'Reactor de Iron Man (Nuez)', icon: '🦾', targetPlant: 'wallnut' },
  { id: 'gold_24k', label: 'Bañado en Oro 24K (Nuez)', icon: '👑', targetPlant: 'wallnut' },
  { id: 'samurai_armor', label: 'Armadura Samurái (Squash)', icon: '⚔️', targetPlant: 'garlic' },
]

export const EXCLUSIVE_ARENA_ITEM_IDS = new Set<FarmingItemId>(
  EXCLUSIVE_ARENA_ITEMS.map((item) => item.id)
)

/**
 * TABLA AUTORITATIVA DE RECOMPENSAS FIJAS POR NIVEL (NIVELES 1 AL 50)
 *
 * REGLAS ESTRICTAS DE BALANCE:
 * 1. 0 Oro en todos los niveles (el oro se eliminó completamente de la mazmorra).
 * 2. Exactamente 300 Gemas en total (suman 300 💎 en saldo no retirable locked_gems_balance).
 * 3. 1 Sobre Básico (Nivel 10), 4 Sobres PvP (Niveles 15, 25, 30 y 35) y 1 Pack Místico/Épico (Nivel 40).
 * 4. 5 Skins exclusivas a partir de Nivel 30 (Niveles 30, 35, 40, 45 y 50).
 * 5. Recursos de cultivo y consumibles en niveles intermedios.
 */
export const ARENA_ADS_LEVEL_REWARDS: Record<number, ArenaAdsRewardOption[]> = {
  1: [{ type: 'item', itemId: 'water', amount: 5, label: '+5 Agua', icon: '💧' }],
  2: [{ type: 'item', itemId: 'fertilizer', amount: 5, label: '+5 Fertilizante', icon: '🌱' }],
  3: [{ type: 'item', itemId: 'shovel_fragment', amount: 1, label: '+1 Fragmento de Pala', icon: '⛏️' }],
  4: [{ type: 'item', itemId: 'scarecrow_fragment', amount: 1, label: '+1 Frag. Espantapájaros', icon: '🌾' }],
  5: [
    { type: 'gems', amount: 5, label: '+5 Gemas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'pesticide', amount: 1, label: '+1 Pesticida', icon: '🧴' },
  ],
  6: [{ type: 'item', itemId: 'water', amount: 8, label: '+8 Agua', icon: '💧' }],
  7: [{ type: 'item', itemId: 'fertilizer', amount: 8, label: '+8 Fertilizante', icon: '🌱' }],
  8: [{ type: 'item', itemId: 'shovel_fragment', amount: 1, label: '+1 Fragmento de Pala', icon: '⛏️' }],
  9: [{ type: 'item', itemId: 'scarecrow_fragment', amount: 1, label: '+1 Frag. Espantapájaros', icon: '🌾' }],
  10: [
    { type: 'gems', amount: 15, label: '+15 Gemas (Bono)', icon: '💎' },
    { type: 'pack', packId: 'basic', amount: 1, label: '1 Sobre Común', icon: '📦' },
    { type: 'item', itemId: 'energy_potion_5', amount: 1, label: '+1 Poción de Energía (5⚡)', icon: '⚡' },
  ],
  11: [{ type: 'item', itemId: 'water', amount: 10, label: '+10 Agua', icon: '💧' }],
  12: [{ type: 'item', itemId: 'fertilizer', amount: 10, label: '+10 Fertilizante', icon: '🌱' }],
  13: [{ type: 'item', itemId: 'shovel_fragment', amount: 2, label: '+2 Fragmentos de Pala', icon: '⛏️' }],
  14: [{ type: 'item', itemId: 'energy_potion_5', amount: 1, label: '+1 Poción de Energía (5⚡)', icon: '⚡' }],
  15: [
    { type: 'gems', amount: 10, label: '+10 Gemas (Bono)', icon: '💎' },
    { type: 'pack', packId: 'pvp', amount: 1, label: '1 Sobre PvP', icon: '🥊' },
  ],
  16: [{ type: 'item', itemId: 'water', amount: 12, label: '+12 Agua', icon: '💧' }],
  17: [{ type: 'item', itemId: 'fertilizer', amount: 12, label: '+12 Fertilizante', icon: '🌱' }],
  18: [{ type: 'item', itemId: 'scarecrow_fragment', amount: 2, label: '+2 Frag. Espantapájaros', icon: '🌾' }],
  19: [{ type: 'item', itemId: 'pesticide', amount: 2, label: '+2 Pesticidas', icon: '🧴' }],
  20: [
    { type: 'gems', amount: 20, label: '+20 Gemas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'pesticide', amount: 2, label: '+2 Pesticidas', icon: '🧴' },
    { type: 'item', itemId: 'energy_potion_5', amount: 1, label: '+1 Poción de Energía (5⚡)', icon: '⚡' },
  ],
  21: [{ type: 'item', itemId: 'water', amount: 15, label: '+15 Agua', icon: '💧' }],
  22: [{ type: 'item', itemId: 'fertilizer', amount: 15, label: '+15 Fertilizante', icon: '🌱' }],
  23: [{ type: 'item', itemId: 'shovel_fragment', amount: 2, label: '+2 Fragmentos de Pala', icon: '⛏️' }],
  24: [{ type: 'item', itemId: 'energy_potion_5', amount: 1, label: '+1 Poción de Energía (5⚡)', icon: '⚡' }],
  25: [
    { type: 'gems', amount: 15, label: '+15 Gemas (Bono)', icon: '💎' },
    { type: 'pack', packId: 'pvp', amount: 1, label: '1 Sobre PvP', icon: '🥊' },
  ],
  26: [{ type: 'item', itemId: 'water', amount: 15, label: '+15 Agua', icon: '💧' }],
  27: [{ type: 'item', itemId: 'fertilizer', amount: 15, label: '+15 Fertilizante', icon: '🌱' }],
  28: [{ type: 'item', itemId: 'scarecrow_fragment', amount: 2, label: '+2 Frag. Espantapájaros', icon: '🌾' }],
  29: [{ type: 'item', itemId: 'pesticide', amount: 2, label: '+2 Pesticidas', icon: '🧴' }],
  30: [
    { type: 'gems', amount: 20, label: '+20 Gemas (Bono)', icon: '💎' },
    { type: 'pack', packId: 'pvp', amount: 1, label: '1 Sobre PvP', icon: '🥊' },
    { type: 'item', itemId: 'sunflower_glasses', amount: 1, label: 'Gafas de Sol (Girasol)', icon: '🕶️', isExclusiveItem: true },
  ],
  31: [{ type: 'item', itemId: 'water', amount: 20, label: '+20 Agua', icon: '💧' }],
  32: [{ type: 'item', itemId: 'fertilizer', amount: 20, label: '+20 Fertilizante', icon: '🌱' }],
  33: [{ type: 'item', itemId: 'shovel_fragment', amount: 3, label: '+3 Fragmentos de Pala', icon: '⛏️' }],
  34: [{ type: 'item', itemId: 'energy_potion_5', amount: 1, label: '+1 Poción de Energía (5⚡)', icon: '⚡' }],
  35: [
    { type: 'gems', amount: 20, label: '+20 Gemas (Bono)', icon: '💎' },
    { type: 'pack', packId: 'pvp', amount: 1, label: '1 Sobre PvP', icon: '🥊' },
    { type: 'item', itemId: 'superman_suit', amount: 1, label: 'Capa de Superman (Nuez)', icon: '🦸', isExclusiveItem: true },
  ],
  36: [{ type: 'item', itemId: 'water', amount: 20, label: '+20 Agua', icon: '💧' }],
  37: [{ type: 'item', itemId: 'fertilizer', amount: 20, label: '+20 Fertilizante', icon: '🌱' }],
  38: [
    { type: 'gems', amount: 15, label: '+15 Gemas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'pesticide', amount: 3, label: '+3 Pesticidas', icon: '🧴' },
  ],
  39: [{ type: 'item', itemId: 'scarecrow_fragment', amount: 3, label: '+3 Frag. Espantapájaros', icon: '🌾' }],
  40: [
    { type: 'gems', amount: 30, label: '+30 Gemas (Bono)', icon: '💎' },
    { type: 'pack', packId: 'epic', amount: 1, label: '1 Pack Místico/Épico', icon: '🔮' },
    { type: 'item', itemId: 'spiderman_suit', amount: 1, label: 'Traje de Spiderman (Nuez)', icon: '🕷️', isExclusiveItem: true },
  ],
  41: [{ type: 'item', itemId: 'water', amount: 25, label: '+25 Agua', icon: '💧' }],
  42: [{ type: 'item', itemId: 'fertilizer', amount: 25, label: '+25 Fertilizante', icon: '🌱' }],
  43: [
    { type: 'gems', amount: 15, label: '+15 Gemas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'energy_potion_5', amount: 2, label: '+2 Pociones de Energía (10⚡)', icon: '⚡' },
  ],
  44: [{ type: 'item', itemId: 'shovel_fragment', amount: 4, label: '+4 Fragmentos de Pala', icon: '⛏️' }],
  45: [
    { type: 'gems', amount: 25, label: '+25 Gemas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'scarecrow_fragment', amount: 4, label: '+4 Frag. Espantapájaros', icon: '🌾' },
    { type: 'item', itemId: 'ironman_suit', amount: 1, label: 'Reactor de Iron Man (Nuez)', icon: '🦾', isExclusiveItem: true },
  ],
  46: [{ type: 'item', itemId: 'water', amount: 30, label: '+30 Agua', icon: '💧' }],
  47: [{ type: 'item', itemId: 'fertilizer', amount: 30, label: '+30 Fertilizante', icon: '🌱' }],
  48: [
    { type: 'gems', amount: 15, label: '+15 Gemas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'pesticide', amount: 4, label: '+4 Pesticidas', icon: '🧴' },
  ],
  49: [
    { type: 'gems', amount: 20, label: '+20 Gemas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'energy_potion_5', amount: 2, label: '+2 Pociones de Energía (10⚡)', icon: '⚡' },
  ],
  50: [
    { type: 'gems', amount: 75, label: '+75 Gemas Supremas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'gold_24k', amount: 1, label: 'Nuez Bañada en Oro 24K', icon: '👑', isExclusiveItem: true },
  ],
}

/**
 * Obtiene las recompensas fijas para un nivel específico.
 * Si isFirstTime es false (piso ya superado en la historia de la cuenta),
 * otorga ÚNICAMENTE recursos de cultivo (agua/fertilizante), NUNCA gemas, sobres o skins exclusivas.
 */
export function getFixedRewardsForLevel(
  level: number,
  multiplier = 1,
  isFirstTime = true
): ArenaAdsRewardOption[] {
  if (!isFirstTime) {
    const waterAmount = Math.min(25, 3 + Math.floor(level / 2)) * multiplier
    const fertilizerAmount = Math.min(20, 2 + Math.floor(level / 3)) * multiplier
    const labelPrefix = multiplier === 2 ? ` (2X)` : ''
    return [
      {
        type: 'item',
        itemId: 'water',
        amount: waterAmount,
        label: `+${waterAmount} Agua (Piso repetido)${labelPrefix}`,
        icon: '💧',
        isRepeatFloor: true,
      },
      {
        type: 'item',
        itemId: 'fertilizer',
        amount: fertilizerAmount,
        label: `+${fertilizerAmount} Fertilizante (Piso repetido)${labelPrefix}`,
        icon: '🌱',
        isRepeatFloor: true,
      },
    ]
  }

  const baseRewards = ARENA_ADS_LEVEL_REWARDS[level] || [
    { type: 'gems', amount: 20, label: '+20 Gemas (Bono)', icon: '💎' },
    { type: 'item', itemId: 'water', amount: 30, label: '+30 Agua', icon: '💧' },
    { type: 'item', itemId: 'fertilizer', amount: 30, label: '+30 Fertilizante', icon: '🌱' },
  ]

  return baseRewards.map((rew) => {
    // Los ítems exclusivos y los sobres NUNCA se duplican (siempre 1)
    if (rew.isExclusiveItem || rew.type === 'pack') {
      return { ...rew, amount: 1 }
    }
    const scaledAmount = rew.amount * multiplier
    const labelPrefix = multiplier === 2 ? ` (2X)` : ''
    return {
      ...rew,
      amount: scaledAmount,
      label: rew.type === 'gems' ? `+${scaledAmount} Gemas (Bono)${labelPrefix}` : `+${scaledAmount} ${rew.label.replace(/^\+\d+\s*/, '')}${labelPrefix}`,
    }
  })
}

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

let _cachedStock: Record<string, { remainingStock: number }> | null = null

export function setCachedStock(stock: Record<string, { remainingStock: number }> | null) {
  _cachedStock = stock
}

export function getCachedStock(): Record<string, { remainingStock: number }> | null {
  return _cachedStock
}

/**
 * Devuelve la recompensa principal del nivel según la tabla fija
 */
export function generateSingleRewardItem(
  level: number,
  multiplier = 1,
  _allowExclusiveItem = false,
  _excludedItemIds?: Set<string>,
  isFirstTime = true
): ArenaAdsRewardOption {
  const rewards = getFixedRewardsForLevel(level, multiplier, isFirstTime)
  return rewards[0]
}
/**
 * Genera el paquete de recompensas para la fase de preparación según la tabla fija por nivel
 */
export function generateRewardOptions(
  level: number,
  multiplier = 1,
  _existingExclusiveCount = 0,
  _existingExclusiveIds?: Set<string>,
  isFirstTime = true
): ArenaAdsRewardOption[] {
  return getFixedRewardsForLevel(level, multiplier, isFirstTime)
}

/**
 * Genera opciones de plantas normales (3 opciones aleatorias a Nivel 1).
 * Si se especifica un pool disponible, selecciona de este pool.
 */
export function generateNormalPlantOptions(availablePool?: PlantId[]): ArenaAdsPlantOption[] {
  const sourcePool = availablePool && availablePool.length >= 3 ? availablePool : ALL_NON_SUNFLOWER_PLANTS
  const picked = shuffleArray(sourcePool).slice(0, 3)
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
 * Si se especifica un pool disponible, selecciona de este pool.
 */
export function generateFusedPlantOptions(level: number, availablePool?: PlantId[]): ArenaAdsPlantOption[] {
  const sourcePool = availablePool && availablePool.length >= 3 ? availablePool : ALL_NON_SUNFLOWER_PLANTS
  const picked = shuffleArray(sourcePool).slice(0, 3)
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
 * Si se proporciona `currentDeck`, garantiza que las opciones normales y fusionadas
 * NO contengan ninguna planta que ya esté presente en dicho mazo activo.
 */
export function generateLevelPrep(
  level: number,
  multiplier = 1,
  currentDeck?: CartaDeMazo[],
  accumulatedItems?: Partial<Record<FarmingItemId | string, number>>,
  alreadyClaimedLevels?: number[]
): ArenaAdsPrepChoice {
  const isFirstTime = !alreadyClaimedLevels?.includes(level)

  const existingExclusiveCount = accumulatedItems
    ? Object.keys(accumulatedItems).filter(
        (id) => EXCLUSIVE_ARENA_ITEM_IDS.has(id as FarmingItemId) && (accumulatedItems[id as FarmingItemId] || 0) > 0
      ).length
    : 0

  const existingExclusiveIds = new Set<string>(
    accumulatedItems
      ? Object.keys(accumulatedItems).filter(
          (id) => EXCLUSIVE_ARENA_ITEM_IDS.has(id as FarmingItemId) && (accumulatedItems[id as FarmingItemId] || 0) > 0
        )
      : []
  )

  const rewardOptions = generateRewardOptions(
    level,
    multiplier,
    existingExclusiveCount,
    existingExclusiveIds,
    isFirstTime
  )

  // Obtener IDs de plantas actualmente presentes en el mazo activo (+ sunflower)
  const deckPlantIds = new Set<string>((currentDeck || []).map((c) => c.plantId))
  deckPlantIds.add('sunflower')

  // Pool de plantas no presentes en el mazo
  const nonDeckPool = ALL_NON_SUNFLOWER_PLANTS.filter((p) => !deckPlantIds.has(p))

  let normalPool: PlantId[]
  let fusedPool: PlantId[]

  if (nonDeckPool.length >= 6) {
    const shuffled = shuffleArray(nonDeckPool)
    normalPool = shuffled.slice(0, 3)
    fusedPool = shuffled.slice(3, 6)
  } else if (nonDeckPool.length >= 3) {
    normalPool = shuffleArray(nonDeckPool).slice(0, 3)
    fusedPool = shuffleArray(nonDeckPool).slice(0, 3)
  } else {
    normalPool = shuffleArray(ALL_NON_SUNFLOWER_PLANTS).slice(0, 3)
    fusedPool = shuffleArray(ALL_NON_SUNFLOWER_PLANTS).slice(0, 3)
  }

  // En hitos importantes (10, 15, 20, 25, 30, 35, 40, 45, 50), evento 'reward' garantizado
  const isMilestone = level % 10 === 0 || [15, 25, 35, 45, 50].includes(level)
  const eventType: 'reward' | 'plant' = isMilestone
    ? 'reward'
    : Math.random() < 0.50
    ? 'reward'
    : 'plant'

  // Duplicar recompensa: Permitido a partir de nivel 15 solo si NO hay skins exclusivas ni sobres
  const hasExclusiveOrPack = rewardOptions.some(
    (opt) => opt.type === 'pack' || Boolean(opt.isExclusiveItem)
  )
  const canDoubleReward = !hasExclusiveOrPack && level >= 15 && Math.random() < 0.50

  return {
    eventType,
    rewardOption: rewardOptions[0],
    rewardOptions,
    normalPlantOptions: generateNormalPlantOptions(normalPool),
    fusedPlantOptions: generateFusedPlantOptions(level, fusedPool),
    canDoubleReward,
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
      const prevSlot1 = deck[1]
      deck[1] = {
        plantId: chosenPlant.plantId,
        slot: 1,
        level: chosenPlant.level,
        statRolls: [...chosenPlant.statRolls],
      }
      if (existingIdx !== 1) {
        deck[existingIdx] = {
          ...prevSlot1,
          slot: existingIdx,
        }
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
 * Genera el mazo del Bot rival para el nivel actual con composiciones sinérgicas
 * y escalado sustancial de estadísticas a partir del nivel 5.
 */
export function generateBotDeckForLevel(level: number): CartaDeMazo[] {
  const deck: CartaDeMazo[] = []
  // Girasol en slot 0
  const sunflowerLevel = level >= 30 ? 4 : level >= 15 ? 3 : level >= 5 ? 2 : 1
  deck.push({
    plantId: 'sunflower',
    slot: 0,
    level: sunflowerLevel,
    statRolls: [],
  })

  // Composiciones sinérgicas según nivel de mazmorra
  const tankPool: PlantId[] = level >= 25 ? ['tallnut', 'wallnut'] : ['wallnut', 'garlic']
  const dpsPool: PlantId[] = level >= 20 ? ['melonpult', 'threepeater', 'repeater'] : ['repeater', 'peashooter']
  const meleePool: PlantId[] = level >= 15 ? ['bonkchoy', 'squash', 'chomper'] : ['bonkchoy', 'chomper']
  const utilityPool: PlantId[] = level >= 20 ? ['iceberglettuce', 'jalapeno', 'kernelpult', 'aloe'] : ['kernelpult', 'iceberglettuce']

  const selectedPlants: PlantId[] = [
    randomPick(tankPool),
    randomPick(dpsPool),
    randomPick(meleePool),
    randomPick(utilityPool),
  ]

  // Escalado de nivel de cartas y tiradas de estadísticas
  const cardLevel = level >= 40 ? 4 : level >= 20 ? 3 : level >= 5 ? 2 : 1
  const rollsCount = level >= 30 ? 4 : level >= 20 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0
  const rollPool: PlantStatKey[] = ['damage', 'hp', 'attackSpeed', 'cooldown']

  selectedPlants.forEach((plantId, index) => {
    const rolls: PlantStatKey[] = []
    for (let r = 0; r < rollsCount; r++) {
      rolls.push(rollPool[r % rollPool.length])
    }
    deck.push({
      plantId,
      slot: index + 1,
      level: cardLevel,
      statRolls: rolls,
    })
  })

  return deck
}

/**
 * Calcula los atributos del bot rival para el nivel actual de la mazmorra.
 * A partir del Nivel 5 se eleva significativamente el ELO y la vida base del bot.
 */
export function getBotStatsForLevel(level: number): {
  botElo: number
  botBaseHp: number
  botName: string
  botDeck: CartaDeMazo[]
} {
  let botElo = 1100
  if (level <= 4) {
    botElo = 1100 + (level - 1) * 75 // 1100, 1175, 1250, 1325
  } else if (level <= 20) {
    botElo = 1325 + (level - 4) * 65 // Lv 5: 1390, Lv 10: 1715, Lv 20: 2365
  } else if (level <= 40) {
    botElo = 2365 + (level - 20) * 35 // Lv 30: 2715, Lv 40: 3065
  } else {
    botElo = Math.min(3600, 3065 + (level - 40) * 35) // Lv 50: 3415
  }

  let botBaseHp = 1000
  if (level <= 4) {
    botBaseHp = 1000
  } else if (level <= 10) {
    botBaseHp = 1000 + (level - 4) * 25 // Lv 5: 1025, Lv 10: 1150
  } else if (level <= 20) {
    botBaseHp = 1150 + (level - 10) * 35 // Lv 20: 1500
  } else if (level <= 30) {
    botBaseHp = 1500 + (level - 20) * 45 // Lv 30: 1950
  } else if (level <= 40) {
    botBaseHp = 1950 + (level - 30) * 55 // Lv 40: 2500
  } else {
    botBaseHp = 2500 + (level - 40) * 70 // Lv 50: 3200
  }

  const botDeck = generateBotDeckForLevel(level)

  const titles = [
    'Recluta', 'Guardián', 'Centinela', 'Gladiador', 'Veterano',
    'Comandante', 'Campeón', 'Titán', 'Coloso', 'Señor Supremo'
  ]
  const titleIdx = Math.min(titles.length - 1, Math.floor((level - 1) / 5))
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
        if (parsed.status === 'game_over') {
          this.clearRun()
          return null
        }
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
   * Maneja la derrota de una run: marca el estado como 'game_over' y purga el progreso de almacenamiento
   * para que la próxima partida comience limpia desde el Nivel 1.
   */
  static handleDefeat(run?: ArenaAdsRun | null): void {
    if (run) {
      run.status = 'game_over'
    }
    this.clearRun()
  }

  /**
   * Inicia una nueva run de Mazmorra Infinita.
   * Permite elegir pagar 350 de Oro (1x) o 200 Gemas (2x multiplicador de botín).
   */
  static startNewRun(
    paymentTypeOrSeed: 'gold' | 'gems' | number = 'gold',
    seed = Date.now(),
    alreadyClaimedLevels: number[] = []
  ): ArenaAdsRun {
    let paymentType: 'gold' | 'gems' = 'gold'
    let actualSeed = seed
    if (typeof paymentTypeOrSeed === 'number') {
      actualSeed = paymentTypeOrSeed
    } else if (paymentTypeOrSeed === 'gems' || paymentTypeOrSeed === 'gold') {
      paymentType = paymentTypeOrSeed
    }

    const multiplier = paymentType === 'gems' ? 2 : 1
    const initialDeck = buildArenaAdsDeck()
    const prep = generateLevelPrep(1, multiplier, initialDeck, {}, alreadyClaimedLevels)

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
      alreadyClaimedLevels: [...alreadyClaimedLevels],
      newlyClaimedLevels: [],
      updatedAt: Date.now(),
      startedAt: Date.now(),
      reviveCount: 0,
    }

    this.saveRun(run)
    return run
  }

  static setCachedStock(stock: Record<string, { remainingStock: number }> | null): void {
    setCachedStock(stock)
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
   * Inicia el combate del nivel actual.
   * Las recompensas del nivel se consolidan al ganar el combate en completeLevelVictory.
   */
  static startBattle(run: ArenaAdsRun): ArenaAdsRun {
    run.status = 'battle'
    this.saveRun(run)
    return run
  }

  /**
   * Procesa la victoria del nivel actual y añade las recompensas fijas autoritativas.
   * Si es primera victoria histórica de la cuenta: otorga gemas, sobres, skins exclusivas.
   * Si el piso ya fue superado previamente: otorga ÚNICAMENTE recursos de cultivo (agua/fertilizante).
   * 0 Oro en toda la mazmorra.
   */
  static completeLevelVictory(run: ArenaAdsRun): ArenaAdsRun {
    run.status = 'level_cleared'

    const isDoubled =
      run.chosenAdvantage?.type === 'reward' &&
      Array.isArray(run.chosenAdvantage.rewardClaimed) &&
      run.chosenAdvantage.rewardClaimed.some((r) => r.label.includes('(2X)'))

    const effectiveMultiplier = (run.multiplier || 1) * (isDoubled ? 2 : 1)
    const isFirstTime = !run.alreadyClaimedLevels?.includes(run.level)
    const levelRewards = getFixedRewardsForLevel(run.level, effectiveMultiplier, isFirstTime)

    if (isFirstTime) {
      if (!run.newlyClaimedLevels) run.newlyClaimedLevels = []
      if (!run.newlyClaimedLevels.includes(run.level)) {
        run.newlyClaimedLevels.push(run.level)
      }
      if (!run.alreadyClaimedLevels) run.alreadyClaimedLevels = []
      if (!run.alreadyClaimedLevels.includes(run.level)) {
        run.alreadyClaimedLevels.push(run.level)
      }
    }

    for (const opt of levelRewards) {
      if (opt.type === 'gems') {
        run.accumulatedRewards.gems += opt.amount
      } else if (opt.type === 'item' && opt.itemId) {
        if (EXCLUSIVE_ARENA_ITEM_IDS.has(opt.itemId)) {
          run.accumulatedRewards.items[opt.itemId] = 1
        } else {
          run.accumulatedRewards.items[opt.itemId] =
            (run.accumulatedRewards.items[opt.itemId] || 0) + opt.amount
        }
      } else if (opt.type === 'pack' && opt.packId) {
        run.accumulatedRewards.items[opt.packId] =
          (run.accumulatedRewards.items[opt.packId] || 0) + opt.amount
      }
    }

    this.saveRun(run)
    return run
  }

  /**
   * Revive al jugador en el nivel actual tras pagar 150 gemas, conservando todo el progreso.
   */
  static reviveRun(run: ArenaAdsRun): ArenaAdsRun {
    run.lives = (run.lives || 1) + 1
    run.reviveCount = (run.reviveCount || 0) + 1
    run.status = 'prep'
    const deckToUse = run.baseDeck && run.baseDeck.length > 0 ? run.baseDeck : run.deck
    run.currentPrepChoice = generateLevelPrep(
      run.level,
      run.multiplier,
      deckToUse,
      run.accumulatedRewards.items,
      run.alreadyClaimedLevels
    )
    this.saveRun(run)
    return run
  }

  /**
   * Avanza al siguiente nivel de la mazmorra (Nivel + 1) e inicializa la fase de preparación.
   */
  static advanceToNextLevel(run: ArenaAdsRun): ArenaAdsRun {
    run.level += 1
    run.status = 'prep'
    run.chosenAdvantage = { type: 'none' }

    const newBaseDeck = buildArenaAdsDeck()
    run.baseDeck = newBaseDeck
    run.deck = newBaseDeck
    run.currentPrepChoice = generateLevelPrep(
      run.level,
      run.multiplier,
      newBaseDeck,
      run.accumulatedRewards.items,
      run.alreadyClaimedLevels
    )

    this.saveRun(run)
    return run
  }
}
