import { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import PixelHeaderBadges from './PixelHeaderBadges'
import {
  EMOTES_CATALOG,
  getUnlockedEmoteIds,
  purchaseEmoteWithGold,
  type EmoteItem,
} from '../../utils/emotesManager'
import './PixelGoldEmotes.css'

const BASE_WIDTH = 1672
const BASE_HEIGHT = 941

// Coordenadas fijas extraídas del hotspots.json de Oro & Emotes
const GOLD_COORDS = { x: 897, y: 33, w: 214, h: 55 }
const GEMS_COORDS = { x: 1122, y: 33, w: 216, h: 55 }
const ENERGY_COORDS = { x: 1348, y: 33, w: 178, h: 55 }
const SOUND_COORDS = { x: 1541, y: 31, w: 57, h: 58 }

const EMOTE_SLOT_COORDS = [
  { x: 744, y: 778, w: 104, h: 92 },
  { x: 851, y: 778, w: 104, h: 92 },
  { x: 959, y: 778, w: 104, h: 92 },
  { x: 1068, y: 778, w: 104, h: 92 },
  { x: 1178, y: 778, w: 104, h: 92 },
  { x: 1288, y: 778, w: 104, h: 92 },
]

export interface PixelGoldEmotesProps {
  onBackToHome: () => void
  onOpenStreaming?: () => void
  onToggleClassic?: () => void
  onSelectTab?: (tab: 'packs' | 'pass' | 'gold' | 'energy' | 'market') => void
  onBuyGoldPackage: (packageId: string) => Promise<{ success: boolean; goldAdded?: number; error?: string }>
  userGold?: number
  userTokens?: number
  playerEnergy?: number
  maxPlayerEnergy?: number
  userElo?: number
  onRefreshBalance?: () => void
}

export default function PixelGoldEmotes({
  onBackToHome,
  onOpenStreaming,
  onToggleClassic,
  onSelectTab,
  onBuyGoldPackage,
  userGold = 0,
  userTokens = 0,
  playerEnergy = 20,
  maxPlayerEnergy = 20,
  userElo = 1000,
  onRefreshBalance,
}: PixelGoldEmotesProps) {
  const [debugHotspots, setDebugHotspots] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [carouselOffset, setCarouselOffset] = useState<number>(0)
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => getUnlockedEmoteIds())

  // Modal de Emote individual (para probar / comprar)
  const [selectedEmote, setSelectedEmote] = useState<EmoteItem | null>(null)
  const [isPreviewAnimating, setIsPreviewAnimating] = useState<boolean>(false)
  const [isPurchasingEmote, setIsPurchasingEmote] = useState<boolean>(false)

  // Modal de Catálogo Completo (botón "VER EMOTES")
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false)

  // Modal de confirmación de paquete de Oro
  const [confirmGoldPkg, setConfirmGoldPkg] = useState<{
    id: string
    title: string
    gold: number
    priceGems: number
  } | null>(null)
  const [isPurchasingGold, setIsPurchasingGold] = useState<boolean>(false)

  // Alerta modal para mensajes
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; icon: string } | null>(null)

  // Escuchar eventos de actualización de emotes
  useEffect(() => {
    const handleUpdate = () => {
      setUnlockedIds(getUnlockedEmoteIds())
    }
    window.addEventListener('plant_arena_emotes_updated', handleUpdate)
    return () => window.removeEventListener('plant_arena_emotes_updated', handleUpdate)
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 2800)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // Desplazamiento del carrusel de 6 slots
  const maxOffset = Math.max(0, EMOTES_CATALOG.length - EMOTE_SLOT_COORDS.length)
  const handlePrevEmotes = () => {
    soundManager.playSound('plantation', 0.5)
    setCarouselOffset((prev) => Math.max(0, prev - 1))
  }
  const handleNextEmotes = () => {
    soundManager.playSound('plantation', 0.5)
    setCarouselOffset((prev) => Math.min(maxOffset, prev + 1))
  }

  // Ejecución de prueba de animación del emote
  const handleTestEmote = () => {
    soundManager.playSound('plantation', 0.8)
    setIsPreviewAnimating(false)
    requestAnimationFrame(() => {
      setIsPreviewAnimating(true)
    })
  }

  // Compra de emote con Oro
  const handleBuyEmote = async (emote: EmoteItem) => {
    if (isPurchasingEmote) return
    if (userGold < emote.priceGold) {
      setAlertModal({
        title: 'ORO INSUFICIENTE',
        message: `⚠️ Necesitas ${emote.priceGold.toLocaleString()} Monedas de Oro para desbloquear "${emote.label}".\nTienes actualmente ${userGold.toLocaleString()} de Oro. Puedes adquirir más en los paquetes superiores.`,
        icon: '💰',
      })
      return
    }

    setIsPurchasingEmote(true)
    try {
      const res = await purchaseEmoteWithGold(emote.id, userGold)
      if (res.success) {
        soundManager.playSound('points', 0.9)
        setUnlockedIds(getUnlockedEmoteIds())
        setToastMessage(`🎉 ¡Emote "${emote.label}" desbloqueado con éxito!`)
        onRefreshBalance?.()
      } else {
        setAlertModal({
          title: 'ERROR EN COMPRA',
          message: res.error || 'No se pudo procesar la compra del emote.',
          icon: '⚠️',
        })
      }
    } finally {
      setIsPurchasingEmote(false)
    }
  }

  // Compra de paquete de Oro con Gemas
  const handleExecuteGoldPurchase = async () => {
    if (!confirmGoldPkg || isPurchasingGold) return
    if (userTokens < confirmGoldPkg.priceGems) {
      setConfirmGoldPkg(null)
      setAlertModal({
        title: 'GEMAS INSUFICIENTES',
        message: `💎 Necesitas ${confirmGoldPkg.priceGems.toLocaleString()} Gemas para este paquete.\nTienes actualmente ${userTokens.toLocaleString()} Gemas.`,
        icon: '⚠️',
      })
      return
    }

    setIsPurchasingGold(true)
    try {
      const res = await onBuyGoldPackage(confirmGoldPkg.id)
      if (res && res.success) {
        soundManager.playSound('points', 0.9)
        const added = res.goldAdded ?? confirmGoldPkg.gold
        setConfirmGoldPkg(null)
        setToastMessage(`💰 ¡+${added.toLocaleString()} Monedas de Oro añadidas a tu cuenta!`)
        onRefreshBalance?.()
      } else {
        setConfirmGoldPkg(null)
        setAlertModal({
          title: 'ERROR EN COMPRA',
          message: res?.error || 'No se pudo completar la transacción.',
          icon: '⚠️',
        })
      }
    } finally {
      setIsPurchasingGold(false)
    }
  }

  // Helper para convertir coordenadas a porcentajes
  const calcStyle = (box: { x: number; y: number; w: number; h: number }) => ({
    left: `${(box.x / BASE_WIDTH) * 100}%`,
    top: `${(box.y / BASE_HEIGHT) * 100}%`,
    width: `${(box.w / BASE_WIDTH) * 100}%`,
    height: `${(box.h / BASE_HEIGHT) * 100}%`,
  })

  // 6 emotes activos según offset
  const visibleEmotes = EMOTES_CATALOG.slice(carouselOffset, carouselOffset + EMOTE_SLOT_COORDS.length)

  return (
    <div className="pixel-gold-container">
      <div className="pixel-gold-stage">
        {/* Fondo Pixel-Art de Oro y Emotes */}
        <picture>
          <source srcSet="/game-assets/shop/screen_oro_emotes.webp" type="image/webp" />
          <img
            src="/game-assets/shop/screen_oro_emotes.png"
            alt="Tienda de Oro y Emotes"
            className="pixel-gold-bg"
          />
        </picture>

        {/* Header Badges Reutilizable (Oro, Gemas, Energía, Sonido) */}
        <PixelHeaderBadges
          userGold={userGold}
          userTokens={userTokens}
          playerEnergy={playerEnergy}
          maxPlayerEnergy={maxPlayerEnergy}
          userElo={userElo}
          goldCoords={GOLD_COORDS}
          gemsCoords={GEMS_COORDS}
          energyCoords={ENERGY_COORDS}
          soundCoords={SOUND_COORDS}
          baseWidth={BASE_WIDTH}
          baseHeight={BASE_HEIGHT}
          onSelectTab={(t) => {
            if (t === 'energy' && onSelectTab) onSelectTab('energy')
          }}
          onToast={(msg) => setToastMessage(msg)}
        />

        {/* Botón Menú / Volver al Home de la Tienda */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 35, y: 33, w: 129, h: 63 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.6)
            onBackToHome()
          }}
          title="Volver a la Tienda Principal"
          aria-label="Volver a la Tienda Principal"
        />

        {/* TABS DE NAVEGACIÓN */}
        {/* Tab Sobres de Semillas */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 87, y: 116, w: 325, h: 63 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.6)
            onSelectTab?.('packs')
          }}
          title="Ir a Sobres de Semillas"
          aria-label="Ir a Sobres de Semillas"
        />

        {/* Tab Pase VIP */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 432, y: 116, w: 164, h: 63 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.6)
            onSelectTab?.('pass')
          }}
          title="Ir a Pase VIP"
          aria-label="Ir a Pase VIP"
        />

        {/* Tab Oro & Emotes (Actual) */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 614, y: 116, w: 250, h: 63 })}
          onClick={() => soundManager.playSound('plantation', 0.4)}
          title="Pestaña Actual: Oro & Emotes"
          aria-label="Pestaña Actual: Oro & Emotes"
        />

        {/* Tab Energías */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 888, y: 116, w: 189, h: 63 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.6)
            onSelectTab?.('energy')
          }}
          title="Ir a Energías"
          aria-label="Ir a Energías"
        />

        {/* Tab Comercio */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 1093, y: 116, w: 196, h: 63 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.6)
            onSelectTab?.('market')
          }}
          title="Ir a Comercio"
          aria-label="Ir a Comercio"
        />

        {/* Tab Cuentas Stream */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 1307, y: 116, w: 285, h: 63 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.6)
            if (onOpenStreaming) onOpenStreaming()
            else onSelectTab?.('market')
          }}
          title="Ver Cuentas Streaming"
          aria-label="Ver Cuentas Streaming"
        />

        {/* PAQUETES DE ORO */}
        {/* Paquete Básico (100 Oro / 100 Gemas) */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 73, y: 353, w: 482, h: 365 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_100',
              title: 'Paquete Básico de Oro',
              gold: 100,
              priceGems: 100,
            })
          }}
          title="Paquete Básico: 100 Monedas de Oro"
          aria-label="Paquete Básico: 100 Monedas de Oro"
        />
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 133, y: 628, w: 359, h: 74 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_100',
              title: 'Paquete Básico de Oro',
              gold: 100,
              priceGems: 100,
            })
          }}
          title="Comprar Paquete Básico por 100 Gemas"
          aria-label="Comprar Paquete Básico por 100 Gemas"
        />

        {/* Paquete Popular (250 Oro / 200 Gemas) */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 590, y: 352, w: 487, h: 367 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_250',
              title: 'Paquete Popular de Oro',
              gold: 250,
              priceGems: 200,
            })
          }}
          title="Paquete Popular: 250 Monedas de Oro"
          aria-label="Paquete Popular: 250 Monedas de Oro"
        />
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 646, y: 628, w: 368, h: 74 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_250',
              title: 'Paquete Popular de Oro',
              gold: 250,
              priceGems: 200,
            })
          }}
          title="Comprar Paquete Popular por 200 Gemas"
          aria-label="Comprar Paquete Popular por 200 Gemas"
        />

        {/* Paquete Mejor Valor (700 Oro / 500 Gemas) */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 1078, y: 352, w: 468, h: 368 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_700',
              title: 'Paquete Bóveda Real (Mejor Valor)',
              gold: 700,
              priceGems: 500,
            })
          }}
          title="Paquete Mejor Valor: 700 Monedas de Oro"
          aria-label="Paquete Mejor Valor: 700 Monedas de Oro"
        />
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 1137, y: 628, w: 365, h: 74 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_700',
              title: 'Paquete Bóveda Real (Mejor Valor)',
              gold: 700,
              priceGems: 500,
            })
          }}
          title="Comprar Paquete Mejor Valor por 500 Gemas"
          aria-label="Comprar Paquete Mejor Valor por 500 Gemas"
        />

        {/* SECCIÓN EMOTES EXCLUSIVOS */}
        {/* Botón "VER EMOTES" (Abre catálogo completo) */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 285, y: 826, w: 256, h: 60 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setShowCatalogModal(true)
          }}
          title="Abrir Catálogo de Emotes"
          aria-label="Abrir Catálogo de Emotes"
        />

        {/* Flecha Anterior Carrusel */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 682, y: 788, w: 45, h: 85 })}
          onClick={handlePrevEmotes}
          disabled={carouselOffset === 0}
          title="Ver emotes anteriores"
          aria-label="Ver emotes anteriores"
        />

        {/* 6 Slots de Emotes del Carrusel */}
        {visibleEmotes.map((emote, idx) => {
          const coords = EMOTE_SLOT_COORDS[idx]
          if (!coords) return null
          const isOwned = unlockedIds.includes(emote.id)

          return (
            <div
              key={emote.id}
              className="pixel-gold-emote-slot"
              style={calcStyle(coords)}
              onClick={() => {
                soundManager.playSound('plantation', 0.7)
                setSelectedEmote(emote)
                setIsPreviewAnimating(true)
              }}
              title={`${emote.label} - ${isOwned ? 'Desbloqueado' : `${emote.priceGold} Oro`}`}
            >
              <img src={emote.webpSrc || emote.imageSrc} alt={emote.label} />
              {isOwned ? (
                <div className="pixel-gold-emote-badge">LISTO</div>
              ) : (
                <div className="pixel-gold-emote-price">
                  <span>🪙</span>
                  <span>{emote.priceGold}</span>
                </div>
              )}
            </div>
          )
        })}

        {/* Flecha Siguiente Carrusel */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 1487, y: 788, w: 45, h: 85 })}
          onClick={handleNextEmotes}
          disabled={carouselOffset >= maxOffset}
          title="Ver siguientes emotes"
          aria-label="Ver siguientes emotes"
        />

        {/* Botones auxiliares inferiores */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            display: 'flex',
            gap: 6,
            zIndex: 30,
          }}
        >
          <button
            type="button"
            onClick={() => setDebugHotspots(!debugHotspots)}
            style={{
              background: debugHotspots ? 'rgba(56, 189, 248, 0.4)' : 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: debugHotspots ? '#38bdf8' : '#94a3b8',
              borderRadius: 6,
              fontSize: 10,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            {debugHotspots ? 'Ocultar Zonas' : 'Ver Zonas'}
          </button>
          {onToggleClassic && (
            <button
              type="button"
              onClick={onToggleClassic}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#94a3b8',
                borderRadius: 6,
                fontSize: 10,
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              Vista Clásica
            </button>
          )}
        </div>
      </div>

      {/* MODAL: DETALLES Y PRUEBA DE EMOTE */}
      {selectedEmote && (
        <div className="pixel-gold-modal-backdrop" onClick={() => setSelectedEmote(null)}>
          <div className="pixel-gold-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pixel-gold-modal-close"
              onClick={() => setSelectedEmote(null)}
            >
              ✕
            </button>

            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: '#facc15' }}>
              EMOTE: {selectedEmote.label}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#94a3b8' }}>
              {selectedEmote.description}
            </p>

            {/* Escenario de Animación Live Preview */}
            <div className="pixel-gold-preview-bubble-stage">
              {isPreviewAnimating && (
                <>
                  <img
                    src={selectedEmote.webpSrc || selectedEmote.imageSrc}
                    alt={selectedEmote.label}
                    className="pixel-gold-bubble-img"
                  />
                  {/* Chispas doradas */}
                  {[...Array(8)].map((_, i) => {
                    const angle = (Math.PI * 2 / 8) * i
                    const dist = 32 + Math.random() * 24
                    return (
                      <div
                        key={i}
                        className="pixel-gold-spark"
                        style={{
                          left: `calc(50% + ${Math.cos(angle) * dist}px)`,
                          top: `calc(50% + ${Math.sin(angle) * dist}px)`,
                          ['--dx' as any]: `${Math.cos(angle) * 16}px`,
                          ['--dy' as any]: `${Math.sin(angle) * 16}px`,
                        }}
                      />
                    )
                  })}
                </>
              )}
            </div>

            <div className="pixel-gold-modal-actions">
              <button
                type="button"
                className="pixel-gold-btn pixel-gold-btn--test"
                onClick={handleTestEmote}
              >
                ✨ PROBAR ANIMACIÓN
              </button>

              {unlockedIds.includes(selectedEmote.id) ? (
                <div className="pixel-gold-btn pixel-gold-btn--owned">
                  ✅ DESBLOQUEADO (EN COMBATE)
                </div>
              ) : (
                <button
                  type="button"
                  className="pixel-gold-btn pixel-gold-btn--buy"
                  disabled={isPurchasingEmote}
                  onClick={() => handleBuyEmote(selectedEmote)}
                >
                  {isPurchasingEmote ? '⏳ PROCESANDO...' : `🪙 COMPRAR (${selectedEmote.priceGold.toLocaleString()} ORO)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CATÁLOGO COMPLETO DE EMOTES ("VER EMOTES") */}
      {showCatalogModal && (
        <div className="pixel-gold-modal-backdrop" onClick={() => setShowCatalogModal(false)}>
          <div
            className="pixel-gold-modal-card pixel-gold-grid-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="pixel-gold-modal-close"
              onClick={() => setShowCatalogModal(false)}
            >
              ✕
            </button>

            <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900, color: '#38bdf8' }}>
              COLECCIÓN DE EMOTES DE COMBATE
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#cbd5e1' }}>
              Todos los emotes que desbloquees estarán inmediatamente disponibles desde el cajón izquierdo de combate en todos los modos.
            </p>

            <div className="pixel-gold-emotes-grid">
              {EMOTES_CATALOG.map((emote) => {
                const isOwned = unlockedIds.includes(emote.id)
                return (
                  <div
                    key={emote.id}
                    className={`pixel-gold-card-item ${isOwned ? 'owned' : ''}`}
                    onClick={() => {
                      soundManager.playSound('plantation', 0.7)
                      setSelectedEmote(emote)
                      setIsPreviewAnimating(true)
                    }}
                  >
                    <img
                      src={emote.webpSrc || emote.imageSrc}
                      alt={emote.label}
                      className="pixel-gold-card-thumb"
                    />
                    <div className="pixel-gold-card-label">{emote.label}</div>
                    {isOwned ? (
                      <div className="pixel-gold-card-sub free">✅ Desbloqueado</div>
                    ) : (
                      <div className="pixel-gold-card-sub">🪙 {emote.priceGold} Oro</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMACIÓN DE COMPRA DE ORO */}
      {confirmGoldPkg && (
        <div className="pixel-gold-modal-backdrop" onClick={() => setConfirmGoldPkg(null)}>
          <div className="pixel-gold-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pixel-gold-modal-close"
              onClick={() => setConfirmGoldPkg(null)}
            >
              ✕
            </button>

            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#facc15' }}>
              {confirmGoldPkg.title}
            </h2>
            <div style={{ fontSize: 52, margin: '12px 0' }}>💰</div>
            <p style={{ margin: '0 0 16px', fontSize: 15, color: '#cbd5e1' }}>
              ¿Deseas adquirir <strong>+{confirmGoldPkg.gold.toLocaleString()} Monedas de Oro</strong> a cambio de{' '}
              <strong style={{ color: '#38bdf8' }}>{confirmGoldPkg.priceGems.toLocaleString()} 💎 Gemas</strong>?
            </p>

            <div className="pixel-gold-modal-actions">
              <button
                type="button"
                className="pixel-gold-btn pixel-gold-btn--buy"
                disabled={isPurchasingGold}
                onClick={handleExecuteGoldPurchase}
              >
                {isPurchasingGold ? '⏳ PROCESANDO...' : 'CONFIRMAR COMPRA'}
              </button>
              <button
                type="button"
                className="pixel-gold-btn pixel-gold-btn--test"
                style={{ background: 'linear-gradient(180deg, #475569 0%, #1e293b 100%)' }}
                onClick={() => setConfirmGoldPkg(null)}
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALERTA THEMED */}
      {alertModal && (
        <div className="pixel-gold-modal-backdrop" onClick={() => setAlertModal(null)}>
          <div className="pixel-gold-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pixel-gold-modal-close"
              onClick={() => setAlertModal(null)}
            >
              ✕
            </button>
            <div style={{ fontSize: 48, margin: '8px 0' }}>{alertModal.icon}</div>
            <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: '#f87171' }}>
              {alertModal.title}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: '#cbd5e1', whiteSpace: 'pre-line' }}>
              {alertModal.message}
            </p>
            <button
              type="button"
              className="pixel-gold-btn pixel-gold-btn--test"
              onClick={() => setAlertModal(null)}
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}

      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
            border: '2px solid #22c55e',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 16,
            fontWeight: 800,
            fontSize: 14,
            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
            zIndex: 2000,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}
