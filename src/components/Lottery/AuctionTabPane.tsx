import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  auctionService,
  type ActiveAuctionData,
  type AuctionBid,
} from '../../services/auctionService'
import { supabase } from '../../lib/supabaseClient'
import { soundManager } from '../../utils/audioManager'
import './AuctionTabPane.css'

interface AuctionTabPaneProps {
  userGold: number
  userTokens: number
  userId?: string
  username?: string
  onRewardsChanged?: () => Promise<void> | void
}

export const AuctionTabPane: React.FC<AuctionTabPaneProps> = ({
  userGold,
  userTokens,
  userId,
  username,
  onRewardsChanged,
}) => {
  const [subTab, setSubTab] = useState<'live' | 'completed'>('live')
  const [liveAuctions, setLiveAuctions] = useState<ActiveAuctionData[]>([])
  const [completedAuctions, setCompletedAuctions] = useState<ActiveAuctionData[]>([])
  const [selectedLiveCurrency, setSelectedLiveCurrency] = useState<'gold' | 'gems'>('gold')
  const [selectedCompletedIdx] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [bidAmount, setBidAmount] = useState<number>(3000)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [remainingMs, setRemainingMs] = useState<number>(0)
  const [isClaiming, setIsClaiming] = useState<boolean>(false)
  const [rankingPage, setRankingPage] = useState<number>(0)

  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(userId)
  const [resolvedUsername, setResolvedUsername] = useState<string | undefined>(username)

  // Resolver ID y Nombre de usuario si no vienen por props
  useEffect(() => {
    if (!resolvedUserId) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setResolvedUserId(data.user.id)
          setResolvedUsername(data.user.user_metadata?.username || data.user.email?.split('@')[0])
        }
      })
    }
  }, [resolvedUserId])

  // Carga de todas las subastas activas (soporte simultáneo)
  const fetchLiveAuctions = useCallback(async () => {
    const list = await auctionService.getActiveAuctions()
    if (Array.isArray(list) && list.length > 0) {
      setLiveAuctions(list)
    } else {
      // Fallback a getActiveAuction si retorna un solo objeto
      const single = await auctionService.getActiveAuction()
      if (single) {
        setLiveAuctions([single])
      } else {
        setLiveAuctions([])
      }
    }
    setIsLoading(false)
  }, [])

  // Carga de subastas completadas
  const fetchCompletedAuctions = useCallback(async () => {
    const list = await auctionService.getCompletedAuctions()
    if (Array.isArray(list)) {
      setCompletedAuctions(list)
    }
  }, [])

  // Sincronización Realtime con actualización inmediata de saldos reembolsados
  useEffect(() => {
    setIsLoading(true)
    void fetchLiveAuctions()
    void fetchCompletedAuctions()

    // Suscripción Realtime a cambios en subastas y ofertas
    const unsubscribe = auctionService.subscribeToAuctionChanges(async () => {
      await fetchLiveAuctions()
      await fetchCompletedAuctions()
      // ALERTA DE REEMBOLSO: si otro usuario pujó, refrescar saldos en el acto
      if (onRewardsChanged) {
        await onRewardsChanged()
      }
    })

    return () => {
      unsubscribe()
    }
  }, [fetchLiveAuctions, fetchCompletedAuctions, onRewardsChanged])

  // Sondeo preventivo de saldo cada 3.5 segundos mientras esté abierta la subasta
  // para que si el usuario fue superado vea su oro/gemas devueltas en pantalla de inmediato
  useEffect(() => {
    const interval = setInterval(() => {
      if (onRewardsChanged) {
        void onRewardsChanged()
      }
    }, 3500)
    return () => clearInterval(interval)
  }, [onRewardsChanged])

  // Determinar subasta activa según la moneda seleccionada en vivo
  const currentLiveAuction = useMemo(() => {
    if (liveAuctions.length === 0) return null
    const found = liveAuctions.find((a) => (a.currency || 'gold') === selectedLiveCurrency)
    return found || liveAuctions[0]
  }, [liveAuctions, selectedLiveCurrency])

  const activeAuction = subTab === 'live'
    ? currentLiveAuction
    : (completedAuctions[selectedCompletedIdx] || completedAuctions[0] || null)

  const isLive = subTab === 'live'
  const isCurrencyGold = (activeAuction?.currency || 'gold') === 'gold'
  const currencySymbol = isCurrencyGold ? '💰' : '💎'
  const currencyName = isCurrencyGold ? 'Oro' : 'Gemas'
  const userBalance = isCurrencyGold ? userGold : userTokens

  // Temporizador de cuenta regresiva
  useEffect(() => {
    if (!activeAuction) return

    const updateTimer = () => {
      const now = Date.now()
      const diff = Math.max(0, activeAuction.endTime - now)
      setRemainingMs(diff)

      if (diff <= 0 && activeAuction.status === 'active') {
        void fetchLiveAuctions()
      }
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [activeAuction, fetchLiveAuctions])

  // Sugerir la siguiente puja válida al cambiar de subasta o líder
  useEffect(() => {
    if (!activeAuction) return
    const isGold = (activeAuction.currency || 'gold') === 'gold'
    const minStep = activeAuction.minBidStep || (isGold ? 200 : 20)
    if (activeAuction.highestBidderId) {
      setBidAmount(activeAuction.currentBid + minStep)
    } else {
      setBidAmount(activeAuction.startingBid || (isGold ? 3000 : 800))
    }
  }, [activeAuction?.id, activeAuction?.currentBid, activeAuction?.highestBidderId, activeAuction?.currency, activeAuction?.minBidStep, activeAuction?.startingBid])

  // Formato de cuenta regresiva
  const formatCountdown = useMemo(() => {
    if (remainingMs <= 0) return '00:00:00 (EXPIRADA)'

    const totalSeconds = Math.floor(remainingMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
  }, [remainingMs])

  const isExpired = !isLive || remainingMs <= 0 || activeAuction?.status === 'completed'
  const isHighestBidder = Boolean(resolvedUserId && activeAuction?.highestBidderId === resolvedUserId)
  const isNearExpiration = isLive && remainingMs > 0 && remainingMs <= 60000

  const minRequiredBid = useMemo(() => {
    if (!activeAuction) return isCurrencyGold ? 3000 : 800
    if (!activeAuction.highestBidderId) return activeAuction.startingBid
    return activeAuction.currentBid + activeAuction.minBidStep
  }, [activeAuction, isCurrencyGold])

  // Paginación del ranking de ofertas
  const BIDS_PER_PAGE = 4
  const bidsList = activeAuction?.bids || []
  const totalBidPages = Math.max(1, Math.ceil(bidsList.length / BIDS_PER_PAGE))
  const paginatedBids = useMemo(() => {
    const start = rankingPage * BIDS_PER_PAGE
    return bidsList.slice(start, start + BIDS_PER_PAGE)
  }, [bidsList, rankingPage])

  const handleQuickAdd = (increment: number) => {
    soundManager.playSound('click', 0.4)
    setBidAmount((prev) => Math.max(minRequiredBid, prev + increment))
    setFeedback(null)
  }

  // Realizar oferta con resolución atómica y reintento con saldo fresco
  const handlePlaceBid = async () => {
    if (!activeAuction || !isLive) return

    if (bidAmount < minRequiredBid) {
      setFeedback({
        type: 'error',
        message: `La puja mínima debe ser de al menos ${minRequiredBid.toLocaleString()} ${currencySymbol}`,
      })
      return
    }

    const needed = isHighestBidder ? bidAmount - activeAuction.currentBid : bidAmount

    // Si localmente el saldo parece insuficiente, intentar primero un refresco rápido del saldo
    // en lugar de bloquear al usuario si su reembolso acaba de acreditarse en PostgreSQL
    if (userBalance < needed) {
      if (onRewardsChanged) {
        await onRewardsChanged()
      }
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const res = await auctionService.placeBid(activeAuction.id, bidAmount)
      if (res.success) {
        soundManager.playSound('points', 0.6)
        const antiSnipeMsg = res.wasExtended ? ' ⏱️ (¡Tiempo extendido +60s por oferta en el último minuto!)' : ''
        setFeedback({
          type: 'success',
          message: `¡Puja de ${bidAmount.toLocaleString()} ${currencySymbol} enviada con éxito! Eres el nuevo líder 👑${antiSnipeMsg}`,
        })
        if (onRewardsChanged) {
          await onRewardsChanged()
        }
        await fetchLiveAuctions()
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Error al procesar la puja',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error inesperado al ofertar',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClaimReward = async () => {
    if (!activeAuction) return
    setIsClaiming(true)
    try {
      const res = await auctionService.claimReward(activeAuction.id)
      if (res.success) {
        soundManager.playSound('points', 0.8)
        setFeedback({
          type: 'success',
          message: res.message || '¡Carta legendaria reclamada con éxito!',
        })
        await fetchLiveAuctions()
        if (onRewardsChanged) {
          await onRewardsChanged()
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'No se pudo reclamar la carta',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error inesperado al reclamar',
      })
    } finally {
      setIsClaiming(false)
    }
  }

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp)
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Hace un momento'
    if (minutes < 60) return `Hace ${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `Hace ${hours}h`
  }

  return (
    <div className="lottery-auction-tab-pane">
      {/* SELECTOR DE SUB-PESTAÑA (EN VIVO vs FINALIZADA) */}
      <div className="lottery-auction-subtabs">
        <button
          type="button"
          className={`lottery-auction-subtab-btn ${subTab === 'live' ? 'lottery-auction-subtab-btn--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.4)
            setSubTab('live')
            setRankingPage(0)
            setFeedback(null)
          }}
        >
          🔴 SUBASTAS EN VIVO (24H)
        </button>
        <button
          type="button"
          className={`lottery-auction-subtab-btn ${subTab === 'completed' ? 'lottery-auction-subtab-btn--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.4)
            setSubTab('completed')
            setRankingPage(0)
            setFeedback(null)
          }}
        >
          🏆 SUBASTAS FINALIZADAS
        </button>
      </div>

      {/* SELECTOR DE SALAS SIMULTÁNEAS EN VIVO (ORO vs GEMAS) */}
      {subTab === 'live' && liveAuctions.length > 1 && (
        <div className="lottery-auction-rooms">
          {liveAuctions.map((auc) => {
            const isGold = (auc.currency || 'gold') === 'gold'
            const isSelected = (auc.currency || 'gold') === selectedLiveCurrency
            return (
              <button
                key={auc.id}
                type="button"
                className={`lottery-auction-room-btn ${
                  isSelected ? 'lottery-auction-room-btn--active' : ''
                } ${isGold ? 'lottery-auction-room-btn--gold' : 'lottery-auction-room-btn--gems'}`}
                onClick={() => {
                  soundManager.playSound('click', 0.3)
                  setSelectedLiveCurrency((auc.currency || 'gold') as any)
                  setRankingPage(0)
                  setFeedback(null)
                }}
              >
                <span className="lottery-auction-room-icon">{isGold ? '🪙' : '💎'}</span>
                <div className="lottery-auction-room-info">
                  <span className="lottery-auction-room-title">{auc.itemName}</span>
                  <span className="lottery-auction-room-bid">
                    Puja: <strong>{auc.currentBid.toLocaleString()} {isGold ? 'Oro' : 'Gemas'}</strong>
                  </span>
                </div>
                {isSelected && <span className="lottery-auction-room-live-dot" />}
              </button>
            )
          })}
        </div>
      )}

      {isLoading && !activeAuction ? (
        <div className="lottery-auction-loading">
          ⏳ Sincronizando datos de la Subasta...
        </div>
      ) : !activeAuction ? (
        <div className="lottery-auction-empty">
          No hay información de subasta disponible en este momento.
        </div>
      ) : (
        <div className="lottery-auction-grid">
          {/* COLUMNA IZQUIERDA: RESUMEN, CONSOLA Y HISTORIAL */}
          <div className="lottery-auction-col-left">
            {/* 1. Resumen Superior */}
            <div className="lottery-auction-top-summary">
              <div className="lottery-auction-summary-col">
                <span className="lottery-auction-summary-tag">
                  {isLive
                    ? activeAuction.highestBidderId
                      ? 'Puja Actual'
                      : 'Puja Inicial'
                    : 'Oferta Ganadora'}
                </span>
                <div className="lottery-auction-summary-val">
                  <span className="lottery-auction-summary-amount">
                    {activeAuction.currentBid.toLocaleString()}
                  </span>
                  <span className="lottery-auction-summary-curr">
                    {currencySymbol} {currencyName}
                  </span>
                </div>
              </div>

              <div className="lottery-auction-summary-col lottery-auction-summary-col--leader">
                <span className="lottery-auction-summary-tag">
                  {isLive
                    ? isHighestBidder
                      ? '👑 ¡ERES EL LÍDER!'
                      : '👑 MÁXIMO POSTOR'
                    : '🏆 GANADOR DEFINITIVO'}
                </span>
                <span className="lottery-auction-summary-leader">
                  {activeAuction.highestBidderName
                    ? `@${activeAuction.highestBidderName}`
                    : isHighestBidder && resolvedUsername
                    ? `@${resolvedUsername}`
                    : 'Sin ofertas aún'}
                </span>
              </div>

              <div className="lottery-auction-summary-col lottery-auction-summary-col--timer">
                <span className="lottery-auction-summary-tag">
                  {isLive ? '⏱️ TIEMPO RESTANTE' : 'ESTADO'}
                </span>
                <span
                  className={`lottery-auction-summary-timer ${
                    isExpired ? 'lottery-auction-summary-timer--expired' : ''
                  }`}
                >
                  {isLive ? formatCountdown : '🏁 FINALIZADA'}
                </span>
                {isNearExpiration && (
                  <span className="lottery-auction-snipe-badge">
                    ⏱️ +60s Anti-Snipe
                  </span>
                )}
              </div>
            </div>

            {/* 2. Consola de Puja o Estado */}
            <div className="lottery-auction-console">
              {isLive ? (
                <>
                  <div className="lottery-auction-balance-row">
                    <span>Tu saldo disponible:</span>
                    <span className="lottery-auction-balance-val">
                      <span>{currencySymbol}</span>{' '}
                      <strong>{userBalance.toLocaleString()}</strong> {currencyName}
                    </span>
                  </div>

                  {isExpired ? (
                    activeAuction.highestBidderId === resolvedUserId && !activeAuction.rewardClaimed ? (
                      <button
                        type="button"
                        className="lottery-auction-claim-btn"
                        onClick={handleClaimReward}
                        disabled={isClaiming}
                      >
                        {isClaiming ? 'RECLAMANDO CARTA...' : '🏆 ¡ERES EL GANADOR! RECLAMAR CARTA'}
                      </button>
                    ) : (
                      <div className="lottery-auction-banner-note">
                        🏁 La subasta ha concluido. Ganador: @{activeAuction.highestBidderName || 'Nadie'}
                      </div>
                    )
                  ) : (
                    <>
                      <div className="lottery-auction-input-row">
                        <div className="lottery-auction-input-box">
                          <span className="lottery-auction-input-icon">{currencySymbol}</span>
                          <input
                            type="number"
                            className="lottery-auction-input"
                            value={bidAmount}
                            min={minRequiredBid}
                            step={isCurrencyGold ? 50 : 10}
                            onChange={(e) =>
                              setBidAmount(Math.max(0, parseInt(e.target.value, 10) || 0))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="lottery-auction-bid-btn"
                          onClick={handlePlaceBid}
                          disabled={isSubmitting || bidAmount < minRequiredBid}
                        >
                          {isSubmitting
                            ? 'PROCESANDO...'
                            : isHighestBidder
                            ? `👑 SUBIR A ${bidAmount.toLocaleString()} ${currencySymbol}`
                            : `⚡ PUJAR ${bidAmount.toLocaleString()} ${currencySymbol}`}
                        </button>
                      </div>

                      <div className="lottery-auction-quick-grid">
                        {isCurrencyGold ? (
                          <>
                            <button type="button" onClick={() => handleQuickAdd(50)}>+50 💰</button>
                            <button type="button" onClick={() => handleQuickAdd(100)}>+100 💰</button>
                            <button type="button" onClick={() => handleQuickAdd(500)}>+500 💰</button>
                            <button type="button" onClick={() => handleQuickAdd(1000)}>+1,000 💰</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => handleQuickAdd(10)}>+10 💎</button>
                            <button type="button" onClick={() => handleQuickAdd(50)}>+50 💎</button>
                            <button type="button" onClick={() => handleQuickAdd(100)}>+100 💎</button>
                            <button type="button" onClick={() => handleQuickAdd(500)}>+500 💎</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="lottery-auction-completed-note">
                  <div className="lottery-auction-completed-note__icon">🏆</div>
                  <div>
                    <strong>Subasta concluida exitosamente</strong>
                    <p>
                      El postor <strong>@{activeAuction.highestBidderName}</strong> se adjudicó la carta exclusiva con una oferta ganadora de{' '}
                      <strong>{activeAuction.currentBid.toLocaleString()} {currencySymbol} {currencyName}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {feedback && (
                <div className={`lottery-auction-feedback lottery-auction-feedback--${feedback.type}`}>
                  {feedback.message}
                </div>
              )}
            </div>

            {/* 3. Ranking e Historial de Ofertas */}
            <div className="lottery-auction-ranking">
              <div className="lottery-auction-ranking-head">
                <div className="lottery-auction-ranking-head-left">
                  <span>HISTORIAL DE OFERTAS ({activeAuction.totalBids || bidsList.length})</span>
                  {isLive && <span className="lottery-auction-live-badge">EN VIVO</span>}
                </div>

                {bidsList.length > BIDS_PER_PAGE && (
                  <div className="lottery-auction-pagination">
                    <button
                      type="button"
                      disabled={rankingPage === 0}
                      onClick={() => setRankingPage((p) => Math.max(0, p - 1))}
                    >
                      ◀
                    </button>
                    <span>{rankingPage + 1} / {totalBidPages}</span>
                    <button
                      type="button"
                      disabled={rankingPage >= totalBidPages - 1}
                      onClick={() => setRankingPage((p) => Math.min(totalBidPages - 1, p + 1))}
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>

              <div className="lottery-auction-ranking-list">
                {bidsList.length > 0 ? (
                  paginatedBids.map((bid: AuctionBid, idx: number) => {
                    const globalRank = rankingPage * BIDS_PER_PAGE + idx + 1
                    const isLeader = globalRank === 1

                    return (
                      <div
                        key={bid.id || `${bid.username}-${idx}`}
                        className={`lottery-auction-ranking-row ${
                          isLeader ? 'lottery-auction-ranking-row--leader' : ''
                        }`}
                      >
                        <div className="lottery-auction-bidder-info">
                          <span className="lottery-auction-rank-badge">
                            {isLeader ? '👑' : `#${globalRank}`}
                          </span>
                          <span className="lottery-auction-bidder-name">@{bid.username}</span>
                        </div>
                        <div className="lottery-auction-bid-amount-box">
                          <span className="lottery-auction-bid-amount">
                            {bid.bidAmount.toLocaleString()} {currencySymbol}
                          </span>
                          <span className="lottery-auction-bid-time">
                            {formatTimeAgo(bid.createdAt)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="lottery-auction-empty-bids">
                    Aún no hay ofertas registradas. ¡Sé el primero en pujar por{' '}
                    {activeAuction.startingBid.toLocaleString()} {currencySymbol}!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: TARJETA HERO DE LA PLANTA */}
          <div className="lottery-auction-col-right">
            <div className="lottery-auction-card-wrap">
              <div className="lottery-auction-card-badge">
                {activeAuction.plantId === 'jalapeno'
                  ? (isCurrencyGold ? '🌶️ SUBASTA LEGENDARIA EN ORO' : '💎 SUBASTA VIP DOBLE CARTA')
                  : isLive
                  ? '🛡️ EDICIÓN ÉPICA DE ACERO'
                  : '🎃 EDICIÓN ESPECIAL HALLOWEEN'}
              </div>

              <div className="lottery-auction-card-art">
                <img
                  src={activeAuction.imageUrl}
                  alt={activeAuction.itemName}
                  className="lottery-auction-card-img"
                />
              </div>

              <div className="lottery-auction-card-details">
                <h3 className="lottery-auction-card-title">{activeAuction.itemName}</h3>
                <span className="lottery-auction-card-sub">
                  {activeAuction.plantId === 'jalapeno'
                    ? (activeAuction.copiesCount && activeAuction.copiesCount > 1
                      ? '2x Cartas Legendarias de Jalapeño'
                      : '1x Carta Legendaria de Jalapeño')
                    : isLive
                    ? 'Yelmo de Caballero Forjado'
                    : 'Catapulta Mística de Bruja'}
                </span>

                <div className="lottery-auction-stats-pills">
                  {activeAuction.plantId === 'jalapeno' ? (
                    <>
                      <span className="lottery-stat-pill">💥 1800 Daño Volcánico</span>
                      <span className="lottery-stat-pill">🔥 Fuego de Línea Entera</span>
                      <span className="lottery-stat-pill">
                        👑 {activeAuction.copiesCount || (activeAuction.currency === 'gems' ? 2 : 1)}x Copia(s)
                      </span>
                    </>
                  ) : isLive ? (
                    <>
                      <span className="lottery-stat-pill">❤️ +350 HP</span>
                      <span className="lottery-stat-pill">🛡️ Defensa de Acero</span>
                      <span className="lottery-stat-pill">⚔️ Resistencia Máxima</span>
                    </>
                  ) : (
                    <>
                      <span className="lottery-stat-pill">❤️ +80 HP</span>
                      <span className="lottery-stat-pill">🧈 2x Mantequillas</span>
                      <span className="lottery-stat-pill">🎃 Hechizo Mágico</span>
                    </>
                  )}
                </div>

                <p className="lottery-auction-card-desc">
                  {activeAuction.description}
                </p>

                <div className="lottery-auction-card-footer">
                  <span className="lottery-auction-rarity-tag">👑 EXCLUSIVA DE SUBASTA</span>
                  {!isLive && activeAuction.highestBidderName && (
                    <span className="lottery-auction-winner-pill">
                      Ganador: @{activeAuction.highestBidderName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
