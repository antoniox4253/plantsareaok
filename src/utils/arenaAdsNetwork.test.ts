import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  activateArenaAdsNetwork,
  deactivateArenaAdsNetwork,
  loadArenaAdsNativeBanner,
  setCombatAdsBlocked,
  isCombatAdsBlocked,
  resetPopunderQuota,
  isPopunderQuotaReached,
  activateMonetagVignette,
  deactivateMonetagVignette,
  triggerArenaAdsSmartlink,
  ARENA_ADS_POPUNDER_SRC,
  ARENA_ADS_NATIVE_SRC,
  ARENA_ADS_NATIVE_CONTAINER_ID,
  MONETAG_VIGNETTE_SRC,
  MONETAG_ZONE_ID,
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

  closest(_selector: string) {
    return null
  }
}

describe('arenaAdsNetwork (Aislamiento y Ciclo de Vida de Anuncios)', () => {
  let mockHead: MockElement
  let mockBody: MockElement

  beforeEach(() => {
    mockHead = new MockElement()
    mockBody = new MockElement()

    const mockDocument = {
      head: mockHead,
      body: mockBody,
      createElement: (_tag: string) => {
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

    const mockWindow = {
      open: vi.fn((_url?: string) => ({ closed: false })),
      addEventListener: vi.fn(),
    }

    vi.stubGlobal('document', mockDocument)
    vi.stubGlobal('window', mockWindow)
  })

  afterEach(() => {
    deactivateArenaAdsNetwork(true)
    resetPopunderQuota()
    delete (globalThis as any).__arenaAdsLimiterInstalled
    if (typeof window !== 'undefined') {
      delete (window as any).__arenaAdsLimiterInstalled
    }
    vi.unstubAllGlobals()
  })

  it('1. activateArenaAdsNetwork inyecta Popunder y excluye Social Bar para no invadir esquinas en combate', () => {
    activateArenaAdsNetwork()

    const popunder = (globalThis as any).document.getElementById('arena-ads-popunder-script')
    const socialbar = (globalThis as any).document.getElementById('arena-ads-socialbar-script')

    expect(popunder).not.toBeNull()
    expect(popunder?.src).toBe(ARENA_ADS_POPUNDER_SRC)

    // El social bar se omite completamente para proteger la experiencia de juego sin anuncios en la esquina
    expect(socialbar).toBeNull()
  })

  it('2. deactivateArenaAdsNetwork elimina los scripts del DOM', () => {
    activateArenaAdsNetwork()
    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).not.toBeNull()

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

  it('5. setCombatAdsBlocked(true) bloquea la inyección de anuncios y elimina los existentes', () => {
    activateArenaAdsNetwork()
    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).not.toBeNull()

    // Entrar en combate bloquea estrictamente los anuncios
    setCombatAdsBlocked(true)
    expect(isCombatAdsBlocked()).toBe(true)
    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).toBeNull()

    // Intentar activar anuncios durante el combate no surte ningún efecto
    activateArenaAdsNetwork()
    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).toBeNull()

    // Salir del combate desbloquea la red
    setCombatAdsBlocked(false)
    expect(isCombatAdsBlocked()).toBe(false)
  })

  it('6. Solo permite 1 popunder en toda la fase previa y bloquea popunders subsiguientes', () => {
    resetPopunderQuota()
    expect(isPopunderQuotaReached()).toBe(false)

    activateArenaAdsNetwork()
    expect((globalThis as any).document.getElementById('arena-ads-popunder-script')).not.toBeNull()

    // Simular el primer popunder exitoso
    const res1 = (globalThis as any).window.open('https://popunder.com')
    expect(res1).not.toBeNull()
    expect(isPopunderQuotaReached()).toBe(true)

    // Clics subsiguientes intentando abrir popunders son estrictamente bloqueados
    const res2 = (globalThis as any).window.open('https://spam-popunder.com')
    expect(res2).toBeNull()

    const res3 = (globalThis as any).window.open('https://another-ad.com')
    expect(res3).toBeNull()

    // Avanzar a una nueva fase previa reinicia la cuota exactamente a 1
    resetPopunderQuota()
    expect(isPopunderQuotaReached()).toBe(false)
  })

  it('7. En combate NUNCA se permite abrir ventanas ni popunders (bloqueo total)', () => {
    resetPopunderQuota()
    setCombatAdsBlocked(true)
    expect(isCombatAdsBlocked()).toBe(true)

    // Cualquier llamada a window.open durante combate debe retornar null
    const res = (globalThis as any).window.open('https://popunder.com')
    expect(res).toBeNull()

    setCombatAdsBlocked(false)
  })

  it('8. Smartlink se abre sin ser bloqueado por la cuota de popunder', () => {
    resetPopunderQuota()
    activateArenaAdsNetwork()

    // El smartlink oficial de Adsterra no debe ser bloqueado
    const smartlinkRes = (globalThis as any).window.open(
      'https://www.profitablecpmrate.com/r0w5qgzk?key=0358fcd5e615f7daaddf8b75555dfa78'
    )
    expect(smartlinkRes).not.toBeNull()

    // Consumir el popunder legítimo de la fase
    const popRes1 = (globalThis as any).window.open('https://pl31424403.profitableratecpmnetwork.com/ad')
    expect(popRes1).not.toBeNull()
    expect(isPopunderQuotaReached()).toBe(true)

    // Un segundo intento de popunder rogue sí se bloquea
    const popRes2 = (globalThis as any).window.open('https://spam.com')
    expect(popRes2).toBeNull()

    // Pero un Smartlink explícito de reclamo voluntario sigue permitiéndose
    const smartlinkRes2 = (globalThis as any).window.open(
      'https://www.profitablecpmrate.com/r0w5qgzk?key=0358fcd5e615f7daaddf8b75555dfa78'
    )
    expect(smartlinkRes2).not.toBeNull()
  })

  it('9. triggerArenaAdsSmartlink delega a Telegram.WebApp.openLink si está disponible', () => {
    const mockOpenLink = vi.fn()
    ;(globalThis as any).window.Telegram = {
      WebApp: {
        openLink: mockOpenLink,
      },
    }

    triggerArenaAdsSmartlink('https://test-sponsor.com')
    expect(mockOpenLink).toHaveBeenCalledWith('https://test-sponsor.com')

    delete (globalThis as any).window.Telegram
  })

  it('10. activateMonetagVignette inyecta el script con data-zone oficial y deactivate lo remueve', () => {
    setCombatAdsBlocked(false)
    activateMonetagVignette()

    const script = (globalThis as any).document.getElementById('monetag-vignette-script')
    expect(script).not.toBeNull()
    expect(script?.src).toBe(MONETAG_VIGNETTE_SRC)
    expect(script?.getAttribute('data-zone')).toBe(MONETAG_ZONE_ID)

    deactivateMonetagVignette()
    expect((globalThis as any).document.getElementById('monetag-vignette-script')).toBeNull()
  })
})

