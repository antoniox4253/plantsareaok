import type { PlantConfig, PlantId, EnemyPlantConfig, EnemyPlantType, PlantStatKey } from '../types/game.ts'

// PlantStatKey se declaraba aquí. Se movió a types/game.ts para que PlantEntity
// pueda usarlo sin crear un ciclo de importaciones. Se re-exporta para no tocar
// a los ficheros que ya lo importan de aquí.
export type { PlantStatKey }

export const PLANT_CONFIGS: Record<PlantId, PlantConfig> = {
  sunflower: {
    id: 'sunflower',
    name: 'Sunflower',
    cost: 50,
    cooldownMs: 5000,
    maxHp: 300,
    category: 'producer',
    icon: '/game-assets/greenfoot/sunflowerpacket1.webp',
    packetActive: '/game-assets/greenfoot/sunflowerpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/sunflowerpacket1.webp',
    sprite: '/game-assets/greenfoot/transparentsunflower.webp',
    description: 'Genera soles adicionales para colocar más plantas.',
  },
  peashooter: {
    id: 'peashooter',
    name: 'Peashooter',
    cost: 100,
    cooldownMs: 7500,
    maxHp: 300,
    category: 'ranged',
    attackSpeedMs: 1400,
    damage: 25,
    icon: '/game-assets/greenfoot/peashooterpacket1.webp',
    packetActive: '/game-assets/greenfoot/peashooterpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/peashooterpacket1.webp',
    sprite: '/game-assets/greenfoot/transparentpeashooter.webp',
    description: 'Dispara guisantes a los enemigos que se acercan.',
  },
  repeater: {
    id: 'repeater',
    name: 'Repeater',
    cost: 200,
    cooldownMs: 7500,
    maxHp: 300,
    category: 'ranged',
    attackSpeedMs: 1200,
    damage: 25,
    icon: '/game-assets/greenfoot/repeaterpacket1.webp',
    packetActive: '/game-assets/greenfoot/repeaterpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/repeaterpacket1.webp',
    sprite: '/game-assets/greenfoot/transparentrepeater.webp',
    description: 'Dispara dos guisantes seguidos a gran velocidad.',
  },
  wallnut: {
    id: 'wallnut',
    name: 'Wall-nut',
    cost: 50,
    cooldownMs: 15000,
    maxHp: 1200,
    category: 'defensive',
    icon: '/game-assets/greenfoot/walnutpacket1.webp',
    packetActive: '/game-assets/greenfoot/walnutpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/walnutpacket1.webp',
    sprite: '/game-assets/greenfoot/transparentwalnut.webp',
    description: 'Una cáscara dura que se queda fija como TANQUE protegiendo a tus otras plantas.',
  },
  melonpult: {
    id: 'melonpult',
    name: 'Melon-pult',
    cost: 375,
    cooldownMs: 10000,
    maxHp: 350,
    category: 'ranged',
    attackSpeedMs: 2400,
    damage: 80,
    icon: '/game-assets/greenfoot/melonpacket1.webp',
    packetActive: '/game-assets/greenfoot/melonpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/melonpacket1.webp',
    sprite: '/game-assets/images/Plants/melon_pult.webp',
    description: 'Lanza sandías pesadas que infligen daño de área.',
  },
  chomper: {
    id: 'chomper',
    name: 'Cactus',
    cost: 150,
    cooldownMs: 8000,
    maxHp: 500,
    category: 'melee',
    moveSpeed: 4.5, // % per second walking towards P2 base
    attackSpeedMs: 1100,
    damage: 35,
    icon: '/game-assets/greenfoot/cactuspacket1.webp',
    packetActive: '/game-assets/greenfoot/cactuspacket1.webp',
    packetDisabled: '/game-assets/greenfoot/cactuspacket1.webp',
    sprite: '/game-assets/greenfoot/cactus1.webp',
    description: 'Planta atacante que CAMINA hacia la base enemiga disparando espinas continuamente.',
  },
  bonkchoy: {
    id: 'bonkchoy',
    name: 'Bonk Choy',
    cost: 150,
    cooldownMs: 7500,
    maxHp: 600,
    category: 'melee',
    moveSpeed: 5.0,
    attackSpeedMs: 700,
    damage: 65,
    icon: '/game-assets/greenfoot/bonkchoypacket1.webp',
    packetActive: '/game-assets/greenfoot/bonkchoypacket1.webp',
    packetDisabled: '/game-assets/greenfoot/bonkchoypacket1.webp',
    sprite: '/game-assets/greenfoot/bonkchoy1.webp',
    description: 'Lanza puñetazos rabiosos y veloces a los enemigos cercanos.',
  },
  garlic: {
    id: 'garlic',
    name: 'Squash',
    cost: 50,
    cooldownMs: 7500,
    maxHp: 300,
    category: 'melee',
    moveSpeed: 6.0,
    damage: 600,
    icon: '/game-assets/greenfoot/garlicpacket1.webp',
    packetActive: '/game-assets/greenfoot/garlicpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/garlicpacket1.webp',
    sprite: '/game-assets/greenfoot/garlic1.webp',
    description: 'Salta sobre el primer enemigo y lo aplasta con impacto masivo.',
  },
  squash: {
    id: 'squash',
    name: 'Potato Mine',
    cost: 25,
    cooldownMs: 20000,
    maxHp: 300,
    category: 'defensive',
    damage: 1800,
    icon: '/game-assets/greenfoot/potatopacket1.webp',
    packetActive: '/game-assets/greenfoot/potatopacket1.webp',
    packetDisabled: '/game-assets/greenfoot/potatopacket1.webp',
    sprite: '/game-assets/greenfoot/potato1.webp',
    description: 'Se clava en la tierra y requiere tiempo para armarse. Al ser pisada por un enemigo, explota causando daño masivo.',
  },
  twinsunflower: {
    id: 'twinsunflower',
    name: 'Twin Sunflower',
    cost: 125,
    cooldownMs: 10000,
    maxHp: 300,
    category: 'producer',
    icon: '/game-assets/greenfoot/twinsunflowerpacket1.webp',
    packetActive: '/game-assets/greenfoot/twinsunflowerpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/twinsunflowerpacket1.webp',
    sprite: '/game-assets/greenfoot/twinsunflower1.webp',
    description: 'Genera el doble de soles que un girasol común.',
  },
  threepeater: {
    id: 'threepeater',
    name: 'Threepeater',
    cost: 325,
    cooldownMs: 7500,
    maxHp: 300,
    category: 'ranged',
    attackSpeedMs: 1400,
    damage: 75,
    icon: '/game-assets/greenfoot/threepeaterpacket1.webp',
    packetActive: '/game-assets/greenfoot/threepeaterpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/threepeaterpacket1.webp',
    sprite: '/game-assets/greenfoot/threepeater1.webp',
    description: 'Dispara guisantes en tres carriles adyacentes simultáneamente.',
  },
  tallnut: {
    id: 'tallnut',
    name: 'Tall-nut',
    cost: 125,
    cooldownMs: 20000,
    maxHp: 2400,
    category: 'defensive',
    icon: '/game-assets/greenfoot/tallnutpacket1.webp',
    packetActive: '/game-assets/greenfoot/tallnutpacket1.webp',
    packetDisabled: '/game-assets/greenfoot/tallnutpacket1.webp',
    sprite: '/game-assets/greenfoot/transparenttallnut.webp',
    description: 'Nuez gigante defensiva ultra resistente. Absorbe una cantidad enorme de daño frente a los enemigos.',
  },
  jalapeno: {
    id: 'jalapeno',
    name: 'Jalapeño',
    cost: 125,
    cooldownMs: 45000,
    maxHp: 1,
    category: 'defensive',
    damage: 1000,
    icon: '/game-assets/plants/jalapeno_hd.webp',
    packetActive: '/game-assets/plants/jalapeno_hd.webp',
    packetDisabled: '/game-assets/plants/jalapeno_hd.webp',
    sprite: '/game-assets/plants/jalapeno_hd.webp',
    description: 'Planta Explosiva de Carril de 1 Solo Uso. Al colocarlo en el carril, explota quemando la línea entera e infligiendo 1000 de daño (+150 por nivel) antes de desaparecer.',
  },
  iceberglettuce: {
    id: 'iceberglettuce',
    name: 'Lechuga Helada',
    cost: 0,
    cooldownMs: 12000,
    maxHp: 1,
    category: 'defensive',
    damage: 0,
    icon: '/game-assets/greenfoot/iceberglettucepacket1.webp',
    packetActive: '/game-assets/greenfoot/iceberglettucepacket1.webp',
    packetDisabled: '/game-assets/greenfoot/iceberglettucepacket1.webp',
    sprite: '/game-assets/plants/iceberglettuce_hd.webp',
    description: 'Planta de Hielo de 0 Soles de 1 Solo Uso. Al colocarse en el campo, congela a todos los enemigos durante 7 segundos (+2s por cada nivel), dejándolos inmóviles e incapaces de atacar o actuar.',
  },
  aloe: {
    id: 'aloe',
    name: 'Aloe Curandera',
    cost: 100,
    cooldownMs: 8000,
    maxHp: 400,
    category: 'producer',
    attackSpeedMs: 2500,
    damage: 60,
    icon: '/game-assets/plants/aloe_hd.webp',
    packetActive: '/game-assets/plants/aloe_hd.webp',
    packetDisabled: '/game-assets/plants/aloe_hd.webp',
    sprite: '/game-assets/plants/aloe_hd.webp',
    description: 'Planta de Soporte Curativo Inteligente. Regenera la salud de las plantas heridas en su carril.',
  },
  kernelpult: {
    id: 'kernelpult',
    name: 'Lanzamaíz',
    cost: 100,
    cooldownMs: 7500,
    maxHp: 300,
    category: 'ranged',
    attackSpeedMs: 2900,
    damage: 30,
    icon: '/game-assets/plants/kernelpult.webp',
    packetActive: '/game-assets/plants/kernelpult.webp',
    packetDisabled: '/game-assets/plants/kernelpult.webp',
    sprite: '/game-assets/plants/kernelpult.webp',
    description: 'Catapulta fija que lanza granos de maíz (30 DMG) y mantequilla paralizante (60 DMG) a cualquiera de las 3 líneas con enemigos (3s a 6s).',
  },
}

export const ENEMY_PLANT_CONFIGS: Record<EnemyPlantType, EnemyPlantConfig> = {
  enemy_sunflower: {
    type: 'enemy_sunflower',
    name: 'Girasol Enemigo',
    cost: 50,
    maxHp: 300,
    speed: 0,
    damage: 0,
    sprite: '/game-assets/greenfoot/transparentsunflower.webp',
    rewardSun: 25,
    category: 'producer',
  },
  enemy_peashooter: {
    type: 'enemy_peashooter',
    name: 'Guisantera Enemiga',
    cost: 100,
    maxHp: 260,
    speed: 0,
    damage: 30,
    sprite: '/game-assets/greenfoot/transparentpeashooter.webp',
    rewardSun: 25,
    category: 'ranged',
  },
  enemy_wallnut: {
    type: 'enemy_wallnut',
    name: 'Nuez Enemiga',
    cost: 50,
    maxHp: 850,
    speed: 0,
    damage: 25,
    sprite: '/game-assets/greenfoot/transparentwalnut.webp',
    rewardSun: 35,
    category: 'defensive',
  },
  enemy_chomper: {
    type: 'enemy_chomper',
    name: 'Cactus Enemigo',
    cost: 150,
    maxHp: 480,
    speed: 3.5,
    damage: 90,
    sprite: '/game-assets/greenfoot/cactus1.webp',
    rewardSun: 40,
    category: 'melee',
  },
  enemy_melonpult: {
    type: 'enemy_melonpult',
    name: 'Melón Enemigo',
    cost: 375,
    maxHp: 380,
    speed: 0,
    damage: 70,
    sprite: '/game-assets/images/Plants/melon_pult.webp',
    rewardSun: 50,
    category: 'ranged',
  },
  enemy_kernelpult: {
    type: 'enemy_kernelpult',
    name: 'Lanzamaíz Enemigo',
    cost: 100,
    maxHp: 300,
    speed: 0,
    damage: 30,
    sprite: '/game-assets/plants/kernelpult.webp',
    rewardSun: 25,
    category: 'ranged',
  },
}

export const INITIAL_SUN = 0
export const INITIAL_BASE_HP = 600
export const SUN_VALUE = 25
export const RANKED_MATCHMAKING_TIMEOUT_SECONDS = 30

export const LANES_CONFIG = [
  { id: 0, topPct: 20, heightPct: 19.33 },
  { id: 1, topPct: 39.33, heightPct: 19.34 },
  { id: 2, topPct: 58.67, heightPct: 19.33 },
]

export const BASE_LEFT_END_X = 15
export const BASE_RIGHT_START_X = 85
export const FIELD_WIDTH_PCT = BASE_RIGHT_START_X - BASE_LEFT_END_X
export const TOTAL_COLUMNS = 12
export const P1_COLUMNS = 6
export const P2_COLUMNS = 6
export const DECK_SIZE = 6
export const MAX_DECK_SLOTS = 6


export const STAT_LABELS: Record<PlantStatKey, { label: string; icon: string; suffix: string; color: string }> = {
  hp: { label: 'Vida Máxima (HP)', icon: '💚', suffix: '+15% HP', color: '#4ade80' },
  damage: { label: 'Daño de Ataque', icon: '⚔️', suffix: '+15% Daño', color: '#f87171' },
  attackSpeed: { label: 'Velocidad de Disparo', icon: '⚡', suffix: '+15% Cadencia', color: '#fbbf24' },
  moveSpeed: { label: 'Velocidad de Movimiento', icon: '👟', suffix: '+15% Movimiento', color: '#60a5fa' },
  cooldown: { label: 'Recarga de Carta', icon: '⏳', suffix: '-15% Recarga', color: '#c084fc' },
  duration: { label: 'Duración de Efecto', icon: '❄️', suffix: '+2s Duración', color: '#38bdf8' },
}

export function getEligibleStatsForPlant(plantId: PlantId): PlantStatKey[] {
  if (plantId === 'iceberglettuce') {
    return ['duration', 'cooldown']
  }
  if (plantId === 'jalapeno') {
    return ['damage', 'cooldown']
  }
  if (plantId === 'kernelpult') {
    return ['hp', 'cooldown', 'damage', 'attackSpeed', 'duration']
  }

  const base = PLANT_CONFIGS[plantId]
  if (!base) return ['hp', 'cooldown']

  const list: PlantStatKey[] = ['hp', 'cooldown']

  if (base.damage !== undefined && base.damage > 0) {
    list.push('damage')
  }
  if (base.attackSpeedMs !== undefined && base.attackSpeedMs > 0) {
    list.push('attackSpeed')
  }
  if (base.moveSpeed !== undefined && base.moveSpeed > 0) {
    list.push('moveSpeed')
  }

  return list
}

export function getFusionGoldCost(plantId: PlantId, level: number): number {
  let base = 1000
  if (plantId === 'threepeater' || plantId === 'iceberglettuce') {
    base = 3500
  } else if (plantId === 'aloe' || plantId === 'tallnut') {
    base = 3000
  } else if (plantId === 'twinsunflower' || plantId === 'jalapeno' || plantId === 'kernelpult') {
    base = 2500
  } else if (['garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash'].includes(plantId)) {
    base = 1500
  }

  return Math.round(base * Math.pow(1.5, Math.max(0, level)))
}

export function getScaledPlantConfig(
  plantId: PlantId,
  levelOrRolls: number | PlantStatKey[] = 0,
  equippedItem?: string | null
): PlantConfig {
  const base = PLANT_CONFIGS[plantId]
  if (!base) return base

  let scaled: PlantConfig

  if (Array.isArray(levelOrRolls)) {
    if (levelOrRolls.length === 0) {
      scaled = base
    } else {
      let hpMultiplier = 1
      let dmgMultiplier = 1
      let attackSpeedMultiplier = 1
      let moveSpeedMultiplier = 1
      let cooldownMultiplier = 1
      let extraDamage = 0

      levelOrRolls.forEach((stat) => {
        // Jalapeño e Iceberg Lettuce son de 1 solo uso y no escalan vida
        if (stat === 'hp' && plantId !== 'jalapeno' && plantId !== 'iceberglettuce') {
          hpMultiplier += 0.15
        }
        if (stat === 'damage') {
          if (plantId === 'jalapeno') {
            extraDamage += 150
          } else {
            dmgMultiplier += 0.15
          }
        }
        if (stat === 'attackSpeed') attackSpeedMultiplier *= 0.85 // 15% faster delay
        if (stat === 'moveSpeed') moveSpeedMultiplier += 0.15
        if (stat === 'cooldown') cooldownMultiplier *= 0.85 // 15% faster cooldown
      })

      const finalDamage =
        base.damage !== undefined
          ? Math.round(base.damage * dmgMultiplier) + extraDamage
          : undefined

      scaled = {
        ...base,
        maxHp: plantId === 'jalapeno' || plantId === 'iceberglettuce' ? base.maxHp : Math.round(base.maxHp * hpMultiplier),
        damage: finalDamage,
        attackSpeedMs:
          base.attackSpeedMs !== undefined
            ? Math.round(base.attackSpeedMs * attackSpeedMultiplier)
            : undefined,
        moveSpeed:
          base.moveSpeed !== undefined
            ? Number((base.moveSpeed * moveSpeedMultiplier).toFixed(2))
            : undefined,
        cooldownMs: Math.round(base.cooldownMs * cooldownMultiplier),
      }
    }
  } else if (levelOrRolls <= 0) {
    scaled = base
  } else if (plantId === 'jalapeno') {
    scaled = {
      ...base,
      damage: (base.damage ?? 1000) + levelOrRolls * 150,
    }
  } else if (plantId === 'iceberglettuce') {
    scaled = base
  } else {
    const scale = 1 + levelOrRolls * 0.15
    scaled = {
      ...base,
      maxHp: Math.round(base.maxHp * scale),
      damage: base.damage !== undefined ? Math.round(base.damage * scale) : undefined,
    }
  }

  // ── BONIFICACIÓN EXCLUSIVA DE ÍTEMS EQUIPABLES ────────────────────────────────
  if (equippedItem && EQUIPPABLE_PLANT_ITEMS[equippedItem]) {
    const itemDef = EQUIPPABLE_PLANT_ITEMS[equippedItem]
    if (itemDef.targetPlantId === plantId) {
      return itemDef.applyStats(scaled)
    }
  }

  return scaled
}

export interface EquippablePlantItemDef {
  id: string
  name: string
  emoji: string
  targetPlantId: PlantId
  equippedPlantName: string
  description: string
  statBonusText: string
  applyStats: (scaled: PlantConfig) => PlantConfig
}

export const EQUIPPABLE_PLANT_ITEMS: Record<string, EquippablePlantItemDef> = {
  champion_belt: {
    id: 'champion_belt',
    name: 'Cinturón de Campeón',
    emoji: '🥊',
    targetPlantId: 'bonkchoy',
    equippedPlantName: 'Bonk Choy Campeón',
    description: 'Cinturón exclusivo de Bonk Choy. Al equiparse otorga +150 HP y +15 de Daño.',
    statBonusText: '+150 HP · +15 Daño',
    applyStats: (scaled) => ({
      ...scaled,
      maxHp: scaled.maxHp + 150,
      damage: (scaled.damage ?? 65) + 15,
      sprite: '/game-assets/greenfoot/bonkchoy_champion.png',
      icon: '/game-assets/greenfoot/bonkchoy_champion.png',
      packetActive: '/game-assets/greenfoot/bonkchoy_champion.png',
      packetDisabled: '/game-assets/greenfoot/bonkchoy_champion.png',
    }),
  },
  witch_hat: {
    id: 'witch_hat',
    name: 'Sombrero de Bruja',
    emoji: '🧙‍♀️',
    targetPlantId: 'kernelpult',
    equippedPlantName: 'Lanzamaíz Bruja',
    description: 'Sombrero místico de bruja con calabazas mágicas. Al equiparse en Lanzamaíz otorga +200 HP y +25 de Daño.',
    statBonusText: '+200 HP · +25 Daño',
    applyStats: (scaled) => ({
      ...scaled,
      maxHp: scaled.maxHp + 200,
      damage: (scaled.damage ?? 30) + 25,
      sprite: '/game-assets/auction/kernel_witch.png',
      icon: '/game-assets/auction/kernel_witch.png',
      packetActive: '/game-assets/auction/kernel_witch.png',
      packetDisabled: '/game-assets/auction/kernel_witch.png',
    }),
  },
}

export function getEquippableItemDef(itemId?: string | null): EquippablePlantItemDef | undefined {
  if (!itemId) return undefined
  return EQUIPPABLE_PLANT_ITEMS[itemId]
}

export function getEquippableItemForPlant(plantId: PlantId): EquippablePlantItemDef | undefined {
  return Object.values(EQUIPPABLE_PLANT_ITEMS).find((item) => item.targetPlantId === plantId)
}

/**
 * Precio del Pase VIP, en GEMAS.
 *
 * Sólo para los textos. El precio de verdad lo cobra el servidor leyendo
 * shop_config.vip_pass_price_gems, así que si algún día se cambia ahí hay que
 * cambiarlo aquí también — o el botón dirá un número y se cobrará otro.
 *
 * 2500 gemas = $25.00 USD (ratio estándar: 100 gemas = $1.00 USD).
 */
export const VIP_PASS_PRECIO_GEMAS = 2500

/**
 * Precio de la Oferta Flash (Jalapeño), en GEMAS.
 * Equivalente exacto a $30.00 USD (30 gemas del sistema anterior x 100 = 3000 gemas).
 */
export const FLASH_OFFER_PRICE_GEMS = 3000

/**
 * SISTEMA DE ENERGÍAS DIARIAS (RANKED LADDER & TIENDA)
 */
export const ENERGY_FREE_ELO_THRESHOLD = 1602 // Copas a partir de las cuales se cobra energía en Ranked
export const BASE_DAILY_ENERGY = 20
export const VIP_DAILY_ENERGY = 25

export type EnergyCurrency = 'gems' | 'gold'

export interface EnergyPackage {
  id: string
  name: string
  energyAmount: number
  isFullRefill?: boolean
  currency: EnergyCurrency
  price: number
  priceGems?: number
  badge?: string
  popular?: boolean
  bestValue?: boolean
  description: string
}

export const ENERGY_PACKAGES_GEMS: EnergyPackage[] = [
  {
    id: 'energy_5',
    name: 'Recarga 5⚡',
    energyAmount: 5,
    currency: 'gems',
    price: 200,
    priceGems: 200,
    badge: '5 PARTIDAS',
    description: '+5 Energías ⚡ para seguir compitiendo en Ranked.',
  },
  {
    id: 'energy_10',
    name: 'Pase Grinder 10⚡',
    energyAmount: 10,
    currency: 'gems',
    price: 300,
    priceGems: 300,
    badge: 'MÁS POPULAR',
    popular: true,
    description: '+10 Energías ⚡ para extender tu racha y asegurar tu top.',
  },
  {
    id: 'energy_full',
    name: 'Recarga Completa',
    energyAmount: 20,
    isFullRefill: true,
    currency: 'gems',
    price: 500,
    priceGems: 500,
    badge: 'MEJOR VALOR',
    bestValue: true,
    description: 'Restablece tu energía al 100% de tu capacidad máxima (20 o 25⚡ con VIP).',
  },
]

export const ENERGY_PACKAGES_GOLD: EnergyPackage[] = [
  {
    id: 'energy_gold_1',
    name: 'Chispazo 1⚡',
    energyAmount: 1,
    currency: 'gold',
    price: 500,
    badge: '1 PARTIDA',
    description: '+1 Energía ⚡ para una última partida de revancha.',
  },
  {
    id: 'energy_gold_3',
    name: 'Trío Competitivo 3⚡',
    energyAmount: 3,
    currency: 'gold',
    price: 1000,
    badge: 'AHORRO ORO',
    description: '+3 Energías ⚡ usando tu oro acumulado de batallas.',
  },
  {
    id: 'energy_gold_5',
    name: 'Batería Dorada 5⚡',
    energyAmount: 5,
    currency: 'gold',
    price: 1500,
    badge: 'PACK DORADO',
    popular: true,
    description: '+5 Energías ⚡ para una sesión completa sin gastar gemas.',
  },
]

export const ENERGY_PACKAGES: EnergyPackage[] = [
  ...ENERGY_PACKAGES_GEMS,
  ...ENERGY_PACKAGES_GOLD,
]
