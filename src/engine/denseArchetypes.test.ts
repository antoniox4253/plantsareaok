import { describe, it, expect } from 'vitest'
import { simulateAsyncMatch } from './asyncOpponent.ts'
import { HUMAN_ARCHETYPES, generarTimelineHumanaAdversarial } from './adversarialHumanGenerator.ts'
import { generateDenseBotPlan } from './denseBotPlanGenerator.ts'
import type { CartaDeMazo } from './mazoDeLaSala.ts'

export const DENSE_ARCHETYPE_DECKS: Record<number, CartaDeMazo[]> = {
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

describe('Certify Dense Multi-Lane Archetypes with 0 Drops', () => {
  for (let i = 0; i < 5; i++) {
    const deck = DENSE_ARCHETYPE_DECKS[i]
    const plan = generateDenseBotPlan(deck)

    it(`Dense Archetype ${i} has robust action count and completes safely`, () => {
      console.log(`Dense Archetype ${i}: ${plan.length} actions`)
      expect(plan.length).toBeGreaterThanOrEqual(7)
    })

    const styles = [
      { name: 'HUMAN_AGGRESSIVE', archetype: HUMAN_ARCHETYPES.HUMAN_AGGRESSIVE },
      { name: 'HUMAN_DEFENSIVE', archetype: HUMAN_ARCHETYPES.HUMAN_DEFENSIVE },
      { name: 'HUMAN_BALANCED', archetype: HUMAN_ARCHETYPES.HUMAN_BALANCED },
      { name: 'AFK_HUMAN', archetype: null },
    ]

    for (const s of styles) {
      it(`certifies Dense Archetype ${i} against ${s.name} with 0 drops`, () => {
        const p1Deck = s.archetype ? s.archetype.deck : DENSE_ARCHETYPE_DECKS[0]
        const humanTimeline = s.archetype ? generarTimelineHumanaAdversarial(s.archetype, 77700 + i) : []

        const res = simulateAsyncMatch(
          77700 + i,
          p1Deck,
          deck,
          humanTimeline,
          plan,
          6000
        )

        expect(res.ok).toBe(true)
        expect(res.telemetria.intentionsDropped).toBe(0)
        expect(res.telemetria.intentionsExecuted).toBeGreaterThan(0)
      })
    }
  }
})
