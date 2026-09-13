import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migración 140: Corrección Definitiva de Columna ELO en Ranked Async Opponents y Game Rooms', () => {
  const m140Path = path.resolve(__dirname, '../../supabase/migrations/140-fix-ranked-async-opponent-elo-column-and-game-rooms.sql')
  const m140Sql = fs.readFileSync(m140Path, 'utf-8')

  it('1.1. SQL Audit: Asegura columnas rating_snapshot y elo_rating en ranked_async_opponents', () => {
    expect(m140Sql).toContain('ALTER TABLE public.ranked_async_opponents')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS rating_snapshot INTEGER DEFAULT 1000')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1000')
  })

  it('1.2. SQL Audit: Sincronización bidireccional entre rating_snapshot y elo_rating', () => {
    expect(m140Sql).toMatch(/UPDATE\s+public\.ranked_async_opponents\s+SET\s+elo_rating\s*=\s*COALESCE\(rating_snapshot,\s*elo_rating,\s*1000\)/i)
    expect(m140Sql).toMatch(/UPDATE\s+public\.ranked_async_opponents\s+SET\s+rating_snapshot\s*=\s*COALESCE\(elo_rating,\s*rating_snapshot,\s*1000\)/i)
  })

  it('1.3. SQL Audit: Asegura columnas canónicas y alias en public.game_rooms', () => {
    expect(m140Sql).toContain('ALTER TABLE public.game_rooms')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS async_rating_snapshot INTEGER')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS async_player_elo INTEGER')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS async_display_name TEXT')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS async_player_name TEXT')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS async_avatar_id TEXT')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS async_player_avatar TEXT')
    expect(m140Sql).toContain('ADD COLUMN IF NOT EXISTS async_deck_snapshot JSONB')
  })

  it('1.4. SQL Audit: claim_ranked_async_opponent usa COALESCE para evitar error column elo_rating does not exist', () => {
    expect(m140Sql).toContain('CREATE OR REPLACE FUNCTION public.claim_ranked_async_opponent()')
    expect(m140Sql).toContain('COALESCE(rating_snapshot, elo_rating, 1000)')
    // En el cuerpo de la función no debe existir referencia desnuda a elo_rating que pueda romper
    const functionBody = m140Sql.split('CREATE OR REPLACE FUNCTION public.claim_ranked_async_opponent()')[1] || ''
    expect(functionBody).not.toMatch(/ABS\(elo_rating\s*-/i)
  })

  it('1.5. SQL Audit: claim_ranked_async_opponent puebla tanto columnas canónicas como alias en game_rooms', () => {
    expect(m140Sql).toContain('async_display_name')
    expect(m140Sql).toContain('async_player_name')
    expect(m140Sql).toContain('async_avatar_id')
    expect(m140Sql).toContain('async_player_avatar')
    expect(m140Sql).toContain('async_rating_snapshot')
    expect(m140Sql).toContain('async_player_elo')
    expect(m140Sql).toContain('async_deck_snapshot')
  })

  it('1.6. SQL Audit: Preserva control autoritativo de energía para ELO >= 1602 y prioridad humana', () => {
    expect(m140Sql).toContain('IF v_player_elo >= 1602 AND COALESCE(v_cur_en, 0) < 1 THEN')
    expect(m140Sql).toContain('public._try_match(v_uid)')
    expect(m140Sql).toContain("UPDATE public.matchmaking_queue")
    expect(m140Sql).toContain("SET status = 'matched'")
  })

  it('2. Simulación de resolución de candidato semilla con tolerancia de nombres de columna', () => {
    interface SeedOpponentRow {
      id: string
      display_name: string
      rating_snapshot?: number | null
      elo_rating?: number | null
      active: boolean
    }

    const seeds: SeedOpponentRow[] = [
      { id: 's1', display_name: 'SolarBloom', rating_snapshot: 1000, elo_rating: null, active: true },
      { id: 's2', display_name: 'PeaStriker', rating_snapshot: null, elo_rating: 1200, active: true },
      { id: 's3', display_name: 'BrambleGuard', rating_snapshot: 1400, elo_rating: 1400, active: true },
    ]

    function resolveElo(seed: SeedOpponentRow): number {
      return seed.rating_snapshot ?? seed.elo_rating ?? 1000
    }

    expect(resolveElo(seeds[0])).toBe(1000)
    expect(resolveElo(seeds[1])).toBe(1200)
    expect(resolveElo(seeds[2])).toBe(1400)
  })
})
