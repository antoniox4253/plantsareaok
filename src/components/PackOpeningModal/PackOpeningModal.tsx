import { useEffect } from 'react'
import type { PackDropResult } from '../../utils/packDropManager'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import { soundManager } from '../../utils/audioManager'
import './PackOpeningModal.css'

interface PackOpeningModalProps {
  result: PackDropResult | PackDropResult[]
  packsOpened?: number
  onClose: () => void
  onOpenAnother?: () => void
  hasMorePacks?: boolean
}

export default function PackOpeningModal({
  result,
  packsOpened,
  onClose,
  onOpenAnother,
  hasMorePacks = false,
}: PackOpeningModalProps) {
  useEffect(() => {
    soundManager.playSound('plantation', 1.0)
  }, [])

  const isArray = Array.isArray(result)
  const resultsList: PackDropResult[] = isArray ? result : [result]

  if (resultsList.length === 0) return null

  // Determinar con certeza la cantidad de sobres abiertos
  const packCount = typeof packsOpened === 'number' && packsOpened > 0
    ? packsOpened
    : (isArray && resultsList.length > 4 ? Math.round(resultsList.length / 3) : 1)

  const isMulti = packCount > 1
  const newCount = resultsList.filter((r) => r.isNew).length

  return (
    <div className="pack-reveal-overlay">
      <div className="pack-reveal-card pack-reveal-card--multi">
        <div className="pack-reveal-card__rays" />

        <div className="pack-reveal-card__header">
          <span
            className="pack-reveal-card__rarity"
            style={{
              backgroundColor: isMulti ? '#fbbf2433' : '#10b98133',
              color: isMulti ? '#fbbf24' : '#34d399',
              borderColor: isMulti ? '#fbbf24' : '#34d399',
            }}
          >
            {isMulti
              ? `💥 ¡APERTURA MÚLTIPLE DE ${packCount} SOBRES! 💥`
              : '🎉 ¡SOBRE ABIERTO CON ÉXITO! 🎉'}
          </span>
          <div className="pack-reveal-card__new-tag">
            {newCount > 0
              ? `✨ ¡${newCount} NUEVA${newCount > 1 ? 'S' : ''} PLANTA${newCount > 1 ? 'S' : ''} DESBLOQUEADA${newCount > 1 ? 'S' : ''}!`
              : isMulti
              ? `🃏 ${resultsList.length} CARTAS OBTENIDAS EN TOTAL`
              : `🃏 ${resultsList.length} CARTAS OBTENIDAS`}
          </div>
        </div>

        {/* Grid de cartas obtenidas */}
        <div className="pack-reveal-multi-grid">
          {resultsList.map((drop, idx) => {
            const cfg = PLANT_CONFIGS[drop.plantId]
            if (!cfg) return null

            return (
              <div key={idx} className="pack-reveal-multi-item">
                <span
                  className="pack-reveal-multi-rarity"
                  style={{ color: drop.rarityColor, borderColor: drop.rarityColor }}
                >
                  {drop.rarityLabel}
                </span>
                <img src={cfg.icon} alt={cfg.name} className="pack-reveal-multi-img" />
                <span className="pack-reveal-multi-name">{cfg.name}</span>
                {drop.isNew ? (
                  <span className="pack-reveal-multi-new">✨ ¡NUEVA!</span>
                ) : (
                  <span className="pack-reveal-multi-dup">✓ OBTENIDA</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="pack-reveal-card__actions" style={{ marginTop: 16 }}>
          {!isMulti && hasMorePacks && onOpenAnother && (
            <button
              type="button"
              className="pack-reveal-btn pack-reveal-btn--sec"
              onClick={onOpenAnother}
            >
              ✨ ABRIR OTRO SOBRE
            </button>
          )}

          <button
            type="button"
            className="pack-reveal-btn pack-reveal-btn--primary"
            onClick={onClose}
          >
            {isMulti
              ? `🎒 RECLAMAR TODAS LAS RECOMPENSAS (${resultsList.length} CARTAS)`
              : '🎒 RECLAMAR Y GUARDAR EN MI JARDÍN'}
          </button>
        </div>
      </div>
    </div>
  )
}
