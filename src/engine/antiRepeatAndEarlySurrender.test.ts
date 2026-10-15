import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { resolverLiquidacionPartida } from './asyncOpponent'

describe('Blindaje Antirrepeticiónde 30 Minutos, Rendición Temprana (<20s) y Cierre Garantizado de Salas (Migración 318)', () => {
  const migration318Path = join(
    process.cwd(),
    'supabase',
    'migrations',
    '318-fix-anti-repeat-early-surrender-and-desync-settlement.sql'
  )
  const verifyMatchPath = join(
    process.cwd(),
    'supabase',
    'functions',
    'verify-match',
    'index.ts'
  )

  it('1. El archivo de migración 318 existe y es accesible', () => {
    expect(existsSync(migration318Path)).toBe(true)
  })

  it('2. shop_config fija mm_no_repetir_minutos en 30 minutos obligatorios', () => {
    const sql = readFileSync(migration318Path, 'utf8')
    expect(sql).toContain("key = 'mm_no_repetir_minutos'")
    expect(sql).toContain("'30'")
  })

  it('3. game_rooms_status_check incluye el estado cancelled para evitar rollbacks de árbitro', () => {
    const sql = readFileSync(migration318Path, 'utf8')
    expect(sql).toContain('game_rooms_status_check')
    expect(sql).toContain("'cancelled'")
    expect(sql).toContain("ARRAY['playing'::text, 'p1_won'::text, 'p2_won'::text, 'draw'::text, 'abandoned'::text, 'cancelled'::text]")
  })

  it('4. _emparejar_lote impone regla estricta de no repetición de 30 minutos sin excepciones en ranked', () => {
    const sql = readFileSync(migration318Path, 'utf8')
    expect(sql).toContain('v_norepe := GREATEST(30, COALESCE(v_norepe, 30));')
    expect(sql).toContain('make_interval(mins => v_norepe)')
    expect(sql).toContain('(v_pasada = 2 AND p_mode = \'tournament\')')
    expect(sql).toContain('NOT EXISTS (')
    expect(sql).toContain('SELECT 1 FROM public.game_rooms r')
  })

  it('5. _settle_room aplica rendición temprana (< 20s): restaura energía al ganador, 0 copas al ganador, copas normales al perdedor', () => {
    const sql = readFileSync(migration318Path, 'utf8')
    // Umbral de 20 segundos
    expect(sql).toContain('v_match_duration < 20')
    // Restaura energía al ganador
    expect(sql).toContain('energy_current = LEAST(')
    expect(sql).toContain("'energy_refund'")
    expect(sql).toContain('v_is_early_surrender')
    // 0 copas al ganador
    expect(sql).toContain('v_delta_p1 := 0')
    expect(sql).toContain('v_delta_p2 := 0')
    // Pérdida normal de copas del perdedor calculada con delta 0.0
    expect(sql).toContain('public._ranked_elo_delta(v_elo_p1_before, v_elo_p2_before, 0.0)')
    expect(sql).toContain('public._ranked_elo_delta(v_elo_p2_before, v_elo_p1_before, 0.0)')
    // Detección y sanción de Win-Trading por el árbitro
    expect(sql).toContain('wintrading_ranked_autoban')
    expect(sql).toContain("UPDATE public.game_rooms SET status = 'cancelled'")
  })

  it('6. mark_match_verification_failed liquida la sala como abandoned y reembolsa energía para no dejar salas atascadas', () => {
    const sql = readFileSync(migration318Path, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_match_verification_failed')
    expect(sql).toContain("status = 'abandoned'")
    expect(sql).toContain('settled_at = NOW()')
    expect(sql).toContain('public._refund_room_energy(p_room_id')
  })

  it('7. verify-match Edge Function permite liquidar por consenso en desincronizaciones leves de soles o cooldowns', () => {
    expect(existsSync(verifyMatchPath)).toBe(true)
    const code = readFileSync(verifyMatchPath, 'utf8')
    expect(code).toContain('esDesincronizacionLeve')
    expect(code).toContain('soles_insuficientes')
    expect(code).toContain('cooldown_no_disponible')
  })

  it('8. resolverLiquidacionPartida propaga earlySurrender y energyRestored al ganador', () => {
    const resWinner = resolverLiquidacionPartida({
      isAsyncMatch: false,
      soyP1: true,
      currentUserId: 'user-winner-123',
      serverVerification: {
        ok: true,
        status: 'settled',
        winnerId: 'user-winner-123',
        winnerSide: 1,
        settlement: {
          success: true,
          status: 'p1_won',
          eloDelta: 0,
          eloBefore: 2500,
          eloAfter: 2500,
          earlySurrender: true,
          energyRestored: true,
          rawElo: {
            p1Before: 2500,
            p1After: 2500,
            p1Delta: 0,
            p2Before: 2480,
            p2After: 2450,
            p2Delta: -30,
            isEarlySurrender: true,
          },
        },
      },
    })

    expect(resWinner.mostrarResultado).toBe(true)
    expect(resWinner.resultadoFinal).toBe('victory')
    expect(resWinner.earlySurrender).toBe(true)
    expect(resWinner.energyRestored).toBe(true)
    expect(resWinner.eloDelta).toBe(0)
    expect(resWinner.eloGained).toBeUndefined()
  })

  it('9. resolverLiquidacionPartida propaga derrota con pérdida de copas al perdedor que se rindió antes de 20s', () => {
    const resLoser = resolverLiquidacionPartida({
      isAsyncMatch: false,
      soyP1: false,
      currentUserId: 'user-loser-456',
      serverVerification: {
        ok: true,
        status: 'settled',
        winnerId: 'user-winner-123',
        winnerSide: 1,
        settlement: {
          success: true,
          status: 'p1_won',
          eloDelta: -30,
          eloBefore: 2480,
          eloAfter: 2450,
          earlySurrender: true,
          energyRestored: false,
          rawElo: {
            p1Before: 2500,
            p1After: 2500,
            p1Delta: 0,
            p2Before: 2480,
            p2After: 2450,
            p2Delta: -30,
            isEarlySurrender: true,
          },
        },
      },
    })

    expect(resLoser.mostrarResultado).toBe(true)
    expect(resLoser.resultadoFinal).toBe('defeat')
    expect(resLoser.earlySurrender).toBe(true)
    expect(resLoser.eloDelta).toBe(-30)
    expect(resLoser.eloLost).toBe(30)
  })

  it('10. resolverLiquidacionPartida protege al usuario si la sala fue abandonada sin ganador', () => {
    const resAbandoned = resolverLiquidacionPartida({
      isAsyncMatch: false,
      soyP1: true,
      currentUserId: 'user-p1',
      serverVerification: {
        ok: true,
        status: 'settled',
        winnerId: null,
        winnerSide: null,
        settlement: {
          success: true,
          status: 'abandonada',
        },
      },
    })

    expect(resAbandoned.statusServidor).toBe('revision_servidor')
    expect(resAbandoned.resultadoFinal).toBe('draw')
    expect(resAbandoned.energyRestored).toBe(true)
  })
})
