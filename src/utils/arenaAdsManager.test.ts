import { describe, it, expect, beforeEach } from 'vitest'
import {
  ArenaAdsManager,
  buildArenaAdsDeck,
  generateLevelPrep,
  getFixedRewardsForLevel,
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

describe('ArenaAdsManager (Mazmorra 50 Niveles)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('1. Valida el costo de entrada de 350 de Oro', () => {
    expect(ARENA_ADS_ENTRY_FEE_GOLD).toBe(350)
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
    expect(['gold', 'gems', 'item', 'pack']).toContain(prep.rewardOption.type)
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

    const rewardGems: ArenaAdsRewardOption = {
      type: 'gems',
      amount: 15,
      label: '+15 Gemas',
      icon: '💎',
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
    run = ArenaAdsManager.applyAdvantageChoice(run, { type: 'reward', option: rewardGems })
    expect(run.chosenAdvantage?.type).toBe('reward')
    expect(run.chosenAdvantage?.rewardClaimed).toEqual(rewardGems)

    // Paso 2: Usuario cambia de opinión y elige Opción B (Planta Fusionada)
    run = ArenaAdsManager.applyAdvantageChoice(run, { type: 'plant_fused', option: fusedOpt })
    expect(run.chosenAdvantage?.type).toBe('plant_fused')
    expect(run.chosenAdvantage?.rewardClaimed).toBeUndefined()
    expect(run.chosenAdvantage?.plantChosen).toEqual(fusedOpt)

    // Al entrar a batalla, se aplica la planta elegida
    run = ArenaAdsManager.startBattle(run)
    expect(run.deck.some((c) => c.plantId === 'bonkchoy' && c.level === 3)).toBe(true)
  })

  it('6. Sincronización de estrellas entre la planta elegida y el mazo activo', () => {
    let run = ArenaAdsManager.startNewRun()

    run.baseDeck = [
      { plantId: 'sunflower', slot: 0, level: 1, statRolls: [] },
      { plantId: 'bonkchoy', slot: 1, level: 1, statRolls: [] },
      { plantId: 'wallnut', slot: 2, level: 1, statRolls: [] },
      { plantId: 'peashooter', slot: 3, level: 1, statRolls: [] },
      { plantId: 'melonpult', slot: 4, level: 1, statRolls: [] },
    ]
    run.deck = [...run.baseDeck]

    const bonkChoyLvl3: ArenaAdsPlantOption = {
      plantId: 'bonkchoy',
      name: 'Bonk Choy',
      isFused: true,
      level: 3,
      statRolls: ['damage', 'hp', 'attackSpeed'],
      description: '⭐3 Fusión',
    }

    run = ArenaAdsManager.applyAdvantageChoice(run, { type: 'plant_fused', option: bonkChoyLvl3 })
    const deckBonk = run.deck.find((c) => c.plantId === 'bonkchoy')
    expect(deckBonk).toBeDefined()
    expect(deckBonk?.level).toBe(3)
    expect(deckBonk?.statRolls).toHaveLength(3)

    run = ArenaAdsManager.applyAdvantageChoice(run, {
      type: 'reward',
      option: { type: 'gems', amount: 5, label: '+5 Gemas', icon: '💎' },
    })
    const revertedBonk = run.deck.find((c) => c.plantId === 'bonkchoy')
    expect(revertedBonk?.level).toBe(1)
    expect(revertedBonk?.statRolls).toHaveLength(0)
  })

  it('7. Escalado de dificultad sustancial de bots a partir de nivel 5', () => {
    const botLvl1 = getBotStatsForLevel(1)
    const botLvl4 = getBotStatsForLevel(4)
    const botLvl5 = getBotStatsForLevel(5)
    const botLvl10 = getBotStatsForLevel(10)
    const botLvl20 = getBotStatsForLevel(20)
    const botLvl50 = getBotStatsForLevel(50)

    expect(botLvl1.botElo).toBe(1100)
    expect(botLvl1.botBaseHp).toBe(1000)
    expect(botLvl1.botDeck[0].plantId).toBe('sunflower')

    expect(botLvl4.botElo).toBe(1325)
    expect(botLvl5.botElo).toBe(1390) // Rampa desde nivel 5
    expect(botLvl5.botBaseHp).toBe(1025)

    expect(botLvl10.botElo).toBe(1715)
    expect(botLvl10.botBaseHp).toBe(1150)

    expect(botLvl20.botElo).toBe(2365) // Muy desafiante en nivel 20
    expect(botLvl20.botBaseHp).toBe(1500)

    expect(botLvl50.botElo).toBe(3415)
    expect(botLvl50.botBaseHp).toBe(3200)

    // Mazos sinérgicos y con niveles escalados
    expect(botLvl5.botDeck[1].level).toBe(2)
    expect(botLvl20.botDeck[1].level).toBe(3)
    expect(botLvl50.botDeck[1].level).toBe(4)
  })

  it('8. Flujo completo: victoria de nivel, 0 oro y recompensa fija', () => {
    let run = ArenaAdsManager.startNewRun()
    run = ArenaAdsManager.startBattle(run)
    expect(run.status).toBe('battle')

    run = ArenaAdsManager.completeLevelVictory(run)
    expect(run.status).toBe('level_cleared')
    // 0 Oro en la mazmorra
    expect(run.accumulatedRewards.gold).toBe(0)
    // Nivel 1 otorga 5 de agua
    expect(run.accumulatedRewards.items['water']).toBe(5)

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

    const sunflowerMejoras = mejorasDeLaCartaEnSlot(run.deck, 'sunflower', 0)
    expect(sunflowerMejoras.level).toBe(1)

    const bonkMejoras = mejorasDeLaCartaEnSlot(run.deck, 'bonkchoy', 1)
    expect(bonkMejoras.level).toBe(3)
    expect(bonkMejoras.statRolls).toEqual(['damage', 'hp'])

    const { NIVEL_POR_DEFECTO } = await import('../engine/bot')
    const state = createBattleState(12345, false, false, NIVEL_POR_DEFECTO, 'auth-v2')
    const sunflowerEntity = crearPlantaPropia(state, 'sunflower', 0, 1, sunflowerMejoras.statRolls, sunflowerMejoras.level)
    expect(sunflowerEntity.level).toBe(1)

    const bonkEntity = crearPlantaPropia(state, 'bonkchoy', 0, 2, bonkMejoras.statRolls, bonkMejoras.level)
    expect(bonkEntity.level).toBe(3)
  })

  it('10. Las opciones de plantas (normales y fusionadas) NUNCA se repiten con las cartas del mazo activo', () => {
    for (let i = 0; i < 20; i++) {
      const run = ArenaAdsManager.startNewRun()
      const deckPlantIds = new Set(run.deck.map((c) => c.plantId))
      expect(deckPlantIds.size).toBe(5)
      expect(deckPlantIds.has('sunflower')).toBe(true)

      const normalOptions = run.currentPrepChoice?.normalPlantOptions || []
      const fusedOptions = run.currentPrepChoice?.fusedPlantOptions || []

      expect(normalOptions.length).toBe(3)
      expect(fusedOptions.length).toBe(3)

      for (const opt of normalOptions) {
        expect(deckPlantIds.has(opt.plantId)).toBe(false)
        expect(opt.plantId).not.toBe('sunflower')
      }

      for (const opt of fusedOptions) {
        expect(deckPlantIds.has(opt.plantId)).toBe(false)
        expect(opt.plantId).not.toBe('sunflower')
      }

      const normalIds = new Set(normalOptions.map((o) => o.plantId))
      for (const opt of fusedOptions) {
        expect(normalIds.has(opt.plantId)).toBe(false)
      }
    }
  })

  it('11. Limpieza estricta de progreso al perder (derrota): elimina la run de caché e inicia juego nuevo', () => {
    const run = ArenaAdsManager.startNewRun()
    expect(ArenaAdsManager.getStoredRun()).not.toBeNull()

    ArenaAdsManager.handleDefeat(run)
    expect(run.status).toBe('game_over')
    expect(ArenaAdsManager.getStoredRun()).toBeNull()
    expect(localStorage.getItem(ARENA_ADS_STORAGE_KEY)).toBeNull()

    const freshRun = ArenaAdsManager.startNewRun()
    expect(freshRun.level).toBe(1)
    expect(freshRun.status).toBe('prep')
    expect(freshRun.accumulatedRewards.gold).toBe(0)
    expect(freshRun.accumulatedRewards.gems).toBe(0)
  })

  it('12. Tabla de los 50 Niveles: Exactamente 300 Gemas en total y 0 Oro', () => {
    let totalGems = 0
    let totalGold = 0

    for (let lvl = 1; lvl <= 50; lvl++) {
      const rewards = getFixedRewardsForLevel(lvl, 1)
      for (const rew of rewards) {
        if (rew.type === 'gems') {
          totalGems += rew.amount
        } else if (rew.type === 'gold') {
          totalGold += rew.amount
        }
      }
    }

    expect(totalGold).toBe(0) // Cero oro en toda la mazmorra
    expect(totalGems).toBe(300) // Exactamente 300 gemas acumuladas
  })

  it('13. Distribución estricta de Sobres: 1 Común (Lv10), 4 PvP (Lv15, 25, 30, 35) y 1 Místico (Lv40)', () => {
    const packMap: Record<number, string> = {}

    for (let lvl = 1; lvl <= 50; lvl++) {
      const rewards = getFixedRewardsForLevel(lvl, 1)
      for (const rew of rewards) {
        if (rew.type === 'pack' && rew.packId) {
          packMap[lvl] = rew.packId
        }
      }
    }

    expect(Object.keys(packMap).length).toBe(6) // 6 sobres en total
    expect(packMap[10]).toBe('basic') // Nivel 10: 1 pack común
    expect(packMap[15]).toBe('pvp') // Nivel 15: 1 sobre pvp
    expect(packMap[25]).toBe('pvp') // Nivel 25: 1 sobre pvp
    expect(packMap[30]).toBe('pvp') // Nivel 30: 1 sobre pvp
    expect(packMap[35]).toBe('pvp') // Nivel 35: 1 sobre pvp
    expect(packMap[40]).toBe('epic') // Nivel 40: 1 pack místico/épico
  })

  it('14. Distribución estricta de Skins: 5 Skins exclusivas a partir de Nivel 30 (30, 35, 40, 45, 50)', () => {
    const skinMap: Record<number, string> = {}

    for (let lvl = 1; lvl <= 50; lvl++) {
      const rewards = getFixedRewardsForLevel(lvl, 1)
      for (const rew of rewards) {
        if (rew.isExclusiveItem && rew.itemId) {
          skinMap[lvl] = rew.itemId
        }
      }
    }

    expect(Object.keys(skinMap).length).toBe(5)
    // Ninguna skin por debajo del Nivel 30
    for (let lvl = 1; lvl < 30; lvl++) {
      expect(skinMap[lvl]).toBeUndefined()
    }
    expect(skinMap[30]).toBe('sunflower_glasses') // Nivel 30: Gafas Girasol
    expect(skinMap[35]).toBe('superman_suit') // Nivel 35: Superman Nuez
    expect(skinMap[40]).toBe('spiderman_suit') // Nivel 40: Spiderman Nuez
    expect(skinMap[45]).toBe('ironman_suit') // Nivel 45: Reactor Iron Man
    expect(skinMap[50]).toBe('gold_24k') // Nivel 50: Nuez Bañada en Oro 24K
  })

  it('15. Compatibilidad y estadísticas de combate de todos los ítems y skins con alias de plantas', async () => {
    const { getScaledPlantConfig, isPlantMatchingTarget } = await import('./gameConstants')
    const { crearPlantaPropia, createBattleState } = await import('../engine/simulate')
    const { NIVEL_POR_DEFECTO } = await import('../engine/bot')

    // Probar Cactus con Armadura de Cactus
    expect(isPlantMatchingTarget('chomper', 'cactus')).toBe(true)
    const cactusScaled = getScaledPlantConfig('chomper', [], 'cactus_armor')
    expect(cactusScaled.damage).toBe(35 + 15)
    expect(cactusScaled.sprite).toBe('/game-assets/skins/armaduraconcactus.webp')

    // Probar Squash con Armadura Samurái
    expect(isPlantMatchingTarget('garlic', 'squash')).toBe(true)
    const squashScaled = getScaledPlantConfig('garlic', [], 'samurai_armor')
    expect(squashScaled.cooldownMs).toBe(Math.max(1000, 7500 - 1500))
    expect(squashScaled.sprite).toBe('/game-assets/skins/squashsamurai.webp')

    // Probar Nuez con Superman (+200 HP)
    const wallnutSuperman = getScaledPlantConfig('wallnut', [], 'superman_suit')
    expect(wallnutSuperman.maxHp).toBe(1200 + 200)
    expect(wallnutSuperman.sprite).toBe('/game-assets/skins/papasuperman.webp')

    // Probar Nuez con Bañado en Oro 24K (+300 HP, -2s recarga)
    const wallnutGold = getScaledPlantConfig('wallnut', [], 'gold_24k')
    expect(wallnutGold.maxHp).toBe(1200 + 300)
    expect(wallnutGold.cooldownMs).toBe(Math.max(1000, 15000 - 2000))
    expect(wallnutGold.sprite).toBe('/game-assets/skins/papa24k.webp')

    // Probar creación de entidad en combate con sprite y vida bonificada
    const state = createBattleState(999, false, false, NIVEL_POR_DEFECTO, 'auth-v2')
    const goldEntity = crearPlantaPropia(state, 'wallnut', 0, 2, [], 1, 'gold_24k')
    expect(goldEntity.maxHp).toBe(1500)
    expect(goldEntity.hp).toBe(1500)
    expect(goldEntity.spriteOverride).toBe('/game-assets/skins/papa24k.webp')
    expect(goldEntity.equippedItem).toBe('gold_24k')
  })

  it('16. Evento de preparación: Hitos (10, 15, 20, 25, 30, 35, 40, 45, 50) garantizan botín fijo', () => {
    for (const lvl of [10, 15, 20, 25, 30, 35, 40, 45, 50]) {
      const prep = generateLevelPrep(lvl)
      expect(prep.eventType).toBe('reward')
    }
  })

  it('17. Multiplicador de entrada en Gemas duplica recursos y gemas, pero NUNCA sobres ni skins', () => {
    // Nivel 30 con multiplicador 2x
    const rewards2x = getFixedRewardsForLevel(30, 2)
    const gemsReward = rewards2x.find((r) => r.type === 'gems')
    const packReward = rewards2x.find((r) => r.type === 'pack')
    const skinReward = rewards2x.find((r) => r.isExclusiveItem)

    expect(gemsReward?.amount).toBe(40) // 20 * 2 = 40
    expect(packReward?.amount).toBe(1) // Siempre 1
    expect(skinReward?.amount).toBe(1) // Siempre 1
  })

  it('18. Duplicar Recompensa: Disponible desde Nivel 1 y NUNCA en hitos con skins exclusivas o sobres', () => {
    // Niveles con sobres o skins nunca permiten duplicar por anuncio (Lv 10, 15, 25, 30, 35, 40, 45, 50)
    for (const lvl of [10, 15, 25, 30, 35, 40, 45, 50]) {
      const prep = generateLevelPrep(lvl)
      expect(prep.canDoubleReward).toBeFalsy()
    }
    // Pisos de recursos/cultivo (Lv 1, 2, 3, 4) SIEMPRE permiten duplicar para monetización Web3
    for (const lvl of [1, 2, 3, 4]) {
      const prep = generateLevelPrep(lvl)
      expect(prep.canDoubleReward).toBe(true)
    }
  })

  it('19. Primera Victoria vs Piso Repetido (Blindaje de Hito Único por Cuenta y Solo 1 Recompensa a la Mitad)', () => {
    // Nivel 30 como Primera Victoria (incluye Sobre PvP y Skin Gafas)
    const firstTimeRewards = getFixedRewardsForLevel(30, 1, true)
    expect(firstTimeRewards.some((r) => r.type === 'gems' && r.amount === 20)).toBe(true)
    expect(firstTimeRewards.some((r) => r.type === 'pack' && r.packId === 'pvp')).toBe(true)
    expect(firstTimeRewards.some((r) => r.isExclusiveItem && r.itemId === 'sunflower_glasses')).toBe(true)

    // Nivel 30 como Piso Repetido (isFirstTime = false) -> Solo 1 recompensa (Fertilizante por ser par, mitad = 4)
    const repeatRewards = getFixedRewardsForLevel(30, 1, false)
    expect(repeatRewards.length).toBe(1)
    expect(repeatRewards.some((r) => r.type === 'gems')).toBe(false) // 0 gemas
    expect(repeatRewards.some((r) => r.type === 'pack')).toBe(false) // 0 sobres
    expect(repeatRewards.some((r) => r.isExclusiveItem)).toBe(false) // 0 skins
    expect(repeatRewards[0].itemId).toBe('fertilizer')
    expect(repeatRewards[0].amount).toBe(4) // Mitad de la escala de 8
    expect(repeatRewards[0].isRepeatFloor).toBe(true)

    // Nivel 1 (Piso repetido con agua original: 5 -> mitad = 2 Aguas)
    const repeatLv1 = getFixedRewardsForLevel(1, 1, false)
    expect(repeatLv1.length).toBe(1)
    expect(repeatLv1[0].itemId).toBe('water')
    expect(repeatLv1[0].amount).toBe(2)

    // Nivel 6 (Piso repetido con agua original: 8 -> mitad = 4 Aguas)
    const repeatLv6 = getFixedRewardsForLevel(6, 1, false)
    expect(repeatLv6.length).toBe(1)
    expect(repeatLv6[0].itemId).toBe('water')
    expect(repeatLv6[0].amount).toBe(4)
  })

  it('20. Rastreo autoritativo de newlyClaimedLevels y alreadyClaimedLevels en el ciclo de victoria', () => {
    // El jugador ya completó históricamente los pisos 1 y 2
    const initialClaimed = [1, 2]
    let run = ArenaAdsManager.startNewRun('gold', 99999, initialClaimed)
    expect(run.alreadyClaimedLevels).toEqual([1, 2])
    expect(run.newlyClaimedLevels).toEqual([])

    // Nivel 1 es repetido -> solo da recursos, 0 gemas, y no entra a newlyClaimedLevels
    run = ArenaAdsManager.completeLevelVictory(run)
    expect(run.accumulatedRewards.gems).toBe(0)
    expect(run.newlyClaimedLevels).toEqual([]) // Sigue vacío

    // Avanzamos al Nivel 2 (también repetido)
    run = ArenaAdsManager.advanceToNextLevel(run)
    expect(run.level).toBe(2)
    run = ArenaAdsManager.completeLevelVictory(run)
    expect(run.accumulatedRewards.gems).toBe(0)
    expect(run.newlyClaimedLevels).toEqual([])

    // Avanzamos al Nivel 3 (PRIMERA VICTORIA)
    run = ArenaAdsManager.advanceToNextLevel(run)
    expect(run.level).toBe(3)
    run = ArenaAdsManager.completeLevelVictory(run)
    // Nivel 3 otorga fragmento de pala y es nuevo
    expect(run.newlyClaimedLevels).toContain(3)
    expect(run.alreadyClaimedLevels).toContain(3)

    // Avanzamos al Nivel 5 (PRIMERA VICTORIA con Gemas)
    run.level = 5 // Forzamos nivel 5 para verificar gemas de primera victoria
    run = ArenaAdsManager.completeLevelVictory(run)
    expect(run.accumulatedRewards.gems).toBe(5) // Gana sus 5 gemas
    expect(run.newlyClaimedLevels).toContain(5)
    expect(run.alreadyClaimedLevels).toContain(5)
  })

  it('21. Nivel 50: Gran Hito Final de 75 Gemas Supremas y Nuez de Oro 24K solo una vez', () => {
    // Primera victoria en Nivel 50
    const rewardsFirstTime = getFixedRewardsForLevel(50, 1, true)
    const gemsFirst = rewardsFirstTime.find((r) => r.type === 'gems')
    const skinFirst = rewardsFirstTime.find((r) => r.isExclusiveItem)
    expect(gemsFirst?.amount).toBe(75)
    expect(skinFirst?.itemId).toBe('gold_24k')

    // Piso repetido en Nivel 50 (da solo 1 recurso: Fertilizante, mitad = 4)
    const rewardsRepeat = getFixedRewardsForLevel(50, 1, false)
    expect(rewardsRepeat.length).toBe(1)
    expect(rewardsRepeat.some((r) => r.type === 'gems')).toBe(false)
    expect(rewardsRepeat.some((r) => r.isExclusiveItem)).toBe(false)
    expect(rewardsRepeat[0].itemId).toBe('fertilizer')
    expect(rewardsRepeat[0].amount).toBe(4)
  })

  it('22. Regla estricta: NUNCA dar más de 8 Aguas ni 8 Fertilizantes en primera victoria en los 50 niveles', () => {
    for (let lvl = 1; lvl <= 50; lvl++) {
      const rewards = getFixedRewardsForLevel(lvl, 1, true)
      for (const rew of rewards) {
        if (rew.itemId === 'water' || rew.itemId === 'fertilizer') {
          expect(rew.amount).toBeLessThanOrEqual(8)
        }
      }
    }
  })
})
