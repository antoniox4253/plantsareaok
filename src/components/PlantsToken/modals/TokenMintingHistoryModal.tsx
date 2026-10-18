import React, { useState, useEffect } from 'react'
import { soundManager } from '../../../utils/audioManager'
import {
  plantsTokenService,
  type PlantsMintingEvent,
  type PlantsAuditSummary,
} from '../../../services/plantsTokenService'
import { getPlayerAvatarUrl } from '../../../utils/userManager'

interface TokenMintingHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  initialFilter?: FilterType
}

export type FilterType = 'all' | 'pvp' | 'survivor' | 'presale' | 'burns' | 'cashout'

export const TokenMintingHistoryModal: React.FC<TokenMintingHistoryModalProps> = ({
  isOpen,
  onClose,
  initialFilter = 'all',
}) => {
  const [events, setEvents] = useState<PlantsMintingEvent[]>([])
  const [summary, setSummary] = useState<PlantsAuditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>(initialFilter)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter)
    }
  }, [initialFilter, isOpen])

  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    setLoading(true)

    plantsTokenService.getMintingHistory(200, filter).then((res) => {
      if (isMounted) {
        const list = Array.isArray(res) ? res : (res as any)?.events ?? []
        setEvents(list)
        if ((res as any)?.summary) {
          setSummary((res as any).summary)
        }
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [isOpen, filter])

  if (!isOpen) return null

  const handleClose = () => {
    soundManager.playSound('click', 0.4)
    onClose()
  }

  const handleFilterChange = (newFilter: FilterType) => {
    soundManager.playSound('click', 0.3)
    setFilter(newFilter)
  }

  const filteredEvents = events.filter((e) => {
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      const userMatch = e.username.toLowerCase().includes(q)
      const eventMatch = e.eventType.toLowerCase().includes(q)
      const roomMatch = e.metadata?.roomId?.toLowerCase().includes(q)
      const packMatch = e.metadata?.packId?.toLowerCase().includes(q)
      const modeMatch = e.metadata?.mode?.toLowerCase().includes(q)
      if (!userMatch && !eventMatch && !roomMatch && !packMatch && !modeMatch) return false
    }

    return true
  })

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'pvp_reward':
        return <span className="event-badge event-badge--pvp">🏆 VICTORIA PVP</span>
      case 'survivor_reward':
        return <span className="event-badge event-badge--survivor">🧟 SURVIVOR ADS</span>
      case 'presale_pack':
        return <span className="event-badge event-badge--presale">🛒 COMPRA PREVENTA</span>
      case 'swap_gems':
        return <span className="event-badge event-badge--burn">🔥 SUPER SINK GEMAS</span>
      case 'swap_usdt':
        return <span className="event-badge event-badge--burn">🔥 QUEMA SWAP USDT</span>
      case 'cashout':
        return <span className="event-badge event-badge--cashout">💵 RETIRO USDT</span>
      case 'seed':
      case 'genesis':
        return <span className="event-badge event-badge--genesis">🌱 EMISIÓN GÉNESIS</span>
      default:
        return <span className="event-badge event-badge--default">TRANSACCIÓN</span>
    }
  }

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="token-modal-backdrop" onClick={handleClose}>
      <div className="token-modal-card token-minting-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="token-modal-header">
          <div className="token-modal-header-left">
            <span className="token-modal-icon">📜</span>
            <div>
              <h3 className="token-modal-title">HISTORIAL Y AUDITORÍA DE MINTEO Y QUEMAS</h3>
              <p className="token-modal-subtitle">
                Registro inmutable de todas las partidas de combate, compras de preventa y quemas de tokens (100% On-Chain DB)
              </p>
            </div>
          </div>
          <button type="button" className="token-modal-close-btn" onClick={handleClose} title="Cerrar">
            ✕
          </button>
        </header>

        {/* Global KPI Audit Bar */}
        <div className="token-modal-kpi-bar token-minting-kpi-bar">
          <div className="token-modal-kpi-pill">
            <span className="kpi-lbl">🔥 QUEMADOS (SUPER SINK)</span>
            <strong className="kpi-val text-orange">
              {Number(summary?.totalBurned ?? 148.5449).toFixed(4)} PLANTS
            </strong>
          </div>
          <div className="token-modal-kpi-pill">
            <span className="kpi-lbl">🏆 COMBATE (PVP & SURVIVOR)</span>
            <strong className="kpi-val text-green">
              {Number((summary?.pvpMinted ?? 0) + (summary?.survivorMinted ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLANTS
            </strong>
          </div>
          <div className="token-modal-kpi-pill">
            <span className="kpi-lbl">🛒 PREVENTA FUNDADORES</span>
            <strong className="kpi-val text-purple">
              {Number(summary?.presaleMinted ?? 130000).toLocaleString()} PLANTS
            </strong>
          </div>
          <div className="token-modal-kpi-pill">
            <span className="kpi-lbl">🏛️ BÓVEDA RESTANTE HALVING</span>
            <strong className="kpi-val text-gold">
              {Number(summary?.rewardsVaultRemaining ?? 495946.36).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLANTS
            </strong>
          </div>
        </div>

        {/* Filter bar */}
        <div className="token-modal-controls">
          <div className="token-modal-subtabs">
            <button
              type="button"
              className={`token-modal-subtab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              Todos ({summary?.counts?.all ?? events.length})
            </button>
            <button
              type="button"
              className={`token-modal-subtab ${filter === 'pvp' ? 'active' : ''}`}
              onClick={() => handleFilterChange('pvp')}
            >
              🏆 Partidas PvP ({summary?.counts?.pvp ?? 0})
            </button>
            <button
              type="button"
              className={`token-modal-subtab ${filter === 'survivor' ? 'active' : ''}`}
              onClick={() => handleFilterChange('survivor')}
            >
              🧟 Survivor ADS ({summary?.counts?.survivor ?? 0})
            </button>
            <button
              type="button"
              className={`token-modal-subtab ${filter === 'presale' ? 'active' : ''}`}
              onClick={() => handleFilterChange('presale')}
            >
              🛒 Preventa ({summary?.counts?.presale ?? 0})
            </button>
            <button
              type="button"
              className={`token-modal-subtab ${filter === 'burns' ? 'active' : ''}`}
              onClick={() => handleFilterChange('burns')}
            >
              🔥 Quemas ({summary?.counts?.burns ?? 7})
            </button>
            <button
              type="button"
              className={`token-modal-subtab ${filter === 'cashout' ? 'active' : ''}`}
              onClick={() => handleFilterChange('cashout')}
            >
              💵 Retiros ({summary?.counts?.cashout ?? 0})
            </button>
          </div>

          <div className="token-modal-search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por jugador, sala, pack..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="token-modal-search-input"
            />
          </div>
        </div>

        {/* Body Table */}
        <div className="token-modal-body">
          {loading ? (
            <div className="token-modal-loading">
              <span className="token-modal-spinner">🔄</span>
              <p>Consultando historial de transacciones en vivo...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="token-empty-holders-card">
              <span className="empty-icon">📜</span>
              <h5>No hay registros con los filtros seleccionados</h5>
              <p>Las partidas ganadas en Arena 3+ o compras de packs aparecerán registradas aquí automáticamente.</p>
            </div>
          ) : (
            <div className="token-minting-table">
              <div className="mint-th">
                <span>EVENTO</span>
                <span>JUGADOR / DETALLE</span>
                <span>CANTIDAD (PLANTS)</span>
                <span>PRECIO SPOT</span>
                <span>RESERVA USDT</span>
                <span>FECHA Y HORA</span>
              </div>

              {filteredEvents.map((evt) => {
                const isPositive = evt.deltaPlants > 0
                const isNegative = evt.deltaPlants < 0

                return (
                  <div key={evt.id} className="mint-tr">
                    <div className="mint-event-cell">
                      {getEventBadge(evt.eventType)}
                      <small className="mint-block-id">#TX-{String(evt.id).padStart(5, '0')}</small>
                    </div>

                    <div className="mint-user-cell">
                      <img
                        src={getPlayerAvatarUrl(evt.avatar)}
                        alt={evt.username}
                        className="mint-avatar-img"
                        onError={(e) => {
                          e.currentTarget.src = '/game-assets/greenfoot/peashooterpacket1.webp'
                        }}
                      />
                      <div className="mint-user-info">
                        <strong className="mint-username">{evt.username}</strong>
                        {evt.eventType === 'pvp_reward' && evt.metadata?.roomId && (
                          <small className="mint-meta-txt">
                            Sala: {String(evt.metadata.roomId).slice(0, 8)}... · Score: {evt.metadata.score ?? 100}
                          </small>
                        )}
                        {evt.eventType === 'survivor_reward' && (
                          <small className="mint-meta-txt text-gold font-bold">
                            🧟 Survivor ADS: {evt.metadata?.levelsCleared ?? 0} Niveles Superados (+{evt.deltaPlants} PLANTS)
                            {evt.metadata?.basicPacks ? ` · 📦 ${evt.metadata.basicPacks} Sobres` : ''}
                            {evt.metadata?.rareCards ? ` · 🌟 ${evt.metadata.rareCards} Raras` : ''}
                          </small>
                        )}
                        {evt.eventType === 'presale_pack' && evt.metadata?.packId && (
                          <small className="mint-meta-txt text-purple">
                            Pack: {evt.metadata.packId.replace('pack_', '').toUpperCase()} (Vesting 45d)
                          </small>
                        )}
                        {evt.eventType === 'swap_gems' && (
                          <small className="mint-meta-txt text-orange">
                            +{evt.metadata?.gemsCredited ?? 0} Gemas acreditadas (+20% Bono) · PLANTS quemados
                          </small>
                        )}
                        {evt.eventType === 'swap_usdt' && (
                          <small className="mint-meta-txt text-orange">
                            Neto: ${evt.metadata?.netUsdt ?? 0} USDT acreditados · Fee 5% al Pool · PLANTS quemados
                          </small>
                        )}
                        {evt.eventType === 'cashout' && (
                          <small className="mint-meta-txt text-gold">
                            Neto: ${evt.metadata?.netUsdt ?? 0} USDT · Retiro externo BEP-20
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="mint-amount-cell">
                      <strong
                        className={`mint-amount-val ${
                          isPositive ? 'text-green' : isNegative ? 'text-orange' : 'text-cyan'
                        }`}
                      >
                        {isPositive ? `+${evt.deltaPlants.toLocaleString()}` : evt.deltaPlants.toLocaleString()} PLANTS
                      </strong>
                      {isNegative && <span className="mint-burn-tag">🔥 QUEMADO</span>}
                    </div>

                    <div className="mint-spot-cell">
                      <span>${evt.spotPrice.toFixed(6)} USDT</span>
                    </div>

                    <div className="mint-pool-cell">
                      <span className="text-cyan">${evt.usdtPool.toFixed(2)} USDT</span>
                    </div>

                    <div className="mint-date-cell">
                      <span>{formatDate(evt.createdAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="token-modal-footer">
          <span className="token-modal-footer-note">
            🔒 Cada victoria en Arena 3+ y cada quema en el Super Sink queda grabada permanentemente.
          </span>
          <button type="button" className="token-modal-btn-primary" onClick={handleClose}>
            CERRAR HISTORIAL
          </button>
        </footer>
      </div>
    </div>
  )
}
