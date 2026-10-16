import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Clan Donations & Fortress Sun Budget System (Audit & Fixes)', () => {
  const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/333-fix-clan-donations-and-fortress-suns-desync.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf8')

  it('1. Migración 333 no contiene referencias erróneas a profiles.plant_copies', () => {
    // profiles nunca debe tener columna plant_copies en instrucciones SQL ejecutables
    const sqlWithoutComments = migrationSql.replace(/--.*$/gm, '')
    expect(sqlWithoutComments).not.toMatch(/profiles\s*\.\s*plant_copies/i)
    expect(sqlWithoutComments).not.toMatch(/SET\s+plant_copies\s*=/i)
    expect(sqlWithoutComments).not.toMatch(/SELECT.*plant_copies.*FROM\s+public\.profiles/i)
  })

  it('2. Migración 333 utiliza public.plant_copies como fuente autoritativa', () => {
    // Donación descuenta en public.plant_copies para el donante
    expect(migrationSql).toMatch(/UPDATE\s+public\.plant_copies\s+SET\s+copies\s*=\s*GREATEST\(0,\s*copies\s*-\s*1\)/i)
    // Donación acredita en public.plant_copies para el solicitante
    expect(migrationSql).toMatch(/INSERT\s+INTO\s+public\.plant_copies\s*\(user_id,\s*plant_id,\s*copies\)/i)
    expect(migrationSql).toMatch(/DO\s+UPDATE\s+SET\s+copies\s*=\s*LEAST\(5,\s*public\.plant_copies\.copies\s*\+\s*1\)/i)
  })

  it('3. donate_suns_to_fortress NUNCA reduce el presupuesto acumulado ni lo degrada a 1000', () => {
    // Debe usar GREATEST para no degradar soles acumulados por cosechas de girasoles
    expect(migrationSql).toMatch(/v_new_budget\s*:=\s*GREATEST\(\s*COALESCE\(v_fortress\.defense_suns_budget,\s*1000\),\s*COALESCE\(v_fortress\.suns_spent,\s*0\)\s*\)\s*\+\s*v_suns_gained/i)
    // El nuevo presupuesto nunca puede ser inferior a lo que ya tenía o a lo gastado
    expect(migrationSql).toMatch(/v_new_budget\s*:=\s*GREATEST\(\s*v_new_budget,\s*COALESCE\(v_fortress\.defense_suns_budget,\s*1000\),\s*COALESCE\(v_fortress\.suns_spent,\s*0\)\s*\)/i)
  })

  it('4. get_clan_fortress garantiza que defenseSunsBudget >= sunsSpent matemáticamente', () => {
    expect(migrationSql).toMatch(/'defenseSunsBudget',\s*v_effective_budget/i)
    expect(migrationSql).toMatch(/v_effective_budget\s*:=\s*GREATEST\(\s*COALESCE\(v_fortress\.defense_suns_budget,\s*1000\),\s*COALESCE\(v_fortress\.suns_spent,\s*0\)\s*\)/i)
  })

  it('5. FortressEditor calcula effectiveBudget para evitar números negativos (-200☀️)', () => {
    const editorPath = path.resolve(__dirname, 'FortressEditor.tsx')
    const editorCode = fs.readFileSync(editorPath, 'utf8')

    expect(editorCode).toContain('const effectiveBudget = Math.max(sunsBudget, sunsSpent)')
    expect(editorCode).toContain('const sunsRemaining = Math.max(0, effectiveBudget - sunsSpent)')
    expect(editorCode).toContain('{sunsSpent} / {effectiveBudget} ☀️')
  })

  it('6. FortressEditor sincroniza reactivamente las copias del jugador al donar al arsenal', () => {
    const editorPath = path.resolve(__dirname, 'FortressEditor.tsx')
    const editorCode = fs.readFileSync(editorPath, 'utf8')

    expect(editorCode).toContain('setLocalPlantCopies')
    expect(editorCode).toMatch(/\[plantId\]:\s*Math\.max\(0,\s*\(prev\[plantId\]\s*\|\|\s*0\)\s*-\s*1\)/)
  })
})
