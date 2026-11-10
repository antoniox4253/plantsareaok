import { useState, useMemo } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  getStoryProgress,
  getStoryLevelConfig,
  type StoryProgress,
  type StoryWaveConfig,
} from '../../utils/mapaches/mapachesLevels'
import type { MapacheKey } from '../../utils/mapaches/mapachesData'
import type { PlantId, PlantCardInstance } from '../../types/game'
import { PLANT_CONFIGS, getScaledPlantConfig } from '../../utils/gameConstants'
import './StoryModeModal.css'

interface StoryModeModalProps {
  isOpen: boolean
  onClose: () => void
  onStartLevel: (level: number) => void
  activeDeck?: PlantId[]
  plantInstances?: PlantCardInstance[]
  onOpenCollection?: () => void
}

const MAPACHE_INFO: Record<string, { name: string; role: string; icon: string; desc: string }> = {
  pumpum: {
    name: 'PumPum',
    role: 'Artillero Cañón',
    icon: '💣',
    desc: 'Dispara balas explosivas desde 3 casillas.',
  },
  garritas: {
    name: 'Garritas',
    role: 'Rasguñador Ágil',
    icon: '🐾',
    desc: 'Se agazapa a gran velocidad y salta sobre defensas.',
  },
  punos: {
    name: 'Puños',
    role: 'Boxeador Pesado',
    icon: '🥊',
    desc: 'Golpea sin cesar; cada 5 golpes entra en FURIA a doble velocidad.',
  },
  navajas: {
    name: 'Navajas',
    role: 'Lanzador Cuchillos',
    icon: '🗡️',
    desc: 'Arroja veloces cuchillos en línea recta con chispas.',
  },
  reygarra: {
    name: 'Rey Garra',
    role: 'Jefe Supremo',
    icon: '👑',
    desc: 'Patrulla carriles, ruge para potenciar a los mapaches e invoca refuerzos.',
  },
}

export default function StoryModeModal({
  isOpen,
  onClose,
  onStartLevel,
  activeDeck = ['sunflower', 'peashooter', 'wallnut', 'repeater', 'bonkchoy', 'chomper'],
  plantInstances = [],
  onOpenCollection,
}: StoryModeModalProps) {
  const [progress] = useState<StoryProgress>(() => getStoryProgress())
  const [selectedLevel, setSelectedLevel] = useState<number>(() => {
    const p = getStoryProgress()
    return Math.min(20, Math.max(1, p.maxUnlockedLevel))
  })

  const currentLevelConfig = useMemo(() => {
    return getStoryLevelConfig(selectedLevel)
  }, [selectedLevel])

  if (!isOpen) return null

  const handleSelectLevel = (lvl: number) => {
    if (lvl > progress.maxUnlockedLevel) {
      soundManager.playSound('click', 0.2)
      return
    }
    soundManager.playSound('click', 0.4)
    setSelectedLevel(lvl)
  }

  const handleStart = () => {
    soundManager.playSound('click', 0.5)
    onClose()
    onStartLevel(selectedLevel)
  }


  return (
    <div className="story-modal-backdrop" onClick={onClose}>
      <div className="story-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="story-modal-header">
          <div className="story-modal-title-box">
            <span className="story-modal-icon">🦝</span>
            <div>
              <h2 className="story-modal-title">MODO HISTORIA: LA INVASIÓN MAPACHE</h2>
              <p className="story-modal-subtitle">
                20 Niveles Épicos · Derrota al Rey Garra y sus 4 mapaches en 3 oleadas con tus plantas
              </p>
            </div>
          </div>
          <button
            type="button"
            className="story-modal-close-btn"
            onClick={onClose}
            title="Cerrar Modo Historia"
          >
            ✕
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL: GRID DE NIVELES Y PANEL DE DETALLE */}
        <div className="story-modal-body">
          {/* COLUMNA IZQUIERDA: SELECTOR DE 20 NIVELES */}
          <div className="story-levels-panel">
            <div className="story-levels-panel__title">
              <span>🗺️ MAPA DE NIVELES (1 - 20)</span>
              <span className="story-levels-progress-badge">
                {progress.completedLevels.length} / 20 Superados
              </span>
            </div>

            <div className="story-levels-grid">
              {Array.from({ length: 20 }, (_, idx) => {
                const lvl = idx + 1
                const isUnlocked = lvl <= progress.maxUnlockedLevel
                const isCompleted = progress.completedLevels.includes(lvl)
                const isCurrent = lvl === selectedLevel
                const stars = progress.levelStars[lvl] || 0

                return (
                  <button
                    key={lvl}
                    type="button"
                    className={`story-level-node ${
                      isCurrent ? 'story-level-node--active' : ''
                    } ${isCompleted ? 'story-level-node--completed' : ''} ${
                      !isUnlocked ? 'story-level-node--locked' : ''
                    } ${lvl % 5 === 0 ? 'story-level-node--boss' : ''}`}
                    onClick={() => handleSelectLevel(lvl)}
                    disabled={!isUnlocked}
                    title={
                      isUnlocked
                        ? `Nivel ${lvl}${isCompleted ? ' (Completado)' : ''}`
                        : `Nivel ${lvl} (Bloqueado)`
                    }
                  >
                    <span className="story-level-node__num">
                      {lvl % 5 === 0 ? '👑 ' : ''}
                      {lvl}
                    </span>
                    {!isUnlocked ? (
                      <span className="story-level-node__lock">🔒</span>
                    ) : isCompleted ? (
                      <div className="story-level-node__stars">
                        {'⭐'.repeat(stars || 1)}
                      </div>
                    ) : (
                      <span className="story-level-node__new">¡NUEVO!</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* COLUMNA DERECHA: BRIEFING DEL NIVEL SELECCIONADO */}
          <div className="story-briefing-panel">
            <div className="story-briefing-card">
              <div className="story-briefing-header">
                <div>
                  <div className="story-briefing-badge">
                    NIVEL {currentLevelConfig.level} · 3 OLEADAS
                  </div>
                  <h3 className="story-briefing-title">{currentLevelConfig.title}</h3>
                </div>
                <div className="story-briefing-difficulty">
                  <span>Dificultad:</span>
                  <div className="story-briefing-difficulty-bar">
                    <div
                      className="story-briefing-difficulty-fill"
                      style={{ width: `${Math.min(100, (currentLevelConfig.level / 20) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="story-briefing-desc">{currentLevelConfig.description}</p>

              {/* ENEMIGOS QUE APARECEN EN ESTE NIVEL */}
              <div className="story-enemies-section">
                <div className="story-section-label">MAPACHES ENEMIGOS EN ESTE NIVEL:</div>
                <div className="story-enemies-chips">
                  {currentLevelConfig.allowedMapaches.map((key: MapacheKey) => {
                    const info = MAPACHE_INFO[key]
                    if (!info) return null
                    return (
                      <div key={key} className="story-enemy-chip" title={info.desc}>
                        <span className="story-enemy-chip__icon">{info.icon}</span>
                        <div className="story-enemy-chip__info">
                          <strong>{info.name}</strong>
                          <small>{info.role}</small>
                        </div>
                      </div>
                    )
                  })}
                  {/* El Jefe Rey Garra siempre sale en la 3era oleada */}
                  <div className="story-enemy-chip story-enemy-chip--boss" title={MAPACHE_INFO.reygarra.desc}>
                    <span className="story-enemy-chip__icon">👑</span>
                    <div className="story-enemy-chip__info">
                      <strong>Rey Garra</strong>
                      <small>Jefe Final (Oleada 3)</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* RESUMEN DE LAS 3 OLEADAS */}
              <div className="story-waves-preview">
                <div className="story-section-label">ESTRUCTURA DE COMBATE (3 OLEADAS):</div>
                <div className="story-waves-list">
                  {currentLevelConfig.waves.map((w: StoryWaveConfig) => (
                    <div
                      key={w.waveNumber}
                      className={`story-wave-item ${w.hasBoss ? 'story-wave-item--boss' : ''}`}
                    >
                      <span className="story-wave-item__num">
                        {w.hasBoss ? '👑' : `O${w.waveNumber}`}
                      </span>
                      <div className="story-wave-item__texts">
                        <strong>{w.title}</strong>
                        <small>{w.subtitle}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RECOMPENSAS AL VENCER */}
              <div className="story-rewards-box">
                <span className="story-rewards-label">Recompensas al vencer:</span>
                <div className="story-rewards-pills">
                  <span className="story-reward-pill story-reward-pill--gold">
                    🪙 +{currentLevelConfig.rewards.gold} Oro
                  </span>
                  <span className="story-reward-pill story-reward-pill--gems">
                    💎 +{currentLevelConfig.rewards.gems} Gemas
                  </span>
                  {currentLevelConfig.rewards.tokens > 0 && (
                    <span className="story-reward-pill story-reward-pill--tokens">
                      🌱 +{currentLevelConfig.rewards.tokens} PLANTS
                    </span>
                  )}
                </div>
              </div>

              {/* TU MAZO ACTIVO */}
              <div className="story-deck-preview">
                <div className="story-deck-header">
                  <span className="story-section-label">TU MAZO PARA COMBATE:</span>
                  {onOpenCollection && (
                    <button
                      type="button"
                      className="story-deck-edit-btn"
                      onClick={() => {
                        soundManager.playSound('click', 0.3)
                        onClose()
                        onOpenCollection()
                      }}
                    >
                      ✏️ Cambiar Mazo
                    </button>
                  )}
                </div>
                <div className="story-deck-cards">
                  {activeDeck.slice(0, 6).map((plantId) => {
                    const inst = plantInstances.find((i) => i.plantId === plantId)
                    const scaled = getScaledPlantConfig(
                      plantId,
                      inst?.statRolls || [],
                      inst?.equippedItem,
                      inst?.isGolden
                    )
                    const cfg = PLANT_CONFIGS[plantId] || scaled
                    return (
                      <div
                        key={plantId}
                        className="story-deck-card-mini"
                        title={`${scaled.name} (Coste: ☀️ ${scaled.cost})`}
                      >
                        <img
                          src={scaled.packetActive || cfg?.icon || cfg?.sprite}
                          alt={scaled.name}
                        />
                        <span className="story-deck-card-cost">☀️{scaled.cost}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* BOTÓN DE ACCIÓN */}
              <button
                type="button"
                className="story-launch-btn"
                onClick={handleStart}
              >
                ⚔️ ENTRAR AL COMBATE · NIVEL {currentLevelConfig.level}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
