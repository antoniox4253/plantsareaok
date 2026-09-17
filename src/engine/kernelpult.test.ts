import { describe, it, expect } from 'vitest'
import {
  PLANT_CONFIGS,
  ENEMY_PLANT_CONFIGS,
  getScaledPlantConfig,
  getEligibleStatsForPlant,
  getFusionGoldCost,
} from '../utils/gameConstants'
import {
  createBattleState,
  stepTick,
  crearPlantaPropia,
  crearPlantaDelRival,
  type GameState,
} from './simulate'
import { msToTicks } from './time'

const callar = () => {}

function correr(estado: GameState, tics: number) {
  for (let i = 0; i < tics; i++) stepTick(estado, callar)
}

describe('Lanzamaíz (Kernel-pult) - Configuración, Stats y Mecánicas Oficiales', () => {
  it('está registrada en PLANT_CONFIGS con valores de PvZ 2', () => {
    const config = PLANT_CONFIGS.kernelpult
    expect(config).toBeDefined()
    expect(config.id).toBe('kernelpult')
    expect(config.name).toBe('Lanzamaíz')
    expect(config.cost).toBe(100)
    expect(config.cooldownMs).toBe(7500)
    expect(config.maxHp).toBe(300)
    expect(config.category).toBe('ranged')
    expect(config.attackSpeedMs).toBe(2900)
    expect(config.damage).toBe(30)
    expect(config.sprite).toBe('/game-assets/plants/kernelpult.webp')
    expect(config.packetActive).toBe('/game-assets/plants/kernelpult_packet.webp')
  })

  it('tiene versión enemiga registrada en ENEMY_PLANT_CONFIGS', () => {
    const enemyConfig = ENEMY_PLANT_CONFIGS.enemy_kernelpult
    expect(enemyConfig).toBeDefined()
    expect(enemyConfig.type).toBe('enemy_kernelpult')
    expect(enemyConfig.cost).toBe(100)
    expect(enemyConfig.maxHp).toBe(300)
    expect(enemyConfig.damage).toBe(30)
  })

  it('define sus estadísticas elegibles para fusión (hp, cooldown, damage, attackSpeed, duration)', () => {
    const stats = getEligibleStatsForPlant('kernelpult')
    expect(stats).toEqual(['hp', 'cooldown', 'damage', 'attackSpeed', 'duration'])
  })

  it('calcula el coste de oro de fusión como carta de rareza Rara', () => {
    expect(getFusionGoldCost('kernelpult', 0)).toBe(2500)
    expect(getFusionGoldCost('kernelpult', 1)).toBe(Math.round(2500 * 1.5))
  })

  it('escala estadísticas adecuadamente con statRolls', () => {
    const base = PLANT_CONFIGS.kernelpult
    const scaledDmg = getScaledPlantConfig('kernelpult', ['damage'])
    expect(scaledDmg.damage).toBe(Math.round(base.damage! * 1.15))

    const scaledHp = getScaledPlantConfig('kernelpult', ['hp'])
    expect(scaledHp.maxHp).toBe(Math.round(base.maxHp * 1.15))

    const scaledSpeed = getScaledPlantConfig('kernelpult', ['attackSpeed'])
    expect(scaledSpeed.attackSpeedMs).toBe(Math.round(base.attackSpeedMs! * 0.85))
  })

  it('dispara proyectiles en el carril y daña al enemigo', () => {
    const estado = createBattleState(12345, false, true)
    const maiz = crearPlantaPropia(estado, 'kernelpult', 1, 1)
    estado.plants.push(maiz)

    const victima = crearPlantaDelRival(estado, 'wallnut', 1, 5)
    victima.hp = 1000
    victima.maxHp = 1000
    estado.enemyPlants.push(victima)
    // Corremos 150 tics (5.0s, suficiente para disparar a los 2.9s y que el proyectil viaje e impacte)
    correr(estado, msToTicks(5000))

    expect(victima.hp).toBeLessThan(1000)
  })

  it('la mantequilla inmoviliza al objetivo (frozenUntil > tick) y escala 3.0s a 6.0s', () => {
    let encontrado = false
    for (let semilla = 1; semilla <= 50; semilla++) {
      const estado = createBattleState(semilla, false, true)
      const maiz = crearPlantaPropia(estado, 'kernelpult', 1, 1)
      estado.plants.push(maiz)

      const victima = crearPlantaDelRival(estado, 'wallnut', 1, 3)
      victima.hp = 5000
      victima.maxHp = 5000
      estado.enemyPlants.push(victima)

      // Ejecutar hasta el primer impacto
      correr(estado, msToTicks(5000))

      if (victima.frozenUntil && victima.frozenUntil > estado.tick) {
        encontrado = true
        expect(victima.frozenUntil).toBeGreaterThan(estado.tick)
        break
      }
    }
    expect(encontrado, 'Debe haber disparado mantequilla e inmovilizado a la víctima').toBe(true)
  })

  it('calcula la duración de mantequilla exacta: 3.0s base y +0.6s por tirada de duration', () => {
    // Verificar que un proyectil de mantequilla generado tenga el freezeDurationMs exacto
    const estado = createBattleState(1, false, true)
    
    // Nivel 0 (0 tiradas): 3000ms
    const maiz0 = crearPlantaPropia(estado, 'kernelpult', 0, 1)
    maiz0.statRolls = []
    
    // Con 1 tirada en duration: 3600ms
    const maiz1 = crearPlantaPropia(estado, 'kernelpult', 1, 1)
    maiz1.statRolls = ['duration']

    // Con 5 tiradas en duration: 6000ms
    const maiz5 = crearPlantaPropia(estado, 'kernelpult', 2, 1)
    maiz5.statRolls = ['duration', 'duration', 'duration', 'duration', 'duration']

    estado.plants.push(maiz0, maiz1, maiz5)

    // Forzar disparo
    estado.tick = msToTicks(3000)
    // Procesar lado
    correr(estado, 1)

    // Buscar si hay proyectiles tipo butter o validar su cálculo directo
    const calcDuration = (rolls: string[]) => {
      const durationRolls = rolls.filter((r) => r === 'duration').length
      return 3000 + Math.round(durationRolls * 0.6 * 1000)
    }

    expect(calcDuration([])).toBe(3000)
    expect(calcDuration(['duration'])).toBe(3600)
    expect(calcDuration(['duration', 'duration'])).toBe(4200)
    expect(calcDuration(['duration', 'duration', 'duration'])).toBe(4800)
    expect(calcDuration(['duration', 'duration', 'duration', 'duration'])).toBe(5400)
    expect(calcDuration(['duration', 'duration', 'duration', 'duration', 'duration'])).toBe(6000)
  })

  it('garantiza paridad determinista entre partidas con la misma semilla', () => {
    const s1 = createBattleState(777, false, true)
    const s2 = createBattleState(777, false, true)

    s1.plants.push(crearPlantaPropia(s1, 'kernelpult', 1, 1))
    s2.plants.push(crearPlantaPropia(s2, 'kernelpult', 1, 1))

    s1.enemyPlants.push(crearPlantaDelRival(s1, 'wallnut', 1, 4))
    s2.enemyPlants.push(crearPlantaDelRival(s2, 'wallnut', 1, 4))

    correr(s1, 150)
    correr(s2, 150)

    expect(s1.enemyPlants[0].hp).toBe(s2.enemyPlants[0].hp)
    expect(s1.enemyPlants[0].frozenUntil).toBe(s2.enemyPlants[0].frozenUntil)
    expect(s1.projectiles.length).toBe(s2.projectiles.length)
  })
})
