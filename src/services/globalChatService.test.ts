import { describe, it, expect, vi, beforeEach } from 'vitest'
import { globalChatService } from './globalChatService'
import * as supabaseClientModule from '../lib/supabaseClient'

let memoryStore: Record<string, string> = {}
const mockLocalStorage = {
  getItem: (key: string) => memoryStore[key] || null,
  setItem: (key: string, val: string) => {
    memoryStore[key] = String(val)
  },
  removeItem: (key: string) => {
    delete memoryStore[key]
  },
  clear: () => {
    memoryStore = {}
  },
}
vi.stubGlobal('localStorage', mockLocalStorage)
vi.stubGlobal('window', { localStorage: mockLocalStorage })

describe('globalChatService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockLocalStorage.clear()
    globalChatService._resetCooldownForTesting()
  })

  it('rechaza mensajes vacíos o con solo espacios en blanco', async () => {
    const res = await globalChatService.sendMessage({
      username: 'TestPlayer',
      message: '   ',
    })
    expect(res.success).toBe(false)
    expect(res.error).toContain('vacío')
  })

  it('rechaza mensajes que exceden 150 caracteres', async () => {
    const longText = 'a'.repeat(151)
    const res = await globalChatService.sendMessage({
      username: 'TestPlayer',
      message: longText,
    })
    expect(res.success).toBe(false)
    expect(res.error).toContain('150')
  })

  it('aplica protección anti-spam si se envían dos mensajes seguidos inmediatamente', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(false)

    // Primer mensaje
    const res1 = await globalChatService.sendMessage({
      username: 'TestPlayer',
      message: 'Hola a todos',
    })
    expect(res1.success).toBe(true)

    // Segundo mensaje inmediato
    const res2 = await globalChatService.sendMessage({
      username: 'TestPlayer',
      message: 'Mensaje repetido rápido',
    })
    expect(res2.success).toBe(false)
    expect(res2.error).toContain('Espera')
  })

  it('fetchRecentMessages devuelve lista ordenada en modo no configurado', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(false)

    const list = await globalChatService.fetchRecentMessages(20)
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBe(0)
  })

  it('fetchRecentMessages invoca la consulta a Supabase cuando está configurado', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true)

    const mockMessages = [
      { id: '1', username: 'P1', message: 'M1', has_vip: false, created_at: '2026-09-12T10:00:00Z' },
      { id: '2', username: 'P2', message: 'M2', has_vip: true, created_at: '2026-09-12T10:01:00Z' },
    ]

    const mockOrder = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [...mockMessages],
        error: null,
      }),
    })

    const mockSelect = vi.fn().mockReturnValue({
      order: mockOrder,
    })

    vi.spyOn(supabaseClientModule.supabase, 'from').mockReturnValue({
      select: mockSelect,
    } as any)

    const res = await globalChatService.fetchRecentMessages(10)
    expect(res).toBeDefined()
    expect(res.length).toBe(2)
  })

  it('mantiene la persistencia de la conversación tras reinicio/recarga de página', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(false)

    // Enviar mensaje
    await globalChatService.sendMessage({
      username: 'GuerreroPersistente',
      message: 'Mensaje que debe sobrevivir a recarga',
    })

    // Simular recarga de página: getLocalMessages y fetchRecentMessages leen del storage
    const localMsgs = globalChatService.getLocalMessages()
    expect(localMsgs.length).toBe(1)
    expect(localMsgs[0].message).toBe('Mensaje que debe sobrevivir a recarga')

    const fetched = await globalChatService.fetchRecentMessages(20)
    expect(fetched.length).toBe(1)
    expect(fetched[0].username).toBe('GuerreroPersistente')
  })
})
