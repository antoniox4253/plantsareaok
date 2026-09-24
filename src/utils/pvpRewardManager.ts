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
  | 'witch_hat'
  | 'knight_helmet'
  | 'energy_potion_5'
  | 'mother_tree_skin'
  | 'sunflower_glasses'
  | 'cactus_armor'
  | 'superman_suit'
  | 'spiderman_suit'
  | 'batman_suit'
  | 'ironman_suit'
  | 'gold_24k'
  | 'samurai_armor'

export interface FarmingInventory {
  water: number
  fertilizer: number
  shovel_fragment: number
  scarecrow_fragment: number
  pesticide: number
  shovel: number
  scarecrow: number
  champion_belt: number
  witch_hat: number
  knight_helmet: number
  energy_potion_5: number
  mother_tree_skin: number
  sunflower_glasses: number
  cactus_armor: number
  superman_suit: number
  spiderman_suit: number
  batman_suit: number
  ironman_suit: number
  gold_24k: number
  samurai_armor: number
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
  witch_hat: 0,
  knight_helmet: 0,
  energy_potion_5: 0,
  mother_tree_skin: 0,
  sunflower_glasses: 0,
  cactus_armor: 0,
  superman_suit: 0,
  spiderman_suit: 0,
  batman_suit: 0,
  ironman_suit: 0,
  gold_24k: 0,
  samurai_armor: 0,
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
  witch_hat: {
    label: 'Sombrero Mágico',
    description: 'Sombrero místico exclusivo de Lanzamaíz. Otorga +80 HP y permite lanzar 2 mantequillas congelantes en vez de una.',
    icon: '/game-assets/farming/witch_hat.png',
    fallback: '🧙‍♀️',
  },
  knight_helmet: {
    label: 'Yelmo de Caballero',
    description: 'Yelmo exclusivo de Nuez. Al equiparse otorga +350 HP y resistencia de acero.',
    icon: '/game-assets/auction/knight_wallnut.png',
    fallback: '🛡️',
  },
  energy_potion_5: {
    label: 'Poción de Energía (5⚡)',
    description: 'Consumible de un solo uso. Recarga +5 energías de Ranked sin superar tu límite máximo.',
    icon: '/game-assets/farming/energy_potion.png',
    fallback: '⚡',
  },
  mother_tree_skin: {
    label: 'Skin: Árbol Centinela',
    description: 'Aspecto sagrado para el Árbol Madre. Al equiparse, tu base cambia de aspecto y dispara 2 proyectiles mágicos en líneas aleatorias (1º a los 25s, luego cada 15s) en combate.',
    icon: '/game-assets/farming/mother_tree_skin.png',
    fallback: '🌳',
  },
  sunflower_glasses: {
    label: 'Gafas de Sol',
    description: 'Gafas oscuras con estilo para Girasol. Aumenta la producción de soles en combate y mazmorra.',
    icon: '/game-assets/farming/sunflower_glasses.webp',
    fallback: '🕶️',
  },
  cactus_armor: {
    label: 'Armadura de Cactus',
    description: 'Armadura con púas de acero reforzado para Cactus. Otorga +15 de Daño continuo en combate.',
    icon: '/game-assets/farming/cactus_armor.webp',
    fallback: '🌵',
  },
  superman_suit: {
    label: 'Capa de Superman',
    description: 'Traje heroico legendario para la Nuez. Otorga +200 HP de resistencia heroica.',
    icon: '/game-assets/farming/superman_suit.webp',
    fallback: '🦸',
  },
  spiderman_suit: {
    label: 'Traje de Spiderman',
    description: 'Mallas arácnidas exclusivas para la Nuez. Otorga +200 HP de resistencia trepamuros.',
    icon: '/game-assets/farming/spiderman_suit.webp',
    fallback: '🕷️',
  },
  batman_suit: {
    label: 'Armadura de Batman',
    description: 'Armadura táctica de la noche para la Nuez. Otorga +200 HP de blindaje gótico impenetrable.',
    icon: '/game-assets/farming/batman_suit.webp',
    fallback: '🦇',
  },
  ironman_suit: {
    label: 'Reactor de Iron Man',
    description: 'Armadura de titanio y reactor arc para la Nuez. Otorga +200 HP de resistencia tecnológica.',
    icon: '/game-assets/farming/ironman_suit.webp',
    fallback: '🦾',
  },
  gold_24k: {
    label: 'Bañado en Oro 24K',
    description: 'Bañado en oro puro de 24 quilates para la Nuez. Otorga +300 HP y reduce 2 segundos su tiempo de recarga.',
    icon: '/game-assets/farming/gold_24k.webp',
    fallback: '👑',
  },
  samurai_armor: {
    label: 'Armadura Samurái',
    description: 'Armadura y katana samurái para Squash. Reduce 1.5 segundos su tiempo de recarga.',
    icon: '/game-assets/farming/samurai_armor.webp',
    fallback: '⚔️',
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
