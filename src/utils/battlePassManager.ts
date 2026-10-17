import type { PlantId } from '../types/game'
import type { PackId } from './packDropManager'
import type { FarmingItemId } from './pvpRewardManager'

export interface PassReward {
  type: 'pack' | 'copies' | 'plant' | 'badge' | 'gold' | 'item' | 'legendary_double'
  packId?: PackId
  packCount?: number
  plantId?: PlantId
  copiesCount?: number
  goldAmount?: number
  itemId?: FarmingItemId
  itemCount?: number
  label: string
  icon: string
  secondaryPlantId?: PlantId
  secondaryLabel?: string
  secondaryIcon?: string
}

export interface PassLevel {
  level: number
  requiredXp: number
  requiredElo: number
  arenaName: string
  reward: PassReward
}

export const BATTLE_PASS_LEVELS: PassLevel[] = [
  {
    level: 1,
    requiredXp: 200,
    requiredElo: 1000,
    arenaName: 'Jardín Clásico',
    reward: {
      type: 'pack',
      packId: 'basic',
      packCount: 1,
      goldAmount: 200,
      label: '1x Sobre Básico + 200 Oro',
      icon: '/game-assets/greenfoot/seed_pack_common_whitebg.webp',
    },
  },
  {
    level: 2,
    requiredXp: 500,
    requiredElo: 1000,
    arenaName: 'Jardín Clásico',
    reward: {
      type: 'copies',
      plantId: 'twinsunflower',
      copiesCount: 2,
      label: 'x2 Girasol Doble',
      icon: '/game-assets/greenfoot/twinsunflower1.webp',
    },
  },
  {
    level: 3,
    requiredXp: 850,
    requiredElo: 1000,
    arenaName: 'Jardín Clásico',
    reward: {
      type: 'item',
      itemId: 'fertilizer',
      itemCount: 2,
      goldAmount: 200,
      label: '2x Fertilizante + 200 Oro',
      icon: '/game-assets/farming/fertilizer.webp',
    },
  },
  {
    level: 4,
    requiredXp: 1250,
    requiredElo: 1000,
    arenaName: 'Jardín Clásico (Límite)',
    reward: {
      type: 'copies',
      plantId: 'bonkchoy',
      copiesCount: 2,
      label: 'x2 Bonk Choy',
      icon: '/game-assets/greenfoot/bonkchoy1.webp',
    },
  },
  {
    level: 5,
    requiredXp: 1700,
    requiredElo: 1000,
    arenaName: 'Desierto Nocturno',
    reward: {
      type: 'item',
      itemId: 'energy_potion_5',
      itemCount: 1,
      label: '1x Poción de Energía +5',
      icon: '/game-assets/farming/energy_potion.png',
    },
  },
  {
    level: 6,
    requiredXp: 2200,
    requiredElo: 1000,
    arenaName: 'Desierto Nocturno',
    reward: {
      type: 'copies',
      plantId: 'snowpea',
      copiesCount: 2,
      label: 'x2 Hielaguisantes (T2)',
      icon: '/game-assets/plants/snowpea.webp',
    },
  },
  {
    level: 7,
    requiredXp: 2750,
    requiredElo: 1000,
    arenaName: 'Rascacielos Cyberpunk',
    reward: {
      type: 'item',
      itemId: 'sunflower_glasses',
      itemCount: 1,
      label: 'Gafas de Sol para Girasol (+5 Soles)',
      icon: '/game-assets/skins/gafasgirasol.webp',
    },
  },
  {
    level: 8,
    requiredXp: 3300,
    requiredElo: 1000,
    arenaName: 'Rascacielos Cyberpunk',
    reward: {
      type: 'copies',
      plantId: 'repeater',
      copiesCount: 2,
      itemId: 'shovel',
      itemCount: 1,
      goldAmount: 300,
      label: 'x2 Repetidora + Pala + 300 Oro',
      icon: '/game-assets/greenfoot/transparentrepeater.webp',
    },
  },
  {
    level: 9,
    requiredXp: 3900,
    requiredElo: 1000,
    arenaName: 'Rascacielos Cyberpunk',
    reward: {
      type: 'copies',
      plantId: 'explodeonut',
      copiesCount: 1,
      label: 'x1 Nuez Explosiva (Exclusiva T2)',
      icon: '/game-assets/plants/explodeonut.webp',
    },
  },
  {
    level: 10,
    requiredXp: 4500,
    requiredElo: 1000,
    arenaName: 'Rascacielos Cyberpunk',
    reward: {
      type: 'pack',
      packId: 'epic',
      packCount: 1,
      label: '1x Sobre Místico Épico',
      icon: '/game-assets/greenfoot/seed_pack_epic_whitebg.webp',
    },
  },
  {
    level: 11,
    requiredXp: 5000,
    requiredElo: 1000,
    arenaName: 'Rascacielos Cyberpunk',
    reward: {
      type: 'copies',
      plantId: 'ghostpepper',
      copiesCount: 2,
      label: 'x2 Chile Fantasma (T2)',
      icon: '/game-assets/plants/ghostpepper.webp',
    },
  },
  {
    level: 12,
    requiredXp: 5500,
    requiredElo: 1000,
    arenaName: 'Rascacielos Cyberpunk',
    reward: {
      type: 'copies',
      plantId: 'pickledpepper',
      copiesCount: 1,
      label: 'x1 Chile en Escabeche (Exclusiva T2)',
      icon: '/game-assets/plants/pickledpepper.webp',
    },
  },
  {
    level: 13,
    requiredXp: 6000,
    requiredElo: 1000,
    arenaName: 'Rascacielos Cyberpunk',
    reward: {
      type: 'copies',
      plantId: 'guacodile',
      copiesCount: 2,
      label: 'x2 Guacodilo (T2)',
      icon: '/game-assets/plants/guacodile.webp',
    },
  },
  {
    level: 14,
    requiredXp: 6450,
    requiredElo: 1000,
    arenaName: 'Coliseo Galáctico',
    reward: {
      type: 'item',
      itemId: 'energy_potion_5',
      itemCount: 1,
      goldAmount: 300,
      label: '1x Poción de Energía + 300 Oro',
      icon: '/game-assets/farming/energy_potion.png',
    },
  },
  {
    level: 15,
    requiredXp: 6850,
    requiredElo: 1000,
    arenaName: 'Coliseo Galáctico',
    reward: {
      type: 'pack',
      packId: 'basic',
      packCount: 1,
      label: '1x Sobre Básico',
      icon: '/game-assets/greenfoot/seed_pack_common_whitebg.webp',
    },
  },
  {
    level: 16,
    requiredXp: 7200,
    requiredElo: 1000,
    arenaName: 'Coliseo Galáctico',
    reward: {
      type: 'copies',
      plantId: 'tallnut',
      copiesCount: 2,
      goldAmount: 500,
      label: 'x2 Nuez Alta + 500 Oro',
      icon: '/game-assets/greenfoot/transparenttallnut.webp',
    },
  },
  {
    level: 17,
    requiredXp: 7500,
    requiredElo: 1000,
    arenaName: 'Coliseo Galáctico',
    reward: {
      type: 'item',
      itemId: 'scarecrow',
      itemCount: 1,
      goldAmount: 500,
      label: '1x Espantapájaros + 500 Oro',
      icon: '/game-assets/farming/scarecrow.webp',
    },
  },
  {
    level: 18,
    requiredXp: 7750,
    requiredElo: 1000,
    arenaName: 'Coliseo Galáctico',
    reward: {
      type: 'item',
      itemId: 'energy_potion_5',
      itemCount: 1,
      goldAmount: 500,
      label: '1x Poción de Energía + 500 Oro',
      icon: '/game-assets/farming/energy_potion.png',
    },
  },
  {
    level: 19,
    requiredXp: 7900,
    requiredElo: 1000,
    arenaName: 'Olimpo de Leyendas',
    reward: {
      type: 'copies',
      plantId: 'gatlingpea',
      copiesCount: 1,
      label: 'x1 Guisantralladora (Épica T2)',
      icon: '/game-assets/plants/gatlingpea.webp',
    },
  },
  {
    level: 20,
    requiredXp: 8000,
    requiredElo: 1000,
    arenaName: 'Olimpo de Leyendas (MÁX)',
    reward: {
      type: 'legendary_double',
      packId: 'legendary',
      packCount: 1,
      goldAmount: 1000,
      label: 'Gran Premio Doble: Pack Legendario + Carta Legendaria Aleatoria',
      icon: '/game-assets/greenfoot/seed_pack_legendary_whitebg.webp',
      secondaryLabel: 'Carta Legendaria Misteriosa',
      secondaryIcon: '/game-assets/greenfoot/threepeater1.webp',
    },
  },
]
