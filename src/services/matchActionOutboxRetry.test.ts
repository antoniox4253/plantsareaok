import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as supabaseClientModule from '../lib/supabaseClient'
import {
  MatchActionOutbox,
  isAuthExpiredRpcError,
  isRetryableRpcError,
} from './matchActionOutbox'

describe('MatchActionOutbox resiliencia anti-rollback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
  })

  it('identifica errores de JWT expirado o sesión inválida como refrescables', () => {
    expect(isAuthExpiredRpcError('PGRST301', 'JWT expired')).toBe(true)
    expect(isAuthExpiredRpcError('42501', 'permission denied')).toBe(true)
    expect(isAuthExpiredRpcError('P0001', 'No autenticado')).toBe(true)
    expect(isAuthExpiredRpcError('401', 'Unauthorized')).toBe(true)
    expect(isAuthExpiredRpcError('P0001', 'Sala no encontrada')).toBe(false)
  })

  it('trata errores transitorios HTTP/PostgREST/red como reintentables y P0001 de negocio como rechazo definitivo', () => {
    expect(isRetryableRpcError('PGRST301', 'JWT expired')).toBe(true)
    expect(isRetryableRpcError('PGRST002', 'Database unavailable')).toBe(true)
    expect(isRetryableRpcError('429', 'Too Many Requests')).toBe(true)
    expect(isRetryableRpcError('504', 'Gateway Timeout')).toBe(true)
    expect(isRetryableRpcError('57014', 'canceling statement due to statement timeout')).toBe(true)
    expect(isRetryableRpcError('08006', 'connection failure')).toBe(true)
    expect(isRetryableRpcError(undefined, 'Failed to fetch')).toBe(true)

    expect(isRetryableRpcError('P0001', 'La partida ya esta cerrada para verificacion')).toBe(false)
    expect(isRetryableRpcError('CLIENT_CONFIG', 'Supabase no configurado')).toBe(false)
  })

  it('refresca sesión ante PGRST301 (JWT expired) y confirma la acción sin revertir la planta', async () => {
    const refreshSpy = vi
      .spyOn(supabaseClientModule, 'safeRefreshSession')
      .mockResolvedValue(true)

    const rpcSpy = vi
      .spyOn(supabaseClientModule.supabase, 'rpc' as any)
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST301', message: 'JWT expired' },
      } as any)
      .mockResolvedValueOnce({
        data: { ok: true },
        error: null,
      } as any)

    const res = await MatchActionOutbox.deliver('room-pgrst-1', {
      seq: 1,
      tick: 300,
      issuedTick: 294,
      kind: 'plant',
      plantId: 'sunflower',
      lane: 0,
      col: 0,
      slot: 0,
    })

    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledTimes(2)
    expect(res.status).toBe('ack')
  })
})
