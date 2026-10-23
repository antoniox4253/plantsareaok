import { useState, useMemo } from 'react'
import { soundManager } from '../../utils/audioManager'
import './SeasonRewardModal.css'

export interface RankedRewardTier {
  id: string
  rangeLabel: string
  rankStart: number
  rankEnd: number
  icon: string
  title: string
  gems: number
  pack: string | null
  packDescription?: string
  goldenPlant?: string | null
  gold: number
  tierClass: string
}

export interface ReferralRewardTier {
  id: string
  rangeLabel: string
  rankStart: number
  rankEnd: number
  icon: string
  title: string
  gems: number
  pack: string | null
  packDescription?: string
  gold: number
  tierClass: string
}

export const RANKED_REWARD_TIERS: RankedRewardTier[] = [
  {
    id: 'top1',
    rangeLabel: 'Puesto #1',
    rankStart: 1,
    rankEnd: 1,
    icon: '🥇',
    title: 'Campeón Supremo de la Temporada',
    gems: 5000,
    pack: '1x Pack Legendario 👑',
    packDescription: 'El sobre más codiciado del juego. Garantiza cartas de plantas legendarias y múltiples tiradas de fusión.',
    goldenPlant: '1x Dorada de Élite aleatoria ✨',
    gold: 0,
    tierClass: 'lb-reward-badge--top1',
  },
  {
    id: 'top2',
    rangeLabel: 'Puesto #2',
    rankStart: 2,
    rankEnd: 2,
    icon: '🥈',
    title: 'Subcampeón de la Temporada',
    gems: 3500,
    pack: '1x Pack Legendario 👑',
    packDescription: 'Sobre legendario con cartas de alto nivel competitivo y materiales para el Jardín.',
    goldenPlant: '1x Dorada de Élite aleatoria ✨',
    gold: 0,
    tierClass: 'lb-reward-badge--top2',
  },
  {
    id: 'top3',
    rangeLabel: 'Puesto #3',
    rankStart: 3,
    rankEnd: 3,
    icon: '🥉',
    title: '3.er Lugar del Podio',
    gems: 2500,
    pack: '1x Pack Legendario 👑',
    packDescription: 'Sobre legendario con cartas de alto calibre para tu mazo.',
    goldenPlant: '1x Dorada de Élite aleatoria ✨',
    gold: 0,
    tierClass: 'lb-reward-badge--top3',
  },
  {
    id: 'top4_5',
    rangeLabel: 'Puestos #4 - #5',
    rankStart: 4,
    rankEnd: 5,
    icon: '🎖️',
    title: 'Élite de la Temporada (Top 5)',
    gems: 1800,
    pack: '1x Pack Épico 🟣',
    packDescription: 'Sobre épico con cartas avanzadas, semillas de alto valor y tiradas de fusión.',
    goldenPlant: '1x Dorada de Élite aleatoria ✨',
    gold: 0,
    tierClass: 'lb-reward-badge--top4',
  },
  {
    id: 'top6_10',
    rangeLabel: 'Puestos #6 - #10',
    rankStart: 6,
    rankEnd: 10,
    icon: '🏅',
    title: 'Top 10 Maestros',
    gems: 1200,
    pack: '1x Pack Épico 🟣',
    packDescription: 'Sobre épico garantizado para los diez mejores jugadores de la temporada.',
    goldenPlant: '1x Dorada Común aleatoria ✨',
    gold: 0,
    tierClass: 'lb-reward-badge--top6-10',
  },
  {
    id: 'top11_20',
    rangeLabel: 'Puestos #11 - #20',
    rankStart: 11,
    rankEnd: 20,
    icon: '📦',
    title: 'Rango Élite de Oro',
    gems: 800,
    pack: '1x Pack Básico 📦',
    packDescription: 'Sobre de semillas y plantas para subir niveles y evolucionar tu mazo.',
    goldenPlant: null,
    gold: 3000,
    tierClass: 'lb-reward-badge--mid-tier',
  },
  {
    id: 'top21_35',
    rangeLabel: 'Puestos #21 - #35',
    rankStart: 21,
    rankEnd: 35,
    icon: '🪙',
    title: 'Rango Veterano',
    gems: 500,
    pack: '1x Pack Básico 📦',
    packDescription: 'Sobre de semillas y plantas básicas.',
    goldenPlant: null,
    gold: 2000,
    tierClass: 'lb-reward-badge--low-tier',
  },
  {
    id: 'top36_50',
    rangeLabel: 'Puestos #36 - #50',
    rankStart: 36,
    rankEnd: 50,
    icon: '🥉',
    title: 'Rango Contendiente (Piso de Premiación)',
    gems: 400,
    pack: '1x Pack Básico 📦',
    packDescription: 'Sobre básico de semillas para todos los que clasifiquen dentro del Top 50.',
    goldenPlant: null,
    gold: 1000,
    tierClass: 'lb-reward-badge--bronze-tier',
  },
  {
    id: 'top51_plus',
    rangeLabel: 'Puestos #51+',
    rankStart: 51,
    rankEnd: 999999,
    icon: '⚪',
    title: 'Zona de Ascenso',
    gems: 0,
    pack: null,
    goldenPlant: null,
    gold: 0,
    tierClass: 'lb-reward-badge--none',
  },
]

export const REFERRAL_REWARD_TIERS: ReferralRewardTier[] = [
  {
    id: 'ref_top1',
    rangeLabel: 'Puesto #1',
    rankStart: 1,
    rankEnd: 1,
    icon: '🥇',
    title: 'Líder Supremo de Invitaciones',
    gems: 1000,
    pack: '1x Sobre Legendario 🌟',
    packDescription: 'Sobre de máxima categoría con cartas legendarias para el mayor promotor de la comunidad.',
    gold: 0,
    tierClass: 'lb-reward-badge--top1',
  },
  {
    id: 'ref_top2',
    rangeLabel: 'Puesto #2',
    rankStart: 2,
    rankEnd: 2,
    icon: '🥈',
    title: '2.º Líder de Invitaciones',
    gems: 500,
    pack: '1x Sobre Épico 🟣',
    packDescription: 'Sobre épico con cartas avanzadas y fusiones.',
    gold: 0,
    tierClass: 'lb-reward-badge--top2',
  },
  {
    id: 'ref_top3',
    rangeLabel: 'Puesto #3',
    rankStart: 3,
    rankEnd: 3,
    icon: '🥉',
    title: '3.er Líder de Invitaciones',
    gems: 200,
    pack: '2x Sobres Comunes 🟢',
    packDescription: 'Dos sobres de cartas de plantas comunes y materiales para el Jardín.',
    gold: 0,
    tierClass: 'lb-reward-badge--top3',
  },
  {
    id: 'ref_top4',
    rangeLabel: 'Puesto #4',
    rankStart: 4,
    rankEnd: 4,
    icon: '🎖️',
    title: '4.to Lugar de Invitaciones',
    gems: 0,
    pack: '1x Sobre Común 🟢',
    packDescription: 'Sobre común de cartas para tu mazo.',
    gold: 2500,
    tierClass: 'lb-reward-badge--top4',
  },
  {
    id: 'ref_top5',
    rangeLabel: 'Puesto #5',
    rankStart: 5,
    rankEnd: 5,
    icon: '🎖️',
    title: '5.to Lugar de Invitaciones',
    gems: 0,
    pack: null,
    gold: 2000,
    tierClass: 'lb-reward-badge--top5',
  },
  {
    id: 'ref_top6_plus',
    rangeLabel: 'Puestos #6+',
    rankStart: 6,
    rankEnd: 999999,
    icon: '⚪',
    title: 'Participante Activo',
    gems: 0,
    pack: null,
    gold: 0,
    tierClass: 'lb-reward-badge--none',
  },
]

interface SeasonRewardModalProps {
  initialRank?: number
  initialTab?: 'ranked' | 'referrals'
  myRank?: number | null
  myReferralRank?: number | null
  onClose: () => void
}

export default function SeasonRewardModal({
  initialRank = 1,
  initialTab = 'ranked',
  myRank,
  myReferralRank,
  onClose,
}: SeasonRewardModalProps) {
  const [tab, setTab] = useState<'ranked' | 'referrals'>(initialTab)

  // Find initial tier based on initialRank
  const initialTierId = useMemo(() => {
    if (initialTab === 'referrals') {
      const match = REFERRAL_REWARD_TIERS.find(
        (t) => initialRank >= t.rankStart && initialRank <= t.rankEnd
      )
      return match ? match.id : REFERRAL_REWARD_TIERS[0].id
    }
    const match = RANKED_REWARD_TIERS.find(
      (t) => initialRank >= t.rankStart && initialRank <= t.rankEnd
    )
    return match ? match.id : RANKED_REWARD_TIERS[0].id
  }, [initialRank, initialTab])

  const [selectedTierId, setSelectedTierId] = useState<string>(initialTierId)

  // Current active tier
  const activeTier = useMemo(() => {
    if (tab === 'referrals') {
      return (
        REFERRAL_REWARD_TIERS.find((t) => t.id === selectedTierId) ||
        REFERRAL_REWARD_TIERS[0]
      )
    }
    return (
      RANKED_REWARD_TIERS.find((t) => t.id === selectedTierId) ||
      RANKED_REWARD_TIERS[0]
    )
  }, [tab, selectedTierId])

  const handleTabChange = (newTab: 'ranked' | 'referrals') => {
    soundManager.playSound('click', 0.3)
    setTab(newTab)
    if (newTab === 'referrals') {
      const myRefTier = myReferralRank
        ? REFERRAL_REWARD_TIERS.find(
            (t) => myReferralRank >= t.rankStart && myReferralRank <= t.rankEnd
          )?.id
        : null
      setSelectedTierId(myRefTier || REFERRAL_REWARD_TIERS[0].id)
    } else {
      const myRankTier = myRank
        ? RANKED_REWARD_TIERS.find((t) => myRank >= t.rankStart && myRank <= t.rankEnd)?.id
        : null
      setSelectedTierId(myRankTier || RANKED_REWARD_TIERS[0].id)
    }
  }

  const handleSelectTier = (tierId: string) => {
    soundManager.playSound('click', 0.25)
    setSelectedTierId(tierId)
  }

  const isUserInActiveTier = useMemo(() => {
    if (tab === 'referrals') {
      if (!myReferralRank) return false
      return (
        myReferralRank >= activeTier.rankStart &&
        myReferralRank <= activeTier.rankEnd
      )
    }
    if (!myRank) return false
    return myRank >= activeTier.rankStart && myRank <= activeTier.rankEnd
  }, [tab, myRank, myReferralRank, activeTier])

  return (
    <div className="season-reward-backdrop" onClick={onClose}>
      <div
        className="season-reward-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="season-reward-header">
          <div className="season-reward-header-info">
            <span className="season-reward-header-icon">🎁</span>
            <div>
              <h3 className="season-reward-header-title">Premios Oficiales de Temporada</h3>
              <p className="season-reward-header-sub">
                Revisa en detalle qué recompensas garantiza cada puesto al cierre de los 15 días.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="season-reward-close-btn"
            onClick={() => {
              soundManager.playSound('click', 0.2)
              onClose()
            }}
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="season-reward-tabs-bar">
          <button
            type="button"
            className={`season-reward-tab-btn ${tab === 'ranked' ? 'season-reward-tab-btn--active' : ''}`}
            onClick={() => handleTabChange('ranked')}
          >
            🏆 Modo Ranked PvP (Top 50)
          </button>
          <button
            type="button"
            className={`season-reward-tab-btn ${tab === 'referrals' ? 'season-reward-tab-btn--active' : ''}`}
            onClick={() => handleTabChange('referrals')}
          >
            🌱 Cuadro de Referidos (Top 5)
          </button>
        </div>

        {/* Modal Body */}
        <div className="season-reward-body">
          {/* Explanation Banner */}
          <div className="season-reward-banner">
            <span className="season-reward-banner-icon">ℹ️</span>
            <span>
              {tab === 'ranked'
                ? 'Las temporadas de Ranked duran 15 días. Los premios en Gemas, Sobres, Plantas Doradas y Oro se acreditan automáticamente a tu perfil al vencer el cronómetro de la temporada.'
                : 'El ranking de referidos premia a los 5 jugadores con mayor cantidad de amigos válidos (>=1,400 copas) al concluir la temporada.'}
            </span>
          </div>

          {/* Tier Selector Pills */}
          <div className="season-reward-pills-wrap">
            <div className="season-reward-pills-label">
              <span>🎯 Selecciona un escalafón para ver su botín:</span>
            </div>
            <div className="season-reward-pills-scroll">
              {tab === 'ranked'
                ? RANKED_REWARD_TIERS.map((tier) => {
                    const isMyTier =
                      Boolean(myRank) &&
                      (myRank as number) >= tier.rankStart &&
                      (myRank as number) <= tier.rankEnd
                    const isSelected = tier.id === selectedTierId
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        className={`season-reward-pill-btn ${
                          isSelected ? 'season-reward-pill-btn--active' : ''
                        } ${isMyTier ? 'season-reward-pill-btn--user' : ''}`}
                        onClick={() => handleSelectTier(tier.id)}
                      >
                        <span>{tier.icon}</span>
                        <span>{tier.rangeLabel}</span>
                        {isMyTier && <span className="season-reward-pill-tag-you">TÚ</span>}
                      </button>
                    )
                  })
                : REFERRAL_REWARD_TIERS.map((tier) => {
                    const isMyTier =
                      Boolean(myReferralRank) &&
                      (myReferralRank as number) >= tier.rankStart &&
                      (myReferralRank as number) <= tier.rankEnd
                    const isSelected = tier.id === selectedTierId
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        className={`season-reward-pill-btn ${
                          isSelected ? 'season-reward-pill-btn--active' : ''
                        } ${isMyTier ? 'season-reward-pill-btn--user' : ''}`}
                        onClick={() => handleSelectTier(tier.id)}
                      >
                        <span>{tier.icon}</span>
                        <span>{tier.rangeLabel}</span>
                        {isMyTier && <span className="season-reward-pill-tag-you">TÚ</span>}
                      </button>
                    )
                  })}
            </div>
          </div>

          {/* Hero Detail Card for Selected Tier */}
          <div className="season-reward-hero-card">
            <div className="season-reward-hero-header">
              <div className="season-reward-hero-title-group">
                <span className="season-reward-hero-icon">{activeTier.icon}</span>
                <div>
                  <div className="season-reward-hero-rank">
                    {activeTier.rangeLabel} — {activeTier.title}
                  </div>
                  <div className="season-reward-hero-subtitle">
                    {activeTier.gems > 0 || (activeTier as any).gold > 0
                      ? 'Recompensas acumulativas acreditadas al cierre de temporada'
                      : 'Zona de ascenso / Sin premio de temporada'}
                  </div>
                </div>
              </div>

              {isUserInActiveTier && (
                <div className="season-reward-hero-you-badge">
                  <span>⭐ ¡Tu puesto actual!</span>
                  <span>(#{tab === 'ranked' ? myRank : myReferralRank})</span>
                </div>
              )}
            </div>

            {/* If tier has rewards, show grid */}
            {activeTier.gems > 0 || (activeTier as any).gold > 0 || activeTier.pack ? (
              <div className="season-reward-items-grid">
                {/* 1. Gemas */}
                {activeTier.gems > 0 && (
                  <div className="season-reward-item-card season-reward-item-card--gems">
                    <div className="season-reward-item-icon-box">💎</div>
                    <div className="season-reward-item-content">
                      <span className="season-reward-item-label">Gemas Premium</span>
                      <strong className="season-reward-item-value">
                        +{activeTier.gems.toLocaleString()} Gemas
                      </strong>
                      <span className="season-reward-item-desc">
                        Acreditadas directamente a tu saldo. Úsalas en la tienda, invocaciones, packs o canjes de streaming.
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Sobre / Pack */}
                {activeTier.pack && (
                  <div className="season-reward-item-card season-reward-item-card--pack">
                    <div className="season-reward-item-icon-box">
                      {activeTier.pack.includes('Legendario')
                        ? '👑'
                        : activeTier.pack.includes('Épico')
                        ? '🟣'
                        : activeTier.pack.includes('Común')
                        ? '🟢'
                        : '📦'}
                    </div>
                    <div className="season-reward-item-content">
                      <span className="season-reward-item-label">Sobre de Cartas</span>
                      <strong className="season-reward-item-value">{activeTier.pack}</strong>
                      <span className="season-reward-item-desc">
                        {activeTier.packDescription ||
                          'Paquete con cartas y semillas para subir de nivel y evolucionar tu mazo.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Planta Dorada (solo ranked) */}
                {(activeTier as RankedRewardTier).goldenPlant && (
                  <div className="season-reward-item-card season-reward-item-card--goldplant">
                    <div className="season-reward-item-icon-box">✨</div>
                    <div className="season-reward-item-content">
                      <span className="season-reward-item-label">Planta Dorada de Temporada</span>
                      <strong className="season-reward-item-value">
                        {(activeTier as RankedRewardTier).goldenPlant}
                      </strong>
                      <span className="season-reward-item-desc">
                        Aspecto dorado resplandeciente exclusivo con bonificación permanente de <strong>+15% en Salud (HP) y Ataque</strong> en combate.
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. Oro Garantizado */}
                {(activeTier as any).gold > 0 && (
                  <div className="season-reward-item-card season-reward-item-card--gold">
                    <div className="season-reward-item-icon-box">💰</div>
                    <div className="season-reward-item-content">
                      <span className="season-reward-item-label">Oro Garantizado</span>
                      <strong className="season-reward-item-value">
                        +{(activeTier as any).gold.toLocaleString()} Oro
                      </strong>
                      <span className="season-reward-item-desc">
                        Monedas de oro añadidas a tu inventario para fusiones en el Jardín, compras de semillas y recursos en el Mercado.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="season-reward-empty-tier">
                <div className="season-reward-empty-tier-icon">🌱</div>
                <div className="season-reward-empty-tier-title">
                  {tab === 'ranked'
                    ? 'Puestos #51 y superiores no reciben premios de temporada'
                    : 'Puestos #6 y superiores no reciben premios de temporada'}
                </div>
                <p className="season-reward-empty-tier-desc">
                  {tab === 'ranked'
                    ? '¡Sigue compitiendo en Ranked para escalar al Top 50! El puesto 50 garantiza 400 Gemas, 1x Pack Básico y 1,000 Oro.'
                    : '¡Invita a más amigos a jugar para entrar en el Top 5 del Cuadro de Honor y ganar hasta 1,000 Gemas y Sobres Legendarios!'}
                </p>
              </div>
            )}
          </div>

          {/* Full Comparison Table */}
          <div className="season-reward-table-section">
            <div className="season-reward-table-title">
              <span>📊 Resumen del Escalafón de la Temporada:</span>
            </div>
            <div className="season-reward-table-wrap">
              <table className="season-reward-table">
                <thead>
                  <tr>
                    <th>Escalafón</th>
                    <th>💎 Gemas</th>
                    <th>📦 Sobre / Pack</th>
                    {tab === 'ranked' && <th>✨ Planta Dorada</th>}
                    <th>💰 Oro</th>
                  </tr>
                </thead>
                <tbody>
                  {tab === 'ranked'
                    ? RANKED_REWARD_TIERS.map((tier) => {
                        const isSelected = tier.id === selectedTierId
                        const isMyTier =
                          Boolean(myRank) &&
                          (myRank as number) >= tier.rankStart &&
                          (myRank as number) <= tier.rankEnd
                        return (
                          <tr
                            key={tier.id}
                            className={`${isSelected ? 'season-reward-table-row--active' : ''} ${
                              isMyTier ? 'season-reward-table-row--user' : ''
                            }`}
                            onClick={() => handleSelectTier(tier.id)}
                          >
                            <td>
                              {tier.icon} {tier.rangeLabel}{' '}
                              {isMyTier && <span className="season-reward-pill-tag-you">TÚ</span>}
                            </td>
                            <td style={{ color: tier.gems > 0 ? '#38bdf8' : '#64748b', fontWeight: tier.gems > 0 ? 'bold' : 'normal' }}>
                              {tier.gems > 0 ? `+${tier.gems.toLocaleString()}` : '—'}
                            </td>
                            <td>{tier.pack || '—'}</td>
                            <td style={{ color: tier.goldenPlant ? '#fde047' : '#64748b' }}>
                              {tier.goldenPlant || '—'}
                            </td>
                            <td style={{ color: tier.gold > 0 ? '#fde047' : '#64748b', fontWeight: tier.gold > 0 ? 'bold' : 'normal' }}>
                              {tier.gold > 0 ? `+${tier.gold.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        )
                      })
                    : REFERRAL_REWARD_TIERS.map((tier) => {
                        const isSelected = tier.id === selectedTierId
                        const isMyTier =
                          Boolean(myReferralRank) &&
                          (myReferralRank as number) >= tier.rankStart &&
                          (myReferralRank as number) <= tier.rankEnd
                        return (
                          <tr
                            key={tier.id}
                            className={`${isSelected ? 'season-reward-table-row--active' : ''} ${
                              isMyTier ? 'season-reward-table-row--user' : ''
                            }`}
                            onClick={() => handleSelectTier(tier.id)}
                          >
                            <td>
                              {tier.icon} {tier.rangeLabel}{' '}
                              {isMyTier && <span className="season-reward-pill-tag-you">TÚ</span>}
                            </td>
                            <td style={{ color: tier.gems > 0 ? '#38bdf8' : '#64748b', fontWeight: tier.gems > 0 ? 'bold' : 'normal' }}>
                              {tier.gems > 0 ? `+${tier.gems.toLocaleString()}` : '—'}
                            </td>
                            <td>{tier.pack || '—'}</td>
                            <td style={{ color: tier.gold > 0 ? '#fde047' : '#64748b', fontWeight: tier.gold > 0 ? 'bold' : 'normal' }}>
                              {tier.gold > 0 ? `+${tier.gold.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="season-reward-footer">
          <button
            type="button"
            className="game-button season-reward-footer-btn"
            onClick={() => {
              soundManager.playSound('click', 0.2)
              onClose()
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
