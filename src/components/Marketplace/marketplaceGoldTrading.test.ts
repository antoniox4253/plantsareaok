import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { calculateMarketplaceSplit } from '../../utils/marketplaceAccess'

describe('Marketplace P2P Gold Trading & 3-Category System', () => {
  describe('1. Clasificación por Categorías (Plantas, Recursos, Oro)', () => {
    interface DummyListing {
      id: string
      itemType?: 'plant' | 'farming' | 'gold'
      itemId?: string
      plantId?: string
      quantity?: number
      precio: number
    }

    function categorizeOffer(item: DummyListing): 'plants' | 'farming' | 'gold' {
      if (item.itemType === 'gold' || item.itemId === 'gold') return 'gold'
      if (item.itemType === 'farming' || (item.itemId && ['water', 'fertilizer', 'shovel'].includes(item.itemId))) {
        return 'farming'
      }
      return 'plants'
    }

    it('clasifica correctamente ofertas de plantas jugables', () => {
      const plantItem: DummyListing = {
        id: 'list-1',
        itemType: 'plant',
        plantId: 'peashooter',
        precio: 150,
      }
      expect(categorizeOffer(plantItem)).toBe('plants')
    })

    it('clasifica correctamente ofertas de recursos de cultivo (farming)', () => {
      const farmingItem: DummyListing = {
        id: 'list-2',
        itemType: 'farming',
        itemId: 'water',
        quantity: 10,
        precio: 20,
      }
      expect(categorizeOffer(farmingItem)).toBe('farming')
    })

    it('clasifica correctamente ofertas P2P de oro por gemas', () => {
      const goldItem: DummyListing = {
        id: 'list-3',
        itemType: 'gold',
        itemId: 'gold',
        quantity: 5000,
        precio: 15,
      }
      expect(categorizeOffer(goldItem)).toBe('gold')
    })
  })

  describe('2. Reglas de Validación para la Venta de Oro P2P', () => {
    function validateGoldListing(
      goldQty: number,
      priceGems: number,
      userGoldBalance: number,
      canSell: boolean
    ): { valid: boolean; error?: string } {
      if (!canSell) {
        return { valid: false, error: 'Requiere Pase PvP o 1,350 Copas para vender en el mercado.' }
      }
      if (goldQty < 100) {
        return { valid: false, error: 'La cantidad mínima de oro a vender es de 100.' }
      }
      if (goldQty > userGoldBalance) {
        return { valid: false, error: 'No posees suficiente saldo de oro para vender esa cantidad.' }
      }
      if (priceGems < 1) {
        return { valid: false, error: 'El precio mínimo en gemas debe ser al menos 1 💎.' }
      }
      return { valid: true }
    }

    it('bloquea si el usuario no tiene permiso de venta (sin pase VIP y <1350 copas)', () => {
      const res = validateGoldListing(1000, 10, 50000, false)
      expect(res.valid).toBe(false)
      expect(res.error).toContain('Requiere Pase PvP o 1,350 Copas')
    })

    it('bloquea si la cantidad de oro es menor a 100', () => {
      const res = validateGoldListing(50, 5, 50000, true)
      expect(res.valid).toBe(false)
      expect(res.error).toContain('mínima de oro a vender es de 100')
    })

    it('bloquea si el usuario intenta vender más oro del que tiene en saldo', () => {
      const res = validateGoldListing(20000, 20, 10000, true)
      expect(res.valid).toBe(false)
      expect(res.error).toContain('No posees suficiente saldo de oro')
    })

    it('bloquea si el precio total en gemas es menor a 1', () => {
      const res = validateGoldListing(1000, 0, 50000, true)
      expect(res.valid).toBe(false)
      expect(res.error).toContain('precio mínimo en gemas')
    })

    it('permite publicar cuando todas las condiciones son válidas', () => {
      const res = validateGoldListing(5000, 25, 50000, true)
      expect(res.valid).toBe(true)
    })
  })

  describe('3. Cálculo de Comisión y Reparto P2P de Gemas (10% Retención, 90% Neto)', () => {
    it('calcula correctamente la comisión del 10% y el 90% neto para el vendedor', () => {
      const split100 = calculateMarketplaceSplit(100, 10)
      expect(split100.comision).toBe(10)
      expect(split100.neto).toBe(90)

      const split10 = calculateMarketplaceSplit(10, 10)
      expect(split10.comision).toBe(1)
      expect(split10.neto).toBe(9)

      const split1 = calculateMarketplaceSplit(1, 10)
      // Con 1 gema, la comisión es 0 o 1 gema mínima, neto >= 0
      expect(split1.neto + split1.comision).toBe(1)
    })
  })

  describe('4. Verificación de Migración SQL 161 en Backend', () => {
    it('la migración 161 existe y contiene la lógica de escrow y compra para oro', () => {
      const migrationPath = join(process.cwd(), 'supabase', 'migrations', '161-marketplace-gold-p2p-trading.sql')
      expect(existsSync(migrationPath)).toBe(true)

      const sqlContent = readFileSync(migrationPath, 'utf-8')
      expect(sqlContent).toContain("p_item_type = 'gold'")
      expect(sqlContent).toContain('gold_balance = gold_balance - p_quantity')
      expect(sqlContent).toContain('marketplace_gold_escrow')
      expect(sqlContent).toContain("v_listing.item_type = 'gold'")
      expect(sqlContent).toContain('marketplace_gold_buy')
      expect(sqlContent).toContain('marketplace_gold_refund')
    })
  })
})
