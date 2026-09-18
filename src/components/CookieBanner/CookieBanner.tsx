import React, { useState, useEffect } from 'react'
import type { GameScreen } from '../../utils/analytics'
import './CookieBanner.css'

interface CookieBannerProps {
  screen: GameScreen
}

const COOKIE_CONSENT_KEY = 'plant_arena_cookie_consent'

export const CookieBanner: React.FC<CookieBannerProps> = ({ screen }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
      if (!stored) {
        setIsVisible(true)
      }
    } catch {
      // Si el navegador bloquea localStorage, no mostrar para no interferir
      setIsVisible(false)
    }
  }, [])

  // Proteccion estricta: NUNCA mostrar mientras el jugador está en combate activo
  if (!isVisible || screen === 'battle') {
    return null
  }

  const handleAcceptAll = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'granted')
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          analytics_storage: 'granted',
          functionality_storage: 'granted',
          personalization_storage: 'granted',
          security_storage: 'granted',
        })
      }
    } catch {
      // Ignorar errores de storage
    }
    setIsVisible(false)
  }

  const handleAcceptNecessary = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'denied')
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'granted',
          functionality_storage: 'granted',
          personalization_storage: 'denied',
          security_storage: 'granted',
        })
      }
    } catch {
      // Ignorar errores de storage
    }
    setIsVisible(false)
  }

  return (
    <aside className="cookie-banner" role="dialog" aria-label="Aviso de Cookies y Consentimiento">
      <div className="cookie-banner__content">
        <div className="cookie-banner__title">
          <span>🍪</span>
          <span>Privacidad y Cookies</span>
        </div>
        <p className="cookie-banner__text">
          Utilizamos cookies esenciales para tu sesión y, con tu permiso, analítica y anuncios para mantener Plant Arena 100% gratuito.{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Más información
          </a>
          .
        </p>
      </div>

      <div className="cookie-banner__actions">
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--necessary"
          onClick={handleAcceptNecessary}
        >
          Solo Necesarias
        </button>
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--accept"
          onClick={handleAcceptAll}
        >
          Aceptar Todas
        </button>
      </div>
    </aside>
  )
}
