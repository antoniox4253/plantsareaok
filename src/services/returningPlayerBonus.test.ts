import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Returning Inactive Accounts (Churn Reset & 30% Bonus)', () => {
  const migration326Path = path.resolve(__dirname, '../../supabase/migrations/326-returning-player-reset-and-30pct-bonus.sql')

  it('1. Migración 326 existe y agrega columnas is_returning_churn y returning_bonus_available', () => {
    expect(fs.existsSync(migration326Path)).toBe(true)
    const sql = fs.readFileSync(migration326Path, 'utf8')
    expect(sql).toContain('is_returning_churn')
    expect(sql).toContain('returning_bonus_available')
    expect(sql).toContain('returning_bonus_used_at')
  })

  it('2. Migración 326 elimina plant_instances, plant_copies y pack_slots de cuentas de retorno', () => {
    const sql = fs.readFileSync(migration326Path, 'utf8')
    expect(sql).toMatch(/DELETE FROM public\.plant_instances\s+WHERE owner_id IN/i)
    expect(sql).toMatch(/DELETE FROM public\.plant_copies\s+WHERE user_id IN/i)
    expect(sql).toMatch(/DELETE FROM public\.pack_slots\s+WHERE user_id IN/i)
    expect(sql).toMatch(/DELETE FROM public\.player_packs\s+WHERE user_id IN/i)
  })

  it('3. get_deposit_info() otorga 30% de bono a usuarios con returning_bonus_available', () => {
    const sql = fs.readFileSync(migration326Path, 'utf8')
    expect(sql).toContain('IF v_is_ret_bonus = TRUE THEN')
    expect(sql).toContain('v_bonus_pct := 30.00;')
    expect(sql).toContain("'returningBonus', v_is_ret_bonus")
  })

  it('4. process_verified_deposit() acredita el 30% de bono extra y consume returning_bonus_available', () => {
    const sql = fs.readFileSync(migration326Path, 'utf8')
    expect(sql).toContain('v_bonus_pct := 30.00;')
    expect(sql).toContain('returning_bonus_available = FALSE')
    expect(sql).toContain('returning_bonus_used_at = NOW()')
    expect(sql).toContain('Bono Exclusivo por Regresar 30%')
  })

  it('5. my_balance() proyecta is_returning_churn, returning_bonus_available y has_purchased_starter_pack', () => {
    const sql = fs.readFileSync(migration326Path, 'utf8')
    expect(sql).toContain("'is_returning_churn', COALESCE(r.is_returning_churn, FALSE)")
    expect(sql).toContain("'returning_bonus_available', COALESCE(r.returning_bonus_available, FALSE)")
    expect(sql).toContain("'has_purchased_starter_pack', COALESCE(r.has_purchased_starter_pack, FALSE)")
  })

  it('6. MainMenu contiene el banner exclusivo para usuarios de retorno con el texto exacto solicitado', () => {
    const mainMenuPath = path.resolve(__dirname, '../components/MainMenu/MainMenu.tsx')
    const content = fs.readFileSync(mainMenuPath, 'utf8')
    expect(content).toContain('Por regresar cuentas con un 30% en tu primera compra')
    expect(content).toContain('isReturningUser')
    expect(content).toContain('bosque-clean-banner__title--returning')
    expect(content).toContain('setProfileInitialTab(\'deposit\')')
  })

  it('7. BosqueRenovado.css contiene las clases de estilo optimizadas para el header', () => {
    const cssPath = path.resolve(__dirname, '../components/MainMenu/BosqueRenovado.css')
    const css = fs.readFileSync(cssPath, 'utf8')
    expect(css).toContain('.bosque-clean-banner__icon-wrap--returning')
    expect(css).toContain('.bosque-clean-banner__badge--returning')
    expect(css).toContain('.bosque-clean-banner__tag--returning')
    expect(css).toContain('.bosque-clean-banner__title--returning')
    expect(css).toContain('text-overflow: ellipsis')
  })

  it('8. useInventory resetea mazo y plantas si el usuario es returning churn sin starter pack', () => {
    const invPath = path.resolve(__dirname, '../hooks/useInventory.ts')
    const content = fs.readFileSync(invPath, 'utf8')
    expect(content).toContain('(profile as any).is_returning_churn && !(profile as any).has_purchased_starter_pack')
    expect(content).toContain('setPlantInstances([])')
    expect(content).toContain('setActiveDeck([])')
  })
})
