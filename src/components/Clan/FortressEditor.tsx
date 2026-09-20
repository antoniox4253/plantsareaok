import React, { useState, useMemo } from 'react'
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
  onClose: () => void
  onSaved: (newLayout: ClanFortressPlant[], sunsSpent: number) => void
}

const SELECTABLE_PLANTS: PlantId[] = [
  'wallnut',
  'peashooter',
  'repeater',
  'snowpea',
  'tallnut',
  'bonkchoy',
  'spikeweed',
  'chomper',
  'torchwood',
  'kernelpult',
  'iceberglettuce',
  'jalapeno',
  'melonpult',
]

export default function FortressEditor({
  clanId,
  clanName,
  initialLayout,
  defenseSunsBudget,
  onClose,
  onSaved,
}: FortressEditorProps) {
  const [layout, setLayout] = useState<ClanFortressPlant[]>(() => [...initialLayout])
  const [selectedPlantId, setSelectedPlantId] = useState<PlantId>('wallnut')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Calcular soles gastados en tiempo real
  const sunsSpent = useMemo(() => {
    return layout.reduce((total, item) => total + (FORTRESS_SUN_COSTS[item.plantId] || 100), 0)
  }, [layout])

  const sunsRemaining = defenseSunsBudget - sunsSpent

  // Grid defensivo: 5 carriles (0..4) x 7 columnas defensivas (7..13)
  const defenseCols = [7, 8, 9, 10, 11, 12, 13]

  const handleTileClick = (lane: number, col: number) => {
    const existingIndex = layout.findIndex((p) => p.lane === lane && p.col === col)

    if (existingIndex >= 0) {
      // Remover planta existente y recuperar soles
      soundManager.playSound('click', 0.4)
      setLayout((prev) => prev.filter((_, idx) => idx !== existingIndex))
      setSaveStatus(null)
      return
    }

    // Colocar nueva planta si alcanza el presupuesto
    const cost = FORTRESS_SUN_COSTS[selectedPlantId] || 100
    if (sunsRemaining < cost) {
      soundManager.playSound('click', 0.2)
      setSaveStatus({
        type: 'error',
        message: `¡No tienes suficientes soles! Requiere ${cost} ☀️ y te quedan ${sunsRemaining} ☀️.`,
      })
      return
    }

    soundManager.playSound('click', 0.5)
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

  const handleClearAll = () => {
    if (layout.length === 0) return
    soundManager.playSound('click', 0.4)
    setLayout([])
    setSaveStatus(null)
  }

  const handleSave = async () => {
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

      soundManager.playSound('click', 0.6)
      setSaveStatus({
        type: 'success',
        message: '¡Fortaleza guardada con éxito! Las defensas están listas para la guerra.',
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
            ◀ VOLVER AL CLAN
          </button>
          <div className="fortress-editor-title">
            <h2>🏰 EDITOR DE FORTALEZA: {clanName.toUpperCase()}</h2>
            <small>Diseña tu bastión defensivo de 5 carriles en Arena 1</small>
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
            className="fortress-editor-btn-clear"
            onClick={handleClearAll}
            disabled={layout.length === 0 || isSaving}
            title="Quitar todas las plantas defensivas"
          >
            🗑️ VACIAR
          </button>
          <button
            type="button"
            className="fortress-editor-btn-save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'GUARDANDO...' : '💾 GUARDAR FORTALEZA'}
          </button>
        </div>
      </header>

      {/* Alerta de feedback de guardado */}
      {saveStatus && (
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

          {/* División del campo: Zona Atacante vs Zona Defensora */}
          <div className="fortress-field-zone fortress-field-zone--attack">
            <span>🛡️ ZONA DE AVANCE ENEMIGO (COLUMNAS 0 A 6)</span>
          </div>
          <div className="fortress-field-zone fortress-field-zone--defense">
            <span>🏰 TU BASTIÓN DEFENSIVO (COLUMNAS 7 A 13)</span>
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

                  return (
                    <div
                      key={col}
                      className={`fortress-defense-tile ${placed ? 'fortress-defense-tile--occupied' : ''}`}
                      onClick={() => handleTileClick(laneCfg.id, col)}
                      title={placed ? `Clic para remover ${placedCfg?.name} (+${FORTRESS_SUN_COSTS[placed.plantId] || 100} ☀️)` : `Clic para plantar ${PLANT_CONFIGS[selectedPlantId]?.name} (-${FORTRESS_SUN_COSTS[selectedPlantId] || 100} ☀️)`}
                    >
                      {placed && placedCfg && (
                        <div className="fortress-placed-plant-wrapper">
                          <img
                            src={placedCfg.sprite || placedCfg.icon}
                            alt={placedCfg.name}
                            className="fortress-placed-plant-sprite"
                          />
                          <span className="fortress-placed-cost-badge">
                            {FORTRESS_SUN_COSTS[placed.plantId] || 100}☀️
                          </span>
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
          <span>Selecciona una planta y haz clic en las casillas verdes para colocarla:</span>
        </div>
        <div className="fortress-plant-palette">
          {SELECTABLE_PLANTS.map((pid) => {
            const cfg = PLANT_CONFIGS[pid]
            const cost = FORTRESS_SUN_COSTS[pid] || 100
            const isSelected = selectedPlantId === pid
            const canAfford = sunsRemaining >= cost

            return (
              <button
                key={pid}
                type="button"
                className={`fortress-palette-card ${isSelected ? 'fortress-palette-card--selected' : ''} ${!canAfford ? 'fortress-palette-card--disabled' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.2)
                  setSelectedPlantId(pid)
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
