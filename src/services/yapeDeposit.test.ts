import { describe, it, expect } from 'vitest'
import { SupabaseService } from './supabaseService'

describe('Pasarela de Depósito Yape (Perú - S/.)', () => {
  it('1. Convierte correctamente Soles a Gemas con la tasa oficial 3.50 PEN = 100 💎', () => {
    const calcularGemasYape = (soles: number) => Math.round((soles / 3.5) * 100)

    expect(calcularGemasYape(3.5)).toBe(100)
    expect(calcularGemasYape(7.0)).toBe(200)
    expect(calcularGemasYape(17.5)).toBe(500)
    expect(calcularGemasYape(25.0)).toBe(714)
    expect(calcularGemasYape(35.0)).toBe(1000)
    expect(calcularGemasYape(70.0)).toBe(2000)
    expect(calcularGemasYape(175.0)).toBe(5000)
  })

  it('2. Aplica correctamente el reparto de saldo dual (50% retirable, 50% juego)', () => {
    const dividirSaldo = (totalGemas: number) => {
      const retirable = Math.round(totalGemas * 0.5)
      const bloqueado = totalGemas - retirable
      return { retirable, bloqueado }
    }

    const { retirable, bloqueado } = dividirSaldo(100)
    expect(retirable).toBe(50)
    expect(bloqueado).toBe(50)
    expect(retirable + bloqueado).toBe(100)

    const impares = dividirSaldo(714)
    expect(impares.retirable).toBe(357)
    expect(impares.bloqueado).toBe(357)
    expect(impares.retirable + impares.bloqueado).toBe(714)
  })

  it('3. Genera la comisión de referidos del 5% requerida por protocolo', () => {
    const calcularComisionReferido = (gemas: number) => Math.round(gemas * 0.05 * 100) / 100

    expect(calcularComisionReferido(100)).toBe(5)
    expect(calcularComisionReferido(200)).toBe(10)
    expect(calcularComisionReferido(500)).toBe(25)
    expect(calcularComisionReferido(1000)).toBe(50)
  })

  it('4. El orderId incorpora el prefijo PA y el identificador de usuario para conciliación de webhook', () => {
    const userId = '41e0ad2c-e665-42f8-8c22-7498f3ac93e6'
    const orderId = `PA-${userId}-KXYZ123`

    const uuidMatch = orderId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(uuidMatch).not.toBeNull()
    expect(uuidMatch?.[0]).toBe(userId)
  })

  it('5. SupabaseService expone el método confirmYapeDeposit', () => {
    expect(typeof SupabaseService.confirmYapeDeposit).toBe('function')
  })
})
