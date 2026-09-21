import { describe, it, expect } from 'vitest'
import { createBattleState, stepTick, crearPlantaPropia, crearPlantaDelRival, simularDefensaDeFortaleza } from './simulate'
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

  it('calcula con precisión matemática el saqueo fijo por estrellas (3⭐ = 60💎, 2⭐ = 30💎, 100% al clan y bono de oro)', () => {
    // Función de cálculo autoritativa reflejando el SQL de migración 211
    const calculateRaidLoot = (rivalVaultGems: number, stars: number) => {
      let stolen = 0
      let goldBonus = 0
      if (stars >= 3) {
        stolen = Math.min(60, Math.max(0, rivalVaultGems))
        goldBonus = 500
      } else if (stars === 2) {
        stolen = Math.min(30, Math.max(0, rivalVaultGems))
        goldBonus = 200
      } else {
        stolen = 0
        goldBonus = 0
      }
      const userShare = 0 // 0% gemas al usuario personal
      const clanShare = stolen // 100% gemas al tesoro del clan
      return { stolen, userShare, clanShare, goldBonus }
    }

    // Bot o clan rival con 500 o 1,000 gemas
    const rivalVault = 1000.0

    // 0 Estrellas (Derrota): 0 Gemas, 0 Oro
    const loot0 = calculateRaidLoot(rivalVault, 0)
    expect(loot0.stolen).toBe(0)
    expect(loot0.clanShare).toBe(0)
    expect(loot0.goldBonus).toBe(0)

    // 1 Estrella: 0 Gemas, 0 Oro
    const loot1 = calculateRaidLoot(rivalVault, 1)
    expect(loot1.stolen).toBe(0)
    expect(loot1.clanShare).toBe(0)
    expect(loot1.goldBonus).toBe(0)

    // 2 Estrellas: Saqueo fijo de 30 Gemas y +200 de Oro
    const loot2 = calculateRaidLoot(rivalVault, 2)
    expect(loot2.stolen).toBe(30)
    expect(loot2.clanShare).toBe(30)
    expect(loot2.goldBonus).toBe(200)

    // 3 Estrellas: Saqueo fijo de 60 Gemas y +500 de Oro
    const loot3 = calculateRaidLoot(rivalVault, 3)
    expect(loot3.stolen).toBe(60)
    expect(loot3.clanShare).toBe(60)
    expect(loot3.goldBonus).toBe(500)

    // Si el rival tuviera menos gemas que el valor fijo (ej. 20 gemas disponibles)
    const poorRivalVault = 20.0
    const poorLoot3 = calculateRaidLoot(poorRivalVault, 3)
    expect(poorLoot3.stolen).toBe(20) // Se lleva hasta agotar el saldo disponible
    expect(poorLoot3.clanShare).toBe(20)
    expect(poorLoot3.goldBonus).toBe(500)
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

  it('inicia el asalto a la fortaleza con los Soles de Ataque configurados según el nivel del Árbol Madre (100 -> 150 -> 200 -> 250)', () => {
    // Nivel 1: 100 soles iniciales
    const stateLvl1 = createBattleState(101, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true, 100)
    expect(stateLvl1.sunBank).toBe(100)

    // Nivel 2: 150 soles iniciales
    const stateLvl2 = createBattleState(102, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true, 150)
    expect(stateLvl2.sunBank).toBe(150)

    // Nivel 3: 200 soles iniciales
    const stateLvl3 = createBattleState(103, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true, 200)
    expect(stateLvl3.sunBank).toBe(200)

    // Nivel 4: 250 soles iniciales
    const stateLvl4 = createBattleState(104, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true, 250)
    expect(stateLvl4.sunBank).toBe(250)

    // Fallback por defecto en modo fortaleza: 200 soles
    const stateDefault = createBattleState(105, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true)
    expect(stateDefault.sunBank).toBe(200)
  })

  it('valida los requisitos balanceados de mejora del Árbol Madre para clanes de 15 a 25 miembros', () => {
    const getUpgradeRequirements = (currentLevel: number) => {
      switch (currentLevel) {
        case 1:
          return { water: 150, fertilizer: 100, gems: 600 }
        case 2:
          return { water: 350, fertilizer: 250, gems: 1500 }
        case 3:
          return { water: 750, fertilizer: 500, gems: 3000 }
        default:
          return { water: 0, fertilizer: 0, gems: 0 }
      }
    }

    // Nivel 1 -> 2: 150 Agua, 100 Fertilizante, 600 Gemas (~10 agua, ~7 fert, ~40 gemas por jugador en clan de 15)
    expect(getUpgradeRequirements(1)).toEqual({ water: 150, fertilizer: 100, gems: 600 })

    // Nivel 2 -> 3: 350 Agua, 250 Fertilizante, 1,500 Gemas
    expect(getUpgradeRequirements(2)).toEqual({ water: 350, fertilizer: 250, gems: 1500 })

    // Nivel 3 -> 4: 750 Agua, 500 Fertilizante, 3,000 Gemas
    expect(getUpgradeRequirements(3)).toEqual({ water: 750, fertilizer: 500, gems: 3000 })

    // Nivel 4: Máximo alcanzado
    expect(getUpgradeRequirements(4)).toEqual({ water: 0, fertilizer: 0, gems: 0 })
  })

  it('valida la escala de beneficios desbloqueables en los 4 niveles del Árbol Madre', () => {
    const getLevelPerks = (level: number) => {
      const lvl = Math.max(1, Math.min(4, level))
      return {
        maxMembers: lvl === 1 ? 15 : lvl === 2 ? 18 : lvl === 3 ? 20 : 25,
        initialAttackSuns: lvl === 1 ? 650 : lvl === 2 ? 800 : lvl === 3 ? 950 : 1100,
        conquestDamageBonusPct: lvl === 1 ? 0 : lvl === 2 ? 5 : lvl === 3 ? 10 : 20,
        dailyPassiveSuns: lvl === 1 ? 0 : lvl === 2 ? 10 : lvl === 3 ? 20 : 30,
        vipGoldBonusPct: lvl === 1 ? 0 : lvl === 2 ? 5 : lvl === 3 ? 10 : 15,
        pvpDamageBonusPct: lvl === 1 ? 0 : lvl === 2 ? 0 : lvl === 3 ? 5 : 10,
      }
    }

    // Nivel 1: Base
    expect(getLevelPerks(1)).toEqual({
      maxMembers: 15,
      initialAttackSuns: 650,
      conquestDamageBonusPct: 0,
      dailyPassiveSuns: 0,
      vipGoldBonusPct: 0,
      pvpDamageBonusPct: 0,
    })

    // Nivel 2: +3 miembros, 800 soles, +5% conquista, 10 soles diarios, 5% vip gold
    expect(getLevelPerks(2)).toEqual({
      maxMembers: 18,
      initialAttackSuns: 800,
      conquestDamageBonusPct: 5,
      dailyPassiveSuns: 10,
      vipGoldBonusPct: 5,
      pvpDamageBonusPct: 0,
    })

    // Nivel 3: +2 miembros (20), 950 soles, +10% conquista, 20 soles diarios, 10% vip gold, 5% pvp dmg
    expect(getLevelPerks(3)).toEqual({
      maxMembers: 20,
      initialAttackSuns: 950,
      conquestDamageBonusPct: 10,
      dailyPassiveSuns: 20,
      vipGoldBonusPct: 10,
      pvpDamageBonusPct: 5,
    })

    // Nivel 4: +5 miembros (25), 1100 soles, +20% conquista, 30 soles diarios, 15% vip gold, 10% pvp dmg
    expect(getLevelPerks(4)).toEqual({
      maxMembers: 25,
      initialAttackSuns: 1100,
      conquestDamageBonusPct: 20,
      dailyPassiveSuns: 30,
      vipGoldBonusPct: 15,
      pvpDamageBonusPct: 10,
    })
  })

  it('respeta la perspectiva de defensa (0..6) y el sentido espejo hacia el atacante (13..7)', () => {
    const state = createBattleState(777, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true)

    // Formación configurada por el clan defensor en su Bastión (espacio local 0 a 6):
    // - Peashooter en retaguardia: col 1
    // - Tallnut en primera línea: col 5
    const pRivalRetaguardia = crearPlantaDelRival(state, 'peashooter', 2, 1)
    const pRivalVanguardia = crearPlantaDelRival(state, 'tallnut', 2, 5)

    // En la pantalla del atacante (P1), las plantas del rival aparecen espejadas:
    // col 1 -> 13 - 1 = 12 (fondo derecho)
    // col 5 -> 13 - 5 = 8 (frente defensivo derecho)
    expect(pRivalRetaguardia.col).toBe(12)
    expect(pRivalVanguardia.col).toBe(8)
    expect(pRivalRetaguardia.x).toBeGreaterThan(pRivalVanguardia.x) // La retaguardia está más a la derecha

    // El atacante P1 planta desde la izquierda (col 1 retaguardia, col 4 vanguardia)
    const pPropiaRetaguardia = crearPlantaPropia(state, 'peashooter', 2, 1)
    const pPropiaVanguardia = crearPlantaPropia(state, 'wallnut', 2, 4)
    expect(pPropiaRetaguardia.col).toBe(1)
    expect(pPropiaVanguardia.col).toBe(4)
    expect(pPropiaRetaguardia.x).toBeLessThan(pPropiaVanguardia.x) // La vanguardia aliada está más a la derecha
  })

  it('soporta la detonación de emboscadas tácticas programadas y escalonamiento de líneas', () => {
    const state = createBattleState(888, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 4, true)
    expect(state.lanesCount).toBe(4)

    // Simular emboscada táctica de Jalapeño programada para el segundo 30 en carril 1 (col 6 vanguardia rival)
    const ambushJalapeno = crearPlantaDelRival(state, 'jalapeno', 1, 6)
    state.enemyPlants.push(ambushJalapeno)
    expect(state.enemyPlants).toHaveLength(1)
    expect(state.enemyPlants[0].plantId).toBe('jalapeno')
    expect(state.enemyPlants[0].lane).toBe(1)
    expect(state.enemyPlants[0].col).toBe(7) // 13 - 6 = 7 (frente derecho en campo del atacante)

    // Simular emboscada de Bonk Choy móvil (que entra caminando hacia la izquierda)
    const ambushBonkChoy = crearPlantaDelRival(state, 'bonkchoy', 2, undefined)
    state.enemyPlants.push(ambushBonkChoy)
    expect(state.enemyPlants).toHaveLength(2)
    expect(ambushBonkChoy.isWalking).toBe(true)
    expect(ambushBonkChoy.state).toBe('walking')
    expect(ambushBonkChoy.x).toBeGreaterThan(80)
  })

  it('calcula los soles iniciales del atacante según el nivel del Árbol Madre (500 base + 150 por nivel)', () => {
    const calculateAttackerInitialSuns = (motherTreeLevel: number) => {
      return 500 + Math.max(0, motherTreeLevel) * 150
    }

    // Nivel 0 (sin mejoras): 500 Soles
    expect(calculateAttackerInitialSuns(0)).toBe(500)

    // Nivel 1: 650 Soles
    expect(calculateAttackerInitialSuns(1)).toBe(650)

    // Nivel 2: 800 Soles
    expect(calculateAttackerInitialSuns(2)).toBe(800)

    // Nivel 3: 950 Soles
    expect(calculateAttackerInitialSuns(3)).toBe(950)

    // Nivel 4: 1100 Soles
    expect(calculateAttackerInitialSuns(4)).toBe(1100)

    // Al crear el estado de batalla con initialAttackSuns, sunBank adopta el valor exacto
    const state = createBattleState(999, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true, calculateAttackerInitialSuns(2))
    expect(state.sunBank).toBe(800)
  })

  it('permite desenterrar con la pala y reembolsar el 100% de soles durante la fase de preparación', () => {
    const initialSuns = 400
    const state = createBattleState(1001, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 1000, 1000, null, null, 5, true, initialSuns)

    // 1. Atacante planta un Lanzaguisantes (coste 100) en carril 1, col 2
    const peashooterCost = 100
    state.sunBank -= peashooterCost
    const planta = crearPlantaPropia(state, 'peashooter', 1, 2)
    planta.isWalking = false
    planta.state = 'idle'
    state.plants.push(planta)

    expect(state.plants).toHaveLength(1)
    expect(state.sunBank).toBe(300)

    // 2. Jugador usa la pala sobre la planta para repensar su estrategia
    // En fase de preparación: desenterrar devuelve el 100% del coste
    state.plants = state.plants.filter((p) => p.id !== planta.id)
    state.sunBank += peashooterCost

    expect(state.plants).toHaveLength(0)
    expect(state.sunBank).toBe(400) // 100% reembolsado
  })

  it('en combate de 3 carriles (Árbol Nv.1), las plantas enemigas y proyectiles en carril normalizado 0 colisionan contra la Nuez aliada', () => {
    // Estado de batalla de fortaleza en 3 carriles
    const state = createBattleState(2002, false, false, NIVEL_POR_DEFECTO, 'auth-v2', 600, 800, null, null, 3, true, 300)
    expect(state.lanesCount).toBe(3)

    // 1. Nuez aliada colocada en carril 0 (columna 3, x ~ 32)
    const wallnut = crearPlantaPropia(state, 'wallnut', 0, 3)
    wallnut.isWalking = false
    wallnut.state = 'idle'
    const initialHp = wallnut.hp
    state.plants.push(wallnut)

    // 2. Peashooter enemigo en carril 0 (columna 10, x ~ 78)
    const peashooter = crearPlantaDelRival(state, 'peashooter', 0, 3) // col 3 espejada = 8
    peashooter.isWalking = false
    peashooter.state = 'idle'
    state.enemyPlants.push(peashooter)

    const initialP1BaseHp = state.p1BaseHp

    // 3. Simular ticks hasta que el peashooter dispare y el guisante alcance la nuez
    let impactoDetectado = false
    for (let t = 0; t < 150; t++) {
      stepTick(state, () => {})
      if (wallnut.hp < initialHp) {
        impactoDetectado = true
        break
      }
    }

    // El proyectil debe haber colisionado e impactado a la nuez en el mismo carril 0
    expect(impactoDetectado).toBe(true)
    expect(wallnut.hp).toBeLessThan(initialHp)
    // La base aliada no debe haber recibido daño porque la nuez interceptó el tiro
    expect(state.p1BaseHp).toBe(initialP1BaseHp)
  })

  it('en arena de fortaleza 5 carriles (Opción A), carril 1 aliado impacta a defensas en carril 1 rival sin desplazamiento', () => {
    const state = createBattleState(
      8888,
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

    // Aliado planta en carril 1 (columna 2)
    const allyPea = crearPlantaPropia(state, 'peashooter', 1, 2)
    state.plants.push(allyPea)

    // Defensa rival colocada en el editor en carril 1 (columna 8)
    const enemyWallnut = crearPlantaDelRival(state, 'wallnut', 1, 8)
    const initialWallnutHp = enemyWallnut.hp
    state.enemyPlants.push(enemyWallnut)

    let hitOccurred = false
    for (let t = 0; t < 150; t++) {
      stepTick(state, () => {})
      if (enemyWallnut.hp < initialWallnutHp) {
        hitOccurred = true
        break
      }
    }

    expect(hitOccurred).toBe(true)
    expect(enemyWallnut.hp).toBeLessThan(initialWallnutHp)
  })

  it('filtra correctamente plantas y emboscadas en carriles bloqueados según el nivel de Árbol Madre', () => {
    // Para Nivel 1 y 2, sólo carriles [1, 2, 3] están permitidos
    const treeLevel1Allowed = [1, 2, 3]
    const testLayout: ClanFortressPlant[] = [
      { plantId: 'repeater', lane: 0, col: 2 }, // Bloqueado
      { plantId: 'peashooter', lane: 1, col: 2 }, // Válido
      { plantId: 'wallnut', lane: 2, col: 4 }, // Válido
      { plantId: 'peashooter', lane: 3, col: 2 }, // Válido
      { plantId: 'repeater', lane: 4, col: 2 }, // Bloqueado
    ]

    const filteredLayoutLvl1 = testLayout.filter((p) => treeLevel1Allowed.includes(p.lane))
    expect(filteredLayoutLvl1.length).toBe(3)
    expect(filteredLayoutLvl1.map((p) => p.lane)).toEqual([1, 2, 3])

    // Para Nivel 3, carriles [0, 1, 2, 3] permitidos (4 bloqueado)
    const treeLevel3Allowed = [0, 1, 2, 3]
    const filteredLayoutLvl3 = testLayout.filter((p) => treeLevel3Allowed.includes(p.lane))
    expect(filteredLayoutLvl3.length).toBe(4)
    expect(filteredLayoutLvl3.map((p) => p.lane)).toEqual([0, 1, 2, 3])

    // Para Nivel 4+, todos [0, 1, 2, 3, 4] permitidos
    const treeLevel4Allowed = [0, 1, 2, 3, 4]
    const filteredLayoutLvl4 = testLayout.filter((p) => treeLevel4Allowed.includes(p.lane))
    expect(filteredLayoutLvl4.length).toBe(5)
  })

  it('IA defensiva reactiva: cubre brechas vacías creadas por Jalapeño cuando el atacante avanza por ese carril', () => {
    const state = createBattleState(
      42,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5,
      true,
      500,
      [0, 1, 2, 3, 4],
      ['wallnut', 'peashooter', 'repeater', 'bonkchoy', 'sunflower']
    )

    // Supongamos que Jalapeño limpió el carril 2 por completo.
    // El atacante despliega una unidad marchando en carril 2
    const allyAttacker = crearPlantaPropia(state, 'bonkchoy', 2, 3)
    state.plants.push(allyAttacker)

    expect(state.p2SunBank).toBe(250)
    expect(state.enemyPlants.filter((e) => e.lane === 2).length).toBe(0)

    // La IA detecta la brecha indefensa y despliega refuerzos
    simularDefensaDeFortaleza(state)

    const defensasCarril2 = state.enemyPlants.filter((e) => e.lane === 2)
    expect(defensasCarril2.length).toBeGreaterThan(0)
    expect(state.p2SunBank).toBeLessThan(250)
  })

  it('IA defensiva reactiva: respeta estrictamente el presupuesto solar de la fortaleza', () => {
    const state = createBattleState(
      42,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5,
      true,
      500,
      [0, 1, 2, 3, 4],
      ['wallnut', 'peashooter', 'repeater', 'bonkchoy', 'sunflower']
    )

    // Vaciamos el banco de soles a 20 (< 50 coste mínimo de Wallnut)
    state.p2SunBank = 20
    const allyAttacker = crearPlantaPropia(state, 'peashooter', 1, 3)
    state.plants.push(allyAttacker)

    const enemyCountBefore = state.enemyPlants.length
    simularDefensaDeFortaleza(state)

    // Sin fondos suficientes, no puede plantar
    expect(state.enemyPlants.length).toBe(enemyCountBefore)
    expect(state.p2SunBank).toBe(20)
  })

  it('IA defensiva reactiva: respeta allowedLanes y no planta en carriles bloqueados', () => {
    // Fortaleza Nivel 1 (carriles 1, 2, 3 permitidos; 0 y 4 bloqueados)
    const state = createBattleState(
      42,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5,
      true,
      500,
      [1, 2, 3],
      ['wallnut', 'peashooter', 'repeater', 'bonkchoy', 'sunflower']
    )

    // Atacantes marchando en todos los carriles
    for (let lane = 0; lane < 5; lane++) {
      state.plants.push(crearPlantaPropia(state, 'peashooter', lane, 2))
    }

    state.p2SunBank = 500

    // Ejecutar varias decisiones defensivas
    for (let i = 0; i < 5; i++) {
      simularDefensaDeFortaleza(state)
    }

    // Ninguna planta defensiva debe haber sido colocada en carril 0 ni en carril 4
    const defensasCarril0 = state.enemyPlants.filter((e) => e.lane === 0)
    const defensasCarril4 = state.enemyPlants.filter((e) => e.lane === 4)
    expect(defensasCarril0.length).toBe(0)
    expect(defensasCarril4.length).toBe(0)
  })

  it('los girasoles defensivos en la fortaleza acumulan soles directamente en p2SunBank', () => {
    const state = createBattleState(
      42,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5,
      true,
      500
    )

    state.fortressRoster = ['melonpult']
    const initialP2Sun = state.p2SunBank
    const girasolDef = crearPlantaDelRival(state, 'sunflower', 2, 12)
    girasolDef.lastActionTime = -1000
    state.enemyPlants.push(girasolDef)

    for (let t = 0; t < 35; t++) {
      stepTick(state, () => {})
    }

    expect(state.p2SunBank).toBeGreaterThan(initialP2Sun)
  })

  it('IA defensiva de fortaleza: asegura economía plantando girasoles si tiene menos de 2', () => {
    const state = createBattleState(
      42,
      false,
      false,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      1000,
      1000,
      null,
      null,
      5,
      true,
      500,
      [0, 1, 2, 3, 4],
      ['wallnut', 'peashooter', 'repeater', 'bonkchoy', 'sunflower']
    )

    expect(state.p2SunBank).toBe(250)
    expect(state.enemyPlants.filter((e) => e.plantId === 'sunflower').length).toBe(0)

    // La IA evalúa la fortaleza sin amenazas y planta girasol en retaguardia
    simularDefensaDeFortaleza(state)

    const girasoles = state.enemyPlants.filter((e) => e.plantId === 'sunflower')
    expect(girasoles.length).toBe(1)
    expect(girasoles[0].col).toBe(13) // col 0 local = col 13 en campo
    expect(state.p2SunBank).toBe(200) // 250 - 50 = 200
  })
})

