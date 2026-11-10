import { describe, it, expect, vi } from 'vitest'
import {
  BATTLE_BACK_BLOCKED_EVENT,
  buildBattleGuardHistoryUrl,
  reanchorBattleHistoryGuard,
  shouldBlockPopStateInScreen,
} from './battleNavigationGuard'

describe('battleNavigationGuard', () => {
  it('bloquea popstate exclusivamente durante la pantalla de combate', () => {
    expect(shouldBlockPopStateInScreen('battle')).toBe(true)
    expect(shouldBlockPopStateInScreen('menu')).toBe(false)
    expect(shouldBlockPopStateInScreen('jardin')).toBe(false)
    expect(shouldBlockPopStateInScreen('searching')).toBe(false)
    expect(shouldBlockPopStateInScreen('shop')).toBe(false)
  })

  it('conserva /play/game-over o /play/in-game al re-anclar el historial', () => {
    expect(buildBattleGuardHistoryUrl('/play/in-game')).toBe('/play/in-game')
    expect(buildBattleGuardHistoryUrl('/play/menu')).toBe('/play/in-game')
    expect(buildBattleGuardHistoryUrl('/play/game-over')).toBe('/play/game-over')
  })

  it('re-ancla window.history en batalla y emite BATTLE_BACK_BLOCKED_EVENT', () => {
    const pushState = vi.fn()
    const dispatchEventFn = vi.fn<(event: Event) => boolean>(() => true)

    const result = reanchorBattleHistoryGuard({
      historyObj: { pushState },
      locationObj: { protocol: 'https:', pathname: '/play/menu' },
      title: 'Plant Arena - En Batalla',
      dispatchEventFn,
    })

    expect(result).toBe(true)
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(pushState).toHaveBeenCalledWith(
      { screen: 'battle', battleGuard: true },
      'Plant Arena - En Batalla',
      '/play/in-game'
    )
    expect(dispatchEventFn).toHaveBeenCalledTimes(1)
    const emittedEvent = dispatchEventFn.mock.calls[0]?.[0]
    expect(emittedEvent?.type).toBe(BATTLE_BACK_BLOCKED_EVENT)
  })

  it('no llama pushState en protocolo file: pero sigue emitiendo el evento', () => {
    const pushState = vi.fn()
    const dispatchEventFn = vi.fn<(event: Event) => boolean>(() => true)

    reanchorBattleHistoryGuard({
      historyObj: { pushState },
      locationObj: { protocol: 'file:', pathname: '/play/in-game' },
      dispatchEventFn,
    })

    expect(pushState).not.toHaveBeenCalled()
    expect(dispatchEventFn).toHaveBeenCalledTimes(1)
  })
})
