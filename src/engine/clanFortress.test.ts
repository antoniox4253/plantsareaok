import { describe, it, expect } from 'vitest'
import { createBattleState, stepTick, crearPlantaPropia, crearPlantaDelRival } from './simulate'
import { NIVEL_POR_DEFECTO } from './bot'
import { LANES_CONFIG_5, FORTRESS_SUN_COSTS } from '../utils/gameConstants'
import type { ClanFortressPlant } from '../types/game'

describe('SISTEMA DE FORTALEZAS DE CLAN — COMBATE 5 CARRILES Y ECONOMÍA WEB3', () => {
  it('inicializa correctamente un estado de batalla de fortaleza en 5 carriles', () => {
    const state = createBattleState(
      12345,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5,
      true
    )

    expect(state.lanesCount).toBe(5)
    expect(state.isFortressMode).toBe(true)
    expect(state.p1BaseHp).toBe(1000)
    expect(state.p2BaseHp).toBe(1000)
    expect(LANES_CONFIG_5.length).toBe(5)
  })

  it('permite crear y posicionar plantas en los 5 carriles (0 a 4)', () => {
    const state = createBattleState(12345, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true)

    for (let lane = 0; lane < 5; lane++) {
      const p1 = crearPlantaPropia(state, 'peashooter', lane, 1)
      expect(p1.lane).toBe(lane)
      expect(p1.hp).toBe(300)

      const p2 = crearPlantaDelRival(state, 'wallnut', lane, 9)
      expect(p2.lane).toBe(lane)
      expect(p2.hp).toBe(1200)
    }
  })

  it('Threepeater en carril 3 dispara a carriles 2, 3 y 4 en modo 5 carriles', () => {
    const state = createBattleState(999, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true)

    // Colocar Threepeater en carril 3
    const threepeater = crearPlantaPropia(state, 'threepeater', 3, 1)
    state.plants.push(threepeater)

    // Colocar un objetivo rival en carril 4 para activar detección
    const rival = crearPlantaDelRival(state, 'wallnut', 4, 10)
    state.enemyPlants.push(rival)

    // Simular hasta que dispare
    let disparado = false
    for (let t = 0; t < 100; t++) {
      stepTick(state, () => {})
      if (state.projectiles.length > 0) {
        disparado = true
        break
      }
    }

    expect(disparado).toBe(true)
    const proyLanes = state.projectiles.map((p) => p.lane)
    expect(proyLanes).toContain(2)
    expect(proyLanes).toContain(3)
    expect(proyLanes).toContain(4)
  })

  it('calcula correctamente el presupuesto y coste de Soles de una fortaleza', () => {
    const layout: ClanFortressPlant[] = [
      { plantId: 'wallnut', lane: 1, col: 8 }, // 50
      { plantId: 'wallnut', lane: 2, col: 8 }, // 50
      { plantId: 'wallnut', lane: 3, col: 8 }, // 50
      { plantId: 'peashooter', lane: 1, col: 10 }, // 100
      { plantId: 'repeater', lane: 2, col: 10 }, // 200
      { plantId: 'peashooter', lane: 3, col: 10 }, // 100
    ]

    const totalSpent = layout.reduce((sum, p) => sum + (FORTRESS_SUN_COSTS[p.plantId] || 100), 0)
    expect(totalSpent).toBe(550)

    const budget = 1000
    expect(totalSpent <= budget).toBe(true)
  })

  it('calcula con precisión matemática el saqueo Web3 por estrellas (Fondo Expuesto 15% y Split 70/30)', () => {
    const rivalVaultGems = 3450.0 // Clan LATINKS
    const exposedPool = Math.round(rivalVaultGems * 0.15 * 100) / 100 // 517.50

    // 0 Estrellas (Derrota < 20%): 0%
    const loot0 = Math.round(exposedPool * 0.0 * 100) / 100
    expect(loot0).toBe(0)

    // 1 Estrella (20% - 49%): 25% del fondo expuesto
    const loot1 = Math.round(exposedPool * 0.25 * 100) / 100 // 129.38
    expect(loot1).toBe(129.38)
    const userShare1 = Math.round(loot1 * 0.70 * 100) / 100
    const clanShare1 = Math.round((loot1 - userShare1) * 100) / 100
    expect(userShare1).toBe(90.57)
    expect(clanShare1).toBe(38.81)

    // 2 Estrellas (50% - 89%): 60% del fondo expuesto
    const loot2 = Math.round(exposedPool * 0.60 * 100) / 100 // 310.50
    expect(loot2).toBe(310.5)

    // 3 Estrellas (100% Destrucción): 100% del fondo expuesto (517.50)
    const loot3 = Math.round(exposedPool * 1.0 * 100) / 100
    expect(loot3).toBe(517.5)
    const userShare3 = Math.round(loot3 * 0.70 * 100) / 100
    const clanShare3 = Math.round((loot3 - userShare3) * 100) / 100
    expect(userShare3).toBe(362.25)
    expect(clanShare3).toBe(155.25)
  })
})
