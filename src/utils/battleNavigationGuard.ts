import type { GameScreen } from './analytics'

export const BATTLE_BACK_BLOCKED_EVENT = 'plant-arena:battle-back-blocked'

/**
 * Determina si la navegación hacia atrás del navegador (`popstate` / swipe-back)
 * debe bloquearse para no sacar al jugador de la pantalla de combate.
 */
export function shouldBlockPopStateInScreen(currentScreen: GameScreen): boolean {
  return currentScreen === 'battle'
}

/**
 * Conserva la ruta adecuada en la barra de direcciones al re-anclar la entrada
 * de historial durante la pantalla de combate.
 */
export function buildBattleGuardHistoryUrl(currentPathname?: string | null): string {
  const path = (currentPathname || '').toLowerCase()
  if (path.includes('/game-over')) {
    return '/play/game-over'
  }
  return '/play/in-game'
}

/**
 * Re-ancla el historial del navegador sobre la batalla cuando el usuario intenta
 * retroceder (botón Atrás, gesto swipe-back en móvil o botón lateral de ratón).
 * Nunca redirige hacia pantallas previas.
 */
export function reanchorBattleHistoryGuard(options?: {
  historyObj?: Pick<History, 'pushState'>
  locationObj?: Pick<Location, 'protocol' | 'pathname'>
  title?: string
  dispatchEventFn?: (event: Event) => boolean
}): boolean {
  const historyObj = options?.historyObj ?? (typeof window !== 'undefined' ? window.history : undefined)
  const locationObj = options?.locationObj ?? (typeof window !== 'undefined' ? window.location : undefined)
  const title = options?.title ?? 'Plant Arena - En Batalla'

  if (!historyObj || !locationObj) return false

  try {
    if (locationObj.protocol !== 'file:') {
      const targetUrl = buildBattleGuardHistoryUrl(locationObj.pathname)
      historyObj.pushState({ screen: 'battle', battleGuard: true }, title, targetUrl)
    }
  } catch {
    // Fallback seguro si el navegador restringe History API en el contexto actual
  }

  try {
    if (options?.dispatchEventFn) {
      options.dispatchEventFn(new Event(BATTLE_BACK_BLOCKED_EVENT))
    } else if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(BATTLE_BACK_BLOCKED_EVENT))
    }
  } catch {
    // Ignorar en entornos sin soporte de eventos DOM
  }

  return true
}
