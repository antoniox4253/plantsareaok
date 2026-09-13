import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { PLANT_CONFIGS } from '../utils/gameConstants'
import type { PlantId } from '../types/game'

// Las 15 plantas oficiales del juego
const OFFICIAL_15_PLANTS: PlantId[] = [
  'sunflower',
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
]

// Pool de plantas Comunes (4) y Poco Comunes (5)
const CLAN_COMMON_PLANTS: PlantId[] = ['sunflower', 'peashooter', 'wallnut', 'chomper']
const CLAN_UNCOMMON_PLANTS: PlantId[] = ['garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash']

/**
 * Simulación estricta de los 2 slots de drop del Sobre Campeón de Clanes (Migración 150)
 */
function simulateClanChampionPackDrop(
  rollSlot1: number,
  rollSlot2: number,
  rollRarity: number,
  rollPlantIndex: number
) {
  // SLOT 1: 50% Agua (3x) / 50% Fertilizante (3x)
  const slot1 = rollSlot1 < 0.5 ? { item: 'water', qty: 3 } : { item: 'fertilizer', qty: 3 }

  // SLOT 2: 35% Pala / 35% Espantapájaros / 30% Planta (70% C / 30% PC)
  let slot2:
    | { type: 'item'; item: 'shovel_fragment' | 'scarecrow_fragment'; qty: number }
    | { type: 'plant'; plantId: PlantId; rarity: 'common' | 'uncommon' }

  if (rollSlot2 < 0.35) {
    slot2 = { type: 'item', item: 'shovel_fragment', qty: 1 }
  } else if (rollSlot2 < 0.7) {
    slot2 = { type: 'item', item: 'scarecrow_fragment', qty: 1 }
  } else {
    // 30% Planta
    let pool: PlantId[]
    let rarity: 'common' | 'uncommon'
    if (rollRarity < 0.7) {
      pool = CLAN_COMMON_PLANTS
      rarity = 'common'
    } else {
      pool = CLAN_UNCOMMON_PLANTS
      rarity = 'uncommon'
    }
    const plantId = pool[Math.floor(rollPlantIndex * pool.length)]
    slot2 = { type: 'plant', plantId, rarity }
  }

  return { slot1, slot2 }
}

describe('MIGRACIÓN 150: SOBRE CAMPEÓN DE CLANES (TOP 1) — DROPS Y CATÁLOGO DE 15 PLANTAS', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../supabase/migrations/150-clan-champion-pack-and-jardin-flow.sql'
  )

  it('1. El archivo de migración 150 existe y define la entrega a Jardín y claim_reward_pack', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    expect(sql).toContain("source,")
    expect(sql).toContain("'clan_champion'")
    expect(sql).toContain("v_pack.source = 'clan_champion'")
    expect(sql).toContain("shovel_fragment")
    expect(sql).toContain("scarecrow_fragment")
  })

  it('2. Todas las plantas utilizadas en el drop pertenecen estrictamente a las 15 oficiales del juego', () => {
    expect(OFFICIAL_15_PLANTS.length).toBe(15)
    for (const p of CLAN_COMMON_PLANTS) {
      expect(OFFICIAL_15_PLANTS).toContain(p)
      expect(PLANT_CONFIGS[p]).toBeDefined()
    }
    for (const p of CLAN_UNCOMMON_PLANTS) {
      expect(OFFICIAL_15_PLANTS).toContain(p)
      expect(PLANT_CONFIGS[p]).toBeDefined()
    }
  })

  it('3. Slot 1 siempre entrega exactamente Agua o Fertilizante (50% / 50%)', () => {
    const resWater = simulateClanChampionPackDrop(0.2, 0.1, 0.5, 0.5)
    expect(resWater.slot1.item).toBe('water')
    expect(resWater.slot1.qty).toBe(3)

    const resFert = simulateClanChampionPackDrop(0.8, 0.1, 0.5, 0.5)
    expect(resFert.slot1.item).toBe('fertilizer')
    expect(resFert.slot1.qty).toBe(3)
  })

  it('4. Slot 2 entrega 35% Pala, 35% Espantapájaros y 30% Planta (70% C / 30% PC)', () => {
    // 0.20 < 0.35 -> Pala
    const resShovel = simulateClanChampionPackDrop(0.1, 0.2, 0.5, 0.5)
    expect(resShovel.slot2.type).toBe('item')
    if (resShovel.slot2.type === 'item') {
      expect(resShovel.slot2.item).toBe('shovel_fragment')
    }

    // 0.50 entre 0.35 y 0.70 -> Espantapájaros
    const resScarecrow = simulateClanChampionPackDrop(0.1, 0.5, 0.5, 0.5)
    expect(resScarecrow.slot2.type).toBe('item')
    if (resScarecrow.slot2.type === 'item') {
      expect(resScarecrow.slot2.item).toBe('scarecrow_fragment')
    }

    // 0.85 >= 0.70 -> Planta Común (rollRarity < 0.70)
    const resCommonPlant = simulateClanChampionPackDrop(0.1, 0.85, 0.4, 0.0)
    expect(resCommonPlant.slot2.type).toBe('plant')
    if (resCommonPlant.slot2.type === 'plant') {
      expect(resCommonPlant.slot2.rarity).toBe('common')
      expect(CLAN_COMMON_PLANTS).toContain(resCommonPlant.slot2.plantId)
    }

    // 0.85 >= 0.70 -> Planta Poco Común (rollRarity >= 0.70)
    const resUncommonPlant = simulateClanChampionPackDrop(0.1, 0.85, 0.8, 0.0)
    expect(resUncommonPlant.slot2.type).toBe('plant')
    if (resUncommonPlant.slot2.type === 'plant') {
      expect(resUncommonPlant.slot2.rarity).toBe('uncommon')
      expect(CLAN_UNCOMMON_PLANTS).toContain(resUncommonPlant.slot2.plantId)
    }
  })

  it('5. Montecarlo 10,000 rolls: los porcentajes convergen estadísticamente a la especificación', () => {
    let countWater = 0
    let countFert = 0
    let countShovel = 0
    let countScarecrow = 0
    let countCommonPlant = 0
    let countUncommonPlant = 0

    const N = 10000
    for (let i = 0; i < N; i++) {
      const drop = simulateClanChampionPackDrop(Math.random(), Math.random(), Math.random(), Math.random())
      if (drop.slot1.item === 'water') countWater++
      else countFert++

      if (drop.slot2.type === 'item') {
        if (drop.slot2.item === 'shovel_fragment') countShovel++
        else countScarecrow++
      } else {
        if (drop.slot2.rarity === 'common') countCommonPlant++
        else countUncommonPlant++
      }
    }

    // Slot 1: 50% / 50% (+- 3%)
    expect(countWater / N).toBeGreaterThan(0.47)
    expect(countWater / N).toBeLessThan(0.53)

    // Slot 2: 35% Pala, 35% Espantapájaros, 30% Planta (21% Común, 9% Poco Común)
    expect(countShovel / N).toBeGreaterThan(0.32)
    expect(countShovel / N).toBeLessThan(0.38)

    expect(countScarecrow / N).toBeGreaterThan(0.32)
    expect(countScarecrow / N).toBeLessThan(0.38)

    const totalPlants = (countCommonPlant + countUncommonPlant) / N
    expect(totalPlants).toBeGreaterThan(0.27)
    expect(totalPlants).toBeLessThan(0.33)

    // De las plantas: 70% Común / 30% Poco Común
    const ratioCommon = countCommonPlant / (countCommonPlant + countUncommonPlant)
    expect(ratioCommon).toBeGreaterThan(0.66)
    expect(ratioCommon).toBeLessThan(0.74)
  })
})
