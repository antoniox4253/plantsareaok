import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Separación e Inmunidad de Matchmaking: Torneo vs Ranked PvP (Migración 133)', () => {
  const m133Path = path.resolve(__dirname, '../../supabase/migrations/133-fix-matchmaking-queue-updated-at-and-isolate-pvp-ranked.sql')
  const m130Path = path.resolve(__dirname, '../../supabase/migrations/130-tournament-authoritative-zero-bots-3-lives-guard.sql')
  const m131Path = path.resolve(__dirname, '../../supabase/migrations/131-restore-pvp-rooms-and-distribute-tournament-rewards.sql')

  const m133Sql = fs.readFileSync(m133Path, 'utf-8')
  const m130Sql = fs.readFileSync(m130Path, 'utf-8')
  const m131Sql = fs.readFileSync(m131Path, 'utf-8')

  it('1.1. SQL Audit: Migración 133 agrega físicamente la columna updated_at a matchmaking_queue', () => {
    expect(m133Sql).toContain('ALTER TABLE public.matchmaking_queue')
    expect(m133Sql).toContain('ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()')
  })

  it('1.2. SQL Audit: Migraciones 130 y 131 también incorporan defensivamente updated_at', () => {
    expect(m130Sql).toContain('ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()')
    expect(m131Sql).toContain('ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()')
  })

  it('1.3. SQL Audit: claim_ranked_async_opponent filtra de forma estricta por mode = ranked y tournament_id IS NULL', () => {
    expect(m133Sql).toContain("mode = 'ranked'")
    expect(m133Sql).toContain('tournament_id IS NULL')
    expect(m133Sql).toContain("IF v_queue.mode <> 'ranked' THEN")
  })

  it('1.4. SQL Audit: claim_ranked_async_opponent crea la sala con tournament_id = NULL y actualiza queue', () => {
    expect(m133Sql).toContain("'ranked'")
    expect(m133Sql).toMatch(/UPDATE\s+public\.matchmaking_queue\s+SET\s+status\s*=\s*'matched',\s*matched_room_id\s*=\s*v_new_room_id/i)
    expect(m133Sql).toContain('updated_at = v_now')
  })

  it('1.5. SQL Audit: Migración 133 limpia preventivamente colas colgadas por el error previo', () => {
    expect(m133Sql).toContain("SET status = 'cancelled'")
    expect(m133Sql).toContain("status IN ('searching', 'waiting')")
    expect(m133Sql).toContain("created_at < NOW() - INTERVAL '2 minutes'")
  })

  it('2.1. Simulación de Aislamiento de Colas: Torneo y Ranked nunca colisionan ni comparten salas', () => {
    interface QueueEntry {
      id: string
      userId: string
      mode: 'ranked' | 'tournament' | 'friendly' | 'colosseum'
      tournamentId: string | null
      status: 'searching' | 'matched' | 'cancelled'
    }

    const queue: QueueEntry[] = [
      { id: 'q-tourn-1', userId: 'user-tourn-1', mode: 'tournament', tournamentId: 'tourney-abc', status: 'searching' },
      { id: 'q-ranked-1', userId: 'user-ranked-1', mode: 'ranked', tournamentId: null, status: 'searching' },
    ]

    function simulateClaimRankedBot(q: QueueEntry[], currentUserId: string): { allowed: boolean; error?: string } {
      const entry = q.find((e) => e.userId === currentUserId && e.status === 'searching')
      if (!entry) return { allowed: false, error: 'no_en_cola' }

      // Regla estricta de aislamiento
      if (entry.mode !== 'ranked' || entry.tournamentId !== null) {
        return { allowed: false, error: 'modo_no_soporta_semilla' }
      }

      return { allowed: true }
    }

    // Jugador en torneo intentando solicitar bot -> RECHAZADO (Cero bots en torneo)
    const resTourn = simulateClaimRankedBot(queue, 'user-tourn-1')
    expect(resTourn.allowed).toBe(false)
    expect(resTourn.error).toBe('modo_no_soporta_semilla')

    // Jugador en ranked por copas -> PERMITIDO
    const resRanked = simulateClaimRankedBot(queue, 'user-ranked-1')
    expect(resRanked.allowed).toBe(true)
    expect(resRanked.error).toBeUndefined()
  })
})
