import { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import type { PlantCardInstance, PlantId, PlantStatKey } from '../../types/game'
import type { FarmingInventory } from '../../utils/pvpRewardManager'
import Marketplace from '../Marketplace/Marketplace'
import PixelHeaderBadges from './PixelHeaderBadges'
import './PixelComercio.css'

export interface Hotspot {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  type: 'button' | 'counter' | 'tab' | 'section' | 'toolbar' | 'card' | 'badge' | 'buy'
}

const BASE_WIDTH = 1672
const BASE_HEIGHT = 941

const COMERCIO_HOTSPOTS: Hotspot[] = [
  { id: 'menu', label: 'Menú', type: 'button', x: 33, y: 30, w: 157, h: 66 },
  { id: 'counter_oro', label: 'Contador Oro', type: 'counter', x: 915, y: 31, w: 180, h: 57 },
  { id: 'counter_gemas', label: 'Contador Gemas', type: 'counter', x: 1120, y: 31, w: 220, h: 57 },
  { id: 'counter_energia', label: 'Contador Energía', type: 'counter', x: 1365, y: 31, w: 180, h: 57 },
  { id: 'sound', label: 'Sonido', type: 'button', x: 1572, y: 31, w: 60, h: 58 },
  { id: 'tab_sobres', label: 'Tab Sobres de Semillas', type: 'tab', x: 52, y: 117, w: 289, h: 63 },
  { id: 'tab_vip', label: 'Tab Pase VIP', type: 'tab', x: 348, y: 117, w: 209, h: 63 },
  { id: 'tab_oro_emotes', label: 'Tab Oro & Emotes', type: 'tab', x: 564, y: 117, w: 262, h: 63 },
  { id: 'tab_energias', label: 'Tab Energías', type: 'tab', x: 834, y: 117, w: 211, h: 63 },
  { id: 'tab_comercio', label: 'Tab Comercio', type: 'tab', x: 1058, y: 117, w: 235, h: 63 },
  { id: 'tab_stream', label: 'Tab Cuentas Stream', type: 'tab', x: 1305, y: 117, w: 286, h: 63 },
  { id: 'hero_mercado', label: 'Encabezado Mercado P2P', type: 'section', x: 77, y: 195, w: 486, h: 129 },
  { id: 'toolbar_compralibre_btn', label: 'Pestaña Compra Libre', type: 'button', x: 645, y: 242, w: 211, h: 82 },
  { id: 'toolbar_misventas', label: 'Pestaña Mis Ventas', type: 'button', x: 899, y: 241, w: 201, h: 84 },
  { id: 'toolbar_vender', label: 'Pestaña Vender', type: 'button', x: 1100, y: 241, w: 191, h: 84 },
  { id: 'toolbar_transacciones', label: 'Pestaña Transacciones', type: 'button', x: 1293, y: 241, w: 268, h: 84 },
  { id: 'card_plantas', label: 'Categoría Cartas de Plantas', type: 'card', x: 91, y: 359, w: 469, h: 504 },
  { id: 'badge_plantas_ofertas', label: '21 ofertas', type: 'badge', x: 430, y: 388, w: 120, h: 86 },
  { id: 'btn_explorar_plantas', label: 'Explorar Plantas', type: 'buy', x: 109, y: 770, w: 414, h: 74 },
  { id: 'card_recursos', label: 'Categoría Recursos de Cultivo', type: 'card', x: 598, y: 360, w: 473, h: 504 },
  { id: 'badge_recursos_ofertas', label: '32 ofertas', type: 'badge', x: 940, y: 387, w: 119, h: 87 },
  { id: 'btn_explorar_recursos', label: 'Explorar Recursos', type: 'buy', x: 639, y: 770, w: 394, h: 74 },
  { id: 'card_oro', label: 'Categoría Comercio de Oro', type: 'card', x: 1097, y: 359, w: 463, h: 503 },
  { id: 'badge_oro_ofertas', label: '27 ofertas', type: 'badge', x: 1452, y: 385, w: 114, h: 87 },
  { id: 'btn_comerciar_oro', label: 'Comerciar Oro', type: 'buy', x: 1153, y: 770, w: 382, h: 74 },
]

export interface PixelComercioProps {
  onBackToHome: () => void
  onOpenStreaming?: () => void
  onToggleClassic?: () => void
  onSelectTab?: (tab: 'packs' | 'pass' | 'gold' | 'energy' | 'market') => void
  userGold?: number
  userTokens?: number
  playerEnergy?: number
  maxPlayerEnergy?: number
  userElo?: number
  hasVipPass?: boolean
  farmingItems?: FarmingInventory
  plantCopies?: Partial<Record<PlantId, number>>
  plantLevels?: Partial<Record<PlantId, number>>
  plantStatRolls?: Partial<Record<PlantId, PlantStatKey[]>>
  plantInstances?: PlantCardInstance[]
  unlockedPlants?: PlantId[]
  activeDeck?: PlantId[]
  activeDeckInstances?: string[]
  onDeductTokens?: (amountUsd: number) => boolean
  onDonatePlant?: (plantId: PlantId) => boolean
  onReceivePlant?: (plantId: PlantId, level?: number, statRolls?: PlantStatKey[]) => void
  onBuyVipPass?: () => Promise<{ success: boolean; error?: string }>
  onRefreshBalance?: () => void
}

export default function PixelComercio({
  onBackToHome,
  onOpenStreaming,
  onToggleClassic,
  onSelectTab,
  userGold = 0,
  userTokens = 0,
  playerEnergy = 20,
  maxPlayerEnergy = 20,
  userElo = 1000,
  hasVipPass = false,
  farmingItems,
  plantCopies = {},
  plantLevels = {},
  plantStatRolls = {},
  plantInstances = [],
  unlockedPlants,
  activeDeck = [],
  activeDeckInstances = [],
  onDeductTokens,
  onDonatePlant,
  onReceivePlant,
  onBuyVipPass,
  onRefreshBalance,
}: PixelComercioProps) {
  const [debugHotspots, setDebugHotspots] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Estado para abrir la vista interactiva completa del Mercado P2P
  const [marketOpenMode, setMarketOpenMode] = useState<{
    tab: 'browse' | 'sell' | 'my_sales' | 'transactions'
    category?: 'plants' | 'farming' | 'gold' | null
  } | null>(null)

  // Desvanecer toast tras 2.6s
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 2600)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // Helper para convertir coordenadas a porcentajes
  const calcStyle = (box: { x: number; y: number; w: number; h: number }) => ({
    left: `${(box.x / BASE_WIDTH) * 100}%`,
    top: `${(box.y / BASE_HEIGHT) * 100}%`,
    width: `${(box.w / BASE_WIDTH) * 100}%`,
    height: `${(box.h / BASE_HEIGHT) * 100}%`,
  })

  // Manejo de clics en Hotspots
  const handleHotspotClick = (h: Hotspot) => {
    soundManager.playSound('click', 0.5)

    // Botón Volver / Menú
    if (h.id === 'menu') {
      onBackToHome()
      return
    }

    // Streaming
    if (h.id === 'tab_stream') {
      if (onOpenStreaming) onOpenStreaming()
      else setToastMessage('🎬 Cuentas Stream VIP')
      return
    }

    // Tabs superiores
    if (h.id === 'tab_sobres') {
      if (onSelectTab) onSelectTab('packs')
      else setToastMessage('🎒 Sobres de Semillas')
      return
    }

    if (h.id === 'tab_vip') {
      if (onSelectTab) onSelectTab('pass')
      else setToastMessage('⭐ Pase VIP')
      return
    }

    if (h.id === 'tab_oro_emotes' || h.id === 'counter_oro') {
      if (onSelectTab) onSelectTab('gold')
      else setToastMessage(`💰 Oro: ${userGold.toLocaleString()}`)
      return
    }

    if (h.id === 'counter_gemas') {
      if (onSelectTab) onSelectTab('gold')
      else setToastMessage(`💎 Gemas: ${userTokens.toLocaleString()}`)
      return
    }

    if (h.id === 'tab_energias' || h.id === 'counter_energia') {
      if (onSelectTab) onSelectTab('energy')
      else setToastMessage(`⚡ Energía: ${playerEnergy} / ${maxPlayerEnergy}`)
      return
    }

    if (h.id === 'tab_comercio') {
      setToastMessage('🤝 Mercado P2P (Pantalla Activa)')
      return
    }

    // Encabezado
    if (h.id === 'hero_mercado') {
      setToastMessage('🤝 Mercado P2P: Compra y vende plantas, recursos y oro entre jugadores')
      return
    }

    // Toolbar / Sub-pestañas internas
    if (h.id === 'toolbar_compralibre_btn') {
      setMarketOpenMode({ tab: 'browse', category: null })
      return
    }

    if (h.id === 'toolbar_misventas') {
      setMarketOpenMode({ tab: 'my_sales', category: null })
      return
    }

    if (h.id === 'toolbar_vender') {
      setMarketOpenMode({ tab: 'sell', category: null })
      return
    }

    if (h.id === 'toolbar_transacciones') {
      setMarketOpenMode({ tab: 'transactions', category: null })
      return
    }

    // Categoría 1: Cartas de Plantas
    if (h.id === 'card_plantas' || h.id === 'btn_explorar_plantas' || h.id === 'badge_plantas_ofertas') {
      setMarketOpenMode({ tab: 'browse', category: 'plants' })
      return
    }

    // Categoría 2: Recursos de Cultivo
    if (h.id === 'card_recursos' || h.id === 'btn_explorar_recursos' || h.id === 'badge_recursos_ofertas') {
      setMarketOpenMode({ tab: 'browse', category: 'farming' })
      return
    }

    // Categoría 3: Comercio de Oro
    if (h.id === 'card_oro' || h.id === 'btn_comerciar_oro' || h.id === 'badge_oro_ofertas') {
      setMarketOpenMode({ tab: 'browse', category: 'gold' })
      return
    }
  }

  // Si el usuario abrió alguna sección o categoría del mercado, renderizamos el Marketplace interactivo
  if (marketOpenMode) {
    return (
      <div className="pixel-comercio-embedded-container">
        {/* Barra superior de retorno al Hub Pixel-Perfect de Comercio */}
        <div className="pixel-comercio-nav-back-bar">
          <button
            type="button"
            className="pixel-comercio-nav-back-btn"
            onClick={() => setMarketOpenMode(null)}
          >
            ⬅️ Volver a Categorías P2P
          </button>
          <div className="pixel-comercio-nav-title">
            🤝 MERCADO P2P • {marketOpenMode.tab === 'browse' ? (marketOpenMode.category ? `Filtrando: ${marketOpenMode.category.toUpperCase()}` : 'Compra Libre') : marketOpenMode.tab === 'my_sales' ? 'Mis Ventas' : marketOpenMode.tab === 'sell' ? 'Vender Ítems' : 'Historial de Transacciones'}
          </div>
          <div className="pixel-comercio-nav-balances">
            <span className="pixel-comercio-nav-bal">💰 {userGold.toLocaleString()} ORO</span>
            <span className="pixel-comercio-nav-bal">💎 {userTokens.toLocaleString()} Gemas</span>
          </div>
        </div>

        {/* Componente Marketplace con la pestaña y categoría preseleccionada */}
        <div className="pixel-comercio-marketplace-wrapper">
          <Marketplace
            initialTab={marketOpenMode.tab}
            initialCategory={marketOpenMode.category}
            onBackToMenu={() => setMarketOpenMode(null)}
            userTokens={userTokens}
            userGold={userGold}
            userElo={userElo}
            hasVipPass={Boolean(hasVipPass)}
            farmingItems={farmingItems}
            plantCopies={plantCopies}
            plantLevels={plantLevels}
            plantStatRolls={plantStatRolls}
            plantInstances={plantInstances}
            unlockedPlants={unlockedPlants}
            activeDeck={activeDeck}
            activeDeckInstances={activeDeckInstances}
            onDeductTokens={onDeductTokens}
            onDonatePlant={onDonatePlant}
            onReceivePlant={onReceivePlant}
            onBuyVipPass={onBuyVipPass || (async () => ({ success: false }))}
            onServerChange={onRefreshBalance}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pixel-comercio-container">
      <div className="pixel-comercio-stage">
        {/* Fondo Pixel-Art de Comercio */}
        <picture>
          <source srcSet="/game-assets/shop/screen_comercio.webp" type="image/webp" />
          <img
            src="/game-assets/shop/screen_comercio.png"
            alt="Mercado de Comercio P2P"
            className="pixel-comercio-bg"
            draggable={false}
          />
        </picture>

        {/* Badges superiores reactivos (Oro, Gemas, Energía con ⚡, Sonido) */}
        <PixelHeaderBadges
          userGold={userGold}
          userTokens={userTokens}
          playerEnergy={playerEnergy}
          maxPlayerEnergy={maxPlayerEnergy}
          userElo={userElo}
          goldCoords={{ x: 915, y: 31, w: 180, h: 57 }}
          gemsCoords={{ x: 1120, y: 31, w: 220, h: 57 }}
          energyCoords={{ x: 1365, y: 31, w: 180, h: 57 }}
          soundCoords={{ x: 1572, y: 31, w: 60, h: 58 }}
          energyLabel="⚡"
          baseWidth={BASE_WIDTH}
          baseHeight={BASE_HEIGHT}
          onToast={(msg) => setToastMessage(msg)}
        />

        {/* Hotspots interactivos mapeados */}
        {COMERCIO_HOTSPOTS.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`pixel-comercio-hotspot ${debugHotspots ? 'debug' : ''} ${
              h.type === 'buy' ? 'pixel-comercio-hotspot--buy' : ''
            } ${h.type === 'card' ? 'pixel-comercio-hotspot--card' : ''} ${
              h.id === 'toolbar_compralibre_btn' || h.id === 'toolbar_misventas' || h.id === 'toolbar_vender' || h.id === 'toolbar_transacciones' ? 'pixel-comercio-hotspot--subtab' : ''
            }`}
            style={calcStyle(h)}
            onClick={() => handleHotspotClick(h)}
            title={h.label}
            aria-label={h.label}
          />
        ))}

        {/* Toast flotante */}
        {toastMessage && (
          <div className="pixel-comercio-toast">
            <span className="pixel-comercio-toast-icon">🤝</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Controles de pie de pantalla */}
        <div className="pixel-comercio-footer-controls">
          {onToggleClassic && (
            <button
              type="button"
              className="pixel-comercio-classic-btn"
              onClick={onToggleClassic}
              title="Cambiar a vista de tienda clásica"
            >
              🎨 Clásico
            </button>
          )}
          <button
            type="button"
            className="pixel-comercio-debug-btn"
            onClick={() => setDebugHotspots(!debugHotspots)}
            title="Inspeccionar zonas de clic"
          >
            {debugHotspots ? 'Ocultar Zonas' : 'Zonas'}
          </button>
        </div>
      </div>
    </div>
  )
}
