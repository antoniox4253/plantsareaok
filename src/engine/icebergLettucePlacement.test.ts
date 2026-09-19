import { describe, it, expect } from 'vitest'
import {
  validarAccionP1RankedEstricta,
  validarMazoAsyncRanked,
  ESTADISTICAS_VALIDAS,
} from './asyncP1History'
import { MARGEN_DE_RED_TICS } from './pvp'
import { ejecutarCapturaPlantP1 } from './asyncP1Capture'
import { rollsValidos } from './asyncOpponent'
import { createBattleState, type GameState } from './simulate'

describe('Lechuga Helada (Iceberg Lettuce) - Validación y Colocación en Combate', () => {
  it('ESTADISTICAS_VALIDAS incluye "duration"', () => {
    expect(ESTADISTICAS_VALIDAS.has('duration')).toBe(true)
    expect(ESTADISTICAS_VALIDAS.has('hp')).toBe(true)
    expect(ESTADISTICAS_VALIDAS.has('damage')).toBe(true)
    expect(ESTADISTICAS_VALIDAS.has('attackSpeed')).toBe(true)
    expect(ESTADISTICAS_VALIDAS.has('moveSpeed')).toBe(true)
    expect(ESTADISTICAS_VALIDAS.has('cooldown')).toBe(true)
  })

  it('validarAccionP1RankedEstricta aprueba acciones de plantar iceberglettuce con statRolls de duration', () => {
    const res = validarAccionP1RankedEstricta({
      seq: 1,
      tick: MARGEN_DE_RED_TICS, // issuedTick (0) + MARGEN_DE_RED_TICS (6)
      issuedTick: 0,
      kind: 'plant',
      plantId: 'iceberglettuce',
      lane: 1,
      col: 2,
      slot: 0,
      statRolls: ['duration', 'cooldown'],
      level: 2,
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.accion.plantId).toBe('iceberglettuce')
      expect(res.accion.statRolls).toEqual(['duration', 'cooldown'])
      expect(res.accion.level).toBe(2)
    }
  })

  it('validarMazoAsyncRanked aprueba un mazo rival con iceberglettuce y mejoras de duration', () => {
    const deck = [
      { slot: 0, plantId: 'peashooter', level: 0, statRolls: [] },
      { slot: 1, plantId: 'sunflower', level: 0, statRolls: [] },
      { slot: 2, plantId: 'wallnut', level: 0, statRolls: [] },
      { slot: 3, plantId: 'repeater', level: 0, statRolls: [] },
      { slot: 4, plantId: 'iceberglettuce', level: 1, statRolls: ['duration'] },
      { slot: 5, plantId: 'chomper', level: 0, statRolls: [] },
    ]

    const val = validarMazoAsyncRanked(deck)
    expect(val.ok).toBe(true)
  })

  it('rollsValidos en asyncOpponent preserva la estadística duration', () => {
    const rolls = rollsValidos(['duration', 'cooldown', 'invalidStat' as any])
    expect(rolls).toEqual(['duration', 'cooldown'])
  })

  it('ejecutarCapturaPlantP1 coloca exitosamente la Lechuga Helada con statRolls de duration', () => {
    const state: GameState = createBattleState(12345, false, true)
    state.sunBank = 100 // Iceberg cuesta 0 soles

    const res = ejecutarCapturaPlantP1({
      isAsyncMatch: true,
      card: 'iceberglettuce',
      slotIdx: 0,
      lane: 1,
      col: 2,
      rolls: ['duration'],
      cardLevel: 1,
      state,
      seq: 1,
      enTic: 6,
      pending: [],
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.enTic).toBe(6)
      expect(res.accion?.plantId).toBe('iceberglettuce')
      expect(res.accion?.statRolls).toEqual(['duration'])
    }

    // Comprobar que se encoló la planta propia en el estado sin errores
    const plantPending = state.pending.filter((p) => p.kind === 'own_plant')
    expect(plantPending).toHaveLength(1)
    expect(plantPending[0].plantId).toBe('iceberglettuce')
    expect(plantPending[0].lane).toBe(1)
    expect(plantPending[0].col).toBe(2)
    expect(plantPending[0].statRolls).toEqual(['duration'])
    expect(plantPending[0].level).toBe(1)
  })

  it('ejecutarCapturaPlantP1 coloca exitosamente Lanzamaíz con statRolls que incluyen duration', () => {
    const state: GameState = createBattleState(54321, false, true)
    state.sunBank = 200 // Lanzamaíz cuesta 100 soles

    const res = ejecutarCapturaPlantP1({
      isAsyncMatch: true,
      card: 'kernelpult',
      slotIdx: 1,
      lane: 0,
      col: 1,
      rolls: ['hp', 'duration'],
      cardLevel: 2,
      state,
      seq: 2,
      enTic: 6,
      pending: [],
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.accion?.plantId).toBe('kernelpult')
      expect(res.accion?.statRolls).toEqual(['hp', 'duration'])
    }
  })
})
