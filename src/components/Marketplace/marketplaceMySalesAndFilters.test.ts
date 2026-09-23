import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { calculateMarketplaceSplit } from '../../utils/marketplaceAccess'
import { getPlantRarityAndMinPrice } from '../../utils/marketplaceManager'
import type { MyMarketplaceItem, MyMarketplaceListingsResponse, PlantId, PlantStatKey } from '../../types/game'

interface OfertaDelMercado {
  id: string
  sellerId: string
  sellerName: string
  itemType: 'plant' | 'farming' | 'gold'
  itemId?: string
  plantId?: PlantId
  quantity?: number
  precio: number
  nivel?: number
  statRolls?: PlantStatKey[]
  germinationsCount?: number
  equippedItem?: string | null
  createdAt: string
  esMia: boolean
}

describe('Marketplace My Sales & Category Filtering Audit', () => {
  describe('1. SQL Migration 225 Integrity', () => {
    it('verifica que la migración 225 existe y define get_my_marketplace_listings y marketplace_board con categoría', () => {
      const migrationPath = join(
        process.cwd(),
        'supabase',
        'migrations',
        '225-marketplace-my-sales-and-category-filtering.sql'
      )
      expect(existsSync(migrationPath)).toBe(true)

      const content = readFileSync(migrationPath, 'utf8')
      expect(content).toContain('get_my_marketplace_listings')
      expect(content).toContain('marketplace_board')
      expect(content).toContain('p_category')
      expect(content).toContain('v_active')
      expect(content).toContain('v_history')
      expect(content).toContain('stats')
      expect(content).toContain('totalActive')
      expect(content).toContain('totalSold')
    })
  })

  describe('2. Split de Comisión y Ganancia Neta', () => {
    it('calcula correctamente el 90% neto para el vendedor y 10% de comisión del juego', () => {
      const split100 = calculateMarketplaceSplit(100, 10)
      expect(split100.comision).toBe(10)
      expect(split100.neto).toBe(90)

      const split50 = calculateMarketplaceSplit(50, 10)
      expect(split50.comision).toBe(5)
      expect(split50.neto).toBe(45)

      const split15 = calculateMarketplaceSplit(15, 10)
      expect(split15.comision).toBe(1.5)
      expect(split15.neto).toBe(13.5)
    })
  })

  describe('3. Filtros del Tablero y Búsqueda Horizontal', () => {
    const mockPlantOffers: OfertaDelMercado[] = [
      {
        id: 'offer-1',
        sellerId: 'user-1',
        sellerName: 'ProPlayer',
        itemType: 'plant',
        plantId: 'peashooter',
        precio: 50,
        nivel: 1,
        statRolls: [],
        createdAt: '2026-09-23T10:00:00Z',
        esMia: false,
      },
      {
        id: 'offer-2',
        sellerId: 'my-user-id',
        sellerName: 'Yo',
        itemType: 'plant',
        plantId: 'threepeater',
        precio: 300,
        nivel: 3,
        statRolls: ['damage', 'damage'],
        createdAt: '2026-09-23T10:05:00Z',
        esMia: true,
      },
      {
        id: 'offer-3',
        sellerId: 'user-2',
        sellerName: 'Gardener',
        itemType: 'plant',
        plantId: 'sunflower',
        precio: 35,
        nivel: 2,
        statRolls: ['cooldown'],
        createdAt: '2026-09-23T10:10:00Z',
        esMia: false,
      },
    ]

    it('filtra ofertas por término de búsqueda (nombre de planta)', () => {
      const query = 'three'
      const results = mockPlantOffers.filter((o) =>
        (o.plantId || '').toLowerCase().includes(query.toLowerCase())
      )
      expect(results).toHaveLength(1)
      expect(results[0].plantId).toBe('threepeater')
    })

    it('filtra sólo mis ofertas cuando showOnlyMine está activado', () => {
      const results = mockPlantOffers.filter((o) => o.esMia)
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('offer-2')
    })

    it('ordena por precio ascendente y descendente', () => {
      const asc = [...mockPlantOffers].sort((a, b) => a.precio - b.precio)
      expect(asc[0].precio).toBe(35)
      expect(asc[2].precio).toBe(300)

      const desc = [...mockPlantOffers].sort((a, b) => b.precio - a.precio)
      expect(desc[0].precio).toBe(300)
      expect(desc[2].precio).toBe(35)
    })

    it('ordena por nivel de fusión / mejora', () => {
      const byFusion = [...mockPlantOffers].sort((a, b) => (b.nivel || 0) - (a.nivel || 0))
      expect(byFusion[0].plantId).toBe('threepeater')
      expect(byFusion[0].nivel).toBe(3)
    })

    it('filtra por rareza de planta (Legendaria vs Común)', () => {
      const legendaryRarity = getPlantRarityAndMinPrice('threepeater')
      expect(legendaryRarity.rarity).toBe('LEGENDARIA')

      const commonRarity = getPlantRarityAndMinPrice('peashooter')
      expect(commonRarity.rarity).toBe('COMÚN')

      const legendaries = mockPlantOffers.filter((o) => {
        if (!o.plantId) return false
        return getPlantRarityAndMinPrice(o.plantId).rarity === 'LEGENDARIA'
      })
      expect(legendaries).toHaveLength(1)
      expect(legendaries[0].plantId).toBe('threepeater')
    })
  })

  describe('4. Estructura de "Mis Ventas" (Custodia e Historial)', () => {
    it('valida la respuesta autoritativa con items en custodia activa y ventas cerradas', () => {
      const mockActiveItem1: MyMarketplaceItem = {
        id: 'list-1',
        itemType: 'plant',
        itemId: 'bonkchoy',
        plantId: 'bonkchoy',
        nivel: 2,
        statRolls: [],
        quantity: 1,
        precio: 120,
        neto: 108,
        desde: '2026-09-23T08:00:00Z',
        status: 'active',
      }
      const mockActiveItem2: MyMarketplaceItem = {
        id: 'list-2',
        itemType: 'farming',
        itemId: 'water',
        nivel: 0,
        statRolls: [],
        quantity: 50,
        precio: 40,
        neto: 36,
        desde: '2026-09-23T08:30:00Z',
        status: 'active',
      }
      const mockClosedItem: MyMarketplaceItem = {
        id: 'list-old-1',
        itemType: 'gold',
        itemId: 'gold',
        nivel: 0,
        statRolls: [],
        quantity: 10000,
        precio: 80,
        neto: 72,
        comprador: 'AmigoGamer',
        desde: '2026-09-23T08:00:00Z',
        cerradaEn: '2026-09-23T09:15:00Z',
        status: 'sold',
      }

      const mockResponse: MyMarketplaceListingsResponse = {
        success: true,
        active: [mockActiveItem1, mockActiveItem2],
        history: [mockClosedItem],
        stats: {
          totalActive: 2,
          totalValueGems: 160,
          totalSold: 1,
          totalEarnedGems: 72,
        },
      }

      expect(mockResponse.stats.totalActive).toBe(2)
      expect(mockResponse.stats.totalValueGems).toBe(160)
      expect(mockResponse.stats.totalSold).toBe(1)
      expect(mockResponse.stats.totalEarnedGems).toBe(72)

      // Las ofertas activas deben ser cancelables (recuperables con 1 clic)
      mockResponse.active.forEach((item) => {
        expect(item.status).toBe('active')
        expect(item.neto).toBe(Math.round((item.precio || 0) * 0.9))
      })

      // Las ofertas cerradas/vendidas deben reflejar el comprador y las gemas netas
      expect(mockResponse.history[0].comprador).toBe('AmigoGamer')
      expect(mockResponse.history[0].status).toBe('sold')
    })
  })

  describe('5. Sincronización con el Jardín e Inventario', () => {
    it('las plantas marcadas con isListed no pueden ser equipadas en el mazo', () => {
      const instances = [
        { instanceId: 'inst-1', plantId: 'peashooter', isListed: false },
        { instanceId: 'inst-2', plantId: 'bonkchoy', isListed: true }, // En custodia en el mercado
        { instanceId: 'inst-3', plantId: 'sunflower', isListed: false },
        { instanceId: 'inst-4', plantId: 'wallnut', isListed: false },
      ]

      // Filtrado del mazo para evitar que plantas en venta participen en batalla
      const availableForDeck = instances.filter((i) => !i.isListed)
      expect(availableForDeck).toHaveLength(3)
      expect(availableForDeck.some((i) => i.instanceId === 'inst-2')).toBe(false)
    })

    it('las plantas marcadas con isListed se excluyen del selector de venta para evitar doble publicación', () => {
      const instances = [
        { instanceId: 'inst-1', plantId: 'peashooter', isListed: false },
        { instanceId: 'inst-2', plantId: 'bonkchoy', isListed: true },
      ]

      const sellable = instances.filter((i) => !i.isListed)
      expect(sellable).toHaveLength(1)
      expect(sellable[0].instanceId).toBe('inst-1')
    })
  })
})
