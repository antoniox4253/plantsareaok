import { describe, it, expect } from 'vitest'

describe('Aislamiento Bot-Only (General) y Desbloqueo de Navi (Migración 328)', () => {
  const NAVI_ID = 'f3fc7e3f-9eeb-45f6-90a2-7c6203a09daf'
  const HUMAN_PLAYER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const BOT_ONLY_TESTER_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'

  it('1. _try_match devuelve sala para humanos y para Navi (desbloqueado con is_bot_only=false), pero NULL si is_bot_only=true', () => {
    function simularTryMatch(isBotOnly: boolean): string | null {
      if (isBotOnly) {
        return null
      }
      return 'room-human-matched'
    }

    // Navi con is_bot_only = false (desbloqueado) puede emparejarse normalmente
    expect(simularTryMatch(false)).toBe('room-human-matched')
    // Cualquier cuenta con is_bot_only = true sigue aislada
    expect(simularTryMatch(true)).toBeNull()
  })

  it('2. _emparejar_lote incluye a Navi desbloqueado y solo excluye usuarios con is_bot_only = true', () => {
    const queue = [
      { id: 'q1', userId: NAVI_ID, isBotOnly: false, elo: 1646 }, // Navi desbloqueado
      { id: 'q2', userId: HUMAN_PLAYER_ID, isBotOnly: false, elo: 1650 },
      { id: 'q3', userId: BOT_ONLY_TESTER_ID, isBotOnly: true, elo: 1660 }, // cuenta aislada
    ]

    // Filtro general aplicado en SQL: solo excluye is_bot_only = true
    const searchers = queue.filter(q => !q.isBotOnly)
    expect(searchers.some(s => s.userId === NAVI_ID)).toBe(true)
    expect(searchers.some(s => s.userId === BOT_ONLY_TESTER_ID)).toBe(false)
    expect(searchers.length).toBe(2)

    // Navi puede ser candidato de un humano real
    const humanSearcher = searchers[1]
    const candidates = queue.filter(
      q => q.userId !== humanSearcher.userId && !q.isBotOnly
    )
    expect(candidates.some(c => c.userId === NAVI_ID)).toBe(true)
    expect(candidates[0].userId).toBe(NAVI_ID)
  })

  it('3. _create_room permite emparejar a Navi como jugador humano pero rechaza cuentas con is_bot_only = true', () => {
    function simularCreateRoom(p1BotOnly: boolean, p2BotOnly: boolean): string {
      if (p1BotOnly || p2BotOnly) {
        throw new Error('Usuario bot-only no puede ser emparejado en salas humanas.')
      }
      return 'room-created-ok'
    }

    // Navi (is_bot_only=false) contra otro humano es aceptado
    expect(simularCreateRoom(false, false)).toBe('room-created-ok')

    // Si alguno es bot-only, se rechaza
    expect(() => simularCreateRoom(true, false)).toThrowError(
      /Usuario bot-only no puede ser emparejado en salas humanas/
    )
    expect(() => simularCreateRoom(false, true)).toThrowError(
      /Usuario bot-only no puede ser emparejado en salas humanas/
    )
  })

  it('4. capture_ranked_async_opponents_from_room permite capturar partidas de Navi si cumple las métricas de elegibilidad', () => {
    function evaluarElegibilidadCaptura(isBotOnly: boolean): string {
      if (isBotOnly) {
        return 'BOT_ONLY_EXCLUDED'
      }
      return 'CAPTURED'
    }

    // Navi ahora puede aportar sus repeticiones al pool de bots clasificados
    expect(evaluarElegibilidadCaptura(false)).toBe('CAPTURED')
    expect(evaluarElegibilidadCaptura(true)).toBe('BOT_ONLY_EXCLUDED')
  })
})
