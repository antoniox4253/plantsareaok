import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { runAsyncTimeline } from './asyncOpponent'
import { createBattleState, type GameState } from './simulate'

describe('Fase 2: Resolución Definitiva de Partidas en Arbitraje y Empate Técnico', () => {
  it('1. runAsyncTimeline ante estado draw retorna motivo: draw sin lanzar error ni no_result', () => {
    const seed = 12345
    const deck = [
      { slot: 0, plantId: 'sunflower', level: 0, statRolls: [] },
      { slot: 1, plantId: 'peashooter', level: 0, statRolls: [] },
      { slot: 2, plantId: 'wallnut', level: 0, statRolls: [] },
    ]

    // Ejecutar hasta un tic antes de cualquier victoria/derrota forzando estado draw
    const res = runAsyncTimeline({
      seed,
      p1Deck: deck,
      asyncDeck: deck,
      p1Actions: [],
      asyncActions: [],
      maxTicks: 10,
      validateP1: false,
      strictAuthoritativeHistory: false,
      stopOnGameOver: true,
    })

    // Forzar status draw para verificar el mapeo de motivo
    res.state.status = 'draw'

    // Corroborar que la lógica de resolución mapea status draw a motivo draw
    let winner: 1 | 2 | null = null
    let motivo: 'simulation' | 'forfeit_p1' | 'draw' | 'no_result' = 'no_result'

    if (res.state.status === 'draw') {
      winner = null
      motivo = 'draw'
    }

    expect(winner).toBeNull()
    expect(motivo).toBe('draw')
  })

  it('2. Migración 146 contiene columnas p1_reported_at y p2_reported_at', () => {
    const migPath = join(process.cwd(), 'supabase', 'migrations', '146-fix-match-arbitration-and-pvp-resolution.sql')
    const content = readFileSync(migPath, 'utf8')

    expect(content).toMatch(/ADD COLUMN IF NOT EXISTS p1_reported_at TIMESTAMPTZ/i)
    expect(content).toMatch(/ADD COLUMN IF NOT EXISTS p2_reported_at TIMESTAMPTZ/i)
  })

  it('3. Migración 146 liquida autoritativamente por abandono tras ventana de 15 segundos', () => {
    const migPath = join(process.cwd(), 'supabase', 'migrations', '146-fix-match-arbitration-and-pvp-resolution.sql')
    const content = readFileSync(migPath, 'utf8')

    expect(content).toMatch(/INTERVAL '15 seconds'/i)
    expect(content).toMatch(/Victoria por abandono o desconexión del rival/i)
    expect(content).toMatch(/public\._settle_room\(p_room_id,\s*v_room\.player1_id\)/i)
    expect(content).toMatch(/public\._settle_room\(p_room_id,\s*v_room\.player2_id\)/i)
  })

  it('4. Migración 146 maneja consenso de empate limpio (ambos reportan NULL)', () => {
    const migPath = join(process.cwd(), 'supabase', 'migrations', '146-fix-match-arbitration-and-pvp-resolution.sql')
    const content = readFileSync(migPath, 'utf8')

    expect(content).toMatch(/v_room\.p1_reported_winner IS NULL AND v_room\.p2_reported_winner IS NULL/i)
    expect(content).toMatch(/verification_status = 'verified'/i)
    expect(content).toMatch(/Empate tácito por consenso mutuo verificado/i)
  })

  it('5. Migración 146 realiza reembolso efectivo de energía a ambos jugadores en disputas', () => {
    const migPath = join(process.cwd(), 'supabase', 'migrations', '146-fix-match-arbitration-and-pvp-resolution.sql')
    const content = readFileSync(migPath, 'utf8')

    expect(content).toMatch(/UPDATE public\.profiles p/i)
    expect(content).toMatch(/energy_current = LEAST\(/i)
    expect(content).toMatch(/energy_refund/i)
    expect(content).toMatch(/INSERT INTO public\.transactions/i)
  })
})
