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
            <div className="auction-header-badge">
              <span className="auction-header-badge-dot" />
              <span>{isExpired ? 'Subasta Finalizada' : 'Subasta en Vivo'}</span>
            </div>
            <h2 className="auction-header-title">🎃 Gran Subasta Mítica de Plant Arena</h2>
          </div>
          <button
            type="button"
            className="auction-modal-close-btn"
            onClick={onClose}
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
            {/* COLUMNA IZQUIERDA: PUJAS, TEMPORIZADOR Y RANKING */}
            <div className="auction-col-left">
              {/* 1. Temporizador de 30 horas */}
              <div className="auction-timer-banner">
                <div className="auction-timer-label">
                  <span>⏱️</span>
                  <span>{isExpired ? 'TIEMPO FINALIZADO' : 'TIEMPO RESTANTE (30H):'}</span>
                </div>
                <div className={`auction-timer-digits ${isExpired ? 'auction-timer-digits--expired' : ''}`}>
                  {formatCountdown}
                </div>
              </div>

              {/* 2. Tarjeta del Líder Actual */}
              <div className="auction-leader-card">
                <div className="auction-current-bid-info">
                  <span className="auction-bid-tag">
                    {auction?.highestBidderId ? 'Última Puja Más Alta' : 'Precio Inicial'}
                  </span>
                  <div className="auction-bid-amount-wrap">
                    <span className="auction-bid-amount">
                      {auction ? auction.currentBid.toLocaleString() : 500}
                    </span>
                    <span className="auction-bid-gem-icon">💎</span>
                  </div>
                </div>

                <div className="auction-leader-user">
                  <span className="auction-leader-user-tag">
                    {auction?.highestBidderId ? (isHighestBidder ? '👑 ¡ERES EL LÍDER!' : '👑 MÁXIMO POSTOR') : 'ESTADO INICIAL'}
                  </span>
                  <span className="auction-leader-name">
                    {auction?.highestBidderName
                      ? `@${auction.highestBidderName}`
                      : isHighestBidder && username
                      ? `@${username}`
                      : 'Sin ofertas aún'}
                  </span>
                </div>
              </div>

            {/* 3. Consola para Pujar o Reclamar Carta */}
            <div className="auction-bid-console">
              <div className="auction-console-top">
                <span>Tu saldo disponible:</span>
                <span className="auction-user-gems-balance">
                  <span>💎</span> {userTokens.toLocaleString()} Gemas
                </span>
              </div>

              {isExpired ? (
                // SUBASTA EXPIRADA: RECLAMO O AVISO
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
                // SUBASTA EN CURSO: CONSOLA DE PUJA
                <>
                  <div className="auction-input-row">
                    <input
                      type="number"
                      className="auction-bid-input"
                      value={bidAmount}
                      min={minRequiredBid}
                      step={10}
                      onChange={(e) => setBidAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                    <div className="auction-quick-btn-group">
                      <button type="button" className="auction-quick-btn" onClick={() => handleQuickAdd(10)}>+10</button>
                      <button type="button" className="auction-quick-btn" onClick={() => handleQuickAdd(50)}>+50</button>
                      <button type="button" className="auction-quick-btn" onClick={() => handleQuickAdd(100)}>+100</button>
                      <button type="button" className="auction-quick-btn" onClick={() => handleQuickAdd(500)}>+500</button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="auction-submit-btn"
                    onClick={handlePlaceBid}
                    disabled={isSubmitting || bidAmount < minRequiredBid}
                  >
                    {isSubmitting ? (
                      'PROCESANDO OFERTA...'
                    ) : isHighestBidder ? (
                      `👑 AUMENTAR MI PUJA A ${bidAmount.toLocaleString()} 💎`
                    ) : (
                      `⚡ OFERTAR ${bidAmount.toLocaleString()} 💎`
                    )}
                  </button>
                </>
              )}

              {feedback && (
                <div className={`auction-feedback-msg auction-feedback-msg--${feedback.type}`}>
                  {feedback.message}
                </div>
              )}
            </div>

            {/* 4. Ranking / Historial de Ofertas */}
            <div className="auction-ranking-section">
              <div className="auction-ranking-title">
                <span>HISTORIAL DE OFERTAS ({auction?.totalBids ?? 0})</span>
                <span>LÍDERES EN VIVO</span>
              </div>

              <div className="auction-ranking-list">
                {auction && auction.bids.length > 0 ? (
                  auction.bids.map((bid: AuctionBid, index: number) => {
                    const isLeader = index === 0
                    return (
                      <div
                        key={bid.id}
                        className={`auction-ranking-item ${isLeader ? 'auction-ranking-item--leader' : ''}`}
                      >
                        <div className="auction-item-user">
                          <span className="auction-rank-badge">
                            {isLeader ? '👑' : `#${index + 1}`}
                          </span>
                          <span>@{bid.username}</span>
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
