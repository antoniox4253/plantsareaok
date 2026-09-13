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
      const updated = [...current, msg].slice(-250)
      storage.setItem(getClanChatStorageKey(clanId), JSON.stringify(updated))
    } catch {}
  },

  /**
   * Guarda una lista completa de mensajes para el clan sin pérdidas.
   */
  saveAllLocalMessages(clanId: string, messages: ClanChatMessage[]) {
    if (!clanId) return
    try {
      const storage = getStorage()
      if (!storage) return
      storage.setItem(
        getClanChatStorageKey(clanId),
        JSON.stringify(messages.slice(-250))
      )
    } catch {}
  },

  /**
   * Envía un mensaje al canal en tiempo real y persiste en el backend con validación autoritativa
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

    let msgObj: ClanChatMessage = {
      id: `clan-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clanId: params.clanId,
      sender: params.sender,
      role: params.role,
      text,
      time: timeStr,
      hasVip: params.hasVip,
      created_at: now.toISOString(),
    }

    if (!isSupabaseConfigured() || !params.clanId) {
      this.saveLocalMessage(params.clanId, msgObj)
      return { success: true, messageObj: msgObj }
    }

    try {
      // 1. Validación y persistencia autoritativa en el backend mediante RPC
      try {
        const { data, error } = await (supabase.rpc as any)('send_clan_chat_message', {
          p_clan_id: params.clanId,
          p_message: text,
        })
        if (!error && data?.success && data?.messageObj) {
          msgObj = data.messageObj as ClanChatMessage
        } else if (error) {
          console.warn('[clanChatService] Fallback insert directo tras error RPC:', error.message)
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
        }
      } catch (err) {
        console.warn('[clanChatService] Error en persistencia backend:', err)
      }

      // 2. Persistir localmente
      this.saveLocalMessage(params.clanId, msgObj)

      // 3. Broadcast inmediato por WebSocket en el canal privado del clan
      try {
        const channel = supabase.channel(`clan-chat-${params.clanId}`)
        await channel.send({
          type: 'broadcast',
          event: 'clan_message',
          payload: msgObj,
        })
      } catch (broadcastErr) {
        console.warn('[clanChatService] Error en broadcast WebSocket:', broadcastErr)
      }

      return { success: true, messageObj: msgObj }
    } catch (err) {
      console.warn('[clanChatService] Error enviando mensaje de clan:', err)
      this.saveLocalMessage(params.clanId, msgObj)
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
  async fetchRecentMessages(clanId: string, limit = 150): Promise<ClanChatMessage[]> {
    const local = this.getLocalMessages(clanId)

    if (!isSupabaseConfigured() || !clanId) {
      return local
    }

    try {
      let remote: ClanChatMessage[] = []

      // 1. Intentar RPC autoritativa get_clan_chat_messages
      try {
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_clan_chat_messages', {
          p_clan_id: clanId,
          p_limit: limit,
        })
        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          remote = rpcData as ClanChatMessage[]
        }
      } catch (err) {
        console.warn('[clanChatService] Error en RPC get_clan_chat_messages:', err)
      }

      // 2. Si no retornó vía RPC, fallback a consulta directa
      if (remote.length === 0) {
        const { data, error } = await (supabase as any)
          .from('clan_chat_messages')
          .select('*')
          .eq('clan_id', clanId)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (!error && data && Array.isArray(data)) {
          remote = (data as any[]).reverse().map((raw) => {
            const date = raw.created_at ? new Date(raw.created_at) : new Date()
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date
              .getMinutes()
              .toString()
              .padStart(2, '0')}`
            return {
              id: String(raw.id),
              clanId: String(raw.clan_id),
              sender: raw.sender,
              role: raw.role || 'Miembro',
              text: raw.message,
              time: timeStr,
              hasVip: raw.has_vip,
              created_at: raw.created_at,
            }
          })
        }
      }

      if (remote.length === 0 && local.length > 0) {
        return local
      }

      const mergedMap = new Map<string, ClanChatMessage>()
      for (const m of local) mergedMap.set(m.id, m)
      for (const m of remote) mergedMap.set(m.id, m)

      const merged = Array.from(mergedMap.values())
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        .slice(-250)

      this.saveAllLocalMessages(clanId, merged)
      return merged
    } catch {
      return local
    }
  },
}
