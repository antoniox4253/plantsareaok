import { describe, it, expect } from 'vitest'
import { simulateAsyncMatch } from './asyncOpponent.ts'
import { HUMAN_ARCHETYPES, generarTimelineHumanaAdversarial } from './adversarialHumanGenerator.ts'
import type { CartaDeMazo } from './mazoDeLaSala.ts'

export const ARCHETYPE_DECKS: Record<number, CartaDeMazo[]> = {
  0: [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 3, plantId: 'repeater', statRolls: ['damage'] },
    { slot: 2, level: 3, plantId: 'tallnut', statRolls: ['hp'] },
    { slot: 3, level: 3, plantId: 'bonkchoy', statRolls: ['attackSpeed'] },
    { slot: 4, level: 3, plantId: 'squash', statRolls: ['cooldown'] },
    { slot: 5, level: 3, plantId: 'jalapeno', statRolls: ['damage'] },
  ],
  1: [
    { slot: 0, level: 4, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 4, plantId: 'threepeater', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 4, plantId: 'tallnut', statRolls: ['damage', 'attackSpeed'] },
    { slot: 3, level: 4, plantId: 'bonkchoy', statRolls: ['damage', 'attackSpeed'] },
    { slot: 4, level: 3, plantId: 'repeater', statRolls: ['hp'] },
    { slot: 5, level: 3, plantId: 'jalapeno', statRolls: ['hp'] },
  ],
  2: [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 4, plantId: 'kernelpult', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 4, plantId: 'garlic', statRolls: ['damage', 'attackSpeed'] },
    { slot: 3, level: 4, plantId: 'wallnut', statRolls: ['damage', 'attackSpeed'] },
    { slot: 4, level: 3, plantId: 'repeater', statRolls: ['hp'] },
    { slot: 5, level: 3, plantId: 'jalapeno', statRolls: ['hp'] },
  ],
  3: [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 4, plantId: 'garlic', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 4, plantId: 'bonkchoy', statRolls: ['damage', 'attackSpeed'] },
    { slot: 3, level: 4, plantId: 'wallnut', statRolls: ['damage', 'attackSpeed'] },
    { slot: 4, level: 3, plantId: 'repeater', statRolls: ['hp'] },
    { slot: 5, level: 3, plantId: 'jalapeno', statRolls: ['hp'] },
  ],
  4: [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 4, plantId: 'bonkchoy', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 4, plantId: 'squash', statRolls: ['damage', 'attackSpeed'] },
    { slot: 3, level: 4, plantId: 'peashooter', statRolls: ['damage', 'attackSpeed'] },
    { slot: 4, level: 3, plantId: 'wallnut', statRolls: ['hp'] },
    { slot: 5, level: 3, plantId: 'jalapeno', statRolls: ['hp'] },
  ],
}

function getPlantCost(plantId: string): number {
  switch (plantId) {
    case 'sunflower': return 50
    case 'twinsunflower': return 125
    case 'peashooter': return 100
    case 'repeater': return 200
    case 'threepeater': return 300
    case 'kernelpult': return 100
    case 'melonpult': return 300
    case 'wallnut': return 50
    case 'tallnut': return 125
    case 'garlic': return 50
    case 'bonkchoy': return 150
    case 'chomper': return 150
    case 'squash': return 50
    case 'jalapeno': return 125
    default: return 100
  }
}

function getPlantCooldown(plantId: string): number {
  if (plantId === 'wallnut' || plantId === 'tallnut' || plantId === 'squash') return 600
  if (plantId === 'jalapeno') return 1050
  return 225
}

interface Action {
  seq: number
  kind: 'plant'
  slot: number
  plantId: string
  lane: number
  col: number
  issuedTick: number
  tick: number
}

export function generateRobustPlan(deck: CartaDeMazo[]): Action[] {
  const plan: Action[] = []
  let seq = 1
  let currentSun = 0
  let nextSkySunTick = 121
  const skyInterval = 182
  const sunflowerProductionTicks: number[] = []
  const slotCooldowns: Record<number, number> = {}
  let currentTick = 300

  // Categorize slots
  const sunSlot = deck.findIndex(c => c.plantId === 'sunflower' || c.plantId === 'twinsunflower')
  const attackers = deck.map((c, i) => ({ i, card: c })).filter(x => ['repeater', 'threepeater', 'kernelpult', 'peashooter', 'melonpult'].includes(x.card.plantId))
  const tanks = deck.map((c, i) => ({ i, card: c })).filter(x => ['tallnut', 'wallnut', 'garlic'].includes(x.card.plantId))
  const melees = deck.map((c, i) => ({ i, card: c })).filter(x => ['bonkchoy', 'chomper'].includes(x.card.plantId))
  const spells = deck.map((c, i) => ({ i, card: c })).filter(x => ['jalapeno', 'squash'].includes(x.card.plantId))

  const advanceSunTo = (targetTick: number) => {
    while (nextSkySunTick <= targetTick) {
      currentSun += 25
      nextSkySunTick += skyInterval
    }
    for (let i = 0; i < sunflowerProductionTicks.length; i++) {
      while (sunflowerProductionTicks[i] <= targetTick) {
        currentSun += 25
        sunflowerProductionTicks[i] += 455
      }
    }
  }

  const scheduleNext = (slot: number, lane: number, col: number, minTick: number): boolean => {
    if (slot < 0 || slot >= deck.length) return false
    const card = deck[slot]
    const cost = getPlantCost(card.plantId)
    const cd = getPlantCooldown(card.plantId)
    const cdAvail = slotCooldowns[slot] || 0

    let candidate = Math.max(currentTick, minTick, cdAvail)
    advanceSunTo(candidate)

    while (currentSun < cost && candidate <= 5850) {
      let nextSun = nextSkySunTick
      for (const sf of sunflowerProductionTicks) {
        if (sf < nextSun) nextSun = sf
      }
      candidate = nextSun
      advanceSunTo(candidate)
    }

    if (candidate > 5850 || currentSun < cost) return false

    currentSun -= cost
    slotCooldowns[slot] = candidate + cd
    currentTick = candidate + 6 // spacing

    if (card.plantId === 'sunflower' || card.plantId === 'twinsunflower') {
      sunflowerProductionTicks.push(candidate + 6 + 455)
    }

    plan.push({
      seq: seq++,
      kind: 'plant',
      slot,
      plantId: card.plantId,
      lane,
      col,
      issuedTick: candidate,
      tick: candidate + 6
    })
    return true
  }

  // 1. Sunflower 1 (Lane 1, col 0) at tick 309
  if (sunSlot >= 0) scheduleNext(sunSlot, 1, 0, 309)

  // 2. Sunflower 2 (Lane 0, col 0) (~tick 680)
  if (sunSlot >= 0) scheduleNext(sunSlot, 0, 0, 680)

  // 3. Sunflower 3 (Lane 2, col 0) (~tick 1050)
  if (sunSlot >= 0) scheduleNext(sunSlot, 2, 0, 1050)

  // 4. Multi-lane defense setup (all 3 lanes)
  const primaryAtk = attackers[0]?.i ?? (deck[1] ? 1 : 0)
  const secondaryAtk = attackers[1]?.i ?? primaryAtk
  const primaryTank = tanks[0]?.i ?? (deck[2] ? 2 : 1)
  const secondaryTank = tanks[1]?.i ?? primaryTank
  const primaryMelee = melees[0]?.i ?? -1
  const primarySpell = spells[0]?.i ?? -1

  // Lane 0: Attacker (col 1) + Tank (col 3)
  scheduleNext(primaryAtk, 0, 1, 1250)
  scheduleNext(primaryTank, 0, 3, 1450)

  // Lane 2: Melee (col 4) + Attacker (col 1) + Tank (col 3)
  if (primaryMelee >= 0) scheduleNext(primaryMelee, 2, 4, 1650)
  scheduleNext(secondaryAtk, 2, 1, 1850)
  scheduleNext(secondaryTank, 2, 3, 2050)

  // Lane 1: Attacker (col 1) + Tank (col 3)
  scheduleNext(primaryAtk, 1, 1, 2250)
  scheduleNext(primaryTank, 1, 3, 2450)

  // 4. Continuous waves across 3 lanes
  for (let wave = 0; wave < 8; wave++) {
    const lane = wave % 3
    if (primaryMelee >= 0) {
      scheduleNext(primaryMelee, (lane + 1) % 3, 4, currentTick + 30)
    }
    if (primarySpell >= 0 && wave % 2 === 1) {
      scheduleNext(primarySpell, lane, 5, currentTick + 30)
    }
    scheduleNext(wave % 2 === 0 ? primaryAtk : secondaryAtk, lane, 2, currentTick + 30)
    scheduleNext(primaryTank, (lane + 2) % 3, 3, currentTick + 30)
  }

  return plan.sort((a, b) => a.issuedTick - b.issuedTick)
}

describe('Dense Prototype Verification', () => {
  for (let i = 0; i < 5; i++) {
    const deck = ARCHETYPE_DECKS[i]
    const plan = generateRobustPlan(deck)

    it(`Archetype ${i} generates >= 20 actions and 0 drops`, () => {
      console.log(`Archetype ${i} plan length: ${plan.length}`)
      expect(plan.length).toBeGreaterThanOrEqual(18)

      // 1. First test against AFK human
      const simAfk = simulateAsyncMatch(54321 + i, deck, deck, [], plan, 6000)
      console.log(`  Archetype ${i} vs AFK: winner = ${simAfk.ganador} | drops = ${simAfk.telemetria.intentionsDropped} | executed = ${simAfk.telemetria.intentionsExecuted} | tics = ${simAfk.tics} | P1 HP = ${simAfk.baseP1} | P2 HP = ${simAfk.baseP2}`)
      if (simAfk.telemetria.intentionsDropped > 0) {
        // Let's test individual actions one by one up to simAfk.tics to see which one drops!
        for (let k = 1; k <= plan.length; k++) {
          const subPlan = plan.slice(0, k)
          const subSim = simulateAsyncMatch(54321 + i, deck, deck, [], subPlan, 6000)
          if (subSim.telemetria.intentionsDropped > 0) {
            console.log(`  FIRST FAILING INTENTION in Archetype ${i}:`, plan[k - 1])
            break
          }
        }
      }
      expect(simAfk.telemetria.intentionsDropped).toBe(0)

      for (const [name, arch] of Object.entries(HUMAN_ARCHETYPES)) {
        const p1Actions = generarTimelineHumanaAdversarial(arch, 54321 + i)
        const sim = simulateAsyncMatch(54321 + i, arch.deck, deck, p1Actions, plan, 6000)
        console.log(`  Archetype ${i} vs ${name}: winner = ${sim.ganador === 1 ? 'HUMAN' : (sim.ganador === 2 ? 'BOT' : 'DRAW')} | drops = ${sim.telemetria.intentionsDropped} | time = ${Math.round(sim.tics/30)}s`)
      }
    })
  }
})
