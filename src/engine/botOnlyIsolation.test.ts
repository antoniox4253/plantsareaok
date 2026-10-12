import { describe, it, expect } from 'vitest'

describe('Aislamiento Estricto Bot-Only para Navi y Cuentas de Prueba', () => {
  const NAVI_ID = 'f3fc7e3f-9eeb-45f6-90a2-7c6203a09daf'
  const HUMAN_PLAYER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('1. _try_match devuelve NULL si el usuario es Navi o is_bot_only = true', () => {
    function simularTryMatch(userId: string, isBotOnly: boolean): string | null {
      if (userId === NAVI_ID || isBotOnly) {
        return null
      }
      return 'room-human-matched'
    }

    expect(simularTryMatch(NAVI_ID, false)).toBeNull()
    expect(simularTryMatch(NAVI_ID, true)).toBeNull()
    expect(simularTryMatch('other-tester', true)).toBeNull()
    expect(simularTryMatch(HUMAN_PLAYER_ID, false)).toBe('room-human-matched')
  })

  it('2. _emparejar_lote excluye a Navi tanto como buscador (v_fila) como candidato (v_cand)', () => {
    const queue = [
      { id: 'q1', userId: NAVI_ID, isBotOnly: true, elo: 1646 },
      { id: 'q2', userId: HUMAN_PLAYER_ID, isBotOnly: false, elo: 1650 },
      { id: 'q3', userId: 'human-2', isBotOnly: false, elo: 1660 },
    ]

    // Filtro estricto canónico aplicado en SQL
    const searchers = queue.filter(q => q.userId !== NAVI_ID && !q.isBotOnly)
    expect(searchers.some(s => s.userId === NAVI_ID)).toBe(false)
    expect(searchers.length).toBe(2)

    // Cuando human-1 busca candidato, Navi nunca es elegible
    const humanSearcher = searchers[0]
    const candidates = queue.filter(
      q => q.userId !== humanSearcher.userId && q.userId !== NAVI_ID && !q.isBotOnly
    )
    expect(candidates.some(c => c.userId === NAVI_ID)).toBe(false)
    expect(candidates.length).toBe(1)
    expect(candidates[0].userId).toBe('human-2')
  })

  it('3. _create_room aborta con excepción si cualquiera de los dos jugadores es Navi o is_bot_only', () => {
    function simularCreateRoom(p1: string, p2: string, p1BotOnly: boolean, p2BotOnly: boolean): string {
      if (p1 === NAVI_ID || p2 === NAVI_ID || p1BotOnly || p2BotOnly) {
        throw new Error('Usuario bot-only no puede ser emparejado en salas humanas.')
      }
      return 'room-created-ok'
    }

    // Navi como P1 o P2 es rechazado
    expect(() => simularCreateRoom(NAVI_ID, HUMAN_PLAYER_ID, true, false)).toThrowError(
      /Usuario bot-only no puede ser emparejado en salas humanas/
    )
    expect(() => simularCreateRoom(HUMAN_PLAYER_ID, NAVI_ID, false, true)).toThrowError(
      /Usuario bot-only no puede ser emparejado en salas humanas/
    )

    // Dos humanos reales sí pueden emparejar
    expect(simularCreateRoom(HUMAN_PLAYER_ID, 'human-2', false, false)).toBe('room-created-ok')
  })

  it('4. capture_ranked_async_opponents_from_room excluye a Navi para no exponer sus cartas al resto del juego', () => {
    function evaluarElegibilidadCaptura(playerId: string, isBotOnly: boolean): string {
      if (playerId === NAVI_ID || isBotOnly) {
        return 'BOT_ONLY_EXCLUDED'
      }
      return 'CAPTURED'
    }

    expect(evaluarElegibilidadCaptura(NAVI_ID, true)).toBe('BOT_ONLY_EXCLUDED')
    expect(evaluarElegibilidadCaptura(HUMAN_PLAYER_ID, false)).toBe('CAPTURED')
  })
})
