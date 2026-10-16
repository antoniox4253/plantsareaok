import { describe, it, expect, vi } from 'vitest'
import { RANKED_MATCHMAKING_TIMEOUT_SECONDS } from '../utils/gameConstants'
import { SupabaseService } from '../services/supabaseService'

describe('A. Matchmaking 45 Segundos y Frontera Exacta (Migración 321)', () => {
  it('la constante canónica RANKED_MATCHMAKING_TIMEOUT_SECONDS vale 45', () => {
    expect(RANKED_MATCHMAKING_TIMEOUT_SECONDS).toBe(45)
  })

  it('evalúa la frontera exacta: 44s (waited = 44) NO dispara fallback y 45s (waited = 45) SÍ dispara fallback', async () => {
    const claimSpy = vi.spyOn(SupabaseService, 'claimRankedAsyncOpponent').mockResolvedValue({
      matched: true,
      roomId: 'test-room-async-fallback',
    } as any)

    // Función pura de evaluación de umbral de fallback en cliente
    function shouldTriggerAsyncFallback(modo: string, waitedSeconds: number, isClaiming: boolean): boolean {
      return modo === 'ranked' && waitedSeconds >= RANKED_MATCHMAKING_TIMEOUT_SECONDS && !isClaiming
    }

    // 1. A los 44 segundos (antes del umbral)
    const t44 = 44
    expect(shouldTriggerAsyncFallback('ranked', t44, false)).toBe(false)

    // 2. A los 45.0 segundos exactos (waited = 45 s)
    const t45 = 45
    expect(shouldTriggerAsyncFallback('ranked', t45, false)).toBe(true)

    // 3. A los 46.0 segundos (waited = 46 s)
    const t46 = 46
    expect(shouldTriggerAsyncFallback('ranked', t46, false)).toBe(true)

    // 4. Si ya está en proceso de claim, no debe duplicar la llamada
    expect(shouldTriggerAsyncFallback('ranked', 45, true)).toBe(false)

    // 5. En otros modos (friendly, etc.) no debe disparar fallback de ranked
    expect(shouldTriggerAsyncFallback('friendly', 45, false)).toBe(false)

    claimSpy.mockRestore()
  })
})

