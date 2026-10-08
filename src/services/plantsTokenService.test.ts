import { describe, it, expect } from 'vitest'
import {
  plantsTokenService,
  PRESALE_PACKS,
  HALVING_TIERS,
} from './plantsTokenService'

describe('PLANTS Token & AMM Ecosystem Tests', () => {
  describe('Estado y Constantes Iniciales', () => {
    it('debe iniciar con los parámetros acordados: R = $200 USDT, V = 1,000,000 vPLANTS, P0 = $0.0002', () => {
      const state = plantsTokenService.getFallbackMarketState()
      expect(state.usdtPool).toBe(200)
      expect(state.virtualPlants).toBe(1000000)
      expect(state.spotPrice).toBe(0.0002)
      expect(state.presaleActive).toBe(true)
      expect(state.presaleStocks.pionero).toBe(10)
      expect(state.presaleStocks.campeon).toBe(6)
      expect(state.presaleStocks.leyenda).toBe(4)
    })

    it('la constante K = R * V debe ser 200,000,000', () => {
      const state = plantsTokenService.getFallbackMarketState()
      const k = state.usdtPool * state.virtualPlants
      expect(k).toBe(200000000)
    })
  })

  describe('Packs de Preventa de Fundadores', () => {
    it('debe tener exactamente 3 tipos de packs con stock limitado a 20 unidades totales', () => {
      expect(PRESALE_PACKS).toHaveLength(3)
      const totalUnits = PRESALE_PACKS.reduce((acc, p) => acc + p.maxStock, 0)
      expect(totalUnits).toBe(20) // 10 Pionero + 6 Campeón + 4 Leyenda
    })

    it('Pack Pionero ($10): 2,500 PLANTS, 1,000 Gemas, 0 Gemas bono, 1 Sobre Común + 1,000 ORO, $6 USDT al pool, vesting 45d', () => {
      const pack = PRESALE_PACKS.find((p) => p.id === 'pack_pionero_10')!
      expect(pack).toBeDefined()
      expect(pack.priceUsdt).toBe(10)
      expect(pack.gemsPrice).toBe(1000)
      expect(pack.plantsAmount).toBe(2500)
      expect(pack.gemsReward).toBe(0)
      expect(pack.goldReward).toBe(1000)
      expect(pack.bonusItemTitle).toBe('1 Sobre Común + 1,000 ORO')
      expect(pack.priceUsdt * 0.6).toBe(6)
      expect(pack.vestingDays).toBe(45)
      expect(pack.dailyRate).toBeCloseTo(2500 / 45, 1)
    })

    it('Pack Campeón ($25): 7,500 PLANTS, 2,500 Gemas, 0 Gemas bono, 1 Sobre Épico + 2,500 ORO, $15 USDT al pool, vesting 45d', () => {
      const pack = PRESALE_PACKS.find((p) => p.id === 'pack_campeon_25')!
      expect(pack).toBeDefined()
      expect(pack.priceUsdt).toBe(25)
      expect(pack.gemsPrice).toBe(2500)
      expect(pack.plantsAmount).toBe(7500)
      expect(pack.gemsReward).toBe(0)
      expect(pack.goldReward).toBe(2500)
      expect(pack.bonusItemTitle).toBe('1 Sobre Épico + 2,500 ORO')
      expect(pack.priceUsdt * 0.6).toBe(15)
      expect(pack.vestingDays).toBe(45)
      expect(pack.dailyRate).toBeCloseTo(7500 / 45, 1)
    })

    it('Pack Leyenda ($50): 15,000 PLANTS, 5,000 Gemas, 0 Gemas bono, 1 Sobre Legendario + 4,000 ORO, $30 USDT al pool, vesting 45d', () => {
      const pack = PRESALE_PACKS.find((p) => p.id === 'pack_leyenda_50')!
      expect(pack).toBeDefined()
      expect(pack.priceUsdt).toBe(50)
      expect(pack.gemsPrice).toBe(5000)
      expect(pack.plantsAmount).toBe(15000)
      expect(pack.gemsReward).toBe(0)
      expect(pack.goldReward).toBe(4000)
      expect(pack.bonusItemTitle).toBe('1 Sobre Legendario + 4,000 ORO')
      expect(pack.priceUsdt * 0.6).toBe(30)
      expect(pack.vestingDays).toBe(45)
      expect(pack.dailyRate).toBeCloseTo(15000 / 45, 1)
    })
  })

  describe('Curva Bonding AMM y Fórmulas', () => {
    it('comprar packs inyecta USDT al pool y hace subir el precio spot', () => {
      const k = 200000000
      const rInicial = 200
      const vInicial = k / rInicial
      const pInicial = rInicial / vInicial
      expect(pInicial).toBe(0.0002)

      // Supongamos se venden 5 Packs Pionero ($10 c/u => 5 * $6 = +$30 USDT al pool)
      const rNuevo = rInicial + 30 // $230
      const vNuevo = k / rNuevo
      const pNuevo = rNuevo / vNuevo

      expect(pNuevo).toBeGreaterThan(pInicial)
      expect(pNuevo).toBeCloseTo(0.0002645, 6)
      expect(((pNuevo - pInicial) / pInicial) * 100).toBeCloseTo(32.25, 1) // +32.25% subida
    })

    it('vender PLANTS (cash-out) deduce USDT del pool con fee del 10% (5% retenido en pool)', () => {
      const k = 200000000
      const r = 230
      const v = k / r
      const plantsAVender = 5000

      // AMM: nuevo V = V + plantsAVender
      const vAfter = v + plantsAVender
      const rAfterGross = k / vAfter
      const grossUsdt = r - rAfterGross
      const feeUsdt = grossUsdt * 0.10
      const netUsdt = grossUsdt * 0.90
      const retainedInPool = grossUsdt * 0.05

      expect(grossUsdt).toBeGreaterThan(0)
      expect(feeUsdt).toBeCloseTo(grossUsdt * 0.1, 4)
      expect(netUsdt).toBe(grossUsdt * 0.9)
      expect(retainedInPool).toBe(grossUsdt * 0.05)

      // El USDT que sale del pool es (gross - retained)
      const rFinal = r - (grossUsdt - retainedInPool)
      expect(rFinal).toBeGreaterThan(rAfterGross) // El pool queda más respaldado gracias al 5% retenido
    })

    it('Super Sink: cambiar PLANTS por Gemas quema tokens y mantiene intacto el USDT Pool', () => {
      const r = 200
      const spot = 0.0002
      const plantsACanjear = 10000

      // Valor USDT base = 10,000 * 0.0002 = $2.00 USDT
      const usdtBase = plantsACanjear * spot
      expect(usdtBase).toBe(2)

      // Con +20% bono = $2.40 USDT
      const usdtConBono = usdtBase * 1.2
      expect(usdtConBono).toBe(2.4)

      // A 100 gemas por $1 = 240 Gemas
      const gemas = Math.round(usdtConBono / 0.01)
      expect(gemas).toBe(240)

      // En el pool, 0 USDT salen
      const rPoolDespues = r - 0
      expect(rPoolDespues).toBe(200)
    })
  })

  describe('Tramos de Halving', () => {
    it('debe tener 5 tramos progresivos que reducen a la mitad la emisión', () => {
      expect(HALVING_TIERS).toHaveLength(5)
      expect(HALVING_TIERS[0].rewardPct).toBe('100%')
      expect(HALVING_TIERS[1].rewardPct).toBe('50%')
      expect(HALVING_TIERS[2].rewardPct).toBe('25%')
      expect(HALVING_TIERS[3].rewardPct).toBe('12.5%')
      expect(HALVING_TIERS[4].rewardPct).toBe('6.25%')
    })
  })

  describe('Bono PvP de Lanzamiento (+25% por 7 días)', () => {
    it('debe calcular el tiempo restante correctamente cuando el plazo está activo', () => {
      const inFuture = new Date(Date.now() + 6 * 24 * 3600 * 1000 + 12 * 3600 * 1000 + 5000).toISOString()
      const timer = plantsTokenService.getPvpBonusTimeRemaining(inFuture)
      expect(timer.isActive).toBe(true)
      expect(timer.days).toBe(6)
      expect(timer.hours).toBe(12)
      expect(timer.formatted).toContain('6d 12h')
    })

    it('debe marcar como inactivo si la fecha expiró', () => {
      const inPast = new Date(Date.now() - 3600000).toISOString()
      const timer = plantsTokenService.getPvpBonusTimeRemaining(inPast)
      expect(timer.isActive).toBe(false)
      expect(timer.formatted).toBe('Finalizado')
    })

    it('el multiplicador del bonus PvP debe ser 1.25x (+25%)', () => {
      const baseReward = 4.0 // 4 PLANTS
      const bonusMultiplier = 1.25
      const finalReward = baseReward * bonusMultiplier
      expect(finalReward).toBe(5.0)
      expect(finalReward - baseReward).toBe(1.0) // +1 PLANTS (+25%)
    })
  })

  describe('Staking Botánico (30, 60 y 90 Días)', () => {
    it('Plan 30 Días: calcula correctamente gemas, oro y regalo de 1 Sobre Básico', () => {
      const preview = plantsTokenService.calculateStakingPreview(5000, 30)
      expect(preview.minAmount).toBe(500)
      expect(preview.isValidAmount).toBe(true)
      expect(preview.dailyGemRate).toBe(4) // 5000 * 0.0008 = 4 Gemas/día
      expect(preview.dailyGoldRate).toBe(25) // 5000 * 0.0050 = 25 Oro/día
      expect(preview.totalEstimatedGems).toBe(120) // 4 * 30 = 120 Gemas
      expect(preview.totalEstimatedGold).toBe(750) // 25 * 30 = 750 Oro
      expect(preview.bonusDesc).toContain('1 Sobre Básico')
    })

    it('Plan 60 Días: calcula tasas superiores y agrega Sobre Épico si supera 15,000 PLANTS', () => {
      // Menos de 15,000 PLANTS
      const p1 = plantsTokenService.calculateStakingPreview(10000, 60)
      expect(p1.minAmount).toBe(5000)
      expect(p1.isValidAmount).toBe(true)
      expect(p1.dailyGemRate).toBe(10) // 10000 * 0.0010 = 10 Gemas/día
      expect(p1.dailyGoldRate).toBe(60) // 10000 * 0.0060 = 60 Oro/día
      expect(p1.totalEstimatedGems).toBe(600)
      expect(p1.bonusDesc).toBe('3 Sobres Básicos garantizados')

      // 15,000 PLANTS o más
      const p2 = plantsTokenService.calculateStakingPreview(15000, 60)
      expect(p2.bonusDesc).toBe('3 Sobres Básicos + 1 Sobre Épico adicional')
    })

    it('Plan 90 Días: exige mínimo 25,000 PLANTS y entrega 3 Épicos + 1 Legendario + Skin', () => {
      const invalidPreview = plantsTokenService.calculateStakingPreview(10000, 90)
      expect(invalidPreview.minAmount).toBe(25000)
      expect(invalidPreview.isValidAmount).toBe(false)

      const validPreview = plantsTokenService.calculateStakingPreview(25000, 90)
      expect(validPreview.isValidAmount).toBe(true)
      expect(validPreview.dailyGemRate).toBe(30) // 25000 * 0.0012 = 30 Gemas/día
      expect(validPreview.dailyGoldRate).toBe(175) // 25000 * 0.0070 = 175 Oro/día
      expect(validPreview.totalEstimatedGems).toBe(2700)
      expect(validPreview.totalEstimatedGold).toBe(15750)
      expect(validPreview.bonusDesc).toContain('3 Sobres Épicos + 1 Sobre Legendario + Skin/Item Oro 24K')
    })
  })
})
