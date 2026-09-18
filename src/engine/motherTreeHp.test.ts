import { describe, it, expect } from 'vitest'
import { createBattleState, stepTick, TIC_MUERTE_SUBITA } from './simulate'
import { reconstruirPartidaAsync } from './asyncOpponent'
import { reconstruirConHuellas } from './reconstruir'
import { huellaDeLaPartida } from './huella'
import { INITIAL_BASE_HP } from '../utils/gameConstants'
import type { CartaDeMazo } from './mazoDeLaSala'

describe('Mother Tree HP and Sudden Death Synchronization', () => {
  const seed = 12345
  const mazo: CartaDeMazo[] = [
    { slot: 0, plantId: 'sunflower', level: 0, statRolls: [] },
    { slot: 1, plantId: 'peashooter', level: 0, statRolls: [] },
    { slot: 2, plantId: 'wallnut', level: 0, statRolls: [] },
    { slot: 3, plantId: 'repeater', level: 0, statRolls: [] },
  ]

  it('createBattleState initializes scaled base HP for both players with mother tree bonus', () => {
    const p1Bonus = 100 // Level 2 (+100 HP = 700)
    const p2Bonus = 50  // Level 1 (+50 HP = 650)

    const state = createBattleState(
      seed,
      false,
      true,
      undefined,
      'auth-v2',
      INITIAL_BASE_HP + p1Bonus,
      INITIAL_BASE_HP + p2Bonus
    )

    expect(state.p1BaseHp).toBe(700)
    expect(state.p2BaseHp).toBe(650)
  })

  it('reconstruirPartidaAsync preserves rival Mother Tree bonus across rollbacks', () => {
    const p1Hp = 700 // +100
    const p2Hp = 650 // +50

    const rebuildRes = reconstruirPartidaAsync(
      seed,
      mazo,
      mazo,
      [],
      [],
      50,
      'auth-v2',
      p1Hp,
      p2Hp
    )

    expect(rebuildRes.ok).toBe(true)
    expect(rebuildRes.estado.p1BaseHp).toBe(700)
    expect(rebuildRes.estado.p2BaseHp).toBe(650)
  })

  it('reconstruirConHuellas preserves both players Mother Tree bonuses', () => {
    const p1Hp = 650
    const p2Hp = 750

    const res = reconstruirConHuellas(
      seed,
      [],
      30,
      true,
      'auth-v2',
      p1Hp,
      p2Hp
    )

    expect(res.estado.p1BaseHp).toBe(650)
    expect(res.estado.p2BaseHp).toBe(750)
  })

  it('huellaDeLaPartida is symmetrical between P1 and P2 with different tree levels', () => {
    // Ana es P1 con 700 HP, Beto es P2 con 650 HP
    const anaState = createBattleState(seed, false, true, undefined, 'auth-v2', 700, 650)
    // Beto ve a sí mismo como P1 (su base a la izquierda = 650 HP) y Ana como P2 (derecha = 700 HP)
    const betoState = createBattleState(seed, false, true, undefined, 'auth-v2', 650, 700)

    // Huella desde la perspectiva canónica de la sala (soyP1 = true para Ana, false para Beto)
    const hAna = huellaDeLaPartida(anaState, true)
    const hBeto = huellaDeLaPartida(betoState, false)

    expect(hAna).toBe(hBeto)
  })

  it('Sudden death awards victory to higher Mother Tree level in absence of attacks', () => {
    // Jugador 1 (Nv 1 = 650 HP) vs Rival (Nv 0 = 600 HP)
    const state = createBattleState(seed, false, true, undefined, 'auth-v2', 650, 600)

    let ticks = 0
    while (state.status === 'playing' && ticks < TIC_MUERTE_SUBITA + 2000) {
      stepTick(state, () => {})
      ticks += 1
    }

    expect(state.status).toBe('victory')
    expect(state.p1BaseHp).toBeGreaterThan(0)
    expect(state.p2BaseHp).toBe(0)
  })
})
