import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { auctionService, type ActiveAuctionData, type AuctionBid } from '../../services/auctionService'
import { soundManager } from '../../utils/audioManager'
import './Auction.css'

interface AuctionModalProps {
  isOpen: boolean
  onClose: () => void
  userTokens: number
  onTokensDeducted?: (newTokens: number) => void
  onPlantClaimed?: () => void
  userId?: string
  username?: string
}

export const AuctionModal: React.FC<AuctionModalProps> = ({
  isOpen,
  onClose,
  userTokens,
  onTokensDeducted,
  onPlantClaimed,
  userId,
  username,
}) => {
  const [auction, setAuction] = useState<ActiveAuctionData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [bidAmount, setBidAmount] = useState<number>(500)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [remainingMs, setRemainingMs] = useState<number>(0)
  const [isClaiming, setIsClaiming] = useState<boolean>(false)
  const [rankingPage, setRankingPage] = useState<number>(0)

  const BIDS_PER_PAGE = 4
  const totalBidPages = Math.max(1, Math.ceil((auction?.bids.length || 0) / BIDS_PER_PAGE))
  const paginatedBids = useMemo(() => {
    if (!auction?.bids) return []
    const start = rankingPage * BIDS_PER_PAGE
    return auction.bids.slice(start, start + BIDS_PER_PAGE)
  }, [auction?.bids, rankingPage])

  // Cargar datos de la subasta activa
  const fetchAuction = useCallback(async () => {
    const data = await auctionService.getActiveAuction()
    if (data) {
      setAuction(data)
      const now = Date.now()
      const diff = Math.max(0, data.endTime - now)
      setRemainingMs(diff)

      // Sugerir la siguiente puja válida
      if (data.highestBidderId) {
        setBidAmount(data.currentBid + data.minBidStep)
      } else {
        setBidAmount(data.startingBid)
      }
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    fetchAuction()

    // Suscribirse a cambios en tiempo real
    const unsubscribe = auctionService.subscribeToAuctionChanges(() => {
      fetchAuction()
    })

    return () => {
      unsubscribe()
    }
  }, [isOpen, fetchAuction])

  // Temporizador de cuenta regresiva (30 horas)
  useEffect(() => {
    if (!isOpen || !auction) return

    const timer = setInterval(() => {
      const now = Date.now()
      const diff = Math.max(0, auction.endTime - now)
      setRemainingMs(diff)

      if (diff <= 0 && auction.status === 'active') {
        fetchAuction()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, auction, fetchAuction])

  // Cerrar con la tecla Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundManager.playSound('click', 0.4)
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Formato de tiempo HH:MM:SS
  const formatCountdown = useMemo(() => {
    if (remainingMs <= 0) return '00:00:00 (EXPIRADA)'

    const totalSeconds = Math.floor(remainingMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
  }, [remainingMs])

  const isExpired = remainingMs <= 0 || auction?.status === 'completed'
  const isHighestBidder = Boolean(userId && auction?.highestBidderId === userId)
  const minRequiredBid = useMemo(() => {
    if (!auction) return 500
    if (!auction.highestBidderId) return auction.startingBid
    return auction.currentBid + auction.minBidStep
  }, [auction])

  const handleQuickAdd = (increment: number) => {
    soundManager.playSound('click', 0.4)
    setBidAmount((prev) => Math.max(minRequiredBid, prev + increment))
    setFeedback(null)
  }

  const handlePlaceBid = async () => {
    if (!auction) return

    if (bidAmount < minRequiredBid) {
      setFeedback({
        type: 'error',
        message: `La puja mínima debe ser de al menos ${minRequiredBid} 💎`,
      })
      return
    }

    // Calcular costo real en caso de ser el líder actual
    const needed = isHighestBidder ? bidAmount - auction.currentBid : bidAmount
    if (userTokens < needed) {
      setFeedback({
        type: 'error',
        message: `Saldo insuficiente. Necesitas ${needed} 💎 (tienes ${userTokens})`,
      })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const res = await auctionService.placeBid(auction.id, bidAmount)
      if (res.success) {
        soundManager.playSound('points', 0.6)
        setFeedback({
          type: 'success',
          message: `¡Puja de ${bidAmount} 💎 enviada con éxito! Eres el nuevo líder 👑`,
        })
        if (res.remainingGems !== undefined && onTokensDeducted) {
          onTokensDeducted(res.remainingGems)
        }
        await fetchAuction()
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Error al procesar la puja',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error inesperado',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClaimReward = async () => {
    if (!auction) return
    setIsClaiming(true)
    try {
      const res = await auctionService.claimReward(auction.id)
      if (res.success) {
        soundManager.playSound('points', 0.8)
        setFeedback({
          type: 'success',
          message: res.message || '¡Carta reclamada con éxito!',
        })
        await fetchAuction()
        onPlantClaimed?.()
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'No se pudo reclamar la carta',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error inesperado',
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

  if (!isOpen) return null

  return (
    <div className="auction-modal-backdrop" onClick={onClose}>
      <div className="auction-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* BARRA SUPERIOR */}
        <div className="auction-modal-header">
          <div className="auction-header-left">
            <button
              type="button"
              className="auction-back-btn"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                onClose()
              }}
              title="Volver al Menú Principal"
            >
              <span className="auction-back-btn-icon">◀</span>
              <span>VOLVER</span>
            </button>
            <div className="auction-header-badge">
              <span className="auction-header-badge-dot" />
              <span>{isExpired ? 'Subasta Finalizada' : 'Subasta en Vivo'}</span>
            </div>
            <h2 className="auction-header-title">🎃 Gran Subasta Mítica de Plant Arena</h2>
          </div>
          <button
            type="button"
            className="auction-modal-close-btn"
            onClick={() => {
              soundManager.playSound('click', 0.4)
              onClose()
            }}
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* LAYOUT HORIZONTAL DE 2 COLUMNAS */}
        {isLoading && !auction ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#e9d5ff', fontSize: '1.1rem', fontWeight: 700 }}>
            ⏳ Sincronizando datos de la Subasta en Vivo...
          </div>
        ) : (
          <div className="auction-horizontal-body">
            {/* COLUMNA IZQUIERDA: PUJAS, TEMPORIZADOR Y RANKING (SIN SCROLL) */}
            <div className="auction-col-left">
              {/* 1. Resumen Consolidado Superior: Puja, Líder y Temporizador en 1 sola franja */}
              <div className="auction-top-summary-card">
                <div className="auction-summary-col">
                  <span className="auction-summary-tag">
                    {auction?.highestBidderId ? 'Puja Actual' : 'Precio Inicial'}
                  </span>
                  <div className="auction-summary-val-wrap">
                    <span className="auction-summary-amount">
                      {auction ? auction.currentBid.toLocaleString() : 500}
                    </span>
                    <span className="auction-summary-icon">💎</span>
                  </div>
                </div>

                <div className="auction-summary-col auction-summary-col--leader">
                  <span className="auction-summary-tag">
                    {auction?.highestBidderId ? (isHighestBidder ? '👑 ¡ERES EL LÍDER!' : '👑 MÁXIMO POSTOR') : 'ESTADO'}
                  </span>
                  <span className="auction-summary-leader">
                    {auction?.highestBidderName
                      ? `@${auction.highestBidderName}`
                      : isHighestBidder && username
                      ? `@${username}`
                      : 'Sin ofertas'}
                  </span>
                </div>

                <div className="auction-summary-col auction-summary-col--timer">
                  <span className="auction-summary-tag">
                    {isExpired ? 'FINALIZADA' : '⏱️ RESTANTE (30H)'}
                  </span>
                  <span className={`auction-summary-timer ${isExpired ? 'auction-summary-timer--expired' : ''}`}>
                    {formatCountdown}
                  </span>
                </div>
              </div>

              {/* 2. Consola para Pujar o Reclamar Carta */}
              <div className="auction-bid-console">
                <div className="auction-console-top">
                  <span>Tu saldo disponible:</span>
                  <span className="auction-user-gems-balance">
                    <span>💎</span> {userTokens.toLocaleString()} Gemas
                  </span>
                </div>

                {isExpired ? (
                  auction?.highestBidderId === userId && !auction?.rewardClaimed ? (
                    <button
                      type="button"
                      className="auction-claim-btn"
                      onClick={handleClaimReward}
                      disabled={isClaiming}
                    >
                      {isClaiming ? 'RECLAMANDO CARTA...' : '🏆 ¡ERES EL GANADOR! RECLAMAR CARTA'}
                    </button>
                  ) : auction?.rewardClaimed ? (
                    <div className="auction-feedback-msg auction-feedback-msg--success">
                      🎉 Esta carta ya fue reclamada por el ganador @{auction?.highestBidderName}
                    </div>
                  ) : (
                    <div className="auction-feedback-msg auction-feedback-msg--info">
                      🏁 Subasta concluida. Ganador definitivo: @{auction?.highestBidderName || 'Nadie'}
                    </div>
                  )
                ) : (
                  <>
                    {/* Fila 1: Input y botón principal alineados sin desborde */}
                    <div className="auction-input-row">
                      <div className="auction-input-container">
                        <span className="auction-input-prefix">💎</span>
                        <input
                          type="number"
                          className="auction-bid-input"
                          value={bidAmount}
                          min={minRequiredBid}
                          step={10}
                          onChange={(e) => setBidAmount(Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <button
                        type="button"
                        className="auction-submit-btn"
                        onClick={handlePlaceBid}
                        disabled={isSubmitting || bidAmount < minRequiredBid}
                      >
                        {isSubmitting ? (
                          'PROCESANDO...'
                        ) : isHighestBidder ? (
                          `👑 SUBIR A ${bidAmount.toLocaleString()} 💎`
                        ) : (
                          `⚡ PUJAR ${bidAmount.toLocaleString()} 💎`
                        )}
                      </button>
                    </div>

                    {/* Fila 2: Grid de 4 botones rápidos que nunca se desbordan */}
                    <div className="auction-quick-btn-grid">
                      <button type="button" className="auction-quick-btn" onClick={() => handleQuickAdd(10)}>+10 💎</button>
                      <button type="button" className="auction-quick-btn" onClick={() => handleQuickAdd(50)}>+50 💎</button>
                      <button type="button" className="auction-quick-btn" onClick={() => handleQuickAdd(100)}>+100 💎</button>
                      <button type="button" className="auction-quick-btn" onClick={() => handleQuickAdd(500)}>+500 💎</button>
                    </div>
                  </>
                )}

                {feedback && (
                  <div className={`auction-feedback-msg auction-feedback-msg--${feedback.type}`}>
                    {feedback.message}
                  </div>
                )}
              </div>

              {/* 3. Ranking e Historial de Ofertas Paginado (Cero Scroll) */}
              <div className="auction-ranking-section">
                <div className="auction-ranking-title">
                  <div className="auction-ranking-title-left">
                    <span>HISTORIAL DE OFERTAS ({auction?.totalBids ?? 0})</span>
                    <span className="auction-ranking-badge">EN VIVO</span>
                  </div>
                  {auction && auction.bids.length > BIDS_PER_PAGE && (
                    <div className="auction-pagination-controls">
                      <button
                        type="button"
                        className="auction-page-btn"
                        disabled={rankingPage === 0}
                        onClick={() => setRankingPage((p) => Math.max(0, p - 1))}
                        title="Página anterior"
                      >
                        ◀
                      </button>
                      <span className="auction-page-indicator">
                        {rankingPage + 1} / {totalBidPages}
                      </span>
                      <button
                        type="button"
                        className="auction-page-btn"
                        disabled={rankingPage >= totalBidPages - 1}
                        onClick={() => setRankingPage((p) => Math.min(totalBidPages - 1, p + 1))}
                        title="Página siguiente"
                      >
                        ▶
                      </button>
                    </div>
                  )}
                </div>

                <div className="auction-ranking-list">
                  {auction && auction.bids.length > 0 ? (
                    paginatedBids.map((bid: AuctionBid, index: number) => {
                      const globalRank = rankingPage * BIDS_PER_PAGE + index + 1
                      const isLeader = globalRank === 1
                      return (
                        <div
                          key={bid.id}
                          className={`auction-ranking-item ${isLeader ? 'auction-ranking-item--leader' : ''}`}
                        >
                          <div className="auction-item-user">
                            <span className="auction-rank-badge">
                              {isLeader ? '👑' : `#${globalRank}`}
                            </span>
                            <span className="auction-username-text">@{bid.username}</span>
                          </div>
                          <div className="auction-item-bid">
                            <span className="auction-item-amount">{bid.bidAmount.toLocaleString()} 💎</span>
                            <span className="auction-item-time">{formatTimeAgo(bid.createdAt)}</span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="auction-empty-bids">
                      Aún no hay ofertas en esta subasta. ¡Sé el primero en pujar por 500 💎!
                    </div>
                  )}
                </div>
              </div>
            </div>

          {/* COLUMNA DERECHA: TOP AURA & CARTA EXCLUSIVA */}
          <div className="auction-col-right">
            {/* EFECTO TOP AURA */}
            <div className="auction-top-aura-layer">
              <div className="auction-aura-circle auction-aura-circle--primary" />
              <div className="auction-aura-circle auction-aura-circle--spinning" />
              <div className="auction-aura-circle auction-aura-circle--outer" />
            </div>

            {/* CARTA EN EXHIBICIÓN */}
            <div className="auction-card-showcase">
              <div className="auction-plant-image-wrap">
                <img
                  src="/game-assets/auction/kernel_witch.png"
                  alt="Lanzamaíz Bruja"
                  className="auction-plant-img"
                />
              </div>

              <div className="auction-rarity-tag">
                <span>⭐</span>
                <span>EDICIÓN MÍTICA HALLOWEEN · 1 DE 1</span>
              </div>

              <h3 className="auction-plant-title">Lanzamaíz Bruja</h3>

              <p className="auction-plant-desc">
                Catapulta encantada con sombrero místico de bruja y calabazas oscuras. Lanza proyectiles mágicos que petrifican e infligen daño masivo en área.
              </p>

              <div className="auction-plant-stats-row">
                <div className="auction-stat-pill auction-stat-pill--hp">
                  <span>💚</span> +200 HP
                </div>
                <div className="auction-stat-pill auction-stat-pill--dmg">
                  <span>⚔️</span> +25 Daño Mágico
                </div>
                <div className="auction-stat-pill auction-stat-pill--bonus">
                  <span>🎃</span> Proyectil Embrujado
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default AuctionModal
