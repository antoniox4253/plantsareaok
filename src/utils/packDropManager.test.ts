import { describe, it, expect } from 'vitest'
import { rollSingleCardFromPack, openSeedPack } from './packDropManager'

describe('packDropManager - Sistema de Ranura Destacada y Exclusión de Jalapeño y Lanzamaíz', () => {
  it('Jalapeño jamás se entrega en ningún tipo de sobre (básico, épico, legendario)', () => {
    const packs = ['basic', 'epic', 'legendary'] as const
    for (const packId of packs) {
      for (let i = 0; i < 200; i++) {
        const card = rollSingleCardFromPack(packId, [], i % 2 === 0)
        expect(card.plantId).not.toBe('jalapeno')
      }
    }
  })

  it('Lanzamaíz (kernelpult) jamás se entrega en ningún tipo de sobre (básico, épico, legendario)', () => {
    const packs = ['basic', 'epic', 'legendary'] as const
    for (const packId of packs) {
      for (let i = 0; i < 300; i++) {
        const card = rollSingleCardFromPack(packId, [], i % 2 === 0)
        expect(card.plantId).not.toBe('kernelpult')
      }
    }
  })

  it('Nuez Explosiva (explodeonut) jamás se entrega en ningún tipo de sobre (básico, épico, legendario, starter)', () => {
    const packs = ['basic', 'epic', 'legendary', 'starter'] as const
    for (const packId of packs) {
      for (let i = 0; i < 200; i++) {
        const pack = openSeedPack(packId, [])
        for (const card of pack) {
          expect(card.plantId).not.toBe('explodeonut')
        }
      }
    }
  })

  it('Sobre Básico entrega 3 cartas, máximo 1 Rara y nunca Épica ni Legendaria', () => {
    for (let i = 0; i < 100; i++) {
      const pack = openSeedPack('basic', [])
      expect(pack).toHaveLength(3)

      const rares = pack.filter((c) => c.rarityLabel === 'RARA')
      const epics = pack.filter((c) => c.rarityLabel === 'ÉPICA')
      const legendaries = pack.filter((c) => c.rarityLabel === 'LEGENDARIA')

      expect(rares.length).toBeLessThanOrEqual(1)
      expect(epics).toHaveLength(0)
      expect(legendaries).toHaveLength(0)
    }
  })

  it('Sobre Legendario entrega 4 cartas, NUNCA más de 1 Legendaria y NUNCA Común', () => {
    let packsWithLegendary = 0
    const totalPacks = 500

    for (let i = 0; i < totalPacks; i++) {
      const pack = openSeedPack('legendary', [])
      expect(pack).toHaveLength(4)

      // Jamás debe salir Común en sobre legendario
      const commons = pack.filter((c) => c.rarityLabel === 'COMÚN')
      expect(commons).toHaveLength(0)

      // Jamás 2 o más legendarias en el mismo sobre
      const legendaries = pack.filter((c) => c.rarityLabel === 'LEGENDARIA')
      expect(legendaries.length).toBeLessThanOrEqual(1)

      if (legendaries.length === 1) {
        packsWithLegendary++
      }
    }

    // La tasa de sobres con Legendaria debe rondar el 10% (tolerancia estadística amplia para 500 muestras: 5% a 16%)
    const rate = packsWithLegendary / totalPacks
    expect(rate).toBeGreaterThanOrEqual(0.05)
    expect(rate).toBeLessThanOrEqual(0.16)
  })

  it('Sobre Místico (Épico) entrega 3 cartas y máximo 1 Legendaria', () => {
    for (let i = 0; i < 100; i++) {
      const pack = openSeedPack('epic', [])
      expect(pack).toHaveLength(3)

      const legendaries = pack.filter((c) => c.rarityLabel === 'LEGENDARIA')
      expect(legendaries.length).toBeLessThanOrEqual(1)
    }
  })

  it('Pack Starter entrega exactamente 5 cartas garantizadas con las reglas requeridas', () => {
    for (let i = 0; i < 100; i++) {
      const pack = openSeedPack('starter', [])
      expect(pack).toHaveLength(5)

      // Carta 1: Girasol
      expect(pack[0].plantId).toBe('sunflower')
      expect(pack[0].rarityLabel).toBe('COMÚN')

      // Carta 2: Lanzaguisantes
      expect(pack[1].plantId).toBe('peashooter')
      expect(pack[1].rarityLabel).toBe('COMÚN')

      // Carta 3: Wall-nut
      expect(pack[2].plantId).toBe('wallnut')
      expect(pack[2].rarityLabel).toBe('COMÚN')

      // Carta 4: Poco común aleatoria (de las 6 del catálogo, incluyendo Snow Pea)
      expect(pack[3].rarityLabel).toBe('POCO COMÚN')
      expect(['garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash', 'snowpea']).toContain(pack[3].plantId)

      // Carta 5: Rara aleatoria (sin Jalapeño, Lanzamaíz ni Nuez Explosiva)
      expect(pack[4].rarityLabel).toBe('RARA')
      expect(['twinsunflower', 'ghostpepper', 'guacodile', 'marigold', 'toadstool', 'torchwood']).toContain(pack[4].plantId)
      expect(pack[4].plantId).not.toBe('jalapeno')
      expect(pack[4].plantId).not.toBe('explodeonut')
      expect(pack[4].plantId).not.toBe('kernelpult')
    }
  })
})
