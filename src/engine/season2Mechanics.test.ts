import { describe, it, expect } from 'vitest'
import { createBattleState, stepTick, crearPlantaDelRival, type GameState } from './simulate'
import { TOTAL_COLUMNS } from '../utils/gameConstants'
import type { PlantId } from '../types/game'
import { validarAccionP1RankedEstricta } from './asyncP1History'
import { runAsyncTimeline } from './asyncOpponent'

const callar = () => {}

function correr(estado: GameState, tics: number) {
  for (let i = 0; i < tics; i++) stepTick(estado, callar)
}

describe('Mecánicas especiales Temporada 2 (Explode-o-nut, Pickled Pepper, Toadstool)', () => {
  describe('Explode-o-nut (Nuez Explosiva)', () => {
    it('al colisionar con una planta enemiga explota causando daño en 2 casillas y genera la llamarada', () => {
      const estado = createBattleState(10, false, true)
      // Enemigo en col 6 del rival (campo x ~ 52)
      const enemigo = crearPlantaDelRival(estado, 'peashooter' as PlantId, 1, 6)
      estado.enemyPlants.push(enemigo)

      // Plantar explodeonut en col 1
      estado.pending.push({
        atTick: 1,
        kind: 'own_plant',
        plantId: 'explodeonut',
        lane: 1,
        col: 1,
      })

      // Correr hasta que choque
      correr(estado, 200)

      // El enemigo impactado debió haber muerto por los 1400 de daño
      expect(estado.enemyPlants.filter((p) => p.hp > 0)).toHaveLength(0)

      // Explode-o-nut original debe haber muerto (hp: 0)
      const explodeonuts = estado.plants.filter((p) => p.plantId === 'explodeonut' && !p.id.includes('explodeonut-flame'))
      expect(explodeonuts.filter((p) => p.hp > 0)).toHaveLength(0)

      // Debe haber generado la entidad de llamarada delimitada a 2 casillas con el sprite de fuego
      const llama = estado.plants.find((p) => p.id.includes('explodeonut-flame'))
      expect(llama).toBeDefined()
      expect(llama?.spriteOverride).toContain('jalapeno_flame_fx')
    })
  })

  describe('Pickled Pepper (Chile en Escabeche)', () => {
    it('permite colocarse en columnas del lado enemigo (col >= P1_COLUMNS) en el historial autoritativo', () => {
      // Columna 9 está en el lado enemigo (P1_COLUMNS es 7, TOTAL_COLUMNS es 14)
      const accion = {
        seq: 1,
        tick: 6,
        issuedTick: 0,
        kind: 'plant',
        plantId: 'pickledpepper',
        lane: 1,
        col: 9,
        slot: 0,
      }

      const res = validarAccionP1RankedEstricta(accion)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.accion.col).toBe(9)
      }
    })

    it('detona verticalmente la columna seleccionada en el lado enemigo y genera llamaradas por casilla', () => {
      const estado = createBattleState(20, false, true)
      // Col 9 de P1 es en el lado enemigo:
      // P2 coloca plantas en SU columna que corresponde a la columna 9 de P1 en el tablero
      const colP1Objetivo = 9
      const colP2Local = TOTAL_COLUMNS - 1 - colP1Objetivo

      for (let l = 0; l < 3; l++) {
        estado.enemyPlants.push(crearPlantaDelRival(estado, 'peashooter' as PlantId, l, colP2Local))
      }
      // Y un enemigo en otra columna distante
      estado.enemyPlants.push(crearPlantaDelRival(estado, 'peashooter' as PlantId, 1, TOTAL_COLUMNS - 1 - 2))

      // Plantar pickledpepper directamente en col 9 (lado enemigo)
      estado.pending.push({
        atTick: 1,
        kind: 'own_plant',
        plantId: 'pickledpepper',
        lane: 1,
        col: colP1Objetivo,
      })

      correr(estado, 5)

      // Los 3 enemigos de la columna 9 en todas las líneas deben ser destruidos
      const enemigosRestantes = estado.enemyPlants.filter((p) => p.hp > 0)
      expect(enemigosRestantes).toHaveLength(1)

      // Debe haber generado 3 llamaradas visuales (1 por carril) en esa columna
      const llamas = estado.plants.filter((p) => p.id.includes('pickled-burst'))
      expect(llamas).toHaveLength(3)
      for (const llama of llamas) {
        expect(llama.spriteOverride).toContain('jalapeno_flame_fx')
      }
    })

    it('se ejecuta correctamente en la línea temporal autoritativa runAsyncTimeline en casillas enemigas', () => {
      const p1Deck = [
        { slot: 0, plantId: 'pickledpepper', level: 1, statRolls: [] },
        { slot: 1, plantId: 'sunflower', level: 1, statRolls: [] },
        { slot: 2, plantId: 'peashooter', level: 1, statRolls: [] },
        { slot: 3, plantId: 'wallnut', level: 1, statRolls: [] },
        { slot: 4, plantId: 'repeater', level: 1, statRolls: [] },
        { slot: 5, plantId: 'chomper', level: 1, statRolls: [] },
      ]
      const asyncDeck = [
        { slot: 0, plantId: 'peashooter', level: 1, statRolls: [] },
        { slot: 1, plantId: 'sunflower', level: 1, statRolls: [] },
        { slot: 2, plantId: 'wallnut', level: 1, statRolls: [] },
        { slot: 3, plantId: 'repeater', level: 1, statRolls: [] },
        { slot: 4, plantId: 'chomper', level: 1, statRolls: [] },
        { slot: 5, plantId: 'melonpult', level: 1, statRolls: [] },
      ]

      const p1Actions = [
        {
          seq: 1,
          tick: 6,
          issuedTick: 0,
          kind: 'plant' as const,
          plantId: 'pickledpepper' as PlantId,
          lane: 1,
          col: 8, // Lado enemigo
          slot: 0,
        },
      ]

      const timeline = runAsyncTimeline({
        seed: 42,
        p1Deck,
        asyncDeck,
        p1Actions,
        asyncActions: [],
        untilTick: 30,
        validateP1: true,
        strictAuthoritativeHistory: true,
      })

      expect(timeline.ok).toBe(true)
      expect(timeline.p1Ilegal).toBe(false)
    })
  })

  describe('Toadstool (Seta Sapo)', () => {
    it('devora a una planta enemiga, la desaparece inmediatamente, entra en chewing y luego genera 50 soles', () => {
      const estado = createBattleState(33, false, true)
      const victima = crearPlantaDelRival(estado, 'wallnut' as PlantId, 1, 6)
      estado.enemyPlants.push(victima)
      const solesAntes = estado.sunBank

      estado.pending.push({
        atTick: 1,
        kind: 'own_plant',
        plantId: 'toadstool',
        lane: 1,
        col: 1,
      })

      // Avanzar tics hasta que Toadstool alcance a la víctima y comience a masticar
      let mastico = false
      for (let i = 0; i < 350; i++) {
        stepTick(estado, callar)
        const toad = estado.plants.find((p) => p.plantId === 'toadstool')
        if (toad?.state === 'chewing') {
          mastico = true
          break
        }
      }

      expect(mastico).toBe(true)

      // La víctima debió haber desaparecido (hp <= 0)
      expect(estado.enemyPlants.filter((p) => p.hp > 0)).toHaveLength(0)

      // Toadstool debe estar viva y en estado 'chewing'
      const toad = estado.plants.find((p) => p.plantId === 'toadstool')
      expect(toad).toBeDefined()
      expect(toad?.state).toBe('chewing')
      expect(toad?.chewingUntilTick).toBeDefined()

      const xMasticando = toad!.x
      // Correr unos tics mientras mastica: no debe moverse de su posición
      correr(estado, 20)
      expect(toad!.x).toBe(xMasticando)
      expect(toad!.state).toBe('chewing')

      // Correr el tiempo suficiente para completar los 3.5 segundos de digestión
      correr(estado, 120)

      // Al terminar de digerir: estado vuelve a 'walking' y se añadieron 50 soles
      expect(toad!.state).toBe('walking')
      expect(toad!.isWalking).toBe(true)
      expect(toad!.chewingUntilTick).toBeUndefined()
      expect(estado.sunBank).toBeGreaterThanOrEqual(solesAntes + 50)
    })
  })

  describe('Marigold (Margarita - Generación de Oro)', () => {
    it('produce monedas de oro (1 a 3 de oro aleatorios) cada 8 segundos con type === "gold"', () => {
      const estado = createBattleState(55, false, true)
      estado.pending.push({
        atTick: 1,
        kind: 'own_plant',
        plantId: 'marigold',
        lane: 1,
        col: 0,
      })

      // Correr los 8 segundos (aprox 250 tics)
      correr(estado, 260)

      const monedas = estado.suns.filter((s) => s.type === 'gold')
      expect(monedas.length).toBeGreaterThanOrEqual(1)

      const primeraMoneda = monedas[0]
      expect(primeraMoneda.type).toBe('gold')
      expect(primeraMoneda.value).toBeGreaterThanOrEqual(1)
      expect(primeraMoneda.value).toBeLessThanOrEqual(3)
    })

    it('la recolección automática acredita goldEarned en las estadísticas y no altera el sunBank', () => {
      const estado = createBattleState(77, false, true)
      estado.pending.push({
        atTick: 1,
        kind: 'own_plant',
        plantId: 'marigold',
        lane: 1,
        col: 0,
      })

      // Esperar a que produzca la moneda (8s) y luego venza el tiempo de auto-recolección (5s más)
      correr(estado, 420)

      expect(estado.stats.goldEarned).toBeGreaterThanOrEqual(1)
      expect(estado.stats.goldEarned).toBeLessThanOrEqual(6)
    })
  })

  describe('Ghost Pepper (Chile Fantasma - Ataque de Espíritus)', () => {
    it('al detectar una planta enemiga al frente en su carril lanza proyectiles de espíritu fantasmal ghost_spirit', () => {
      const estado = createBattleState(88, false, true)
      // Nuez enemiga en columna 5 del tablero (campo x ~ 46)
      const enemigo = crearPlantaDelRival(estado, 'wallnut' as PlantId, 1, 6)
      estado.enemyPlants.push(enemigo)

      estado.pending.push({
        atTick: 1,
        kind: 'own_plant',
        plantId: 'ghostpepper',
        lane: 1,
        col: 0,
      })

      let disparoFantasma = false
      for (let i = 0; i < 300; i++) {
        stepTick(estado, callar)
        const ghostProj = estado.projectiles.find((p) => p.type === 'ghost_spirit')
        if (ghostProj) {
          disparoFantasma = true
          expect(ghostProj.targetEntityId).toBe(enemigo.id)
          expect(ghostProj.lane).toBe(1)
          break
        }
      }

      expect(disparoFantasma).toBe(true)
    })
  })

  describe('Guacodile (Guacodilo - Combate y Masticado)', () => {
    it('avanza por el carril y al toparse con una planta enemiga entra en attacking para morderla continuamente', () => {
      const estado = createBattleState(99, false, true)
      const enemigo = crearPlantaDelRival(estado, 'wallnut' as PlantId, 1, 6)
      estado.enemyPlants.push(enemigo)
      const hpInicialEnemigo = enemigo.hp

      estado.pending.push({
        atTick: 1,
        kind: 'own_plant',
        plantId: 'guacodile',
        lane: 1,
        col: 0,
      })

      let ataco = false
      for (let i = 0; i < 250; i++) {
        stepTick(estado, callar)
        const guaco = estado.plants.find((p) => p.plantId === 'guacodile')
        if (guaco?.state === 'attacking') {
          ataco = true
          break
        }
      }

      expect(ataco).toBe(true)

      // Seguir corriendo para verificar que inflige daño continuo al masticar
      correr(estado, 40)
      expect(enemigo.hp).toBeLessThan(hpInicialEnemigo)
    })
  })
})
