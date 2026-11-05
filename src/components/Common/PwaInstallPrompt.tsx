import React, { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import './PwaInstallPrompt.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstallDirectly, setCanInstallDirectly] = useState<boolean>(false)
  const [isStandalone, setIsStandalone] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [isIOS, setIsIOS] = useState<boolean>(false)
  const [showModal, setShowModal] = useState<boolean>(false)
  const [showBanner, setShowBanner] = useState<boolean>(false)

  useEffect(() => {
    // 1. Detectar si ya corre en modo standalone (instalada como PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      setIsStandalone(isStandaloneMode)
      return isStandaloneMode
    }

    if (checkStandalone()) {
      return // Ya está instalada y ejecutándose como App
    }

    // 2. Detectar si es dispositivo móvil o pantalla táctil pequeña
    const userAgent = navigator.userAgent || ''
    const checkIsIOS =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const checkIsMobile =
      checkIsIOS ||
      /Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent) ||
      window.innerWidth <= 1024

    setIsMobile(checkIsMobile)
    setIsIOS(checkIsIOS)

    // 3. Capturar evento beforeinstallprompt (Android / Chrome / Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstallDirectly(true)
    }

    // 4. Capturar evento de instalación completada
    const handleAppInstalled = () => {
      setIsStandalone(true)
      setShowModal(false)
      setShowBanner(false)
      setDeferredPrompt(null)
      try {
        localStorage.setItem('plant_arena_pwa_installed', 'true')
      } catch {}
    }

    // 5. Escuchar evento global para abrir la guía desde Ajustes
    const handleOpenGuide = () => {
      soundManager.playSound('click', 0.4)
      setShowModal(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('open_pwa_install_guide', handleOpenGuide)

    // 6. Mostrar el banner amigable en móvil si no fue descartado recientemente
    if (checkIsMobile) {
      let isDismissed = false
      try {
        const dismissedAt = localStorage.getItem('plant_arena_pwa_dismissed')
        if (dismissedAt) {
          const daysAgo = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24)
          // Volver a recordar suavemente tras 7 días
          if (daysAgo < 7) {
            isDismissed = true
          }
        }
      } catch {}

      if (!isDismissed) {
        const timer = setTimeout(() => {
          setShowBanner(true)
        }, 4000)
        return () => {
          clearTimeout(timer)
          window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
          window.removeEventListener('appinstalled', handleAppInstalled)
          window.removeEventListener('open_pwa_install_guide', handleOpenGuide)
        }
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('open_pwa_install_guide', handleOpenGuide)
    }
  }, [])

  // Instalar con 1 clic en navegadores compatibles (Android Chrome / Edge)
  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    soundManager.playSound('click', 0.4)
    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setShowModal(false)
        setShowBanner(false)
        setDeferredPrompt(null)
      }
    } catch (err) {
      console.warn('[PWA] Error prompt:', err)
    }
  }

  // Descartar amigablemente el aviso
  const handleDismiss = () => {
    soundManager.playSound('click', 0.3)
    setShowBanner(false)
    setShowModal(false)
    try {
      localStorage.setItem('plant_arena_pwa_dismissed', Date.now().toString())
    } catch {}
  }

  // Si ya corre en modo standalone, no renderizar nada
  if (isStandalone) {
    return null
  }

  return (
    <>
      {/* ── BANNER DISCRETO FLOTANTE PARA MÓVILES ── */}
      {showBanner && !showModal && isMobile && (
        <div className="pwa-floating-banner animate-fade-in">
          <div className="pwa-banner-content" onClick={() => setShowModal(true)}>
            <img src="/icons/pwa-192x192.png" alt="Plant Arena App" className="pwa-banner-icon" />
            <div className="pwa-banner-text">
              <strong>📱 Juega como App Completa</strong>
              <span>Sin barras de navegador que estorben al jugar</span>
            </div>
            <button
              type="button"
              className="pwa-banner-btn-action"
              onClick={(e) => {
                e.stopPropagation()
                setShowModal(true)
              }}
            >
              Ver Cómo
            </button>
          </div>
          <button
            type="button"
            className="pwa-banner-close"
            onClick={handleDismiss}
            title="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── MODAL GUÍA AMIGABLE PARA QUIENES NO SABEN CÓMO INSTALARLA ── */}
      {showModal && (
        <div className="pwa-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="pwa-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Header con icono y título */}
            <div className="pwa-modal-header">
              <div className="pwa-modal-icon-wrap">
                <img src="/icons/pwa-192x192.png" alt="Plant Arena" className="pwa-modal-icon" />
              </div>
              <div className="pwa-modal-title-group">
                <h3>¡JUEGA COMO UNA APP EN TU CELULAR!</h3>
                <p>Convierte Plant Arena en una App directa en 15 segundos (PWA)</p>
              </div>
              <button
                type="button"
                className="pwa-modal-close-btn"
                onClick={() => setShowModal(false)}
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Ventajas principales */}
            <div className="pwa-benefits-grid">
              <div className="pwa-benefit-card">
                <span className="pwa-benefit-emoji">📱</span>
                <div>
                  <strong>100% Pantalla Completa</strong>
                  <p>Oculta las barras del navegador que tapan el césped o molestan tus toques.</p>
                </div>
              </div>
              <div className="pwa-benefit-card">
                <span className="pwa-benefit-emoji">⚡</span>
                <div>
                  <strong>Acceso Directo al Instante</strong>
                  <p>Icono directo en tu pantalla de inicio junto a tus otros juegos favoritos.</p>
                </div>
              </div>
              <div className="pwa-benefit-card">
                <span className="pwa-benefit-emoji">🎮</span>
                <div>
                  <strong>Sin Recargas por Error</strong>
                  <p>Evita refrescar la página al deslizar el dedo o apuntar tus plantas en combate.</p>
                </div>
              </div>
            </div>

            {/* Guía según dispositivo */}
            <div className="pwa-guide-section">
              <h4 className="pwa-guide-section-title">
                {isIOS ? '🍎 Cómo instalar en tu iPhone / iPad (Safari):' : '🤖 Cómo instalar en tu teléfono (Android / Chrome):'}
              </h4>

              {/* Botón de 1 clic para navegadores compatibles */}
              {canInstallDirectly && (
                <div className="pwa-direct-install-box">
                  <button
                    type="button"
                    className="pwa-install-now-btn"
                    onClick={handleInstallClick}
                  >
                    📲 INSTALAR AHORA CON 1 CLIC
                  </button>
                  <span className="pwa-direct-hint">Tu navegador soporta instalación directa</span>
                </div>
              )}

              {/* Pasos visuales guiados */}
              <div className="pwa-steps-list">
                {isIOS ? (
                  <>
                    <div className="pwa-step-item">
                      <div className="pwa-step-num">1</div>
                      <div className="pwa-step-desc">
                        Toca el botón <strong>Compartir</strong> <span className="pwa-inline-badge">⎋</span> en la barra inferior de Safari.
                      </div>
                    </div>
                    <div className="pwa-step-item">
                      <div className="pwa-step-num">2</div>
                      <div className="pwa-step-desc">
                        Desliza hacia abajo en el menú y selecciona <strong>"Añadir a la pantalla de inicio"</strong> <span className="pwa-inline-badge">➕</span>.
                      </div>
                    </div>
                    <div className="pwa-step-item">
                      <div className="pwa-step-num">3</div>
                      <div className="pwa-step-desc">
                        Toca <strong>"Añadir"</strong> arriba a la derecha. ¡Listo, ábrela desde tu inicio! 🌿
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pwa-step-item">
                      <div className="pwa-step-num">1</div>
                      <div className="pwa-step-desc">
                        Toca los tres puntos <span className="pwa-inline-badge">⋮</span> arriba a la derecha en tu navegador (Chrome / Brave / Edge).
                      </div>
                    </div>
                    <div className="pwa-step-item">
                      <div className="pwa-step-num">2</div>
                      <div className="pwa-step-desc">
                        Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong> 📲.
                      </div>
                    </div>
                    <div className="pwa-step-item">
                      <div className="pwa-step-num">3</div>
                      <div className="pwa-step-desc">
                        Confirma tocando <strong>"Instalar"</strong>. ¡El juego se abrirá como app independiente! 🌿
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer con botón de entendido */}
            <div className="pwa-modal-footer">
              <button
                type="button"
                className="pwa-btn-dismiss"
                onClick={handleDismiss}
              >
                ✓ ¡Entendido, gracias!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PwaInstallPrompt
