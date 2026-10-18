import { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import type { PackId } from '../../utils/packDropManager'
import './PixelSeedPacks.css'

export interface Hotspot {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  type: 'button' | 'counter' | 'tab' | 'section' | 'cta' | 'card' | 'buy' | 'pillgroup' | 'label'
}

const BASE_WIDTH = 1672
const BASE_HEIGHT = 941

const SEEDPACK_HOTSPOTS: Hotspot[] = [
  { id: 'menu', label: 'Menú', x: 18, y: 16, w: 210, h: 72, type: 'button' },
  { id: 'title_shop', label: 'Título Tienda', x: 347, y: 14, w: 407, h: 72, type: 'label' },
  { id: 'counter_oro', label: 'Contador Oro', x: 858, y: 17, w: 254, h: 72, type: 'counter' },
  { id: 'counter_gemas', label: 'Contador Gemas', x: 1110, y: 17, w: 252, h: 72, type: 'counter' },
  { id: 'counter_energia', label: 'Contador Energía', x: 1363, y: 17, w: 215, h: 72, type: 'counter' },
  { id: 'sound', label: 'Sonido', x: 1590, y: 16, w: 63, h: 73, type: 'button' },
  { id: 'tab_sobres', label: 'Tab Sobres de Semillas', x: 67, y: 108, w: 303, h: 74, type: 'tab' },
  { id: 'tab_vip', label: 'Tab Pase VIP', x: 379, y: 108, w: 199, h: 74, type: 'tab' },
  { id: 'tab_oro_emotes', label: 'Tab Oro & Emotes', x: 587, y: 108, w: 260, h: 74, type: 'tab' },
  { id: 'tab_energias', label: 'Tab Energías', x: 855, y: 108, w: 231, h: 74, type: 'tab' },
  { id: 'tab_comercio', label: 'Tab Comercio', x: 1095, y: 108, w: 220, h: 74, type: 'tab' },
  { id: 'tab_stream', label: 'Tab Cuentas Stream', x: 1322, y: 108, w: 271, h: 74, type: 'tab' },
  { id: 'hero_title', label: 'Título Sobres de Semillas', x: 553, y: 190, w: 627, h: 112, type: 'section' },
  { id: 'button_probabilidades', label: 'Botón Ver Probabilidades', x: 1251, y: 219, w: 301, h: 85, type: 'cta' },
  { id: 'pack_basic', label: 'Pack Sobre Básico', x: 25, y: 190, w: 479, h: 664, type: 'card' },
  { id: 'pack_epic', label: 'Pack Sobre Épico', x: 595, y: 319, w: 412, h: 534, type: 'card' },
  { id: 'pack_legendary', label: 'Pack Sobre Legendario', x: 1080, y: 318, w: 476, h: 536, type: 'card' },
  { id: 'buy_basic', label: 'Comprar Sobre Básico', x: 31, y: 793, w: 404, h: 92, type: 'buy' },
  { id: 'buy_epic', label: 'Comprar Sobre Épico', x: 638, y: 792, w: 365, h: 92, type: 'buy' },
  { id: 'buy_legendary', label: 'Comprar Sobre Legendario', x: 1111, y: 792, w: 424, h: 92, type: 'buy' },
  { id: 'rarities_basic', label: 'Rarezas Sobre Básico', x: 32, y: 700, w: 434, h: 54, type: 'pillgroup' },
  { id: 'rarities_epic', label: 'Rarezas Sobre Épico', x: 650, y: 700, w: 355, h: 54, type: 'pillgroup' },
  { id: 'rarities_legendary', label: 'Rarezas Sobre Legendario', x: 1172, y: 700, w: 295, h: 54, type: 'pillgroup' },
]

export interface PixelSeedPacksProps {
  onBackToHome: () => void
  onOpenStreaming?: () => void
  onToggleClassic?: () => void
  onSelectTab?: (tab: 'pass' | 'gold' | 'energy' | 'market') => void
  onBuyPack: (packId: PackId) => void
  onOpenProbabilities?: (packId?: PackId) => void
  userGold?: number
  userTokens?: number
  playerEnergy?: number
  isPurchasing?: boolean
}

export default function PixelSeedPacks({
  onBackToHome,
  onOpenStreaming,
  onToggleClassic,
  onSelectTab,
  onBuyPack,
  onOpenProbabilities,
  userGold,
  userTokens,
  playerEnergy,
  isPurchasing = false,
}: PixelSeedPacksProps) {
  const [debugHotspots, setDebugHotspots] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showOddsModal, setShowOddsModal] = useState<boolean>(false)

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => {
      setToastMessage(null)
    }, 2800)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const handleHotspotClick = (h: Hotspot) => {
    soundManager.playSound('click', 0.5)

    // Navegación Menú
    if (h.id === 'menu' || h.id === 'title_shop') {
      onBackToHome()
      return
    }

    // Toggle Sonido
    if (h.id === 'sound') {
      soundManager.toggleMute()
      const isMuted = soundManager.isMuted()
      setToastMessage(isMuted ? '🔇 Música Silenciada' : '🔊 Música Activada')
      return
    }

    // Streaming
    if (h.id === 'tab_stream') {
      if (onOpenStreaming) {
        onOpenStreaming()
      } else {
        setToastMessage('🎬 Cuentas Stream VIP')
      }
      return
    }

    // Pestaña actual de Sobres
    if (h.id === 'tab_sobres' || h.id === 'hero_title') {
      setToastMessage('🎒 Sobres de Semillas (Pantalla Activa)')
      return
    }

    // Tabs de navegación externa
    if (h.id === 'tab_vip') {
      if (onSelectTab) onSelectTab('pass')
      else setToastMessage('⭐ Pase VIP')
      return
    }

    if (h.id === 'tab_oro_emotes' || h.id === 'counter_oro') {
      if (onSelectTab) onSelectTab('gold')
      else setToastMessage(`💰 Oro: ${(userGold ?? 50000).toLocaleString()}`)
      return
    }

    if (h.id === 'counter_gemas') {
      if (onSelectTab) onSelectTab('gold')
      else setToastMessage(`💎 Gemas: ${(userTokens ?? 100).toLocaleString()}`)
      return
    }

    if (h.id === 'tab_energias' || h.id === 'counter_energia') {
      if (onSelectTab) onSelectTab('energy')
      else setToastMessage(`⚡ Energía: ${playerEnergy ?? 20} / 20`)
      return
    }

    if (h.id === 'tab_comercio') {
      if (onSelectTab) onSelectTab('market')
      else setToastMessage('🤝 Comercio P2P')
      return
    }

    // Botón de probabilidades
    if (h.id === 'button_probabilidades') {
      if (onOpenProbabilities) {
        onOpenProbabilities()
      } else {
        setShowOddsModal(true)
      }
      return
    }

    // Comprar Sobre Básico
    if (h.id === 'buy_basic' || h.id === 'pack_basic') {
      if (isPurchasing) return
      onBuyPack('basic')
      return
    }

    // Comprar Sobre Épico
    if (h.id === 'buy_epic' || h.id === 'pack_epic') {
      if (isPurchasing) return
      onBuyPack('epic')
      return
    }

    // Comprar Sobre Legendario
    if (h.id === 'buy_legendary' || h.id === 'pack_legendary') {
      if (isPurchasing) return
      onBuyPack('legendary')
      return
    }

    // Píldoras de rarezas (información)
    if (h.id === 'rarities_basic') {
      setToastMessage('🌿 Sobre Básico: Común (70%), Poco Común (26.7%), Rara (3.3%)')
      return
    }

    if (h.id === 'rarities_epic') {
      setToastMessage('🔮 Sobre Épico: Poco Común (53.3%), Común (26.7%), Rara (16.7%), Épica (2.7%), Legendaria (0.7%)')
      return
    }

    if (h.id === 'rarities_legendary') {
      setToastMessage('👑 Sobre Legendario: ¡Exclusivo! Solo Épica (85%) y Legendaria (15%)')
      return
    }

    // Fallback general
    setToastMessage(`✨ ${h.label}`)
  }

  return (
    <div className="pixel-seedpacks-root">
      {/* Barra de utilidades para desarrollador / pruebas */}
      <div className="pixel-seedpacks-dev-bar">
        <button
          type="button"
          className="pixel-seedpacks-dev-btn"
          onClick={onBackToHome}
          title="Volver a la vista principal de la tienda"
        >
          ← Tienda Home
        </button>
        <button
          type="button"
          className={`pixel-seedpacks-dev-btn ${debugHotspots ? 'pixel-seedpacks-dev-btn--active' : ''}`}
          onClick={() => setDebugHotspots(!debugHotspots)}
          title="Ver contorno de todas las zonas interactivas"
        >
          {debugHotspots ? 'Ocultar Zonas' : 'Ver Zonas'}
        </button>
        {onToggleClassic && (
          <button
            type="button"
            className="pixel-seedpacks-dev-btn"
            onClick={onToggleClassic}
            title="Cambiar a la tienda funcional clásica"
          >
            Tienda Clásica
          </button>
        )}
      </div>

      {/* Escenario Pixel-Perfect */}
      <div className="pixel-seedpacks-stage">
        {/* Imagen base de Sobres */}
        <picture>
          <source srcSet="/game-assets/shop/screen_shop_seedpacks.webp" type="image/webp" />
          <img
            src="/game-assets/shop/screen_shop_seedpacks.png"
            alt="Plant Arena Sobres de Semillas"
            className="pixel-seedpacks-base-img"
          />
        </picture>

        {/* Hotspots interactivos */}
        {SEEDPACK_HOTSPOTS.map((h) => {
          const leftPct = (h.x / BASE_WIDTH) * 100
          const topPct = (h.y / BASE_HEIGHT) * 100
          const widthPct = (h.w / BASE_WIDTH) * 100
          const heightPct = (h.h / BASE_HEIGHT) * 100
          const borderRadius =
            h.type === 'card'
              ? 18
              : h.type === 'tab'
              ? 16
              : h.type === 'buy'
              ? 18
              : h.type === 'pillgroup'
              ? 14
              : 12

          return (
            <button
              key={h.id}
              type="button"
              className={`pixel-seedpacks-hotspot ${debugHotspots ? 'pixel-seedpacks-hotspot--debug' : ''}`}
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
          <div className="pixel-seedpacks-toast">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal de Probabilidades Integrado (si no se proporciona callback externo) */}
        {showOddsModal && (
          <div
            className="pixel-seedpacks-odds-backdrop"
            onClick={() => setShowOddsModal(false)}
          >
            <div
              className="pixel-seedpacks-odds-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="pixel-seedpacks-odds-close"
                onClick={() => setShowOddsModal(false)}
              >
                ✕
              </button>

              <div className="pixel-seedpacks-odds-head">
                <span className="pixel-seedpacks-odds-badge">🎯 SISTEMA DE PROBABILIDADES</span>
                <h3 className="pixel-seedpacks-odds-title">Tasas de Aparición de Cartas</h3>
                <p className="pixel-seedpacks-odds-sub">
                  Transparencia total de cartas y rarezas según las reglas del juego.
                </p>
              </div>

              <div className="pixel-seedpacks-odds-list">
                {/* Sobre Básico */}
                <div className="pixel-seedpacks-odds-item">
                  <div className="pixel-seedpacks-odds-item-head">
                    <span className="pixel-seedpacks-odds-item-name">Sobre de Semillas Básico</span>
                    <span className="pixel-seedpacks-odds-item-price">300 💎 (+300 🪙)</span>
                  </div>
                  <div className="pixel-seedpacks-odds-rates">
                    <span className="rate-badge rate-badge--comun">Común: 70%</span>
                    <span className="rate-badge rate-badge--poco-comun">Poco Común: 26.7%</span>
                    <span className="rate-badge rate-badge--rara">Rara: 3.3% (10% slot 3)</span>
                  </div>
                </div>

                {/* Sobre Épico */}
                <div className="pixel-seedpacks-odds-item">
                  <div className="pixel-seedpacks-odds-item-head">
                    <span className="pixel-seedpacks-odds-item-name">Sobre de Semillas Místico</span>
                    <span className="pixel-seedpacks-odds-item-price">1,000 💎 (+1,000 🪙)</span>
                  </div>
                  <div className="pixel-seedpacks-odds-rates">
                    <span className="rate-badge rate-badge--poco-comun">Poco Común: 53.3%</span>
                    <span className="rate-badge rate-badge--comun">Común: 26.7%</span>
                    <span className="rate-badge rate-badge--rara">Rara: 16.7%</span>
                    <span className="rate-badge rate-badge--epica">Épica: 2.7% (8% slot 3)</span>
                    <span className="rate-badge rate-badge--legendaria">Legendaria: 0.7% (2% slot 3)</span>
                  </div>
                </div>

                {/* Sobre Legendario */}
                <div className="pixel-seedpacks-odds-item pixel-seedpacks-odds-item--legendary">
                  <div className="pixel-seedpacks-odds-item-head">
                    <span className="pixel-seedpacks-odds-item-name">Sobre VIP Legendario</span>
                    <span className="pixel-seedpacks-odds-item-price">2,500 💎 (+2,500 🪙)</span>
                  </div>
                  <div className="pixel-seedpacks-odds-rates">
                    <span className="rate-badge rate-badge--epica">Épica: 85%</span>
                    <span className="rate-badge rate-badge--legendaria">Legendaria: 15% (Garantizada / Jackpot)</span>
                  </div>
                  <span className="pixel-seedpacks-odds-exclusive">
                    ✨ El sobre legendario contiene ÚNICAMENTE cartas Épicas y Legendarias.
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="pixel-seedpacks-odds-btn-close"
                onClick={() => setShowOddsModal(false)}
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
