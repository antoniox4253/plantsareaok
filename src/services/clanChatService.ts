import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface ClanChatMessage {
  id: string
  clanId: string
  sender: string
  role: string
  text: string
  time: string
  hasVip?: boolean
  created_at?: string
}

const getClanChatStorageKey = (clanId: string) => `pa_clan_chat_${clanId}_v1`

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return null
}

export const clanChatService = {
  /**
   * Obtiene los mensajes guardados localmente para este clan.
   */
  getLocalMessages(clanId: string): ClanChatMessage[] {
    if (!clanId) return []
    try {
      const storage = getStorage()
      const raw = storage?.getItem(getClanChatStorageKey(clanId))
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  /**
   * Guarda un mensaje en el almacenamiento persistente del clan.
   */
  saveLocalMessage(clanId: string, msg: ClanChatMessage) {
    if (!clanId) return
    try {
      const storage = getStorage()
      if (!storage) return
      const current = this.getLocalMessages(clanId)
      if (current.some((m) => m.id === msg.id)) return
      const updated = [...current, msg].slice(-80)
      storage.setItem(getClanChatStorageKey(clanId), JSON.stringify(updated))
    } catch {}
  },

  /**
   * Guarda una lista completa de mensajes para el clan.
   */
  saveAllLocalMessages(clanId: string, messages: ClanChatMessage[]) {
    if (!clanId) return
    try {
      const storage = getStorage()
      if (!storage) return
      storage.setItem(
        getClanChatStorageKey(clanId),
        JSON.stringify(messages.slice(-80))
      )
    } catch {}
  },

  /**
   * Envía un mensaje al canal en tiempo real exclusivo del clan
   */
  async sendMessage(params: {
    clanId: string
    sender: string
    role: string
    text: string
    hasVip?: boolean
  }): Promise<{ success: boolean; messageObj: ClanChatMessage }> {
    const text = params.text.trim()
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`

    const msgObj: ClanChatMessage = {
      id: `clan-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clanId: params.clanId,
      sender: params.sender,
      role: params.role,
      text,
      time: timeStr,
      hasVip: params.hasVip,
      created_at: now.toISOString(),
    }

    // Persistir localmente de inmediato
    this.saveLocalMessage(params.clanId, msgObj)

    if (!isSupabaseConfigured() || !params.clanId) {
      return { success: true, messageObj: msgObj }
    }

    try {
      // 1. Broadcast inmediato por WebSocket en el canal privado del clan
      const channel = supabase.channel(`clan-chat-${params.clanId}`)
      await channel.send({
        type: 'broadcast',
        event: 'clan_message',
        payload: msgObj,
      })

      // 2. Persistencia en tabla clan_chat_messages si existe
      try {
        await (supabase as any)
          .from('clan_chat_messages')
          .insert([
            {
              clan_id: params.clanId,
              sender: params.sender,
              role: params.role,
              message: text,
              has_vip: Boolean(params.hasVip),
            },
          ])
      } catch {
        // El broadcast y localStorage ya garantizan la entrega
      }

      return { success: true, messageObj: msgObj }
    } catch (err) {
      console.warn('[clanChatService] Error enviando mensaje de clan:', err)
      return { success: true, messageObj: msgObj }
    }
  },

  /**
   * Se suscribe al canal privado del clan para recibir mensajes en tiempo real
   */
  subscribeToClanChat(
    clanId: string,
    onMessage: (msg: ClanChatMessage) => void
  ): () => void {
    if (!isSupabaseConfigured() || !clanId) {
      return () => {}
    }

    const channel = supabase.channel(`clan-chat-${clanId}`)

    channel
      .on(
        'broadcast',
        { event: 'clan_message' },
        (payload) => {
          if (payload?.payload && payload.payload.clanId === clanId) {
            const newMsg = payload.payload as ClanChatMessage
            this.saveLocalMessage(clanId, newMsg)
            onMessage(newMsg)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clan_chat_messages',
          filter: `clan_id=eq.${clanId}`,
        },
        (payload) => {
          if (payload?.new) {
            const raw = payload.new as any
            const date = raw.created_at ? new Date(raw.created_at) : new Date()
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date
              .getMinutes()
              .toString()
              .padStart(2, '0')}`
            const newMsg: ClanChatMessage = {
              id: raw.id || `clan-msg-${Date.now()}`,
              clanId: raw.clan_id,
              sender: raw.sender,
              role: raw.role || 'Miembro',
              text: raw.message,
              time: timeStr,
              hasVip: raw.has_vip,
              created_at: raw.created_at,
            }
            this.saveLocalMessage(clanId, newMsg)
            onMessage(newMsg)
          }
        }
      )
      .subscribe()

    return () => {
      try {
        void supabase.removeChannel(channel)
      } catch (err) {
        console.warn('[clanChatService] Error al remover canal de clan:', err)
      }
    }
  },

  /**
   * Carga mensajes recientes (combina almacenamiento local + Supabase)
   */
  async fetchRecentMessages(clanId: string, limit = 40): Promise<ClanChatMessage[]> {
    const local = this.getLocalMessages(clanId)

    if (!isSupabaseConfigured() || !clanId) {
      return local
    }

    try {
      const { data, error } = await (supabase as any)
        .from('clan_chat_messages')
        .select('*')
        .eq('clan_id', clanId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error || !data || !Array.isArray(data)) {
        return local
      }

      const remote: ClanChatMessage[] = (data as any[]).reverse().map((raw) => {
        const date = raw.created_at ? new Date(raw.created_at) : new Date()
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
        return {
          id: raw.id,
          clanId: raw.clan_id,
          sender: raw.sender,
          role: raw.role || 'Miembro',
          text: raw.message,
          time: timeStr,
          hasVip: raw.has_vip,
          created_at: raw.created_at,
        }
      })

      const mergedMap = new Map<string, ClanChatMessage>()
      for (const m of local) mergedMap.set(m.id, m)
      for (const m of remote) mergedMap.set(m.id, m)

      const merged = Array.from(mergedMap.values())
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        .slice(-80)

      this.saveAllLocalMessages(clanId, merged)
      return merged
    } catch {
      return local
    }
  },
}
