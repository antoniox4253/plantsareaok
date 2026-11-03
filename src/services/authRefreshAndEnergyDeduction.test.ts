import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as supabaseClientModule from '../lib/supabaseClient'
import { safeRefreshSession, supabase } from '../lib/supabaseClient'

describe('Auth Resilience & Energy Consumption Fixes (Migración 384)', () => {
  describe('1. safeRefreshSession Mutex & Throttle', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
      vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)
    })

    it('deduplica llamadas concurrentes evitando Token Rotation Storm', async () => {
      let callCount = 0
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid_tok',
            refresh_token: 'valid_ref',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          } as any,
        },
        error: null,
      })

      vi.spyOn(supabase.auth, 'refreshSession').mockImplementation(async () => {
        callCount++
        await new Promise((r) => setTimeout(r, 50))
        return {
          data: {
            session: { access_token: 'new_tok', refresh_token: 'new_ref' } as any,
            user: { id: 'u-1' } as any,
          },
          error: null,
        }
      })

      // Ejecutar 5 llamadas concurrentes al mismo tiempo
      const results = await Promise.all([
        safeRefreshSession(),
        safeRefreshSession(),
        safeRefreshSession(),
        safeRefreshSession(),
        safeRefreshSession(),
      ])

      // Todas deben resolver con éxito pero refreshSession debe haberse invocado exactamente 1 vez
      expect(results.every((r) => r === true)).toBe(true)
      expect(callCount).toBe(1)
    })
  })

  describe('2. Auditoría Estática SQL de la Migración 384', () => {
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/384-fix-ranked-pvp-energy-deduction-and-matchmaking-gatekeeper.sql')

    it('la migración 384 existe en disco', () => {
      expect(fs.existsSync(migrationPath)).toBe(true)
    })

    it('implementa la deducción autoritativa de 1 energía en _create_room para P1 y P2 en Ranked', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8')
      expect(sql).toContain('FUNCTION public._create_room')
      expect(sql).toContain("p_mode = 'ranked' AND v_p1_elo > 1602")
      expect(sql).toContain("p_mode = 'ranked' AND v_p2_elo > 1602")
      expect(sql).toContain('energy_current = GREATEST(0, COALESCE(energy_current, 1) - 1)')
      expect(sql).toContain("'energy_spend'")
    })

    it('implementa el gatekeeper de energía y reset diario en enter_matchmaking', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8')
      expect(sql).toContain('FUNCTION public.enter_matchmaking')
      expect(sql).toContain("p_mode = 'ranked' AND v_elo > 1602")
      expect(sql).toContain('v_cur_en < 1')
      expect(sql).toContain("'sin_energia'")
    })
  })
})
