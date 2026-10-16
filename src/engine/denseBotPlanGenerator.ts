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
  const attackers = deck.map((c, i) => ({ i, card: c })).filter(x => ['repeater', 'threepeater', 'kernelpult', 'peashooter', 'melonpult'].includes(x.card.plantId))
  const tanks = deck.map((c, i) => ({ i, card: c })).filter(x => ['tallnut', 'wallnut', 'garlic'].includes(x.card.plantId))
  const melees = deck.map((c, i) => ({ i, card: c })).filter(x => ['bonkchoy', 'chomper'].includes(x.card.plantId))
  const spells = deck.map((c, i) => ({ i, card: c })).filter(x => ['jalapeno', 'squash'].includes(x.card.plantId))

  const primaryAtk = attackers[0]?.i ?? (deck[1] ? 1 : 0)
  const secondaryAtk = attackers[1]?.i ?? primaryAtk
  const primaryTank = tanks[0]?.i ?? (deck[2] ? 2 : 1)
  const secondaryTank = tanks[1]?.i ?? primaryTank
  const primaryMelee = melees[0]?.i ?? -1
  const primarySpell = spells[0]?.i ?? -1
  const secondarySpell = spells[1]?.i ?? primarySpell

  let currentSun = 0
  let nextSkySunTick = 121
  const skyInterval = 182 // ~6s at 33ms/tick
  const sunflowerProductionTicks: number[] = []
  let currentTick = 300

  const advanceToTick = (targetTick: number) => {
    while (nextSkySunTick <= targetTick) {
      currentSun += 25
      nextSkySunTick += skyInterval
    }
    for (let i = 0; i < sunflowerProductionTicks.length; i++) {
      while (sunflowerProductionTicks[i] <= targetTick) {
        currentSun += 25
        sunflowerProductionTicks[i] += 455 // 15s standard cycle
      }
    }
  }

  const scheduleAction = (slot: number, lane: number, col: number, minDesiredTick: number): boolean => {
    if (slot < 0 || slot >= deck.length) return false
    const card = deck[slot]
    const cost = getPlantCost(card.plantId, card.statRolls ?? undefined)
    const cd = getPlantCooldown(card.plantId, card.statRolls ?? undefined)
    const cdAvailableTick = slotCooldowns[slot] || 0

    let candidateTick = Math.max(currentTick, minDesiredTick, cdAvailableTick)
    advanceToTick(candidateTick)

    while (currentSun < cost && candidateTick <= 5850) {
      let nextSunArrival = nextSkySunTick
      for (const sfTick of sunflowerProductionTicks) {
        if (sfTick < nextSunArrival) nextSunArrival = sfTick
      }
      candidateTick = nextSunArrival
      advanceToTick(candidateTick)
    }

    if (candidateTick > 5850 || currentSun < cost) return false

    currentSun -= cost
    slotCooldowns[slot] = candidateTick + cd
    currentTick = candidateTick + 6 // minimum physical separation

    if ((card.plantId === 'sunflower' || card.plantId === 'twinsunflower') && sunflowerProductionTicks.length < 1) {
      sunflowerProductionTicks.push(candidateTick + 6 + 455)
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

  // ── 1. APERTURA ECONÓMICA DE 2 GIRASOLES (0 - 25s) ──
  // Sunflower 1 (Lane 1, Col 0 - Central)
  if (sunSlot >= 0) scheduleAction(sunSlot, 1, 0, 309)
  // Sunflower 2 (Lane 0, Col 0 - Superior)
  if (sunSlot >= 0) scheduleAction(sunSlot, 0, 0, 680)

  // ── 2. BLINDAJE INICIAL DE LOS 3 CARRILES (25 - 90s) ──
  const atkCost = getPlantCost(deck[primaryAtk]?.plantId, deck[primaryAtk]?.statRolls ?? undefined)
  const minAtkTick = atkCost >= 300 ? 2850 : (atkCost >= 200 ? 2125 : 1395)

  // Carril 0 (superior): Atacante + Tanque
  scheduleAction(primaryAtk, 0, 1, minAtkTick)
  scheduleAction(primaryTank, 0, 3, minAtkTick + 360)

  // Carril 2 (inferior): Melee caminante + Atacante + Tanque
  const meleeCost = primaryMelee >= 0 ? getPlantCost(deck[primaryMelee]?.plantId, deck[primaryMelee]?.statRolls ?? undefined) : 0
  const minMeleeTick = meleeCost >= 150 ? minAtkTick + 1460 : minAtkTick + 540
  if (primaryMelee >= 0) scheduleAction(primaryMelee, 2, 4, minMeleeTick)
  scheduleAction(secondaryAtk, 2, 1, minMeleeTick + 730)
  scheduleAction(secondaryTank, 2, 3, minMeleeTick + 1100)

  // Carril 1 (central): Atacante + Tanque
  scheduleAction(primaryAtk, 1, 1, minMeleeTick + 1470)
  scheduleAction(primaryTank, 1, 3, minMeleeTick + 1840)

  // ── 3. OLEADAS OFENSIVAS MULTICARRIL Y REFUERZOS (60 - 180s) ──
  for (let wave = 0; wave < 6; wave++) {
    const lane = wave % 3
    if (primaryMelee >= 0 && wave % 2 === 0) {
      scheduleAction(primaryMelee, (lane + 1) % 3, 4, currentTick + 45)
    }
    if (primarySpell >= 0 && wave % 2 === 1) {
      const sp = wave % 4 === 1 ? primarySpell : secondarySpell
      scheduleAction(sp, lane, 5, currentTick + 45)
    }
    scheduleAction(wave % 2 === 0 ? primaryAtk : secondaryAtk, lane, 2, currentTick + 45)
    scheduleAction(wave % 2 === 0 ? primaryTank : secondaryTank, (lane + 2) % 3, 3, currentTick + 45)
  }

  return plan.sort((a, b) => a.issuedTick - b.issuedTick)
}
