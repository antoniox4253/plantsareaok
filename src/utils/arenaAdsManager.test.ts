import { describe, it, expect, beforeEach } from 'vitest'
import {
  ArenaAdsManager,
  buildArenaAdsDeck,
  generateLevelPrep,
  generateRewardOptions,
  generateSingleRewardItem,
  EXCLUSIVE_ARENA_ITEM_IDS,
  getBotStatsForLevel,
  ARENA_ADS_ENTRY_FEE_GOLD,
  ARENA_ADS_STORAGE_KEY,
  type ArenaAdsPlantOption,
  type ArenaAdsRewardOption,
} from './arenaAdsManager'

if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    length: 0,
    key: () => null,
  } as any
}

describe('ArenaAdsManager (Mazmorra Infinita)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('1. Valida el costo de entrada de 100 de Oro', () => {
    expect(ARENA_ADS_ENTRY_FEE_GOLD).toBe(100)
  })

  it('2. El Girasol siempre está garantizado en el mazo de 5 cartas', () => {
    const deck1 = buildArenaAdsDeck()
    expect(deck1.length).toBe(5)
    expect(deck1[0].plantId).toBe('sunflower')

    // Con planta elegida
    const plantOpt: ArenaAdsPlantOption = {
      plantId: 'melonpult',
      name: 'Melon-pult',
      isFused: false,
      level: 1,
      statRolls: [],
      description: 'Test',
    }
    const deck2 = buildArenaAdsDeck(plantOpt)
    expect(deck2.length).toBe(5)
    expect(deck2[0].plantId).toBe('sunflower')
    expect(deck2[1].plantId).toBe('melonpult')

    // Verificar que todas las cartas del mazo son únicas
    const ids = deck2.map((c) => c.plantId)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(5)
  })

  it('3. Genera opciones válidas en la fase de preparación con estrellas sincronizadas', () => {
    const prep = generateLevelPrep(1)
    expect(prep.rewardOption).toBeDefined()
    expect(['gold', 'gems', 'item']).toContain(prep.rewardOption.type)
    expect(prep.normalPlantOptions.length).toBe(3)
    expect(prep.fusedPlantOptions.length).toBe(3)

    // Las fusionadas deben tener statRolls y su nivel sincronizado con la cantidad de estrellas
    for (const fused of prep.fusedPlantOptions) {
      expect(fused.isFused).toBe(true)
      expect(fused.statRolls.length).toBeGreaterThan(0)
      expect(fused.level).toBe(Math.max(2, fused.statRolls.length))
    }
  })

  it('4. Persistencia en localStorage: salva, restaura y limpia la run', () => {
    expect(ArenaAdsManager.getStoredRun()).toBeNull()

    const run = ArenaAdsManager.startNewRun(12345)
    expect(run.level).toBe(1)
    expect(run.status).toBe('prep')
    expect(run.deck.length).toBe(5)
    expect(run.deck[0].plantId).toBe('sunflower')

    // Restaurar desde storage
    const restored = ArenaAdsManager.getStoredRun()
    expect(restored).not.toBeNull()
    expect(restored?.id).toBe(run.id)
    expect(restored?.level).toBe(1)

    // Limpiar
    ArenaAdsManager.clearRun()
    expect(ArenaAdsManager.getStoredRun()).toBeNull()
    expect(localStorage.getItem(ARENA_ADS_STORAGE_KEY)).toBeNull()
  })

  it('5. Exclusividad mutua estricta: Opción A (Botín) u Opción B (Planta) no se pueden elegir ambas', () => {
    let run = ArenaAdsManager.startNewRun()

    const rewardGold: ArenaAdsRewardOption = {
      type: 'gold',
      amount: 150,
      label: '+150 Oro',
      icon: '🪙',
    }
    const fusedOpt: ArenaAdsPlantOption = {
      plantId: 'bonkchoy',
      name: 'Bonk Choy',
      isFused: true,
      level: 3,
      statRolls: ['damage', 'attackSpeed', 'hp'],
      description: 'Potente',
    }

    // Paso 1: Usuario elige primero Opción A (Botín)
    run = ArenaAdsManager.applyAdvantageChoice(run, { type: 'reward', option: rewardGold })
    expect(run.chosenAdvantage?.type).toBe('reward')
    expect(run.chosenAdvantage?.rewardClaimed).toEqual(rewardGold)

    // Paso 2: Usuario cambia de opinión y elige Opción B (Planta Fusionada)
    run = ArenaAdsManager.applyAdvantageChoice(run, { type: 'plant_fused', option: fusedOpt })
    expect(run.chosenAdvantage?.type).toBe('plant_fused')
    expect(run.chosenAdvantage?.rewardClaimed).toBeUndefined()
    expect(run.chosenAdvantage?.plantChosen).toEqual(fusedOpt)

    // Al entrar a batalla, SOLO se aplica la planta elegida y NO el botín de la opción A cancelada
    const initialGold = run.accumulatedRewards.gold
    run = ArenaAdsManager.startBattle(run)
    expect(run.accumulatedRewards.gold).toBe(initialGold) // No se cobró el botín de la opción A cancelada
    expect(run.deck.some((c) => c.plantId === 'bonkchoy' && c.level === 3)).toBe(true)
  })

  it('6. Sincronización de estrellas entre la planta elegida y el mazo activo', () => {
    let run = ArenaAdsManager.startNewRun()

    // Supongamos que el mazo tiene Bonk Choy nivel 1
    run.baseDeck = [
      { plantId: 'sunflower', slot: 0, level: 1, statRolls: [] },
      { plantId: 'bonkchoy', slot: 1, level: 1, statRolls: [] },
      { plantId: 'wallnut', slot: 2, level: 1, statRolls: [] },
      { plantId: 'peashooter', slot: 3, level: 1, statRolls: [] },
      { plantId: 'melonpult', slot: 4, level: 1, statRolls: [] },
    ]
    run.deck = [...run.baseDeck]

    // En el cambio se ofrece Bonk Choy ⭐3 Fusión
    const bonkChoyLvl3: ArenaAdsPlantOption = {
      plantId: 'bonkchoy',
      name: 'Bonk Choy',
      isFused: true,
      level: 3,
      statRolls: ['damage', 'hp', 'attackSpeed'],
      description: '⭐3 Fusión',
    }

    // Al elegirla, el Bonk Choy del mazo se sincroniza inmediatamente a ⭐3 y adopta las tiradas
    run = ArenaAdsManager.applyAdvantageChoice(run, { type: 'plant_fused', option: bonkChoyLvl3 })
    const deckBonk = run.deck.find((c) => c.plantId === 'bonkchoy')
    expect(deckBonk).toBeDefined()
    expect(deckBonk?.level).toBe(3)
    expect(deckBonk?.statRolls).toHaveLength(3)

    // Si luego cambia a opción A (Botín), el mazo se resetea al baseDeck donde Bonk Choy vuelve a ser ⭐1
    run = ArenaAdsManager.applyAdvantageChoice(run, {
      type: 'reward',
      option: { type: 'gold', amount: 50, label: '+50 Oro', icon: '🪙' },
    })
    const revertedBonk = run.deck.find((c) => c.plantId === 'bonkchoy')
    expect(revertedBonk?.level).toBe(1)
    expect(revertedBonk?.statRolls).toHaveLength(0)
  })

  it('7. Escalado de bots según el nivel de la mazmorra', () => {
    const botLvl1 = getBotStatsForLevel(1)
    const botLvl5 = getBotStatsForLevel(5)
    const botLvl10 = getBotStatsForLevel(10)

    expect(botLvl1.botElo).toBe(1000)
    expect(botLvl1.botBaseHp).toBe(600)
    expect(botLvl1.botDeck[0].plantId).toBe('sunflower')

    expect(botLvl5.botElo).toBeGreaterThan(botLvl1.botElo)
    expect(botLvl5.botBaseHp).toBeGreaterThan(botLvl1.botBaseHp)

    expect(botLvl10.botElo).toBeGreaterThan(botLvl5.botElo)
    expect(botLvl10.botBaseHp).toBeGreaterThan(botLvl5.botBaseHp)
  })

  it('8. Flujo completo: victoria de nivel y avance o liquidación', () => {
    let run = ArenaAdsManager.startNewRun()
    run = ArenaAdsManager.startBattle(run)
    expect(run.status).toBe('battle')

    run = ArenaAdsManager.completeLevelVictory(run)
    expect(run.status).toBe('level_cleared')
    expect(run.accumulatedRewards.gold).toBeGreaterThan(0)

    // Continuar al siguiente nivel
    run = ArenaAdsManager.advanceToNextLevel(run)
    expect(run.level).toBe(2)
    expect(run.status).toBe('prep')
    expect(run.deck[0].plantId).toBe('sunflower')
  })

  it('9. Consistencia estricta de niveles: ⭐1 base y ⭐3 fusión se preservan en deck y mejorasDeLaCartaEnSlot', async () => {
    const { mejorasDeLaCartaEnSlot } = await import('../engine/mazoDeLaSala')
    const { crearPlantaPropia, createBattleState } = await import('../engine/simulate')

    let run = ArenaAdsManager.startNewRun()
    // Elegir fusión Bonk Choy ⭐3 con 2 rolls
    run = ArenaAdsManager.applyAdvantageChoice(run, {
      type: 'plant_fused',
      option: {
        plantId: 'bonkchoy',
        name: 'Bonk Choy',
        isFused: true,
        level: 3,
        statRolls: ['damage', 'hp'],
        description: '⭐3 Fusión',
      },
    })

    // 1. Sunflower base: debe tener level 1 en el mazo y en mejorasDeLaCartaEnSlot
    const sunflowerMejoras = mejorasDeLaCartaEnSlot(run.deck, 'sunflower', 0)
    expect(sunflowerMejoras.level).toBe(1)

    // 2. Bonk Choy fusión: debe tener level 3 en el mazo y en mejorasDeLaCartaEnSlot aunque tenga 2 statRolls
    const bonkMejoras = mejorasDeLaCartaEnSlot(run.deck, 'bonkchoy', 1)
    expect(bonkMejoras.level).toBe(3)
    expect(bonkMejoras.statRolls).toEqual(['damage', 'hp'])

    // 3. Al instanciar las plantas en combate, conservan exactamente los niveles del deck
    const { NIVEL_POR_DEFECTO } = await import('../engine/bot')
    const state = createBattleState(12345, false, false, NIVEL_POR_DEFECTO, 'auth-v2')
    const sunflowerEntity = crearPlantaPropia(state, 'sunflower', 0, 1, sunflowerMejoras.statRolls, sunflowerMejoras.level)
    expect(sunflowerEntity.level).toBe(1)

    const bonkEntity = crearPlantaPropia(state, 'bonkchoy', 0, 2, bonkMejoras.statRolls, bonkMejoras.level)
    expect(bonkEntity.level).toBe(3)
  })

  it('10. Las opciones de plantas (normales y fusionadas) NUNCA se repiten con las cartas del mazo activo', () => {
    // Probar múltiples iteraciones para garantizar aleatoriedad consistente
    for (let i = 0; i < 20; i++) {
      const run = ArenaAdsManager.startNewRun()
      const deckPlantIds = new Set(run.deck.map((c) => c.plantId))
      expect(deckPlantIds.size).toBe(5)
      expect(deckPlantIds.has('sunflower')).toBe(true)

      const normalOptions = run.currentPrepChoice?.normalPlantOptions || []
      const fusedOptions = run.currentPrepChoice?.fusedPlantOptions || []

      expect(normalOptions.length).toBe(3)
      expect(fusedOptions.length).toBe(3)

      // Ninguna planta normal debe estar en el mazo activo ni ser sunflower
      for (const opt of normalOptions) {
        expect(deckPlantIds.has(opt.plantId)).toBe(false)
        expect(opt.plantId).not.toBe('sunflower')
      }

      // Ninguna planta fusionada debe estar en el mazo activo ni ser sunflower
      for (const opt of fusedOptions) {
        expect(deckPlantIds.has(opt.plantId)).toBe(false)
        expect(opt.plantId).not.toBe('sunflower')
      }

      // Las opciones normales y fusionadas tampoco deben solaparse entre sí
      const normalIds = new Set(normalOptions.map((o) => o.plantId))
      for (const opt of fusedOptions) {
        expect(normalIds.has(opt.plantId)).toBe(false)
      }

      // Probar avance de nivel: el nuevo mazo tampoco debe colisionar con las nuevas opciones
      const nextRun = ArenaAdsManager.advanceToNextLevel(run)
      const nextDeckPlantIds = new Set(nextRun.deck.map((c) => c.plantId))
      const nextNormals = nextRun.currentPrepChoice?.normalPlantOptions || []
      const nextFused = nextRun.currentPrepChoice?.fusedPlantOptions || []

      for (const opt of nextNormals) {
        expect(nextDeckPlantIds.has(opt.plantId)).toBe(false)
      }
      for (const opt of nextFused) {
        expect(nextDeckPlantIds.has(opt.plantId)).toBe(false)
      }
    }
  })

  it('11. Limpieza estricta de progreso al perder (derrota): elimina la run de caché e inicia juego nuevo', () => {
    const run = ArenaAdsManager.startNewRun()
    expect(ArenaAdsManager.getStoredRun()).not.toBeNull()

    // Caso A: Llamada a handleDefeat
    ArenaAdsManager.handleDefeat(run)
    expect(run.status).toBe('game_over')
    expect(ArenaAdsManager.getStoredRun()).toBeNull()
    expect(localStorage.getItem(ARENA_ADS_STORAGE_KEY)).toBeNull()

    // Caso B: Si la run quedó guardada como game_over en storage, getStoredRun la limpia automáticamente
    const run2 = ArenaAdsManager.startNewRun()
    run2.status = 'game_over'
    ArenaAdsManager.saveRun(run2)
    // Al intentar leerla, detecta game_over, la elimina y devuelve null
    expect(ArenaAdsManager.getStoredRun()).toBeNull()
    expect(localStorage.getItem(ARENA_ADS_STORAGE_KEY)).toBeNull()

    // Caso C: Nueva run tras derrota debe iniciar limpia en Nivel 1
    const freshRun = ArenaAdsManager.startNewRun()
    expect(freshRun.level).toBe(1)
    expect(freshRun.status).toBe('prep')
    expect(freshRun.accumulatedRewards.gold).toBe(0)
    expect(freshRun.accumulatedRewards.gems).toBe(0)
  })

  it('12. Ítems exclusivos SOLO pueden aparecer cada 10 niveles (Nivel 10, 20, 30...), NUNCA en niveles intermedios como 11 o 12', () => {
    // Probar 100 tiradas en niveles que NO son múltiplos de 10 (ej. nivel 1, 5, 9, 11, 12, 15, 19)
    const nonMilestoneLevels = [1, 5, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 25]
    for (const lvl of nonMilestoneLevels) {
      for (let i = 0; i < 20; i++) {
        const reward = generateSingleRewardItem(lvl, 1, true)
        if (reward.type === 'item' && reward.itemId) {
          expect(EXCLUSIVE_ARENA_ITEM_IDS.has(reward.itemId)).toBe(false)
        }
        expect(reward.isExclusiveItem).toBeFalsy()
      }
    }

    // En nivel 10, SÍ puede aparecer con probabilidad aleatoria
    let foundExclusiveAt10 = false
    for (let i = 0; i < 200; i++) {
      const reward = generateSingleRewardItem(10, 1, true)
      if (reward.isExclusiveItem) {
        foundExclusiveAt10 = true
        expect(EXCLUSIVE_ARENA_ITEM_IDS.has(reward.itemId!)).toBe(true)
        expect(reward.amount).toBe(1) // Siempre 1
        break
      }
    }
    expect(foundExclusiveAt10).toBe(true)
  })

  it('13. En niveles múltiplos de 10, máximo 1 ítem exclusivo por lote y NUNCA se duplica con multiplicador 2X', () => {
    // En nivel 10 con multiplicador 2X (200 gemas)
    for (let testRun = 0; testRun < 50; testRun++) {
      const options = generateRewardOptions(10, 2, 0)
      expect(options.length).toBe(2) // 2 opciones en nivel 10

      const exclusiveCount = options.filter((o) => o.isExclusiveItem).length
      // En ningún caso puede haber 2 ítems exclusivos en el mismo lote
      expect(exclusiveCount).toBeLessThanOrEqual(1)

      // Si salió uno exclusivo, su amount debe ser 1 estrictamente
      for (const opt of options) {
        if (opt.isExclusiveItem) {
          expect(opt.amount).toBe(1)
        }
      }
    }

    // Si la run ya tiene 1 exclusivo acumulado en nivel 10 a 19, no puede salir otro
    for (let i = 0; i < 50; i++) {
      const options = generateRewardOptions(10, 2, 1) // existingExclusiveCount = 1
      const exclusiveCount = options.filter((o) => o.isExclusiveItem).length
      expect(exclusiveCount).toBe(0)
    }
  })

  it('14. Balance económico de drops: Oro [10..40], Gemas [1..5] y bonus de victoria moderado', () => {
    // Verificar que los montos base de oro y gemas nunca excedan los límites sanos
    for (let i = 0; i < 100; i++) {
      const reward1x = generateSingleRewardItem(1, 1, false)
      if (reward1x.type === 'gold') {
        expect(reward1x.amount).toBeGreaterThanOrEqual(10)
        expect(reward1x.amount).toBeLessThanOrEqual(40)
      } else if (reward1x.type === 'gems') {
        expect(reward1x.amount).toBeGreaterThanOrEqual(1)
        expect(reward1x.amount).toBeLessThanOrEqual(5)
      }

      // Con multiplicador 2X
      const reward2x = generateSingleRewardItem(1, 2, false)
      if (reward2x.type === 'gold') {
        expect(reward2x.amount).toBeGreaterThanOrEqual(20)
        expect(reward2x.amount).toBeLessThanOrEqual(80)
      } else if (reward2x.type === 'gems') {
        expect(reward2x.amount).toBeGreaterThanOrEqual(2)
        expect(reward2x.amount).toBeLessThanOrEqual(10)
      }
    }

    // Verificar bono de victoria en nivel 1 y nivel 12
    let run = ArenaAdsManager.startNewRun()
    run.level = 1
    run = ArenaAdsManager.completeLevelVictory(run)
    expect(run.accumulatedRewards.gold).toBe(7) // 5 + 1 * 2 = 7

    run.accumulatedRewards.gold = 0
    run.level = 12
    run = ArenaAdsManager.completeLevelVictory(run)
    expect(run.accumulatedRewards.gold).toBe(29) // 5 + 12 * 2 = 29
  })

  it('15. Compatibilidad y estadísticas de combate de todos los ítems y skins con alias de plantas', async () => {
    const { getScaledPlantConfig, EQUIPPABLE_PLANT_ITEMS, isPlantMatchingTarget } = await import('./gameConstants')
    const { crearPlantaPropia, createBattleState } = await import('../engine/simulate')
    const { NIVEL_POR_DEFECTO } = await import('../engine/bot')

    // Probar Cactus con Armadura de Cactus (tanto con id 'chomper' como 'cactus')
    expect(isPlantMatchingTarget('chomper', 'cactus')).toBe(true)
    expect(isPlantMatchingTarget('cactus', 'chomper')).toBe(true)
    const cactusScaled = getScaledPlantConfig('chomper', [], 'cactus_armor')
    expect(cactusScaled.damage).toBe((35) + 15)
    expect(cactusScaled.sprite).toBe('/game-assets/skins/armaduraconcactus.webp')

    // Probar Squash con Armadura Samurái (tanto con id 'garlic' como 'squash')
    expect(isPlantMatchingTarget('garlic', 'squash')).toBe(true)
    expect(isPlantMatchingTarget('squash', 'garlic')).toBe(true)
    const squashScaled = getScaledPlantConfig('garlic', [], 'samurai_armor')
    expect(squashScaled.cooldownMs).toBe(Math.max(1000, 7500 - 1500))
    expect(squashScaled.sprite).toBe('/game-assets/skins/squashsamurai.webp')

    // Probar Nuez con Batman (+200 HP)
    const wallnutBatman = getScaledPlantConfig('wallnut', [], 'batman_suit')
    expect(wallnutBatman.maxHp).toBe(1200 + 200)
    expect(wallnutBatman.sprite).toBe('/game-assets/skins/papabatman.webp')

    // Probar Nuez con Bañado en Oro 24K (+300 HP, -2s recarga)
    const wallnutGold = getScaledPlantConfig('wallnut', [], 'gold_24k')
    expect(wallnutGold.maxHp).toBe(1200 + 300)
    expect(wallnutGold.cooldownMs).toBe(Math.max(1000, 15000 - 2000))
    expect(wallnutGold.sprite).toBe('/game-assets/skins/papa24k.webp')

    // Probar creación de entidad en combate con sprite y vida bonificada
    const state = createBattleState(999, false, false, NIVEL_POR_DEFECTO, 'auth-v2')
    const batmanEntity = crearPlantaPropia(state, 'wallnut', 0, 2, [], 1, 'batman_suit')
    expect(batmanEntity.maxHp).toBe(1400)
    expect(batmanEntity.hp).toBe(1400)
    expect(batmanEntity.spriteOverride).toBe('/game-assets/skins/papabatman.webp')
    expect(batmanEntity.equippedItem).toBe('batman_suit')
  })
})
