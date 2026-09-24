import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  activateArenaAdsNetwork,
  deactivateArenaAdsNetwork,
  loadArenaAdsNativeBanner,
  ARENA_ADS_POPUNDER_SRC,
  ARENA_ADS_SOCIALBAR_SRC,
  ARENA_ADS_NATIVE_SRC,
  ARENA_ADS_NATIVE_CONTAINER_ID,
} from './arenaAdsNetwork'

// Mock DOM simple para entornos de prueba Node.js
class MockElement {
  id: string = ''
  src: string = ''
  className: string = ''
  async: boolean = false
  attributes: Record<string, string> = {}
  children: MockElement[] = []
  parentNode: MockElement | null = null

  setAttribute(name: string, value: string) {
    this.attributes[name] = value
  }

  getAttribute(name: string) {
    return this.attributes[name] || null
  }

  appendChild(child: MockElement) {
    child.parentNode = this
    this.children.push(child)
    return child
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this)
      if (idx !== -1) {
        this.parentNode.children.splice(idx, 1)
      }
      this.parentNode = null
    }
  }

  closest(selector: string) {
    return null
  }
}

describe('arenaAdsNetwork (Aislamiento y Ciclo de Vida de Anuncios)', () => {
  let mockHead: MockElement
  let mockBody: MockElement
  let elementsMap: Map<string, MockElement>

  beforeEach(() => {
    mockHead = new MockElement()
    mockBody = new MockElement()
    elementsMap = new Map()

    const mockDocument = {
      head: mockHead,
      body: mockBody,
      createElement: (tag: string) => {
        const el = new MockElement()
        return el
      },
      getElementById: (id: string) => {
        const findInTree = (node: MockElement): MockElement | null => {
          if (node.id === id) return node
          for (const ch of node.children) {
            const found = findInTree(ch)
            if (found) return found
          }
          return null
        }
        return findInTree(mockHead) || findInTree(mockBody)
      },
      querySelectorAll: (selector: string) => {
        const results: MockElement[] = []
        const traverse = (node: MockElement) => {
          if (node.className && selector.includes(node.className)) {
            results.push(node)
          }
          for (const ch of node.children) {
            traverse(ch)
          }
        }
        traverse(mockHead)
        traverse(mockBody)
        return results
      },
    }

    vi.stubGlobal('document', mockDocument)
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    deactivateArenaAdsNetwork(true)
    vi.unstubAllGlobals()
  })

  it('1. activateArenaAdsNetwork inyecta Popunder y Social Bar en el DOM', () => {
    activateArenaAdsNetwork()

    const popunder = (globalThis as any).document.getElementById('arena-ads-popunder-script')
    const socialbar = (globalThis as any).document.getElementById('arena-ads-socialbar-script')

    expect(popunder).not.toBeNull()
    expect(popunder?.src).toBe(ARENA_ADS_POPUNDER_SRC)

    expect(socialbar).not.toBeNull()
    expect(socialbar?.src).toBe(ARENA_ADS_SOCIALBAR_SRC)
  })

  it('2. deactivateArenaAdsNetwork elimina los scripts del DOM', () => {
    activateArenaAdsNetwork()
    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).not.toBeNull()
    expect((globalThis as any).document.getElementById('arena-ads-socialbar-script')).not.toBeNull()

    deactivateArenaAdsNetwork(true)

    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).toBeNull()
    expect((globalThis as any).document.getElementById('arena-ads-socialbar-script')).toBeNull()
  })

  it('3. loadArenaAdsNativeBanner inyecta el script invoke.js con data-cfasync=false si el contenedor existe', () => {
    const container = new MockElement()
    container.id = ARENA_ADS_NATIVE_CONTAINER_ID
    mockBody.appendChild(container)

    loadArenaAdsNativeBanner(ARENA_ADS_NATIVE_CONTAINER_ID)

    const nativeScript = (globalThis as any).document.getElementById('arena-ads-native-invoke-script')
    expect(nativeScript).not.toBeNull()
    expect(nativeScript?.src).toBe(ARENA_ADS_NATIVE_SRC)
    expect(nativeScript?.getAttribute('data-cfasync')).toBe('false')
  })

  it('4. Maneja llamadas concurrentes de múltiples consumidores sin duplicar scripts', () => {
    activateArenaAdsNetwork()
    activateArenaAdsNetwork()
    activateArenaAdsNetwork()

    // Solo debe haber un script con ese ID en mockHead
    const popunderScripts = mockHead.children.filter((c) => c.id === 'arena-ads-popunder-script')
    expect(popunderScripts.length).toBe(1)

    // Un consumidor sale, pero quedan 2 más activos
    deactivateArenaAdsNetwork(false)
    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).not.toBeNull()

    // Forzar desactivación total
    deactivateArenaAdsNetwork(true)
    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).toBeNull()
  })
})
