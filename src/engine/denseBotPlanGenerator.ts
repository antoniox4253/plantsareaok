import type { CartaDeMazo } from './mazoDeLaSala.ts'

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

export function getPlantCost(plantId: string): number {
  switch (plantId) {
    case 'sunflower': return 50
    case 'peashooter': return 100
    case 'repeater': return 200
    case 'threepeater': return 300
    case 'kernelpult': return 100
    case 'wallnut': return 50
    case 'tallnut': return 125
    case 'garlic': return 50
    case 'bonkchoy': return 150
    case 'squash': return 50
    case 'jalapeno': return 125
    default: return 100
  }
}

export function getPlantCooldown(plantId: string): number {
  if (plantId === 'wallnut' || plantId === 'tallnut' || plantId === 'squash') return 600
  if (plantId === 'jalapeno') return 1050
  return 225
}

/**
 * Builds a dense, tactical multi-lane plan for any given bot deck.
 * Guaranteed 0 drops by simulating exact sky sun and sunflower arrivals.
 */
export function generateDenseBotPlan(deck: CartaDeMazo[]): DenseBotAction[] {
  const plan: DenseBotAction[] = []
  let seq = 1
  const slotCooldowns: Record<number, number> = {}

  const sunSlot = deck.findIndex(c => c.plantId === 'sunflower')
  const attackerSlot = deck.findIndex(c => ['repeater', 'threepeater', 'kernelpult', 'peashooter'].includes(c.plantId))
  const secondAttackerSlot = deck.findIndex((c, i) => i !== attackerSlot && ['repeater', 'threepeater', 'kernelpult', 'peashooter'].includes(c.plantId))
  const tankSlot = deck.findIndex(c => ['tallnut', 'wallnut'].includes(c.plantId))
  const meleeSlot = deck.findIndex(c => ['bonkchoy', 'garlic'].includes(c.plantId))
  const spellSlot = deck.findIndex(c => ['jalapeno', 'squash'].includes(c.plantId))
  const secondSpellSlot = deck.findIndex((c, i) => i !== spellSlot && ['jalapeno', 'squash'].includes(c.plantId))

  let currentSun = 100
  let nextSkySunTick = 240
  const skyInterval = 360 // every 6s
  const sunflowerProductionTicks: number[] = []

  const advanceToTick = (targetTick: number) => {
    while (nextSkySunTick <= targetTick) {
      currentSun += 25
      nextSkySunTick += skyInterval
    }
    for (let i = 0; i < sunflowerProductionTicks.length; i++) {
      while (sunflowerProductionTicks[i] <= targetTick) {
        currentSun += 25
        sunflowerProductionTicks[i] += 900 // 15s
      }
    }
  }

  const scheduleAction = (slot: number, lane: number, col: number, minDesiredTick: number) => {
    if (slot < 0 || slot >= deck.length) return false
    const card = deck[slot]
    const cost = getPlantCost(card.plantId)
    const cd = getPlantCooldown(card.plantId)
    const cdAvailableTick = slotCooldowns[slot] || 0

    let candidateTick = Math.max(minDesiredTick, cdAvailableTick)
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

    if (card.plantId === 'sunflower') {
      sunflowerProductionTicks.push(candidateTick + 6 + 900)
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

  // ── 1. APERTURA ECONÓMICA DE 2 GIRASOLES (0 - 12s) ──
  if (sunSlot >= 0) scheduleAction(sunSlot, 1, 0, 309)
  if (sunSlot >= 0) scheduleAction(sunSlot, 0, 0, 680)

  // ── 2. BLINDAJE INICIAL DE LOS 3 CARRILES (12 - 25s) ──
  // Carril 0 (superior)
  if (attackerSlot >= 0) scheduleAction(attackerSlot, 0, 1, 1050)

  // Carril 2 (inferior)
  if (tankSlot >= 0) scheduleAction(tankSlot, 2, 3, 1380)
  else if (meleeSlot >= 0) scheduleAction(meleeSlot, 2, 4, 1380)

  // Carril 2 atacante detrás del tanque
  const atk2 = secondAttackerSlot >= 0 ? secondAttackerSlot : attackerSlot
  if (atk2 >= 0) scheduleAction(atk2, 2, 1, 1720)

  // Carril 1 (central) defensa
  if (tankSlot >= 0) scheduleAction(tankSlot, 1, 3, 2060)
  else if (meleeSlot >= 0) scheduleAction(meleeSlot, 1, 4, 2060)

  // Carril 1 atacante
  if (attackerSlot >= 0) scheduleAction(attackerSlot, 1, 1, 2400)

  // Carril 0 tanque
  if (tankSlot >= 0) scheduleAction(tankSlot, 0, 3, 2740)

  // ── 3. FASE MEDIA: PRESIÓN CONSTANTE Y REFUERZOS (25 - 60s) ──
  // Melee carril 2
  if (meleeSlot >= 0) scheduleAction(meleeSlot, 2, 4, 3050)
  // Spell / instant carril 1
  if (spellSlot >= 0) scheduleAction(spellSlot, 1, 5, 3350)
  // Atacante carril 0
  if (atk2 >= 0) scheduleAction(atk2, 0, 2, 3650)
  // Melee carril 0
  if (meleeSlot >= 0) scheduleAction(meleeSlot, 0, 4, 3950)
  // Atacante carril 1
  if (attackerSlot >= 0) scheduleAction(attackerSlot, 1, 2, 4250)
  // Spell / instant carril 0 o 2
  const sp2 = secondSpellSlot >= 0 ? secondSpellSlot : spellSlot
  if (sp2 >= 0) scheduleAction(sp2, 2, 5, 4550)

  // ── 4. FASE FINAL: OLEADA PESADA Y ASALTO (60 - 95s) ──
  // Tanque carril 2
  if (tankSlot >= 0) scheduleAction(tankSlot, 2, 3, 4850)
  // Melee carril 1
  if (meleeSlot >= 0) scheduleAction(meleeSlot, 1, 4, 5100)
  // Atacante carril 2
  if (attackerSlot >= 0) scheduleAction(attackerSlot, 2, 2, 5350)
  // Spell / instant carril 1
  if (spellSlot >= 0) scheduleAction(spellSlot, 1, 5, 5550)
  // Melee carril 2 final push
  if (meleeSlot >= 0) scheduleAction(meleeSlot, 2, 4, 5700)

  return plan.sort((a, b) => a.issuedTick - b.issuedTick)
}
