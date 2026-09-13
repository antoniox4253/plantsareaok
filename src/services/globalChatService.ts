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

export const globalChatService = {
  /**
   * Obtiene los últimos mensajes del chat global en orden cronológico.
   */
  async fetchRecentMessages(limit = 40): Promise<GlobalChatMessage[]> {
    if (!isSupabaseConfigured()) {
      return []
    }

    try {
      const { data, error } = await supabase
        .from('global_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.warn('[globalChatService] Error cargando mensajes:', error.message)
        return []
      }

      if (!data) return []

      // Devolver en orden ascendente (los más antiguos primero, los más recientes abajo)
      return (data as GlobalChatMessage[]).reverse()
    } catch (err) {
      console.warn('[globalChatService] Excepción al obtener historial de chat:', err)
      return []
    }
  },

  /**
   * Envía un mensaje al chat global.
   * Incluye control anti-spam y sanitización de longitud.
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

    const localMessage: GlobalChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: params.userId || null,
      username: params.username || 'Guerrero',
      message: text,
      has_vip: Boolean(params.hasVip),
      avatar_id: params.avatarId || 'peashooter',
      created_at: new Date().toISOString(),
    }

    if (!isSupabaseConfigured()) {
      return { success: true, messageObj: localMessage }
    }

    try {
      const { data, error } = await supabase
        .from('global_chat_messages')
        .insert([
          {
            user_id: params.userId || null,
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

      return { success: true, messageObj: data as GlobalChatMessage }
    } catch (err) {
      console.warn('[globalChatService] Excepción al enviar mensaje:', err)
      return { success: true, messageObj: localMessage }
    }
  },

  /**
   * Se suscribe al canal en tiempo real de Supabase (tanto postgres_changes como broadcast fallback).
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
            onMessage(payload.new as GlobalChatMessage)
          }
        }
      )
      .on(
        'broadcast',
        { event: 'global_message' },
        (payload) => {
          if (payload?.payload) {
            onMessage(payload.payload as GlobalChatMessage)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Conectado exitosamente al canal global
        }
      })

    return () => {
      void channel.unsubscribe()
    }
  },
}
