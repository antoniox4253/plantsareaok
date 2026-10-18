import { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import './PixelShop.css'

interface Hotspot {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  type: 'button' | 'counter' | 'tab' | 'section' | 'cta' | 'character' | 'card'
}

const BASE_WIDTH = 1672
const BASE_HEIGHT = 941

const HOTSPOTS: Hotspot[] = [
  { id: 'menu', label: 'Menú', x: 32, y: 33, w: 247, h: 88, type: 'button' },
  { id: 'counter_oro', label: 'Contador Oro', x: 830, y: 32, w: 286, h: 80, type: 'counter' },
  { id: 'counter_gemas', label: 'Contador Gemas', x: 1110, y: 32, w: 264, h: 80, type: 'counter' },
  { id: 'counter_energia', label: 'Contador Energía', x: 1368, y: 32, w: 216, h: 80, type: 'counter' },
  { id: 'sound', label: 'Sonido', x: 1586, y: 31, w: 66, h: 80, type: 'button' },
  { id: 'tab_sobres', label: 'Tab Sobres de Semillas', x: 62, y: 127, w: 331, h: 76, type: 'tab' },
  { id: 'tab_vip', label: 'Tab Pase VIP', x: 401, y: 127, w: 209, h: 76, type: 'tab' },
  { id: 'tab_oro', label: 'Tab Oro & Emotes', x: 614, y: 127, w: 249, h: 76, type: 'tab' },
  { id: 'tab_energias', label: 'Tab Energías', x: 868, y: 127, w: 221, h: 76, type: 'tab' },
  { id: 'tab_comercio', label: 'Tab Comercio', x: 1090, y: 127, w: 214, h: 76, type: 'tab' },
  { id: 'tab_stream', label: 'Tab Cuentas Stream', x: 1307, y: 127, w: 288, h: 76, type: 'tab' },
  { id: 'hero', label: 'Hero Principal', x: 76, y: 194, w: 1518, h: 419, type: 'section' },
  { id: 'cta_ver_sobres', label: 'CTA Ver Sobres', x: 488, y: 398, w: 519, h: 101, type: 'cta' },
  { id: 'char_girasol', label: 'Personaje Girasol', x: 84, y: 211, w: 412, h: 397, type: 'character' },
  { id: 'char_cactus', label: 'Personaje Cactus', x: 1207, y: 220, w: 327, h: 383, type: 'character' },
  { id: 'card_sobres', label: 'Card Sobres de Semillas', x: 22, y: 627, w: 260, h: 266, type: 'card' },
  { id: 'card_vip', label: 'Card Pase VIP', x: 287, y: 627, w: 267, h: 266, type: 'card' },
  { id: 'card_oro', label: 'Card Oro & Emotes', x: 559, y: 627, w: 260, h: 266, type: 'card' },
  { id: 'card_energias', label: 'Card Energías', x: 824, y: 627, w: 264, h: 266, type: 'card' },
  { id: 'card_comercio', label: 'Card Comercio', x: 1090, y: 627, w: 264, h: 266, type: 'card' },
  { id: 'card_stream', label: 'Card Cuentas Stream', x: 1359, y: 627, w: 266, h: 266, type: 'card' },
]

export interface PixelShopProps {
  onBack: () => void
  onOpenStreaming?: () => void
  onToggleClassic?: () => void
  userGold?: number
  userTokens?: number
  playerEnergy?: number
}

export default function PixelShop({
  onBack,
  onOpenStreaming,
  onToggleClassic,
  userGold,
  userTokens,
  playerEnergy,
}: PixelShopProps) {
  const [debugHotspots, setDebugHotspots] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => {
      setToastMessage(null)
    }, 2800)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const handleHotspotClick = (h: Hotspot) => {
    soundManager.playSound('click', 0.5)

    if (h.id === 'menu') {
      onBack()
      return
    }

    if (h.id === 'sound') {
      soundManager.toggleMute()
      const isMuted = soundManager.isMuted()
      setToastMessage(isMuted ? '🔇 Música Silenciada' : '🔊 Música Activada')
      return
    }

    if (h.id === 'tab_stream' || h.id === 'card_stream') {
      if (onOpenStreaming) {
        onOpenStreaming()
      } else {
        setToastMessage('🎬 Cuentas Stream VIP')
      }
      return
    }

    if (h.id === 'counter_oro') {
      setToastMessage(`💰 Oro disponible: ${(userGold ?? 50000).toLocaleString()} monedas`)
      return
    }

    if (h.id === 'counter_gemas') {
      setToastMessage(`💎 Gemas disponibles: ${(userTokens ?? 100).toLocaleString()}`)
      return
    }

    if (h.id === 'counter_energia') {
      setToastMessage(`⚡ Energía actual: ${playerEnergy ?? 20} / 20`)
      return
    }

    if (h.id === 'cta_ver_sobres' || h.id === 'tab_sobres' || h.id === 'card_sobres') {
      setToastMessage('🎒 Sobres de Semillas (Pantalla Principal)')
      return
    }

    // Mensaje para tabs y cards mientras se crean las siguientes pantallas
    setToastMessage(`🎨 ${h.label} · Pantalla en desarrollo`)
  }

  return (
    <div className="pixel-shop-root">
      {/* Barra de utilidades para desarrollador / pruebas */}
      <div className="pixel-shop-dev-bar">
        <button
          type="button"
          className={`pixel-shop-dev-btn ${debugHotspots ? 'pixel-shop-dev-btn--active' : ''}`}
          onClick={() => setDebugHotspots(!debugHotspots)}
          title="Ver contorno de todas las zonas interactivas"
        >
          {debugHotspots ? 'Ocultar Zonas' : 'Ver Zonas'}
        </button>
        {onToggleClassic && (
          <button
            type="button"
            className="pixel-shop-dev-btn"
            onClick={onToggleClassic}
            title="Cambiar a la tienda funcional clásica"
          >
            Tienda Clásica
          </button>
        )}
      </div>

      {/* Escenario Pixel-Perfect */}
      <div className="pixel-shop-stage">
        {/* Imagen base exacta */}
        <picture>
          <source srcSet="/game-assets/shop/screen_shop_home.webp" type="image/webp" />
          <img
            src="/game-assets/shop/screen_shop_home.png"
            alt="Plant Arena Tienda"
            className="pixel-shop-base-img"
          />
        </picture>

        {/* Hotspots interactivos mapeados */}
        {HOTSPOTS.map((h) => {
          const leftPct = (h.x / BASE_WIDTH) * 100
          const topPct = (h.y / BASE_HEIGHT) * 100
          const widthPct = (h.w / BASE_WIDTH) * 100
          const heightPct = (h.h / BASE_HEIGHT) * 100
          const borderRadius = h.type === 'card' ? 18 : h.type === 'tab' ? 16 : 12

          return (
            <button
              key={h.id}
              type="button"
              className={`pixel-shop-hotspot ${debugHotspots ? 'pixel-shop-hotspot--debug' : ''}`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                borderRadius: `${borderRadius}px`,
              }}
              aria-label={h.label}
              title={h.label}
              onClick={() => handleHotspotClick(h)}
            />
          )
        })}

        {/* Toast interactivo de confirmación */}
        {toastMessage && (
          <div className="pixel-shop-toast">
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
