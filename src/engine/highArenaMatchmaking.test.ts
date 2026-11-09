import { describe, it, expect } from 'vitest'
import { RANKED_MATCHMAKING_TIMEOUT_SECONDS } from '../utils/gameConstants'

/**
 * Simulación pura de la lógica canónica de _emparejar_lote (Migración 411)
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

  // REGLA 1: ARENA 5 (Olimpo de Leyendas - 8001+ copas):
  // Cualquier jugador de Arena 5 puede jugar contra cualquier otro de Arena 5 sin límite de ELO
  if (p1Elo > 8000 && p2Elo > 8000) {
    return { matched: true, reason: 'arena_5_todos_contra_todos' }
  }

  // REGLA 2: ARENA 4 (Coliseo Galáctico - 5001 a 8000 copas):
  // Cualquier jugador de Arena 4 puede jugar contra cualquier otro de Arena 4 sin límite de ELO
  if (p1Elo >= 5001 && p1Elo <= 8000 && p2Elo >= 5001 && p2Elo <= 8000) {
    return { matched: true, reason: 'arena_4_todos_contra_todos' }
  }

  // REGLA 3: Frontera Arenas Altas (Ambos > 5000 copas):
  // Cruce permitido si llevan esperando >= 10s
  if (p1Elo > 5000 && p2Elo > 5000 && waitedSeconds >= 10) {
    return { matched: true, reason: 'arena_alta_cruce' }
  }

  // REGLA 4: ARENAS BAJAS (0 a 5000 copas - Migración 411):
  // Ambos DEBEN ser <= 5000 copas
  if (p1Elo <= 5000 && p2Elo <= 5000) {
    // Blindaje Arena 1: NUNCA cruzar Arena 1 (<= 1600) con Arena 3+ (> 3000)
    if ((p1Elo <= 1600 && p2Elo > 3000) || (p2Elo <= 1600 && p1Elo > 3000)) {
      return { matched: false, reason: 'frontera_arena_1_arena_3_bloqueada' }
    }
    // Banda progresiva protegida para arenas bajas
    if (eloDiff <= bandaNovatos) {
      return { matched: true, reason: 'arenas_bajas_banda_estandar' }
    }
  }

  return { matched: false, reason: 'fuera_de_banda_estandar' }
}

describe('Emparejamiento Optimizado en Arenas 4 y 5 (Calibración Temporada 3+)', () => {
  it('1. Arena 5: Dos jugadores con gran disparidad de ELO (ej. 8,200 vs 15,000) emparejan de inmediato', () => {
    const res = simularCriterioEmparejamiento(15000, 8200, 2)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_5_todos_contra_todos')
  })

  it('2. Arena 5: Dos titanes (8,500 y 9,200) emparejan a los 0 segundos', () => {
    const res = simularCriterioEmparejamiento(8500, 9200, 0)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_5_todos_contra_todos')
  })

  it('3. Arena 4: Jugador con 5,200 empareja con jugador de 7,800 (+2600 copas) en Arena 4 sin límite de ELO', () => {
    const res = simularCriterioEmparejamiento(5200, 7800, 1)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_4_todos_contra_todos')
  })

  it('4. Arenas Altas: Jugador de Arena 4 (7,900) empareja con jugador de Arena 5 (8,300) tras 10s', () => {
    const res = simularCriterioEmparejamiento(7900, 8300, 10)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arena_alta_cruce')
  })

  it('5. Arenas Bajas: Un novato de 1,200 NO empareja con un jugador de 2,200 (+1000 diff rechazada en novatos)', () => {
    const res = simularCriterioEmparejamiento(1200, 2200, 5)
    expect(res.matched).toBe(false)
    expect(res.reason).toBe('fuera_de_banda_estandar')
  })

  it('6. Cooldown de revancha (Migración 366): Bloquea si hace < 10 min (ej. 5 min), permite tras 10 min (ej. 11 min)', () => {
    const resBloqueado = simularCriterioEmparejamiento(5500, 5700, 10, 5)
    expect(resBloqueado.matched).toBe(false)
    expect(resBloqueado.reason).toBe('cooldown_activo')

    const resPermitido = simularCriterioEmparejamiento(5500, 5700, 10, 11)
    expect(resPermitido.matched).toBe(true)
  })

  it('7. Blindaje contra desconexión (Migración 366): Bloquea por 30 minutos si la última partida terminó en desconexión', () => {
    const resDesconexionBloqueado = simularCriterioEmparejamiento(5500, 5700, 10, 15, true)
    expect(resDesconexionBloqueado.matched).toBe(false)
    expect(resDesconexionBloqueado.reason).toBe('cooldown_desconexion_30m')

    const resDesconexionPermitido = simularCriterioEmparejamiento(5500, 5700, 10, 31, true)
    expect(resDesconexionPermitido.matched).toBe(true)
  })

  it('8. Timeout de Ranked es 45 segundos según Migración 321', () => {
    expect(RANKED_MATCHMAKING_TIMEOUT_SECONDS).toBe(45)
  })

  it('9. Migración 411: Arena 5 (ej. 9,000) NUNCA empareja con Arena 1 (ej. 1,200) bajo ninguna circunstancia', () => {
    const res = simularCriterioEmparejamiento(9000, 1200, 45)
    expect(res.matched).toBe(false)
    expect(res.reason).toBe('fuera_de_banda_estandar')
  })

  it('10. Migración 411: Arena 5 (ej. 8,200) NUNCA empareja con Arena 3 (ej. 4,500) aunque la banda elástica sea 1200', () => {
    const res = simularCriterioEmparejamiento(8200, 4500, 45)
    expect(res.matched).toBe(false)
    expect(res.reason).toBe('fuera_de_banda_estandar')
  })

  it('11. Migración 411: Arena 1 (ej. 1,400) NUNCA empareja con Arena 3 (ej. 3,400) aunque la diferencia esté en banda', () => {
    const res = simularCriterioEmparejamiento(1400, 3400, 45)
    expect(res.matched).toBe(false)
    expect(res.reason).toBe('frontera_arena_1_arena_3_bloqueada')
  })

  it('12. Migración 411: Arena 1 (ej. 1,400) empareja con Arena 1 (1,500) en su rango normal', () => {
    const res = simularCriterioEmparejamiento(1400, 1500, 5)
    expect(res.matched).toBe(true)
    expect(res.reason).toBe('arenas_bajas_banda_estandar')
  })
})
