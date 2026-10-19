import { soundManager } from '../../utils/audioManager'
import './PixelShopTabs.css'

export type ShopTabKey = 'packs' | 'pass' | 'gold' | 'energy' | 'market' | 'stream'

export interface PixelShopTabsProps {
  activeTab?: ShopTabKey | null
  onSelectTab?: (tab: 'packs' | 'pass' | 'gold' | 'energy' | 'market') => void
  onOpenStreaming?: () => void
  onToast?: (message: string) => void
  baseWidth?: number
  baseHeight?: number
}

interface TabDef {
  id: ShopTabKey
  label: string
  icon: string
  x: number
  y: number
  w: number
  h: number
  toastLabel: string
}

const BASE_WIDTH = 1672
const BASE_HEIGHT = 941

// Distribución uniforme de las 6 pestañas basada en la pantalla de Sobres de Semillas
export const UNIFIED_SHOP_TABS: TabDef[] = [
  {
    id: 'packs',
    label: 'SOBRES DE SEMILLAS',
    icon: '🎒',
    x: 67,
    y: 108,
    w: 303,
    h: 74,
    toastLabel: '🎒 Sobres de Semillas',
  },
  {
    id: 'pass',
    label: 'PASE VIP',
    icon: '👑',
    x: 379,
    y: 108,
    w: 199,
    h: 74,
    toastLabel: '👑 Pase VIP',
  },
  {
    id: 'gold',
    label: 'ORO & EMOTES',
    icon: '💰',
    x: 587,
    y: 108,
    w: 260,
    h: 74,
    toastLabel: '💰 Oro & Emotes',
  },
  {
    id: 'energy',
    label: 'ENERGÍAS',
    icon: '⚡',
    x: 855,
    y: 108,
    w: 231,
    h: 74,
    toastLabel: '⚡ Energías',
  },
  {
    id: 'market',
    label: 'COMERCIO',
    icon: '🏷️',
    x: 1095,
    y: 108,
    w: 220,
    h: 74,
    toastLabel: '🏷️ Comercio P2P',
  },
  {
    id: 'stream',
    label: 'CUENTAS STREAM',
    icon: '🔥',
    x: 1322,
    y: 108,
    w: 271,
    h: 74,
    toastLabel: '🎬 Cuentas Stream VIP',
  },
]

// Contenedor de respaldo que cubre y unifica el arte previo en todas las pantallas
const BACKDROP_BOX = {
  x: 58,
  y: 102,
  w: 1545,
  h: 86,
}

export default function PixelShopTabs({
  activeTab = null,
  onSelectTab,
  onOpenStreaming,
  onToast,
  baseWidth = BASE_WIDTH,
  baseHeight = BASE_HEIGHT,
}: PixelShopTabsProps) {
  const calcStyle = (box: { x: number; y: number; w: number; h: number }) => ({
    left: `${(box.x / baseWidth) * 100}%`,
    top: `${(box.y / baseHeight) * 100}%`,
    width: `${(box.w / baseWidth) * 100}%`,
    height: `${(box.h / baseHeight) * 100}%`,
  })

  const handleTabClick = (tab: TabDef) => {
    soundManager.playSound('click', 0.5)

    if (activeTab === tab.id) {
      if (onToast) onToast(`${tab.toastLabel} (Pantalla Activa)`)
      return
    }

    if (tab.id === 'stream') {
      if (onOpenStreaming) {
        onOpenStreaming()
      } else if (onToast) {
        onToast('🎬 Cuentas Stream VIP')
      }
      return
    }

    if (onSelectTab) {
      onSelectTab(tab.id as 'packs' | 'pass' | 'gold' | 'energy' | 'market')
    }
  }

  return (
    <>
      {/* Respaldo unificado para tapar tabs desalineados o faltantes en el fondo */}
      <div
        className="pixel-shop-tabs-backdrop"
        style={calcStyle(BACKDROP_BOX)}
        aria-hidden="true"
      />

      {/* 6 Tabs Uniformes Interactivos */}
      <div className="pixel-shop-tabs-layer" aria-label="Navegación de Tienda">
        {UNIFIED_SHOP_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={`pixel-shop-tab-btn pixel-shop-tab-btn--${tab.id} ${
                isActive ? 'pixel-shop-tab-btn--active' : ''
              }`}
              style={calcStyle(tab)}
              onClick={() => handleTabClick(tab)}
              title={tab.toastLabel}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="pixel-shop-tab-btn__icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="pixel-shop-tab-btn__text">{tab.label}</span>
              {isActive && <div className="pixel-shop-tab-btn__glow" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </>
  )
}
