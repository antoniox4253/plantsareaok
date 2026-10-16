import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ArenaAdsLoot } from '../../utils/arenaAdsManager'
import { soundManager } from '../../utils/audioManager'
import { activateMonetagVignette } from '../../utils/arenaAdsNetwork'
import './ArenaAdsModal.css'

interface ArenaAdsInterstitialModalProps {
  isOpen: boolean
  mode?: 'victory' | 'defeat'
  levelCleared: number
  accumulatedLoot?: ArenaAdsLoot
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
  accumulatedLoot: _accumulatedLoot,
  onNextLevel,
  onCashout,
  onRevive: _onRevive,
  isReviving: _isReviving = false,
  multiplier: _multiplier = 1,
}: ArenaAdsInterstitialModalProps) {
  const [countdown, setCountdown] = useState<number>(3)

  useEffect(() => {
    if (isOpen) {
      activateMonetagVignette()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || mode === 'defeat' || levelCleared >= 50) {
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
  }, [isOpen, mode, levelCleared])

  if (!isOpen || typeof document === 'undefined') return null

  const isDefeat = mode === 'defeat'
  const isMaxLevelReached = levelCleared >= 50
  const levelsSuccessfullyCleared = isDefeat ? Math.max(0, levelCleared - 1) : levelCleared
  const earnedTokens = levelsSuccessfullyCleared * 2
  const earnedPacks = Math.floor(levelsSuccessfullyCleared / 10)
  const earnedRareCards = Math.floor(levelsSuccessfullyCleared / 25)

  return createPortal(
    <div className="arena-ads-interstitial-backdrop">
      <div className="arena-ads-interstitial-card" style={isDefeat ? { borderColor: '#ef4444', boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)' } : isMaxLevelReached ? { borderColor: '#fbbf24', boxShadow: '0 0 35px rgba(245, 158, 11, 0.6)' } : undefined}>
        <h3 className="arena-ads-interstitial-title" style={isDefeat ? { color: '#ef4444' } : isMaxLevelReached ? { color: '#fbbf24' } : undefined}>
          {isDefeat
            ? `💀 ¡HAS CAÍDO EN EL NIVEL ${levelCleared}!`
            : isMaxLevelReached
            ? `🏆 ¡SUPERVIVENCIA CONQUISTADA! (NIVEL ${levelCleared})`
            : `🎉 ¡NIVEL ${levelCleared} SUPERADO!`}
        </h3>

        {/* MENSAJE DE ESTADO ENTRE NIVELES */}
        <div className="arena-ads-interstitial-ad-shell">
          <span style={{ fontSize: '12px', color: isDefeat ? '#fca5a5' : isMaxLevelReached ? '#fbbf24' : '#86efac', textAlign: 'center', padding: '6px', fontWeight: 600 }}>
            {isDefeat
              ? `🛡️ ¡Fin de la expedición! Superaste ${levelsSuccessfullyCleared} niveles. Solo tenías 1 intento, pero te llevas todo lo ganado a tu inventario y saldo de PLANTS.`
              : isMaxLevelReached
              ? '👑 ¡Felicidades, Gladiador! Has conquistado los 50 niveles de Survivor ADS. Reclama tu botín supremo ahora.'
              : '🧟 ¡Las 3 oleadas fueron derrotadas con éxito! Tu botín de Token PLANTS sigue aumentando.'}
          </span>
        </div>

        {/* BOTÍN ACUMULADO ACTUAL */}
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>💰 BOTÍN TOTAL ACUMULADO ({levelsSuccessfullyCleared} NIVELES SUPERADOS):</span>
            <span style={{ background: '#10b981', color: '#fff', padding: '1px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
              SURVIVOR ADS
            </span>
          </div>
          <div className="arena-ads-loot-pills" style={{ justifyContent: 'center', gap: '8px' }}>
            <div className="arena-ads-loot-pill" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', fontWeight: 800 }}>
              <span>🌱</span> +{earnedTokens} Token PLANTS
            </div>
            {earnedPacks > 0 && (
              <div className="arena-ads-loot-pill" style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 800 }}>
                <span>📦</span> +{earnedPacks} Sobre{earnedPacks > 1 ? 's' : ''} Básico{earnedPacks > 1 ? 's' : ''}
              </div>
            )}
            {earnedRareCards > 0 && (
              <div className="arena-ads-loot-pill" style={{ background: 'rgba(168, 85, 247, 0.2)', border: '1px solid #a855f7', color: '#c084fc', fontWeight: 800 }}>
                <span>🌟</span> +{earnedRareCards} Carta{earnedRareCards > 1 ? 's' : ''} Rara{earnedRareCards > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* DECISIONES */}
        {isDefeat ? (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '12px' }}>
            <button
              type="button"
              className="arena-ads-btn"
              style={{
                width: '100%',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#34d399',
                color: '#ffffff',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
              }}
              onClick={() => {
                soundManager.playSound('click', 0.5)
                onCashout() // Reclamar botín ganado de la expedición
              }}
            >
              🏆 RECLAMAR BOTÍN Y SALIR AL LOBBY
            </button>
          </div>
        ) : isMaxLevelReached ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
            <button
              type="button"
              className="arena-ads-btn arena-ads-btn--cashout"
              style={{
                width: '100%',
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
                borderColor: '#fbbf24',
                color: '#ffffff',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.6)',
                letterSpacing: '0.5px',
              }}
              onClick={() => {
                soundManager.playSound('click', 0.5)
                onCashout()
              }}
            >
              🏆 RECLAMAR BOTÍN SUPREMO Y SALIR AL LOBBY
            </button>
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
