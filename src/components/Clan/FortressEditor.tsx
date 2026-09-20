import { useState, useMemo } from 'react'
import type { PlantId, ClanFortressPlant } from '../../types/game'
import { PLANT_CONFIGS, LANES_CONFIG_5, FORTRESS_SUN_COSTS } from '../../utils/gameConstants'
import { supabaseService } from '../../services/supabaseService'
import { soundManager } from '../../utils/audioManager'
import arena1Bg from '../../assets/images/battlefield-bg.webp'
import './FortressEditor.css'

interface FortressEditorProps {
  clanId: string
  clanName: string
  initialLayout: ClanFortressPlant[]
  defenseSunsBudget: number
  canEdit?: boolean
  onClose: () => void
  onSaved: (newLayout: ClanFortressPlant[], sunsSpent: number) => void
}

const SELECTABLE_PLANTS: PlantId[] = [
  'sunflower',
  'peashooter',
  'repeater',
  'threepeater',
  'wallnut',
  'tallnut',
  'bonkchoy',
  'chomper',
  'kernelpult',
  'melonpult',
  'iceberglettuce',
  'jalapeno',
  'twinsunflower',
  'squash',
  'garlic',
  'aloe',
]

export default function FortressEditor({
  clanId: _clanId,
  clanName,
  initialLayout,
  defenseSunsBudget,
  canEdit = true,
  onClose,
  onSaved,
}: FortressEditorProps) {
  const [layout, setLayout] = useState<ClanFortressPlant[]>(() => [...initialLayout])
  const [selectedPlantId, setSelectedPlantId] = useState<PlantId>('peashooter')
  const [selectedTileToMove, setSelectedTileToMove] = useState<{ lane: number; col: number } | null>(null)
  const [isShovelActive, setIsShovelActive] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Calcular soles gastados en tiempo real
  const sunsSpent = useMemo(() => {
    return layout.reduce((total, item) => total + (FORTRESS_SUN_COSTS[item.plantId] || 100), 0)
  }, [layout])

  const sunsRemaining = defenseSunsBudget - sunsSpent

  // Grid defensivo: 5 carriles (0..4) x 7 columnas defensivas (0..6)
  const defenseCols = [0, 1, 2, 3, 4, 5, 6]

  const handleTileClick = (lane: number, col: number) => {
    const existingIndex = layout.findIndex((p) => p.lane === lane && p.col === col)

    // 1. Si la pala está activa
    if (isShovelActive) {
      if (existingIndex >= 0) {
        soundManager.playSound('click', 0.4)
        const removed = layout[existingIndex]
        const cost = FORTRESS_SUN_COSTS[removed.plantId] || 100
        setLayout((prev) => prev.filter((_, idx) => idx !== existingIndex))
        setSaveStatus({
          type: 'success',
          message: `Planta desenterrada. Se reembolsaron +${cost} ☀️ al presupuesto.`,
        })
      }
      return
    }

    // 2. Si hay una planta seleccionada para MOVER
    if (selectedTileToMove) {
      // Clic en la misma casilla -> cancelar selección
      if (selectedTileToMove.lane === lane && selectedTileToMove.col === col) {
        setSelectedTileToMove(null)
        setSaveStatus(null)
        return
      }

      // Clic en casilla con otra planta -> INTERCAMBIAR (SWAP)
      if (existingIndex >= 0) {
        soundManager.playSound('plantation', 0.7)
        setLayout((prev) => {
          return prev.map((item) => {
            if (item.lane === selectedTileToMove.lane && item.col === selectedTileToMove.col) {
              return { ...item, lane, col }
            }
            if (item.lane === lane && item.col === col) {
              return { ...item, lane: selectedTileToMove.lane, col: selectedTileToMove.col }
            }
            return item
          })
        })
        setSelectedTileToMove(null)
        setSaveStatus({
          type: 'success',
          message: `🔄 ¡Plantas intercambiadas de posición con éxito!`,
        })
        return
      }

      // Clic en casilla vacía -> TRASLADAR PLANTA
      soundManager.playSound('plantation', 0.7)
      setLayout((prev) => {
        return prev.map((item) => {
          if (item.lane === selectedTileToMove.lane && item.col === selectedTileToMove.col) {
            return { ...item, lane, col }
          }
          return item
        })
      })
      setSelectedTileToMove(null)
      setSaveStatus({
        type: 'success',
        message: `✓ ¡Planta reubicada al Carril ${lane + 1}, Casilla ${col + 1}!`,
      })
      return
    }

    // 3. Si NO hay planta seleccionada para mover:
    // 3a. Clic en casilla ocupada -> SELECCIONARLA PARA MOVER
    if (existingIndex >= 0) {
      soundManager.playSound('click', 0.4)
      setSelectedTileToMove({ lane, col })
      const plant = layout[existingIndex]
      const name = PLANT_CONFIGS[plant.plantId]?.name || plant.plantId
      setSaveStatus({
        type: 'success',
        message: `Moviendo "${name}" (Carril ${lane + 1}, C${col + 1}). Haz clic en cualquier casilla para reubicarla o intercambiarla.`,
      })
      return
    }

    // 3b. Clic en casilla vacía -> PLANTAR DESDE PALETA
    const cost = FORTRESS_SUN_COSTS[selectedPlantId] || 100
    if (sunsRemaining < cost) {
      soundManager.playSound('click', 0.2)
      setSaveStatus({
        type: 'error',
        message: `¡No tienes suficientes soles! Requiere ${cost} ☀️ y te quedan ${sunsRemaining} ☀️.`,
      })
      return
    }

    soundManager.playSound('plantation', 0.6)
    setLayout((prev) => [
      ...prev,
      {
        plantId: selectedPlantId,
        lane,
        col,
        level: 1,
      },
    ])
    setSaveStatus(null)
  }

  const handleRemovePlant = (lane: number, col: number) => {
    const existingIndex = layout.findIndex((p) => p.lane === lane && p.col === col)
    if (existingIndex >= 0) {
      soundManager.playSound('click', 0.4)
      const removed = layout[existingIndex]
      const cost = FORTRESS_SUN_COSTS[removed.plantId] || 100
      setLayout((prev) => prev.filter((_, idx) => idx !== existingIndex))
      if (selectedTileToMove?.lane === lane && selectedTileToMove?.col === col) {
        setSelectedTileToMove(null)
      }
      setSaveStatus({
        type: 'success',
        message: `Planta desenterrada (+${cost} ☀️ reembolsados).`,
      })
    }
  }

  const handleClearAll = () => {
    if (layout.length === 0) return
    soundManager.playSound('click', 0.4)
    setLayout([])
    setSelectedTileToMove(null)
    setSaveStatus(null)
  }

  const handleSave = async () => {
    if (!canEdit) {
      setSaveStatus({
        type: 'error',
        message: 'Solo el Líder, Colíderes y Veteranos tienen permiso para guardar cambios en la defensa.',
      })
      return
    }

    setIsSaving(true)
    setSaveStatus(null)
    try {
      const res = await supabaseService.saveClanFortress(layout)
      if (!res.success) {
        setSaveStatus({
          type: 'error',
          message: res.error || 'Error al guardar la fortaleza',
        })
        setIsSaving(false)
        return
      }

      soundManager.playSound('plantation', 0.8)
      setSaveStatus({
        type: 'success',
        message: '¡Formación defensiva guardada con éxito! Las unidades defenderán el bastión en los próximos combates.',
      })
      onSaved(layout, sunsSpent)
    } catch (e: any) {
      setSaveStatus({
        type: 'error',
        message: e?.message || 'Error en la conexión con el servidor',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fortress-editor-fullscreen">
      {/* ── BARRA SUPERIOR DE CONTROL ────────────────────────────────────────── */}
      <header className="fortress-editor-header">
        <div className="fortress-editor-header__left">
          <button type="button" className="fortress-editor-btn-back" onClick={onClose}>
            ← VOLVER A FORTALEZA
          </button>
          <div className="fortress-editor-title">
            <h2>🛡️ PREPARACIÓN DE DEFENSAS: {clanName.toUpperCase()}</h2>
            <small>Modo Arena 1 • 5 Carriles Defensivos • Despliega y mueve tus plantas</small>
          </div>
        </div>

        <div className="fortress-editor-header__center">
          <div className="fortress-sun-meter">
            <div className="fortress-sun-meter__info">
              <span className="fortress-sun-icon">☀️</span>
              <strong>{sunsSpent} / {defenseSunsBudget} Soles</strong>
              <small>({sunsRemaining} restantes)</small>
            </div>
            <div className="fortress-sun-meter__track">
              <div
                className="fortress-sun-meter__fill"
                style={{
                  width: `${Math.min(100, (sunsSpent / Math.max(1, defenseSunsBudget)) * 100)}%`,
                  backgroundColor: sunsRemaining < 100 ? '#ef4444' : '#facc15',
                }}
              />
            </div>
          </div>
        </div>

        <div className="fortress-editor-header__right">
          <button
            type="button"
            className={`fortress-editor-btn-shovel ${isShovelActive ? 'fortress-editor-btn-shovel--active' : ''}`}
            onClick={() => {
              soundManager.playSound('click', 0.3)
              setIsShovelActive((v) => !v)
              setSelectedTileToMove(null)
            }}
            title="Activar o desactivar pala para desenterrar y reembolsar soles"
          >
            {isShovelActive ? '🪓 PALA ACTIVA' : '🪓 PALA'}
          </button>

          <button
            type="button"
            className="fortress-editor-btn-clear"
            onClick={handleClearAll}
            disabled={layout.length === 0 || isSaving}
            title="Quitar todas las plantas defensivas"
          >
            🗑️ VACIAR
          </button>

          {canEdit ? (
            <button
              type="button"
              className="fortress-editor-btn-save"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'GUARDANDO...' : '💾 GUARDAR FORMACIÓN'}
            </button>
          ) : (
            <span className="fortress-editor-observer-badge">
              👁️ MODO OBSERVADOR
            </span>
          )}
        </div>
      </header>

      {/* Cinta de acción interactiva al mover planta */}
      {selectedTileToMove && (() => {
        const moving = layout.find((p) => p.lane === selectedTileToMove.lane && p.col === selectedTileToMove.col)
        const movingCfg = moving ? PLANT_CONFIGS[moving.plantId] : null
        const cost = moving ? (FORTRESS_SUN_COSTS[moving.plantId] || 100) : 100
        return (
          <div className="fortress-move-ribbon">
            <div className="fortress-move-ribbon__info">
              <span className="fortress-move-ribbon__icon">🎯</span>
              <div>
                <strong>Moviendo: {movingCfg?.name || 'Planta'}</strong>
                <small>
                  Carril {selectedTileToMove.lane + 1}, Casilla {selectedTileToMove.col + 1} • Haz clic en cualquier casilla de la arena para reubicarla o intercambiarla
                </small>
              </div>
            </div>
            <div className="fortress-move-ribbon__actions">
              <button
                type="button"
                className="fortress-move-ribbon__shovel-btn"
                onClick={() => handleRemovePlant(selectedTileToMove.lane, selectedTileToMove.col)}
                title="Desenterrar y recuperar Soles"
              >
                🗑️ Desenterrar (+{cost} ☀️)
              </button>
              <button
                type="button"
                className="fortress-move-ribbon__cancel-btn"
                onClick={() => setSelectedTileToMove(null)}
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        )
      })()}

      {/* Alerta de feedback de guardado */}
      {saveStatus && !selectedTileToMove && (
        <div className={`fortress-editor-alert fortress-editor-alert--${saveStatus.type}`}>
          {saveStatus.message}
        </div>
      )}

      {/* ── CAMPO DE BATALLA 5 CARRILES (ARENA 1 PERSPECTIVA) ─────────────────── */}
      <div className="fortress-editor-field-container">
        <div
          className="fortress-editor-field"
          style={{ backgroundImage: `url(${arena1Bg})` }}
        >
          {/* Overlay de perspectiva y profundidad */}
          <div className="fortress-editor-depth-overlay" />

          {/* División del campo: Zona Defensora (Izquierda) vs Zona Atacante (Derecha) */}
          <div className="fortress-field-zone fortress-field-zone--defense">
            <span>🏰 TU BASTIÓN DEFENSIVO (C0 A C6)</span>
          </div>
          <div className="fortress-field-zone fortress-field-zone--attack">
            <span>⚔️ ZONA DE AVANCE ENEMIGO (C7 A C13)</span>
          </div>

          {/* Línea divisoria central */}
          <div className="fortress-field-half-line" />

          {/* Renderizado de los 5 carriles en perspectiva */}
          {LANES_CONFIG_5.map((laneCfg) => (
            <div
              key={laneCfg.id}
              className="fortress-editor-lane"
              style={{
                top: `${laneCfg.topPct}%`,
                height: `${laneCfg.heightPct}%`,
              }}
            >
              <div className="fortress-lane-tag">LÍNEA {laneCfg.id + 1}</div>

              {/* Grid de 7 columnas defensivas en este carril */}
              <div className="fortress-lane-tiles">
                {defenseCols.map((col) => {
                  const placed = layout.find((p) => p.lane === laneCfg.id && p.col === col)
                  const placedCfg = placed ? PLANT_CONFIGS[placed.plantId] : null
                  const isBeingMoved = selectedTileToMove?.lane === laneCfg.id && selectedTileToMove?.col === col

                  return (
                    <div
                      key={col}
                      className={`fortress-defense-tile ${placed ? 'fortress-defense-tile--occupied' : ''} ${isBeingMoved ? 'fortress-defense-tile--moving' : ''} ${isShovelActive && placed ? 'fortress-defense-tile--shovel-target' : ''}`}
                      onClick={() => handleTileClick(laneCfg.id, col)}
                      title={
                        isShovelActive
                          ? placed ? `Pala: Clic para desenterrar ${placedCfg?.name} (+${FORTRESS_SUN_COSTS[placed.plantId] || 100} ☀️)` : 'Casilla vacía'
                          : selectedTileToMove
                          ? placed
                            ? `Clic para intercambiar con ${placedCfg?.name}`
                            : `Clic para trasladar planta a esta casilla`
                          : placed
                          ? `Clic para seleccionar y mover ${placedCfg?.name} entre carriles`
                          : `Clic para plantar ${PLANT_CONFIGS[selectedPlantId]?.name} (-${FORTRESS_SUN_COSTS[selectedPlantId] || 100} ☀️)`
                      }
                    >
                      {placed && placedCfg && (
                        <div className={`fortress-placed-plant-wrapper ${isBeingMoved ? 'fortress-placed-plant-wrapper--moving' : ''}`}>
                          <img
                            src={placedCfg.sprite || placedCfg.icon}
                            alt={placedCfg.name}
                            className="fortress-placed-plant-sprite"
                          />
                          <span className="fortress-placed-cost-badge">
                            {FORTRESS_SUN_COSTS[placed.plantId] || 100}☀️
                          </span>
                          {isBeingMoved && (
                            <span className="fortress-placed-move-tag">MOVIENDO</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SELECTOR INFERIOR DE PLANTAS DEFENSIVAS ──────────────────────────── */}
      <footer className="fortress-editor-footer">
        <div className="fortress-selector-hint">
          <span>
            {selectedTileToMove
              ? '🎯 MODO TRASLADO ACTIVO: Haz clic en cualquier casilla vacía o con otra planta para reubicarla.'
              : isShovelActive
              ? '🪓 MODO PALA ACTIVO: Haz clic en cualquier planta defensiva para desenterrarla y recuperar sus soles.'
              : '🌱 MODO PREPARACIÓN: Selecciona una planta y haz clic en las casillas verdes, o haz clic en una planta colocada para moverla entre carriles:'}
          </span>
        </div>
        <div className="fortress-plant-palette">
          {SELECTABLE_PLANTS.map((pid) => {
            const cfg = PLANT_CONFIGS[pid]
            const cost = FORTRESS_SUN_COSTS[pid] || 100
            const isSelected = selectedPlantId === pid && !selectedTileToMove && !isShovelActive
            const canAfford = sunsRemaining >= cost

            return (
              <button
                key={pid}
                type="button"
                className={`fortress-palette-card ${isSelected ? 'fortress-palette-card--selected' : ''} ${!canAfford ? 'fortress-palette-card--disabled' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.2)
                  setSelectedPlantId(pid)
                  setSelectedTileToMove(null)
                  setIsShovelActive(false)
                }}
              >
                <div className="fortress-palette-img-wrap">
                  <img src={cfg.icon} alt={cfg.name} className="fortress-palette-img" />
                  <span className="fortress-palette-cost">☀️ {cost}</span>
                </div>
                <span className="fortress-palette-name">{cfg.name}</span>
              </button>
            )
          })}
        </div>
      </footer>
    </div>
  )
}
