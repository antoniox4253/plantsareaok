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
 * Instala un interceptor autoritativo para garantizar que NINGUNA red de anuncios
 * pueda abrir más de 1 popunder en toda la fase previa, bloqueando llamadas subsiguientes a window.open.
 */
function installPopunderLimiter(): void {
  if (typeof window === 'undefined' || (window as any).__arenaAdsLimiterInstalled) return
  ;(window as any).__arenaAdsLimiterInstalled = true

  if (typeof window.open === 'function') {
    const rawOpen = window.open.bind(window)
    window.open = function (...args) {
      if (popunderTriggeredInPhase) {
        return null
      }
      popunderTriggeredInPhase = true
      setTimeout(() => {
        const p = typeof document !== 'undefined' ? document.getElementById('arena-ads-popunder-script') : null
        if (p) p.remove()
      }, 50)
      return rawOpen(...args)
    }
  }

  if (typeof HTMLAnchorElement !== 'undefined' && HTMLAnchorElement.prototype?.click) {
    originalAnchorClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      const href = this.getAttribute('href') || ''
      const target = this.getAttribute('target') || ''
      const isAd =
        href.includes('profitableratecpmnetwork') ||
        (target === '_blank' && !this.classList?.contains('btn-telegram-link'))

      if (isAd) {
        if (popunderTriggeredInPhase) {
          return
        }
        popunderTriggeredInPhase = true
        setTimeout(() => {
          const p = document.getElementById('arena-ads-popunder-script')
          if (p) p.remove()
        }, 50)
      }
      return originalAnchorClick?.apply(this)
    }
  }

  // Escuchar el primer click para retirar el script y marcar la cuota cumplida
  if (typeof window.addEventListener === 'function') {
    window.addEventListener(
      'click',
      () => {
        if (!popunderTriggeredInPhase) {
          setTimeout(() => {
            popunderTriggeredInPhase = true
            const p = document.getElementById('arena-ads-popunder-script')
            if (p) p.remove()
          }, 150)
        }
      },
      { capture: true, passive: true }
    )
  }
}

/**
 * Bloquea estrictamente la activación de anuncios durante el combate.
 * Cuando está bloqueado, cualquier anuncio activo es destruido inmediatamente
 * y ninguna llamada a activateArenaAdsNetwork tendrá efecto.
 */
export function setCombatAdsBlocked(blocked: boolean): void {
  isCombatActive = blocked
  if (blocked) {
    deactivateArenaAdsNetwork(true)
  }
}

export function isCombatAdsBlocked(): boolean {
  return isCombatActive
}

/**
 * Activa los anuncios exclusivos de Arena ADS (Popunder + Social Bar).
 * Usa un contador de consumidores para soportar transiciones suaves.
 * NUNCA se activa si el combate está en curso.
 * Si ya se disparó 1 popunder en la fase previa actual, NO vuelve a inyectar el popunder.
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
    // 1. Inyectar Popunder exclusivo ÚNICAMENTE si no se ha alcanzado la cuota de 1 en esta fase previa
    if (!popunderTriggeredInPhase && !document.getElementById('arena-ads-popunder-script')) {
      const popunderScript = document.createElement('script')
      popunderScript.id = 'arena-ads-popunder-script'
      popunderScript.src = ARENA_ADS_POPUNDER_SRC
      popunderScript.async = true
      document.head.appendChild(popunderScript)
    }

    // 2. Nota: La red Social Bar (esquina flotante) se omite completamente para no tapar ni dañar
    // la experiencia de combate en la arena táctica.
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
