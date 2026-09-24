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
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('freeze', disconnectRealtime)
    document.addEventListener('resume', connectRealtime)
  }
}

