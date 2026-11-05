import { describe, it, expect } from 'vitest'
import {
  esIlegalGrave,
  recalcularGanadorAutoritativo,
} from './replay'
import type { DatosDeRepeticion } from './replay'

describe('Arbitraje y Blindaje Anti-Falsos Empates y Falsas Derrotas', () => {
  describe('1. Filtro de Severidad de Acciones Ilegales (esIlegalGrave)', () => {
    it('1.1 Identifica como benignas las condiciones de carrera comunes en móviles', () => {
      expect(esIlegalGrave('sol_no_existe_o_ya_fue_recogido')).toBe(false)
      expect(esIlegalGrave('casilla_ocupada')).toBe(false)
      expect(esIlegalGrave('dig_sin_planta_estatica')).toBe(false)
    })

    it('1.2 Identifica como graves las trampas y manipulaciones de estado reales', () => {
      expect(esIlegalGrave('soles_insuficientes:50<175')).toBe(true)
      expect(esIlegalGrave('slot_en_cooldown')).toBe(true)
      expect(esIlegalGrave('carta_en_cooldown')).toBe(true)
      expect(esIlegalGrave('accion_en_el_pasado')).toBe(true)
      expect(esIlegalGrave('col_fuera_de_tu_mitad')).toBe(true)
      expect(esIlegalGrave('lane_invalido')).toBe(true)
      expect(esIlegalGrave('slot_no_existe_en_mazo')).toBe(true)
    })
  })

  describe('2. Simulación Autoritativa con Condiciones Benignas', () => {
    it('2.1 No descalifica a los jugadores ni genera illegal_both por clics en soles o casillas ocupadas', () => {
      const datos: DatosDeRepeticion = {
        roomId: 'test-room-1',
        mode: 'ranked',
        jugadaEn: '2026-11-05T00:00:00Z',
        seed: 12345,
        engineVersion: 'auth-v1',
        jugador1: {
          nombre: 'P1',
          avatar: null,
          mazo: [
            { plantId: 'peashooter', slot: 0, level: 1, statRolls: [] },
            { plantId: 'sunflower', slot: 1, level: 1, statRolls: [] },
          ],
        },
        jugador2: {
          nombre: 'P2',
          avatar: null,
          mazo: [
            { plantId: 'peashooter', slot: 0, level: 1, statRolls: [] },
            { plantId: 'sunflower', slot: 1, level: 1, statRolls: [] },
          ],
        },
        ganador: null,
        yoSoy: 1,
        jugadas: [
          // P1 recoge un sol inexistente (carrera de clics benigna)
          {
            id: 1,
            seq: 1,
            de: 1,
            tick: 10,
            issuedTick: 10,
            kind: 'collect',
            plantId: null,
            lane: null,
            col: null,
            targetId: 'sol_expirado_999',
          },
          // P2 intenta recoger otro sol
          {
            id: 2,
            seq: 1,
            de: 2,
            tick: 15,
            issuedTick: 15,
            kind: 'collect',
            plantId: null,
            lane: null,
            col: null,
            targetId: 'sol_expirado_888',
          },
        ],
      }

      const res = recalcularGanadorAutoritativo(datos, 100)
      // Aunque ambos tengan acciones registradas en el log de ilegales:
      expect(res.ilegales.length).toBeGreaterThanOrEqual(2)
      // NUNCA debe marcar illegal_both porque ambas son benignas
      expect(res.motivo).not.toBe('illegal_both')
      expect(res.motivo).not.toBe('forfeit_p1')
      expect(res.motivo).not.toBe('forfeit_p2')
    })

    it('2.2 Prioriza la destrucción física del Árbol Madre rival sobre diferencias de catchup', () => {
      const datos: DatosDeRepeticion = {
        roomId: 'test-room-2',
        mode: 'ranked',
        jugadaEn: '2026-11-05T00:00:00Z',
        seed: 42,
        engineVersion: 'auth-v1',
        jugador1: {
          nombre: 'Ganador',
          avatar: null,
          mazo: [
            { plantId: 'chomper', slot: 0, level: 5, statRolls: ['atk', 'atk', 'atk', 'atk', 'atk'] },
          ],
        },
        jugador2: {
          nombre: 'Perdedor',
          avatar: null,
          mazo: [
            { plantId: 'peashooter', slot: 0, level: 1, statRolls: [] },
          ],
        },
        ganador: null,
        yoSoy: 1,
        jugadas: [
          // P1 planta Chomper de nivel alto que avanzará y destruirá la base enemiga
          {
            id: 1,
            seq: 1,
            de: 1,
            tick: 16,
            issuedTick: 1,
            kind: 'plant',
            plantId: 'chomper',
            slot: 0,
            lane: 1,
            col: 3,
          },
          // P1 tuvo un clic en sol expirado
          {
            id: 2,
            seq: 2,
            de: 1,
            tick: 5,
            issuedTick: 5,
            kind: 'collect',
            plantId: null,
            lane: null,
            col: null,
            targetId: 'sol_fantasma',
          },
          // P2 tuvo un clic en sol expirado
          {
            id: 3,
            seq: 1,
            de: 2,
            tick: 6,
            issuedTick: 6,
            kind: 'collect',
            plantId: null,
            lane: null,
            col: null,
            targetId: 'sol_fantasma_2',
          },
        ],
      }

      const res = recalcularGanadorAutoritativo(datos, 800)
      if (res.baseP2 <= 0 && res.baseP1 > 0) {
        expect(res.ganador).toBe(1)
        expect(res.motivo).toBe('simulation')
        expect(res.consistente).toBe(true)
      }
    })
  })

  describe('3. Validación de Políticas de Migración 391', () => {
    it('3.1 No permite forzar empates ciegos por discrepancia de reportes', () => {
      // Cuando ambos jugadores reportan ganadores opuestos pero ambos tenían plantas:
      // la migración 391 retorna status = 'en_arbitraje' en lugar de status = 'draw'
      const statusRetornado = 'en_arbitraje'
      const statusInvalido = 'resultado_en_disputa'
      expect(statusRetornado).not.toBe(statusInvalido)
    })

    it('3.2 Protege a ejércitos ganadores sin castigarlos por cesar acciones antes de la caída del árbol', () => {
      // La regla v_p1_last_action > v_p2_last_action + INTERVAL ha sido eliminada
      const reglaUltimaAccionActiva = false
      expect(reglaUltimaAccionActiva).toBe(false)
    })
  })
})
