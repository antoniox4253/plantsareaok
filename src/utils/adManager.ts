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

  private sdkLoadPromise: Promise<boolean> | null = null

  /**
   * Carga el SDK de GameMonetize bajo demanda (lazy-loading) exclusivamente
   * cuando el jugador decide ver un anuncio voluntario, evitando que se
   * ejecute cualquier script o anuncio de inicio en el menú principal.
   */
  public async ensureSdkLoaded(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false
    const gWindow = window as any

    if (gWindow.sdk && typeof gWindow.sdk.showBanner === 'function') {
      return true
    }

    if (this.sdkLoadPromise) {
      return this.sdkLoadPromise
    }

    this.sdkLoadPromise = new Promise<boolean>((resolve) => {
      // Garantizar que SDK_OPTIONS tenga autoplay desactivado
      if (!gWindow.SDK_OPTIONS) {
        gWindow.SDK_OPTIONS = {
          gameId: import.meta.env.VITE_GAMEMONETIZE_GAME_ID || 'w2qnlrm88ncdzrdo52r3mnfhqtlx1omq',
          advertisementSettings: {
            autoplay: false,
          },
          onEvent: (a: any) => {
            switch (a.name) {
              case 'SDK_GAME_PAUSE':
                window.dispatchEvent(new CustomEvent('ad:pause'))
                break
              case 'SDK_GAME_START':
                window.dispatchEvent(new CustomEvent('ad:resume'))
                break
              case 'SDK_READY':
                window.dispatchEvent(new CustomEvent('ad:ready'))
                break
            }
          },
        }
      } else {
        if (!gWindow.SDK_OPTIONS.advertisementSettings) {
          gWindow.SDK_OPTIONS.advertisementSettings = { autoplay: false }
        } else {
          gWindow.SDK_OPTIONS.advertisementSettings.autoplay = false
        }
      }

      // Si el elemento <script> ya existe en el DOM
      const existingScript = document.getElementById('gamemonetize-sdk') as HTMLScriptElement | null
      if (existingScript) {
        if (gWindow.sdk && typeof gWindow.sdk.showBanner === 'function') {
          resolve(true)
          return
        }
        let existingTimer: any = null
        const onReady = () => {
          if (existingTimer) clearTimeout(existingTimer)
          window.removeEventListener('ad:ready', onReady)
          resolve(true)
        }
        window.addEventListener('ad:ready', onReady, { once: true })
        existingTimer = setTimeout(() => {
          window.removeEventListener('ad:ready', onReady)
          resolve(!!(gWindow.sdk && typeof gWindow.sdk.showBanner === 'function'))
        }, 5000)
        return
      }

      // Inyectar el script tag dinámicamente
      const script = document.createElement('script')
      script.id = 'gamemonetize-sdk'
      script.type = 'text/javascript'
      script.async = true
      script.src = 'https://api.gamemonetize.com/sdk.js'

      let resolved = false
      let mainTimer: any = null
      let loadTimer: any = null

      const finish = (result: boolean) => {
        if (resolved) return
        resolved = true
        if (mainTimer) clearTimeout(mainTimer)
        if (loadTimer) clearTimeout(loadTimer)
        window.removeEventListener('ad:ready', onReady)
        resolve(result)
      }

      const onReady = () => {
        finish(true)
      }

      script.onload = () => {
        // En caso de que el evento ad:ready ya haya ocurrido o esté por ocurrir
        loadTimer = setTimeout(() => {
          finish(!!(gWindow.sdk && typeof gWindow.sdk.showBanner === 'function'))
        }, 200)
      }

      script.onerror = () => {
        console.warn('[AdManager] No se pudo cargar el SDK de GameMonetize (bloqueador o fallo de red).')
        finish(false)
      }

      window.addEventListener('ad:ready', onReady, { once: true })

      // Timeout límite de 6s
      mainTimer = setTimeout(() => {
        finish(!!(gWindow.sdk && typeof gWindow.sdk.showBanner === 'function'))
      }, 6000)

      document.head.appendChild(script)
    })

    return this.sdkLoadPromise
  }

  /**
   * Muestra un anuncio de GameMonetize (interstitial / video).
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

    const loaded = await this.ensureSdkLoaded()
    const gWindow = typeof window !== 'undefined' ? (window as any) : null

    // Si GameMonetize SDK está cargado y disponible
    if (loaded && gWindow && gWindow.sdk && typeof gWindow.sdk.showBanner === 'function') {
      return new Promise<boolean>((resolve) => {
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
        }, 35_000)

        try {
          gWindow.sdk.showBanner()
        } catch (e) {
          console.warn('[AdManager] Error al llamar sdk.showBanner:', e)
          cleanupAndFinish(false)
        }
      })
    } else {
      console.warn('[AdManager] SDK no disponible para reproducir anuncio.')
      return false
    }
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
