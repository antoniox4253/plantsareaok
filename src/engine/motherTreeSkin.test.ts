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

  it('fires 2 projectiles from P1 starting at 25 seconds when P1 has mother_tree_skin', () => {
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

    const ticksFor25s = msToTicks(25000)

    // Simulate right before 25s
    for (let i = 0; i < ticksFor25s - 1; i++) {
      stepTick(state)
    }

    let treeProjectiles = state.projectiles.filter((p) => p.id.startsWith('tree-p1-'))
    expect(treeProjectiles.length).toBe(0)

    // Tick exactly at 25s mark
    stepTick(state)

    treeProjectiles = state.projectiles.filter((p) => p.id.startsWith('tree-p1-'))
    expect(treeProjectiles.length).toBe(2)

    for (const proj of treeProjectiles) {
      expect(proj.damage).toBe(20)
      expect(proj.targetTeam).toBe('p2')
      expect(proj.lane).toBeGreaterThanOrEqual(0)
      expect(proj.lane).toBeLessThanOrEqual(2)
      expect(proj.type).toBe('pea')
      expect(proj.originLane).toBe(1)
      expect(proj.originX).toBe(15)
      expect(proj.targetX).toBe(85)
    }
  })

  it('fires symmetrically from P2 when P2 has mother_tree_skin at 25 seconds', () => {
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

    const ticksFor25s = msToTicks(25000)

    for (let i = 0; i < ticksFor25s; i++) {
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

    const ticksFor25s = msToTicks(25000)

    for (let i = 0; i < ticksFor25s; i++) {
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

  it('fires periodic volleys every 15 seconds consecutively after the initial 25 seconds', () => {
    const state = createBattleState(777, false, true, NIVEL_POR_DEFECTO, 'auth-v2', 600, 600, 'mother_tree_skin', null)

    const ticksFor25s = msToTicks(25000)
    const ticksFor15s = msToTicks(15000)

    // First volley at 25s
    for (let i = 0; i < ticksFor25s; i++) {
      stepTick(state)
    }
    expect(state.projectiles.filter((p) => p.id.startsWith('tree-p1-')).length).toBe(2)

    // Clear projectiles to count second volley
    state.projectiles = []

    // Simulate next 15s (up to 40s)
    for (let i = 0; i < ticksFor15s; i++) {
      stepTick(state)
    }
    expect(state.projectiles.filter((p) => p.id.startsWith('tree-p1-')).length).toBe(2)
  })

  it('preserves mother_tree_skin through reconstruirPartidaAsync and reconstruirConHuellas', async () => {
    const { reconstruirPartidaAsync } = await import('./asyncOpponent')
    const { reconstruirConHuellas } = await import('./reconstruir')

    const seed = 42
    const deck = [
      { plantId: 'peashooter', level: 1, statRolls: [] },
      { plantId: 'sunflower', level: 1, statRolls: [] },
      { plantId: 'wallnut', level: 1, statRolls: [] },
      { plantId: 'repeater', level: 1, statRolls: [] },
    ]

    // 1. Reconstrucción Asíncrona (Ranked / Rival Semilla)
    const resAsync = reconstruirPartidaAsync(
      seed,
      deck as any,
      deck as any,
      [],
      [],
      msToTicks(26000), // 26s simulation (first shot at 25s)
      'auth-v2',
      600,
      600,
      'mother_tree_skin',
      null
    )

    expect(resAsync.ok).toBe(true)
    expect(resAsync.estado.p1TreeSkin).toBe('mother_tree_skin')
    const projs = resAsync.estado.projectiles.filter((p) => p.id.startsWith('tree-p1-'))
    expect(projs.length).toBeGreaterThanOrEqual(1)

    // 2. Reconstrucción Lockstep (1c1 con huellas)
    const resLockstep = reconstruirConHuellas(
      seed,
      [],
      msToTicks(26000),
      true,
      'auth-v2',
      600,
      600,
      'mother_tree_skin',
      null
    )

    expect(resLockstep.estado.p1TreeSkin).toBe('mother_tree_skin')
    const projsLockstep = resLockstep.estado.projectiles.filter((p) => p.id.startsWith('tree-p1-'))
    expect(projsLockstep.length).toBeGreaterThanOrEqual(1)
  })
})

