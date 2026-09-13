import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clanChatService } from './clanChatService'

vi.mock('../lib/supabaseClient', () => {
  return {
    isSupabaseConfigured: () => false,
    supabase: {
      channel: vi.fn(),
      from: vi.fn(),
    },
  }
})

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

describe('clanChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('permite enviar un mensaje en modo offline / fallback sin errores', async () => {
    const res = await clanChatService.sendMessage({
      clanId: 'test-clan-123',
      sender: 'TestGladiador',
      role: 'Líder',
      text: '¡Hola compañeros de clan!',
      hasVip: true,
    })

    expect(res.success).toBe(true)
    expect(res.messageObj.sender).toBe('TestGladiador')
    expect(res.messageObj.clanId).toBe('test-clan-123')
    expect(res.messageObj.role).toBe('Líder')
    expect(res.messageObj.text).toBe('¡Hola compañeros de clan!')
    expect(res.messageObj.hasVip).toBe(true)
    expect(res.messageObj.time).toMatch(/^\d{2}:\d{2}$/)
  })

  it('retorna arreglo vacío en fetchRecentMessages si no está configurado supabase', async () => {
    const msgs = await clanChatService.fetchRecentMessages('test-clan-123')
    expect(msgs).toEqual([])
  })

  it('retorna función unsubscribe no-op si no está configurado supabase', () => {
    const unsub = clanChatService.subscribeToClanChat('test-clan-123', () => {})
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })

  it('persiste la conversación del clan localmente y aísla entre clanes distintos', async () => {
    // Mensaje en Clan A
    await clanChatService.sendMessage({
      clanId: 'clan-alpha',
      sender: 'AlphaLeader',
      role: 'Líder',
      text: 'Estrategia Alpha para guerras',
    })

    // Mensaje en Clan B
    await clanChatService.sendMessage({
      clanId: 'clan-beta',
      sender: 'BetaLeader',
      role: 'Líder',
      text: 'Estrategia Beta secreta',
    })

    // Recuperar mensajes de Clan A
    const msgsAlpha = clanChatService.getLocalMessages('clan-alpha')
    expect(msgsAlpha.length).toBe(1)
    expect(msgsAlpha[0].text).toBe('Estrategia Alpha para guerras')
    expect(msgsAlpha[0].sender).toBe('AlphaLeader')

    // Recuperar mensajes de Clan B
    const msgsBeta = clanChatService.getLocalMessages('clan-beta')
    expect(msgsBeta.length).toBe(1)
    expect(msgsBeta[0].text).toBe('Estrategia Beta secreta')
    expect(msgsBeta[0].sender).toBe('BetaLeader')

    // No se mezclan
    expect(msgsAlpha.some((m) => m.text.includes('Beta'))).toBe(false)
    expect(msgsBeta.some((m) => m.text.includes('Alpha'))).toBe(false)
  })

  it('no borra ni trunca mensajes a 80 y retiene más de 100 mensajes persistentes', async () => {
    for (let i = 1; i <= 120; i++) {
      clanChatService.saveLocalMessage('clan-persistent', {
        id: `msg-${i}`,
        clanId: 'clan-persistent',
        sender: `Usuario-${i}`,
        role: 'Miembro',
        text: `Consulta o mensaje #${i}`,
        time: '12:00',
      })
    }

    const messages = clanChatService.getLocalMessages('clan-persistent')
    expect(messages.length).toBe(120)
    expect(messages[0].id).toBe('msg-1')
    expect(messages[119].id).toBe('msg-120')
  })
})
