import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Árbitro Antifraude, Rendición Legítima y Blindaje Anti-Inversión (Migración 310)', () => {
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', '310-fix-surrender-elo-and-authoritative-arbitration.sql')

  it('1. El archivo de migración 310 existe y es accesible', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('2. _settle_room no penaliza rendiciones legítimas (>25s y >=2 plantas)', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('v_is_early_surrender')
    // No debe contener la cláusula indiscriminada OR verification_note ILIKE '%surrender%' para early surrender
    expect(sql).not.toMatch(/IF\s+v_match_duration\s*<\s*\d+\s+OR\s+v_plants_count\s*<\s*\d+\s+OR\s+v_room\.verification_note\s+ILIKE\s+'%surrender%'/i)
    expect(sql).toContain('v_match_duration < 25 OR v_plants_count < 2')
    expect(sql).toContain('Victoria por rendición del rival confirmada')
  })

  it('3. settle_verified_match incluye blindaje anti-forfeit por desincronización de red', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain("v_reason = 'forfeit_p1' AND v_room.p1_reported_winner = v_room.player1_id AND v_room.p2_reported_winner IS NULL")
    expect(sql).toContain("v_reason = 'forfeit_p2' AND v_room.p2_reported_winner = v_room.player2_id AND v_room.p1_reported_winner IS NULL")
    expect(sql).toContain('server_verified_anti_desync_override')
  })

  it('4. Restitución retroactiva oficial de copas para Jon Snow (+120) y Dagger22 (+60)', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('26c64a60-8fb2-47e1-be21-4e4e9eee64ad')
    expect(sql).toContain('dac4e1f0-fe0e-4f29-9d92-58386f915163')
    expect(sql).toContain('elo_rating = elo_rating + 120')
    expect(sql).toContain('elo_rating = elo_rating + 60')
  })
})
