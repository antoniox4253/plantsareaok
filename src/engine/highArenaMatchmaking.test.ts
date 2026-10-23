import { describe, it, expect } from 'vitest'
import { RANKED_MATCHMAKING_TIMEOUT_SECONDS } from '../utils/gameConstants'

/**
 * Simulación pura de la lógica canónica de _emparejar_lote (Migración 351)
 */
function simularCriterioEmparejamiento(
  p1Elo: number,
  p2Elo: number,
  waitedSeconds: number,
  lastMatchMinutesAgo?: number,
  lastMatchHadDisconnect?: boolean
): { matched: boolean; reason?: string } {
  // 1. Blindaje de 30 minutos ante desconexión, abandono o forfeit previo
  if (lastMatchHadDisconnect && lastMatchMinutesAgo !== undefined && lastMatchMinutesAgo < 30) {
    return { matched: false, reason: 'cooldown_desconexion_30m' }
  }

  // 2. Cooldown base de 10 minutos para partidas normales en todas las arenas (Migración 366)
  const cooldownMinutos = 10
  if (lastMatchMinutesAgo !== undefined && lastMatchMinutesAgo < cooldownMinutos) {
    return { matched: false, reason: 'cooldown_activo' }
  }

  // 3. Parámetros de banda para novatos
  const v_inicio = 150
  const v_paso = 75
  const v_cada = 15
  const v_tope = 1200
  const bandaNovatos = Math.min(v_tope, v_inicio + v_paso * Math.floor(waitedSeconds / v_cada))

  const eloDiff = Math.abs(p1Elo - p2Elo)

  // REGLA 1: ARENA 5 (Olimpo de Leyendas - 4001+ copas):
  // Cualquier jugador de Arena 5 puede jugar contra cualquier otro de Arena 5 sin límite de ELO
  if (p1Elo > 4000 && p2Elo > 4000) {
    return { matched: true, reason: 'arena_5_todos_contra_todos' }
  }

  // REGLA 2: ARENA 4 (Coliseo Galáctico - 3001 a 4000 copas):
  // Cualquier jugador de Arena 4 puede jugar contra cualquier otro de Arena 4 sin límite de ELO
  if (p1Elo >= 3001 && p1Elo <= 4000 && p2Elo >= 3001 && p2Elo <= 4000) {
    return { matched: true, reason: 'arena_4_todos_contra_todos' }
  }

  // REGLA 3: Frontera Arenas Altas (Ambos > 3000):
  // Cruce permitido si llevan esperando >= 10s
  if (p1Elo > 3000 && p2Elo > 3000 && waitedSeconds >= 10) {
    return { matched: true, reason: 'arena_alta_cruce' }
  }

  // REGLA 4: ARENAS 1 A 3 (0 a 3000 copas):
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

  it('3. Arena 4: Jugador con 3,100 empareja con jugador de 3,950 (+850 copas) en Arena 4 sin límite de ELO', () => {
    const res = simularCriterioEmparejamiento(3100, 3950, 1)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_4_todos_contra_todos')
  })

  it('4. Arenas Altas: Jugador de Arena 4 (3,900) empareja con jugador de Arena 5 (4,200) tras 10s', () => {
    const res = simularCriterioEmparejamiento(3900, 4200, 10)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_alta_cruce')
  })

  it('5. Arenas Bajas: Un novato de 1,200 NO empareja con un jugador de 1,900 (+700 diff rechazada en novatos)', () => {
    const res = simularCriterioEmparejamiento(1200, 1900, 5)
    expect(res.matched).toBe(false)
    expect(res.reason).toBe('fuera_de_banda_estandar')
  })

  it('6. Cooldown de revancha (Migración 366): Bloquea si hace < 10 min (ej. 5 min), permite tras 10 min (ej. 11 min)', () => {
    const resBloqueado = simularCriterioEmparejamiento(5000, 5200, 10, 5)
    expect(resBloqueado.matched).toBe(false)
    expect(resBloqueado.reason).toBe('cooldown_activo')

    const resPermitido = simularCriterioEmparejamiento(5000, 5200, 10, 11)
    expect(resPermitido.matched).toBe(true)
  })

  it('7. Blindaje contra desconexión (Migración 366): Bloquea por 30 minutos si la última partida terminó en desconexión', () => {
    // A los 15 minutos (que ya superó el cooldown base de 10m), sigue bloqueado por haber sido desconexión
    const resDesconexionBloqueado = simularCriterioEmparejamiento(5000, 5200, 10, 15, true)
    expect(resDesconexionBloqueado.matched).toBe(false)
    expect(resDesconexionBloqueado.reason).toBe('cooldown_desconexion_30m')

    // Tras 31 minutos, se levanta el bloqueo incluso tras desconexión
    const resDesconexionPermitido = simularCriterioEmparejamiento(5000, 5200, 10, 31, true)
    expect(resDesconexionPermitido.matched).toBe(true)
  })

  it('8. Timeout de Ranked es 45 segundos según Migración 321', () => {
    expect(RANKED_MATCHMAKING_TIMEOUT_SECONDS).toBe(45)
  })
})
