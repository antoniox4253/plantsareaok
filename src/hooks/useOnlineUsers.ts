import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Hook para monitorear usuarios en línea en tiempo real usando Supabase Realtime Presence.
 *
 * Eficiencia y costos en Supabase:
 * - NO consume lecturas ni escrituras de base de datos PostgreSQL (0 queries, 0 locks).
 * - Se maneja en memoria a través de WebSocket (Phoenix Presence).
 * - Si hay menos de 30 usuarios conectados o hay desconexión, muestra 25 como fallback visual.
 * - Si hay más de 30 usuarios, muestra el valor real en tiempo real.
 *
 * Arquitectura Singleton:
 * - Mantiene un ÚNICO canal 'online-players-presence' en memoria para toda la aplicación.
 * - Evita errores fatales de Realtime ("cannot add presence callbacks after subscribe()").
 * - Sincroniza miembros conectados de clanes y contador global de forma segura y reactiva.
 */

function getSessionPresenceId(): string {
  try {
    const stored = sessionStorage.getItem('pa_presence_id')
    if (stored) return stored
    const newId = 'user_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
    sessionStorage.setItem('pa_presence_id', newId)
    return newId
  } catch {
    return 'user_' + Math.random().toString(36).substring(2, 9)
  }
}

let activeChannel: RealtimeChannel | null = null
let activePresenceKey: string | null = null
let isConnecting = false
let currentOnlineIds = new Set<string>()
let currentOnlineCount = 25

type UserIdsSubscriber = (ids: Set<string>) => void
type CountSubscriber = (count: number) => void

const userIdsSubscribers = new Set<UserIdsSubscriber>()
const countSubscribers = new Set<CountSubscriber>()

function notifySubscribers(channel: RealtimeChannel) {
  try {
    const state = channel.presenceState()
    const uniqueKeys = Object.keys(state)
    const newIds = new Set(uniqueKeys)
    currentOnlineIds = newIds

    const realCount = uniqueKeys.length
    currentOnlineCount = realCount > 30 ? realCount : 25

    userIdsSubscribers.forEach((cb) => {
      try {
        cb(newIds)
      } catch (err) {
        console.warn('[useOnlineUsers] Error in presence ID subscriber:', err)
      }
    })

    countSubscribers.forEach((cb) => {
      try {
        cb(currentOnlineCount)
      } catch (err) {
        console.warn('[useOnlineUsers] Error in count subscriber:', err)
      }
    })
  } catch (err) {
    console.warn('[useOnlineUsers] Error processing presenceState:', err)
  }
}

async function ensurePresenceChannel(userId?: string) {
  if (!isSupabaseConfigured()) return

  const targetKey = userId || getSessionPresenceId()

  // Si ya tenemos canal activo con la misma clave, notificamos estado actual
  if (activeChannel && activePresenceKey === targetKey) {
    notifySubscribers(activeChannel)
    return
  }

  if (isConnecting) return
  isConnecting = true

  try {
    // Si ya había un canal previo o la clave cambió (ej: usuario inició sesión)
    if (activeChannel) {
      const old = activeChannel
      activeChannel = null
      void supabase.removeChannel(old)
    }

    // Verificar si el cliente de Supabase retiene un canal con este topic para evitar el error de callbacks post-subscribe
    const existing = supabase.getChannels().find(
      (c) => c.topic === 'online-players-presence' || c.topic === 'realtime:online-players-presence'
    )
    if (existing) {
      void supabase.removeChannel(existing)
    }

    activePresenceKey = targetKey
    const channel = supabase.channel('online-players-presence', {
      config: {
        presence: {
          key: targetKey,
        },
      },
    })

    const onStateChange = () => {
      notifySubscribers(channel)
    }

    channel
      .on('presence', { event: 'sync' }, onStateChange)
      .on('presence', { event: 'join' }, onStateChange)
      .on('presence', { event: 'leave' }, onStateChange)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              online_at: Date.now(),
            })
          } catch (err) {
            console.warn('[useOnlineUsers] Error tracking presence:', err)
          }
          notifySubscribers(channel)
        }
      })

    activeChannel = channel
  } catch (err) {
    console.warn('[useOnlineUsers] Error establishing presence channel:', err)
  } finally {
    isConnecting = false
  }
}

/**
 * Obtiene síncronamente el último set conocido de IDs de jugadores en línea.
 */
export function getOnlineUserIds(): Set<string> {
  return currentOnlineIds
}

/**
 * Permite a cualquier componente (ej: Clanes) suscribirse a la lista en vivo de IDs en línea
 * sin crear canales duplicados ni disparar errores de Realtime.
 */
export function subscribeToOnlineUserIds(callback: UserIdsSubscriber): () => void {
  userIdsSubscribers.add(callback)

  // Emitir inmediatamente el estado disponible en memoria
  try {
    callback(currentOnlineIds)
  } catch (err) {
    console.warn('[useOnlineUsers] Error emitting initial presence IDs:', err)
  }

  // Si aún no se ha creado el canal, inicializarlo de manera segura
  if (!activeChannel && isSupabaseConfigured()) {
    void ensurePresenceChannel()
  }

  return () => {
    userIdsSubscribers.delete(callback)
  }
}

/**
 * Hook para obtener la lista reactiva de IDs de jugadores en línea.
 */
export function useOnlineUserIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => currentOnlineIds)

  useEffect(() => {
    return subscribeToOnlineUserIds(setIds)
  }, [])

  return ids
}

/**
 * Hook principal para obtener el conteo de jugadores conectados (usado en Header/Menú principal).
 */
export function useOnlineUsers(userId?: string): number {
  const [onlineCount, setOnlineCount] = useState<number>(currentOnlineCount)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return
    }

    void ensurePresenceChannel(userId)

    const onCountChange: CountSubscriber = (count) => {
      setOnlineCount(count)
    }

    countSubscribers.add(onCountChange)
    setOnlineCount(currentOnlineCount)

    return () => {
      countSubscribers.delete(onCountChange)
    }
  }, [userId])

  return onlineCount
}
