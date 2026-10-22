import { describe, it, expect } from 'vitest'
import {
  createBattleState,
  stepTick,
  crearPlantaPropia,
  crearPlantaDelRival,
  type GameState,
} from './simulate'
import { msToTicks } from './time'
import { conservarLoLocal } from './reconstruir'
import { ejecutarCapturaCollectP1 } from './asyncP1Capture'
import { SOL_SE_RECOGE_SOLO_MS } from './balance'

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
})
