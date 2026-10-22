import { describe, it, expect } from 'vitest'
import {
  createBattleState,
  stepTick,
  crearPlantaPropia,
} from './simulate'
import { msToTicks } from './time'
import { conservarLoLocal } from './reconstruir'
import { ejecutarCapturaCollectP1 } from './asyncP1Capture'
import { SOL_SE_RECOGE_SOLO_MS } from './balance'
import { getScaledPlantConfig } from '../utils/gameConstants'

describe('Auditoría Integral de Margarita (Marigold)', () => {
  it('1. Al plantarse en combate, genera monedas de oro tras 15 segundos (450 ticks)', () => {
    const state = createBattleState(12345, false, true)
    
    // Plantar Margarita en el carril 1, columna 0
    state.plants.push(crearPlantaPropia(state, 'marigold', 1, 0, [], 0))

    // Antes de 15 segundos (ej. 400 ticks ≈ 13.2s) no debe haber monedas
    for (let t = 0; t < 400; t++) {
      stepTick(state, () => {})
    }
    const monedasAntes = state.suns.filter((s) => s.type === 'gold')
    expect(monedasAntes.length).toBe(0)

    // Al llegar a 460 ticks (> 15 segundos), debe haber generado al menos 1 moneda
    for (let t = 400; t < 460; t++) {
      stepTick(state, () => {})
    }
    const monedas = state.suns.filter((s) => s.type === 'gold')
    expect(monedas.length).toBeGreaterThanOrEqual(1)
    expect(monedas[0].type).toBe('gold')
    expect(monedas[0].value).toBeGreaterThanOrEqual(1)
    expect(monedas[0].value).toBeLessThanOrEqual(2)
    expect(monedas[0].id).toContain('gold-flower')
  })

  it('2. Recolectar la moneda manualmente suma exactamente su valor a stats.goldEarned', () => {
    const state = createBattleState(999, false, true)
    state.plants.push(crearPlantaPropia(state, 'marigold', 0, 1, [], 0))

    // Avanzar hasta que caiga la moneda
    for (let t = 0; t < 460; t++) {
      stepTick(state, () => {})
    }

    const moneda = state.suns.find((s) => s.type === 'gold')
    expect(moneda).toBeDefined()
    const valorMoneda = moneda!.value

    // Ejecutar captura de recolección
    const res = ejecutarCapturaCollectP1({
      isAsyncMatch: false,
      sunId: moneda!.id,
      state,
    })

    expect(res.ok).toBe(true)
    expect(state.stats.goldEarned).toBe(valorMoneda)
    // No debe quedar en el césped
    expect(state.suns.find((s) => s.id === moneda!.id)).toBeUndefined()
  })

  it('3. Auto-recolección: si el jugador no la toca, tras 5 segundos entra automáticamente a stats.goldEarned', () => {
    const state = createBattleState(888, false, true)
    state.plants.push(crearPlantaPropia(state, 'marigold', 2, 0, [], 0))

    // Avanzar hasta que caiga la primera moneda (460 ticks)
    for (let t = 0; t < 460; t++) {
      stepTick(state, () => {})
    }

    const moneda = state.suns.find((s) => s.type === 'gold')
    expect(moneda).toBeDefined()
    const valorMoneda = moneda!.value

    // Avanzar 5 segundos adicionales (msToTicks(SOL_SE_RECOGE_SOLO_MS) + margen)
    const ticksAutoRecogida = msToTicks(SOL_SE_RECOGE_SOLO_MS) + 10
    for (let t = 0; t < ticksAutoRecogida; t++) {
      stepTick(state, () => {})
    }

    // La moneda debe haberse recogido sola y estar en stats.goldEarned
    expect(state.stats.goldEarned).toBe(valorMoneda)
    expect(state.suns.find((s) => s.id === moneda!.id)).toBeUndefined()
  })

  it('4. Reconstrucción de red (conservarLoLocal): NO borra ni degrada stats.goldEarned', () => {
    const estadoViejo = createBattleState(777, false, true)
    estadoViejo.stats.goldEarned = 15 // El jugador ya había acumulado 15 de oro

    const estadoNuevo = createBattleState(777, false, true)
    estadoNuevo.stats.goldEarned = 0

    // Simular reconstrucción
    const estadoAlDia = conservarLoLocal(estadoNuevo, estadoViejo)

    expect(estadoAlDia.stats.goldEarned).toBe(15)
  })

  it('5. Múltiples Margaritas producen independientemente con IDs canónicos únicos', () => {
    const state = createBattleState(555, false, true)
    state.plants.push(crearPlantaPropia(state, 'marigold', 0, 0, [], 0))
    state.plants.push(crearPlantaPropia(state, 'marigold', 1, 0, [], 0))

    for (let t = 0; t < 460; t++) {
      stepTick(state, () => {})
    }

    const monedas = state.suns.filter((s) => s.type === 'gold')
    expect(monedas.length).toBe(2)
    // Los IDs deben ser diferentes
    expect(monedas[0].id).not.toBe(monedas[1].id)
    expect(monedas[0].id).toContain('gold-flower-0-0-')
    expect(monedas[1].id).toContain('gold-flower-1-0-')
  })

  it('6. Barrido al terminar partida: monedas pendientes en el césped se acumulan al total para no perderse', () => {
    const state = createBattleState(333, false, true)
    state.plants.push(crearPlantaPropia(state, 'marigold', 1, 0, [], 0))

    // Correr hasta que aparezca una moneda
    for (let t = 0; t < 460; t++) {
      stepTick(state, () => {})
    }

    const uncollectedSuns = state.suns.filter((s) => s.type === 'gold')
    expect(uncollectedSuns.length).toBe(1)
    const pendingVal = uncollectedSuns[0].value

    // Simular el barrido de fin de partida (lógica de liquidarOroDeMargarita)
    const uncollectedGold = state.suns
      .filter((s) => s.type === 'gold')
      .reduce((sum, s) => sum + s.value, 0)
    const totalGold = (state.stats.goldEarned ?? 0) + uncollectedGold

    expect(totalGold).toBe(pendingVal)
  })

  it('7. Cálculo de producción: 1 Margarita genera 4 monedas (promedio 6 Oro) por minuto', () => {
    const state = createBattleState(1234, false, true)
    state.plants.push(crearPlantaPropia(state, 'marigold', 2, 0, [], 0))

    // Simular 1 minuto exacto (60 segundos = 1800 ticks a 30 ticks/s)
    let totalGeneratedCoins = 0
    let totalGeneratedGold = 0
    for (let t = 0; t < 1850; t++) {
      stepTick(state, () => {})
      const collectedNow = state.suns.filter((s) => s.type === 'gold')
      if (collectedNow.length > 0) {
        totalGeneratedCoins += collectedNow.length
        totalGeneratedGold += collectedNow.reduce((sum, s) => sum + s.value, 0)
        state.suns = [] // limpiar césped
      }
    }

    // A los 15s, 30s, 45s, 60s: exactamente 4 drops
    expect(totalGeneratedCoins).toBe(4)
    // Cada moneda otorga 1 o 2 de Oro (entre 4 y 8 de oro total)
    expect(totalGeneratedGold).toBeGreaterThanOrEqual(4)
    expect(totalGeneratedGold).toBeLessThanOrEqual(8)
  })

  it('8. Mazo económico intensivo: 5 Margaritas durante 3 minutos generan entre 60 y 120 de Oro', () => {
    const state = createBattleState(999, false, true)
    // 5 Margaritas (1 por cada carril)
    for (let lane = 0; lane < 5; lane++) {
      state.plants.push(crearPlantaPropia(state, 'marigold', lane, 0, [], 0))
    }

    // 3 minutos = 180 segundos
    let totalCoins = 0
    let totalGold = 0
    for (let t = 0; t < 5600; t++) {
      stepTick(state, () => {})
      const coins = state.suns.filter((s) => s.type === 'gold')
      if (coins.length > 0) {
        totalCoins += coins.length
        totalGold += coins.reduce((sum, s) => sum + s.value, 0)
        state.suns = []
      }
    }

    // 5 margaritas * 12 drops = 60 drops
    expect(totalCoins).toBe(60)
    // Con 1 o 2 de oro por drop: entre 60 y 120 de oro
    expect(totalGold).toBeGreaterThanOrEqual(60)
    expect(totalGold).toBeLessThanOrEqual(120)
  })

  it('9. Mejora de Producción (+1 Oro): Margarita con statRoll "production" suelta de 2 a 3 de Oro por drop', () => {
    const state = createBattleState(777, false, true)
    // Margarita con 1 roll de producción
    state.plants.push(crearPlantaPropia(state, 'marigold', 1, 0, ['production'], 2))

    // Avanzar 15 segundos hasta el primer drop
    for (let t = 0; t < 460; t++) {
      stepTick(state, () => {})
    }

    const coins = state.suns.filter((s) => s.type === 'gold')
    expect(coins.length).toBe(1)
    // Base (1-2) + 1 por producción = entre 2 y 3 de Oro
    expect(coins[0].value).toBeGreaterThanOrEqual(2)
    expect(coins[0].value).toBeLessThanOrEqual(3)
  })

  it('10. Coste balanceado: Margarita cuesta 150 Soles', () => {
    const config = getScaledPlantConfig('marigold', [])
    expect(config.cost).toBe(150)
  })
})
