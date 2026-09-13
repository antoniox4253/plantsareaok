import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { simulateAsyncMatch } from './asyncOpponent'
import { createBattleState, stepTick } from './simulate'

describe('Fase 3: Control de Energías y Tolerancia en Verificación Asíncrona', () => {
  it('1. simulateAsyncMatch recupera limpiamente una victoria humana ante jitter de recolección de soles', () => {
    const seed = 12345
    const p1Deck = [
      { slot: 0, plantId: 'peashooter', level: 1, statRolls: [] },
      { slot: 1, plantId: 'repeater', level: 1, statRolls: [] },
      { slot: 2, plantId: 'wallnut', level: 1, statRolls: [] },
      { slot: 3, plantId: 'sunflower', level: 1, statRolls: [] },
    ]
    const p2Deck = [
      { slot: 0, plantId: 'sunflower', level: 1, statRolls: [] },
      { slot: 1, plantId: 'wallnut', level: 1, statRolls: [] },
    ]

    // Descubrir los primeros 12 soles reales del seed
    const st = createBattleState(seed, false, true, undefined, 'auth-v2')
    const suns: { id: string; tick: number }[] = []
    while (st.tick < 3000) {
      for (const s of st.suns) {
        if (!suns.some((x) => x.id === s.id)) suns.push({ id: s.id, tick: st.tick })
      }
      stepTick(st, () => {})
    }

    const p1Actions: any[] = [
      { seq: 1, tick: 80, issuedTick: 80, kind: 'collect', targetId: suns[0].id },
      { seq: 2, tick: 265, issuedTick: 265, kind: 'collect', targetId: suns[1].id },
      { seq: 3, tick: 445, issuedTick: 445, kind: 'collect', targetId: suns[2].id },
      { seq: 4, tick: 630, issuedTick: 630, kind: 'collect', targetId: suns[3].id },
      { seq: 5, tick: 646, issuedTick: 640, kind: 'plant', plantId: 'peashooter', slot: 0, lane: 0, col: 0 },
      { seq: 6, tick: 810, issuedTick: 810, kind: 'collect', targetId: suns[4].id },
      { seq: 7, tick: 995, issuedTick: 995, kind: 'collect', targetId: suns[5].id },
      { seq: 8, tick: 1180, issuedTick: 1180, kind: 'collect', targetId: suns[6].id },
      { seq: 9, tick: 1360, issuedTick: 1360, kind: 'collect', targetId: suns[7].id },
      { seq: 10, tick: 1545, issuedTick: 1545, kind: 'collect', targetId: suns[8].id },
      { seq: 11, tick: 1725, issuedTick: 1725, kind: 'collect', targetId: suns[9].id },
      { seq: 12, tick: 1910, issuedTick: 1910, kind: 'collect', targetId: suns[10].id },
      { seq: 13, tick: 2090, issuedTick: 2090, kind: 'collect', targetId: suns[11].id },
      // Jitter: issuedTick 2086 antes del sol 12 (tick 2090). En pase estricto daría TIMELINE_INCONSISTENT (Soles insuficientes: 175 < 200)
      { seq: 14, tick: 2092, issuedTick: 2086, kind: 'plant', plantId: 'repeater', slot: 1, lane: 0, col: 1 },
    ]

    const sim = simulateAsyncMatch(
      seed,
      p1Deck,
      p2Deck,
      p1Actions,
      [],
      4500,
      'auth-v2'
    )

    // El 2-pass tolerante debe recuperar la victoria limpia de P1
    expect(sim.ok).toBe(true)
    expect(sim.ganador).toBe(1)
    expect(sim.p1Ilegal).toBe(false)
  })

  it('2. Migración 147 define _refund_room_energy para acreditar energía y registrar transacción', () => {
    const migPath = join(process.cwd(), 'supabase', 'migrations', '147-auto-refund-energy-and-restore-lost-energy.sql')
    const sql = readFileSync(migPath, 'utf8')

    expect(sql).toMatch(/FUNCTION public\._refund_room_energy/i)
    expect(sql).toMatch(/energy_current = LEAST\(/i)
    expect(sql).toMatch(/INSERT INTO public\.transactions/i)
    expect(sql).toMatch(/energy_refund/i)
  })

  it('3. Migración 147 integra _refund_room_energy dentro de _settle_if_abandoned', () => {
    const migPath = join(process.cwd(), 'supabase', 'migrations', '147-auto-refund-energy-and-restore-lost-energy.sql')
    const sql = readFileSync(migPath, 'utf8')

    expect(sql).toMatch(/PERFORM public\._refund_room_energy\(p_room_id/i)
  })

  it('4. Migración 147 contiene el bloque retroactivo para restituir salas fallidas', () => {
    const migPath = join(process.cwd(), 'supabase', 'migrations', '147-auto-refund-energy-and-restore-lost-energy.sql')
    const sql = readFileSync(migPath, 'utf8')

    expect(sql).toMatch(/INTERVAL '24 hours'/i)
    expect(sql).toMatch(/Restitución completada/i)
  })
})
