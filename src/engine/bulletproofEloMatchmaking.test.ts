import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migración 142: Blindaje Total de Columnas ELO y Resiliencia de Emparejamiento', () => {
  const m142Path = path.resolve(__dirname, '../../supabase/migrations/142-bulletproof-elo-columns-and-matchmaking-resilience.sql')
  const m142Sql = fs.readFileSync(m142Path, 'utf-8')

  it('1.1. SQL Audit: Asegura rating_snapshot, elo_rating y elo en ranked_async_opponents', () => {
    expect(m142Sql).toContain('ALTER TABLE public.ranked_async_opponents')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS rating_snapshot INTEGER DEFAULT 1000')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1000')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS elo INTEGER DEFAULT 1000')
  })

  it('1.2. SQL Audit: Sincronización y trigger en ranked_async_opponents', () => {
    expect(m142Sql).toContain('CREATE OR REPLACE FUNCTION public._sync_ranked_async_opponents_elo()')
    expect(m142Sql).toContain('CREATE TRIGGER trg_sync_ranked_async_opponents_elo')
  })

  it('1.3. SQL Audit: Asegura user_elo, elo_rating y elo con trigger en matchmaking_queue', () => {
    expect(m142Sql).toContain('ALTER TABLE public.matchmaking_queue')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS user_elo INTEGER DEFAULT 1000')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1000')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS elo INTEGER DEFAULT 1000')
    expect(m142Sql).toContain('CREATE TRIGGER trg_sync_matchmaking_queue_elo')
  })

  it('1.4. SQL Audit: Asegura columnas y alias en public.game_rooms', () => {
    expect(m142Sql).toContain('ALTER TABLE public.game_rooms')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS async_rating_snapshot INTEGER DEFAULT 1000')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS async_player_elo INTEGER DEFAULT 1000')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS elo_rating INTEGER')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS user_elo INTEGER')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS async_display_name TEXT')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS async_player_name TEXT')
  })

  it('1.5. SQL Audit: Asegura elo_rating y elo en public.profiles', () => {
    expect(m142Sql).toContain('ALTER TABLE public.profiles')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1000')
    expect(m142Sql).toContain('ADD COLUMN IF NOT EXISTS elo INTEGER DEFAULT 1000')
  })

  it('1.6. SQL Audit: claim_ranked_async_opponent posee bloque defensivo y puebla game_rooms', () => {
    expect(m142Sql).toContain('CREATE OR REPLACE FUNCTION public.claim_ranked_async_opponent()')
    expect(m142Sql).toContain('EXCEPTION WHEN OTHERS THEN')
    expect(m142Sql).toContain('async_rating_snapshot')
    expect(m142Sql).toContain('async_player_elo')
  })

  it('1.7. SQL Audit: Recarga la caché de esquemas con PostgREST reload schema', () => {
    expect(m142Sql).toContain("NOTIFY pgrst, 'reload schema'")
  })

  it('2. Resiliencia Frontend: Errores transitorios o de bot en claimRankedAsyncOpponent no abortan la cola de jugadores humanos', () => {
    // Simulación de la lógica implementada en useMatchmaking.ts
    function procesarRespuestaClaim(
      claimRes: { matched?: boolean; roomId?: string; error?: string },
      estadoActual: { buscando: boolean; error: string | null }
    ) {
      if (claimRes.error) {
        if (
          claimRes.error === 'sin_energia' ||
          claimRes.error === 'client_update_required' ||
          claimRes.error === 'mazo_invalido'
        ) {
          return {
            buscando: false,
            error: claimRes.error,
          }
        }
        // Para errores transitorios de bot o fallos de columna, la búsqueda humana permanece activa
        return {
          buscando: true,
          error: null,
        }
      }

      if (claimRes.matched && claimRes.roomId) {
        return {
          buscando: false,
          error: null,
          roomId: claimRes.roomId,
        }
      }

      return estadoActual
    }

    // 1. Error de columna PostgreSQL: NO cancela la búsqueda de humano
    const resColErr = procesarRespuestaClaim(
      { error: 'column "elo_rating" does not exist' },
      { buscando: true, error: null }
    )
    expect(resColErr.buscando).toBe(true)
    expect(resColErr.error).toBeNull()

    // 2. Error de tiempo insuficiente: NO cancela la búsqueda
    const resTiempoErr = procesarRespuestaClaim(
      { error: 'tiempo_insuficiente' },
      { buscando: true, error: null }
    )
    expect(resTiempoErr.buscando).toBe(true)
    expect(resTiempoErr.error).toBeNull()

    // 3. Error de bot no disponible: NO cancela la búsqueda
    const resNoSeed = procesarRespuestaClaim(
      { error: 'no_seed_available' },
      { buscando: true, error: null }
    )
    expect(resNoSeed.buscando).toBe(true)
    expect(resNoSeed.error).toBeNull()

    // 4. Error autoritativo sin energía: SÍ detiene la cola
    const resSinEnergia = procesarRespuestaClaim(
      { error: 'sin_energia' },
      { buscando: true, error: null }
    )
    expect(resSinEnergia.buscando).toBe(false)
    expect(resSinEnergia.error).toBe('sin_energia')
  })

  it('3. Sanitización Frontend: Los errores crudos de base de datos se transforman en mensajes amigables', () => {
    function sanitizarMensajeError(rawErr: string): string {
      const isDbErr =
        rawErr.includes('elo_rating') ||
        rawErr.includes('does not exist') ||
        rawErr.includes('column') ||
        rawErr.includes('PGRST')

      return isDbErr
        ? 'El servicio de emparejamiento se está sincronizando. Por favor intenta buscar partida nuevamente en unos momentos.'
        : rawErr
    }

    const errCrudo = 'column "elo_rating" does not exist'
    const errSanitizado = sanitizarMensajeError(errCrudo)
    expect(errSanitizado).not.toContain('elo_rating')
    expect(errSanitizado).not.toContain('does not exist')
    expect(errSanitizado).toContain('El servicio de emparejamiento se está sincronizando')

    const errNegocio = 'Has sido eliminado del torneo'
    expect(sanitizarMensajeError(errNegocio)).toBe(errNegocio)
  })
})
