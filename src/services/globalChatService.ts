import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface GlobalChatMessage {
  id: string
  user_id?: string | null
  username: string
  message: string
  has_vip: boolean
  avatar_id?: string
  created_at: string
}

let lastMessageTimestamp = 0
const SPAM_COOLDOWN_MS = 1800 // 1.8 segundos entre mensajes
const LOCAL_STORAGE_GLOBAL_CHAT_KEY = 'pa_global_chat_history_v1'

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return null
}

export function areMessagesEqual(a: GlobalChatMessage, b: GlobalChatMessage): boolean {
  if (a.id && b.id && a.id === b.id) return true
  if (
    a.username === b.username &&
    a.message === b.message &&
    Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 5000
  ) {
    return true
  }
  return false
}

export function deduplicateMessages(messages: GlobalChatMessage[]): GlobalChatMessage[] {
  const result: GlobalChatMessage[] = []
  for (const msg of messages) {
    const existingIdx = result.findIndex((m) => areMessagesEqual(m, msg))
    if (existingIdx >= 0) {
      // Si el existente es local provisional y el nuevo es oficial de la base de datos, preferir el oficial
      if (result[existingIdx].id.startsWith('local-') && !msg.id.startsWith('local-')) {
        result[existingIdx] = msg
      }
    } else {
      result.push(msg)
    }
  }
  return result
}

export const globalChatService = {
  /** Reset del cooldown para suites de test */
  _resetCooldownForTesting() {
    lastMessageTimestamp = 0
  },

  /**
   * Obtiene los mensajes guardados localmente para renderizado instantáneo, deduplicados.
   */
  getLocalMessages(): GlobalChatMessage[] {
    try {
      const storage = getStorage()
      const raw = storage?.getItem(LOCAL_STORAGE_GLOBAL_CHAT_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? deduplicateMessages(parsed) : []
    } catch {
      return []
    }
  },

  /**
   * Guarda un mensaje en el caché local persistente evitando duplicados.
   */
  saveLocalMessage(msg: GlobalChatMessage) {
    try {
      const storage = getStorage()
      if (!storage) return
      const current = this.getLocalMessages()
      const existingIdx = current.findIndex((m) => areMessagesEqual(m, msg))
      let updated: GlobalChatMessage[]
      if (existingIdx >= 0) {
        if (current[existingIdx].id.startsWith('local-') && !msg.id.startsWith('local-')) {
          updated = [...current]
          updated[existingIdx] = msg
        } else {
          return
        }
      } else {
        updated = [...current, msg].slice(-80)
      }
      storage.setItem(LOCAL_STORAGE_GLOBAL_CHAT_KEY, JSON.stringify(updated))
    } catch {}
  },

  /**
   * Guarda una lista completa de mensajes en caché local sin duplicados.
   */
  saveAllLocalMessages(messages: GlobalChatMessage[]) {
    try {
      const storage = getStorage()
      if (!storage) return
      const deduped = deduplicateMessages(messages).slice(-80)
      storage.setItem(
        LOCAL_STORAGE_GLOBAL_CHAT_KEY,
        JSON.stringify(deduped)
      )
    } catch {}
  },

  /**
   * Obtiene los últimos mensajes del chat global (combina caché local + Supabase).
   */
  async fetchRecentMessages(limit = 40): Promise<GlobalChatMessage[]> {
    const local = this.getLocalMessages()

    if (!isSupabaseConfigured()) {
      return local
    }

    try {
      const { data, error } = await (supabase as any)
        .from('global_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error || !data || !Array.isArray(data)) {
        if (error) {
          console.warn('[globalChatService] Error cargando mensajes remotos:', error.message)
        }
        return local
      }

      const remote = (data as GlobalChatMessage[]).reverse()

      // Unificar mensajes: primero remotos oficiales de Supabase
      const mergedList: GlobalChatMessage[] = [...remote]
      // Agregar locales solo si no existen ya en remote
      for (const loc of local) {
        if (!mergedList.some((rem) => areMessagesEqual(rem, loc))) {
          mergedList.push(loc)
        }
      }

      const sorted = deduplicateMessages(mergedList)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-80)

      this.saveAllLocalMessages(sorted)
      return sorted
    } catch (err) {
      console.warn('[globalChatService] Excepción al obtener historial de chat:', err)
      return local
    }
  },

  /**
   * Envía un mensaje al chat global.
   * Valida sintaxis UUID para user_id para evitar rollbacks en base de datos.
   */
  async sendMessage(params: {
    username: string
    message: string
    hasVip?: boolean
    avatarId?: string
    userId?: string
  }): Promise<{ success: boolean; error?: string; messageObj?: GlobalChatMessage }> {
    const text = (params.message || '').trim()
    if (!text) {
      return { success: false, error: 'El mensaje no puede estar vacío.' }
    }

    if (text.length > 150) {
      return { success: false, error: 'El mensaje excede el límite de 150 caracteres.' }
    }

    const now = Date.now()
    if (now - lastMessageTimestamp < SPAM_COOLDOWN_MS) {
      return { success: false, error: 'Espera un momento antes de enviar otro mensaje.' }
    }
    lastMessageTimestamp = now

    // Validar que userId sea un UUID válido antes de enviarlo a PostgreSQL
    let validUserId: string | null = null
    if (
      params.userId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.userId)
    ) {
      validUserId = params.userId
    } else if (isSupabaseConfigured()) {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (authData?.user?.id) {
          validUserId = authData.user.id
        }
      } catch {}
    }

    const localMessage: GlobalChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: validUserId,
      username: params.username || 'Guerrero',
      message: text,
      has_vip: Boolean(params.hasVip),
      avatar_id: params.avatarId || 'peashooter',
      created_at: new Date().toISOString(),
    }

    if (!isSupabaseConfigured()) {
      this.saveLocalMessage(localMessage)
      return { success: true, messageObj: localMessage }
    }

    try {
      const { data, error } = await (supabase as any)
        .from('global_chat_messages')
        .insert([
          {
            user_id: validUserId,
            username: params.username || 'Guerrero',
            message: text,
            has_vip: Boolean(params.hasVip),
            avatar_id: params.avatarId || 'peashooter',
          },
        ])
        .select()
        .single()

      if (error) {
        console.warn('[globalChatService] Error al insertar en Supabase, usando broadcast fallback:', error.message)
        this.saveLocalMessage(localMessage)
        // Fallback a broadcast por WebSocket
        const channel = supabase.channel('global-chat-channel')
        await channel.send({
          type: 'broadcast',
          event: 'global_message',
          payload: localMessage,
        })
        return { success: true, messageObj: localMessage }
      }

      const finalMsg = data as GlobalChatMessage
      this.saveLocalMessage(finalMsg)
      return { success: true, messageObj: finalMsg }
    } catch (err) {
      console.warn('[globalChatService] Excepción al enviar mensaje:', err)
      this.saveLocalMessage(localMessage)
      return { success: true, messageObj: localMessage }
    }
  },

  /**
   * Se suscribe al canal en tiempo real de Supabase y persiste los mensajes entrantes.
   */
  subscribeToGlobalChat(onMessage: (msg: GlobalChatMessage) => void): () => void {
    if (!isSupabaseConfigured()) {
      return () => {}
    }

    const channel = supabase.channel('global-chat-channel')

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'global_chat_messages',
        },
        (payload) => {
          if (payload?.new) {
            const newMsg = payload.new as GlobalChatMessage
            this.saveLocalMessage(newMsg)
            onMessage(newMsg)
          }
        }
      )
      .on(
        'broadcast',
        { event: 'global_message' },
        (payload) => {
          if (payload?.payload) {
            const newMsg = payload.payload as GlobalChatMessage
            this.saveLocalMessage(newMsg)
            onMessage(newMsg)
          }
        }
      )
      .subscribe()

    return () => {
      try {
        void supabase.removeChannel(channel)
      } catch (err) {
        console.warn('[globalChatService] Error al remover canal global:', err)
      }
    }
  },
}
