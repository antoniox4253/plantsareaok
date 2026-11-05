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

  it('7. Migración 388 garantiza que search_clan_fortress_match asigna 750 soles para Árbol Madre Nivel 2 (en lugar de 400)', () => {
    const mig388Path = path.resolve(__dirname, '../../../supabase/migrations/388-fix-clan-fortress-raid-suns-and-perks.sql')
    const mig388Sql = fs.readFileSync(mig388Path, 'utf8')

    // Verifica que v_initial_attack_suns se asigne con CASE y no con la fórmula legada 300 + lvl*50
    expect(mig388Sql).not.toContain('v_initial_attack_suns := 300 + (v_attacker_tree_lvl * 50);')
    expect(mig388Sql).toContain('WHEN 2 THEN 750')
    expect(mig388Sql).toContain('WHEN 3 THEN 850')
    expect(mig388Sql).toContain('WHEN 4 THEN 1000')
    expect(mig388Sql).toContain('ELSE 650')
  })

  it('8. Battlefield.tsx tiene fallback alineado con los niveles del Árbol Madre', () => {
    const battlefieldPath = path.resolve(__dirname, '../Battlefield/Battlefield.tsx')
    const bfCode = fs.readFileSync(battlefieldPath, 'utf8')

    expect(bfCode).toContain('getFortressAttackSunsForLevel')
    expect(bfCode).not.toContain('500 + Math.max(0, treeLevel) * 150')
  })

  it('9. Migración 389 empareja exclusivamente entre clanes reales existentes y no bots', () => {
    const mig389Path = path.resolve(__dirname, '../../../supabase/migrations/389-fix-clan-fortress-pvp-and-raid-history.sql')
    const mig389Sql = fs.readFileSync(mig389Path, 'utf8')

    expect(mig389Sql).toContain('COALESCE(is_npc, FALSE) = FALSE')
    expect(mig389Sql).toContain('id <> v_my_clan_id')
    expect(mig389Sql).not.toContain('is_npc = TRUE')
  })

  it('10. Migración 389 persiste stars_earned y stolen_gems en clan_war_attacks', () => {
    const mig389Path = path.resolve(__dirname, '../../../supabase/migrations/389-fix-clan-fortress-pvp-and-raid-history.sql')
    const mig389Sql = fs.readFileSync(mig389Path, 'utf8')

    expect(mig389Sql).toMatch(/INSERT\s+INTO\s+public\.clan_war_attacks[\s\S]*?stars_earned[\s\S]*?stolen_gems/i)
    expect(mig389Sql).toContain('p_stars_earned')
  })

  it('11. Clan.css habilita scroll vertical fluido en .clan-raids-history-pane', () => {
    const clanCssPath = path.resolve(__dirname, 'Clan.css')
    const clanCss = fs.readFileSync(clanCssPath, 'utf8')

    // Verificar que .clan-raids-history-pane posea flex: 1, min-height: 0 y overflow-y: auto
    const paneMatch = clanCss.match(/\.clan-raids-history-pane\s*\{([^}]+)\}/)
    expect(paneMatch).toBeTruthy()
    const paneCss = paneMatch![1]

    expect(paneCss).toContain('flex: 1;')
    expect(paneCss).toContain('min-height: 0;')
    expect(paneCss).toContain('overflow-y: auto;')
    expect(paneCss).toContain('-webkit-overflow-scrolling: touch;')
  })

  it('12. Modal de Cofre de Clan (Gacha) tiene caras alineadas y no se desplaza fuera de pantalla', () => {
    const clanCssPath = path.resolve(__dirname, 'Clan.css')
    const clanCss = fs.readFileSync(clanCssPath, 'utf8')

    // 1. .clan-gacha-card-face debe tener position: absolute, top: 0, left: 0
    const faceMatch = clanCss.match(/\.clan-gacha-card-face\s*\{([^}]+)\}/)
    expect(faceMatch).toBeTruthy()
    const faceCss = faceMatch![1]
    expect(faceCss).toContain('position: absolute;')
    expect(faceCss).toContain('top: 0;')
    expect(faceCss).toContain('left: 0;')
    expect(faceCss).toContain('backface-visibility: hidden;')

    // 2. .clan-gacha-card-face--back NO debe tener position: relative (que empujaba la cara frontal 350px abajo)
    const backMatch = clanCss.match(/\.clan-gacha-card-face--back\s*\{([^}]+)\}/)
    expect(backMatch).toBeTruthy()
    const backCss = backMatch![1]
    expect(backCss).not.toContain('position: relative;')
    expect(backCss).toContain('rotateY(0deg)')

    // 3. .clan-gacha-card-face--front debe tener transform: rotateY(180deg)
    const frontMatch = clanCss.match(/\.clan-gacha-card-face--front\s*\{([^}]+)\}/)
    expect(frontMatch).toBeTruthy()
    const frontCss = frontMatch![1]
    expect(frontCss).toContain('rotateY(180deg)')

    // 4. Modal box debe tener max-height y overflow-y: auto para pantallas pequeñas
    const modalMatch = clanCss.match(/\.clan-gacha-modal-box\s*\{([^}]+)\}/)
    expect(modalMatch).toBeTruthy()
    const modalCss = modalMatch![1]
    expect(modalCss).toContain('max-height: 94vh;')
    expect(modalCss).toContain('overflow-y: auto;')
  })
})
