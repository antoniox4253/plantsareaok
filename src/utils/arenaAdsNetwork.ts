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

/**
 * Activa los anuncios exclusivos de Arena ADS (Popunder + Social Bar).
 * Usa un contador de consumidores para soportar transiciones suaves entre el modal y el combate.
 */
export function activateArenaAdsNetwork(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  activeConsumersCount++
  if (isNetworkActive) return
  isNetworkActive = true

  try {
    // 1. Inyectar Popunder exclusivo si no está presente
    if (!document.getElementById('arena-ads-popunder-script')) {
      const popunderScript = document.createElement('script')
      popunderScript.id = 'arena-ads-popunder-script'
      popunderScript.src = ARENA_ADS_POPUNDER_SRC
      popunderScript.async = true
      document.head.appendChild(popunderScript)
    }

    // 2. Inyectar Social Bar exclusivo si no está presente
    if (!document.getElementById('arena-ads-socialbar-script')) {
      const socialbarScript = document.createElement('script')
      socialbarScript.id = 'arena-ads-socialbar-script'
      socialbarScript.src = ARENA_ADS_SOCIALBAR_SRC
      socialbarScript.async = true
      document.head.appendChild(socialbarScript)
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

    const native = document.getElementById('arena-ads-native-invoke-script')
    if (native) native.remove()

    // 2. Remover contenedores flotantes creados dinámicamente por la red en el body
    const externalElements = document.querySelectorAll(
      'iframe[src*="profitableratecpmnetwork"], script[src*="profitableratecpmnetwork"], div[class*="social-bar"], div[id*="social-bar"]'
    )
    externalElements.forEach((el) => {
      // Eliminar solo si no está explícitamente contenido dentro del modal o la carta de interstitial
      if (!el.closest('.arena-ads-modal') && !el.closest('.arena-ads-interstitial-card')) {
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
