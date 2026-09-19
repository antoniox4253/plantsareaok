import { describe, it, expect } from 'vitest'
import { createBattleState, stepTick } from './simulate'
import { msToTicks } from './time'
import { NIVEL_POR_DEFECTO } from './bot'

describe('Mother Tree Skin Sentinel & Combat Attack', () => {
  it('does not fire tree projectiles if no skin is equipped', () => {
    const state = createBattleState(
      12345,
      false,
      true,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      600,
      600,
      null,
      null
    )

    // Run 350 ticks (> 10 seconds)
    for (let i = 0; i < 350; i++) {
      stepTick(state)
    }

    const treeProjectiles = state.projectiles.filter((p) => p.id.startsWith('tree-'))
    expect(treeProjectiles.length).toBe(0)
  })

  it('fires 2 projectiles from P1 every 10 seconds when P1 has mother_tree_skin', () => {
    const state = createBattleState(
      12345,
      false,
      true,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      600,
      600,
      'mother_tree_skin',
      null
    )

    expect(state.p1TreeSkin).toBe('mother_tree_skin')
    expect(state.p2TreeSkin).toBeNull()

    const ticksFor10s = msToTicks(10000) // 304 ticks

    // Simulate right before 10s
    for (let i = 0; i < ticksFor10s - 1; i++) {
      stepTick(state)
    }

    let treeProjectiles = state.projectiles.filter((p) => p.id.startsWith('tree-p1-'))
    expect(treeProjectiles.length).toBe(0)

    // Tick exactly at 10s mark
    stepTick(state)

    treeProjectiles = state.projectiles.filter((p) => p.id.startsWith('tree-p1-'))
    expect(treeProjectiles.length).toBe(2)

    for (const proj of treeProjectiles) {
      expect(proj.damage).toBe(20)
      expect(proj.targetTeam).toBe('p2')
      expect(proj.lane).toBeGreaterThanOrEqual(0)
      expect(proj.lane).toBeLessThanOrEqual(2)
      expect(proj.type).toBe('pea')
    }
  })

  it('fires symmetrically from P2 when P2 has mother_tree_skin', () => {
    const state = createBattleState(
      54321,
      false,
      true,
      NIVEL_POR_DEFECTO,
      'auth-v2',
      600,
      600,
      null,
      'mother_tree_skin'
    )

    expect(state.p1TreeSkin).toBeNull()
    expect(state.p2TreeSkin).toBe('mother_tree_skin')

    const ticksFor10s = msToTicks(10000)

    for (let i = 0; i < ticksFor10s; i++) {
      stepTick(state)
    }

    const p2TreeProjs = state.projectiles.filter((p) => p.id.startsWith('tree-p2-'))
    expect(p2TreeProjs.length).toBe(2)

    for (const proj of p2TreeProjs) {
      expect(proj.damage).toBe(20)
      expect(proj.targetTeam).toBe('p1')
      expect(proj.lane).toBeGreaterThanOrEqual(0)
      expect(proj.lane).toBeLessThanOrEqual(2)
    }
  })

  it('is 100% deterministic between both players given the same room seed', () => {
    const seed = 999888
    const stateA = createBattleState(seed, false, true, NIVEL_POR_DEFECTO, 'auth-v2', 600, 600, 'mother_tree_skin', 'mother_tree_skin')
    const stateB = createBattleState(seed, false, true, NIVEL_POR_DEFECTO, 'auth-v2', 600, 600, 'mother_tree_skin', 'mother_tree_skin')

    const ticksFor10s = msToTicks(10000)

    for (let i = 0; i < ticksFor10s; i++) {
      stepTick(stateA)
      stepTick(stateB)
    }

    const projsA = stateA.projectiles.filter((p) => p.id.startsWith('tree-'))
    const projsB = stateB.projectiles.filter((p) => p.id.startsWith('tree-'))

    expect(projsA.length).toBe(4) // 2 from P1, 2 from P2
    expect(projsB.length).toBe(4)

    for (let i = 0; i < projsA.length; i++) {
      expect(projsA[i].id).toBe(projsB[i].id)
      expect(projsA[i].lane).toBe(projsB[i].lane)
      expect(projsA[i].x).toBe(projsB[i].x)
      expect(projsA[i].targetTeam).toBe(projsB[i].targetTeam)
    }
  })

  it('fires periodic volleys every 10 seconds consecutively', () => {
    const state = createBattleState(777, false, true, NIVEL_POR_DEFECTO, 'auth-v2', 600, 600, 'mother_tree_skin', null)

    const ticksFor10s = msToTicks(10000)

    // First volley at 10s
    for (let i = 0; i < ticksFor10s; i++) {
      stepTick(state)
    }
    expect(state.projectiles.filter((p) => p.id.startsWith('tree-p1-')).length).toBe(2)

    // Clear projectiles to count second volley
    state.projectiles = []

    // Simulate next 10s (up to 20s)
    for (let i = 0; i < ticksFor10s; i++) {
      stepTick(state)
    }
    expect(state.projectiles.filter((p) => p.id.startsWith('tree-p1-')).length).toBe(2)
  })
})
