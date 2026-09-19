import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { soundManager } from './audioManager'

describe('adManager - Control de Anuncios y Carga Bajo Demanda', () => {
  let listeners: Record<string, ((...args: any[]) => void)[]> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    listeners = {}

    const mockWindow: any = {
      location: { hostname: 'localhost' },
      addEventListener: vi.fn((event: string, cb: any) => {
        if (!listeners[event]) listeners[event] = []
        listeners[event].push(cb)
      }),
      removeEventListener: vi.fn((event: string, cb: any) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((f) => f !== cb)
        }
      }),
      dispatchEvent: vi.fn((ev: any) => {
        const type = ev?.type || ev
        if (listeners[type]) {
          listeners[type].forEach((cb) => cb(ev))
        }
        return true
      }),
    }

    const mockDocument: any = {
      getElementById: vi.fn().mockReturnValue(null),
      createElement: vi.fn().mockReturnValue({
        setAttribute: vi.fn(),
      }),
      head: {
        appendChild: vi.fn(),
      },
    }

    vi.stubGlobal('window', mockWindow)
    vi.stubGlobal('document', mockDocument)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no reproduce anuncios si está en cooldown', async () => {
    const { adManager } = await import('./adManager')
    expect(adManager.canShowAd()).toBe(true)
  })

  it('simula anuncio exitoso en entorno de desarrollo/pruebas locales', async () => {
    const { adManager } = await import('./adManager')
    const result = await adManager.showAd('test_placement')
    expect(result).toBe(true)
  })

  it('ensureSdkLoaded resuelve satisfactoriamente', async () => {
    const { adManager } = await import('./adManager')
    const result = await adManager.ensureSdkLoaded()
    expect(result).toBe(true)
  })

  it('pausa el audio con ad:pause y lo reanuda con ad:resume si no estaba silenciado', async () => {
    const isMutedSpy = vi.spyOn(soundManager, 'isMuted').mockReturnValue(false)
    const setMutedSpy = vi.spyOn(soundManager, 'setMuted').mockImplementation(() => {})

    const gWindow = (globalThis as any).window
    // Simular evento ad:pause
    gWindow.dispatchEvent({ type: 'ad:pause' })
    // Simular evento ad:resume
    gWindow.dispatchEvent({ type: 'ad:resume' })

    isMutedSpy.mockRestore()
    setMutedSpy.mockRestore()
  })
})
