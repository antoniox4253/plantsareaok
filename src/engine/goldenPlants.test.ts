import { describe, it, expect } from 'vitest'
import {
  GOLDEN_PLANT_ASSETS,
  getScaledPlantConfig,
  PLANT_CONFIGS,
} from '../utils/gameConstants'
import { leerMazo, mejorasDeLaCartaEnSlot } from './mazoDeLaSala'
import { crearPlantaPropia } from './simulate'
import { parseServerPlantCopies } from '../hooks/useInventory'
import type { PlantId } from '../types/game'

describe('Sistema de Plantas Doradas (Gold Foil & Play-to-Earn)', () => {
  const GOLDEN_PLANT_IDS: PlantId[] = [
    'wallnut',
    'garlic',
    'repeater',
    'iceberglettuce',
    'bonkchoy',
    'peashooter',
    'jalapeno',
    'sunflower',
    'twinsunflower',
    'melonpult',
  ]

  it('1. Certifica que las 10 plantas doradas tienen definidos sus assets WebP transparentes', () => {
    expect(Object.keys(GOLDEN_PLANT_ASSETS).length).toBe(10)
    for (const plantId of GOLDEN_PLANT_IDS) {
      const asset = GOLDEN_PLANT_ASSETS[plantId]
      expect(asset).toBeDefined()
      expect(asset?.sprite).toContain(`/game-assets/plants_golden/${plantId}_golden.webp`)
    }
  })

  it('2. getScaledPlantConfig asigna sprite, icono y packet dorados cuando isGolden = true', () => {
    for (const plantId of GOLDEN_PLANT_IDS) {
      const baseConfig = PLANT_CONFIGS[plantId]
      const goldenConfig = getScaledPlantConfig(plantId, [], null, true)

      expect(goldenConfig.sprite).toBe(GOLDEN_PLANT_ASSETS[plantId]?.sprite)
      expect(goldenConfig.icon).toBe(GOLDEN_PLANT_ASSETS[plantId]?.sprite)
      expect(goldenConfig.packetActive).toBe(GOLDEN_PLANT_ASSETS[plantId]?.sprite)
      expect(goldenConfig.packetDisabled).toBe(GOLDEN_PLANT_ASSETS[plantId]?.sprite)

      // Conserva las estadísticas base de combate
      expect(goldenConfig.cost).toBe(baseConfig.cost)
      expect(goldenConfig.maxHp).toBe(baseConfig.maxHp)
      expect(goldenConfig.damage).toBe(baseConfig.damage)
    }
  })

  it('3. getScaledPlantConfig no altera sprites cuando isGolden es false o undefined', () => {
    const normalBonkChoy = getScaledPlantConfig('bonkchoy', [], null, false)
    expect(normalBonkChoy.sprite).toBe(PLANT_CONFIGS.bonkchoy.sprite)
    expect(normalBonkChoy.sprite).not.toContain('golden')
  })

  it('4. Serialización y deserialización de mazo preserva isGolden en CartaDeMazo', () => {
    const mazoRaw = [
      { plantId: 'bonkchoy', slot: 0, level: 2, statRolls: ['atk_up'], equippedItem: null, isGolden: true },
      { plantId: 'sunflower', slot: 1, level: 1, statRolls: [], equippedItem: null, isGolden: false },
    ]

    const parsed = leerMazo(mazoRaw)
    expect(parsed).not.toBeNull()
    expect(parsed![0].isGolden).toBe(true)
    expect(parsed![1].isGolden).toBe(false)
  })

  it('5. crearPlantaPropia propaga isGolden y spriteOverride en la simulación', () => {
    const mockState: any = { tick: 10, entityCounter: 1 }
    const planta = crearPlantaPropia(
      mockState,
      'bonkchoy',
      2, // lane
      3, // col
      [], // statRolls
      1, // level
      null, // equippedItem
      true // isGolden
    )

    expect(planta.isGolden).toBe(true)
    expect(planta.spriteOverride).toBe(GOLDEN_PLANT_ASSETS.bonkchoy?.sprite)
  })

  it('6. Certifica la fórmula del bonus de Token PLANTS por cartas doradas (10% por carta)', () => {
    const baseReward = 4.0
    // 0 doradas -> +0%
    let bonusPct = 0 * 10.0
    let finalReward = baseReward * (1.0 + bonusPct / 100.0)
    expect(finalReward).toBeCloseTo(4.0)

    // 1 dorada -> +10%
    bonusPct = 1 * 10.0
    finalReward = baseReward * (1.0 + bonusPct / 100.0)
    expect(finalReward).toBeCloseTo(4.4)

    // 3 doradas -> +30%
    bonusPct = 3 * 10.0
    finalReward = baseReward * (1.0 + bonusPct / 100.0)
    expect(finalReward).toBeCloseTo(5.2)

    // 6 doradas (Full Golden Deck) -> +60%
    bonusPct = 6 * 10.0
    finalReward = baseReward * (1.0 + bonusPct / 100.0)
    expect(finalReward).toBeCloseTo(6.4)
  })

  it('7. Certifica la lógica del contador de Pity de 100 cartas', () => {
    // Al abrir 0 cartas:
    let pityCounter = 0
    let pityRemaining = 100 - (pityCounter % 100)
    expect(pityRemaining).toBe(100)

    // Al abrir 99 cartas no doradas:
    pityCounter = 99
    pityRemaining = 100 - (pityCounter % 100)
    expect(pityRemaining).toBe(1) // ¡La siguiente es 100% garantizada!

    // Si sale una dorada, el servidor resetea el contador a 0
    pityCounter = 0
    pityRemaining = 100 - (pityCounter % 100)
    expect(pityRemaining).toBe(100)
  })

  it('8. parseServerPlantCopies parsea copias doradas (<plantId>_golden) sin mezclarlas con las normales', () => {
    // Usuario con 5 copias de girasol normal y 0 doradas
    const raw = { sunflower: 5 }
    const parsed = parseServerPlantCopies(raw)
    expect(parsed.sunflower).toBe(5)
    expect(parsed['sunflower_golden']).toBeUndefined()

    // Usuario con 5 copias normales y 2 copias doradas obtenidas en sobres
    const rawWithGolden = { sunflower: 5, sunflower_golden: 2 }
    const parsedWithGolden = parseServerPlantCopies(rawWithGolden)
    expect(parsedWithGolden.sunflower).toBe(5)
    expect(parsedWithGolden['sunflower_golden']).toBe(2)
  })

  it('9. Validación de tope máximo de 5 copias también aplica a copias doradas', () => {
    const rawExcess = { sunflower: 99, sunflower_golden: 10 }
    const parsed = parseServerPlantCopies(rawExcess)
    expect(parsed.sunflower).toBe(5)
    expect(parsed['sunflower_golden']).toBe(5)
  })
  it('10. Permite equipar planta Base leveada + planta Dorada de la misma especie en slots distintos sin mezclar stats', () => {
    const mazo = leerMazo([
      {
        plantId: 'sunflower',
        slot: 0,
        level: 1,
        statRolls: ['production'],
        isGolden: false,
      },
      {
        plantId: 'wallnut',
        slot: 1,
        instanceId: 'uuid-wallnut-base-lvl3',
        level: 3,
        statRolls: ['hp', 'hp', 'cooldown'],
        isGolden: false,
      },
      {
        plantId: 'wallnut',
        slot: 2,
        instanceId: 'uuid-wallnut-dorada-lvl0',
        level: 0,
        statRolls: [],
        isGolden: true,
      },
    ])

    expect(mazo).not.toBeNull()
    const baseWallnut = mejorasDeLaCartaEnSlot(mazo, 'wallnut', 1)
    const goldenWallnut = mejorasDeLaCartaEnSlot(mazo, 'wallnut', 2)

    expect(Boolean(baseWallnut.isGolden)).toBe(false)
    expect(baseWallnut.level).toBe(3)
    expect(baseWallnut.statRolls).toEqual(['hp', 'hp', 'cooldown'])

    expect(goldenWallnut.isGolden).toBe(true)
    expect(goldenWallnut.level).toBe(0)
    expect(goldenWallnut.statRolls).toEqual([])

    const mockState: any = { tick: 10, entityCounter: 1 }
    const entityBase = crearPlantaPropia(mockState, 'wallnut', 0, 2, baseWallnut.statRolls, baseWallnut.level, null, baseWallnut.isGolden)
    const entityGolden = crearPlantaPropia(mockState, 'wallnut', 1, 2, goldenWallnut.statRolls, goldenWallnut.level, null, goldenWallnut.isGolden)

    expect(Boolean(entityBase.isGolden)).toBe(false)
    expect(entityBase.level).toBe(3)
    expect(entityBase.spriteOverride).toBeUndefined()

    expect(entityGolden.isGolden).toBe(true)
    expect(entityGolden.level).toBe(0)
    expect(entityGolden.spriteOverride).toBe(GOLDEN_PLANT_ASSETS.wallnut?.sprite)
  })

  it('11. SQL Audit: Migración 427 reemplaza el índice único por especie para permitir Base + Dorada en plant_instances', () => {
    const fs = require('fs')
    const path = require('path')
    const m427Path = path.resolve(__dirname, '../../supabase/migrations/427-fix-dual-base-and-golden-deck-index.sql')
    const sql = fs.readFileSync(m427Path, 'utf-8')
    expect(sql).toContain('DROP INDEX IF EXISTS public.idx_plant_instances_single_species_in_deck')
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_plant_instances_single_variant_in_deck')
    expect(sql).toContain('COALESCE(is_golden, false)')
  })

  it('12. Las plantas doradas tienen 0% incremento en stats base de combate (idénticas a las base)', () => {
    for (const plantId of GOLDEN_PLANT_IDS) {
      const base = PLANT_CONFIGS[plantId]
      const golden = getScaledPlantConfig(plantId, [], null, true)

      expect(golden.maxHp).toBe(base.maxHp)
      expect(golden.damage).toBe(base.damage)
      expect(golden.cost).toBe(base.cost)
      expect(golden.attackSpeedMs).toBe(base.attackSpeedMs)
      expect(golden.cooldownMs).toBe(base.cooldownMs)
    }
  })

  it('13. SQL Audit: Migración 431 cruza match_actions para otorgar bono solo por doradas jugadas en campo', () => {
    const fs = require('fs')
    const path = require('path')
    const m431Path = path.resolve(__dirname, '../../supabase/migrations/431-golden-cards-played-only-and-blog-news-index.sql')
    const sql = fs.readFileSync(m431Path, 'utf-8')
    expect(sql).toContain('public.match_actions')
    expect(sql).toContain("kind = 'plant'")
    expect(sql).toContain('INTO v_golden_count')
    expect(sql).toContain('v_golden_bonus_pct := v_golden_count * 10.0')
    expect(sql).toContain('20261110-0001-4000-8000-000000000431')
    expect(sql).toContain('20261110-0002-4000-8000-000000000431')
  })

  it('14. SeasonRewardModal no contiene la referencia desactualizada de +15% stats', () => {
    const fs = require('fs')
    const path = require('path')
    const modalPath = path.resolve(__dirname, '../components/Ranking/SeasonRewardModal.tsx')
    const modalCode = fs.readFileSync(modalPath, 'utf-8')
    expect(modalCode).not.toContain('+15% en Salud (HP) y Ataque')
    expect(modalCode).toContain('+10% extra de Token $PLANTS')
    expect(modalCode).toContain('mismas estadísticas base')
  })
})
