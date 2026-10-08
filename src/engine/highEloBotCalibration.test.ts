import { describe, it, expect } from 'vitest'
import { simulateAsyncMatch } from './asyncOpponent.ts'
import { HUMAN_ARCHETYPES, generarTimelineHumanaAdversarial } from './adversarialHumanGenerator.ts'
import type { CartaDeMazo } from './mazoDeLaSala.ts'

const ARCHETYPE_DECKS: Record<number, CartaDeMazo[]> = {
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

export function minTickForCumulativeCost(cost: number): number {
  if (cost <= 0) return 308
  const dropsNeeded = Math.ceil(cost / 25)
  const primerSolTick = 121
  const interval = 182
  return primerSolTick + (dropsNeeded - 1) * interval + 6
}

export function buildDeterministicArchetypePlan(deck: CartaDeMazo[]): any[] {
  const plan: any[] = []
  let cumulativeCost = 0
  let seq = 1
  const slotCooldowns: Record<number, number> = {}
  const occupiedTiles = new Set<string>()

  const tryAddAction = (slot: number, lane: number, col: number, isWalkingOrInstant: boolean, minTick: number) => {
    const card = deck[slot]
    const cost = card.plantId === 'sunflower' ? 50 :
                 card.plantId === 'repeater' ? 200 :
                 card.plantId === 'threepeater' ? 300 :
                 card.plantId === 'kernelpult' ? 100 :
                 card.plantId === 'peashooter' ? 100 :
                 card.plantId === 'wallnut' ? 50 :
                 card.plantId === 'tallnut' ? 125 :
                 card.plantId === 'garlic' ? 50 :
                 card.plantId === 'squash' ? 50 :
                 card.plantId === 'bonkchoy' ? 150 :
                 card.plantId === 'jalapeno' ? 125 : 100

    const cooldownTicks = (card.plantId === 'wallnut' || card.plantId === 'tallnut' || card.plantId === 'squash') ? 600 :
                          (card.plantId === 'jalapeno') ? 1050 : 225

    if (!isWalkingOrInstant) {
      const tileKey = `${lane}_${col}`
      if (occupiedTiles.has(tileKey)) return false
    }

    const nextSunTick = minTickForCumulativeCost(cumulativeCost + cost)
    const cdTick = slotCooldowns[slot] || 0
    const issuedTick = Math.max(minTick, nextSunTick, cdTick)
    if (issuedTick > 5950) return false

    cumulativeCost += cost
    slotCooldowns[slot] = issuedTick + cooldownTicks
    if (!isWalkingOrInstant) {
      occupiedTiles.add(`${lane}_${col}`)
    }

    plan.push({
      seq: seq++,
      kind: 'plant',
      slot,
      plantId: card.plantId,
      lane,
      col,
      issuedTick,
      tick: issuedTick + 6,
    })
    return true
  }

  // Find card slots
  const sunSlot = deck.findIndex(c => c.plantId === 'sunflower')
  const attackerSlot = deck.findIndex(c => ['repeater', 'threepeater', 'kernelpult', 'peashooter'].includes(c.plantId))
  const tankSlot = deck.findIndex(c => ['tallnut', 'wallnut'].includes(c.plantId))
  const meleeSlot = deck.findIndex(c => ['bonkchoy', 'garlic'].includes(c.plantId))
  const spellSlot = deck.findIndex(c => ['jalapeno', 'squash'].includes(c.plantId))

  let curTick = 302
  // 1. Sunflower in backline
  if (sunSlot >= 0) {
    tryAddAction(sunSlot, 1, 0, false, curTick)
    curTick += 10
  }

  // 2. Early attacker
  if (attackerSlot >= 0) {
    tryAddAction(attackerSlot, 1, 1, false, curTick)
    curTick += 10
  }

  // 3. Tank or Melee on mid lane
  if (tankSlot >= 0) {
    tryAddAction(tankSlot, 1, 3, false, curTick)
    curTick += 10
  } else if (meleeSlot >= 0) {
    tryAddAction(meleeSlot, 1, 4, true, curTick)
    curTick += 10
  }

  // 4. Attacker on lane 0
  if (attackerSlot >= 0) {
    tryAddAction(attackerSlot, 0, 1, false, curTick)
    curTick += 10
  }

  // 5. Attacker on lane 2
  if (attackerSlot >= 0) {
    tryAddAction(attackerSlot, 2, 1, false, curTick)
    curTick += 10
  }

  // 6. Tank on lane 0
  if (tankSlot >= 0) {
    tryAddAction(tankSlot, 0, 3, false, curTick)
    curTick += 10
  }

  // 7. Tank on lane 2
  if (tankSlot >= 0) {
    tryAddAction(tankSlot, 2, 3, false, curTick)
    curTick += 10
  }

  // 8. Spell / Instant
  if (spellSlot >= 0) {
    tryAddAction(spellSlot, 1, 5, true, curTick)
    curTick += 10
  }

  // 9. Continuous wave of melee & spells & attackers
  for (let round = 0; round < 6; round++) {
    const lane = round % 3
    if (meleeSlot >= 0) {
      tryAddAction(meleeSlot, lane, 4, true, curTick)
      curTick += 10
    }
    if (spellSlot >= 0) {
      tryAddAction(spellSlot, (lane + 1) % 3, 5, true, curTick)
      curTick += 10
    }
  }

  return plan.sort((a, b) => a.issuedTick - b.issuedTick)
}

describe('Certify High ELO Plans against All Human Archetypes', () => {
  const styles = [
    { name: 'HUMAN_AGGRESSIVE', archetype: HUMAN_ARCHETYPES.HUMAN_AGGRESSIVE },
    { name: 'HUMAN_DEFENSIVE', archetype: HUMAN_ARCHETYPES.HUMAN_DEFENSIVE },
    { name: 'HUMAN_RUSHER', archetype: HUMAN_ARCHETYPES.HUMAN_RUSHER },
    { name: 'AFK_HUMAN', archetype: null },
  ]

  for (const s of styles) {
    describe(`Testing against ${s.name}`, () => {
      for (let i = 0; i < 5; i++) {
        it(`certifies Archetype ${i} with 0 drops`, () => {
          const botDeck = ARCHETYPE_DECKS[i]
          const actions = buildDeterministicArchetypePlan(botDeck)
          const p1Deck = s.archetype ? s.archetype.deck : ARCHETYPE_DECKS[0]
          const humanTimeline = s.archetype ? generarTimelineHumanaAdversarial(s.archetype, 54321 + i) : []

          const res = simulateAsyncMatch(
            54321 + i,
            p1Deck,
            botDeck,
            humanTimeline,
            actions,
            6000
          )

          expect(res.ok).toBe(true)
          expect(res.telemetria.intentionsDropped).toBe(0)
        })
      }
    })
  }
})
