import { describe, it, expect, beforeEach } from 'vitest'

const store: Record<string, string> = {}
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value
  },
  removeItem: (key: string) => {
    delete store[key]
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k])
  },
}
;(globalThis as any).localStorage = mockLocalStorage

const classList = new Set<string>()
const mockBody = {
  classList: {
    add: (c: string) => classList.add(c),
    remove: (c: string) => classList.delete(c),
    contains: (c: string) => classList.has(c),
  },
  className: '',
}
;(globalThis as any).document = {
  body: mockBody,
}

import {
  getGraphicsQuality,
  isLowGraphics,
  applyGraphicsQuality,
  toggleGraphicsQuality,
  initGraphicsSettings,
  subscribeGraphicsQuality,
} from './graphicsSettings'

describe('graphicsSettings', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
    classList.clear()
    applyGraphicsQuality('high')
  })

  it('inicia en calidad alta por defecto', () => {
    expect(getGraphicsQuality()).toBe('high')
    expect(isLowGraphics()).toBe(false)
    expect(classList.has('low-graphics-mode')).toBe(false)
  })

  it('permite cambiar a gráficos mínimos (rendimiento)', () => {
    applyGraphicsQuality('low')
    expect(getGraphicsQuality()).toBe('low')
    expect(isLowGraphics()).toBe(true)
    expect(classList.has('low-graphics-mode')).toBe(true)
    expect(mockLocalStorage.getItem('plants_arena_graphics_quality')).toBe('low')
  })

  it('toggleGraphicsQuality alterna entre high y low', () => {
    expect(toggleGraphicsQuality()).toBe('low')
    expect(isLowGraphics()).toBe(true)
    expect(classList.has('low-graphics-mode')).toBe(true)

    expect(toggleGraphicsQuality()).toBe('high')
    expect(isLowGraphics()).toBe(false)
    expect(classList.has('low-graphics-mode')).toBe(false)
  })

  it('notifica a los suscriptores cuando cambia la calidad', () => {
    const received: string[] = []
    const unsubscribe = subscribeGraphicsQuality((q) => {
      received.push(q)
    })

    toggleGraphicsQuality()
    toggleGraphicsQuality()

    expect(received).toEqual(['low', 'high'])
    unsubscribe()

    toggleGraphicsQuality()
    expect(received.length).toBe(2)
  })

  it('initGraphicsSettings sincroniza la clase en el body', () => {
    applyGraphicsQuality('low')
    classList.clear()
    expect(classList.has('low-graphics-mode')).toBe(false)

    initGraphicsSettings()
    expect(classList.has('low-graphics-mode')).toBe(true)
  })
})
