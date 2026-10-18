import { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import monedaImg from '../../assets/ico/moneda.webp'
import './PixelHeaderBadges.css'

export interface HotspotBox {
  x: number
  y: number
  w: number
  h: number
}

export interface PixelHeaderBadgesProps {
  userGold?: number
  userTokens?: number
  playerEnergy?: number
  maxPlayerEnergy?: number
  userElo?: number
  goldCoords: HotspotBox
  gemsCoords: HotspotBox
  energyCoords: HotspotBox
  soundCoords: HotspotBox
  baseWidth?: number
  baseHeight?: number
  onSelectTab?: (tab: 'gold' | 'energy') => void
  onToast?: (message: string) => void
}

export default function PixelHeaderBadges({
  userGold = 0,
  userTokens = 0,
  playerEnergy = 20,
  maxPlayerEnergy = 20,
  userElo = 1000,
  goldCoords,
  gemsCoords,
  energyCoords,
  soundCoords,
  baseWidth = 1672,
  baseHeight = 941,
  onSelectTab,
  onToast,
}: PixelHeaderBadgesProps) {
  const [isMuted, setIsMuted] = useState<boolean>(() => soundManager.isMuted())

  useEffect(() => {
    // Sincronizar estado inicial de mute
    setIsMuted(soundManager.isMuted())
  }, [])

  const calcStyle = (box: HotspotBox) => ({
    left: `${(box.x / baseWidth) * 100}%`,
    top: `${(box.y / baseHeight) * 100}%`,
    width: `${(box.w / baseWidth) * 100}%`,
    height: `${(box.h / baseHeight) * 100}%`,
  })

  const handleToggleSound = () => {
    soundManager.toggleMute()
    const nextMuted = soundManager.isMuted()
    setIsMuted(nextMuted)
    if (!nextMuted) {
      soundManager.playSound('click', 0.5)
    }
    if (onToast) {
      onToast(nextMuted ? '🔇 Música Silenciada' : '🔊 Música Activada')
    }
  }

  const handleGoldClick = () => {
    soundManager.playSound('click', 0.4)
    if (onSelectTab) {
      onSelectTab('gold')
    } else if (onToast) {
      onToast(`💰 Monedas de Oro: ${userGold.toLocaleString()} ORO`)
    }
  }

  const handleGemsClick = () => {
    soundManager.playSound('click', 0.4)
    if (onSelectTab) {
      onSelectTab('gold')
    } else if (onToast) {
      onToast(`💎 Gemas disponibles: ${userTokens.toLocaleString()}`)
    }
  }

  const handleEnergyClick = () => {
    soundManager.playSound('click', 0.4)
    if (onSelectTab) {
      onSelectTab('energy')
    } else if (onToast) {
      onToast(
        userElo <= 1602
          ? '⚡ Energía ilimitada en rango novato (≤ 1602 copas)'
          : `⚡ Energía: ${playerEnergy} / ${maxPlayerEnergy}`
      )
    }
  }

  const isNovato = userElo <= 1602
  const energyDisplay = isNovato ? '∞' : `${playerEnergy}/${maxPlayerEnergy}`

  return (
    <>
      {/* 💰 Contador de Oro en vivo */}
      <div
        className="pixel-header-badge pixel-header-badge--gold"
        style={calcStyle(goldCoords)}
        onClick={handleGoldClick}
        title="Monedas de Oro disponibles (Clic para ver Bóveda)"
      >
        <img src={monedaImg} alt="Oro" className="pixel-header-badge__gold-icon" />
        <span className="pixel-header-badge__val pixel-header-badge__val--gold">
          {userGold.toLocaleString()}
        </span>
        <span className="pixel-header-badge__lbl pixel-header-badge__lbl--gold">ORO</span>
      </div>

      {/* 💎 Contador de Gemas en vivo */}
      <div
        className="pixel-header-badge pixel-header-badge--gems"
        style={calcStyle(gemsCoords)}
        onClick={handleGemsClick}
        title="Gemas disponibles (Clic para ver Tienda de Gemas)"
      >
        <span className="pixel-header-badge__gem-icon">💎</span>
        <span className="pixel-header-badge__val pixel-header-badge__val--gems">
          {userTokens.toLocaleString()}
        </span>
        <span className="pixel-header-badge__lbl pixel-header-badge__lbl--gems">Gemas</span>
      </div>

      {/* ⚡ Contador de Energía en vivo */}
      <div
        className="pixel-header-badge pixel-header-badge--energy"
        style={calcStyle(energyCoords)}
        onClick={handleEnergyClick}
        title={
          isNovato
            ? '⚡ Energía ilimitada en rango novato (≤ 1602 copas)'
            : `⚡ Energía diaria: ${playerEnergy}/${maxPlayerEnergy} (Clic para Recargar)`
        }
      >
        <span className="pixel-header-badge__energy-icon">⚡</span>
        <span className="pixel-header-badge__val pixel-header-badge__val--energy">
          {energyDisplay}
        </span>
        <span className="pixel-header-badge__lbl pixel-header-badge__lbl--energy">
          {isNovato ? 'Novato' : 'Energía'}
        </span>
      </div>

      {/* 🔊 / 🔇 Botón de Sonido en vivo */}
      <button
        type="button"
        className={`pixel-header-sound-btn ${
          isMuted ? 'pixel-header-sound-btn--muted' : 'pixel-header-sound-btn--active'
        }`}
        style={calcStyle(soundCoords)}
        onClick={handleToggleSound}
        title={isMuted ? '🔇 Música Silenciada (Clic para Activar)' : '🔊 Música Activada (Clic para Silenciar)'}
        aria-label={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
      >
        <span className="pixel-header-sound-btn__icon">{isMuted ? '🔇' : '🔊'}</span>
      </button>
    </>
  )
}
