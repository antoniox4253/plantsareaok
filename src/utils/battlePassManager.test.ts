import { describe, it, expect } from 'vitest'
import { BATTLE_PASS_LEVELS } from './battlePassManager'

describe('BATTLE PASS SEASON 2 (XP PROGRESSION & EXCLUSIVE REWARDS)', () => {
  it('contiene exactamente 20 niveles consecutivos del 1 al 20', () => {
    expect(BATTLE_PASS_LEVELS).toHaveLength(20)
    BATTLE_PASS_LEVELS.forEach((lvl, idx) => {
      expect(lvl.level).toBe(idx + 1)
    })
  })

  it('los requisitos de XP son estrictamente crecientes desde 200 hasta 8000', () => {
    expect(BATTLE_PASS_LEVELS[0].requiredXp).toBe(200)
    expect(BATTLE_PASS_LEVELS[19].requiredXp).toBe(8000)

    for (let i = 1; i < BATTLE_PASS_LEVELS.length; i++) {
      expect(BATTLE_PASS_LEVELS[i].requiredXp).toBeGreaterThan(
        BATTLE_PASS_LEVELS[i - 1].requiredXp
      )
    }
  })

  it('rotaciones y exclusivas: Nivel 8 Repetidora/Pala/Oro y Nivel 9 Nuez Explosiva', () => {
    const lvl8 = BATTLE_PASS_LEVELS.find((l) => l.level === 8)!
    expect(lvl8.reward.plantId).toBe('repeater')
    expect(lvl8.reward.copiesCount).toBe(1)
    expect(lvl8.reward.itemId).toBe('shovel')
    expect(lvl8.reward.goldAmount).toBe(300)

    const lvl9 = BATTLE_PASS_LEVELS.find((l) => l.level === 9)!
    expect(lvl9.reward.plantId).toBe('explodeonut')
    expect(lvl9.reward.copiesCount).toBe(1)
  })

  it('rotaciones y exclusivas: Nivel 12 Pickled Pepper, Nivel 15 Sobre Básico y Nivel 19 Guisantralladora', () => {
    const lvl12 = BATTLE_PASS_LEVELS.find((l) => l.level === 12)!
    expect(lvl12.reward.plantId).toBe('pickledpepper')
    expect(lvl12.reward.copiesCount).toBe(1)

    const lvl15 = BATTLE_PASS_LEVELS.find((l) => l.level === 15)!
    expect(lvl15.reward.type).toBe('pack')
    expect(lvl15.reward.packId).toBe('basic')

    const lvl19 = BATTLE_PASS_LEVELS.find((l) => l.level === 19)!
    expect(lvl19.reward.plantId).toBe('gatlingpea')
    expect(lvl19.reward.copiesCount).toBe(1)
  })

  it('Nivel 20: Gran Premio Doble Supremo (Pack Legendario + Carta Legendaria + 1000 Oro)', () => {
    const lvl20 = BATTLE_PASS_LEVELS.find((l) => l.level === 20)!
    expect(lvl20.reward.type).toBe('legendary_double')
    expect(lvl20.reward.packId).toBe('legendary')
    expect(lvl20.reward.packCount).toBe(1)
    expect(lvl20.reward.goldAmount).toBe(1000)
    expect(lvl20.reward.secondaryLabel).toBe('Carta Legendaria Misteriosa')
  })

  it('validación de condiciones de claim basadas en XP anti-duplicado', () => {
    const currentXp = 1000
    const hasVipPass = true
    const claimedVipLevels = [1, 2]

    // Niveles con requiredXp <= 1000 son:
    // lvl 1 (200), lvl 2 (500), lvl 3 (850)
    // Con 1 y 2 ya reclamados, claimable contiene [3]
    const claimable = BATTLE_PASS_LEVELS.filter(
      (l) => hasVipPass && currentXp >= l.requiredXp && !claimedVipLevels.includes(l.level)
    )

    expect(claimable.map((l) => l.level)).toEqual([3])
    expect(claimedVipLevels.includes(1)).toBe(true)
    expect(claimedVipLevels.includes(2)).toBe(true)
  })
})
