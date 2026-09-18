import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './MisionesModal.css'
import {
  getMissionsDashboard,
  claimDailyLoginStreak,
  claimDailyMission,
  rerollDailyMission,
  claimWeeklyChest,
  submitTikTokVideo,
  type MissionsDashboardData,
  type DailyMission,
} from '../../services/missionService'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import { soundManager } from '../../utils/audioManager'

const triggerGlobalRefresh = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('refresh_user_balance'))
    window.dispatchEvent(new CustomEvent('refresh_user_inventory'))
    window.dispatchEvent(new CustomEvent('refresh_reward_packs'))
    window.dispatchEvent(new CustomEvent('refresh_pack_slots'))
  }
}

interface MisionesModalProps {
  isOpen: boolean
  onClose: () => void
  onRewardClaimed?: () => void
  userGems?: number
}

export const MisionesModal: React.FC<MisionesModalProps> = ({
  isOpen,
  onClose,
  onRewardClaimed,
  userGems = 0
}) => {
  const [activeTab, setActiveTab] = useState<'diarias' | 'racha' | 'tiktok'>('diarias')
  const [dashboard, setDashboard] = useState<MissionsDashboardData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Reroll confirmation modal state
  const [rerollSlot, setRerollSlot] = useState<number | null>(null)

  // TikTok form state
  const [tiktokUrl, setTiktokUrl] = useState<string>('')
  const [tiktokSubmitting, setTiktokSubmitting] = useState<boolean>(false)

  // Countdown to Sept 26 23:00 UTC
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    loadDashboard()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    const target = new Date('2026-09-26T23:00:00Z').getTime()
    const updateTimer = () => {
      const now = new Date().getTime()
      const diff = Math.max(0, target - now)
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await getMissionsDashboard()
      if (data.success) {
        setDashboard(data)
      } else {
        setErrorMessage(data.error || 'Error al cargar el tablero de misiones')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleClaimStreak = async () => {
    setActionLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const res = await claimDailyLoginStreak()
      if (res.success) {
        soundManager.playSound('plantation', 0.8)
        setSuccessMessage(`¡Recompensa del Día ${res.day} reclamada con éxito!`)
        triggerGlobalRefresh()
        await loadDashboard()
        if (onRewardClaimed) onRewardClaimed()
      } else {
        setErrorMessage(res.error || 'Error al reclamar la racha diaria')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClaimMission = async (slotIndex: number) => {
    setActionLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const res = await claimDailyMission(slotIndex)
      if (res.success) {
        soundManager.playSound('plantation', 0.8)
        setSuccessMessage(`¡Misión completada! +${res.pointsGained} puntos acumulados.`)
        triggerGlobalRefresh()
        await loadDashboard()
        if (onRewardClaimed) onRewardClaimed()
      } else {
        setErrorMessage(res.error || 'No se pudo reclamar la misión')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmReroll = async () => {
    if (rerollSlot === null || rerollSlot < 2) return
    setActionLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const res = await rerollDailyMission(rerollSlot)
      if (res.success) {
        soundManager.playSound('click', 0.6)
        setSuccessMessage('¡Misión cambiada exitosamente (-5 💎)!')
        setRerollSlot(null)
        triggerGlobalRefresh()
        await loadDashboard()
        if (onRewardClaimed) onRewardClaimed()
      } else {
        setErrorMessage(res.error || 'No se pudo cambiar la misión')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClaimChest = async (tier: 'bronze' | 'silver' | 'gold') => {
    setActionLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const res = await claimWeeklyChest(tier)
      if (res.success) {
        soundManager.playSound('plantation', 0.8)
        let rewardDetail = ''
        if (tier === 'bronze') {
          rewardDetail = '¡+150 🪙 Oro y 1 Sobre Básico enviado a tu Jardín 📦!'
        } else if (tier === 'silver') {
          rewardDetail = '¡+400 🪙 Oro, +20 💎 Gemas y 1 Poción de Energía ⚡!'
        } else if (tier === 'gold') {
          rewardDetail = '¡1 Sobre Épico Místico enviado a tu Jardín 🏆!'
        }
        setSuccessMessage(`¡Cofre ${tier.toUpperCase()} reclamado con éxito! ${rewardDetail}`)
        triggerGlobalRefresh()
        await loadDashboard()
        if (onRewardClaimed) onRewardClaimed()
      } else {
        setErrorMessage(res.error || 'No se pudo reclamar el cofre')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitTikTok = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tiktokUrl.trim()) return

    setTiktokSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const res = await submitTikTokVideo(tiktokUrl.trim())
      if (res.success) {
        setSuccessMessage('¡Video enviado exitosamente! Será revisado por un administrador.')
        setTiktokUrl('')
        await loadDashboard()
      } else {
        setErrorMessage(res.error || 'Error al enviar el video de TikTok')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión')
    } finally {
      setTiktokSubmitting(false)
    }
  }

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  const weeklyPts = dashboard?.weeklyPoints || 0
  const maxWeeklyPts = 245
  const weeklyProgressPercent = Math.min(100, Math.round((weeklyPts / maxWeeklyPts) * 100))

  const hasUnclaimedMissions = dashboard?.missions?.some(
    m => !m.claimed && m.progress >= m.target
  )

  const canClaimStreak = dashboard?.loginStreak?.canClaimToday

  return createPortal(
    <div className="misiones-overlay" onClick={onClose}>
      <div className="misiones-container" onClick={e => e.stopPropagation()}>
        {/* Sábado de Fiebre de Oro Banner */}
        {dashboard?.goldRush?.isSaturday && (
          <div className="gold-rush-ribbon">
            <span>✨</span>
            <span>¡HOY ES SÁBADO DE FIEBRE DE ORO! Oro extra en cada victoria Ranked ({dashboard.goldRush.isVip ? 'x2 VIP' : '+5 o 10 Oro'})</span>
            <span>✨</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="misiones-header">
          <div className="misiones-title-wrap">
            <span style={{ fontSize: '1.8rem' }}>📜</span>
            <div>
              <h2>Misiones y Recompensas</h2>
            </div>
          </div>
          <button className="misiones-close-btn" onClick={onClose} title="Cerrar">
            ✕
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="misiones-tabs">
          <button
            className={`misiones-tab-btn ${activeTab === 'diarias' ? 'active' : ''}`}
            onClick={() => setActiveTab('diarias')}
          >
            <span>📅</span>
            <span>Misiones Diarias</span>
            {hasUnclaimedMissions && <span className="misiones-tab-badge">!</span>}
          </button>

          <button
            className={`misiones-tab-btn ${activeTab === 'racha' ? 'active' : ''}`}
            onClick={() => setActiveTab('racha')}
          >
            <span>🗓️</span>
            <span>Racha 7 Días</span>
            {canClaimStreak && <span className="misiones-tab-badge">!</span>}
          </button>

          <button
            className={`misiones-tab-btn ${activeTab === 'tiktok' ? 'active' : ''}`}
            onClick={() => setActiveTab('tiktok')}
          >
            <span>🎬</span>
            <span>Concurso TikTok</span>
            <span className="misiones-tab-badge" style={{ background: '#6366f1' }}>#PlantsArena</span>
          </button>
        </div>

        {/* Feedback banners */}
        {errorMessage && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 16px', margin: '8px 1.5rem 0', borderRadius: '8px', fontSize: '0.85rem' }}>
            ⚠️ {errorMessage}
          </div>
        )}
        {successMessage && (
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#6ee7b7', padding: '8px 16px', margin: '8px 1.5rem 0', borderRadius: '8px', fontSize: '0.85rem' }}>
            🎉 {successMessage}
          </div>
        )}

        {/* Content Body */}
        <div className="misiones-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
              <p>Cargando información del tablero...</p>
            </div>
          ) : (
            <>
              {/* ========================================================= */}
              {/* TAB 1: MISIONES DIARIAS & COFRES SEMANALES */}
              {/* ========================================================= */}
              {activeTab === 'diarias' && (
                <>
                  {/* Weekly Chest Tracker */}
                  <div className="weekly-tracker-card">
                    <div className="weekly-tracker-header">
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: '#f8fafc' }}>Progreso Semanal de Puntos</strong>
                        <div className="weekly-reset-txt">Se reinicia cada lunes a las 00:00 UTC</div>
                      </div>
                      <div className="weekly-points-badge">
                        ⭐ {weeklyPts} / {maxWeeklyPts} Pts
                      </div>
                    </div>

                    <div className="chests-progress-wrapper">
                      <div className="chests-bar-bg">
                        <div className="chests-bar-fill" style={{ width: `${weeklyProgressPercent}%` }} />
                      </div>

                      <div className="chests-nodes-container">
                        {/* Bronze Chest: 70 Pts */}
                        {(() => {
                          const isClaimable = weeklyPts >= 70 && !dashboard?.claimedChests?.includes('bronze')
                          const isClaimed = dashboard?.claimedChests?.includes('bronze')
                          return (
                            <div
                              className={`chest-node chest-node--bronze ${weeklyPts >= 70 ? 'unlocked' : ''} ${isClaimed ? 'claimed' : ''} ${isClaimable ? 'claimable' : ''}`}
                              title="Cofre de Bronce (70 Pts): 150 Oro + 1 Sobre Básico"
                              onClick={() => {
                                if (isClaimable && !actionLoading) handleClaimChest('bronze')
                              }}
                              role={isClaimable ? 'button' : undefined}
                              tabIndex={isClaimable ? 0 : undefined}
                            >
                              <div className="chest-icon-wrap">📦</div>
                              <span className="chest-points-label">70 pts</span>
                              {isClaimable && (
                                <button
                                  className="chest-claim-btn"
                                  disabled={actionLoading}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleClaimChest('bronze')
                                  }}
                                >
                                  Reclamar
                                </button>
                              )}
                              {isClaimed && (
                                <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800 }}>✓ Listo</span>
                              )}
                            </div>
                          )
                        })()}

                        {/* Silver Chest: 140 Pts */}
                        {(() => {
                          const isClaimable = weeklyPts >= 140 && !dashboard?.claimedChests?.includes('silver')
                          const isClaimed = dashboard?.claimedChests?.includes('silver')
                          return (
                            <div
                              className={`chest-node chest-node--silver ${weeklyPts >= 140 ? 'unlocked' : ''} ${isClaimed ? 'claimed' : ''} ${isClaimable ? 'claimable' : ''}`}
                              title="Cofre de Plata (140 Pts): 400 Oro + 20 Gemas + 1 Poción 5⚡"
                              onClick={() => {
                                if (isClaimable && !actionLoading) handleClaimChest('silver')
                              }}
                              role={isClaimable ? 'button' : undefined}
                              tabIndex={isClaimable ? 0 : undefined}
                            >
                              <div className="chest-icon-wrap">🥈</div>
                              <span className="chest-points-label">140 pts</span>
                              {isClaimable && (
                                <button
                                  className="chest-claim-btn"
                                  disabled={actionLoading}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleClaimChest('silver')
                                  }}
                                >
                                  Reclamar
                                </button>
                              )}
                              {isClaimed && (
                                <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800 }}>✓ Listo</span>
                              )}
                            </div>
                          )
                        })()}

                        {/* Gold Chest: 210 Pts */}
                        {(() => {
                          const isClaimable = weeklyPts >= 210 && !dashboard?.claimedChests?.includes('gold')
                          const isClaimed = dashboard?.claimedChests?.includes('gold')
                          return (
                            <div
                              className={`chest-node chest-node--gold ${weeklyPts >= 210 ? 'unlocked' : ''} ${isClaimed ? 'claimed' : ''} ${isClaimable ? 'claimable' : ''}`}
                              title="Cofre Dorado (210 Pts): 1 Sobre Épico (Místico)"
                              onClick={() => {
                                if (isClaimable && !actionLoading) handleClaimChest('gold')
                              }}
                              role={isClaimable ? 'button' : undefined}
                              tabIndex={isClaimable ? 0 : undefined}
                            >
                              <div className="chest-icon-wrap">🏆</div>
                              <span className="chest-points-label">210 pts</span>
                              {isClaimable && (
                                <button
                                  className="chest-claim-btn"
                                  disabled={actionLoading}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleClaimChest('gold')
                                  }}
                                >
                                  Reclamar
                                </button>
                              )}
                              {isClaimed && (
                                <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800 }}>✓ Listo</span>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Daily Missions List - Horizontal Row */}
                  <div className="daily-missions-wrapper">
                    <div className="daily-missions-list">
                      {dashboard?.missions?.map((m: DailyMission, index: number) => {
                        const isComplete = m.progress >= m.target
                        const plantCfg = m.plantId ? (PLANT_CONFIGS as any)[m.plantId] : null
                        const totalMissions = dashboard.missions.length
                        const isLastMission = index === totalMissions - 1 || m.slot === 2

                        return (
                          <div key={m.slot} className={`mission-card ${m.claimed ? 'claimed' : ''}`}>
                            <div className="mission-card-header">
                              <div className="mission-avatar">
                                {m.plantId && plantCfg?.icon ? (
                                  <img src={plantCfg.icon} alt={plantCfg.name} />
                                ) : m.slot === 0 ? (
                                  '⚔️'
                                ) : (
                                  '🛡️'
                                )}
                              </div>
                              <div className="mission-card-header-info">
                                <h4 className="mission-card-title">
                                  {m.title}
                                </h4>
                                {m.plantId && plantCfg && (
                                  <span className="mission-card-plant-name">🌿 {plantCfg.name}</span>
                                )}
                              </div>
                              <div className="mission-points-tag">
                                +{m.points} Pts
                              </div>
                            </div>

                            <div className="mission-card-body">
                              <p className="mission-card-desc">{m.description}</p>
                              <div className="mission-progress-bar-wrap">
                                <div
                                  className="mission-progress-fill"
                                  style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                                />
                              </div>
                              <div className="mission-progress-text">
                                Progreso: {m.progress} / {m.target}
                              </div>
                            </div>

                            <div className="mission-card-footer">
                              <div className="mission-reward-badge">
                                <span className="mission-reward-label">Recompensa</span>
                                <span className="mission-reward-val">
                                  {m.rewardGems > 0 ? `+${m.rewardGems} 💎` : `+${m.rewardGold} 🪙`}
                                </span>
                              </div>

                              <div className="mission-actions">
                                {m.claimed ? (
                                  <span className="mission-claimed-status">
                                    ✓ Reclamada
                                  </span>
                                ) : isComplete ? (
                                  <button
                                    className="mission-claim-btn"
                                    disabled={actionLoading}
                                    onClick={() => handleClaimMission(m.slot)}
                                  >
                                    Reclamar
                                  </button>
                                ) : isLastMission ? (
                                  <button
                                    className="mission-reroll-btn"
                                    title="Cambiar misión por 5 Gemas"
                                    disabled={actionLoading}
                                    onClick={() => setRerollSlot(m.slot)}
                                  >
                                    🔄 Cambiar (5 💎)
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* TAB 2: RACHA DE 7 DÍAS */}
              {/* ========================================================= */}
              {activeTab === 'racha' && (
                <>
                  <div className="streak-hero-card">
                    <div className="streak-hero-left">
                      <h3 className="streak-hero-title">🗓️ Racha de Conexión Diaria (7 Días)</h3>
                      <p className="streak-hero-sub">
                        Inicia sesión todos los días para desbloquear recompensas crecientes. Si faltas un día, la racha vuelve al Día 1.
                      </p>
                    </div>
                    <div className="streak-counter-badge">
                      <span className="streak-counter-label">Racha actual</span>
                      <span className="streak-counter-val">🔥 {dashboard?.loginStreak?.currentStreak || 0} Días</span>
                    </div>
                  </div>

                  <div className="streak-grid-wrapper">
                    <div className="streak-grid">
                      {[
                        { day: 1, title: 'Día 1', reward: '+50 🪙', icon: '🪙' },
                        { day: 2, title: 'Día 2', reward: '+1 Poción 5⚡', icon: '⚡' },
                        { day: 3, title: 'Día 3', reward: '+1 Sobre PvP', icon: '🎴' },
                        { day: 4, title: 'Día 4', reward: '+120 🪙', icon: '🪙' },
                        { day: 5, title: 'Día 5', reward: '+2 Pociones 5⚡', icon: '⚡' },
                        { day: 6, title: 'Día 6', reward: '+250 🪙', icon: '🪙' },
                        { day: 7, title: 'Día 7', reward: 'Sobre Básico', icon: '📦' }
                      ].map(item => {
                        const isClaimed = dashboard?.loginStreak?.claimedDays?.includes(item.day)
                        const streak = dashboard?.loginStreak?.currentStreak || 0
                        const isNextToday = canClaimStreak && (
                          (streak === 0 && item.day === 1) ||
                          (streak < 7 && item.day === streak + 1) ||
                          (streak === 7 && item.day === 1)
                        )

                        return (
                          <div
                            key={item.day}
                            className={`streak-day-card ${isClaimed ? 'claimed' : ''} ${isNextToday ? 'active-today' : ''}`}
                          >
                            {isClaimed && <div className="streak-check-badge">✓</div>}
                            <span className="streak-day-title">{item.title}</span>
                            <div className="streak-icon-wrap">{item.icon}</div>
                            <span className="streak-day-reward">{item.reward}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="streak-action-area">
                    {canClaimStreak ? (
                      <button
                        className="streak-claim-btn"
                        disabled={actionLoading}
                        onClick={handleClaimStreak}
                      >
                        {actionLoading ? 'Reclamando...' : '🎁 ¡RECLAMAR RECOMPENSA DE HOY!'}
                      </button>
                    ) : (
                      <div className="streak-claimed-alert">
                        ✓ ¡Ya has reclamado tu recompensa diaria de hoy! Vuelve mañana a las 00:00 UTC para continuar tu racha.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* TAB 3: CONCURSO TIKTOK (#PlantsArena) */}
              {/* ========================================================= */}
              {activeTab === 'tiktok' && (
                <div className="tiktok-horizontal-wrap">
                  {/* Left Column: Banner, Info, Countdown, Link, and Quota */}
                  <div className="tiktok-col-left">
                    <div className="tiktok-banner-card">
                      <div className="tiktok-badge-live">🔥 Concurso Activo</div>
                      <h3>Gran Concurso #PlantsArena</h3>
                      <p className="tiktok-banner-desc">
                        Graba una partida épica en Plant Arena, súbela a TikTok con el hashtag <strong>#PlantsArena</strong> y compite por grandes premios.
                      </p>

                      <div className="tiktok-countdown-box">
                        <span>⏳ Cierra en:</span>
                        <span className="tiktok-countdown-timer">
                          {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                        </span>
                        <span className="tiktok-countdown-sub">(26 Sep 23:00 UTC)</span>
                      </div>

                      <div className="tiktok-account-link-row">
                        <a
                          href="https://www.tiktok.com/@plantsarena"
                          target="_blank"
                          rel="noreferrer"
                          className="tiktok-account-link"
                        >
                          <span>🎵</span>
                          <span>Cuenta oficial @plantsarena en TikTok ↗</span>
                        </a>
                      </div>
                    </div>

                    {/* Quota Tracker */}
                    <div className="tiktok-quota-card">
                      <div className="tiktok-quota-header">
                        <span>Cupos para recompensa base (100 💎 de juego):</span>
                        <span style={{ color: dashboard?.tiktok?.remainingQuota ? '#34d399' : '#ef4444', fontWeight: 800 }}>
                          {dashboard?.tiktok?.remainingQuota} / {dashboard?.tiktok?.maxApprovedCount || 50} disponibles
                        </span>
                      </div>
                      <div className="tiktok-quota-bar-bg">
                        <div
                          className="tiktok-quota-bar-fill"
                          style={{ width: `${Math.min(100, ((dashboard?.tiktok?.approvedCount || 0) / 50) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Submission Form / Status and Grand Prizes */}
                  <div className="tiktok-col-right">
                    {/* Submission Form or Status */}
                    {dashboard?.tiktok?.hasSubmission && dashboard.tiktok.submission ? (
                      <div className={`submission-status-card ${dashboard.tiktok.submission.status}`}>
                        <div>
                          <strong style={{ fontSize: '0.95rem' }}>
                            {dashboard.tiktok.submission.status === 'pending' && '⏳ Video en Revisión'}
                            {dashboard.tiktok.submission.status === 'approved' && '✅ Video Aprobado (+100 💎)'}
                            {dashboard.tiktok.submission.status === 'rejected' && '❌ Envío Rechazado'}
                          </strong>
                          <div style={{ fontSize: '0.82rem', marginTop: '4px', wordBreak: 'break-all', opacity: 0.9 }}>
                            {dashboard.tiktok.submission.videoUrl}
                          </div>
                          {dashboard.tiktok.submission.adminNotes && (
                            <div style={{ fontSize: '0.8rem', marginTop: '4px', fontStyle: 'italic' }}>
                              Nota del moderador: {dashboard.tiktok.submission.adminNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <form className="tiktok-form-card" onSubmit={handleSubmitTikTok}>
                        <label className="tiktok-form-label">
                          Pega el enlace de tu video de TikTok publicado:
                        </label>
                        <div className="tiktok-input-row">
                          <input
                            type="url"
                            className="tiktok-url-input"
                            placeholder="https://www.tiktok.com/@tu_usuario/video/..."
                            value={tiktokUrl}
                            onChange={e => setTiktokUrl(e.target.value)}
                            required
                            disabled={tiktokSubmitting}
                          />
                          <button
                            type="submit"
                            className="tiktok-submit-btn"
                            disabled={tiktokSubmitting || !tiktokUrl.trim()}
                          >
                            {tiktokSubmitting ? 'Enviando...' : 'Enviar Video'}
                          </button>
                        </div>
                        <div className="tiktok-form-hint">
                          * El video debe mostrar gameplay real de Plant Arena y tener #PlantsArena.
                        </div>
                      </form>
                    )}

                    {/* Grand Prizes Showcase */}
                    <div className="tiktok-prizes-section">
                      <h4 className="tiktok-prizes-heading">
                        Premios del Gran Concurso (Clip con más vistas):
                      </h4>
                      <div className="tiktok-prizes-grid">
                        <div className="tiktok-prize-card tiktok-prize-card--1st">
                          <div className="tiktok-prize-pos">🥇</div>
                          <div className="tiktok-prize-title">1er Lugar</div>
                          <div className="tiktok-prize-reward">1,500 💎 + Ítem</div>
                        </div>

                        <div className="tiktok-prize-card">
                          <div className="tiktok-prize-pos">🥈</div>
                          <div className="tiktok-prize-title">2do Lugar</div>
                          <div className="tiktok-prize-reward">800 💎</div>
                        </div>

                        <div className="tiktok-prize-card">
                          <div className="tiktok-prize-pos">🥉</div>
                          <div className="tiktok-prize-title">3er Lugar</div>
                          <div className="tiktok-prize-reward">400 💎</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Confirmation for Reroll */}
        {rerollSlot !== null && (
          <div className="reroll-confirm-modal" onClick={() => setRerollSlot(null)}>
            <div className="reroll-confirm-card" onClick={e => e.stopPropagation()}>
              <h3>🔄 ¿Cambiar Misión?</h3>
              <p>
                Esta misión será reemplazada por una nueva tarea aleatoria. Esta acción tiene un costo de <strong>5 Gemas 💎</strong>.
              </p>
              <div className="reroll-confirm-actions">
                <button
                  className="reroll-cancel-btn"
                  disabled={actionLoading}
                  onClick={() => setRerollSlot(null)}
                >
                  Cancelar
                </button>
                <button
                  className="reroll-confirm-btn"
                  disabled={actionLoading || userGems < 5}
                  onClick={handleConfirmReroll}
                >
                  {actionLoading ? 'Cambiando...' : 'Confirmar (-5 💎)'}
                </button>
              </div>
              {userGems < 5 && (
                <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '8px' }}>
                  No tienes suficientes gemas (tienes {userGems} 💎).
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
export default MisionesModal
