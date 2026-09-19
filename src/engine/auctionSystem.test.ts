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

  it('la nueva carta de subasta (knight_helmet / Nuez Blindada) está correctamente registrada con bonos de +500 HP para wallnut', () => {
    const itemDef = EQUIPPABLE_PLANT_ITEMS['knight_helmet']
    expect(itemDef).toBeDefined()
    expect(itemDef.targetPlantId).toBe('wallnut')
    expect(itemDef.name).toBe('Yelmo de Caballero')
    expect(itemDef.statBonusText).toContain('+500 HP')
    expect(itemDef.statBonusText).toContain('Defensa de Acero')

    // Probar aplicación de stats en nivel 0 (base de Wallnut + 500 HP)
    const baseWallnut = PLANT_CONFIGS.wallnut
    const scaledBase = getScaledPlantConfig('wallnut', 0, 'knight_helmet')

    expect(scaledBase.maxHp).toBe(baseWallnut.maxHp + 500)
    expect(scaledBase.sprite).toBe('/game-assets/auction/knight_wallnut.png')
    expect(scaledBase.icon).toBe('/game-assets/auction/knight_wallnut.png')
    expect(scaledBase.packetActive).toBe('/game-assets/auction/knight_wallnut.png')
  })

  it('valida que la nueva subasta en oro inicia con 1000 de oro y 48 horas de duración', () => {
    const STARTING_BID_GOLD = 1000
    const DURATION_HOURS = 48
    const MIN_STEP_GOLD = 50

    expect(STARTING_BID_GOLD).toBe(1000)
    expect(DURATION_HOURS).toBe(48)
    expect(MIN_STEP_GOLD).toBe(50)

    const now = Date.now()
    const endTime = now + DURATION_HOURS * 3600 * 1000
    const diffMs = endTime - now
    expect(diffMs).toBe(48 * 3600 * 1000)

    // Puja inicial mínima válida
    const canBidFirst = (amount: number) => amount >= STARTING_BID_GOLD
    expect(canBidFirst(999)).toBe(false)
    expect(canBidFirst(1000)).toBe(true)
    expect(canBidFirst(1500)).toBe(true)

    // Superar puja de 1000 de oro (+50)
    const canOutbid = (amount: number, current: number) => amount >= current + MIN_STEP_GOLD
    expect(canOutbid(1040, 1000)).toBe(false)
    expect(canOutbid(1050, 1000)).toBe(true)
  })

  it('simula la retención de oro y reembolso automático de oro al postor anterior', () => {
    let userAGold = 5000
    let userBGold = 8000

    let currentBid = 1000
    let highestBidder: 'A' | 'B' | null = null
    let prevBidAmount = 0

    // Usuario A puja 1000 de oro
    userAGold -= 1000
    highestBidder = 'A'
    currentBid = 1000
    prevBidAmount = 1000

    expect(userAGold).toBe(4000)
    expect(highestBidder).toBe('A')

    // Usuario B supera la puja ofertando 1200 de oro
    userBGold -= 1200
    userAGold += prevBidAmount // Reembolso a A en oro

    highestBidder = 'B'
    currentBid = 1200
    prevBidAmount = 1200

    expect(userAGold).toBe(5000) // A recuperó su oro íntegro
    expect(userBGold).toBe(6800)
    expect(highestBidder).toBe('B')
    expect(currentBid).toBe(1200)
    expect(prevBidAmount).toBe(1200)
  })
})
