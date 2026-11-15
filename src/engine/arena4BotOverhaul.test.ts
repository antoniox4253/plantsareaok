import { describe, it, expect } from 'vitest'
import { simulateAsyncMatch } from './asyncOpponent'
import { getScaledPlantConfig } from '../utils/gameConstants'

describe('Certificación de Semillas Mejoradas de Arena 4 (Opción 1)', () => {
  it('1. Bonk Choy con champion_belt y 5/5 stat rolls escala vida y daño correctamente', () => {
    const config = getScaledPlantConfig(
      'bonkchoy',
      ['damage', 'damage', 'attackSpeed', 'attackSpeed', 'hp'],
      'champion_belt'
    )
    expect(config.maxHp).toBeGreaterThan(400)
    expect(config.damage).toBeGreaterThan(70)
    expect(config.sprite).toContain('bonkchoy_champion')
  })

  it('2. Nuez con gold_24k y 5/5 stat rolls escala vida colosal y recarga reducida', () => {
    const config = getScaledPlantConfig(
      'wallnut',
      ['hp', 'hp', 'hp', 'cooldown', 'cooldown'],
      'gold_24k'
    )
    expect(config.maxHp).toBeGreaterThan(1200)
    expect(config.cooldownMs).toBeLessThanOrEqual(9500)
  })

  it('3. Lanzamaíz con witch_hat escala HP extra y sprite mágico', () => {
    const config = getScaledPlantConfig(
      'kernelpult',
      ['damage', 'damage', 'attackSpeed', 'cooldown', 'cooldown'],
      'witch_hat'
    )
    expect(config.maxHp).toBeGreaterThan(300)
    expect(config.sprite).toContain('kernel_witch')
  })

  it('4. simulateAsyncMatch ejecuta un mazo y timeline mejorado de Arena 4 sin errores', () => {
    const seed = 12345
    const p1Deck = [
      { slot: 0, plantId: 'sunflower', level: 5, statRolls: ['hp', 'cooldown'], equippedItem: 'sunflower_glasses' },
      { slot: 1, plantId: 'peashooter', level: 5, statRolls: ['damage', 'attackSpeed'], equippedItem: 'commando_bandana' },
      { slot: 2, plantId: 'wallnut', level: 5, statRolls: ['hp', 'hp'], equippedItem: 'gold_24k' },
    ]

    const asyncDeckOverhaul = [
      { slot: 0, plantId: 'sunflower', level: 5, statRolls: ['production', 'production', 'hp', 'cooldown', 'cooldown'], equippedItem: 'sunflower_glasses' },
      { slot: 1, plantId: 'bonkchoy', level: 5, statRolls: ['damage', 'damage', 'attackSpeed', 'attackSpeed', 'hp'], equippedItem: 'champion_belt' },
      { slot: 2, plantId: 'wallnut', level: 5, statRolls: ['hp', 'hp', 'hp', 'cooldown', 'cooldown'], equippedItem: 'gold_24k' },
      { slot: 3, plantId: 'repeater', level: 5, statRolls: ['damage', 'damage', 'attackSpeed', 'attackSpeed', 'cooldown'], equippedItem: 'commando_bandana' },
      { slot: 4, plantId: 'explodeonut', level: 5, statRolls: ['hp', 'hp', 'hp', 'cooldown', 'cooldown'] },
      { slot: 5, plantId: 'chomper', level: 5, statRolls: ['damage', 'damage', 'attackSpeed', 'attackSpeed', 'cooldown'], equippedItem: 'cactus_armor' },
    ]

    const p1Actions = [
      { seq: 1, issuedTick: 60, tick: 66, kind: 'plant', plantId: 'sunflower', lane: 1, col: 0, slot: 0 },
      { seq: 2, issuedTick: 120, tick: 120, kind: 'collect', targetId: 'sky-sun-1', lane: 1, col: 0 },
      { seq: 3, issuedTick: 200, tick: 206, kind: 'plant', plantId: 'peashooter', lane: 1, col: 1, slot: 1 },
    ]

    // Acciones diseñadas respetando estrictamente la economía de sol y cooldowns del bot:
    // Slot 0 (Sunflower): costo 50, cooldown ~3.5s (210 tics)
    // Slot 1 (Bonk Choy): costo 175, cooldown ~7.5s (450 tics)
    // Slot 2 (Wallnut): costo 50, cooldown ~8.8s (530 tics)
    // Slot 3 (Repeater): costo 200, cooldown ~7.5s (450 tics)
    // Slot 4 (Explodeonut): costo 125, cooldown ~20s (1200 tics)
    // Slot 5 (Chomper): costo 150, cooldown ~10s (600 tics)
    const asyncActionsOverhaul = [
      { seq: 1, issuedTick: 90, tick: 96, kind: 'plant', plantId: 'sunflower', lane: 1, col: 0, slot: 0 },
      { seq: 2, issuedTick: 310, tick: 316, kind: 'plant', plantId: 'sunflower', lane: 0, col: 0, slot: 0 },
      { seq: 3, issuedTick: 530, tick: 536, kind: 'plant', plantId: 'wallnut', lane: 1, col: 3, slot: 2 },
      { seq: 4, issuedTick: 750, tick: 756, kind: 'plant', plantId: 'sunflower', lane: 2, col: 0, slot: 0 },
      { seq: 5, issuedTick: 970, tick: 976, kind: 'plant', plantId: 'bonkchoy', lane: 1, col: 0, slot: 1 },
      { seq: 6, issuedTick: 1200, tick: 1206, kind: 'plant', plantId: 'repeater', lane: 1, col: 1, slot: 3 },
      { seq: 7, issuedTick: 1450, tick: 1456, kind: 'plant', plantId: 'bonkchoy', lane: 0, col: 0, slot: 1 },
      { seq: 8, issuedTick: 1700, tick: 1706, kind: 'plant', plantId: 'repeater', lane: 0, col: 1, slot: 3 },
      { seq: 9, issuedTick: 1950, tick: 1956, kind: 'plant', plantId: 'explodeonut', lane: 1, col: 4, slot: 4 },
      { seq: 10, issuedTick: 2200, tick: 2206, kind: 'plant', plantId: 'bonkchoy', lane: 2, col: 0, slot: 1 },
      { seq: 11, issuedTick: 2450, tick: 2456, kind: 'plant', plantId: 'repeater', lane: 2, col: 1, slot: 3 },
      { seq: 12, issuedTick: 2700, tick: 2706, kind: 'plant', plantId: 'wallnut', lane: 0, col: 3, slot: 2 },
      { seq: 13, issuedTick: 2950, tick: 2956, kind: 'plant', plantId: 'bonkchoy', lane: 1, col: 0, slot: 1 },
      { seq: 14, issuedTick: 3200, tick: 3206, kind: 'plant', plantId: 'chomper', lane: 1, col: 0, slot: 5 },
      { seq: 15, issuedTick: 3450, tick: 3456, kind: 'plant', plantId: 'bonkchoy', lane: 0, col: 0, slot: 1 },
      { seq: 16, issuedTick: 3700, tick: 3706, kind: 'plant', plantId: 'repeater', lane: 1, col: 2, slot: 3 },
      { seq: 17, issuedTick: 3950, tick: 3956, kind: 'plant', plantId: 'bonkchoy', lane: 2, col: 0, slot: 1 },
    ]

    const res = simulateAsyncMatch(
      seed,
      p1Deck,
      asyncDeckOverhaul,
      p1Actions,
      asyncActionsOverhaul,
      4000
    )

    console.log('RES RESULT:', { ok: res.ok, telemetria: res.telemetria })

    expect(res.ok).toBe(true)
    expect(res.p1Ilegal).toBeFalsy()
    expect(res.telemetria.intentionsExecuted).toBeGreaterThanOrEqual(8)
  })
})
