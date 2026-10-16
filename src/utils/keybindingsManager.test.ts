import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  KeybindingsManager,
  DEFAULT_KEYBINDINGS,
  KEYBINDINGS_PRESETS,
  formatKeyLabel,
  isKeyMatch,
  type KeybindingsConfig,
} from './keybindingsManager'

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

if (typeof (globalThis as any).window === 'undefined') {
  const listeners: Record<string, Function[]> = {}
  ;(globalThis as any).window = {
    addEventListener: (ev: string, fn: Function) => {
      if (!listeners[ev]) listeners[ev] = []
      listeners[ev].push(fn)
    },
    removeEventListener: (ev: string, fn: Function) => {
      if (listeners[ev]) {
        listeners[ev] = listeners[ev].filter((f) => f !== fn)
      }
    },
    dispatchEvent: (ev: any) => {
      const type = ev?.type || ev
      if (listeners[type]) {
        listeners[type].forEach((fn) => fn(ev))
      }
      return true
    },
  }
}

if (typeof (globalThis as any).CustomEvent === 'undefined') {
  ;(globalThis as any).CustomEvent = class CustomEvent {
    type: string
    detail: any
    constructor(type: string, params: any = {}) {
      this.type = type
      this.detail = params.detail
    }
  }
}

describe('KeybindingsManager & Controls System', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
    vi.restoreAllMocks()
  })

  describe('formatKeyLabel', () => {
    it('formats special keys to clean compact labels', () => {
      expect(formatKeyLabel(' ')).toBe('ESP')
      expect(formatKeyLabel('Space')).toBe('ESP')
      expect(formatKeyLabel('Escape')).toBe('ESC')
      expect(formatKeyLabel('Esc')).toBe('ESC')
      expect(formatKeyLabel('Enter')).toBe('ENT')
      expect(formatKeyLabel('Tab')).toBe('TAB')
      expect(formatKeyLabel('ArrowLeft')).toBe('◀')
      expect(formatKeyLabel('ArrowRight')).toBe('▶')
      expect(formatKeyLabel('Numpad1')).toBe('N1')
      expect(formatKeyLabel('Numpad0')).toBe('N0')
    })

    it('formats single characters to uppercase', () => {
      expect(formatKeyLabel('q')).toBe('Q')
      expect(formatKeyLabel('1')).toBe('1')
      expect(formatKeyLabel('w')).toBe('W')
      expect(formatKeyLabel('e')).toBe('E')
    })

    it('handles undefined or null gracefully', () => {
      expect(formatKeyLabel(null)).toBe('?')
      expect(formatKeyLabel(undefined)).toBe('?')
    })
  })

  describe('isKeyMatch', () => {
    it('matches regular letters regardless of case', () => {
      const eventUpper = { key: 'Q', code: 'KeyQ' } as KeyboardEvent
      const eventLower = { key: 'q', code: 'KeyQ' } as KeyboardEvent

      expect(isKeyMatch(eventUpper, 'q')).toBe(true)
      expect(isKeyMatch(eventLower, 'Q')).toBe(true)
      expect(isKeyMatch(eventUpper, 'w')).toBe(false)
    })

    it('matches number keys', () => {
      const event1 = { key: '1', code: 'Digit1' } as KeyboardEvent
      expect(isKeyMatch(event1, '1')).toBe(true)
      expect(isKeyMatch(event1, '2')).toBe(false)
    })

    it('matches spacebar', () => {
      const eventSpace = { key: ' ', code: 'Space' } as KeyboardEvent
      expect(isKeyMatch(eventSpace, ' ')).toBe(true)
      expect(isKeyMatch(eventSpace, 'Space')).toBe(true)
      expect(isKeyMatch(eventSpace, 'q')).toBe(false)
    })

    it('matches escape key', () => {
      const eventEsc = { key: 'Escape', code: 'Escape' } as KeyboardEvent
      expect(isKeyMatch(eventEsc, 'Escape')).toBe(true)
      expect(isKeyMatch(eventEsc, 'Esc')).toBe(true)
    })

    it('matches numpad keys', () => {
      const eventNumpad1 = { key: '1', code: 'Numpad1' } as KeyboardEvent
      expect(isKeyMatch(eventNumpad1, 'Numpad1')).toBe(true)
      expect(isKeyMatch(eventNumpad1, 'Numpad2')).toBe(false)
    })
  })

  describe('Presets', () => {
    it('contains all required presets with complete keys', () => {
      const requiredKeys: (keyof KeybindingsConfig)[] = [
        'slot1',
        'slot2',
        'slot3',
        'slot4',
        'slot5',
        'slot6',
        'shovel',
        'cancel',
      ]

      for (const [id, preset] of Object.entries(KEYBINDINGS_PRESETS)) {
        expect(preset.id).toBe(id)
        for (const k of requiredKeys) {
          expect(preset.bindings[k]).toBeDefined()
          expect(preset.bindings[k].length).toBeGreaterThan(0)
        }
      }
    })

    it('default preset matches expected 1-6, Q, Escape', () => {
      expect(DEFAULT_KEYBINDINGS.slot1).toBe('1')
      expect(DEFAULT_KEYBINDINGS.slot2).toBe('2')
      expect(DEFAULT_KEYBINDINGS.slot3).toBe('3')
      expect(DEFAULT_KEYBINDINGS.slot4).toBe('4')
      expect(DEFAULT_KEYBINDINGS.slot5).toBe('5')
      expect(DEFAULT_KEYBINDINGS.slot6).toBe('6')
      expect(DEFAULT_KEYBINDINGS.shovel).toBe('q')
      expect(DEFAULT_KEYBINDINGS.cancel).toBe('Escape')
    })
  })

  describe('KeybindingsManager Storage & Sync', () => {
    it('returns default keybindings when none saved', () => {
      const bindings = KeybindingsManager.getKeybindings()
      expect(bindings).toEqual(DEFAULT_KEYBINDINGS)
    })

    it('saves custom keybindings and retrieves them', () => {
      const custom: KeybindingsConfig = {
        slot1: 'q',
        slot2: 'w',
        slot3: 'e',
        slot4: 'r',
        slot5: 't',
        slot6: 'y',
        shovel: ' ',
        cancel: 'Escape',
      }

      KeybindingsManager.saveKeybindings(custom)
      const retrieved = KeybindingsManager.getKeybindings()
      expect(retrieved).toEqual(custom)
    })

    it('syncFromRemote updates localStorage and dispatches event', () => {
      const remoteConfig = {
        slot1: 'a',
        slot2: 's',
        slot3: 'd',
        slot4: 'f',
        slot5: 'g',
        slot6: 'h',
        shovel: ' ',
        cancel: 'Escape',
      }

      let eventFired = false
      window.addEventListener('keybindings_updated', () => {
        eventFired = true
      })

      KeybindingsManager.syncFromRemote(remoteConfig)
      expect(eventFired).toBe(true)

      const active = KeybindingsManager.getKeybindings()
      expect(active.slot1).toBe('a')
      expect(active.slot2).toBe('s')
      expect(active.shovel).toBe(' ')
    })

    it('resetToDefault restores default bindings', () => {
      KeybindingsManager.saveKeybindings({
        slot1: 'z',
        slot2: 'x',
        slot3: 'c',
        slot4: 'v',
        slot5: 'b',
        slot6: 'n',
        shovel: 'm',
        cancel: 'Escape',
      })

      const reset = KeybindingsManager.resetToDefault()
      expect(reset).toEqual(DEFAULT_KEYBINDINGS)
      expect(KeybindingsManager.getKeybindings()).toEqual(DEFAULT_KEYBINDINGS)
    })
  })
})
