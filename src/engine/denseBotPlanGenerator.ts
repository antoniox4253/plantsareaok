import type { CartaDeMazo } from './mazoDeLaSala.ts'
import type { PlantId } from '../types/game.ts'
import { getScaledPlantConfig } from '../utils/gameConstants.ts'
import { msToTicks } from './time.ts'

export interface DenseBotAction {
  seq: number
  kind: 'plant'
  slot: number
  plantId: string
  lane: number
  col: number
  issuedTick: number
  tick: number
}

export function getPlantCost(plantId: string, statRolls?: any): number {
  const conf = getScaledPlantConfig(plantId as PlantId, statRolls ?? undefined)
  return conf?.cost ?? 100
}

export function getPlantCooldown(plantId: string, statRolls?: any): number {
  const conf = getScaledPlantConfig(plantId as PlantId, statRolls ?? undefined)
  return msToTicks(conf?.cooldownMs ?? 7500)
}

/**
 * Builds a dense, tactical multi-lane plan for any given bot deck.
 * Guaranteed 0 drops by simulating exact sky sun (182 ticks / 6s) and sunflower (455 ticks / 15s) arrivals.
 */
export function generateDenseBotPlan(deck: CartaDeMazo[]): DenseBotAction[] {
  const plan: DenseBotAction[] = []
  let seq = 1
  const slotCooldowns: Record<number, number> = {}

  const sunSlot = deck.findIndex(c => c.plantId === 'sunflower' || c.plantId === 'twinsunflower')
  const attackers = deck.map((c, i) => ({ i, card: c })).filter(x => ['repeater', 'threepeater', 'kernelpult', 'peashooter', 'melonpult', 'snowpea', 'gatlingpea'].includes(x.card.plantId))
  const tanks = deck.map((c, i) => ({ i, card: c })).filter(x => ['tallnut', 'wallnut', 'explodeonut'].includes(x.card.plantId))
  const melees = deck.map((c, i) => ({ i, card: c })).filter(x => ['bonkchoy', 'chomper', 'garlic', 'ghostpepper'].includes(x.card.plantId))
  const spells = deck.map((c, i) => ({ i, card: c })).filter(x => ['jalapeno', 'pickledpepper'].includes(x.card.plantId))

  const primaryAtk = attackers[0]?.i ?? (deck[1] ? 1 : 0)
  const secondaryAtk = attackers[1]?.i ?? primaryAtk
  const primaryTank = tanks[0]?.i ?? (deck[2] ? 2 : 1)
  const secondaryTank = tanks[1]?.i ?? primaryTank
  const primaryMelee = melees[0]?.i ?? -1
  const secondaryMelee = melees[1]?.i ?? primaryMelee
  const primarySpell = spells[0]?.i ?? -1
  const secondarySpell = spells[1]?.i ?? primarySpell

  let currentSun = 0
  let nextSkySunTick = 121
  const skyInterval = 182 // ~6s at 33ms/tick
  const sunflowerTrackers: { tick: number; yield: number }[] = []
  let currentTick = 300

  const advanceToTick = (targetTick: number) => {
    while (nextSkySunTick <= targetTick) {
      currentSun += 25
      nextSkySunTick += skyInterval
    }
    for (let i = 0; i < sunflowerTrackers.length; i++) {
      while (sunflowerTrackers[i].tick <= targetTick) {
        currentSun += sunflowerTrackers[i].yield
        sunflowerTrackers[i].tick += 455 // 15s standard cycle
      }
    }
  }

  const scheduleAction = (slot: number, lane: number, col: number, minDesiredTick: number): boolean => {
    if (slot < 0 || slot >= deck.length) return false
    const card = deck[slot]
    // Ignorar por completo la Papa Mina ('squash')
    if (card.plantId === 'squash') return false

    const cost = getPlantCost(card.plantId, card.statRolls ?? undefined)
    const cd = getPlantCooldown(card.plantId, card.statRolls ?? undefined)
    const cdAvailableTick = slotCooldowns[slot] || 0

    let candidateTick = Math.max(currentTick, minDesiredTick, cdAvailableTick)
    advanceToTick(candidateTick)

    while (currentSun < cost && candidateTick <= 5850) {
      let nextSunArrival = nextSkySunTick
      for (const sf of sunflowerTrackers) {
        if (sf.tick < nextSunArrival) nextSunArrival = sf.tick
      }
      candidateTick = nextSunArrival
      advanceToTick(candidateTick)
    }

    if (candidateTick > 5850 || currentSun < cost) return false

    currentSun -= cost
    slotCooldowns[slot] = candidateTick + cd
    currentTick = candidateTick + 6 // minimum physical separation

    if (card.plantId === 'sunflower' || card.plantId === 'twinsunflower') {
      const sunYield = card.plantId === 'twinsunflower' ? 50 : 25
      // Rastreamos hasta 4 productores de sol para una economía abundante y segura
      if (sunflowerTrackers.length < 4) {
        sunflowerTrackers.push({
          tick: candidateTick + 6 + 455,
          yield: sunYield,
        })
      }
    }

    plan.push({
      seq: seq++,
      kind: 'plant',
      slot,
      plantId: card.plantId,
      lane,
      col,
      issuedTick: candidateTick,
      tick: candidateTick + 6,
    })
    return true
  }

  // ── 1. APERTURA ECONÓMICA DE 3 GIRASOLES BASE (0 - 18s) ──
  // Establece de inmediato un girasol en la retaguardia (Col 0) de cada uno de los 3 carriles
  // Sunflower 1 (Lane 1, Col 0 - Central)
  if (sunSlot >= 0) scheduleAction(sunSlot, 1, 0, 309)
  // Sunflower 2 (Lane 0, Col 0 - Superior)
  if (sunSlot >= 0) scheduleAction(sunSlot, 0, 0, 680)
  // Sunflower 3 (Lane 2, Col 0 - Inferior)
  if (sunSlot >= 0) scheduleAction(sunSlot, 2, 0, 1050)

  // ── 2. PRIMERA LÍNEA DEFENSIVA Y EXPANSIÓN A 4 GIRASOLES (18 - 45s) ──
  const atkCost = getPlantCost(deck[primaryAtk]?.plantId, deck[primaryAtk]?.statRolls ?? undefined)
  const minAtkTick = atkCost >= 300 ? 2850 : (atkCost >= 200 ? 2150 : 1550)

  // Carril 0 (superior): Primer Atacante
  scheduleAction(primaryAtk, 0, 1, minAtkTick)
  // Carril 0: Muro/Tanque temprano para frenar caminantes
  scheduleAction(primaryTank, 0, 3, minAtkTick + 360)

  // Carril 1: Cuarto Girasol (Centro Columna 1) para potenciar la economía a gran escala
  if (sunSlot >= 0) scheduleAction(sunSlot, 1, 1, minAtkTick + 720)

  // Carril 2 (inferior): Melee caminante / Choque
  const meleeCost = primaryMelee >= 0 ? getPlantCost(deck[primaryMelee]?.plantId, deck[primaryMelee]?.statRolls ?? undefined) : 0
  const minMeleeTick = meleeCost >= 150 ? minAtkTick + 1500 : minAtkTick + 700
  if (primaryMelee >= 0) scheduleAction(primaryMelee, 2, 4, minMeleeTick)

  // Carril 2: Atacante Mixto + Tanque
  scheduleAction(secondaryAtk, 2, 2, minMeleeTick + 730)
  scheduleAction(secondaryTank, 2, 3, minMeleeTick + 1100)

  // Carril 1 (central): Atacante Mixto + Tanque central
  scheduleAction(primaryAtk, 1, 2, minMeleeTick + 1470)
  scheduleAction(primaryTank, 1, 3, minMeleeTick + 1840)

  // ── 3. SPAM DE SQUASH, OLEADAS OFENSIVAS MULTICARRIL Y REFUERZOS (45 - 180s) ──
  for (let wave = 0; wave < 6; wave++) {
    const lane = wave % 3
    // Expansión económica al 5to girasol
    if (sunSlot >= 0 && wave === 0) {
      scheduleAction(sunSlot, 2, 1, currentTick + 45) // Sunflower 5
    }
    // Spam activo de Melee / Squash ('garlic' / 'ghostpepper' / 'bonkchoy')
    if (primaryMelee >= 0 && wave % 2 === 0) {
      scheduleAction(primaryMelee, (lane + 1) % 3, 4, currentTick + 45)
    }
    if (secondaryMelee >= 0 && wave % 2 === 1) {
      scheduleAction(secondaryMelee, lane, 4, currentTick + 45)
    }
    // Hechizo / Remate (Jalapeño / Pickled Pepper)
    if (primarySpell >= 0 && wave % 2 === 1) {
      const sp = wave % 4 === 1 ? primarySpell : secondarySpell
      scheduleAction(sp, lane, 5, currentTick + 45)
    }
    // Refuerzo de Atacante en Carril 0 (el único con columna 2 libre, ya que los carriles 1 y 2 tienen los girasoles 4 y 5 en col 1)
    if (lane === 0 && wave === 0) {
      scheduleAction(secondaryAtk, 0, 2, currentTick + 45)
    }
    // Refuerzo de Tanque (1 por carril en las primeras 3 oleadas para no sobreescribir muros vivos)
    if (wave < 3) {
      scheduleAction(wave % 2 === 0 ? primaryTank : secondaryTank, (lane + 2) % 3, 3, currentTick + 45)
    }
  }

  return plan.sort((a, b) => a.issuedTick - b.issuedTick)
}
