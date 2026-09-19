import type { PlantId } from '../types/game'

export type FarmingItemId =
  | 'water'
  | 'fertilizer'
  | 'shovel_fragment'
  | 'scarecrow_fragment'
  | 'pesticide'
  | 'shovel'
  | 'scarecrow'
  | 'champion_belt'
  | 'energy_potion_5'
  | 'mother_tree_skin'

export interface FarmingInventory {
  water: number
  fertilizer: number
  shovel_fragment: number
  scarecrow_fragment: number
  pesticide: number
  shovel: number
  scarecrow: number
  champion_belt: number
  energy_potion_5: number
  mother_tree_skin: number
}

export const EMPTY_FARMING_INVENTORY: FarmingInventory = {
  water: 0,
  fertilizer: 0,
  shovel_fragment: 0,
  scarecrow_fragment: 0,
  pesticide: 0,
  shovel: 0,
  scarecrow: 0,
  champion_belt: 0,
  energy_potion_5: 0,
  mother_tree_skin: 0,
}

export const FARMING_ITEM_DEFINITIONS: Record<
  FarmingItemId,
  { label: string; description: string; icon: string; fallback: string }
> = {
  water: {
    label: 'Agua',
    description: 'Recurso básico para regar cultivos.',
    icon: '/game-assets/farming/water.webp',
    fallback: '💧',
  },
  fertilizer: {
    label: 'Fertilizante',
    description: 'Mejora el rendimiento de los cultivos.',
    icon: '/game-assets/farming/fertilizer.webp',
    fallback: '🌱',
  },
  shovel_fragment: {
    label: 'Fragmento de pala',
    description: 'Pieza de crafting de la pala.',
    icon: '/game-assets/farming/shovel_fragment.webp',
    fallback: '🪏',
  },
  scarecrow_fragment: {
    label: 'Frag. espantapájaros',
    description: '30 piezas + 1.000 oro crearán un espantapájaros.',
    icon: '/game-assets/farming/scarecrow_fragment.webp',
    fallback: '🌾',
  },
  pesticide: {
    label: 'Pesticida',
    description: 'Consumible social para expulsar cuervos de parcelas amigas.',
    icon: '/game-assets/farming/pesticide.webp',
    fallback: '🧴',
  },
  shovel: {
    label: 'Pala',
    description: 'Herramienta de farming obtenida mediante crafting.',
    icon: '/game-assets/farming/shovel.webp',
    fallback: '🪏',
  },
  scarecrow: {
    label: 'Espantapájaros',
    description: 'Se equipa a un slot y reduce la aparición de cuervos.',
    icon: '/game-assets/farming/scarecrow.webp',
    fallback: '🌾',
  },
  champion_belt: {
    label: 'Cinturón de Campeón',
    description: 'Cinturón exclusivo de Bonk Choy. Al equiparse otorga +150 HP y +15 de Daño.',
    icon: '/game-assets/farming/champion_belt.png',
    fallback: '🥊',
  },
  energy_potion_5: {
    label: 'Poción de Energía (5⚡)',
    description: 'Consumible de un solo uso. Recarga +5 energías de Ranked sin superar tu límite máximo.',
    icon: '/game-assets/farming/energy_potion.png',
    fallback: '⚡',
  },
  mother_tree_skin: {
    label: 'Skin: Árbol Centinela',
    description: 'Aspecto sagrado para el Árbol Madre. Al equiparse, tu base cambia de aspecto y dispara 2 proyectiles mágicos en líneas aleatorias cada 10s en combate.',
    icon: '/game-assets/farming/mother_tree_skin.png',
    fallback: '🌳',
  },
}

export const PVP_ALLOWED_COMMON_PLANTS: PlantId[] = ['sunflower', 'peashooter', 'wallnut', 'chomper']
export const PVP_ALLOWED_UNCOMMON_PLANTS: PlantId[] = ['garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash']
export const PVP_ALLOWED_PLANTS: PlantId[] = [...PVP_ALLOWED_COMMON_PLANTS, ...PVP_ALLOWED_UNCOMMON_PLANTS]

// Plantas de rareza RARA, ÉPICA y LEGENDARIA expresamente prohibidas en Packs/Cofres PvP
export const FORBIDDEN_PVP_PLANTS: PlantId[] = [
  'twinsunflower',
  'jalapeno', // Raras (Jalapeño NO debe salir en packs PvP)
  'kernelpult',
  'aloe',
  'tallnut', // Épicas
  'iceberglettuce',
  'threepeater', // Legendarias
]

export function isAllowedPvpPlant(plantId: unknown): plantId is PlantId {
  if (typeof plantId !== 'string') return false
  return (PVP_ALLOWED_PLANTS as string[]).includes(plantId)
}

export type PvpRewardDrop =
  | {
      type: 'plant'
      plantId: PlantId
      rarity: 'common' | 'uncommon'
      isNew: boolean
      quantity: 1
    }
  | {
      type: 'item'
      itemId: FarmingItemId
      quantity: number
    }
  | {
      type: 'gold'
      quantity: number
    }

export function parseFarmingInventory(raw: unknown): FarmingInventory {
  const parsed = { ...EMPTY_FARMING_INVENTORY }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return parsed

  for (const key of Object.keys(parsed) as FarmingItemId[]) {
    const value = Number((raw as Record<string, unknown>)[key] ?? 0)
    parsed[key] = Number.isInteger(value) && value >= 0 ? value : 0
  }
  return parsed
}
