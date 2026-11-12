import { useState, useMemo, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  getStoryLevelConfig,
  getActiveStoryExpedition,
  clearActiveStoryExpedition,
  startStoryExpedition,
  STORY_MODE_ENTRY_FEE_GEMS,
  type StoryExpeditionRun,
  type StoryWaveConfig,
} from '../../utils/mapaches/mapachesLevels'
import type { MapacheKey } from '../../utils/mapaches/mapachesData'
import type { PlantId, PlantCardInstance } from '../../types/game'
import { PLANT_CONFIGS, getScaledPlantConfig } from '../../utils/gameConstants'
import { storyModeService } from '../../services/storyModeService'
import './StoryModeModal.css'

interface StoryModeModalProps {
  isOpen: boolean
  onClose: () => void
  onStartLevel: (level: number, runId?: string) => void
  userGems?: number
  onDeductGems?: (amount: number) => void
  activeDeck?: PlantId[]
  activeDeckInstances?: string[]
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
  userGems = 0,
  onDeductGems,
  activeDeck = ['sunflower', 'peashooter', 'wallnut', 'repeater', 'bonkchoy', 'chomper'],
  activeDeckInstances = [],
  plantInstances = [],
  onOpenCollection,
}: StoryModeModalProps) {
  const [activeExpedition, setActiveExpedition] = useState<StoryExpeditionRun | null>(() => getActiveStoryExpedition())
  const [selectedLevel, setSelectedLevel] = useState<number>(1)
  const [showAbandonConfirm, setShowAbandonConfirm] = useState<boolean>(false)
  const [isEntering, setIsEntering] = useState<boolean>(false)

  useEffect(() => {
    if (isOpen) {
      const exp = getActiveStoryExpedition()
      setActiveExpedition(exp)
      if (exp) {
        setSelectedLevel(exp.currentLevel)
      } else {
        setSelectedLevel(1)
      }
      setShowAbandonConfirm(false)
    }
  }, [isOpen])

  const maxUnlockedLevel = activeExpedition ? activeExpedition.currentLevel : 1

  const currentLevelConfig = useMemo(() => {
    return getStoryLevelConfig(selectedLevel)
  }, [selectedLevel])

  if (!isOpen) return null

  const handleSelectLevel = (lvl: number) => {
    if (lvl > maxUnlockedLevel) {
      soundManager.playSound('click', 0.2)
      return
    }
    soundManager.playSound('click', 0.4)
    setSelectedLevel(lvl)
  }

  const handleStart = async () => {
    soundManager.playSound('click', 0.5)
    if (!activeExpedition) {
      if (userGems < STORY_MODE_ENTRY_FEE_GEMS) {
        alert(`Gemas insuficientes. Se requieren ${STORY_MODE_ENTRY_FEE_GEMS} Gemas 💎 para entrar al Modo Historia.`)
        return
      }
      setIsEntering(true)
      try {
        const res = await storyModeService.enterStoryMode()
        if (!res.success) {
          alert(res.error || 'No se pudo iniciar la expedición.')
          setIsEntering(false)
          return
        }
        onDeductGems?.(STORY_MODE_ENTRY_FEE_GEMS)
        const newRun = startStoryExpedition(res.runId || `story_${Date.now()}`)
        setActiveExpedition(newRun)
        onClose()
        onStartLevel(1, newRun.runId)
      } catch (err: any) {
        alert(err?.message || 'Error al conectar con el servidor')
      } finally {
        setIsEntering(false)
      }
    } else {
      onClose()
      onStartLevel(activeExpedition.currentLevel, activeExpedition.runId)
    }
  }

  const handleConfirmAbandon = async () => {
    if (!activeExpedition) return
    soundManager.playSound('click', 0.4)
    await storyModeService.abandonRun(activeExpedition.runId)
    clearActiveStoryExpedition()
    setActiveExpedition(null)
    setSelectedLevel(1)
    setShowAbandonConfirm(false)
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
                Expedición de 20 Niveles continuos · 50 💎 Entrada · Hasta 5 Token PLANTS/nivel + Bono Doradas
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

        {/* BANNER DE EXPEDICIÓN ACTIVA SI EXISTE */}
        {activeExpedition && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(59, 130, 246, 0.25))',
            borderBottom: '1px solid rgba(168, 85, 247, 0.4)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            color: '#e2e8f0',
          }}>
            <div>
              <span>⚔️ <strong>Expedición en curso:</strong> Nivel {activeExpedition.currentLevel} de 20</span>
              <span style={{ marginLeft: '12px', color: '#34d399', fontWeight: 800 }}>
                🌱 +{activeExpedition.totalTokensEarned.toFixed(2)} PLANTS asegurados
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAbandonConfirm(true)}
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                color: '#fca5a5',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              🚪 Abandonar Expedición
            </button>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL: GRID DE NIVELES Y PANEL DE DETALLE */}
        <div className="story-modal-body">
          {/* COLUMNA IZQUIERDA: SELECTOR DE 20 NIVELES */}
          <div className="story-levels-panel">
            <div className="story-levels-panel__title">
              <span>🗺️ MAPA DE NIVELES (1 - 20)</span>
              <span className="story-levels-progress-badge">
                {activeExpedition ? `${activeExpedition.claimedLevels.length} / 20 Superados` : 'Entrada: 50 💎'}
              </span>
            </div>

            <div className="story-levels-grid">
              {Array.from({ length: 20 }, (_, idx) => {
                const lvl = idx + 1
                const isUnlocked = lvl <= maxUnlockedLevel
                const isCompleted = activeExpedition ? activeExpedition.claimedLevels.includes(lvl) : false
                const isCurrent = lvl === selectedLevel

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
                        ? `Nivel ${lvl}${isCompleted ? ' (Completado en esta run)' : ''}`
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
                      <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 800 }}>✓ PAGADO</span>
                    ) : isCurrent ? (
                      <span className="story-level-node__new">ACTUAL</span>
                    ) : null}
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
                      <div className="story-wave-item__head">
                        <span className="story-wave-item__num">
                          {w.hasBoss ? '👑' : `O${w.waveNumber}`}
                        </span>
                        <strong>{w.title.replace(/^Oleada \d:\s*/i, '')}</strong>
                      </div>
                      <small className="story-wave-item__sub">{w.subtitle}</small>
                    </div>
                  ))}
                </div>
              </div>

              {/* RECOMPENSAS EN TOKEN PLANTS */}
              <div className="story-rewards-box">
                <span className="story-rewards-label">Recompensas en Token PLANTS (Por Nivel):</span>
                <div className="story-rewards-pills" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="story-reward-pill story-reward-pill--tokens" style={{ background: 'rgba(52, 211, 153, 0.2)', border: '1px solid #34d399', color: '#6ee7b7', fontWeight: 800 }}>
                    ⭐⭐⭐ +5 PLANTS
                  </span>
                  <span className="story-reward-pill story-reward-pill--tokens" style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#7dd3fc', fontWeight: 700 }}>
                    ⭐⭐ +3 PLANTS
                  </span>
                  <span className="story-reward-pill story-reward-pill--tokens" style={{ background: 'rgba(148, 163, 184, 0.2)', border: '1px solid #94a3b8', color: '#cbd5e1', fontWeight: 700 }}>
                    ⭐ +1 PLANTS
                  </span>
                  <span className="story-reward-pill" style={{ background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(245, 158, 11, 0.25))', border: '1px solid #eab308', color: '#fef08a', fontWeight: 800 }}>
                    ✨ +10% extra por Dorada jugada (hasta +60%)
                  </span>
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
                  {activeDeck.slice(0, 6).map((plantId, slotIdx) => {
                    const slotInstId = activeDeckInstances?.[slotIdx]
                    const inst =
                      (slotInstId
                        ? plantInstances.find((i) => i.instanceId === slotInstId && i.plantId === plantId)
                        : null) || plantInstances.find((i) => i.plantId === plantId)
                    const scaled = getScaledPlantConfig(
                      plantId,
                      inst?.statRolls || [],
                      inst?.equippedItem,
                      inst?.isGolden
                    )
                    const cfg = PLANT_CONFIGS[plantId] || scaled
                    return (
                      <div
                        key={`${plantId}-${slotIdx}`}
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
                disabled={isEntering}
                onClick={handleStart}
                style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                  boxShadow: '0 0 20px rgba(168, 85, 247, 0.45)',
                  borderColor: '#c084fc',
                }}
              >
                {activeExpedition
                  ? `⚔️ CONTINUAR EXPEDICIÓN · NIVEL ${activeExpedition.currentLevel}`
                  : isEntering
                  ? '⌛ INICIANDO EXPEDICIÓN...'
                  : `🦝 ENTRAR AL MODO HISTORIA (${STORY_MODE_ENTRY_FEE_GEMS} 💎)`}
              </button>
            </div>
          </div>
        </div>

        {/* MODAL DE CONFIRMACIÓN DE ABANDONO */}
        {showAbandonConfirm && activeExpedition && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            borderRadius: '16px',
            padding: '20px',
          }}>
            <div style={{
              background: '#1e293b',
              border: '2px solid #ef4444',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '420px',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>⚠️</div>
              <h3 style={{ color: '#f87171', fontWeight: 900, margin: '0 0 10px 0' }}>
                ¿ABANDONAR EXPEDICIÓN?
              </h3>
              <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                Estás en el <strong>Nivel {activeExpedition.currentLevel} de 20</strong>. Si abandonas ahora, tu expedición actual finalizará y el progreso no se guarda para después (cada intento inicia en Nivel 1).
                <br /><br />
                <span style={{ color: '#34d399', fontWeight: 700 }}>
                  ✓ Los {activeExpedition.totalTokensEarned.toFixed(2)} Token PLANTS ganados en los niveles anteriores ya están asegurados en tu cuenta.
                </span>
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowAbandonConfirm(false)}
                  style={{
                    background: '#334155',
                    border: '1px solid #64748b',
                    color: '#f8fafc',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⚔️ SEGUIR JUGANDO
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAbandon}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    border: '1px solid #f87171',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🚪 SÍ, ABANDONAR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
