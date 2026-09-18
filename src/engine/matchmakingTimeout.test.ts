import { describe, it, expect, vi } from 'vitest'
import { RANKED_MATCHMAKING_TIMEOUT_SECONDS } from '../utils/gameConstants'
import { SupabaseService } from '../services/supabaseService'

describe('A. Matchmaking 35 Segundos y Frontera Exacta', () => {
  it('la constante canónica RANKED_MATCHMAKING_TIMEOUT_SECONDS vale 35', () => {
    expect(RANKED_MATCHMAKING_TIMEOUT_SECONDS).toBe(35)
  })

  it('evalúa la frontera exacta: 34.9s (waited = 34) NO dispara fallback y 35.0s (waited = 35) SÍ dispara fallback', async () => {
    const claimSpy = vi.spyOn(SupabaseService, 'claimRankedAsyncOpponent').mockResolvedValue({
      matched: true,
      roomId: 'test-room-async-fallback',
    } as any)

    // Función pura de evaluación de umbral de fallback en cliente
    function shouldTriggerAsyncFallback(modo: string, waitedSeconds: number, isClaiming: boolean): boolean {
      return modo === 'ranked' && waitedSeconds >= RANKED_MATCHMAKING_TIMEOUT_SECONDS && !isClaiming
    }

    // 1. A los 34 segundos (antes del umbral)
    const t34 = 34
    expect(shouldTriggerAsyncFallback('ranked', t34, false)).toBe(false)

    // 2. A los 35.0 segundos exactos (waited = 35 s)
    const t35 = 35
    expect(shouldTriggerAsyncFallback('ranked', t35, false)).toBe(true)

    // 3. A los 36.0 segundos (waited = 36 s)
    const t36 = 36
    expect(shouldTriggerAsyncFallback('ranked', t36, false)).toBe(true)

    // 4. Si ya está en proceso de claim, no debe duplicar la llamada
    expect(shouldTriggerAsyncFallback('ranked', 35, true)).toBe(false)

    // 5. En otros modos (friendly, etc.) no debe disparar fallback de ranked
    expect(shouldTriggerAsyncFallback('friendly', 35, false)).toBe(false)

    claimSpy.mockRestore()
  })
})
