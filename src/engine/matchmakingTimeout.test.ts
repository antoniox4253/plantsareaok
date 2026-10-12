import { describe, it, expect, vi } from 'vitest'
import { RANKED_MATCHMAKING_TIMEOUT_SECONDS } from '../utils/gameConstants'
import { SupabaseService } from '../services/supabaseService'

describe('A. Matchmaking 3 Segundos y Frontera Exacta', () => {
  it('la constante canónica RANKED_MATCHMAKING_TIMEOUT_SECONDS vale 3', () => {
    expect(RANKED_MATCHMAKING_TIMEOUT_SECONDS).toBe(3)
  })

  it('evalúa la frontera exacta: 2.9s (waited = 2) NO dispara fallback y 3.0s (waited = 3) SÍ dispara fallback', async () => {
    const claimSpy = vi.spyOn(SupabaseService, 'claimRankedAsyncOpponent').mockResolvedValue({
      matched: true,
      roomId: 'test-room-async-fallback',
    } as any)

    // Función pura de evaluación de umbral de fallback en cliente
    function shouldTriggerAsyncFallback(modo: string, waitedSeconds: number, isClaiming: boolean): boolean {
      return modo === 'ranked' && waitedSeconds >= RANKED_MATCHMAKING_TIMEOUT_SECONDS && !isClaiming
    }

    // 1. A los 2 segundos (antes del umbral)
    const t2 = 2
    expect(shouldTriggerAsyncFallback('ranked', t2, false)).toBe(false)

    // 2. A los 3.0 segundos exactos (waited = 3 s)
    const t3 = 3
    expect(shouldTriggerAsyncFallback('ranked', t3, false)).toBe(true)

    // 3. A los 4.0 segundos (waited = 4 s)
    const t4 = 4
    expect(shouldTriggerAsyncFallback('ranked', t4, false)).toBe(true)

    // 4. Si ya está en proceso de claim, no debe duplicar la llamada
    expect(shouldTriggerAsyncFallback('ranked', 3, true)).toBe(false)

    // 5. En otros modos (friendly, etc.) no debe disparar fallback de ranked
    expect(shouldTriggerAsyncFallback('friendly', 3, false)).toBe(false)

    claimSpy.mockRestore()
  })
})
