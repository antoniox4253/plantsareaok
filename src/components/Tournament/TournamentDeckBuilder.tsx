import { useState, useEffect } from 'react'
import type { PlantId } from '../../types/game'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import { soundManager } from '../../utils/audioManager'
import './TournamentDeckBuilder.css'

interface TournamentDeckBuilderProps {
  isOpen: boolean
  currentDeck: PlantId[]
  onSaveDeck: (newDeck: PlantId[]) => Promise<void> | void
  onClose: () => void
  plantRule?: 'all_unlocked' | 'owned_only'
  unlockedPlants?: PlantId[]
}

const ALL_PLANT_IDS = Object.keys(PLANT_CONFIGS) as PlantId[]
const BASE_STARTER_PLANTS: PlantId[] = ['sunflower', 'peashooter', 'wallnut', 'chomper']

export default function TournamentDeckBuilder({
  isOpen,
  currentDeck,
  onSaveDeck,
  onClose,
  plantRule = 'all_unlocked',
  unlockedPlants = [],
}: TournamentDeckBuilderProps) {
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
                  : '¡Todas las cartas desbloqueadas para el torneo!'}
              </strong>
              <div style={{ marginTop: 2, opacity: 0.9 }}>
                {plantRule === 'owned_only'
                  ? 'En este torneo solo puedes armar tu mazo con las cartas que has desbloqueado en tu colección personal. Las plantas que no posees aparecen bloqueadas.'
                  : 'En el torneo compites en igualdad de condiciones. Puedes probar cualquier planta sin necesidad de tenerla en tu inventario real.'}
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
                const config = plantId ? PLANT_CONFIGS[plantId] : null

                if (config) {
                  return (
                    <div
                      key={`slot_${slotIdx}`}
                      className="tourney-deck-slot filled"
                      onClick={() => handleRemoveSlot(slotIdx)}
                      title={`Quitar ${config.name}`}
                    >
                      <div className="tourney-slot-cost">☀️ {config.cost}</div>
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
                        src={config.icon}
                        alt={config.name}
                        className="tourney-slot-img"
                      />
                      <span className="tourney-slot-name">{config.name}</span>
                    </div>
                  )
                }

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
              })}
            </div>
          </div>

          <div className="tourney-catalog-section">
            <div className="tourney-catalog-header">
              <span>
                {plantRule === 'owned_only'
                  ? 'Catálogo: Tus Plantas Desbloqueadas'
                  : 'Catálogo Disponible (15 Plantas)'}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Haz clic en una planta para añadirla o quitarla
              </span>
            </div>

            <div className="tourney-catalog-grid">
              {ALL_PLANT_IDS.map((id) => {
                const plant = PLANT_CONFIGS[id]
                const isSelected = selectedDeck.includes(id)
                const isAvailable = isCardAvailable(id)

                return (
                  <div
                    key={id}
                    className={`tourney-catalog-card ${isSelected ? 'in-deck' : ''} ${!isAvailable ? 'is-locked' : ''}`}
                    onClick={() => handleAddCard(id)}
                    title={
                      !isAvailable
                        ? `🔒 Bloqueada: No posees esta planta en tu colección.`
                        : plant.description
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
                    <span className="tourney-catalog-cost">☀️ {plant.cost}</span>
                    <img
                      src={plant.icon}
                      alt={plant.name}
                      className="tourney-catalog-card-img"
                    />
                    <span className="tourney-catalog-card-name">{plant.name}</span>
                    <span className="tourney-catalog-card-category">
                      {!isAvailable ? '🔒 Bloqueada' : plant.category}
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
