import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project.supabase.co')
}

// Create the typed Supabase Client with robust implicit OAuth session handling
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

let refreshPromise: Promise<boolean> | null = null
let lastRefreshTime = 0

/**
 * Refresca la sesión de Supabase de manera atómica, coordinada y con deduplicación.
 * Evita condiciones de carrera que revocarían el refresh_token si múltiples peticiones
 * (acciones de partida, RPCs o eventos de visibilidad) intentan refrescar simultáneamente.
 */
export async function safeRefreshSession(): Promise<boolean> {
  const now = Date.now()
  // Throttle defensivo: no refrescar más de una vez cada 8 segundos
  if (now - lastRefreshTime < 8000) {
    return true
  }
  if (refreshPromise) {
    return refreshPromise
  }
  refreshPromise = (async () => {
    try {
      const { data: s } = await supabase.auth.getSession()
      if (!s?.session?.refresh_token) {
        return false
      }
      lastRefreshTime = Date.now()
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data?.session) {
        console.warn('[SupabaseClient] safeRefreshSession falló:', error?.message)
        return false
      }
      return true
    } catch (e) {
      console.warn('[SupabaseClient] safeRefreshSession excepción:', e)
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

// Gestión limpia del ciclo de vida del navegador (Back-Forward Cache / bfcache):
// Al congelar o cambiar de página, desconectamos el WebSocket de forma ordenada
// para evitar que el navegador reporte "WebSocket connection failed: Page entered Back-Forward Cache".
// Al regresar a la página, se reconecta automáticamente sin interrupciones.
if (typeof window !== 'undefined') {
  const disconnectRealtime = () => {
    try {
      if (supabase && (supabase as any).realtime) {
        void (supabase as any).realtime.disconnect()
      }
    } catch {
      // Ignorar
    }
  }

  const connectRealtime = () => {
    try {
      if (supabase && (supabase as any).realtime) {
        void (supabase as any).realtime.connect()
      }
    } catch {
      // Ignorar
    }
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', disconnectRealtime)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        connectRealtime()
      }
    })
  }

  const refreshSessionIfNeeded = () => {
    try {
      if (!isSupabaseConfigured()) return
      void supabase.auth.getSession().then(({ data }) => {
        if (data?.session) {
          const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0
          if (expiresAt > 0 && Date.now() >= expiresAt - 120000) {
            void safeRefreshSession()
          }
        }
      }).catch(() => {})
    } catch {}
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('visibilitychange', () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        connectRealtime()
        refreshSessionIfNeeded()
      }
    })
  }

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('freeze', disconnectRealtime)
    document.addEventListener('resume', () => {
      connectRealtime()
      refreshSessionIfNeeded()
    })
  }
}
