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
  { key: 'shovel', label: 'Pala', icon: '🪓', category: 'tools' },
  { key: 'cancel', label: 'Cancelar', icon: '❌', category: 'tools' },
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
        {/* Cabecera compacta con Título y Presets en la misma barra superior */}
        <div className="keybindings-modal__topbar">
          <div className="keybindings-modal__title-box">
            <span className="keybindings-modal__icon">🎮</span>
            <div>
              <h3 className="keybindings-modal__title">CONTROLES DE COMBATE</h3>
              <span className="keybindings-modal__subtitle">
                Haz clic en una ranura y presiona la nueva tecla
              </span>
            </div>
          </div>

          {/* Presets Rápidos en la barra superior */}
          <div className="keybindings-presets-row">
            <span className="keybindings-presets-tag">⚡ PERFILES:</span>
            {Object.values(KEYBINDINGS_PRESETS).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`keybindings-preset-pill ${
                  activePresetId === p.id ? 'keybindings-preset-pill--active' : ''
                }`}
                onClick={() => handleApplyPreset(p.id)}
                title={p.description}
              >
                <span>{p.icon}</span>
                <span>{p.name.split(' ')[0]}</span>
              </button>
            ))}
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

        {/* Mensaje de conflicto o intercambio automático */}
        {conflictMsg && (
          <div className="keybindings-conflict-toast">
            <span>{conflictMsg}</span>
          </div>
        )}

        {/* 6 Ranuras de Plantas (Mazo horizontal en una sola fila, igual que en batalla) */}
        <div className="keybindings-deck-section">
          <div className="keybindings-deck-header">
            <span className="keybindings-deck-title">🌱 RANURAS DE CARTAS EN MANO (DECK)</span>
            <span className="keybindings-deck-hint">
              Disposición horizontal de izquierda a derecha (como en batalla)
            </span>
          </div>

          <div className="keybindings-deck-slots-row">
            {cardActions.map((action, idx) => {
              const isListening = listeningSlot === action.key
              const keyVal = bindings[action.key]
              return (
                <div
                  key={action.key}
                  className={`keybindings-deck-slot ${
                    isListening ? 'keybindings-deck-slot--listening' : ''
                  }`}
                  onClick={() => {
                    setConflictMsg(null)
                    setListeningSlot(isListening ? null : action.key)
                  }}
                  title="Haz clic para reasignar esta tecla"
                >
                  <div className="keybindings-deck-slot__top">
                    <span className="keybindings-deck-slot__badge">#{idx + 1}</span>
                    <span className="keybindings-deck-slot__icon">{action.icon}</span>
                  </div>
                  <span className="keybindings-deck-slot__name">{action.label}</span>
                  <button
                    type="button"
                    className={`keybindings-key-btn ${
                      isListening ? 'keybindings-key-btn--listening' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setConflictMsg(null)
                      setListeningSlot(isListening ? null : action.key)
                    }}
                  >
                    {isListening ? '...' : formatKeyLabel(keyVal)}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Barra Inferior: Herramientas a la izquierda y Botones de Guardar/Reset a la derecha */}
        <div className="keybindings-bottom-bar">
          <div className="keybindings-tools-group">
            <span className="keybindings-tools-label">🛠️ HERRAMIENTAS:</span>
            {toolActions.map((action) => {
              const isListening = listeningSlot === action.key
              const keyVal = bindings[action.key]
              return (
                <div
                  key={action.key}
                  className={`keybindings-tool-pill ${
                    isListening ? 'keybindings-tool-pill--listening' : ''
                  }`}
                  onClick={() => {
                    setConflictMsg(null)
                    setListeningSlot(isListening ? null : action.key)
                  }}
                  title="Haz clic para reasignar"
                >
                  <span className="keybindings-tool-pill__icon">{action.icon}</span>
                  <span className="keybindings-tool-pill__name">{action.label}</span>
                  <button
                    type="button"
                    className={`keybindings-key-btn keybindings-key-btn--small ${
                      isListening ? 'keybindings-key-btn--listening' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setConflictMsg(null)
                      setListeningSlot(isListening ? null : action.key)
                    }}
                  >
                    {isListening ? '...' : formatKeyLabel(keyVal)}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="keybindings-actions-group">
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
    </div>
  )
}
