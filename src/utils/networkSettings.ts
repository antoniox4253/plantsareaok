import { useState, useEffect } from 'react'

const STORAGE_KEY = 'plants_arena_low_signal_mode'

export type NetworkQuality = 'standard' | 'low_signal'

let currentQuality: NetworkQuality = (() => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'low_signal' || saved === 'standard') return saved
    }

    // Detección automática en navegadores móviles con Network Information API
    if (typeof navigator !== 'undefined') {
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      if (conn) {
        if (conn.saveData === true) return 'low_signal'
        const effectiveType = conn.effectiveType
        if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') {
          return 'low_signal'
        }
      }
    }
    return 'standard'
  } catch {
    return 'standard'
  }
})()

const listeners = new Set<(quality: NetworkQuality) => void>()

/**
 * Obtiene el modo de red configurado.
 */
export function getNetworkQuality(): NetworkQuality {
  return currentQuality
}

/**
 * Retorna true si el modo de baja señal / ahorro de conexión está activo.
 */
export function isLowSignalMode(): boolean {
  return currentQuality === 'low_signal'
}

/**
 * Aplica el modo de red, actualiza clases auxiliares y persiste en localStorage.
 */
export function applyNetworkQuality(quality: NetworkQuality): void {
  currentQuality = quality
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, quality)
    }
  } catch (err) {
    console.warn('[NetworkSettings] No se pudo persistir en localStorage:', err)
  }

  if (typeof document !== 'undefined' && document.body) {
    if (quality === 'low_signal') {
      document.body.classList.add('low-signal-mode')
    } else {
      document.body.classList.remove('low-signal-mode')
    }
  }

  listeners.forEach((cb) => {
    try {
      cb(quality)
    } catch (err) {
      console.error('[NetworkSettings] Error en listener:', err)
    }
  })
}

/**
 * Alterna entre modo estándar y modo baja señal (Cuba, Venezuela y redes móviles inestables).
 */
export function toggleNetworkQuality(): NetworkQuality {
  const next: NetworkQuality = currentQuality === 'low_signal' ? 'standard' : 'low_signal'
  applyNetworkQuality(next)
  return next
}

/**
 * Inicializa el estado de configuración de red al arrancar la app.
 */
export function initNetworkSettings(): void {
  applyNetworkQuality(currentQuality)
}

/**
 * Suscribe un callback a cambios de configuración de red.
 */
export function subscribeNetworkQuality(cb: (quality: NetworkQuality) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Hook de React para consumir y alternar el modo de red en componentes.
 */
export function useNetworkQuality() {
  const [quality, setQuality] = useState<NetworkQuality>(getNetworkQuality)

  useEffect(() => {
    return subscribeNetworkQuality((newQuality) => {
      setQuality(newQuality)
    })
  }, [])

  return {
    quality,
    isLowSignal: quality === 'low_signal',
    toggleNetworkQuality,
    setNetworkQuality: applyNetworkQuality,
  }
}

/**
 * Límite dinámico de acciones en vuelo para evitar congelamientos ("lag táctil")
 * en conexiones con latencia alta (300-800ms) o micro-pausas.
 */
export function getMaxInFlightActions(): number {
  return isLowSignalMode() ? 8 : 6
}

/**
 * Intervalo de sondeo en milisegundos para partidas contra rivales asíncronos (semillas).
 * En modo baja señal se amplía a 1100ms para evitar saturar el ancho de banda y la cola HTTP.
 */
export function getAsyncPollInterval(): number {
  return isLowSignalMode() ? 1100 : 450
}

/**
 * Intervalo de recuperación de seguridad en PvP humano (ms).
 */
export function getPvpRecoveryInterval(): number {
  return isLowSignalMode() ? 4500 : 3000
}
