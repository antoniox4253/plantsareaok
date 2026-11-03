import { useState, useEffect } from 'react'

const STORAGE_KEY = 'plants_arena_graphics_quality'

export type GraphicsQuality = 'high' | 'low'

let currentQuality: GraphicsQuality = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'low' || saved === 'high') return saved
    return 'high'
  } catch {
    return 'high'
  }
})()

const listeners = new Set<(quality: GraphicsQuality) => void>()

/**
 * Obtiene la calidad gráfica actual configurada.
 */
export function getGraphicsQuality(): GraphicsQuality {
  return currentQuality
}

/**
 * Retorna true si el modo de gráficos mínimos (rendimiento) está activo.
 */
export function isLowGraphics(): boolean {
  return currentQuality === 'low'
}

/**
 * Aplica la calidad gráfica, actualiza la clase en el body y persiste en localStorage.
 */
export function applyGraphicsQuality(quality: GraphicsQuality): void {
  currentQuality = quality
  try {
    localStorage.setItem(STORAGE_KEY, quality)
  } catch (err) {
    console.warn('[GraphicsSettings] No se pudo guardar en localStorage:', err)
  }

  if (typeof document !== 'undefined' && document.body) {
    if (quality === 'low') {
      document.body.classList.add('low-graphics-mode')
    } else {
      document.body.classList.remove('low-graphics-mode')
    }
  }

  listeners.forEach((cb) => {
    try {
      cb(quality)
    } catch (err) {
      console.error('[GraphicsSettings] Error en listener:', err)
    }
  })
}

/**
 * Alterna entre calidad alta y gráficos mínimos (rendimiento).
 */
export function toggleGraphicsQuality(): GraphicsQuality {
  const next: GraphicsQuality = currentQuality === 'low' ? 'high' : 'low'
  applyGraphicsQuality(next)
  return next
}

/**
 * Inicializa el estado de calidad gráfica al arrancar la app.
 */
export function initGraphicsSettings(): void {
  applyGraphicsQuality(currentQuality)
}

/**
 * Suscribe un callback a cambios de calidad gráfica.
 */
export function subscribeGraphicsQuality(cb: (quality: GraphicsQuality) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Hook de React para consumir y alternar la calidad gráfica en cualquier componente.
 */
export function useGraphicsQuality() {
  const [quality, setQuality] = useState<GraphicsQuality>(getGraphicsQuality)

  useEffect(() => {
    return subscribeGraphicsQuality((newQuality) => {
      setQuality(newQuality)
    })
  }, [])

  return {
    quality,
    isLowGraphics: quality === 'low',
    setGraphicsQuality: applyGraphicsQuality,
    toggleGraphicsQuality,
  }
}
