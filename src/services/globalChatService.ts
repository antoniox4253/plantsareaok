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

export const globalChatService = {
  /** Reset del cooldown para suites de test */
  _resetCooldownForTesting() {
    lastMessageTimestamp = 0
  },

  /**
   * Obtiene los mensajes guardados localmente para renderizado instantáneo.
   */
  getLocalMessages(): GlobalChatMessage[] {
    try {
      const storage = getStorage()
      const raw = storage?.getItem(LOCAL_STORAGE_GLOBAL_CHAT_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  /**
   * Guarda un mensaje en el caché local persistente.
   */
  saveLocalMessage(msg: GlobalChatMessage) {
    try {
      const storage = getStorage()
      if (!storage) return
      const current = this.getLocalMessages()
      if (current.some((m) => m.id === msg.id)) return
      const updated = [...current, msg].slice(-80)
      storage.setItem(LOCAL_STORAGE_GLOBAL_CHAT_KEY, JSON.stringify(updated))
    } catch {}
  },

  /**
   * Guarda una lista completa de mensajes en caché local.
   */
  saveAllLocalMessages(messages: GlobalChatMessage[]) {
    try {
      const storage = getStorage()
      if (!storage) return
      storage.setItem(
        LOCAL_STORAGE_GLOBAL_CHAT_KEY,
        JSON.stringify(messages.slice(-80))
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

      // Unificar mensajes locales y remotos sin duplicados
      const mergedMap = new Map<string, GlobalChatMessage>()
      for (const m of local) mergedMap.set(m.id, m)
      for (const m of remote) mergedMap.set(m.id, m)

      const merged = Array.from(mergedMap.values())
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-80)

      this.saveAllLocalMessages(merged)
      return merged
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

    this.saveLocalMessage(localMessage)

    if (!isSupabaseConfigured()) {
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
      void channel.unsubscribe()
    }
  },
}
