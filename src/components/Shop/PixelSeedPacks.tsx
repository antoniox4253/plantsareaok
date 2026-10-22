import { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import type { PackId, InventoryPack } from '../../utils/packDropManager'
import PixelHeaderBadges from './PixelHeaderBadges'
import PixelShopTabs from './PixelShopTabs'
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
  { id: 'hero_title', label: 'Título Sobres de Semillas', x: 553, y: 190, w: 627, h: 112, type: 'section' },
  { id: 'button_probabilidades', label: 'Botón Ver Probabilidades', x: 1251, y: 219, w: 301, h: 85, type: 'cta' },
  { id: 'pack_basic', label: 'Ver Probabilidades Sobre Básico', x: 80, y: 220, w: 465, h: 470, type: 'card' },
  { id: 'pack_epic', label: 'Ver Probabilidades Sobre Épico', x: 595, y: 319, w: 412, h: 370, type: 'card' },
  { id: 'pack_legendary', label: 'Ver Probabilidades Sobre Legendario', x: 1080, y: 318, w: 476, h: 370, type: 'card' },
  { id: 'rarities_basic', label: 'Rarezas Sobre Básico', x: 85, y: 700, w: 450, h: 54, type: 'pillgroup' },
  { id: 'rarities_epic', label: 'Rarezas Sobre Épico', x: 650, y: 700, w: 355, h: 54, type: 'pillgroup' },
  { id: 'rarities_legendary', label: 'Rarezas Sobre Legendario', x: 1172, y: 700, w: 295, h: 54, type: 'pillgroup' },
  { id: 'buy_basic', label: 'Comprar Sobre Básico', x: 82, y: 795, w: 456, h: 86, type: 'buy' },
  { id: 'buy_epic', label: 'Comprar Sobre Épico', x: 638, y: 792, w: 365, h: 92, type: 'buy' },
  { id: 'buy_legendary', label: 'Comprar Sobre Legendario', x: 1111, y: 792, w: 424, h: 92, type: 'buy' },
]

export interface PixelSeedPacksProps {
  onBackToHome: () => void
  onOpenStreaming?: () => void
  onToggleClassic?: () => void
  onSelectTab?: (tab: 'packs' | 'pass' | 'gold' | 'energy' | 'market') => void
  onBuyPack: (packId: PackId) => Promise<{ success: boolean; packs?: InventoryPack[]; goldAdded?: number; error?: string }>
  onOpenPackImmediately?: (packInstanceId: string) => void
  onOpenProbabilities?: (packId?: PackId) => void
  userGold?: number
  userTokens?: number
  playerEnergy?: number
  maxPlayerEnergy?: number
  userElo?: number
  isPurchasing?: boolean
  goldenPityCounter?: number
}

export default function PixelSeedPacks({
  onBackToHome,
  onOpenStreaming,
  onToggleClassic: _onToggleClassic,
  onSelectTab,
  onBuyPack,
  onOpenPackImmediately,
  onOpenProbabilities,
  userGold = 0,
  userTokens = 0,
  playerEnergy = 20,
  maxPlayerEnergy = 20,
  userElo = 1000,
  isPurchasing = false,
  goldenPityCounter = 0,
}: PixelSeedPacksProps) {
  const [debugHotspots] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showOddsModal, setShowOddsModal] = useState<boolean>(false)
  const [localPurchasing, setLocalPurchasing] = useState<boolean>(false)

  const pityProgress = Math.min(100, Math.max(0, goldenPityCounter % 100))
  const pityRemaining = 100 - pityProgress

  const [confirmModal, setConfirmModal] = useState<{
    packId: PackId
    name: string
    price: number
    goldBonus: number
    icon: string
  } | null>(null)

  const [alertModal, setAlertModal] = useState<{
    title: string
    message: string
    icon: string
  } | null>(null)

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => {
      setToastMessage(null)
    }, 2800)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const handleExecutePurchase = async () => {
    if (!confirmModal || localPurchasing || isPurchasing) return
    setLocalPurchasing(true)
    try {
      const res = await onBuyPack(confirmModal.packId)
      if (res && res.success && res.packs && res.packs.length > 0) {
        soundManager.playSound('plantation', 0.9)
        setConfirmModal(null)
        if (onOpenPackImmediately) {
          onOpenPackImmediately(res.packs[0].instanceId)
        } else {
          setToastMessage(`🎉 ¡${confirmModal.name} adquirido con éxito!`)
        }
      } else if (res && !res.success) {
        setConfirmModal(null)
        setAlertModal({
          title: 'COMPRA RECHAZADA',
          message: res.error || 'El servidor rechazó la compra.',
          icon: '⚠️',
        })
      }
    } finally {
      setLocalPurchasing(false)
    }
  }

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
      if (onSelectTab) onSelectTab('market')
      else setToastMessage('🤝 Comercio P2P')
      return
    }

    // Botón de probabilidades y clic en cartas (inspección de detalles)
    if (h.id === 'button_probabilidades' || h.id === 'pack_basic' || h.id === 'pack_epic' || h.id === 'pack_legendary') {
      if (onOpenProbabilities) {
        const targetPackId: PackId | undefined =
          h.id === 'pack_basic' ? 'basic' : h.id === 'pack_epic' ? 'epic' : h.id === 'pack_legendary' ? 'legendary' : undefined
        onOpenProbabilities(targetPackId)
      } else {
        setShowOddsModal(true)
      }
      return
    }

    // Comprar Sobre Básico (300 Gemas)
    if (h.id === 'buy_basic') {
      if (isPurchasing || localPurchasing) return
      if (userTokens < 300) {
        setAlertModal({
          title: 'GEMAS INSUFICIENTES',
          message: `⚠️ No dispones de suficientes gemas para comprar este sobre.\n\n💎 Saldo actual: ${userTokens.toLocaleString()} Gemas\n💎 Costo del sobre: 300 Gemas\n❌ Faltan: ${(300 - userTokens).toLocaleString()} Gemas`,
          icon: '💎',
        })
        return
      }
      setConfirmModal({
        packId: 'basic',
        name: 'Sobre de Semillas Básico',
        price: 300,
        goldBonus: 300,
        icon: '/game-assets/greenfoot/seed_pack_common_whitebg.webp',
      })
      return
    }

    // Comprar Sobre Épico (1,000 Gemas)
    if (h.id === 'buy_epic') {
      if (isPurchasing || localPurchasing) return
      if (userTokens < 1000) {
        setAlertModal({
          title: 'GEMAS INSUFICIENTES',
          message: `⚠️ No dispones de suficientes gemas para comprar este sobre.\n\n💎 Saldo actual: ${userTokens.toLocaleString()} Gemas\n💎 Costo del sobre: 1,000 Gemas\n❌ Faltan: ${(1000 - userTokens).toLocaleString()} Gemas`,
          icon: '💎',
        })
        return
      }
      setConfirmModal({
        packId: 'epic',
        name: 'Sobre de Semillas Místico',
        price: 1000,
        goldBonus: 1000,
        icon: '/game-assets/greenfoot/seed_pack_epic_whitebg.webp',
      })
      return
    }

    // Comprar Sobre Legendario (2,500 Gemas)
    if (h.id === 'buy_legendary') {
      if (isPurchasing || localPurchasing) return
      if (userTokens < 2500) {
        setAlertModal({
          title: 'GEMAS INSUFICIENTES',
          message: `⚠️ No dispones de suficientes gemas para comprar este sobre.\n\n💎 Saldo actual: ${userTokens.toLocaleString()} Gemas\n💎 Costo del sobre: 2,500 Gemas\n❌ Faltan: ${(2500 - userTokens).toLocaleString()} Gemas`,
          icon: '💎',
        })
        return
      }
      setConfirmModal({
        packId: 'legendary',
        name: 'Sobre VIP Legendario',
        price: 2500,
        goldBonus: 2500,
        icon: '/game-assets/greenfoot/seed_pack_legendary_whitebg.webp',
      })
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

        {/* Badges interactivos en vivo: Oro, Gemas, Energía y Sonido */}
        <PixelHeaderBadges
          userGold={userGold}
          userTokens={userTokens}
          playerEnergy={playerEnergy}
          maxPlayerEnergy={maxPlayerEnergy}
          userElo={userElo}
          goldCoords={{ x: 858, y: 17, w: 254, h: 72 }}
          gemsCoords={{ x: 1110, y: 17, w: 252, h: 72 }}
          energyCoords={{ x: 1363, y: 17, w: 215, h: 72 }}
          soundCoords={{ x: 1590, y: 16, w: 63, h: 73 }}
          onSelectTab={(tab) => {
            if (onSelectTab) onSelectTab(tab)
          }}
          onToast={(msg) => setToastMessage(msg)}
        />

        {/* Barra de Navegación de 6 Pestañas Unificada */}
        <PixelShopTabs
          activeTab="packs"
          onSelectTab={onSelectTab}
          onOpenStreaming={onOpenStreaming}
          onToast={(msg) => setToastMessage(msg)}
          baseWidth={BASE_WIDTH}
          baseHeight={BASE_HEIGHT}
        />

        {/* Banner de Pity de Cartas Doradas */}
        <div
          className="pixel-seedpacks-pity-banner"
          title={`Pity: ${pityProgress}/100 cartas abiertas para Carta Dorada garantizada. Haz clic para ver detalles.`}
          onClick={() => setShowOddsModal(true)}
        >
          <div className="pixel-seedpacks-pity-banner__badge">
            ✨ PITY DORADAS
          </div>
          <div className="pixel-seedpacks-pity-banner__track">
            <div
              className="pixel-seedpacks-pity-banner__fill"
              style={{ width: `${pityProgress}%` }}
            />
          </div>
          <div className="pixel-seedpacks-pity-banner__text">
            Garantizada en <strong>{pityRemaining}</strong> {pityRemaining === 1 ? 'carta' : 'cartas'} ({pityProgress}/100)
          </div>
        </div>

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

                {/* Cartas Doradas (Gold Foil) & Pity */}
                <div className="pixel-seedpacks-odds-item pixel-seedpacks-odds-item--golden">
                  <div className="pixel-seedpacks-odds-item-head">
                    <span className="pixel-seedpacks-odds-item-name" style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
                      ✨ Cartas Doradas (Gold Foil)
                    </span>
                    <span className="pixel-seedpacks-odds-item-price" style={{ color: '#fef08a' }}>
                      +10% Token PLANTS c/u en Arena 3+
                    </span>
                  </div>
                  <div className="pixel-seedpacks-odds-rates">
                    <span className="rate-badge rate-badge--golden-basic">Básico: 1.0%</span>
                    <span className="rate-badge rate-badge--golden-epic">Místico: 2.5%</span>
                    <span className="rate-badge rate-badge--golden-leg">Legendario: 5.0%</span>
                    <span className="rate-badge rate-badge--golden-pity">🛡️ Pity: Garantizada cada 100 cartas</span>
                  </div>
                  <span className="pixel-seedpacks-odds-exclusive" style={{ color: '#fde68a' }}>
                    🌟 Las cartas doradas son cartas físicas jugables con sprite exclusivo y otorgan hasta +60% de bonus en $PLANTS por victoria. El contador de pity se reinicia al obtener cualquier carta dorada.
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

        {/* Modal de Confirmación de Compra */}
        {confirmModal && (
          <div
            className="pixel-seedpacks-odds-backdrop"
            onClick={() => {
              if (!localPurchasing) setConfirmModal(null)
            }}
          >
            <div
              className="pixel-seedpacks-modal-card pixel-seedpacks-modal-card--confirm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="pixel-seedpacks-odds-close"
                disabled={localPurchasing}
                onClick={() => setConfirmModal(null)}
              >
                ✕
              </button>

              <div className="pixel-seedpacks-odds-head">
                <span className="pixel-seedpacks-odds-badge">🛒 CONFIRMAR COMPRA</span>
                <h3 className="pixel-seedpacks-odds-title">{confirmModal.name}</h3>
                <p className="pixel-seedpacks-odds-sub">
                  El sobre se abrirá de inmediato para revelar tus cartas.
                </p>
              </div>

              <div className="pixel-seedpacks-confirm-body">
                <div className="pixel-seedpacks-confirm-img-wrap">
                  <img src={confirmModal.icon} alt={confirmModal.name} className="pixel-seedpacks-confirm-img" />
                </div>

                <div className="pixel-seedpacks-confirm-info">
                  <div className="pixel-seedpacks-confirm-row">
                    <span>Precio:</span>
                    <strong style={{ color: '#38bdf8' }}>{confirmModal.price.toLocaleString()} 💎 Gemas</strong>
                  </div>
                  <div className="pixel-seedpacks-confirm-row">
                    <span>Bonificación:</span>
                    <strong style={{ color: '#fbbf24' }}>+{confirmModal.goldBonus.toLocaleString()} 🪙 Oro</strong>
                  </div>
                  <div className="pixel-seedpacks-confirm-row pixel-seedpacks-confirm-row--highlight">
                    <span>Tu saldo tras la compra:</span>
                    <strong style={{ color: '#4ade80' }}>{(userTokens - confirmModal.price).toLocaleString()} 💎</strong>
                  </div>
                </div>
              </div>

              <div className="pixel-seedpacks-modal-actions">
                <button
                  type="button"
                  className="pixel-seedpacks-modal-btn pixel-seedpacks-modal-btn--cancel"
                  disabled={localPurchasing}
                  onClick={() => setConfirmModal(null)}
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  className="pixel-seedpacks-modal-btn pixel-seedpacks-modal-btn--buy"
                  disabled={localPurchasing}
                  onClick={handleExecutePurchase}
                >
                  {localPurchasing ? '⏳ COMPRANDO...' : `💥 COMPRAR Y ABRIR (${confirmModal.price} 💎)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Alerta / Gemas Insuficientes */}
        {alertModal && (
          <div
            className="pixel-seedpacks-odds-backdrop"
            onClick={() => setAlertModal(null)}
          >
            <div
              className="pixel-seedpacks-modal-card pixel-seedpacks-modal-card--alert"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pixel-seedpacks-modal-alert-icon">{alertModal.icon}</div>
              <h3 className="pixel-seedpacks-odds-title" style={{ marginTop: '8px', color: '#fbbf24' }}>
                {alertModal.title}
              </h3>
              <p className="pixel-seedpacks-modal-alert-msg">{alertModal.message}</p>
              <button
                type="button"
                className="pixel-seedpacks-odds-btn-close"
                style={{ marginTop: '16px' }}
                onClick={() => setAlertModal(null)}
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
