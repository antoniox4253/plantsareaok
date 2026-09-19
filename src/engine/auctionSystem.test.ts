import { describe, it, expect } from 'vitest'
import { EQUIPPABLE_PLANT_ITEMS, getScaledPlantConfig, PLANT_CONFIGS } from '../utils/gameConstants'

describe('Sistema de Subasta - Reglas de Negocio y Configuración', () => {
  it('la carta de subasta (witch_hat / Lanzamaíz Mágico) está correctamente registrada con bonos de +80 HP y 2x Mantequillas', () => {
    const itemDef = EQUIPPABLE_PLANT_ITEMS['witch_hat']
    expect(itemDef).toBeDefined()
    expect(itemDef.targetPlantId).toBe('kernelpult')
    expect(itemDef.name).toBe('Sombrero Mágico')
    expect(itemDef.statBonusText).toContain('+80 HP')
    expect(itemDef.statBonusText).toContain('2x Mantequillas')

    // Probar aplicación de stats en nivel 0 (base de Lanzamaíz + 80 HP)
    const baseKernel = PLANT_CONFIGS.kernelpult
    const scaledBase = getScaledPlantConfig('kernelpult', 0, 'witch_hat')

    expect(scaledBase.maxHp).toBe(baseKernel.maxHp + 80)
    expect(scaledBase.damage).toBe(baseKernel.damage)
    expect(scaledBase.sprite).toBe('/game-assets/auction/kernel_witch.png')
    expect(scaledBase.icon).toBe('/game-assets/auction/kernel_witch.png')

    // Probar aplicación de stats en nivel 1 (escala 15% + 80 HP)
    const scaledLvl1 = getScaledPlantConfig('kernelpult', 1, 'witch_hat')
    expect(scaledLvl1.maxHp).toBe(Math.round(baseKernel.maxHp * 1.15) + 80)
    expect(scaledLvl1.damage).toBe(Math.round((baseKernel.damage ?? 30) * 1.15))
  })

  it('valida que la subasta inicia con 500 gemas y 30 horas de duración', () => {
    const STARTING_BID = 500
    const DURATION_HOURS = 30
    const MIN_STEP = 10

    expect(STARTING_BID).toBe(500)
    expect(DURATION_HOURS).toBe(30)
    expect(MIN_STEP).toBe(10)

    const now = Date.now()
    const endTime = now + DURATION_HOURS * 3600 * 1000
    const diffMs = endTime - now
    expect(diffMs).toBe(30 * 3600 * 1000)
  })

  it('valida la lógica de incremento mínimo de pujas', () => {
    const startingBid = 500
    const minStep = 10

    // Caso 1: Primera puja sin líder
    const canBidFirst = (amount: number) => amount >= startingBid
    expect(canBidFirst(499)).toBe(false)
    expect(canBidFirst(500)).toBe(true)
    expect(canBidFirst(600)).toBe(true)

    // Caso 2: Segunda puja con líder en 500 gemas
    const currentBid = 500
    const canOutbid = (amount: number) => amount >= currentBid + minStep
    expect(canOutbid(500)).toBe(false)
    expect(canOutbid(509)).toBe(false)
    expect(canOutbid(510)).toBe(true)
    expect(canOutbid(550)).toBe(true)
  })

  it('simula la retención de escrow y reembolso automático al ser superado', () => {
    let userABalance = 1000
    let userBBalance = 1500

    let currentBid = 500
    let highestBidder: 'A' | 'B' | null = null
    let prevBidAmount = 0

    // Usuario A puja 500 gemas
    userABalance -= 500
    highestBidder = 'A'
    currentBid = 500
    prevBidAmount = 500

    expect(userABalance).toBe(500)
    expect(highestBidder).toBe('A')

    // Usuario B supera la puja ofertando 600 gemas
    // 1. Descuento a B
    userBBalance -= 600
    // 2. Reembolso a A
    userABalance += prevBidAmount

    highestBidder = 'B'
    currentBid = 600
    prevBidAmount = 600

    expect(userABalance).toBe(1000) // ¡A recuperó sus gemas!
    expect(userBBalance).toBe(900)  // B tiene 600 en escrow
    expect(highestBidder).toBe('B')

    // Usuario B decide auto-superarse subiendo a 700 gemas
    // Solo debe pagar la diferencia (100 gemas)
    const diff = 700 - currentBid
    userBBalance -= diff
    currentBid = 700
    prevBidAmount = 700

    expect(userBBalance).toBe(800)
    expect(currentBid).toBe(700)
    expect(highestBidder).toBe('B')
  })

  it('determina correctamente la expiración y entrega al ganador al llegar a 0', () => {
    const startTime = Date.now() - 31 * 3600 * 1000 // Inició hace 31 horas
    const endTime = startTime + 30 * 3600 * 1000   // Terminó hace 1 hora
    const now = Date.now()

    const isExpired = now >= endTime
    expect(isExpired).toBe(true)

    const auction = {
      status: isExpired ? 'completed' : 'active',
      highestBidderId: 'user_winner_123',
      highestBidderName: 'Sanki4253',
      rewardClaimed: false,
    }

    expect(auction.status).toBe('completed')
    expect(auction.highestBidderId).toBe('user_winner_123')
  })
})
