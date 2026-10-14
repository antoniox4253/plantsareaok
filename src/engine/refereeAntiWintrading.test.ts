import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Árbitro Antifraude y Anti-WinTrading (Migración 305)', () => {
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', '305-referee-anti-wintrading-and-farm-auto-ban.sql')

  it('1. El archivo de migración 305 existe y es accesible', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('2. _settle_room detecta rendición temprana (<30s o <2 plantas) y otorga 0 ELO al ganador', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('v_is_early_surrender')
    expect(sql).toMatch(/IF\s+v_is_early_surrender\s+THEN[\s\S]*?v_delta_p1\s*:=\s*0/i)
    expect(sql).toMatch(/IF\s+v_is_early_surrender\s+THEN[\s\S]*?v_delta_p2\s*:=\s*0/i)
    expect(sql).toContain('Victoria por abandono/rendición temprana (<30s o combate insuficiente) - Sin incremento de copas')
  })

  it('3. _settle_room bloquea sobre de victoria y oro VIP en rendiciones tempranas', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toMatch(/IF\s+p_winner_id\s+IS\s+NOT\s+NULL\s+AND\s+NOT\s+v_is_early_surrender\s+THEN[\s\S]*?_award_victory_chest_for/i)
    expect(sql).toMatch(/IF\s+p_winner_id\s+IS\s+NOT\s+NULL\s+AND\s+NOT\s+v_is_early_surrender\s+THEN[\s\S]*?_award_vip_victory_gold/i)
  })

  it('4. _settle_room ejecuta AUTO-BAN si se detecta colusión o racha sospechosa en Ranked', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('wintrading_ranked_autoban')
    expect(sql).toMatch(/UPDATE\s+public\.profiles\s+SET\s+is_banned\s*=\s*true/i)
    expect(sql).toContain('Árbitro Antifraude: Win-Trading y colusión sistemática en PvP Ranked')
    expect(sql).toContain('ALERTA DE SEGURIDAD DEL ÁRBITRO: Colusión y Win-Trading detectado en Ranked')
  })

  it('5. _settle_if_abandoned ejecuta AUTO-BAN si dos cuentas acumulan abandono mutuo por inactividad', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('multiaccount_farm_inactive_autoban')
    expect(sql).toContain('auto_settled_abandoned_both_inactive')
    expect(sql).toContain('Árbitro Antifraude: Granja multicuenta detectada por inactividad mutua reiterada')
  })

  it('6. surrender_match etiqueta correctamente la sala con nota autoritativa', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain("verification_note = 'server_verified_surrender'")
  })
})
