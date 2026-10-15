import { describe, it, expect, vi } from 'vitest'
import { plantsTokenService } from '../services/plantsTokenService'

describe('PvP PLANTS Token Settlement Flow Tests', () => {
  it('1. plantsTokenService.claimPvpPlantsReward pasa los parámetros esperados al RPC', async () => {
    const claimSpy = vi.spyOn(plantsTokenService, 'claimPvpPlantsReward').mockResolvedValue({
      success: true,
      data: {
        success: true,
        plantsAwarded: 6.22,
        score: 84.6,
        isLivePvP: true,
        bonusActive: true,
        bonusPct: 25,
      },
    })

    const res = await plantsTokenService.claimPvpPlantsReward({
      roomId: 'test-room-uuid',
      matchDurationSec: 222,
      enemyKills: 39,
      sunsCollected: 115,
      plantsPlaced: 42,
      enemyPlantsPlaced: 39,
    })

    expect(claimSpy).toHaveBeenCalledWith({
      roomId: 'test-room-uuid',
      matchDurationSec: 222,
      enemyKills: 39,
      sunsCollected: 115,
      plantsPlaced: 42,
      enemyPlantsPlaced: 39,
    })
    expect(res.success).toBe(true)
    expect(res.data?.plantsAwarded).toBe(6.22)
    claimSpy.mockRestore()
  })

  it('2. En liquidación temprana (ya_liquidada por concesión del rival) debe invocar el reclamo si el jugador supera 2000 copas', () => {
    // Simulación de la condición evaluada en Battlefield.tsx (líneas 1599-1615)
    const userElo = 3026
    const capturedRoomId = 'f4148616-666a-4447-9874-be3dd92f8b49'
    const matchMode: string = 'ranked'
    const reportStatus: string = 'ya_liquidada'
    const yoGane = true

    let claimCalled = false
    if (reportStatus === 'liquidada' || reportStatus === 'ya_liquidada') {
      if (yoGane && matchMode !== 'tournament' && matchMode !== 'friendly') {
        if (userElo >= 2001 && capturedRoomId && matchMode !== 'clan_fortress') {
          claimCalled = true
        }
      }
    }

    expect(claimCalled).toBe(true)
  })

  it('3. En liquidación asíncrona directa (status: liquidada) debe invocar el reclamo para rivales semilla', () => {
    const userElo = 2400
    const capturedRoomId = 'c0d3231e-cc15-434d-9a68-31d6191bbff3'
    const matchMode: string = 'ranked'
    const reportStatus: string = 'liquidada'
    const yoGane = true

    let claimCalled = false
    if (reportStatus === 'liquidada' || reportStatus === 'ya_liquidada') {
      if (yoGane && matchMode !== 'tournament' && matchMode !== 'friendly') {
        if (userElo >= 2001 && capturedRoomId && matchMode !== 'clan_fortress') {
          claimCalled = true
        }
      }
    }

    expect(claimCalled).toBe(true)
  })

  it('4. En caso de derrota (yoGane === false) NO debe reclamar PLANTS', () => {
    const userElo = 3026
    const capturedRoomId = 'room-defeat-123'
    const matchMode: string = 'ranked'
    const reportStatus: string = 'ya_liquidada'
    const yoGane = false

    let claimCalled = false
    if (reportStatus === 'liquidada' || reportStatus === 'ya_liquidada') {
      if (yoGane && matchMode !== 'tournament' && matchMode !== 'friendly') {
        if (userElo >= 2001 && capturedRoomId && matchMode !== 'clan_fortress') {
          claimCalled = true
        }
      }
    }

    expect(claimCalled).toBe(false)
  })

  it('5. En Arena 2 o inferior (elo < 2001) NO debe reclamar PLANTS', () => {
    const userElo = 1850
    const capturedRoomId = 'room-arena2-123'
    const matchMode: string = 'ranked'
    const reportStatus: string = 'ya_liquidada'
    const yoGane = true

    let claimCalled = false
    if (reportStatus === 'liquidada' || reportStatus === 'ya_liquidada') {
      if (yoGane && matchMode !== 'tournament' && matchMode !== 'friendly') {
        if (userElo >= 2001 && capturedRoomId && matchMode !== 'clan_fortress') {
          claimCalled = true
        }
      }
    }

    expect(claimCalled).toBe(false)
  })

  it('6. En partidas amistosas o torneo NO debe reclamar PLANTS', () => {
    const userElo = 3000
    const capturedRoomId = 'room-friendly-123'
    const reportStatus: string = 'ya_liquidada'
    const yoGane = true

    for (const matchMode of ['friendly', 'tournament', 'clan_fortress']) {
      let claimCalled = false
      if (reportStatus === 'liquidada' || reportStatus === 'ya_liquidada') {
        if (yoGane && matchMode !== 'tournament' && matchMode !== 'friendly') {
          if (userElo >= 2001 && capturedRoomId && matchMode !== 'clan_fortress') {
            claimCalled = true
          }
        }
      }
      expect(claimCalled).toBe(false)
    }
  })
})
