import { describe, it, expect } from 'vitest'

describe('Admin Panel - Flujo de Retiros (Cashouts)', () => {
  it('1. Normaliza tanto array directo [...] como payload envuelto { success: true, requests: [...] }', () => {
    const rawSqlArray = [
      {
        id: '517f89c0-fa71-4804-860e-a9e181420438',
        user_id: '26c64a60-8fb2-47e1-be21-4e4e9eee64ad',
        username: 'Jon Snow',
        avatar: 'jalapeno',
        elo_rating: 23651,
        gross_usdt: 1.4,
        fee_usdt: 0,
        net_usdt: 1.4,
        destination_wallet: '0x8F6E1E25205CF22AcBa73670E1356a4DAC5d9683',
        status: 'pending',
        created_at: '2026-11-03T16:10:05.563Z',
        settled_at: null,
        user_is_vip: true,
      },
    ]

    const parsePayload = (data: any) => {
      const list = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.requests) ? data.requests : [])

      return list.map((r: any) => ({
        id: String(r.id),
        userId: String(r.user_id),
        usdtAmount: Number(r.usdt_amount ?? r.gross_usdt ?? r.net_usdt ?? 0),
        feeUsdt: Number(r.fee_usdt ?? 0),
        netUsdt: Number(r.net_usdt ?? 0),
        walletAddress: String(r.wallet_address ?? r.destination_wallet ?? ''),
        status: (r.status || 'pending') as 'pending' | 'completed' | 'rejected',
        createdAt: String(r.created_at),
        processedAt: r.processed_at || r.settled_at ? String(r.processed_at || r.settled_at) : null,
        txHash: r.tx_hash ? String(r.tx_hash) : null,
        rejectReason: r.reject_reason ? String(r.reject_reason) : null,
        userIsVip: Boolean(r.user_is_vip),
        username: String(r.username ?? 'Desconocido'),
        avatar: String(r.avatar ?? 'peashooter'),
        eloRating: Number(r.elo_rating ?? 1000),
      }))
    }

    // Caso A: Array directo de PostgreSQL
    const resA = parsePayload(rawSqlArray)
    expect(resA).toHaveLength(1)
    expect(resA[0].username).toBe('Jon Snow')
    expect(resA[0].netUsdt).toBe(1.4)
    expect(resA[0].walletAddress).toBe('0x8F6E1E25205CF22AcBa73670E1356a4DAC5d9683')

    // Caso B: Objeto RPC envuelto
    const resB = parsePayload({ success: true, requests: rawSqlArray })
    expect(resB).toHaveLength(1)
    expect(resB[0].username).toBe('Jon Snow')
    expect(resB[0].netUsdt).toBe(1.4)
  })

  it('2. Extrae correctamente las dos solicitudes pendientes de Jon Snow y Kinvox', () => {
    const requestsMock = [
      {
        id: '517f89c0-fa71-4804-860e-a9e181420438',
        username: 'Jon Snow',
        netUsdt: 1.4,
        walletAddress: '0x8F6E1E25205CF22AcBa73670E1356a4DAC5d9683',
        status: 'pending',
        userIsVip: true,
      },
      {
        id: '7d4fcfaf-1857-422d-8118-ef4c5fa689c5',
        username: 'Kinvox',
        netUsdt: 1.09,
        walletAddress: '0x338a70edb5b3b9ef1c71e885056bc0351f673a97',
        status: 'pending',
        userIsVip: false,
      },
    ]

    const pendientes = requestsMock.filter((r) => r.status === 'pending')
    expect(pendientes).toHaveLength(2)

    const totalPendienteUsdt = pendientes.reduce((acc, r) => acc + r.netUsdt, 0)
    expect(totalPendienteUsdt).toBeCloseTo(2.49, 2)
  })

  it('3. Maneja parámetros por defecto asignando "all" si status no se especifica', () => {
    const resolveStatus = (status?: string) => (status && status !== 'all' ? status : 'all')

    expect(resolveStatus(undefined)).toBe('all')
    expect(resolveStatus('')).toBe('all')
    expect(resolveStatus('all')).toBe('all')
    expect(resolveStatus('pending')).toBe('pending')
    expect(resolveStatus('completed')).toBe('completed')
  })
})
