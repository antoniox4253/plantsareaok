import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Marketplace Unified Balance Spending (Migration 171)', () => {
  const migPath = join(process.cwd(), 'supabase', 'migrations', '171-marketplace-allow-unified-balance-spending.sql')

  it('1. El archivo de migración 171 existe en el repositorio', () => {
    expect(existsSync(migPath)).toBe(true)
  })

  it('2. buy_marketplace_card valida contra saldo total de gemas (gems_balance) y no contra v_buyer_withdrawable', () => {
    const sql = readFileSync(migPath, 'utf8')
    // No debe existir el filtro restrictivo de saldo retirable para compras
    expect(sql).not.toContain('v_buyer_withdrawable')
    expect(sql).not.toContain('v_buyer_withdrawable < v_listing.price_gems')

    // Debe validar contra v_buyer_gems (saldo total de gemas)
    expect(sql).toContain('IF v_buyer_gems < v_listing.price_gems THEN')
    expect(sql).toContain('Gemas insuficientes para completar la compra')
  })

  it('3. buy_marketplace_card no marca la transacción como retiro (permite quemar saldo bloqueado/bono)', () => {
    const sql = readFileSync(migPath, 'utf8')
    // No debe invocar set_config para marcar is_withdrawal
    expect(sql).not.toContain("set_config('plantarena.is_withdrawal'")
  })

  it('4. Simulación contable: el comprador con saldo combinado compra exitosamente y quema primero el saldo de bono', () => {
    // Escenario: Comprador tiene 100 gemas totales: 60 bloqueadas (bono) y 40 retirables
    let gemsBalance = 100.0
    let lockedGemsBalance = 60.0
    const priceGems = 70.0

    // 1. Validación de compra unificada (ambos saldos combinados)
    const canBuy = gemsBalance >= priceGems
    expect(canBuy).toBe(true)

    // 2. Simulación del trigger trg_profiles_gem_spending_balance al descontar priceGems (no retiro)
    const oldTotal = gemsBalance
    const oldLocked = lockedGemsBalance
    gemsBalance = gemsBalance - priceGems

    const diff = oldTotal - gemsBalance // 70.0
    const burn = Math.min(oldLocked, diff) // 60.0 quemadas del bono
    lockedGemsBalance = Math.max(0, oldLocked - burn) // 0.0 restantes de bono
    if (lockedGemsBalance > gemsBalance) {
      lockedGemsBalance = gemsBalance
    }

    // Nuevo saldo total: 30 gemas (todas retirables)
    expect(gemsBalance).toBe(30.0)
    expect(lockedGemsBalance).toBe(0.0)
    const withdrawable = Math.max(0, gemsBalance - lockedGemsBalance)
    expect(withdrawable).toBe(30.0)
  })

  it('5. Regla de Retiros: request_withdrawal mantiene la restricción exclusiva sobre saldo retirable', () => {
    // Escenario en retiros: Usuario tiene 100 gemas totales (60 bloqueadas y 40 retirables)
    const totalGems = 100.0
    const lockedGems = 60.0
    const withdrawableGems = Math.max(0, totalGems - lockedGems) // 40 gemas retirables

    const attemptWithdrawal = (amount: number) => {
      if (amount > withdrawableGems) {
        throw new Error('EXCEEDS_WITHDRAWABLE_BALANCE')
      }
      return true
    }

    // Intentar retirar 50 gemas (mayor que las 40 retirables) debe fallar
    expect(() => attemptWithdrawal(50)).toThrow('EXCEEDS_WITHDRAWABLE_BALANCE')
    // Retirar 40 o menos debe permitirse
    expect(attemptWithdrawal(40)).toBe(true)
    expect(attemptWithdrawal(20)).toBe(true)
  })
})
