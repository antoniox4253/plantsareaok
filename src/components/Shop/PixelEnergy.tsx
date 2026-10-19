import { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import PixelHeaderBadges from './PixelHeaderBadges'
import PixelShopTabs from './PixelShopTabs'
import './PixelEnergy.css'

export interface Hotspot {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  type: 'button' | 'counter' | 'tab' | 'section' | 'status' | 'decor' | 'card' | 'label' | 'buy'
}

const BASE_WIDTH = 1672
const BASE_HEIGHT = 941

const ENERGY_HOTSPOTS: Hotspot[] = [
  { id: 'menu', label: 'Menú', type: 'button', x: 31, y: 31, w: 132, h: 63 },
  { id: 'counter_oro', label: 'Contador Oro', type: 'counter', x: 870, y: 31, w: 235, h: 58 },
  { id: 'counter_gemas', label: 'Contador Gemas', type: 'counter', x: 1120, y: 31, w: 220, h: 58 },
  { id: 'counter_energia', label: 'Contador Energía', type: 'counter', x: 1365, y: 31, w: 180, h: 58 },
  { id: 'sound', label: 'Sonido', type: 'button', x: 1572, y: 31, w: 60, h: 58 },
  { id: 'hero_title', label: 'Encabezado Recarga tus Energías', type: 'section', x: 473, y: 210, w: 724, h: 171 },
  { id: 'energy_status', label: 'Tu energía actual', type: 'status', x: 1300, y: 249, w: 281, h: 133 },
  { id: 'lightning_left', label: 'Rayo decorativo izquierdo', type: 'decor', x: 447, y: 234, w: 127, h: 142 },
  { id: 'lightning_right', label: 'Rayo decorativo derecho', type: 'decor', x: 1073, y: 233, w: 126, h: 141 },
  { id: 'pack_5', label: 'Pack 5 energías', type: 'card', x: 189, y: 409, w: 397, h: 443 },
  { id: 'tag_5', label: 'Etiqueta 5 partidas', type: 'label', x: 224, y: 406, w: 269, h: 41 },
  { id: 'buy_5', label: 'Comprar 5 energías', type: 'buy', x: 189, y: 787, w: 395, h: 71 },
  { id: 'pack_10', label: 'Pack 10 energías', type: 'card', x: 610, y: 399, w: 406, h: 459 },
  { id: 'tag_10', label: 'Etiqueta más popular', type: 'label', x: 700, y: 400, w: 230, h: 44 },
  { id: 'buy_10', label: 'Comprar 10 energías', type: 'buy', x: 611, y: 789, w: 404, h: 70 },
  { id: 'pack_max', label: 'Pack recarga completa MAX', type: 'card', x: 1044, y: 409, w: 404, h: 447 },
  { id: 'tag_max', label: 'Etiqueta mejor valor', type: 'label', x: 1135, y: 405, w: 239, h: 46 },
  { id: 'buy_max', label: 'Comprar recarga MAX', type: 'buy', x: 1046, y: 789, w: 400, h: 70 },
]

export interface EnergyPackDef {
  id: string
  name: string
  energyAmount: number | 'MAX'
  priceGems: number
  badge: string
  description: string
  cardHotspotId: string
  buyHotspotId: string
  accentColor: string
}

export const ENERGY_PACK_DEFS: EnergyPackDef[] = [
  {
    id: 'energy_5',
    name: 'Recarga 5 Energías',
    energyAmount: 5,
    priceGems: 200,
    badge: '5 PARTIDAS',
    description: '+5 Energías ⚡ directas a tu cuenta para seguir compitiendo en Ranked.',
    cardHotspotId: 'pack_5',
    buyHotspotId: 'buy_5',
    accentColor: '#38bdf8',
  },
  {
    id: 'energy_10',
    name: 'Pase Grinder 10⚡',
    energyAmount: 10,
    priceGems: 300,
    badge: 'MÁS POPULAR',
    description: '+10 Energías ⚡ al mejor costo por partida para extender tu racha en Ranked.',
    cardHotspotId: 'pack_10',
    buyHotspotId: 'buy_10',
    accentColor: '#facc15',
  },
  {
    id: 'energy_full',
    name: 'Recarga Completa MAX',
    energyAmount: 'MAX',
    priceGems: 500,
    badge: 'MEJOR VALOR',
    description: 'Restaura tu barra de energía al 100% de tu capacidad máxima (20⚡ o 25⚡ con VIP).',
    cardHotspotId: 'pack_max',
    buyHotspotId: 'buy_max',
    accentColor: '#c084fc',
  },
]

export interface PixelEnergyProps {
  onBackToHome: () => void
  onOpenStreaming?: () => void
  onToggleClassic?: () => void
  onSelectTab?: (tab: 'packs' | 'pass' | 'gold' | 'energy' | 'market') => void
  onBuyEnergyPack: (packId: string) => Promise<{
    success: boolean
    energyAdded?: number
    energyCurrent?: number
    spentGems?: number
    spentGold?: number
    error?: string
  }>
  userGold?: number
  userTokens?: number
  playerEnergy?: number
  maxPlayerEnergy?: number
  userElo?: number
  onRefreshBalance?: () => void
}

export default function PixelEnergy({
  onBackToHome,
  onOpenStreaming,
  onToggleClassic,
  onSelectTab,
  onBuyEnergyPack,
  userGold = 0,
  userTokens = 0,
  playerEnergy = 20,
  maxPlayerEnergy = 20,
  userElo = 1000,
  onRefreshBalance,
}: PixelEnergyProps) {
  const [debugHotspots, setDebugHotspots] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Balances locales reactivos para actualización instantánea
  const [localEnergy, setLocalEnergy] = useState<number>(playerEnergy)
  const [localGems, setLocalGems] = useState<number>(userTokens)
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false)

  // Modales
  const [confirmPack, setConfirmPack] = useState<EnergyPackDef | null>(null)
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; icon: string } | null>(null)
  const [successModal, setSuccessModal] = useState<{ title: string; message: string; energyAdded: number; spentGems: number } | null>(null)

  useEffect(() => {
    setLocalEnergy(playerEnergy)
  }, [playerEnergy])

  useEffect(() => {
    setLocalGems(userTokens)
  }, [userTokens])

  // Desvanecer toast tras 2.6s
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 2600)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // Helpers de estilos relativos
  const calcStyle = (box: { x: number; y: number; w: number; h: number }) => ({
    left: `${(box.x / BASE_WIDTH) * 100}%`,
    top: `${(box.y / BASE_HEIGHT) * 100}%`,
    width: `${(box.w / BASE_WIDTH) * 100}%`,
    height: `${(box.h / BASE_HEIGHT) * 100}%`,
  })

  // Manejador central de clics en Hotspots
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
      else setToastMessage(`💎 Gemas: ${localGems.toLocaleString()}`)
      return
    }

    if (h.id === 'tab_energias' || h.id === 'counter_energia') {
      setToastMessage(`⚡ Energía: ${localEnergy} / ${maxPlayerEnergy} (Pantalla Activa)`)
      return
    }

    if (h.id === 'tab_comercio') {
      if (onSelectTab) onSelectTab('market')
      else setToastMessage('🤝 Comercio P2P')
      return
    }

    // Rayos decorativos
    if (h.id === 'lightning_left' || h.id === 'lightning_right' || h.id === 'hero_title') {
      soundManager.playSound('plantation', 0.4)
      setToastMessage('⚡ ¡Poder Eléctrico de la Arena! Recarga y compite en Ranked.')
      return
    }

    // Tarjeta de energía actual
    if (h.id === 'energy_status') {
      setToastMessage(`⚡ Energía actual: ${localEnergy}/${maxPlayerEnergy} disponible para Ranked`)
      return
    }

    // Compras de Packs de Energía
    if (h.id === 'buy_5' || h.id === 'pack_5' || h.id === 'tag_5') {
      handleInitiatePurchase('energy_5')
      return
    }

    if (h.id === 'buy_10' || h.id === 'pack_10' || h.id === 'tag_10') {
      handleInitiatePurchase('energy_10')
      return
    }

    if (h.id === 'buy_max' || h.id === 'pack_max' || h.id === 'tag_max') {
      handleInitiatePurchase('energy_full')
      return
    }
  }

  // Validación e inicio de compra
  const handleInitiatePurchase = (packId: string) => {
    const pkg = ENERGY_PACK_DEFS.find((p) => p.id === packId)
    if (!pkg) return

    // 1. Validar si ya está al tope y pide recarga completa
    if (pkg.id === 'energy_full' && localEnergy >= maxPlayerEnergy) {
      setAlertModal({
        title: 'ENERGÍA AL MÁXIMO',
        message: `⚡ Ya cuentas con tu energía al 100% (${localEnergy}/${maxPlayerEnergy}⚡).\nNo requieres una recarga completa en este momento.`,
        icon: '⚡',
      })
      return
    }

    // 2. Validar saldo suficiente de gemas
    if (localGems < pkg.priceGems) {
      setAlertModal({
        title: 'GEMAS INSUFICIENTES',
        message: `⚠️ No dispones de suficientes gemas para adquirir esta recarga.\n\n💎 Saldo actual: ${localGems.toLocaleString()} Gemas\n💎 Costo de la recarga: ${pkg.priceGems.toLocaleString()} Gemas\n❌ Faltan: ${(pkg.priceGems - localGems).toLocaleString()} Gemas`,
        icon: '💎',
      })
      return
    }

    // Abrir modal de confirmación
    setConfirmPack(pkg)
  }

  // Ejecución confirmada de la recarga
  const handleConfirmPurchase = async () => {
    if (!confirmPack || isPurchasing) return

    if (localGems < confirmPack.priceGems) {
      setConfirmPack(null)
      setAlertModal({
        title: 'GEMAS INSUFICIENTES',
        message: `💎 No tienes suficientes gemas para esta compra (${localGems} / ${confirmPack.priceGems} 💎).`,
        icon: '⚠️',
      })
      return
    }

    setIsPurchasing(true)
    try {
      const res = await onBuyEnergyPack(confirmPack.id)
      if (res && res.success) {
        soundManager.playSound('plantation', 0.9)

        const added = res.energyAdded ?? (confirmPack.energyAmount === 'MAX' ? maxPlayerEnergy - localEnergy : (confirmPack.energyAmount as number))
        const spent = res.spentGems ?? confirmPack.priceGems
        const nextEnergy = res.energyCurrent ?? (confirmPack.energyAmount === 'MAX' ? maxPlayerEnergy : Math.min(maxPlayerEnergy, localEnergy + added))

        // Actualización inmediata del estado local para respuesta visual instantánea (0ms)
        setLocalEnergy(nextEnergy)
        setLocalGems((prev) => Math.max(0, prev - spent))

        setConfirmPack(null)
        setSuccessModal({
          title: '¡ENERGÍA RECARGADA!',
          message: `⚡ ¡Has recargado exitosamente +${added} Energías por ${spent.toLocaleString()} Gemas 💎!\nAhora cuentas con ${nextEnergy}/${maxPlayerEnergy}⚡ para seguir combatiendo en Ranked.`,
          energyAdded: added,
          spentGems: spent,
        })

        // Refrescar balances en la app y notificar a componentes hermanos
        onRefreshBalance?.()
        window.dispatchEvent(new Event('plant_arena_profile_updated'))
      } else {
        setConfirmPack(null)
        setAlertModal({
          title: 'ERROR EN COMPRA',
          message: res?.error || 'No se pudo completar la recarga de energía.',
          icon: '⚠️',
        })
      }
    } catch (e: any) {
      setConfirmPack(null)
      setAlertModal({
        title: 'ERROR DE CONEXIÓN',
        message: e?.message || 'Ocurrió un error inesperado al procesar la compra.',
        icon: '⚠️',
      })
    } finally {
      setIsPurchasing(false)
    }
  }

  const isUnlimitedEnergy = (userElo ?? 1000) <= 1600
  const isEnergyFull = localEnergy >= maxPlayerEnergy
  const energyRatio = Math.min(1, Math.max(0, localEnergy / (maxPlayerEnergy || 20)))

  return (
    <div className="pixel-energy-container">
      <div className="pixel-energy-stage">
        {/* Fondo Pixel-Art de Energías */}
        <picture>
          <source srcSet="/game-assets/shop/screen_energias.webp" type="image/webp" />
          <img
            src="/game-assets/shop/screen_energias.png"
            alt="Tienda de Energías"
            className="pixel-energy-bg"
            draggable={false}
          />
        </picture>

        {/* Badges superiores reactivos (Oro, Gemas, Energía, Sonido) */}
        <PixelHeaderBadges
          userGold={userGold}
          userTokens={localGems}
          playerEnergy={localEnergy}
          maxPlayerEnergy={maxPlayerEnergy}
          userElo={userElo}
          goldCoords={{ x: 870, y: 31, w: 235, h: 58 }}
          gemsCoords={{ x: 1120, y: 31, w: 220, h: 58 }}
          energyCoords={{ x: 1365, y: 31, w: 180, h: 58 }}
          soundCoords={{ x: 1572, y: 31, w: 60, h: 58 }}
          energyLabel="⚡"
          baseWidth={BASE_WIDTH}
          baseHeight={BASE_HEIGHT}
          onToast={(msg) => setToastMessage(msg)}
        />

        {/* Barra de Navegación de 6 Pestañas Unificada */}
        <PixelShopTabs
          activeTab="energy"
          onSelectTab={onSelectTab}
          onOpenStreaming={onOpenStreaming}
          onToast={(msg) => setToastMessage(msg)}
          baseWidth={BASE_WIDTH}
          baseHeight={BASE_HEIGHT}
        />

        {/* Hotspots interactivos */}
        {ENERGY_HOTSPOTS.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`pixel-energy-hotspot ${debugHotspots ? 'debug' : ''} ${
              h.type === 'buy' ? 'pixel-energy-hotspot--buy' : ''
            } ${h.type === 'card' ? 'pixel-energy-hotspot--card' : ''}`}
            style={calcStyle(h)}
            onClick={() => handleHotspotClick(h)}
            title={h.label}
            aria-label={h.label}
          />
        ))}

        {/* OVERLAY DINÁMICO: Tarjeta de Energía Actual (cubre y actualiza 20/20 estático con datos reales en vivo) */}
        <div
          className="pixel-energy-live-status-card"
          style={calcStyle({ x: 1300, y: 249, w: 281, h: 133 })}
          title={
            isUnlimitedEnergy
              ? '⚡ Modo Novato (≤ 1,600 Copas): Tienes energía infinita para jugar partidas en Ranked. El límite de 20⚡ (o 25⚡ VIP) rige a partir de 1,601+ Copas.'
              : `Energía actual: ${localEnergy}/${maxPlayerEnergy}⚡`
          }
        >
          <div className="pixel-energy-live-status-inner">
            <div className="pixel-energy-live-status-icon-box">
              <span className="pixel-energy-live-status-bolt">⚡</span>
              <div className="pixel-energy-live-status-pulse" />
            </div>
            <div className="pixel-energy-live-status-info">
              <span className="pixel-energy-live-status-label">Tu energía actual:</span>
              <div className="pixel-energy-live-status-numbers">
                {isUnlimitedEnergy ? (
                  <>
                    <span className="pixel-energy-live-status-val" style={{ fontSize: 'clamp(20px, 2.2vw, 32px)' }}>∞</span>
                    <span className="pixel-energy-live-status-max"> (ILIMITADA)</span>
                  </>
                ) : (
                  <>
                    <span className="pixel-energy-live-status-val">{localEnergy}</span>
                    <span className="pixel-energy-live-status-max">/{maxPlayerEnergy}</span>
                  </>
                )}
              </div>
              <div className="pixel-energy-live-status-badge">
                {isUnlimitedEnergy ? (
                  <span className="pixel-energy-status-tag pixel-energy-status-tag--full" style={{ background: 'rgba(56, 189, 248, 0.25)', borderColor: '#38bdf8', color: '#e0f2fe' }}>
                    ✨ ARENA 1 (≤ 1600)
                  </span>
                ) : isEnergyFull ? (
                  <span className="pixel-energy-status-tag pixel-energy-status-tag--full">⚡ AL MÁXIMO</span>
                ) : (
                  <span className="pixel-energy-status-tag pixel-energy-status-tag--ready">🔄 DISPONIBLE</span>
                )}
              </div>
            </div>
          </div>
          {/* Barra de progreso de energía */}
          <div className="pixel-energy-live-progress-track">
            <div
              className={`pixel-energy-live-progress-bar ${isEnergyFull || isUnlimitedEnergy ? 'pixel-energy-live-progress-bar--full' : ''}`}
              style={{ width: isUnlimitedEnergy ? '100%' : `${energyRatio * 100}%` }}
            />
          </div>
        </div>

        {/* Toast flotante */}
        {toastMessage && (
          <div className="pixel-energy-toast">
            <span className="pixel-energy-toast-icon">⚡</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Acceso a interfaz clásica y debug */}
        <div className="pixel-energy-footer-controls">
          {onToggleClassic && (
            <button
              type="button"
              className="pixel-energy-classic-btn"
              onClick={onToggleClassic}
              title="Cambiar a vista de tienda clásica"
            >
              🎨 Clásico
            </button>
          )}
          <button
            type="button"
            className="pixel-energy-debug-btn"
            onClick={() => setDebugHotspots(!debugHotspots)}
            title="Inspeccionar zonas de clic"
          >
            {debugHotspots ? 'Ocultar Zonas' : 'Zonas'}
          </button>
        </div>
      </div>

      {/* MODAL 1: CONFIRMAR COMPRA DE ENERGÍA */}
      {confirmPack && (
        <div className="pixel-energy-modal-backdrop" onClick={() => !isPurchasing && setConfirmPack(null)}>
          <div className="pixel-energy-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pixel-energy-modal-header" style={{ borderColor: confirmPack.accentColor }}>
              <span className="pixel-energy-modal-bolt">⚡</span>
              <h2 className="pixel-energy-modal-title">CONFIRMAR RECARGA</h2>
            </div>

            <div className="pixel-energy-confirm-body">
              <div className="pixel-energy-confirm-pack-badge" style={{ borderColor: confirmPack.accentColor, color: confirmPack.accentColor }}>
                {confirmPack.badge}
              </div>

              <div className="pixel-energy-confirm-hero">
                <div className="pixel-energy-confirm-hero-icon" style={{ textShadow: `0 0 24px ${confirmPack.accentColor}` }}>
                  ⚡
                </div>
                <div className="pixel-energy-confirm-hero-amount">
                  {confirmPack.energyAmount === 'MAX' ? 'RECARGA AL MÁXIMO' : `+${confirmPack.energyAmount} ENERGÍAS`}
                </div>
                <div className="pixel-energy-confirm-hero-name">{confirmPack.name}</div>
                <div className="pixel-energy-confirm-hero-desc">{confirmPack.description}</div>
              </div>

              <div className="pixel-energy-confirm-breakdown">
                <div className="pixel-energy-confirm-row">
                  <span>Costo de la Recarga:</span>
                  <strong className="pixel-energy-confirm-cost">{confirmPack.priceGems.toLocaleString()} 💎 Gemas</strong>
                </div>

                <div className="pixel-energy-confirm-row">
                  <span>Tu Saldo Actual:</span>
                  <span>{localGems.toLocaleString()} 💎</span>
                </div>

                <div className="pixel-energy-confirm-row">
                  <span>Energía tras la recarga:</span>
                  <strong className="pixel-energy-confirm-next-val">
                    {localEnergy} ⚡ ➔ {confirmPack.energyAmount === 'MAX' ? maxPlayerEnergy : Math.min(maxPlayerEnergy, localEnergy + (confirmPack.energyAmount as number))} / {maxPlayerEnergy} ⚡
                  </strong>
                </div>

                <div className="pixel-energy-confirm-row pixel-energy-confirm-row--highlight">
                  <span>Saldo Restante:</span>
                  <strong>{Math.max(0, localGems - confirmPack.priceGems).toLocaleString()} 💎</strong>
                </div>
              </div>

              <div className="pixel-energy-modal-actions">
                <button
                  type="button"
                  className="pixel-energy-modal-btn pixel-energy-modal-btn--cancel"
                  onClick={() => setConfirmPack(null)}
                  disabled={isPurchasing}
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  className="pixel-energy-modal-btn pixel-energy-modal-btn--buy"
                  onClick={handleConfirmPurchase}
                  disabled={isPurchasing}
                >
                  {isPurchasing ? '⏳ RECARGANDO...' : `⚡ COMPRAR POR ${confirmPack.priceGems} 💎`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ALERTA (Gemas Insuficientes o Energía al Máximo) */}
      {alertModal && (
        <div className="pixel-energy-modal-backdrop pixel-energy-modal-backdrop--alert" onClick={() => setAlertModal(null)}>
          <div className="pixel-energy-modal-card pixel-energy-modal-card--alert" onClick={(e) => e.stopPropagation()}>
            <div className="pixel-energy-modal-header pixel-energy-modal-header--alert">
              <span className="pixel-energy-alert-icon">{alertModal.icon}</span>
              <h2 className="pixel-energy-modal-title">{alertModal.title}</h2>
            </div>
            <div className="pixel-energy-modal-body">
              <p className="pixel-energy-modal-text">{alertModal.message}</p>
            </div>
            <div className="pixel-energy-modal-actions">
              <button
                type="button"
                className="pixel-energy-modal-btn pixel-energy-modal-btn--alert-ok"
                onClick={() => setAlertModal(null)}
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ÉXITO DE RECARGA */}
      {successModal && (
        <div className="pixel-energy-modal-backdrop pixel-energy-modal-backdrop--success" onClick={() => setSuccessModal(null)}>
          <div className="pixel-energy-modal-card pixel-energy-modal-card--success" onClick={(e) => e.stopPropagation()}>
            <div className="pixel-energy-modal-header pixel-energy-modal-header--success">
              <span className="pixel-energy-success-icon">⚡</span>
              <h2 className="pixel-energy-modal-title">{successModal.title}</h2>
            </div>
            <div className="pixel-energy-modal-body">
              <div className="pixel-energy-success-hero">
                <div className="pixel-energy-success-bolt">⚡</div>
                <div className="pixel-energy-success-amount">+{successModal.energyAdded} ENERGÍAS</div>
              </div>
              <p className="pixel-energy-modal-text">{successModal.message}</p>
            </div>
            <div className="pixel-energy-modal-actions">
              <button
                type="button"
                className="pixel-energy-modal-btn pixel-energy-modal-btn--success-ok"
                onClick={() => setSuccessModal(null)}
              >
                ¡A COMBATIR EN RANKED! ⚡
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
