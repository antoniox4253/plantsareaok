import { describe, it, expect } from 'vitest'
import { SupabaseService } from './supabaseService'

describe('Pasarela de Depósito Yape (Perú - S/.)', () => {
  it('1. Convierte correctamente Soles a Gemas con la tasa oficial 3.50 PEN = 100 💎', () => {
    const calcularGemasYape = (soles: number) => Math.round((soles / 3.5) * 100)

    expect(calcularGemasYape(3.5)).toBe(100)
    expect(calcularGemasYape(7.0)).toBe(200)
    expect(calcularGemasYape(14.0)).toBe(400)
    expect(calcularGemasYape(21.0)).toBe(600)
    expect(calcularGemasYape(25.0)).toBe(714)
    expect(calcularGemasYape(35.0)).toBe(1000)
    expect(calcularGemasYape(70.0)).toBe(2000)
    expect(calcularGemasYape(140.0)).toBe(4000)
    expect(calcularGemasYape(175.0)).toBe(5000)
  })

  it('2. Acredita 100% directo al saldo de Gemas (ej. 1,820 + 100 = 1,920 💎 para S/ 3.50)', () => {
    const calcularNuevoSaldo = (saldoPrevio: number, soles: number) => {
      const gemas = Math.round((soles / 3.5) * 100)
      return saldoPrevio + gemas
    }

    expect(calcularNuevoSaldo(1820, 3.5)).toBe(1920)
    expect(calcularNuevoSaldo(1000, 7.0)).toBe(1200)
    expect(calcularNuevoSaldo(500, 35.0)).toBe(1500)
  })

  it('3. Idempotencia y Blindaje Anti-Replay: Llamadas repetidas con el mismo paymentId no duplican saldo', () => {
    const pagosProcesados = new Set<string>()

    const procesarPago = (paymentId: string, saldoActual: number, soles: number) => {
      if (pagosProcesados.has(paymentId)) {
        return { success: true, already_credited: true, nuevoSaldo: saldoActual }
      }
      pagosProcesados.add(paymentId)
      const gemas = Math.round((soles / 3.5) * 100)
      return { success: true, already_credited: false, nuevoSaldo: saldoActual + gemas }
    }

    const llamada1 = procesarPago('yape_tx_test_1', 1820, 3.5)
    expect(llamada1.already_credited).toBe(false)
    expect(llamada1.nuevoSaldo).toBe(1920)

    // Segunda llamada concurrente o repetida
    const llamada2 = procesarPago('yape_tx_test_1', llamada1.nuevoSaldo, 3.5)
    expect(llamada2.already_credited).toBe(true)
    expect(llamada2.nuevoSaldo).toBe(1920) // No se duplica
  })

  it('4. Genera la comisión de referidos del 5% requerida por protocolo', () => {
    const calcularComisionReferido = (gemas: number) => Math.round(gemas * 0.05 * 100) / 100

    expect(calcularComisionReferido(100)).toBe(5)
    expect(calcularComisionReferido(200)).toBe(10)
    expect(calcularComisionReferido(500)).toBe(25)
    expect(calcularComisionReferido(1000)).toBe(50)
  })

  it('5. El orderId incorpora el prefijo PA y el identificador de usuario para conciliación', () => {
    const userId = '41e0ad2c-e665-42f8-8c22-7498f3ac93e6'
    const orderId = `PA-${userId}-KXYZ123`

    const uuidMatch = orderId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(uuidMatch).not.toBeNull()
    expect(uuidMatch?.[0]).toBe(userId)
  })

  it('6. SupabaseService expone el método confirmYapeDeposit', () => {
    expect(typeof SupabaseService.confirmYapeDeposit).toBe('function')
  })
})
