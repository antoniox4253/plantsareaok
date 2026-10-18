import { useState, useMemo, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import { BATTLE_PASS_LEVELS, type PassLevel } from '../../utils/battlePassManager'
import './PixelVipPass.css'

export interface PixelVipPassHotspot {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  type: 'button' | 'tab' | 'counter' | 'buy'
}

const VIP_HOTSPOTS: PixelVipPassHotspot[] = [
  { id: 'menu', label: 'Menú', x: 60, y: 24, w: 156, h: 62, type: 'button' },
  { id: 'tab_sobres', label: 'Sobres de Semillas', x: 244, y: 100, w: 280, h: 54, type: 'tab' },
  { id: 'tab_vip', label: 'Pase VIP', x: 541, y: 99, w: 185, h: 55, type: 'tab' },
  { id: 'tab_oro_emotes', label: 'Oro & Emotes', x: 746, y: 100, w: 219, h: 54, type: 'tab' },
  { id: 'tab_energias', label: 'Energías', x: 982, y: 99, w: 197, h: 55, type: 'tab' },
  { id: 'tab_comercio', label: 'Comercio P2P', x: 1200, y: 98, w: 208, h: 56, type: 'tab' },
  { id: 'tab_stream', label: 'Cuentas Stream VIP', x: 1420, y: 98, w: 190, h: 56, type: 'tab' },
  { id: 'counter_oro', label: 'Contador Oro', x: 892, y: 22, w: 186, h: 65, type: 'counter' },
  { id: 'counter_gemas', label: 'Contador Gemas', x: 1094, y: 22, w: 208, h: 65, type: 'counter' },
  { id: 'counter_energia', label: 'Contador Energía', x: 1328, y: 21, w: 188, h: 65, type: 'counter' },
  { id: 'sound', label: 'Sonido', x: 1570, y: 16, w: 75, h: 75, type: 'button' },
]

export interface PixelVipPassProps {
  onBackToHome: () => void
  onOpenStreaming?: () => void
  onToggleClassic?: () => void
  onSelectTab?: (tab: 'packs' | 'pass' | 'gold' | 'energy' | 'market') => void
  userGold?: number
  userTokens?: number
  playerEnergy?: number
  userXp?: number
  hasVipPass: boolean
  claimedVipLevels: number[]
  onBuyVipPass: () => void
  onClaimReward: (level: PassLevel) => void
  onClaimAllRewards?: (levels: PassLevel[]) => void
}

export default function PixelVipPass({
  onBackToHome,
  onOpenStreaming,
  onToggleClassic,
  onSelectTab,
  userGold,
  userTokens,
  playerEnergy,
  userXp = 0,
  hasVipPass,
  claimedVipLevels = [],
  onBuyVipPass,
  onClaimReward,
  onClaimAllRewards,
}: PixelVipPassProps) {
  const [debugHotspots, setDebugHotspots] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const currentXp = userXp ?? 0

  // Niveles listos para cobrar
  const claimableLevels = useMemo(() => {
    return hasVipPass
      ? BATTLE_PASS_LEVELS.filter(
          (l) => currentXp >= l.requiredXp && !claimedVipLevels.includes(l.level)
        )
      : []
  }, [hasVipPass, currentXp, claimedVipLevels])

  // Nivel seleccionado por defecto: el primer listo para cobrar, o nivel 1
  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(() => {
    if (claimableLevels.length > 0) return claimableLevels[0].level
    const reached = BATTLE_PASS_LEVELS.filter((l) => currentXp >= l.requiredXp).length
    if (reached > 0) return Math.min(20, reached)
    return 1
  })

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 2800)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const selectedPassLvl =
    BATTLE_PASS_LEVELS.find((l) => l.level === selectedLevelNum) || BATTLE_PASS_LEVELS[0]

  const isSelectedClaimed = claimedVipLevels.includes(selectedPassLvl.level)
  const isSelectedUnlocked = currentXp >= selectedPassLvl.requiredXp
  const isSelectedClaimable = hasVipPass && isSelectedUnlocked && !isSelectedClaimed
  const isSelectedPendingVip = !hasVipPass && isSelectedUnlocked

  const handleClaimAll = () => {
    if (claimableLevels.length === 0) return
    soundManager.playSound('plantation', 0.9)
    if (onClaimAllRewards) {
      onClaimAllRewards(claimableLevels)
    } else {
      claimableLevels.forEach((lvl) => onClaimReward(lvl))
    }
  }

  const handleHotspotClick = (h: PixelVipPassHotspot) => {
    soundManager.playSound('click', 0.5)

    if (h.id === 'menu') {
      onBackToHome()
      return
    }

    if (h.id === 'sound') {
      soundManager.toggleMute()
      const isMuted = soundManager.isMuted()
      setToastMessage(isMuted ? '🔇 Música Silenciada' : '🔊 Música Activada')
      return
    }

    if (h.id === 'tab_stream') {
      if (onOpenStreaming) {
        onOpenStreaming()
      } else {
        setToastMessage('🎬 Cuentas Stream VIP')
      }
      return
    }

    if (h.id === 'tab_sobres') {
      if (onSelectTab) {
        onSelectTab('packs')
      } else {
        setToastMessage('🎒 Sobres de Semillas')
      }
      return
    }

    if (h.id === 'tab_vip') {
      setToastMessage('👑 Pase VIP (Pantalla Activa)')
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

    setToastMessage(`✨ ${h.label}`)
  }

  return (
    <div className="pixel-vippass-root">
      {/* Barra de utilidades para desarrollador / pruebas */}
      <div className="pixel-vippass-dev-bar">
        <button
          type="button"
          className={`pixel-vippass-dev-btn ${debugHotspots ? 'pixel-vippass-dev-btn--active' : ''}`}
          onClick={() => setDebugHotspots(!debugHotspots)}
          title="Ver o inspeccionar áreas interactivas del diseño"
        >
          {debugHotspots ? 'Ocultar Zonas' : '🎯 Zonas'}
        </button>
        {onToggleClassic && (
          <button
            type="button"
            className="pixel-vippass-dev-btn"
            onClick={onToggleClassic}
            title="Alternar a vista clásica"
          >
            Modo Clásico
          </button>
        )}
      </div>

      {/* Arte de fondo pixel-perfect */}
      <picture>
        <source srcSet="/game-assets/shop/pase_vip_fondo.webp" type="image/webp" />
        <img
          src="/game-assets/shop/pase_vip_fondo.png"
          alt="Pase VIP Plant Arena"
          className="pixel-vippass-art"
        />
      </picture>

      {/* Hotspots de Navegación y Cabecera */}
      {VIP_HOTSPOTS.map((h) => (
        <button
          key={h.id}
          type="button"
          className={`pixel-vippass-hotspot ${debugHotspots ? 'pixel-vippass-hotspot--debug' : ''}`}
          style={{
            left: `calc(${h.x} / 1672 * 100%)`,
            top: `calc(${h.y} / 941 * 100%)`,
            width: `calc(${h.w} / 1672 * 100%)`,
            height: `calc(${h.h} / 941 * 100%)`,
          }}
          title={h.label}
          aria-label={h.label}
          onClick={() => handleHotspotClick(h)}
        />
      ))}

      {/* Botón Comprar Pase VIP / Insignia Activo */}
      {hasVipPass ? (
        <div
          className="pixel-vippass-active-badge"
          title="Pase VIP Activo: Beneficios y recompensas completas"
          onClick={() => setToastMessage('👑 ¡Pase VIP Activo en tu cuenta!')}
        >
          <span>👑</span>
          <span>PASE VIP ACTIVADO ✓</span>
        </div>
      ) : (
        <button
          type="button"
          className={`pixel-vippass-buy-hotspot ${debugHotspots ? 'pixel-vippass-hotspot--debug' : ''}`}
          title="Comprar Pase VIP por 2,500 Gemas"
          aria-label="Comprar Pase VIP"
          onClick={() => {
            soundManager.playSound('click', 0.5)
            onBuyVipPass()
          }}
        />
      )}

      {/* PANEL DE RECOMPENSAS (20 NIVELES DESPLAZABLE) */}
      <div className="pixel-vippass-reward-panel">
        <div className="pixel-vippass-r-heading">
          <div>
            <h2 className="pixel-vippass-r-title">🏆 CAMINO DE RECOMPENSAS · 20 NIVELES</h2>
            <small className="pixel-vippass-r-sub">
              Toca cualquier nivel para inspeccionar su premio con su aspecto original
            </small>
          </div>

          <div className="pixel-vippass-r-right">
            <span className="pixel-vippass-xp-badge">
              ⚡ {currentXp.toLocaleString('es-ES')} / 8.000 XP
            </span>
            {claimableLevels.length > 1 && (
              <button
                type="button"
                className="pixel-vippass-claim-all-btn"
                onClick={handleClaimAll}
              >
                ✨ RECLAMAR TODOS ({claimableLevels.length})
              </button>
            )}
          </div>
        </div>

        <div className="pixel-vippass-rewards-scroll">
          <div className="pixel-vippass-reward-grid">
            {BATTLE_PASS_LEVELS.map((lvl) => {
              const isClaimed = claimedVipLevels.includes(lvl.level)
              const isUnlocked = currentXp >= lvl.requiredXp
              const isClaimable = hasVipPass && isUnlocked && !isClaimed
              const isPendingVip = !hasVipPass && isUnlocked
              const isLocked = !isUnlocked
              const isSelected = selectedLevelNum === lvl.level

              return (
                <button
                  key={lvl.level}
                  type="button"
                  className={`pixel-vippass-card ${isSelected ? 'pixel-vippass-card--selected' : ''} ${isClaimable ? 'pixel-vippass-card--claimable' : ''} ${isClaimed ? 'pixel-vippass-card--claimed' : ''} ${isLocked ? 'pixel-vippass-card--locked' : ''}`}
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setSelectedLevelNum(lvl.level)
                  }}
                  title={`Nivel ${lvl.level}: ${lvl.reward.label} — ${lvl.requiredXp} XP`}
                >
                  <div className="pixel-vippass-card__top">
                    <span className="pixel-vippass-card__lvl">LVL {lvl.level}</span>
                    <span className="pixel-vippass-card__status">
                      {isClaimed ? '✅' : isClaimable ? '⭐' : isPendingVip ? '👑' : '🔒'}
                    </span>
                  </div>

                  <div className="pixel-vippass-card__thumb-wrap">
                    <img
                      src={lvl.reward.icon}
                      alt={lvl.reward.label}
                      className="pixel-vippass-card__thumb"
                      loading="lazy"
                    />
                  </div>

                  <span className="pixel-vippass-card__xp">
                    {lvl.requiredXp.toLocaleString('es-ES')} XP
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* PANEL DE RECOMPENSA DESTACADA (FEATURED) */}
      <div className="pixel-vippass-featured">
        <div className="pixel-vippass-featured__title">
          👑 RECOMPENSA DESTACADA · NIVEL {selectedPassLvl.level}
        </div>

        <div className="pixel-vippass-featured__row">
          <div className="pixel-vippass-featured__big-icon">
            <img
              src={selectedPassLvl.reward.icon}
              alt={selectedPassLvl.reward.label}
              className="pixel-vippass-featured__img"
            />
            {selectedPassLvl.reward.secondaryIcon && (
              <div
                className="pixel-vippass-featured__secondary-badge"
                title={selectedPassLvl.reward.secondaryLabel || 'Premio Adicional'}
              >
                <img
                  src={selectedPassLvl.reward.secondaryIcon}
                  alt={selectedPassLvl.reward.secondaryLabel || 'Premio Adicional'}
                />
              </div>
            )}
          </div>

          <div className="pixel-vippass-featured__details">
            <span
              className={`pixel-vippass-tag ${
                isSelectedClaimed
                  ? 'pixel-vippass-tag--claimed'
                  : isSelectedClaimable
                  ? 'pixel-vippass-tag--claimable'
                  : isSelectedPendingVip
                  ? 'pixel-vippass-tag--vip'
                  : 'pixel-vippass-tag--locked'
              }`}
            >
              {isSelectedClaimed
                ? '✅ RECLAMADO'
                : isSelectedClaimable
                ? '⭐ LISTO PARA RECLAMAR'
                : isSelectedPendingVip
                ? '👑 REQUIERE PASE VIP'
                : '🔒 BLOQUEADO'}
            </span>

            <div className="pixel-vippass-item-name" title={selectedPassLvl.reward.label}>
              {selectedPassLvl.reward.label}
            </div>

            <div className="pixel-vippass-req">
              Requiere {selectedPassLvl.requiredXp.toLocaleString('es-ES')} XP
              {isSelectedUnlocked
                ? ' · ¡XP Alcanzada!'
                : ` · Faltan ${(selectedPassLvl.requiredXp - currentXp).toLocaleString('es-ES')} XP`}
            </div>

            {/* Acciones interactivas directas */}
            {isSelectedClaimable && (
              <button
                type="button"
                className="pixel-vip-action-btn pixel-vippass-action-btn--claim"
                onClick={() => {
                  soundManager.playSound('plantation', 0.8)
                  onClaimReward(selectedPassLvl)
                }}
              >
                🎁 RECLAMAR ESTA RECOMPENSA
              </button>
            )}

            {isSelectedPendingVip && (
              <button
                type="button"
                className="pixel-vip-action-btn pixel-vippass-action-btn--buy"
                onClick={() => {
                  soundManager.playSound('click', 0.5)
                  onBuyVipPass()
                }}
              >
                👑 ACTIVAR PASE VIP (2,500 💎)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast informativo */}
      {toastMessage && <div className="pixel-vippass-toast">{toastMessage}</div>}
    </div>
  )
}
