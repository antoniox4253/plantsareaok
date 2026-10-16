import React, { useState, useEffect } from 'react'
import {
  KeybindingsManager,
  KEYBINDINGS_PRESETS,
  DEFAULT_KEYBINDINGS,
  formatKeyLabel,
  type KeybindingsConfig,
  type KeyActionKey,
} from '../../utils/keybindingsManager'
import './KeybindingsModal.css'

interface KeybindingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ActionMeta {
  key: KeyActionKey
  label: string
  icon: string
  category: 'cards' | 'tools'
}

const ACTIONS: ActionMeta[] = [
  { key: 'slot1', label: 'Planta 1', icon: '🌱', category: 'cards' },
  { key: 'slot2', label: 'Planta 2', icon: '🌿', category: 'cards' },
  { key: 'slot3', label: 'Planta 3', icon: '🌻', category: 'cards' },
  { key: 'slot4', label: 'Planta 4', icon: '🥊', category: 'cards' },
  { key: 'slot5', label: 'Planta 5', icon: '🌽', category: 'cards' },
  { key: 'slot6', label: 'Planta 6', icon: '🍈', category: 'cards' },
  { key: 'shovel', label: 'Pala (Quitar Planta)', icon: '🪓', category: 'tools' },
  { key: 'cancel', label: 'Cancelar / Deseleccionar', icon: '❌', category: 'tools' },
]

const RESERVED_KEYS = new Set([
  'f5',
  'f11',
  'f12',
  'control',
  'alt',
  'meta',
  'shift',
  'capslock',
  'contextmenu',
])

export default function KeybindingsModal({ isOpen, onClose }: KeybindingsModalProps) {
  const [bindings, setBindings] = useState<KeybindingsConfig>(() =>
    KeybindingsManager.getKeybindings()
  )
  const [listeningSlot, setListeningSlot] = useState<KeyActionKey | null>(null)
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState<boolean>(false)

  // Sincronizar estado al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setBindings(KeybindingsManager.getKeybindings())
      setListeningSlot(null)
      setConflictMsg(null)
      setIsSaved(false)
    }
  }, [isOpen])

  // Identificar si los bindings actuales coinciden con algún preset
  const activePresetId = React.useMemo(() => {
    for (const preset of Object.values(KEYBINDINGS_PRESETS)) {
      const match = ACTIONS.every(
        (a) =>
          bindings[a.key]?.trim().toLowerCase() ===
          preset.bindings[a.key]?.trim().toLowerCase()
      )
      if (match) return preset.id
    }
    return 'custom'
  }, [bindings])

  // Aplicar un Preset predefinido
  const handleApplyPreset = (presetId: string) => {
    const preset = KEYBINDINGS_PRESETS[presetId]
    if (preset) {
      setBindings({ ...preset.bindings })
      setListeningSlot(null)
      setConflictMsg(null)
    }
  }

  // Capturar tecla presionada cuando listeningSlot está activo
  useEffect(() => {
    if (!listeningSlot) return

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const keyLower = e.key.toLowerCase()

      // Si es una tecla del sistema no permitida
      if (RESERVED_KEYS.has(keyLower)) {
        setConflictMsg(`⚠️ La tecla ${e.key} está reservada por el navegador.`)
        setListeningSlot(null)
        return
      }

      // Determinar el valor que guardaremos
      let assignedKey = e.key
      if (e.code.startsWith('Numpad')) {
        assignedKey = e.code
      } else if (e.key === ' ' || e.code === 'Space') {
        assignedKey = ' '
      } else if (e.key.length === 1) {
        assignedKey = e.key.toLowerCase()
      }

      // Validar si la tecla ya estaba asignada a otra acción
      const conflictingAction = ACTIONS.find(
        (a) =>
          a.key !== listeningSlot &&
          bindings[a.key]?.trim().toLowerCase() === assignedKey.trim().toLowerCase()
      )

      const updated = { ...bindings }

      if (conflictingAction) {
        // Intercambio inteligente para no dejar ninguna acción sin tecla
        const oldKeyOfListeningSlot = bindings[listeningSlot]
        updated[conflictingAction.key] = oldKeyOfListeningSlot
        updated[listeningSlot] = assignedKey
        setConflictMsg(
          `🔄 Intercambiado: '${formatKeyLabel(assignedKey)}' asignada a ${
            ACTIONS.find((a) => a.key === listeningSlot)?.label
          } y '${formatKeyLabel(oldKeyOfListeningSlot)}' a ${conflictingAction.label}.`
        )
      } else {
        updated[listeningSlot] = assignedKey
        setConflictMsg(null)
      }

      setBindings(updated)
      setListeningSlot(null)
    }

    window.addEventListener('keydown', handleKeyDownCapture, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, { capture: true })
    }
  }, [listeningSlot, bindings])

  // Guardar y persistir cambios
  const handleSave = () => {
    KeybindingsManager.saveKeybindings(bindings)
    setIsSaved(true)
    setTimeout(() => {
      setIsSaved(false)
      onClose()
    }, 450)
  }

  // Restablecer por defecto
  const handleResetDefaults = () => {
    setBindings({ ...DEFAULT_KEYBINDINGS })
    setConflictMsg(null)
    setListeningSlot(null)
  }

  if (!isOpen) return null

  const cardActions = ACTIONS.filter((a) => a.category === 'cards')
  const toolActions = ACTIONS.filter((a) => a.category === 'tools')

  return (
    <div className="keybindings-modal-backdrop" onClick={onClose}>
      <div className="keybindings-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <div className="keybindings-modal__header">
          <div className="keybindings-modal__header-left">
            <span className="keybindings-modal__header-icon">🎮</span>
            <h3 className="keybindings-modal__title">CONTROLES DE COMBATE</h3>
          </div>
          <button
            type="button"
            className="keybindings-modal__close-btn"
            onClick={onClose}
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        <p className="keybindings-modal__subtitle">
          Personaliza los atajos de teclado para elegir plantas y herramientas en el combate.
          Haz clic en cualquier botón y presiona la nueva tecla.
        </p>

        {/* Barra de Presets Rápidos */}
        <div className="keybindings-presets-bar">
          <span className="keybindings-presets-label">⚡ Perfiles Rápidos:</span>
          <div className="keybindings-presets-list">
            {Object.values(KEYBINDINGS_PRESETS).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`keybindings-preset-btn ${
                  activePresetId === p.id ? 'keybindings-preset-btn--active' : ''
                }`}
                onClick={() => handleApplyPreset(p.id)}
                title={p.description}
              >
                <span>{p.icon}</span>
                <span>{p.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mensaje de conflicto o intercambio automático */}
        {conflictMsg && (
          <div className="keybindings-conflict-toast">
            <span>{conflictMsg}</span>
          </div>
        )}

        {/* Sección: Cartas del Deck */}
        <div className="keybindings-section">
          <div className="keybindings-section__title">
            <span>🌱</span>
            <span>Cartas del Deck (Mano de Plantas)</span>
          </div>
          <div className="keybindings-grid">
            {cardActions.map((action) => {
              const isListening = listeningSlot === action.key
              const keyVal = bindings[action.key]
              return (
                <div key={action.key} className="keybindings-slot-item">
                  <div className="keybindings-slot-info">
                    <span className="keybindings-slot-icon">{action.icon}</span>
                    <span className="keybindings-slot-name">{action.label}</span>
                  </div>
                  <button
                    type="button"
                    className={`keybindings-key-btn ${
                      isListening ? 'keybindings-key-btn--listening' : ''
                    }`}
                    onClick={() => {
                      setConflictMsg(null)
                      setListeningSlot(isListening ? null : action.key)
                    }}
                    title={
                      isListening
                        ? 'Presiona cualquier tecla para asignar...'
                        : 'Haz clic para cambiar tecla'
                    }
                  >
                    {isListening ? '...' : formatKeyLabel(keyVal)}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sección: Herramientas de Combate */}
        <div className="keybindings-section">
          <div className="keybindings-section__title">
            <span>🛠️</span>
            <span>Herramientas de Combate</span>
          </div>
          <div className="keybindings-grid">
            {toolActions.map((action) => {
              const isListening = listeningSlot === action.key
              const keyVal = bindings[action.key]
              return (
                <div key={action.key} className="keybindings-slot-item">
                  <div className="keybindings-slot-info">
                    <span className="keybindings-slot-icon">{action.icon}</span>
                    <span className="keybindings-slot-name">{action.label}</span>
                  </div>
                  <button
                    type="button"
                    className={`keybindings-key-btn ${
                      isListening ? 'keybindings-key-btn--listening' : ''
                    }`}
                    onClick={() => {
                      setConflictMsg(null)
                      setListeningSlot(isListening ? null : action.key)
                    }}
                    title={
                      isListening
                        ? 'Presiona cualquier tecla para asignar...'
                        : 'Haz clic para cambiar tecla'
                    }
                  >
                    {isListening ? '...' : formatKeyLabel(keyVal)}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pie de Acciones */}
        <div className="keybindings-modal__footer">
          <button
            type="button"
            className="keybindings-footer-btn keybindings-footer-btn--reset"
            onClick={handleResetDefaults}
          >
            🔄 Restablecer
          </button>
          <button
            type="button"
            className={`keybindings-footer-btn keybindings-footer-btn--save ${
              isSaved ? 'keybindings-footer-btn--saved' : ''
            }`}
            onClick={handleSave}
          >
            {isSaved ? '✅ ¡Guardado!' : '💾 Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
