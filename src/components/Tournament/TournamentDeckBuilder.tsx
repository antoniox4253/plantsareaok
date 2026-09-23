import { useState, useEffect, useMemo } from 'react'
import type { PlantId, PlantCardInstance } from '../../types/game'
import {
  PLANT_CONFIGS,
  getScaledPlantConfig,
  EQUIPPABLE_PLANT_ITEMS,
  type PlantStatKey,
} from '../../utils/gameConstants'
import { soundManager } from '../../utils/audioManager'
import './TournamentDeckBuilder.css'

interface TournamentDeckBuilderProps {
  isOpen: boolean
  currentDeck: PlantId[]
  onSaveDeck: (newDeck: PlantId[]) => Promise<void> | void
  onClose: () => void
  plantRule?: 'all_unlocked' | 'owned_only'
  unlockedPlants?: PlantId[]
  plantInstances?: PlantCardInstance[]
}

const ALL_PLANT_IDS = Object.keys(PLANT_CONFIGS) as PlantId[]
const BASE_STARTER_PLANTS: PlantId[] = ['sunflower', 'peashooter', 'wallnut', 'chomper', 'repeater']

export default function TournamentDeckBuilder({
  isOpen,
  currentDeck,
  onSaveDeck,
  onClose,
  plantRule = 'all_unlocked',
  unlockedPlants = [],
  plantInstances = [],
}: TournamentDeckBuilderProps) {
  // Resolver instancias con fallback a localStorage
  const resolvedInstances = useMemo<PlantCardInstance[]>(() => {
    if (plantInstances && plantInstances.length > 0) return plantInstances
    try {
      const saved = localStorage.getItem('plant_arena_plant_instances')
      if (saved) return JSON.parse(saved)
    } catch {}
    return []
  }, [plantInstances, isOpen])

  const getPlantInstanceData = (plantId: PlantId) => {
    const copies = resolvedInstances.filter((i) => i.plantId === plantId)
    if (copies.length === 0) return null
    return copies.sort((a, b) => {
      if (Boolean(a.equippedItem) !== Boolean(b.equippedItem)) {
        return a.equippedItem ? -1 : 1
      }
      const rollsA = a.statRolls?.length || 0
      const rollsB = b.statRolls?.length || 0
      if (rollsA !== rollsB) return rollsB - rollsA
      return (b.level || 0) - (a.level || 0)
    })[0]
  }

  const isCardAvailable = (plantId: PlantId): boolean => {
    if (plantRule !== 'owned_only') return true
    if (BASE_STARTER_PLANTS.includes(plantId)) return true
    return unlockedPlants.includes(plantId)
  }

  const [selectedDeck, setSelectedDeck] = useState<PlantId[]>(() => {
    if (currentDeck && currentDeck.length >= 5) {
      return currentDeck.slice(0, 5)
    }
    return ['sunflower', 'peashooter', 'wallnut', 'chomper', 'repeater']
  })
  const [isSaving, setIsSaving] = useState(false)

  // Sincronizar selectedDeck cuando se abre el modal o se actualiza currentDeck desde el servidor
  useEffect(() => {
    if (isOpen && currentDeck && currentDeck.length >= 5) {
      setSelectedDeck(currentDeck.slice(0, 5))
    }
  }, [isOpen, currentDeck])

  if (!isOpen) return null

  const handleAddCard = (plantId: PlantId) => {
    if (!isCardAvailable(plantId)) {
      soundManager.playSound('click', 0.2)
      alert(
        `🔒 La planta "${PLANT_CONFIGS[plantId]?.name || plantId}" está bloqueada en tu colección.\n\n` +
        `Este torneo tiene la regla "Solo Plantas Propias", por lo que solo puedes seleccionar cartas que poseas en tu inventario.`
      )
      return
    }

    soundManager.playSound('click', 0.4)
    if (selectedDeck.includes(plantId)) {
      // Si ya está en el mazo, la quitamos
      setSelectedDeck((prev) => prev.filter((id) => id !== plantId))
      return
    }

    if (selectedDeck.length >= 5) {
      // Mazo lleno: reemplaza la última
      setSelectedDeck((prev) => [...prev.slice(0, 4), plantId])
    } else {
      setSelectedDeck((prev) => [...prev, plantId])
    }
  }

  const handleRemoveSlot = (index: number) => {
    soundManager.playSound('click', 0.3)
    setSelectedDeck((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (selectedDeck.length !== 5) {
      alert('Debes seleccionar exactamente 5 plantas para tu mazo de torneo.')
      return
    }

    if (plantRule === 'owned_only') {
      const invalid = selectedDeck.filter((id) => !isCardAvailable(id))
      if (invalid.length > 0) {
        alert(
          `Tu mazo contiene plantas que no tienes desbloqueadas: ${invalid
            .map((id) => PLANT_CONFIGS[id]?.name || id)
            .join(', ')}.\nPor favor reemplázalas por plantas de tu colección antes de guardar.`
        )
        return
      }
    }

    soundManager.playSound('plantation', 0.8)
    setIsSaving(true)
    try {
      await onSaveDeck(selectedDeck)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="tourney-deck-builder-overlay" onClick={onClose}>
      <div
        className="tourney-deck-builder-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tourney-deck-header">
          <div className="tourney-deck-title-area">
            <h2>Mazo de Torneo</h2>
            <span
              className="tourney-deck-badge"
              style={
                plantRule === 'owned_only'
                  ? { background: 'rgba(245, 158, 11, 0.25)', borderColor: '#f59e0b', color: '#fde047' }
                  : undefined
              }
            >
              {plantRule === 'owned_only' ? '🌿 Solo Plantas Propias' : '🌟 15 Cartas Libres'}
            </span>
          </div>
          <button
            type="button"
            className="tourney-deck-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="tourney-deck-body">
          <div
            className="tourney-deck-notice"
            style={
              plantRule === 'owned_only'
                ? { background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.4)' }
                : undefined
            }
          >
            <span className="tourney-deck-notice-icon">
              {plantRule === 'owned_only' ? '🔒' : '🌱'}
            </span>
            <div>
              <strong style={plantRule === 'owned_only' ? { color: '#fde047' } : undefined}>
                {plantRule === 'owned_only'
                  ? '¡Regla: Solo Plantas Propias!'
                  : '¡Todas las 16 cartas desbloqueadas para el torneo!'}
              </strong>
              <div style={{ marginTop: 2, opacity: 0.9 }}>
                {plantRule === 'owned_only'
                  ? 'En este torneo solo puedes armar tu mazo con las cartas que has desbloqueado en tu colección personal. Las plantas que no posees aparecen bloqueadas.'
                  : '🌟 Puedes armar tu estrategia con cualquiera de las 16 cartas del catálogo. Si posees cartas fusionadas o con ítems equipados en tu colección, combatirán con sus mejoras activas; las cartas que no poseas las jugarás en su versión base.'}
              </div>
            </div>
          </div>

          <div className="tourney-deck-slots-section">
            <div className="tourney-deck-slots-header">
              <span>Tu Mazo Activo de Torneo ({selectedDeck.length} / 5)</span>
              {selectedDeck.length === 5 ? (
                <span style={{ color: '#22c55e', fontSize: 13 }}>✓ Mazo Completo</span>
              ) : (
                <span style={{ color: '#f59e0b', fontSize: 13 }}>Elige 5 plantas</span>
              )}
            </div>

            <div className="tourney-deck-slots-grid">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const plantId = selectedDeck[slotIdx]
                if (!plantId) {
                  return (
                    <div
                      key={`slot_empty_${slotIdx}`}
                      className="tourney-deck-slot"
                      title="Espacio vacío. Selecciona una planta abajo."
                    >
                      <span className="tourney-slot-empty-label">
                        + Ranura {slotIdx + 1}
                      </span>
                    </div>
                  )
                }

                const inst = getPlantInstanceData(plantId)
                const rolls = (inst?.statRolls as PlantStatKey[]) || []
                const equippedItem = inst?.equippedItem || null
                const scaledConfig = getScaledPlantConfig(plantId, rolls, equippedItem)
                const itemDef = equippedItem ? EQUIPPABLE_PLANT_ITEMS[equippedItem] : null

                return (
                  <div
                    key={`slot_${slotIdx}`}
                    className={`tourney-deck-slot filled ${equippedItem ? 'has-item' : ''} ${rolls.length > 0 ? 'has-fusions' : ''}`}
                    onClick={() => handleRemoveSlot(slotIdx)}
                    title={`Quitar ${scaledConfig.name} (${scaledConfig.maxHp} HP, ${scaledConfig.damage ?? 0} Daño)${rolls.length > 0 ? `\n⭐ Fusionada (+${rolls.length} mejoras)` : ''}${itemDef ? `\nEquipado: ${itemDef.name} (${itemDef.statBonusText})` : ''}`}
                  >
                    <div className="tourney-slot-cost">☀️ {scaledConfig.cost}</div>
                    {itemDef ? (
                      <div className="tourney-slot-item-badge" title={`${itemDef.name}: ${itemDef.statBonusText}`}>
                        {itemDef.emoji || '🥊'}
                      </div>
                    ) : rolls.length > 0 ? (
                      <div className="tourney-slot-fusion-badge" title={`Planta Fusionada: +${rolls.length} mejoras`}>
                        ⭐ +{rolls.length}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="tourney-slot-remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveSlot(slotIdx)
                      }}
                    >
                      ✕
                    </button>
                    <img
                      src={scaledConfig.icon || scaledConfig.sprite}
                      alt={scaledConfig.name}
                      className="tourney-slot-img"
                    />
                    <span className="tourney-slot-name">{scaledConfig.name}</span>
                    {itemDef && (
                      <span className="tourney-slot-item-label">{itemDef.emoji} {itemDef.name}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="tourney-catalog-section">
            <div className="tourney-catalog-header">
              <span>
                {plantRule === 'owned_only'
                  ? 'Catálogo: Tus Plantas Desbloqueadas'
                  : 'Catálogo Disponible (16 Plantas)'}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Haz clic en una planta para añadirla o quitarla
              </span>
            </div>

            <div className="tourney-catalog-grid">
              {ALL_PLANT_IDS.map((id) => {
                const isSelected = selectedDeck.includes(id)
                const isAvailable = isCardAvailable(id)
                const inst = getPlantInstanceData(id)
                const rolls = (inst?.statRolls as PlantStatKey[]) || []
                const equippedItem = inst?.equippedItem || null
                const scaledConfig = getScaledPlantConfig(id, rolls, equippedItem)
                const itemDef = equippedItem ? EQUIPPABLE_PLANT_ITEMS[equippedItem] : null

                return (
                  <div
                    key={id}
                    className={`tourney-catalog-card ${isSelected ? 'in-deck' : ''} ${!isAvailable ? 'is-locked' : ''} ${equippedItem ? 'has-item' : ''} ${rolls.length > 0 ? 'has-fusions' : ''}`}
                    onClick={() => handleAddCard(id)}
                    title={
                      !isAvailable
                        ? `🔒 Bloqueada: No posees esta planta en tu colección.`
                        : `${scaledConfig.name}\n${scaledConfig.description}${rolls.length > 0 ? `\n\n⭐ Planta Fusionada (+${rolls.length} mejoras de stats)` : ''}${itemDef ? `\n\n${itemDef.emoji} Equipado con ${itemDef.name} (${itemDef.statBonusText})` : ''}`
                    }
                    style={
                      !isAvailable
                        ? {
                            opacity: 0.45,
                            filter: 'grayscale(0.85)',
                            cursor: 'not-allowed',
                            position: 'relative',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                          }
                        : undefined
                    }
                  >
                    {!isAvailable && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          background: 'rgba(0, 0, 0, 0.75)',
                          borderRadius: '50%',
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          zIndex: 2,
                          border: '1px solid rgba(245, 158, 11, 0.5)',
                        }}
                      >
                        🔒
                      </div>
                    )}
                    {isAvailable && itemDef ? (
                      <div className="tourney-item-equipped-tag" title={`${itemDef.name}: ${itemDef.statBonusText}`}>
                        <span>{itemDef.emoji || '🥊'}</span>
                        <span>{itemDef.name}</span>
                      </div>
                    ) : isAvailable && rolls.length > 0 ? (
                      <div className="tourney-card-fusion-tag" title={`Planta Fusionada: +${rolls.length} mejoras`}>
                        <span>⭐ +{rolls.length} Fusión</span>
                      </div>
                    ) : null}
                    <span className="tourney-catalog-cost">☀️ {scaledConfig.cost}</span>
                    <img
                      src={scaledConfig.icon || scaledConfig.sprite}
                      alt={scaledConfig.name}
                      className="tourney-catalog-card-img"
                    />
                    <span className="tourney-catalog-card-name">{scaledConfig.name}</span>
                    <div className="tourney-card-stats-preview">
                      <span title="Vida">❤️ {scaledConfig.maxHp}</span>
                      {scaledConfig.damage !== undefined && (
                        <span title="Daño">⚔️ {scaledConfig.damage}</span>
                      )}
                    </div>
                    <span className="tourney-catalog-card-category">
                      {!isAvailable
                        ? '🔒 Bloqueada'
                        : itemDef
                        ? `${itemDef.emoji} Con Ítem`
                        : rolls.length > 0
                        ? `⭐ Fusionada (+${rolls.length})`
                        : scaledConfig?.category ?? 'Combatiente'}
                    </span>
                    {isSelected && (
                      <span className="tourney-catalog-card-status">✓ En Mazo</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="tourney-deck-footer">
          <button
            type="button"
            className="tourney-btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="tourney-btn-primary"
            disabled={selectedDeck.length !== 5 || isSaving}
            onClick={handleSave}
          >
            {isSaving ? 'Guardando…' : '✓ Guardar Mazo de Torneo'}
          </button>
        </div>
      </div>
    </div>
  )
}
