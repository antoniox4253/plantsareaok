import { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import PixelHeaderBadges from './PixelHeaderBadges'
import {
  EMOTES_CATALOG,
  getUnlockedEmoteIds,
  purchaseEmote,
  type EmoteItem,
} from '../../utils/emotesManager'
import './PixelGoldEmotes.css'

const BASE_WIDTH = 1672
const BASE_HEIGHT = 941

// Coordenadas fijas ajustadas para tapar completamente las insignias del header
const GOLD_COORDS = { x: 882, y: 31, w: 226, h: 58 }
const GEMS_COORDS = { x: 1108, y: 31, w: 226, h: 58 }
const ENERGY_COORDS = { x: 1332, y: 31, w: 194, h: 58 }
const SOUND_COORDS = { x: 1538, y: 31, w: 57, h: 58 }

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
  onToggleClassic: _onToggleClassic,
  onSelectTab,
  onBuyGoldPackage,
  userGold = 0,
  userTokens = 0,
  playerEnergy = 20,
  maxPlayerEnergy = 20,
  userElo = 1000,
  onRefreshBalance,
}: PixelGoldEmotesProps) {
  const [debugHotspots] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => getUnlockedEmoteIds())

  // Balances locales reactivos para actualización instantánea en tiempo real
  const [localGold, setLocalGold] = useState<number>(userGold)
  const [localGems, setLocalGems] = useState<number>(userTokens)

  useEffect(() => {
    setLocalGold(userGold)
  }, [userGold])

  useEffect(() => {
    setLocalGems(userTokens)
  }, [userTokens])

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

  // Ejecución de prueba de animación del emote
  const handleTestEmote = () => {
    soundManager.playSound('plantation', 0.8)
    setIsPreviewAnimating(false)
    requestAnimationFrame(() => {
      setIsPreviewAnimating(true)
    })
  }

  // Compra de emote con Oro o Gemas (actualización instantánea en tiempo real)
  const handleBuyEmote = async (emote: EmoteItem, currency: 'gold' | 'gems' = 'gold') => {
    if (isPurchasingEmote) return

    if (currency === 'gold' && localGold < emote.priceGold) {
      setAlertModal({
        title: 'ORO INSUFICIENTE',
        message: `⚠️ Necesitas ${emote.priceGold.toLocaleString()} Monedas de Oro para desbloquear "${emote.label}".\nTienes actualmente ${localGold.toLocaleString()} de Oro. Puedes pagar con 100 Gemas o adquirir paquetes de oro.`,
        icon: '🪙',
      })
      return
    }

    if (currency === 'gems' && localGems < emote.priceGems) {
      setAlertModal({
        title: 'GEMAS INSUFICIENTES',
        message: `⚠️ Necesitas ${emote.priceGems.toLocaleString()} 💎 Gemas para desbloquear "${emote.label}".\nTienes actualmente ${localGems.toLocaleString()} Gemas.`,
        icon: '💎',
      })
      return
    }

    setIsPurchasingEmote(true)
    try {
      const res = await purchaseEmote(emote.id, currency, localGold, localGems)
      if (res.success) {
        soundManager.playSound('points', 0.9)

        // Actualización inmediata del saldo local (0ms delay)
        if (typeof res.newGold === 'number') setLocalGold(res.newGold)
        else if (currency === 'gold') setLocalGold((g) => Math.max(0, g - emote.priceGold))

        if (typeof res.newGems === 'number') setLocalGems(res.newGems)
        else if (currency === 'gems') setLocalGems((g) => Math.max(0, g - emote.priceGems))

        const nextUnlocked = res.unlockedEmotes || getUnlockedEmoteIds()
        setUnlockedIds(nextUnlocked)

        const currencyLabel = currency === 'gold' ? `${emote.priceGold.toLocaleString()} Oro` : `${emote.priceGems} Gemas`
        setToastMessage(`🎉 ¡Emote "${emote.label}" desbloqueado! (-${currencyLabel})`)

        // Notificar a la aplicación y servidor
        onRefreshBalance?.()
        window.dispatchEvent(new CustomEvent('plant_arena_emotes_updated', { detail: nextUnlocked }))
        window.dispatchEvent(new Event('plant_arena_profile_updated'))
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

  // Compra de paquete de Oro con Gemas (actualización inmediata)
  const handleExecuteGoldPurchase = async () => {
    if (!confirmGoldPkg || isPurchasingGold) return
    if (localGems < confirmGoldPkg.priceGems) {
      setConfirmGoldPkg(null)
      setAlertModal({
        title: 'GEMAS INSUFICIENTES',
        message: `💎 Necesitas ${confirmGoldPkg.priceGems.toLocaleString()} Gemas para este paquete.\nTienes actualmente ${localGems.toLocaleString()} Gemas.`,
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
        setLocalGold((prev) => prev + added)
        setLocalGems((prev) => Math.max(0, prev - confirmGoldPkg.priceGems))
        setConfirmGoldPkg(null)
        setToastMessage(`💰 ¡+${added.toLocaleString()} Monedas de Oro añadidas a tu cuenta!`)
        onRefreshBalance?.()
        window.dispatchEvent(new Event('plant_arena_profile_updated'))
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

        {/* Header Badges (Oro, Gemas, Energía, Sonido) con posiciones ajustadas a la izquierda */}
        <PixelHeaderBadges
          userGold={localGold}
          userTokens={localGems}
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

        {/* =========================================================================
            BADGES RPG QUE SOBREPONEN Y ACTUALIZAN LOS TEXTOS HARDCODEADOS ("CHANCAR")
            ========================================================================= */}
        {/* Paquete 1: Básico (500 Oro / 100 Gemas) */}
        <div
          className="pixel-gold-card-overlay pixel-gold-card-overlay--title"
          style={calcStyle({ x: 125, y: 366, w: 378, h: 46 })}
        >
          PAQUETE BÁSICO
        </div>
        <div
          className="pixel-gold-card-overlay pixel-gold-card-overlay--amount"
          style={calcStyle({ x: 145, y: 556, w: 338, h: 56 })}
        >
          <span>🪙</span>
          <span>500 ORO</span>
        </div>
        <button
          type="button"
          className="pixel-gold-card-overlay pixel-gold-card-overlay--btn"
          style={calcStyle({ x: 133, y: 628, w: 359, h: 74 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_100',
              title: 'Paquete Básico de Oro',
              gold: 500,
              priceGems: 100,
            })
          }}
          title="Comprar Paquete Básico por 100 Gemas"
          aria-label="Comprar Paquete Básico por 100 Gemas"
        >
          <span>💎</span>
          <span>100 GEMAS</span>
        </button>

        {/* Paquete 2: Popular (1,250 Oro / 200 Gemas • +25% Extra) */}
        <div
          className="pixel-gold-card-overlay pixel-gold-card-overlay--title pixel-gold-card-overlay--title-popular"
          style={calcStyle({ x: 640, y: 366, w: 388, h: 46 })}
        >
          ⭐ POPULAR (+25% EXTRA) ⭐
        </div>
        <div
          className="pixel-gold-card-overlay pixel-gold-card-overlay--amount"
          style={calcStyle({ x: 660, y: 556, w: 345, h: 56 })}
        >
          <span>🪙</span>
          <span>1,250 ORO</span>
        </div>
        <button
          type="button"
          className="pixel-gold-card-overlay pixel-gold-card-overlay--btn"
          style={calcStyle({ x: 646, y: 628, w: 368, h: 74 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_250',
              title: 'Paquete Popular de Oro (+25% Extra)',
              gold: 1250,
              priceGems: 200,
            })
          }}
          title="Comprar Paquete Popular por 200 Gemas"
          aria-label="Comprar Paquete Popular por 200 Gemas"
        >
          <span>💎</span>
          <span>200 GEMAS</span>
        </button>

        {/* Paquete 3: Mejor Valor (3,500 Oro / 500 Gemas • +40% Extra) */}
        <div
          className="pixel-gold-card-overlay pixel-gold-card-overlay--title pixel-gold-card-overlay--title-best"
          style={calcStyle({ x: 1125, y: 366, w: 385, h: 46 })}
        >
          👑 MEJOR VALOR (+40% EXTRA) 👑
        </div>
        <div
          className="pixel-gold-card-overlay pixel-gold-card-overlay--amount"
          style={calcStyle({ x: 1145, y: 556, w: 345, h: 56 })}
        >
          <span>🪙</span>
          <span>3,500 ORO</span>
        </div>
        <button
          type="button"
          className="pixel-gold-card-overlay pixel-gold-card-overlay--btn"
          style={calcStyle({ x: 1137, y: 628, w: 365, h: 74 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setConfirmGoldPkg({
              id: 'gold_700',
              title: 'Bóveda Real de Monedas (Mejor Valor • +40% Extra)',
              gold: 3500,
              priceGems: 500,
            })
          }}
          title="Comprar Paquete Mejor Valor por 500 Gemas"
          aria-label="Comprar Paquete Mejor Valor por 500 Gemas"
        >
          <span>💎</span>
          <span>500 GEMAS</span>
        </button>

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

        {/* Vitrina de Emotes (clic abre el catálogo interactivo sin superposiciones) */}
        <button
          type="button"
          className={`pixel-gold-hotspot ${debugHotspots ? 'debug' : ''}`}
          style={calcStyle({ x: 670, y: 760, w: 865, h: 120 })}
          onClick={() => {
            soundManager.playSound('plantation', 0.7)
            setShowCatalogModal(true)
          }}
          title="Ver Colección Completa de Emotes"
          aria-label="Ver Colección Completa de Emotes"
        />
      </div>

      {/* =========================================================================
          MODALES APILADOS CON Z-INDEX CORRECTO (Catálogo debajo, Detalle encima)
          ========================================================================= */}

      {/* 1. MODAL: CATÁLOGO COMPLETO DE EMOTES ("VER EMOTES") */}
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
              Todos los emotes que desbloquees estarán inmediatamente disponibles desde el cajón izquierdo de combate en todos los modos. Puedes desbloquearlos con 1,200 Oro o 100 Gemas.
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
                      <div className="pixel-gold-card-sub">
                        🪙 {emote.priceGold.toLocaleString()} Oro / 💎 {emote.priceGems} Gemas
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL: DETALLES Y PRUEBA DE EMOTE (SIEMPRE DELANTE DEL CATÁLOGO) */}
      {selectedEmote && (
        <div
          className="pixel-gold-modal-backdrop pixel-gold-modal-backdrop--detail"
          onClick={() => setSelectedEmote(null)}
        >
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
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#cbd5e1' }}>
              {selectedEmote.description}
            </p>

            {/* Escenario de prueba animada del Emote */}
            <div className="pixel-gold-preview-bubble-stage">
              <img
                src={selectedEmote.webpSrc || selectedEmote.imageSrc}
                alt={selectedEmote.label}
                className={`pixel-gold-bubble-img ${isPreviewAnimating ? 'pop' : ''}`}
                key={isPreviewAnimating ? Date.now() : undefined}
              />
              {/* Chispas flotantes RPG */}
              {isPreviewAnimating &&
                [...Array(6)].map((_, i) => {
                  const angle = (Math.PI * 2 / 6) * i
                  const dist = 48 + Math.random() * 20
                  return (
                    <div
                      key={i}
                      className="pixel-gold-spark"
                      style={{
                        left: `calc(50% + ${Math.cos(angle) * dist}px)`,
                        top: `calc(50% + ${Math.sin(angle) * dist}px)`,
                        ['--dx' as any]: `${Math.cos(angle) * 22}px`,
                        ['--dy' as any]: `${Math.sin(angle) * 22}px`,
                      }}
                    />
                  )
                })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="pixel-gold-btn pixel-gold-btn--test"
                onClick={handleTestEmote}
              >
                ▶️ PROBAR REACCIÓN EN VIVO
              </button>

              {unlockedIds.includes(selectedEmote.id) ? (
                <div
                  className="pixel-gold-btn pixel-gold-btn--owned"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  ✅ YA DESBLOQUEADO
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="pixel-gold-btn pixel-gold-btn--buy"
                    style={{
                      flex: 1,
                      minWidth: 160,
                      background: 'linear-gradient(180deg, #eab308 0%, #ca8a04 100%)',
                      border: '2px solid #fef08a',
                      color: '#000',
                      fontWeight: 900,
                    }}
                    disabled={isPurchasingEmote}
                    onClick={() => handleBuyEmote(selectedEmote, 'gold')}
                  >
                    {isPurchasingEmote ? '⏳ PROCESANDO...' : `🪙 COMPRAR (${selectedEmote.priceGold.toLocaleString()} ORO)`}
                  </button>
                  <button
                    type="button"
                    className="pixel-gold-btn pixel-gold-btn--buy"
                    style={{
                      flex: 1,
                      minWidth: 160,
                      background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                      border: '2px solid #38bdf8',
                      color: '#fff',
                      fontWeight: 900,
                    }}
                    disabled={isPurchasingEmote}
                    onClick={() => handleBuyEmote(selectedEmote, 'gems')}
                  >
                    {isPurchasingEmote ? '⏳ PROCESANDO...' : `💎 COMPRAR (${selectedEmote.priceGems.toLocaleString()} GEMAS)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL: CONFIRMACIÓN DE COMPRA DE ORO */}
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

      {/* 4. MODAL: ALERTA THEMED (Z-INDEX MÁXIMO) */}
      {alertModal && (
        <div
          className="pixel-gold-modal-backdrop pixel-gold-modal-backdrop--alert"
          onClick={() => setAlertModal(null)}
        >
          <div className="pixel-gold-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pixel-gold-modal-close"
              onClick={() => setAlertModal(null)}
            >
              ✕
            </button>
            <div style={{ fontSize: 48, margin: '8px 0' }}>{alertModal.icon}</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, color: '#ef4444', fontWeight: 900 }}>
              {alertModal.title}
            </h3>
            <p style={{ whiteSpace: 'pre-line', fontSize: 14, color: '#cbd5e1', margin: '0 0 16px' }}>
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

      {/* Toast Notificación rápida */}
      {toastMessage && <div className="pixel-gold-toast">{toastMessage}</div>}
    </div>
  )
}
