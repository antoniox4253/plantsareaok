import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ArenaAdsLoot } from '../../utils/arenaAdsManager'
import { soundManager } from '../../utils/audioManager'
import { activateMonetagVignette } from '../../utils/arenaAdsNetwork'
import GoldIcon from '../Common/GoldIcon'
import './ArenaAdsModal.css'

interface ArenaAdsInterstitialModalProps {
  isOpen: boolean
  mode?: 'victory' | 'defeat'
  levelCleared: number
  accumulatedLoot: ArenaAdsLoot
  onNextLevel: () => void
  onCashout: () => void
  onRevive?: () => void
  isReviving?: boolean
  multiplier?: number
}

export default function ArenaAdsInterstitialModal({
  isOpen,
  mode = 'victory',
  levelCleared,
  accumulatedLoot,
  onNextLevel,
  onCashout,
  onRevive,
  isReviving = false,
  multiplier = 1,
}: ArenaAdsInterstitialModalProps) {
  const [countdown, setCountdown] = useState<number>(3)

  useEffect(() => {
    if (isOpen) {
      activateMonetagVignette()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || mode === 'defeat') {
      setCountdown(0)
      return
    }
    setCountdown(3)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, mode])

  if (!isOpen || typeof document === 'undefined') return null

  const isDefeat = mode === 'defeat'

  return createPortal(
    <div className="arena-ads-interstitial-backdrop">
      <div className="arena-ads-interstitial-card" style={isDefeat ? { borderColor: '#ef4444', boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)' } : undefined}>
        <h3 className="arena-ads-interstitial-title" style={isDefeat ? { color: '#ef4444' } : undefined}>
          {isDefeat ? `💀 ¡HAS CAÍDO EN EL NIVEL ${levelCleared}!` : `🎉 ¡NIVEL ${levelCleared} SUPERADO!`}
        </h3>

        {/* MENSAJE DE ESTADO ENTRE NIVELES */}
        <div className="arena-ads-interstitial-ad-shell">
          <span style={{ fontSize: '11px', color: isDefeat ? '#f87171' : '#94a3b8', textAlign: 'center', padding: '6px' }}>
            {isDefeat
              ? '⚠️ Si sales al lobby perderás el botín sin asegurar de esta expedición (podrás volver a desafiar la mazmorra pagando 350 🪙 Oro desde el Nivel 1). O revive de inmediato por 150 💎 Gemas.'
              : '🛡️ Tu progreso y botín están 100% blindados en caché.'}
          </span>
        </div>

        {/* BOTÍN ACUMULADO ACTUAL */}
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '10px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>💰 BOTÍN TOTAL ACUMULADO HASTA AHORA:</span>
            {multiplier === 2 && (
              <span style={{ background: '#7c3aed', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
                ⚡ 2X ACTIVO
              </span>
            )}
          </div>
          <div className="arena-ads-loot-pills" style={{ justifyContent: 'center' }}>
            {accumulatedLoot.gold > 0 && (
              <div className="arena-ads-loot-pill arena-ads-loot-pill--gold">
                <GoldIcon size={16} /> {accumulatedLoot.gold} Oro
              </div>
            )}
            <div className="arena-ads-loot-pill arena-ads-loot-pill--gems">
              <span>💎</span> {accumulatedLoot.gems} Gemas
            </div>
            {Object.entries(accumulatedLoot.items).map(([id, qty]) => (
              <div key={id} className="arena-ads-loot-pill arena-ads-loot-pill--items">
                <span>🎒</span> {qty} {id}
              </div>
            ))}
          </div>
        </div>

        {/* DECISIONES */}
        {isDefeat ? (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px' }}>
            <button
              type="button"
              className="arena-ads-btn arena-ads-btn--secondary"
              style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444', color: '#fca5a5' }}
              onClick={() => {
                soundManager.playSound('click', 0.5)
                onCashout() // Abandonar y perder botín de la sesión
              }}
            >
              🚪 SALIR AL LOBBY
            </button>

            {onRevive && (
              <button
                type="button"
                className="arena-ads-btn"
                style={{
                  background: 'linear-gradient(180deg, #ec4899 0%, #db2777 100%)',
                  border: '2px solid #f472b6',
                  color: '#ffffff',
                  boxShadow: '0 0 15px rgba(236, 72, 153, 0.5)',
                  fontWeight: 800,
                }}
                disabled={isReviving}
                onClick={() => {
                  soundManager.playSound('click', 0.5)
                  onRevive()
                }}
              >
                {isReviving ? '⏳ REVIVIENDO...' : '❤️ REVIVIR (150 💎 GEMAS)'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '6px' }}>
            <button
              type="button"
              className="arena-ads-btn arena-ads-btn--cashout"
              onClick={() => {
                soundManager.playSound('click', 0.5)
                onCashout()
              }}
            >
              💰 RETIRARSE AHORA
            </button>

            <button
              type="button"
              className="arena-ads-btn arena-ads-btn--primary"
              onClick={() => {
                soundManager.playSound('click', 0.5)
                onNextLevel()
              }}
            >
              {countdown > 0 ? `AVANZAR AL NIVEL ${levelCleared + 1} (${countdown}s)` : `AVANZAR AL NIVEL ${levelCleared + 1} ⚔️`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
