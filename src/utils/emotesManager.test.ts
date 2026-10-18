import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  EMOTES_CATALOG,
  DEFAULT_UNLOCKED_EMOTES,
  getUnlockedEmoteIds,
  isEmoteUnlocked,
  unlockEmoteLocal,
  purchaseEmoteWithGold,
  getEmoteById,
} from './emotesManager'

describe('emotesManager', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      length: store.size,
    } as Storage

    if (!globalThis.window) {
      // @ts-expect-error mock window in node test
      globalThis.window = {
        dispatchEvent: () => true,
      }
    }

    vi.restoreAllMocks()
  })

  it('debe tener los 10 emotes definidos en el catálogo con sus assets y metadatos', () => {
    expect(EMOTES_CATALOG.length).toBe(10)
    const ids = EMOTES_CATALOG.map((e) => e.id)
    expect(ids).toContain('hola')
    expect(ids).toContain('gg')
    expect(ids).toContain('jaja')
    expect(ids).toContain('grr')
    expect(ids).toContain('piedad')
    expect(ids).toContain('que_rico')
    expect(ids).toContain('unete_clan')
    expect(ids).toContain('papi_dagger')
    expect(ids).toContain('wow')
    expect(ids).toContain('triste')

    EMOTES_CATALOG.forEach((item) => {
      expect(item.label).toBeTruthy()
      expect(item.imageSrc).toMatch(/\.png$/)
      expect(item.webpSrc).toMatch(/\.webp$/)
      expect(typeof item.priceGold).toBe('number')
      expect(typeof item.priceGems).toBe('number')
    })
  })

  it('los emotes por defecto deben ser gratuitos y estar siempre desbloqueados', () => {
    DEFAULT_UNLOCKED_EMOTES.forEach((id) => {
      expect(isEmoteUnlocked(id)).toBe(true)
      const def = getEmoteById(id)
      expect(def?.priceGold).toBe(0)
      expect(def?.priceGems).toBe(0)
    })
  })

  it('los emotes premium deben requerir compra y costar 1200 de oro o 100 gemas', () => {
    expect(isEmoteUnlocked('grr')).toBe(false)
    expect(isEmoteUnlocked('papi_dagger')).toBe(false)
    expect(isEmoteUnlocked('wow')).toBe(false)
    const grr = getEmoteById('grr')
    expect(grr?.priceGold).toBe(1200)
    expect(grr?.priceGems).toBe(100)
  })

  it('permite desbloquear localmente un emote y persistirlo en storage', () => {
    expect(isEmoteUnlocked('que_rico')).toBe(false)
    const updated = unlockEmoteLocal('que_rico')
    expect(updated).toContain('que_rico')
    expect(isEmoteUnlocked('que_rico')).toBe(true)
    expect(getUnlockedEmoteIds()).toContain('que_rico')
  })

  it('rechaza la compra si el jugador no tiene suficiente oro', async () => {
    const res = await purchaseEmoteWithGold('papi_dagger', 1000) // Cuesta 1200
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Oro insuficiente/)
    expect(isEmoteUnlocked('papi_dagger')).toBe(false)
  })

  it('completa la compra si tiene saldo suficiente y actualiza el saldo de oro', async () => {
    const initialGold = 2000
    const res = await purchaseEmoteWithGold('grr', initialGold) // Cuesta 1200
    expect(res.success).toBe(true)
    expect(res.newGold).toBe(800)
    expect(isEmoteUnlocked('grr')).toBe(true)
    expect(res.unlockedEmotes).toContain('grr')
  })

  it('no descuenta oro si el emote ya está desbloqueado', async () => {
    unlockEmoteLocal('wow')
    const res = await purchaseEmoteWithGold('wow', 500)
    expect(res.success).toBe(true)
    expect(res.newGold).toBe(500)
  })
})
