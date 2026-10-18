import { useState, useMemo } from 'react'
import { soundManager } from '../../utils/audioManager'
import { BATTLE_PASS_LEVELS, type PassLevel } from '../../utils/battlePassManager'
import PixelVipPass from '../Shop/PixelVipPass'
import '../Shop/Shop.css'
import './BattlePass.css'

interface BattlePassProps {
  userElo?: number
  userXp?: number
  hasVipPass: boolean
  claimedVipLevels: number[]
  onBuyVipPass: () => void
  onClaimReward: (level: PassLevel) => void
  onClaimAllRewards?: (levels: PassLevel[]) => void
  onBackToMenu?: () => void
  userGold?: number
  userTokens?: number
  playerEnergy?: number
}

export default function BattlePass({
  userElo: _userElo = 1000,
  userXp = 0,
  hasVipPass,
  claimedVipLevels,
  onBuyVipPass,
  onClaimReward,
  onClaimAllRewards,
  onBackToMenu,
  userGold,
  userTokens,
  playerEnergy,
}: BattlePassProps) {
  const [useClassic, setUseClassic] = useState(false)

  if (!useClassic) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <PixelVipPass
          onBackToHome={onBackToMenu || (() => {})}
          onToggleClassic={() => setUseClassic(true)}
          userXp={userXp}
          userGold={userGold}
          userTokens={userTokens}
          playerEnergy={playerEnergy}
          maxPlayerEnergy={hasVipPass ? 25 : 20}
          userElo={_userElo}
          hasVipPass={hasVipPass}
          claimedVipLevels={claimedVipLevels}
          onBuyVipPass={onBuyVipPass}
          onClaimReward={onClaimReward}
          onClaimAllRewards={onClaimAllRewards}
        />
      </div>
    )
  }
  const currentXp = userXp ?? 0
  const totalMaxXp = BATTLE_PASS_LEVELS[BATTLE_PASS_LEVELS.length - 1]?.requiredXp ?? 8000

  // Determine highest reached level and next target based on XP and claimed levels
  const highestClaimed = claimedVipLevels.length > 0 ? Math.max(...claimedVipLevels) : 0
  const highestLevelReached = Math.max(
    highestClaimed,
    BATTLE_PASS_LEVELS.filter((l) => currentXp >= l.requiredXp).length
  )
  const nextLevel = BATTLE_PASS_LEVELS.find((l) => currentXp < l.requiredXp)

  // List of all levels currently ready to be claimed (only if user has VIP pass)
  const claimableLevels = useMemo(() => {
    return hasVipPass
      ? BATTLE_PASS_LEVELS.filter(
          (l) => currentXp >= l.requiredXp && !claimedVipLevels.includes(l.level)
        )
      : []
  }, [hasVipPass, currentXp, claimedVipLevels])

  // Count of levels unlocked by XP but awaiting VIP purchase
  const pendingVipUnlockCount = useMemo(() => {
    if (hasVipPass) return 0
    return BATTLE_PASS_LEVELS.filter((l) => currentXp >= l.requiredXp).length
  }, [hasVipPass, currentXp])

  // Default selected level: first ready level, or highest reached level, or level 1
  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(() => {
    if (claimableLevels.length > 0) return claimableLevels[0].level
    if (highestLevelReached > 0) return Math.min(20, highestLevelReached)
    return 1
  })

  // Level 20 Interactive States: Card Flip & Pack Pulse
  const [isLvl20CardFlipped, setIsLvl20CardFlipped] = useState(false)
  const [revealedLegendaryIdx, setRevealedLegendaryIdx] = useState(0)
  const [packPulseActive, setPackPulseActive] = useState(false)

  const legendaryShowcasePool = [
    {
      name: 'Threepeater (Tripitidora)',
      icon: '/game-assets/greenfoot/threepeater1.webp',
      badge: '👑 LEYENDA T2',
      desc: 'Dispara guisantes en 3 carriles simultáneamente.',
    },
    {
      name: 'Lechuga Helada (Iceberg)',
      icon: '/game-assets/plants/iceberglettuce_hd.webp',
      badge: '❄️ LEYENDA T2',
      desc: 'Congela a todos los enemigos de la arena por 7 segundos.',
    },
  ]

  const selectedPassLvl =
    BATTLE_PASS_LEVELS.find((l) => l.level === selectedLevelNum) || BATTLE_PASS_LEVELS[0]

  const isSelectedUnlocked = currentXp >= selectedPassLvl.requiredXp
  const isSelectedClaimed = claimedVipLevels.includes(selectedPassLvl.level)
  const isSelectedReady = hasVipPass && isSelectedUnlocked && !isSelectedClaimed

  const handleClaimAll = () => {
    if (claimableLevels.length === 0) return
    soundManager.playSound('plantation', 1)
    if (onClaimAllRewards) {
      onClaimAllRewards(claimableLevels)
    } else {
      claimableLevels.forEach((lvl) => onClaimReward(lvl))
    }
  }

  const handleLvl20PackClick = () => {
    soundManager.playSound('plantation', 1.0)
    setPackPulseActive(true)
    setTimeout(() => setPackPulseActive(false), 900)
  }

  const handleLvl20CardFlip = () => {
    soundManager.playSound('plantation', 0.8)
    setIsLvl20CardFlipped((prev) => !prev)
    // Alternate between legendary plants on each flip
    setRevealedLegendaryIdx((prev) => (prev + 1) % legendaryShowcasePool.length)
  }

  const xpProgressPercent = Math.min(100, Math.round((currentXp / totalMaxXp) * 100))

  return (
    <div className="battle-pass-container">
      {/* Top Banner Status with Season XP Progress */}
      <div className="battle-pass-banner">
        <div className="battle-pass-banner__info">
          <div className="battle-pass-banner__season-badge">
            <span>🔥 TEMPORADA 2: REBELIÓN BOTÁNICA</span>
          </div>
          <h2 className="battle-pass-banner__title">
            PASE DE TEMPORADA VIP — NIVEL {highestLevelReached}/20
          </h2>

          <div className="battle-pass-banner__xp-container">
            <div className="battle-pass-xp-bar-track">
              <div
                className="battle-pass-xp-bar-fill"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
            <span className="battle-pass-xp-label">
              ⚡ {currentXp.toLocaleString()} / {totalMaxXp.toLocaleString()} XP ({xpProgressPercent}%)
            </span>
          </div>

          <p className="battle-pass-banner__desc">
            {nextLevel
              ? `⚡ Tienes ${currentXp} XP. Alcanza ${nextLevel.requiredXp} XP (+${
                  nextLevel.requiredXp - currentXp
                } XP) para desbloquear el Nivel ${nextLevel.level}. (+25 XP por Victoria Ranked | +35 XP por Misión)`
              : `👑 ¡HAS ALCANZADO EL NIVEL MÁXIMO 20 (3,300 XP)!`}
          </p>

          {!hasVipPass && pendingVipUnlockCount > 0 && (
            <div className="battle-pass-banner__accumulated-tag">
              🎁 ¡Tienes <strong>{pendingVipUnlockCount} niveles alcanzados</strong> listos para cobrar de golpe al activar el Pase VIP!
            </div>
          )}
        </div>

        <div className="battle-pass-banner__actions">
          {hasVipPass ? (
            <>
              {claimableLevels.length > 1 && (
                <button
                  type="button"
                  className="battle-pass-claim-all-btn"
                  onClick={handleClaimAll}
                >
                  ✨ RECLAMAR TODO ({claimableLevels.length})
                </button>
              )}
              <div className="battle-pass-vip-badge">
                <span className="battle-pass-vip-crown">👑</span>
                <span>PASE VIP ACTIVADO ✓</span>
              </div>
            </>
          ) : (
            <div className="battle-pass-banner-buy-wrap">
              <button
                type="button"
                className="battle-pass-buy-btn"
                onClick={onBuyVipPass}
                title="Desbloquea todos los niveles acumulados y recompensas exclusivas"
              >
                👑 COMPRAR PASE VIP (2,500 💎)
              </button>
              <span className="battle-pass-buy-badge-sub">20 Niveles • +5 Energías</span>
            </div>
          )}
        </div>
      </div>

      {/* DUAL-PANEL SHOWCASE GAMING LAYOUT */}
      <div className="battle-pass-showcase-layout">
        {/* LEFT PANEL: 20 LEVEL SELECTOR GRID */}
        <div className="pass-selector-panel">
          <div className="pass-selector-header">
            <div className="pass-selector-header-top">
              <span className="pass-selector-title">🛣️ CAMINO DE RECOMPENSAS (20 NIVELES)</span>
              {!hasVipPass && (
                <span className="pass-selector-vip-hint">🔒 VIP REQUERIDO PARA COBRAR</span>
              )}
            </div>
            <span className="pass-selector-sub">
              Toca un nivel para inspeccionar su premio. Gana +25 XP en Ranked PvP y +35 XP en Misiones.
            </span>
          </div>

          <div className="pass-grid-selector">
            {BATTLE_PASS_LEVELS.map((passLvl) => {
              const isUnlocked = currentXp >= passLvl.requiredXp
              const isClaimed = claimedVipLevels.includes(passLvl.level)
              const isReady = hasVipPass && isUnlocked && !isClaimed
              const isNeedsVip = !hasVipPass && isUnlocked
              const isSelected = passLvl.level === selectedLevelNum

              let stateClass = 'pass-grid-node--locked'
              if (isClaimed) stateClass = 'pass-grid-node--claimed'
              else if (isReady) stateClass = 'pass-grid-node--ready'
              else if (isNeedsVip) stateClass = 'pass-grid-node--needs-vip'
              else if (hasVipPass && isUnlocked) stateClass = 'pass-grid-node--unlocked'
              else stateClass = 'pass-grid-node--locked'

              const isLvl20 = passLvl.level === 20

              return (
                <button
                  key={passLvl.level}
                  type="button"
                  className={`pass-grid-node ${stateClass} ${
                    isSelected ? 'pass-grid-node--selected' : ''
                  } ${isLvl20 ? 'pass-grid-node--legendary-final' : ''}`}
                  onClick={() => {
                    soundManager.playSound('plantation', 0.3)
                    setSelectedLevelNum(passLvl.level)
                  }}
                >
                  <div className="pass-grid-node__top">
                    <span className="pass-grid-node__lvl">
                      {isLvl20 ? '👑 LVL 20' : `LVL ${passLvl.level}`}
                    </span>
                    <span className="pass-grid-node__status">
                      {isClaimed
                        ? '✅'
                        : isReady
                        ? '✨'
                        : isNeedsVip
                        ? '👑'
                        : '🔒'}
                    </span>
                  </div>

                  <div className="pass-grid-node__icon-wrap">
                    <img
                      src={passLvl.reward.icon}
                      alt={passLvl.reward.label}
                      className="pass-grid-node__icon"
                    />
                    {isLvl20 && <span className="pass-grid-node__double-badge">2x</span>}
                  </div>

                  <span className="pass-grid-node__elo">{passLvl.requiredXp} XP</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* RIGHT PANEL: 3D GLOWING PEDESTAL SHOWCASE */}
        <div className="pass-pedestal-showcase">
          <div className="pass-pedestal-header">
            <span className="pass-pedestal-tier-badge">
              🏆 NIVEL {selectedPassLvl.level} — {selectedPassLvl.requiredXp} XP
            </span>
            <h3 className="pass-pedestal-title">{selectedPassLvl.reward.label}</h3>
            <span className="pass-pedestal-subtitle">
              {selectedPassLvl.level === 20
                ? '⭐ Gran Recompensa Doble Suprema de Temporada'
                : 'Recompensa Exclusiva del Pase de Temporada'}
            </span>
          </div>

          {/* Glowing Pedestal & Floating 3D Reward(s) */}
          <div className="pass-pedestal-stage">
            <div className="pass-pedestal-light-beams" />
            <div className="pass-pedestal-halo" />

            {selectedPassLvl.level === 20 ? (
              /* LEVEL 20: DUAL REWARD SHOWCASE (LEGENDARY PACK + RANDOM 3D FLIP CARD) */
              <div className="pass-lvl20-dual-showcase">
                {/* 1. Pack Legendario de Tienda */}
                <div
                  className={`pass-lvl20-pack-card ${packPulseActive ? 'pass-lvl20-pack-card--active' : ''}`}
                  onClick={handleLvl20PackClick}
                  title="Haz clic para inspeccionar el Sobre Legendario"
                >
                  <div className="pass-lvl20-item-badge">① SOBRE LEGENDARIO</div>
                  <img
                    src={selectedPassLvl.reward.icon}
                    alt="Sobre Legendario"
                    className="pass-lvl20-pack-img"
                  />
                  <span className="pass-lvl20-item-name">Pack Legendario VIP</span>
                  <span className="pass-lvl20-item-sub">Cartas Épicas & Legendarias</span>
                </div>

                {/* 2. Carta Legendaria Misteriosa con Flip 3D */}
                <div
                  className={`pass-3d-flip-card ${isLvl20CardFlipped ? 'pass-3d-flip-card--flipped' : ''}`}
                  onClick={handleLvl20CardFlip}
                  title="¡Haz clic en la carta para girarla y revelar la planta legendaria!"
                >
                  <div className="pass-3d-flip-inner">
                    {/* Front: Misterio dorado */}
                    <div className="pass-3d-flip-front">
                      <div className="pass-lvl20-item-badge pass-lvl20-item-badge--mystery">
                        ② CARTA MISTERIOSA
                      </div>
                      <div className="pass-mystery-card-glow" />
                      <div className="pass-mystery-icon">❓</div>
                      <span className="pass-mystery-title">Carta Legendaria</span>
                      <span className="pass-mystery-hint">✨ Toca para girar</span>
                    </div>

                    {/* Back: Planta Legendaria Revelada */}
                    <div className="pass-3d-flip-back">
                      <div className="pass-lvl20-item-badge pass-lvl20-item-badge--legendary">
                        {legendaryShowcasePool[revealedLegendaryIdx].badge}
                      </div>
                      <img
                        src={legendaryShowcasePool[revealedLegendaryIdx].icon}
                        alt="Legendaria"
                        className="pass-legendary-revealed-img"
                      />
                      <span className="pass-legendary-revealed-name">
                        {legendaryShowcasePool[revealedLegendaryIdx].name}
                      </span>
                      <span className="pass-legendary-revealed-desc">
                        {legendaryShowcasePool[revealedLegendaryIdx].desc}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Extra Gold Badge */}
                <div className="pass-lvl20-gold-badge">
                  <span>🪙 +1,000 Oro Incluido</span>
                </div>
              </div>
            ) : (
              /* REGULAR LEVELS 1 TO 19 SHOWCASE */
              <div className="pass-pedestal-floating-item">
                <img
                  src={selectedPassLvl.reward.icon}
                  alt={selectedPassLvl.reward.label}
                  className={`pass-pedestal-img ${
                    isSelectedReady
                      ? 'pass-pedestal-img--ready'
                      : isSelectedClaimed
                      ? 'pass-pedestal-img--claimed'
                      : ''
                  }`}
                />
                {selectedPassLvl.reward.goldAmount && (
                  <div className="pass-pedestal-extra-gold">
                    🪙 +{selectedPassLvl.reward.goldAmount} Oro
                  </div>
                )}
              </div>
            )}

            {/* 3D Pedestal Base */}
            <div className="pass-pedestal-base">
              <div className="pass-pedestal-base-top" />
              <div className="pass-pedestal-base-body" />
            </div>
          </div>

          {/* Action Button Section */}
          <div className="pass-pedestal-action-box">
            {isSelectedClaimed ? (
              <div className="pass-pedestal-status-btn pass-pedestal-status-btn--claimed">
                ✅ RECOMPENSA RECLAMADA
              </div>
            ) : isSelectedReady ? (
              <button
                type="button"
                className="pass-pedestal-claim-btn"
                onClick={() => {
                  soundManager.playSound('plantation', 0.9)
                  onClaimReward(selectedPassLvl)
                }}
              >
                {selectedPassLvl.level === 20
                  ? '✨ RECLAMAR GRAN PREMIO DOBLE SUPREMO'
                  : '✨ RECLAMAR RECOMPENSA'}
              </button>
            ) : !hasVipPass ? (
              /* NON-VIP USER: ALWAYS SHOW THE OPTION TO BUY/UNLOCK WITH XP CONTEXT */
              <div className="pass-pedestal-vip-buy-box">
                <div
                  className={`pass-pedestal-xp-status ${
                    isSelectedUnlocked
                      ? 'pass-pedestal-xp-status--unlocked'
                      : 'pass-pedestal-xp-status--locked'
                  }`}
                >
                  {isSelectedUnlocked
                    ? `✨ ¡Nivel alcanzado con ${currentXp.toLocaleString()} XP!`
                    : `🔒 Requiere ${selectedPassLvl.requiredXp.toLocaleString()} XP (Tienes ${currentXp.toLocaleString()} XP)`}
                </div>
                <button
                  type="button"
                  className={`pass-pedestal-vip-btn ${
                    isSelectedUnlocked ? 'pass-pedestal-vip-btn--claim-ready' : ''
                  }`}
                  onClick={onBuyVipPass}
                  title="Compra el Pase VIP para desbloquear los 20 niveles y reclamar tus recompensas"
                >
                  <div className="pass-pedestal-vip-btn-row">
                    <span className="pass-pedestal-vip-btn-crown">👑</span>
                    <span className="pass-pedestal-vip-btn-text">
                      {isSelectedUnlocked ? 'ACTIVAR VIP Y RECLAMAR' : 'COMPRAR PASE VIP'}
                    </span>
                    <span className="pass-pedestal-vip-btn-price">(2,500 💎)</span>
                  </div>
                  <span className="pass-pedestal-vip-btn-sub">
                    {isSelectedUnlocked
                      ? '¡Reclama esta recompensa y todas las que alcances!'
                      : 'Desbloquea los 20 niveles VIP, +5 Energías Diarias y Mercado P2P'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="pass-pedestal-status-btn pass-pedestal-status-btn--locked">
                🔒 REQUIERE {selectedPassLvl.requiredXp} XP (TIENES {currentXp} XP)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
