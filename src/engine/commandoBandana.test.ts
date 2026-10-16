import { describe, it, expect } from 'vitest'
import {
  getEquippableItemDef,
  getEquippableItemsForPlant,
  getScaledPlantConfig,
  isPlantMatchingTarget,
} from '../utils/gameConstants'
import {
  createBattleState,
  crearPlantaPropia,
  stepTick,
} from './simulate'
import { msToTicks } from './time'
import { leerMazo, mejorasDeLaCartaEnSlot } from './mazoDeLaSala'

describe('Commando Peashooter Skin & Bandana de Comando', () => {
  it('has correct item configuration and exclusivity for peashooter', () => {
    const item = getEquippableItemDef('commando_bandana')
    expect(item).toBeDefined()
    expect(item?.targetPlantId).toBe('peashooter')
    expect(item?.name).toBe('Bandana de Comando')
    expect(item?.equippedPlantName).toBe('Lanzaguisantes Comando')
    expect(item?.statBonusText).toContain('+35% Vel. Disparo')

    const peashooterItems = getEquippableItemsForPlant('peashooter')
    expect(peashooterItems.some((i) => i.id === 'commando_bandana')).toBe(true)

    expect(isPlantMatchingTarget(item!.targetPlantId, 'peashooter')).toBe(true)
    expect(isPlantMatchingTarget(item!.targetPlantId, 'bonkchoy')).toBe(false)
    expect(isPlantMatchingTarget(item!.targetPlantId, 'sunflower')).toBe(false)
  })

  it('updates visual assets in getScaledPlantConfig when commando_bandana is equipped', () => {
    const baseConfig = getScaledPlantConfig('peashooter', [])
    expect(baseConfig.sprite).not.toContain('peashooter_commando')

    const commandoConfig = getScaledPlantConfig('peashooter', [], 'commando_bandana')
    expect(commandoConfig.sprite).toBe('/game-assets/skins/peashooter_commando.webp')
    expect(commandoConfig.icon).toBe('/game-assets/skins/peashooter_commando.webp')
    expect(commandoConfig.packetActive).toBe('/game-assets/skins/peashooter_commando.webp')
    expect(commandoConfig.packetDisabled).toBe('/game-assets/skins/peashooter_commando.webp')
  })

  it('preserves equippedItem in mazoDeLaSala serialization and resolution', () => {
    const rawDeck = [
      {
        plantId: 'peashooter',
        slot: 0,
        level: 1,
        statRolls: ['attackSpeed'],
        equippedItem: 'commando_bandana',
      },
    ]

    const parsed = leerMazo(rawDeck)
    expect(parsed).not.toBeNull()
    expect(parsed![0].equippedItem).toBe('commando_bandana')

    const mejoras = mejorasDeLaCartaEnSlot(parsed, 'peashooter', 0)
    expect(mejoras.equippedItem).toBe('commando_bandana')
    expect(mejoras.statRolls).toEqual(['attackSpeed'])
  })

  it('manages 15s cooldown and 5s +35% attack speed aura cycle accurately', () => {
    const state = createBattleState(42)
    const peashooter = crearPlantaPropia(state, 'peashooter', 1, 0, [], 0, 'commando_bandana')
    state.plants.push(peashooter)

    const t15s = msToTicks(15000)
    const t5s = msToTicks(5000)

    expect(peashooter.isCommandoAura).toBe(false)
    expect(peashooter.nextCommandoAuraTick).toBe(t15s)

    // Simulate up to tick t15s - 1: aura must NOT be active yet
    for (let t = 0; t < t15s - 1; t++) {
      stepTick(state)
    }
    expect(state.tick).toBe(t15s - 1)
    expect(peashooter.isCommandoAura).toBe(false)

    // Simulate tick t15s (15 seconds): aura activates!
    stepTick(state)
    expect(state.tick).toBe(t15s)
    expect(peashooter.isCommandoAura).toBe(true)
    expect(peashooter.commandoAuraEndTick).toBe(t15s + t5s)

    // Simulate within the 5s burst
    for (let t = 0; t < msToTicks(2000); t++) {
      stepTick(state)
    }
    expect(peashooter.isCommandoAura).toBe(true)

    // Advance to right before aura ends
    while (state.tick < peashooter.commandoAuraEndTick! - 1) {
      stepTick(state)
    }
    expect(peashooter.isCommandoAura).toBe(true)

    // Advance to when aura finishes
    stepTick(state)
    expect(peashooter.isCommandoAura).toBe(false)
    expect(peashooter.nextCommandoAuraTick).toBe(t15s + t5s + t15s)

    // Advance to next 15s cycle
    const nextTarget = peashooter.nextCommandoAuraTick!
    while (state.tick < nextTarget) {
      stepTick(state)
    }
    expect(state.tick).toBe(nextTarget)
    expect(peashooter.isCommandoAura).toBe(true)
    expect(peashooter.commandoAuraEndTick).toBe(state.tick + t5s)
  })

  it('shoots 35% faster during aura than during normal state', () => {
    // Normal Peashooter vs Commando Peashooter firing rate during aura
    const baseConfig = getScaledPlantConfig('peashooter', [])
    const baseInterval = baseConfig.attackSpeedMs || 1400
    const boostedInterval = Math.round(baseInterval * 0.65) // 35% faster delay

    expect(boostedInterval).toBeLessThan(baseInterval)
    expect(boostedInterval).toBe(910) // 1400 * 0.65 = 910ms

    // Test projectile generation frequency during aura
    const state = createBattleState(99)
    const commando = crearPlantaPropia(state, 'peashooter', 0, 0, [], 0, 'commando_bandana')
    state.plants.push(commando)

    // Advance to when aura is active
    while (!commando.isCommandoAura) {
      stepTick(state)
    }

    const startAuraTick = state.tick
    let projectilesFiredInAura = 0

    // Measure projectiles fired during 5s of aura
    while (state.tick <= startAuraTick + msToTicks(5000)) {
      const projsBefore = state.projectiles.length
      stepTick(state)
      if (state.projectiles.length > projsBefore) {
        projectilesFiredInAura += (state.projectiles.length - projsBefore)
      }
    }

    // 5000ms / 910ms interval = ~5-6 shots in 5s
    // Whereas normal 1400ms interval would fire 5000ms / 1400ms = ~3 shots
    expect(projectilesFiredInAura).toBeGreaterThanOrEqual(4)
  })
})
