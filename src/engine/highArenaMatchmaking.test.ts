import { describe, it, expect } from 'vitest'
import { RANKED_MATCHMAKING_TIMEOUT_SECONDS } from '../utils/gameConstants'

/**
 * Simulación pura de la lógica canónica de _emparejar_lote (Migración 185)
 */
function simularCriterioEmparejamiento(
  p1Elo: number,
  p2Elo: number,
  waitedSeconds: number,
  lastMatchMinutesAgo?: number
): { matched: boolean; reason?: string } {
  // 1. Cooldown de revancha: 45 minutos (Migración 196)
  const COOLDOWN_MINUTOS = 45
  if (lastMatchMinutesAgo !== undefined && lastMatchMinutesAgo < COOLDOWN_MINUTOS) {
    return { matched: false, reason: 'cooldown_activo' }
  }

  // 2. Parámetros de banda para novatos
  const v_inicio = 150
  const v_paso = 75
  const v_cada = 15
  const v_tope = 1200
  const bandaNovatos = Math.min(v_tope, v_inicio + v_paso * Math.floor(waitedSeconds / v_cada))

  const eloDiff = Math.abs(p1Elo - p2Elo)

  // REGLA 1: ARENA 5 (Olimpo de Leyendas - 4001+ copas):
  // Cualquier jugador de Arena 5 puede jugar contra cualquier otro de Arena 5
  if (p1Elo > 4000 && p2Elo > 4000) {
    return { matched: true, reason: 'arena_5_todos_contra_todos' }
  }

  // REGLA 2: ARENA 4 (Coliseo Galáctico - 3001 a 4000 copas):
  // Banda arranca en al menos 700 copas
  if ((p1Elo >= 3001 && p1Elo <= 4000) || (p2Elo >= 3001 && p2Elo <= 4000)) {
    const bandaA4 = Math.max(700, bandaNovatos)
    if (eloDiff <= bandaA4) {
      return { matched: true, reason: 'arena_4_banda_700' }
    }
    return { matched: false, reason: 'fuera_de_banda_arena_4' }
  }

  // REGLA 3: ARENAS 1 A 3 (0 a 3000 copas):
  // Banda progresiva protegida para novatos
  if (eloDiff <= bandaNovatos) {
    return { matched: true, reason: 'arenas_bajas_banda_estandar' }
  }

  return { matched: false, reason: 'fuera_de_banda_estandar' }
}

describe('Emparejamiento Optimizado en Arenas 4 y 5', () => {
  it('1. Arena 5: Dos jugadores con gran disparidad de ELO (ej. 4,127 vs 8,751) emparejan de inmediato', () => {
    const res = simularCriterioEmparejamiento(8751, 4127, 2)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_5_todos_contra_todos')
  })

  it('2. Arena 5: Rjnieves (7,647) y Dagger22 (7,277) emparejan a los 0 segundos', () => {
    const res = simularCriterioEmparejamiento(7647, 7277, 0)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_5_todos_contra_todos')
  })

  it('3. Arena 4: Jugador con 3,300 empareja con jugador de 3,950 (+650 copas) en el primer segundo', () => {
    const res = simularCriterioEmparejamiento(3300, 3950, 1)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_4_banda_700')
  })

  it('4. Arena 4: Jugador de Arena 4 (3,900) empareja con un jugador que acaba de entrar a Arena 5 (4,200) (diff 300 <= 700)', () => {
    const res = simularCriterioEmparejamiento(3900, 4200, 2)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_4_banda_700')
  })

  it('5. Arenas Bajas: Un novato de 1,200 NO empareja con un jugador de 1,900 (+700 diff rechazada en novatos)', () => {
    const res = simularCriterioEmparejamiento(1200, 1900, 5)
    expect(res.matched).toBe(false)
    expect(res.reason).toBe('fuera_de_banda_estandar')
  })

  it('6. Cooldown de revancha: Bloquea si jugaron hace menos de 45 minutos (ej. 30 min), pero permite si pasaron 45 minutos', () => {
    const resBloqueado = simularCriterioEmparejamiento(5000, 5200, 10, 30)
    expect(resBloqueado.matched).toBe(false)
    expect(resBloqueado.reason).toBe('cooldown_activo')

    const resPermitido = simularCriterioEmparejamiento(5000, 5200, 10, 45.5)
    expect(resPermitido.matched).toBe(true)
  })

  it('7. Timeout de Ranked es 35 segundos exactos', () => {
    expect(RANKED_MATCHMAKING_TIMEOUT_SECONDS).toBe(35)
  })
})
