/**
 * arenaAdsNetwork.ts
 * Gestor exclusivo de la red de publicidad para la sección ARENA ADS.
 * 
 * Separa y confina los 3 formatos de anuncios para que SOLO se ejecuten
 * dentro de Arena ADS (modal, fase previa y combate en arena_ads),
 * limpiando scripts y elementos inyectados al salir de esta sección para
 * no contaminar el resto del juego (Jardín, PvP Ranked, Mercado, etc.).
 *
 * Formatos configurados:
 * 1. Popunder: pl31424403 / 0358fcd5e615f7daaddf8b75555dfa78.js
 * 2. Social Bar: pl31424404 / 6ba2b3226bb35931bb433c82b52cb327.js
 * 3. Native Banner: pl31424406 / container-13fe7b3f4a20a01079a149b2ec1c1061
 */

export const ARENA_ADS_POPUNDER_SRC =
  'https://pl31424403.profitableratecpmnetwork.com/03/58/fc/0358fcd5e615f7daaddf8b75555dfa78.js'

export const ARENA_ADS_SOCIALBAR_SRC =
  'https://pl31424404.profitableratecpmnetwork.com/6b/a2/b3/6ba2b3226bb35931bb433c82b52cb327.js'

export const ARENA_ADS_NATIVE_CONTAINER_ID = 'container-13fe7b3f4a20a01079a149b2ec1c1061'

export const ARENA_ADS_NATIVE_SRC =
  'https://pl31424406.profitableratecpmnetwork.com/13fe7b3f4a20a01079a149b2ec1c1061/invoke.js'

export const ARENA_ADS_SMARTLINK_URL =
  'https://www.profitablecpmrate.com/r0w5qgzk?key=0358fcd5e615f7daaddf8b75555dfa78'

/**
 * Script oficial de Monetag Vignette (Interstitials de alto CPM para juegos)
 * Zone ID: 11883853
 */
export const MONETAG_VIGNETTE_SRC = 'https://n6wxm.com/vignette.min.js'
export const MONETAG_ZONE_ID = '11883853'

/**
 * Dispara el Smartlink / DirectLink de alto CPM cuando el jugador reclama botín o duplica recompensa.
 * Abre la oferta patrocinada en una nueva pestaña limpia para que la red no penalice el tiempo de permanencia.
 */
export function triggerArenaAdsSmartlink(customUrl?: string): void {
  if (typeof window === 'undefined') return
  try {
    const targetUrl = customUrl || ARENA_ADS_SMARTLINK_URL
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  } catch (err) {
    console.warn('[ArenaAdsNetwork] Error al disparar Smartlink:', err)
  }
}

let isNetworkActive = false
let activeConsumersCount = 0
let isCombatActive = false
let popunderTriggeredInPhase = false

let originalAnchorClick: typeof HTMLAnchorElement.prototype.click | null = null

/**
 * Reinicia la cuota de popunders para una nueva fase de preparación (ej. nuevo nivel alcanzado o nueva run).
 * Permite exactamente 1 popunder en toda la fase previa.
 */
export function resetPopunderQuota(): void {
  popunderTriggeredInPhase = false
}

export function isPopunderQuotaReached(): boolean {
  return popunderTriggeredInPhase
}

/**
 * Activa el formato Vignette de Monetag (interstitials de alto CPM optimizados para juegos).
 */
export function activateMonetagVignette(): void {
  if (typeof document === 'undefined') return
  if (isCombatActive) return
  if (document.getElementById('monetag-vignette-script')) return

  try {
    const s = document.createElement('script')
    s.id = 'monetag-vignette-script'
    s.setAttribute('data-zone', MONETAG_ZONE_ID)
    if (s.dataset) {
      s.dataset.zone = MONETAG_ZONE_ID
    }
    s.src = MONETAG_VIGNETTE_SRC
    s.async = true
    const target = [document.documentElement, document.body].filter(Boolean).pop()
    if (target) {
      target.appendChild(s)
    }
  } catch (err) {
    console.warn('[ArenaAdsNetwork] Error al activar Monetag Vignette:', err)
  }
}

/**
 * Desactiva y limpia Monetag Vignette al salir de Arena ADS para no interferir en el resto del juego.
 */
export function deactivateMonetagVignette(): void {
  if (typeof document === 'undefined') return
  try {
    const s = document.getElementById('monetag-vignette-script')
    if (s) s.remove()

    // Limpiar posibles overlays o iframes que Monetag pudiera haber dejado
    const elements = document.querySelectorAll(
      '[id*="monetag"], [class*="monetag"], [data-zone="11883853"], div[class*="vignette"], iframe[src*="n6wxm.com"]'
    )
    elements.forEach((el) => el.remove())
  } catch (err) {
    console.warn('[ArenaAdsNetwork] Error al limpiar Monetag Vignette:', err)
  }
}

/**
 * Instala un interceptor autoritativo para garantizar que NINGUNA red de anuncios
 * pueda abrir más de 1 popunder en toda la fase previa, bloqueando llamadas subsiguientes a window.open.
 * No destruye prematuramente el script para permitir que el ping de tracking confirme la impresión.
 */
function installPopunderLimiter(): void {
  if (typeof window === 'undefined' || (window as any).__arenaAdsLimiterInstalled) return
  ;(window as any).__arenaAdsLimiterInstalled = true

  if (typeof window.open === 'function') {
    const rawOpen = window.open.bind(window)
    window.open = function (...args) {
      if (isCombatActive) {
        console.warn('[ArenaAdsNetwork] Bloqueo total: intento de popup publicitario bloqueado en combate.')
        return null
      }
      if (popunderTriggeredInPhase) {
        return null
      }
      popunderTriggeredInPhase = true
      return rawOpen(...args)
    }
  }

  if (typeof HTMLAnchorElement !== 'undefined' && HTMLAnchorElement.prototype?.click) {
    originalAnchorClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (isCombatActive) {
        return
      }
      const href = this.getAttribute('href') || ''
      const target = this.getAttribute('target') || ''
      const isAd =
        href.includes('profitableratecpmnetwork') ||
        href.includes('profitablecpmrate') ||
        href.includes('n6wxm') ||
        (target === '_blank' && !this.classList?.contains('btn-telegram-link'))

      if (isAd) {
        if (popunderTriggeredInPhase) {
          return
        }
        popunderTriggeredInPhase = true
      }
      return originalAnchorClick?.apply(this)
    }
  }

  // Escuchar el primer click para marcar la cuota cumplida sin cortar la llamada HTTP
  if (typeof window.addEventListener === 'function') {
    window.addEventListener(
      'click',
      () => {
        if (!popunderTriggeredInPhase && !isCombatActive) {
          popunderTriggeredInPhase = true
        }
      },
      { capture: true, passive: true }
    )
  }
}

let combatObserver: MutationObserver | null = null

/**
 * Bloquea estrictamente la activación de anuncios durante el combate.
 * Cuando está bloqueado, cualquier anuncio activo es destruido inmediatamente,
 * un MutationObserver neutraliza cualquier overlay o iframe en tiempo real
 * y ninguna llamada a activateArenaAdsNetwork tendrá efecto.
 */
export function setCombatAdsBlocked(blocked: boolean): void {
  isCombatActive = blocked
  installPopunderLimiter()
  if (blocked) {
    deactivateArenaAdsNetwork(true)

    // 1. Purga total inmediata del DOM
    if (typeof document !== 'undefined') {
      const adElements = document.querySelectorAll(
        'iframe[src*="profitableratecpmnetwork"], script[src*="profitableratecpmnetwork"], iframe[src*="n6wxm"], script[src*="n6wxm"], iframe[src*="vignette"], div[class*="vignette"], [id*="monetag"], [class*="monetag"], [data-zone="11883853"], div[class*="social-bar"], div[id*="social-bar"], div[class*="push-notification"]'
      )
      adElements.forEach((el) => el.remove())

      // 2. Instalar escudo de combate (MutationObserver) para neutralizar cualquier elemento publicitario en tiempo real
      if (typeof MutationObserver !== 'undefined') {
        if (combatObserver) combatObserver.disconnect()
        combatObserver = new MutationObserver((mutations) => {
          if (!isCombatActive) return
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node instanceof HTMLElement) {
                const src = node.getAttribute('src') || ''
                const id = node.id || ''
                const className = typeof node.className === 'string' ? node.className : ''
                if (
                  src.includes('profitableratecpmnetwork') ||
                  src.includes('n6wxm') ||
                  src.includes('vignette') ||
                  src.includes('profitablecpmrate') ||
                  id.includes('monetag') ||
                  className.includes('vignette') ||
                  className.includes('monetag')
                ) {
                  node.remove()
                }
              }
            }
          }
        })
        combatObserver.observe(document.documentElement, { childList: true, subtree: true })
      }
    }
  } else {
    if (combatObserver) {
      combatObserver.disconnect()
      combatObserver = null
    }
  }
}

export function isCombatAdsBlocked(): boolean {
  return isCombatActive
}

/**
 * Activa la red de Arena ADS.
 * NUNCA se activa si el combate está en curso.
 * No inyecta scripts invasivos de auto-click en el background para garantizar
 * que el combate esté 100% limpio y sin interrupciones.
 */
export function activateArenaAdsNetwork(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (isCombatActive) {
    return
  }

  installPopunderLimiter()

  activeConsumersCount++
  if (isNetworkActive) return
  isNetworkActive = true

  try {
    // Inyectar Popunder exclusivo ÚNICAMENTE si no se ha alcanzado la cuota de 1 en esta fase previa
    if (!popunderTriggeredInPhase && !document.getElementById('arena-ads-popunder-script')) {
      const popunderScript = document.createElement('script')
      popunderScript.id = 'arena-ads-popunder-script'
      popunderScript.src = ARENA_ADS_POPUNDER_SRC
      popunderScript.async = true
      document.head.appendChild(popunderScript)
    }
  } catch (err) {
    console.warn('[ArenaAdsNetwork] Error al inicializar red de anuncios:', err)
  }
}

/**
 * Desactiva y limpia los anuncios de Arena ADS cuando el usuario sale de la sección.
 */
export function deactivateArenaAdsNetwork(force = false): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  if (!force) {
    activeConsumersCount = Math.max(0, activeConsumersCount - 1)
    if (activeConsumersCount > 0) {
      return // Aún hay una vista de Arena ADS activa (ej. combate o modal)
    }
  } else {
    activeConsumersCount = 0
  }

  isNetworkActive = false

  try {
    // 1. Remover scripts inyectados
    const popunder = document.getElementById('arena-ads-popunder-script')
    if (popunder) popunder.remove()

    const socialbar = document.getElementById('arena-ads-socialbar-script')
    if (socialbar) socialbar.remove()

    // 2. Limpiar Monetag Vignette
    deactivateMonetagVignette()

    const native = document.getElementById('arena-ads-native-invoke-script')
    if (native) native.remove()

    // 2. Remover contenedores flotantes creados dinámicamente por la red en el body (esquinas flotantes, popups, etc.)
    const externalElements = document.querySelectorAll(
      'iframe[src*="profitableratecpmnetwork"]:not(.arena-ads-combat-flank-iframe), script[src*="profitableratecpmnetwork"], div[class*="social-bar"], div[id*="social-bar"], div[class*="push-notification"], div[id*="push-notification"]'
    )
    externalElements.forEach((el) => {
      // Eliminar solo si no está explícitamente contenido dentro de los flancos o modales autorizados
      if (!el.closest('.arena-ads-modal') && !el.closest('.arena-ads-interstitial-card') && !el.closest('.arena-ads-combat-flank')) {
        el.remove()
      }
    })
  } catch (err) {
    console.warn('[ArenaAdsNetwork] Error al limpiar red de anuncios:', err)
  }
}

/**
 * Carga el Native Banner en el contenedor especificado
 */
export function loadArenaAdsNativeBanner(containerId = ARENA_ADS_NATIVE_CONTAINER_ID): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (isCombatActive) return

  const container = document.getElementById(containerId)
  if (!container) return

  // Si ya existe el script dentro del contenedor o head, no duplicar innecesariamente
  const existing = document.getElementById('arena-ads-native-invoke-script')
  if (existing) {
    existing.remove()
  }

  try {
    const script = document.createElement('script')
    script.id = 'arena-ads-native-invoke-script'
    script.src = ARENA_ADS_NATIVE_SRC
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    document.body.appendChild(script)
  } catch (err) {
    console.warn('[ArenaAdsNetwork] Error al cargar Native Banner:', err)
  }
}
