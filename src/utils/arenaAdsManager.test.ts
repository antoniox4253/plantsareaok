import { describe, it, expect, beforeEach } from 'vitest'
import {
  ArenaAdsManager,
  buildArenaAdsDeck,
  generateLevelPrep,
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

  it('3. Genera opciones válidas en la fase de preparación', () => {
    const prep = generateLevelPrep(1)
    expect(prep.rewardOption).toBeDefined()
    expect(['gold', 'gems', 'item']).toContain(prep.rewardOption.type)
    expect(prep.normalPlantOptions.length).toBe(3)
    expect(prep.fusedPlantOptions.length).toBe(3)

    // Las fusionadas deben tener statRolls y flag isFused
    for (const fused of prep.fusedPlantOptions) {
      expect(fused.isFused).toBe(true)
      expect(fused.statRolls.length).toBeGreaterThan(0)
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

  it('5. Aplicar ventaja: acumula recompensas o integra plantas fusionadas', () => {
    let run = ArenaAdsManager.startNewRun()

    // Caso A: Elegir Recompensa de Oro
    const rewardGold: ArenaAdsRewardOption = {
      type: 'gold',
      amount: 150,
      label: '+150 Oro',
      icon: '🪙',
    }
    run = ArenaAdsManager.applyAdvantageChoice(run, { type: 'reward', option: rewardGold })
    expect(run.accumulatedRewards.gold).toBe(150)
    expect(run.chosenAdvantage?.type).toBe('reward')

    // Caso B: Elegir Planta Fusionada para el siguiente nivel
    run = ArenaAdsManager.advanceToNextLevel(run)
    expect(run.level).toBe(2)

    const fusedOpt: ArenaAdsPlantOption = {
      plantId: 'bonkchoy',
      name: 'Bonk Choy [FUSIÓN]',
      isFused: true,
      level: 3,
      statRolls: ['damage', 'attackSpeed'],
      description: 'Potente',
    }
    run = ArenaAdsManager.applyAdvantageChoice(run, { type: 'plant_fused', option: fusedOpt })
    expect(run.deck[0].plantId).toBe('sunflower')
    expect(run.deck[1].plantId).toBe('bonkchoy')
    expect(run.deck[1].level).toBe(3)
    expect(run.deck[1].statRolls).toEqual(['damage', 'attackSpeed'])
  })

  it('6. Escalado de bots según el nivel de la mazmorra', () => {
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

  it('7. Flujo completo: victoria de nivel y avance o liquidación', () => {
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
})
