import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface KeybindingsConfig {
  slot1: string
  slot2: string
  slot3: string
  slot4: string
  slot5: string
  slot6: string
  shovel: string
  cancel: string
}

export type KeyActionKey = keyof KeybindingsConfig

export interface KeybindingPreset {
  id: string
  name: string
  icon: string
  description: string
  bindings: KeybindingsConfig
}

export const DEFAULT_KEYBINDINGS: KeybindingsConfig = {
  slot1: '1',
  slot2: '2',
  slot3: '3',
  slot4: '4',
  slot5: '5',
  slot6: '6',
  shovel: 'q',
  cancel: 'Escape',
}

export const KEYBINDINGS_PRESETS: Record<string, KeybindingPreset> = {
  default: {
    id: 'default',
    name: 'Clásico Numérico (1-6)',
    icon: '⚡',
    description: 'Teclas estándar 1 a 6 para las plantas, Q para la pala y Esc para cancelar.',
    bindings: {
      slot1: '1',
      slot2: '2',
      slot3: '3',
      slot4: '4',
      slot5: '5',
      slot6: '6',
      shovel: 'q',
      cancel: 'Escape',
    },
  },
  moba: {
    id: 'moba',
    name: 'Estilo MOBA / RTS (Q-Y)',
    icon: '⚔️',
    description: 'Fila superior Q-W-E-R-T-Y para plantas y Barra Espaciadora para pala.',
    bindings: {
      slot1: 'q',
      slot2: 'w',
      slot3: 'e',
      slot4: 'r',
      slot5: 't',
      slot6: 'y',
      shovel: ' ',
      cancel: 'Escape',
    },
  },
  asdf: {
    id: 'asdf',
    name: 'Fila Inicio (A-H)',
    icon: '🖐️',
    description: 'Disposición ergonómica en la fila media de descanso de la mano.',
    bindings: {
      slot1: 'a',
      slot2: 's',
      slot3: 'd',
      slot4: 'f',
      slot5: 'g',
      slot6: 'h',
      shovel: ' ',
      cancel: 'Escape',
    },
  },
  numpad: {
    id: 'numpad',
    name: 'Teclado Numérico',
    icon: '🔢',
    description: 'Diseñado para teclados completos usando el bloque numérico derecho.',
    bindings: {
      slot1: 'Numpad1',
      slot2: 'Numpad2',
      slot3: 'Numpad3',
      slot4: 'Numpad4',
      slot5: 'Numpad5',
      slot6: 'Numpad6',
      shovel: 'Numpad0',
      cancel: 'Escape',
    },
  },
}

const STORAGE_KEY = 'plant_arena_keybindings'

/**
 * Formatea una tecla de evento de teclado para mostrarla como texto corto y estético en la UI / Deck
 */
export function formatKeyLabel(key?: string | null): string {
  if (!key) return '?'
  const trimmed = key.trim()

  if (key === ' ' || trimmed.toLowerCase() === 'space') return 'ESP'
  if (trimmed.toLowerCase() === 'escape' || trimmed.toLowerCase() === 'esc') return 'ESC'
  if (trimmed.toLowerCase() === 'enter') return 'ENT'
  if (trimmed.toLowerCase() === 'backspace') return 'BORR'
  if (trimmed.toLowerCase() === 'tab') return 'TAB'
  if (trimmed.toLowerCase() === 'shift') return 'MAY'
  if (trimmed.toLowerCase() === 'control' || trimmed.toLowerCase() === 'ctrl') return 'CTRL'
  if (trimmed.toLowerCase() === 'alt') return 'ALT'
  if (trimmed.toLowerCase() === 'arrowleft') return '◀'
  if (trimmed.toLowerCase() === 'arrowright') return '▶'
  if (trimmed.toLowerCase() === 'arrowup') return '▲'
  if (trimmed.toLowerCase() === 'arrowdown') return '▼'

  if (trimmed.startsWith('Numpad')) {
    return 'N' + trimmed.replace('Numpad', '')
  }

  if (trimmed.length === 1) {
    return trimmed.toUpperCase()
  }

  return trimmed.slice(0, 4).toUpperCase()
}

/**
 * Evalúa si una tecla pulsada en un evento KeyboardEvent coincide con la tecla asignada.
 */
export function isKeyMatch(e: KeyboardEvent, boundKey: string): boolean {
  if (!boundKey) return false
  const b = boundKey.trim().toLowerCase()
  const pressedKey = e.key.toLowerCase()
  const pressedCode = e.code.toLowerCase()

  // Espacio
  if (b === '' || b === ' ' || b === 'space' || b === 'espacio') {
    return pressedCode === 'space' || pressedKey === ' '
  }

  // Escape
  if (b === 'escape' || b === 'esc') {
    return pressedKey === 'escape' || pressedCode === 'escape'
  }

  // Numpad
  if (b.startsWith('numpad')) {
    const numChar = b.replace('numpad', '')
    return pressedCode === b || (pressedCode.startsWith('numpad') && pressedKey === numChar)
  }

  // Coincidencia directa con e.key (ignora mayúsculas/minúsculas)
  if (pressedKey === b) return true

  // Coincidencia con código físico (e.g. 'KeyQ' -> 'q', 'Digit1' -> '1')
  if (pressedCode === `key${b}` || pressedCode === `digit${b}`) return true
  if (pressedCode === b) return true

  return false
}

export class KeybindingsManager {
  static getKeybindings(): KeybindingsConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object' && parsed.slot1) {
          return {
            ...DEFAULT_KEYBINDINGS,
            ...parsed,
          }
        }
      }
    } catch {}
    return { ...DEFAULT_KEYBINDINGS }
  }

  static saveKeybindings(bindings: KeybindingsConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
      window.dispatchEvent(new CustomEvent('keybindings_updated', { detail: bindings }))
    } catch (e) {
      console.warn('[KeybindingsManager] Error saving to localStorage:', e)
    }

    // Sincronizar en Supabase de forma segura en segundo plano si hay sesión
    void this.syncToSupabase(bindings)
  }

  static async syncToSupabase(bindings: KeybindingsConfig): Promise<boolean> {
    try {
      if (!isSupabaseConfigured()) return false
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) return false

      const { error } = await (supabase as any).rpc('save_user_keybindings', {
        p_keybindings: bindings,
      })
      if (error) {
        console.warn('[KeybindingsManager] Error guardando atajos en Supabase:', error.message)
        return false
      }
      return true
    } catch (e) {
      console.warn('[KeybindingsManager] Excepción al sincronizar con Supabase:', e)
      return false
    }
  }

  static syncFromRemote(remoteBindings?: any): void {
    if (!remoteBindings || typeof remoteBindings !== 'object') return
    if (!remoteBindings.slot1) return

    const current = this.getKeybindings()
    const merged: KeybindingsConfig = {
      ...current,
      ...remoteBindings,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      window.dispatchEvent(new CustomEvent('keybindings_updated', { detail: merged }))
    } catch (e) {
      console.warn('[KeybindingsManager] Error guardando atajos remotos:', e)
    }
  }

  static resetToDefault(): KeybindingsConfig {
    const defaults = { ...DEFAULT_KEYBINDINGS }
    this.saveKeybindings(defaults)
    return defaults
  }
}
