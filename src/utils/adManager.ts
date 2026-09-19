import { soundManager } from './audioManager'
import { supabase } from '../lib/supabaseClient'

export interface AdViewsStatus {
  views: Record<string, number>
  maxPerChannel: number
}

class AdManager {
  private isAdActive: boolean = false
  private wasMutedBeforeAd: boolean = false
  private lastAdTimestamp: number = 0
  private readonly MIN_COOLDOWN_MS: number = 10_000

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('ad:pause', () => this.handleAdPause())
      window.addEventListener('ad:resume', () => this.handleAdResume())
    }
  }

  private handleAdPause() {
    this.isAdActive = true
    this.wasMutedBeforeAd = soundManager.isMuted()
    // Silenciar el audio del juego mientras dura el anuncio
    soundManager.setMuted(true)
  }

  private handleAdResume() {
    this.isAdActive = false
    this.lastAdTimestamp = Date.now()
    // Restaurar el audio solo si el jugador NO lo tenía previamente silenciado
    if (!this.wasMutedBeforeAd) {
      soundManager.setMuted(false)
    }
  }

  public getIsAdActive(): boolean {
    return this.isAdActive
  }

  public getLastAdTimestamp(): number {
    return this.lastAdTimestamp
  }

  public canShowAd(): boolean {
    return !this.isAdActive && (Date.now() - this.lastAdTimestamp >= this.MIN_COOLDOWN_MS)
  }

  /**
   * Muestra un anuncio de GameMonetize (interstitial / video).
   * Devuelve una Promesa que resuelve en `true` si el anuncio concluyó normalmente,
   * o `false` si fue interrumpido o no se pudo reproducir.
   */
  public showAd(placement?: string): Promise<boolean> {
    const isDev = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )

    return new Promise((resolve) => {
      const gWindow = typeof window !== 'undefined' ? (window as any) : null

      // Si GameMonetize SDK está cargado y disponible
      if (gWindow && gWindow.sdk && typeof gWindow.sdk.showBanner === 'function') {
        let finished = false

        const cleanupAndFinish = (success: boolean) => {
          if (finished) return
          finished = true
          window.removeEventListener('ad:resume', onResume)
          resolve(success)
        }

        const onResume = () => {
          cleanupAndFinish(true)
        }

        window.addEventListener('ad:resume', onResume, { once: true })

        // Timeout de seguridad en caso de que un adblocker o fallo de red congele el callback
        setTimeout(() => {
          cleanupAndFinish(false)
        }, 30_000)

        try {
          gWindow.sdk.showBanner()
        } catch (e) {
          console.warn('[AdManager] Error al llamar sdk.showBanner:', e)
          cleanupAndFinish(isDev) // En dev permitimos continuar
        }
      } else {
        // En entorno local o sin SDK activo, simula un breve delay y resuelve
        if (isDev) {
          console.info(`[AdManager (Dev)] Simulando anuncio para placement: ${placement || 'default'}`)
          setTimeout(() => resolve(true), 800)
        } else {
          // En producción sin SDK disponible
          resolve(true)
        }
      }
    })
  }

  /**
   * Consulta el número de anuncios vistos hoy por el jugador (para los canales 1, 2, 3 y fin de partida).
   */
  public async getAdViewsStatus(): Promise<{ success: boolean; views: Record<string, number>; maxPerChannel: number }> {
    try {
      const { data, error } = await (supabase as any).rpc('get_ad_views_status')
      if (error || !data || !data.success) {
        return { success: false, views: {}, maxPerChannel: 5 }
      }
      return {
        success: true,
        views: data.views || {},
        maxPerChannel: data.maxPerChannel || 5,
      }
    } catch {
      return { success: false, views: {}, maxPerChannel: 5 }
    }
  }

  /**
   * Valida y reclama +20 de Oro en la base de datos PostgreSQL tras ver un anuncio.
   */
  public async claimAdReward(placement: 'match_end' | 'shop_channel_1' | 'shop_channel_2' | 'shop_channel_3'): Promise<{
    success: boolean
    goldAdded?: number
    newGoldBalance?: number
    viewsToday?: number
    error?: string
  }> {
    try {
      const { data, error } = await (supabase as any).rpc('claim_ad_reward', {
        p_placement: placement,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'No se pudo reclamar la recompensa del anuncio.' }
      }

      // Notificar a toda la interfaz para refrescar el saldo de oro
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh_user_balance'))
      }

      return {
        success: true,
        goldAdded: data.goldAdded,
        newGoldBalance: data.newGoldBalance,
        viewsToday: data.viewsToday,
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión con el servidor.' }
    }
  }
}

export const adManager = new AdManager()
