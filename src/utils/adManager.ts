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
   * Prepara el gestor de anuncios para Monetag / display ads.
   */
  public async ensureSdkLoaded(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false
    return true
  }

  /**
   * Muestra un anuncio (interstitial / rewarded / direct).
   * Devuelve una Promesa que resuelve en `true` si el anuncio concluyó normalmente,
   * o `false` si fue interrumpido o no se pudo reproducir.
   */
  public async showAd(placement?: string): Promise<boolean> {
    const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ))

    if (isDev) {
      console.info(`[AdManager (Dev)] Simulando anuncio para placement: ${placement || 'default'}`)
      await new Promise((r) => setTimeout(r, 100))
      return true
    }

    const gWindow = typeof window !== 'undefined' ? (window as any) : null

    // Si Monetag u otro proveedor registra un dispatcher o handler
    if (gWindow && typeof gWindow.showMonetagAd === 'function') {
      try {
        const res = await gWindow.showMonetagAd(placement)
        return Boolean(res)
      } catch (err) {
        console.warn('[AdManager] Error al invocar showMonetagAd:', err)
        return false
      }
    }

    // Por defecto, si aún no se ha inyectado script interactivo de Monetag,
    // simula una pausa/reanudación controlada para validar recompensas
    this.handleAdPause()
    await new Promise((r) => setTimeout(r, 500))
    this.handleAdResume()
    return true
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
   * Valida y reclama +10 de Oro en la base de datos PostgreSQL tras ver un anuncio.
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
