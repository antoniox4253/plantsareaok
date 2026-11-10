import { isSupabaseConfigured, supabase, safeRefreshSession } from '../lib/supabaseClient'

/**
 * Outbox de acciones PvP.
 *
 * Propiedad importante de AUTH-V1:
 * submit_match_action es idempotente por (room_id, user_id, seq) y comprueba
 * duplicados ANTES de validar la ventana temporal. Por eso:
 *
 *  - si el servidor insertó la acción pero se perdió la respuesta, este outbox
 *    puede reenviar el MISMO seq más tarde y recibirá duplicate=true;
 *  - si la acción jamás llegó, cuando vuelva la red el servidor puede rechazarla
 *    por haber quedado fuera de ventana. El cliente debe revertir únicamente esa
 *    acción y NO encadenar nuevas decisiones mientras siga sin ACK.
 */

export type MatchActionIntent = {
  seq: number
  tick: number
  issuedTick: number
  kind: 'plant' | 'dig' | 'collect'
  plantId?: string | null
  lane?: number | null
  col?: number | null
  slot?: number | null
  targetId?: string | null
}

export type MatchActionAck = {
  ok?: boolean
  duplicate?: boolean
  id?: number
  serverTick?: number
}

export type DeliveryResult =
  | {
      status: 'ack'
      ack: MatchActionAck
      attempts: number
      elapsedMs: number
    }
  | {
      status: 'rejected'
      error: string
      code?: string
      attempts: number
      elapsedMs: number
    }
  | {
      status: 'cancelled'
      attempts: number
      elapsedMs: number
    }

type JournalEntry = {
  roomId: string
  action: MatchActionIntent
  createdAt: number
  attempts: number
  lastError?: string
  lastCode?: string
}

const STORAGE_KEY = 'plants-arena:match-action-outbox:auth-v1'
const MAX_BACKOFF_MS = 2000

function keyOf(roomId: string, seq: number): string {
  return `${roomId}:${seq}`
}

function loadJournal(): Record<string, JournalEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveJournal(value: Record<string, JournalEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // El outbox sigue funcionando en memoria aunque el navegador bloquee storage.
  }
}

const journal: Record<string, JournalEntry> = loadJournal()

function put(entry: JournalEntry): void {
  journal[keyOf(entry.roomId, entry.action.seq)] = entry
  saveJournal(journal)
}

function remove(roomId: string, seq: number): void {
  delete journal[keyOf(roomId, seq)]
  saveJournal(journal)
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup()
      resolve(true)
    }, ms)

    const onAbort = () => {
      window.clearTimeout(timer)
      cleanup()
      resolve(false)
    }

    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function isAuthExpiredRpcError(code?: string, errorMessage?: string): boolean {
  const normalizedCode = (code || '').toUpperCase()
  const msg = (errorMessage || '').toLowerCase()
  return (
    normalizedCode === 'PGRST301' ||
    normalizedCode === '42501' ||
    normalizedCode === '401' ||
    msg.includes('no autenticado') ||
    msg.includes('not_authenticated') ||
    msg.includes('permission denied') ||
    msg.includes('jwt expired') ||
    msg.includes('jwt') ||
    msg.includes('invalid claim') ||
    msg.includes('unauthorized')
  )
}

/**
 * Sólo errores definitivos de reglas de negocio (`P0001` no-auth) deben
 * revertir la acción del jugador. Cualquier fallo transitorio de red,
 * PostgREST, timeout, rate limit o renovación de sesión debe reintentarse en
 * el outbox en lugar de provocar un rollback destructivo sobre el tablero.
 */
export function isRetryableRpcError(code?: string, errorMessage?: string): boolean {
  if (!code) return true

  const normalizedCode = code.toUpperCase()
  const msg = (errorMessage || '').toLowerCase()

  if (isAuthExpiredRpcError(normalizedCode, msg)) {
    return true
  }

  // Excepciones explícitas de reglas de dominio (RAISE EXCEPTION en PostgreSQL)
  if (normalizedCode === 'P0001' || normalizedCode === 'CLIENT_CONFIG') {
    return false
  }

  if (
    normalizedCode === '40001' || // serialization_failure
    normalizedCode === '40P01' || // deadlock_detected
    normalizedCode === '53300' || // too_many_connections
    normalizedCode === '57014' || // query_canceled / statement_timeout
    normalizedCode === '57P01' ||
    normalizedCode === '57P02' ||
    normalizedCode === '57P03' ||
    normalizedCode.startsWith('08') || // connection_exception family
    normalizedCode.startsWith('PGRST') || // PostgREST gateway / schema cache / upstream transient errors
    normalizedCode === '408' ||
    normalizedCode === '429' ||
    normalizedCode === '500' ||
    normalizedCode === '502' ||
    normalizedCode === '503' ||
    normalizedCode === '504' ||
    normalizedCode === 'FETCH_ERROR'
  ) {
    return true
  }

  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('temporarily') ||
    msg.includes('connection')
  )
}

function isRetryableCode(code?: string, errorMessage?: string): boolean {
  return isRetryableRpcError(code, errorMessage)
}

async function sendOnce(
  roomId: string,
  action: MatchActionIntent,
): Promise<
  | { ok: true; ack: MatchActionAck }
  | { ok: false; retryable: boolean; error: string; code?: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      retryable: false,
      error: 'Supabase no configurado',
      code: 'CLIENT_CONFIG',
    }
  }

  try {
    let { data, error } = await (supabase.rpc as any)('submit_match_action', {
      p_room_id: roomId,
      p_seq: action.seq,
      p_tick: action.tick,
      p_kind: action.kind,
      p_plant_id: action.plantId ?? null,
      p_plant: action.plantId ?? null,
      p_lane: action.lane ?? null,
      p_col: action.col ?? null,
      p_slot: action.slot ?? null,
      p_issued_tick: action.issuedTick,
      p_target_id: action.targetId ?? null,
    })

    // Resiliencia de sesión: si el token de autenticación expiró o se desincronizó
    // (incluyendo PGRST301 / JWT expired / HTTP 401), refrescar y reintentar
    if (error && isAuthExpiredRpcError(error.code, error.message)) {
      try {
        const refreshedOk = await safeRefreshSession()
        if (refreshedOk) {
          const retry = await (supabase.rpc as any)('submit_match_action', {
            p_room_id: roomId,
            p_seq: action.seq,
            p_tick: action.tick,
            p_kind: action.kind,
            p_plant_id: action.plantId ?? null,
            p_plant: action.plantId ?? null,
            p_lane: action.lane ?? null,
            p_col: action.col ?? null,
            p_slot: action.slot ?? null,
            p_issued_tick: action.issuedTick,
            p_target_id: action.targetId ?? null,
          })
          data = retry.data
          error = retry.error
        }
      } catch {}
    }

    if (!error) {
      return { ok: true, ack: (data ?? {}) as MatchActionAck }
    }

    const code = typeof error.code === 'string' ? error.code : undefined
    return {
      ok: false,
      retryable: isRetryableCode(code, error.message),
      error: error.message ?? 'submit_match_action falló',
      code,
    }
  } catch (error) {
    // TypeError / Failed to fetch / pérdida de conexión: no sabemos si el INSERT
    // llegó. Hay que reenviar exactamente el mismo seq.
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error ? error.message : 'network_error',
    }
  }
}

export const MatchActionOutbox = {
  /**
   * Entrega una acción hasta recibir ACK o un rechazo definitivo.
   *
   * NO tiene timeout deliberadamente: mientras el navegador siga en la batalla,
   * es más seguro bloquear nuevas decisiones que fabricar una cadena de acciones
   * basada en una economía que quizá el servidor nunca aceptó.
   *
   * El componente debe pasar AbortSignal y abortarlo al desmontarse.
   */
  async deliver(
    roomId: string,
    action: MatchActionIntent,
    signal?: AbortSignal,
  ): Promise<DeliveryResult> {
    const start = Date.now()
    let attempts = 0

    put({
      roomId,
      action,
      createdAt: start,
      attempts: 0,
    })

    while (!signal?.aborted) {
      attempts += 1

      const result = await sendOnce(roomId, action)

      if (result.ok) {
        remove(roomId, action.seq)
        return {
          status: 'ack',
          ack: result.ack,
          attempts,
          elapsedMs: Date.now() - start,
        }
      }

      const entry = journal[keyOf(roomId, action.seq)]
      if (entry) {
        entry.attempts = attempts
        entry.lastError = result.error
        entry.lastCode = result.code
        put(entry)
      }

      if (!result.retryable) {
        remove(roomId, action.seq)
        return {
          status: 'rejected',
          error: result.error,
          code: result.code,
          attempts,
          elapsedMs: Date.now() - start,
        }
      }

      const delay = Math.min(
        MAX_BACKOFF_MS,
        180 * Math.pow(1.7, Math.min(attempts - 1, 8)),
      )
      const keepGoing = await sleepAbortable(Math.round(delay), signal)
      if (!keepGoing) break
    }

    return {
      status: 'cancelled',
      attempts,
      elapsedMs: Date.now() - start,
    }
  },

  pendingCount(roomId?: string): number {
    return Object.values(journal).filter(
      (entry) => !roomId || entry.roomId === roomId,
    ).length
  },

  diagnostics(roomId?: string): JournalEntry[] {
    return Object.values(journal)
      .filter((entry) => !roomId || entry.roomId === roomId)
      .sort((a, b) => a.createdAt - b.createdAt)
  },

  /**
   * Úsalo sólo al abandonar definitivamente una sala o al iniciar una sesión nueva
   * que NO pretende reanudar el estado local anterior.
   *
   * No auto-reenviamos entradas antiguas al cargar la página: el motor actual no
   * reconstruye todavía todas las acciones propias después de un reload.
   */
  discardRoom(roomId: string): void {
    for (const entry of Object.values(journal)) {
      if (entry.roomId === roomId) {
        delete journal[keyOf(roomId, entry.action.seq)]
      }
    }
    saveJournal(journal)
  },
}
