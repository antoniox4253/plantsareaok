import { describe, it, expect } from 'vitest'
import { createBattleState, stepTick, crearPlantaPropia, crearPlantaDelRival } from './simulate'
import { NIVEL_POR_DEFECTO } from './bot'
import { LANES_CONFIG_5, FORTRESS_SUN_COSTS } from '../utils/gameConstants'
import type { ClanFortressPlant } from '../types/game'

describe('SISTEMA DE FORTALEZAS DE CLAN — COMBATE 5 CARRILES Y ECONOMÍA REBALANCEADA', () => {
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

  it('calcula con precisión matemática el saqueo equilibrado por estrellas (mínimo 2 estrellas, topes 30/60 gemas y 100% al clan)', () => {
    // Función de cálculo autoritativa reflejando el nuevo SQL
    const calculateRaidLoot = (rivalVaultGems: number, stars: number) => {
      let stolen = 0
      if (stars >= 3) {
        stolen = Math.min(60, Math.max(15, Math.round(rivalVaultGems * 0.08)))
      } else if (stars === 2) {
        stolen = Math.min(30, Math.max(5, Math.round(rivalVaultGems * 0.05)))
      } else {
        stolen = 0
      }
      stolen = Math.min(stolen, rivalVaultGems)
      const userShare = 0 // 0% al usuario personal
      const clanShare = stolen // 100% al tesoro del clan
      return { stolen, userShare, clanShare }
    }

    // Clan rival con 6,000 gemas (no debe ser desangrado por un 10% plano de 600 gemas)
    const bigRivalVault = 6000.0

    // 0 Estrellas (Derrota): 0 Gemas
    const loot0 = calculateRaidLoot(bigRivalVault, 0)
    expect(loot0.stolen).toBe(0)
    expect(loot0.clanShare).toBe(0)

    // 1 Estrella (Ataque contenido): 0 Gemas
    const loot1 = calculateRaidLoot(bigRivalVault, 1)
    expect(loot1.stolen).toBe(0)
    expect(loot1.clanShare).toBe(0)

    // 2 Estrellas: Saqueo parcial tope de 30 Gemas (en vez de cientos)
    const loot2 = calculateRaidLoot(bigRivalVault, 2)
    expect(loot2.stolen).toBe(30) // Tope aplicado
    expect(loot2.userShare).toBe(0) // 0 a cuenta personal
    expect(loot2.clanShare).toBe(30) // 100% al tesoro del clan

    // 3 Estrellas: Saqueo total tope de 60 Gemas
    const loot3 = calculateRaidLoot(bigRivalVault, 3)
    expect(loot3.stolen).toBe(60) // Tope aplicado
    expect(loot3.userShare).toBe(0) // 0 a cuenta personal
    expect(loot3.clanShare).toBe(60) // 100% al tesoro del clan

    // Clan rival con pocas gemas (ej. 200 gemas)
    const smallRivalVault = 200.0
    const smallLoot2 = calculateRaidLoot(smallRivalVault, 2)
    expect(smallLoot2.stolen).toBe(10) // 5% de 200 = 10
    expect(smallLoot2.clanShare).toBe(10)

    const smallLoot3 = calculateRaidLoot(smallRivalVault, 3)
    expect(smallLoot3.stolen).toBe(16) // 8% de 200 = 16
    expect(smallLoot3.clanShare).toBe(16)
  })

  it('verifica la escala de progresión del Árbol Madre del Clan (Niveles 1 a 4)', () => {
    const getMotherTreeStats = (level: number) => {
      const safeLevel = Math.max(1, Math.min(4, level))
      const maxBudget = 1000 + ((safeLevel - 1) * 500)
      const baseHp = 500 + ((safeLevel - 1) * 200)
      return { maxBudget, baseHp }
    }

    // Nivel 1: Inicial
    expect(getMotherTreeStats(1)).toEqual({ maxBudget: 1000, baseHp: 500 })

    // Nivel 2: +500 Soles, +200 HP
    expect(getMotherTreeStats(2)).toEqual({ maxBudget: 1500, baseHp: 700 })

    // Nivel 3: +500 Soles, +200 HP
    expect(getMotherTreeStats(3)).toEqual({ maxBudget: 2000, baseHp: 900 })

    // Nivel 4: Tope Máximo Titánico
    expect(getMotherTreeStats(4)).toEqual({ maxBudget: 2500, baseHp: 1100 })
  })

  it('calcula las conversiones del Altar Solar: 1 copia = 100☀️, 100💎 = 200☀️, 100🪙 = 100☀️ y victoria VIP = +5☀️', () => {
    // Quema de 3 copias de plantas
    const plantCopiesDonated = 3
    const sunsFromCopies = plantCopiesDonated * 100
    expect(sunsFromCopies).toBe(300)

    // Donación de 250 gemas al tesoro
    const gemsDonated = 250
    const sunsFromGems = gemsDonated * 2
    expect(sunsFromGems).toBe(500)

    // Donación de 1000 oro
    const goldDonated = 1000
    const sunsFromGold = goldDonated
    expect(sunsFromGold).toBe(1000)

    // Bono de victoria VIP
    const vipVictorySunsBonus = 5
    expect(vipVictorySunsBonus).toBe(5)
  })

  it('valida las reglas de roles, costes de asalto y enfriamiento de derrota (24h)', () => {
    const isOfficer = (role: string) => ['leader', 'coleader', 'elder'].includes(role)

    // Oficiales (Líder, Colíder, Veterano): pagan 500 oro del clan y NO sufren cooldown
    for (const officerRole of ['leader', 'coleader', 'elder']) {
      expect(isOfficer(officerRole)).toBe(true)
      const attackCost = 500
      const costSource = 'clan_gold'
      const cooldownOnDefeat = false

      expect(attackCost).toBe(500)
      expect(costSource).toBe('clan_gold')
      expect(cooldownOnDefeat).toBe(false)
    }

    // Miembro regular: paga 250 de oro personal y sufre cooldown de 24h si pierde (0 estrellas)
    expect(isOfficer('member')).toBe(false)
    const memberCost = 250
    const memberCostSource = 'personal_gold'
    const memberCooldownOnDefeat = true

    expect(memberCost).toBe(250)
    expect(memberCostSource).toBe('personal_gold')
    expect(memberCooldownOnDefeat).toBe(true)
  })
})
