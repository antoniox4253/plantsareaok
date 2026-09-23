import { useState, useEffect } from 'react'
import type { ArenaAdsLoot } from '../../utils/arenaAdsManager'
import { soundManager } from '../../utils/audioManager'
import './ArenaAdsModal.css'

interface ArenaAdsInterstitialModalProps {
  isOpen: boolean
  levelCleared: number
  accumulatedLoot: ArenaAdsLoot
  onNextLevel: () => void
  onCashout: () => void
}

export default function ArenaAdsInterstitialModal({
  isOpen,
  levelCleared,
  accumulatedLoot,
  onNextLevel,
  onCashout,
}: ArenaAdsInterstitialModalProps) {
  const [countdown, setCountdown] = useState<number>(3)

  useEffect(() => {
    if (!isOpen) {
      setCountdown(3)
      return
    }
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
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="arena-ads-interstitial-backdrop">
      <div className="arena-ads-interstitial-card">
        <h3 className="arena-ads-interstitial-title">
          🎉 ¡NIVEL {levelCleared} SUPERADO!
        </h3>

        {/* CASCARÓN DE ANUNCIO ENTRE NIVELES */}
        <div className="arena-ads-interstitial-ad-shell">
          <span className="arena-ads-interstitial-ad-tag">[ PUBLICIDAD / AD INTERSTITIAL ]</span>
          <div className="arena-ads-interstitial-ad-mock">📺</div>
          <p className="arena-ads-interstitial-ad-text">
            <strong>Espacio de Publicidad Patrocinada</strong>
            <br />
            (Contenedor preparado para red de anuncios sin salir de la página)
          </p>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            🛡️ Tu progreso y botín están 100% blindados en caché.
          </span>
        </div>

        {/* BOTÍN ACUMULADO ACTUAL */}
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '12px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 700 }}>
            💰 BOTÍN TOTAL ACUMULADO HASTA AHORA:
          </div>
          <div className="arena-ads-loot-pills" style={{ justifyContent: 'center' }}>
            <div className="arena-ads-loot-pill arena-ads-loot-pill--gold">
              <span>🪙</span> {accumulatedLoot.gold} Oro
            </div>
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

        {/* DECISIÓN: RETIRARSE O AVANZAR */}
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
      </div>
    </div>
  )
}
