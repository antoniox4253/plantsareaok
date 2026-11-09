import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Matchmaking Queue Schema Alignment and Columns Fix (Migration 421)', () => {
  const m421Path = path.resolve(__dirname, '../../supabase/migrations/421-fix-enter-matchmaking-queue-columns.sql')
  const m421Sql = fs.readFileSync(m421Path, 'utf-8')

  // Extraer el código completo de cada función (hasta el $function$; de cierre)
  const enterMatchmakingFull = m421Sql.match(/CREATE OR REPLACE FUNCTION public\.enter_matchmaking[\s\S]*?END;\s*\$function\$;/i)?.[0] || ''
  const emparejarLoteFull = m421Sql.match(/CREATE OR REPLACE FUNCTION public\._emparejar_lote[\s\S]*?END;\s*\$function\$;/i)?.[0] || ''

  const canonicalColumns = new Set([
    'id',
    'user_id',
    'mode',
    'tournament_id',
    'colosseum_bet',
    'user_elo',
    'room_code',
    'status',
    'matched_room_id',
    'created_at',
    'last_seen_at',
    'escrow_id',
    'client_engine_version',
    'updated_at',
    'elo_rating',
    'elo',
  ])

  it('1.1. enter_matchmaking y _emparejar_lote no contienen columnas inexistentes en cuerpo ejecutable (bet_amount, check_matchmaking)', () => {
    expect(enterMatchmakingFull.length).toBeGreaterThan(100)
    expect(emparejarLoteFull.length).toBeGreaterThan(100)

    const cleanEnter = enterMatchmakingFull.replace(/--.*$/gm, '')
    const cleanEmparejar = emparejarLoteFull.replace(/--.*$/gm, '')

    expect(cleanEnter).not.toContain('bet_amount')
    expect(cleanEnter).not.toContain('check_matchmaking')
    expect(cleanEmparejar).not.toContain('bet_amount')
  })

  it('1.2. Toda columna insertada en matchmaking_queue pertenece al esquema canónico', () => {
    const insertMatches = enterMatchmakingFull.matchAll(/INSERT\s+INTO\s+public\.matchmaking_queue\s*\(([^)]+)\)/gi)
    let found = false
    for (const match of insertMatches) {
      found = true
      const cols = match[1].split(',').map((c) => c.trim().toLowerCase())
      for (const col of cols) {
        expect(canonicalColumns.has(col), `Columna no válida en INSERT: "${col}"`).toBe(true)
      }
      expect(cols).toContain('user_id')
      expect(cols).toContain('mode')
      expect(cols).toContain('colosseum_bet')
      expect(cols).toContain('client_engine_version')
      expect(cols).toContain('status')
    }
    expect(found).toBe(true)
  })

  it('1.3. enter_matchmaking encola el nuevo registro con estado "searching"', () => {
    expect(enterMatchmakingFull).toMatch(/'searching',\s*p_bet/i)
  })

  it('1.4. _emparejar_lote usa matched_room_id y _create_room en vez de room_id o INSERT directo a game_rooms', () => {
    expect(emparejarLoteFull).toContain('matched_room_id = v_room')
    expect(emparejarLoteFull).not.toMatch(/\bSET\s+[^,;]*\broom_id\s*=/i)
    expect(emparejarLoteFull).toContain('public._create_room')
    expect(emparejarLoteFull).not.toMatch(/INSERT\s+INTO\s+public\.game_rooms\s*\([^)]*bet_amount/i)
  })

  it('1.5. Registra la migración en _migration_audit', () => {
    expect(m421Sql).toContain('421-fix-enter-matchmaking-queue-columns')
    expect(m421Sql).toContain('public._migration_audit')
  })
})
