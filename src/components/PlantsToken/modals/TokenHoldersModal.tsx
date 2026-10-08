import React, { useState, useEffect } from 'react'
import { soundManager } from '../../../utils/audioManager'
import { plantsTokenService, type PlantsTopHoldersData } from '../../../services/plantsTokenService'
import { getPlayerAvatarUrl } from '../../../utils/userManager'

interface TokenHoldersModalProps {
  isOpen: boolean
  onClose: () => void
}

export const TokenHoldersModal: React.FC<TokenHoldersModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<PlantsTopHoldersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'players' | 'vaults'>('all')

  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    setLoading(true)

    plantsTokenService.getTopHolders(100).then((res) => {
      if (isMounted) {
        setData(res)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleClose = () => {
    soundManager.playSound('click', 0.4)
    onClose()
  }

  const filteredHolders = (data?.holders || []).filter((h) =>
    h.username.toLowerCase().includes(search.toLowerCase().trim())
  )

  return (
    <div className="token-modal-backdrop" onClick={handleClose}>
      <div className="token-modal-card token-holders-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="token-modal-header">
          <div className="token-modal-header-left">
            <span className="token-modal-icon">👥</span>
            <div>
              <h3 className="token-modal-title">RANKING OFICIAL DE TOP HOLDERS</h3>
              <p className="token-modal-subtitle">
                Distribución transparente del suministro de 1,000,000 PLANTS (Sincronizado con la Base de Datos)
              </p>
            </div>
          </div>
          <button type="button" className="token-modal-close-btn" onClick={handleClose} title="Cerrar">
            ✕
          </button>
        </header>

        {/* Global KPI bar */}
        <div className="token-modal-kpi-bar">
          <div className="token-modal-kpi-pill">
            <span className="kpi-lbl">SUPPLY MÁXIMO</span>
            <strong className="kpi-val text-green">1,000,000 PLANTS</strong>
          </div>
          <div className="token-modal-kpi-pill">
            <span className="kpi-lbl">CIRCULANTE EMITIDO</span>
            <strong className="kpi-val text-cyan">
              {Number(data?.totalCirculating ?? 0).toLocaleString()} PLANTS
            </strong>
          </div>
          <div className="token-modal-kpi-pill">
            <span className="kpi-lbl">JUGADORES HOLDERS</span>
            <strong className="kpi-val text-gold">{data?.holdersCount ?? 0} Jugadores</strong>
          </div>
          <div className="token-modal-kpi-pill">
            <span className="kpi-lbl">STAKING POOL</span>
            <strong className="kpi-val text-mint">0 PLANTS (No Inflacionario)</strong>
          </div>
        </div>

        {/* Filters and search */}
        <div className="token-modal-controls">
          <div className="token-modal-subtabs">
            <button
              type="button"
              className={`token-modal-subtab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Todos ({ (data?.vaults.length ?? 0) + (data?.holders.length ?? 0) })
            </button>
            <button
              type="button"
              className={`token-modal-subtab ${activeTab === 'players' ? 'active' : ''}`}
              onClick={() => setActiveTab('players')}
            >
              🎮 Jugadores ({ data?.holders.length ?? 0 })
            </button>
            <button
              type="button"
              className={`token-modal-subtab ${activeTab === 'vaults' ? 'active' : ''}`}
              onClick={() => setActiveTab('vaults')}
            >
              🏛️ Bóvedas de Protocolo ({ data?.vaults.length ?? 0 })
            </button>
          </div>

          <div className="token-modal-search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar jugador por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="token-modal-search-input"
            />
          </div>
        </div>

        {/* Main Content Body */}
        <div className="token-modal-body">
          {loading ? (
            <div className="token-modal-loading">
              <span className="token-modal-spinner">🔄</span>
              <p>Consultando base de datos en tiempo real...</p>
            </div>
          ) : (
            <div className="token-holders-list-wrap">
              {/* Protocol Vaults */}
              {(activeTab === 'all' || activeTab === 'vaults') && (
                <div className="token-vaults-section">
                  <h4 className="token-section-title">🏛️ BÓVEDAS DEL PROTOCOLO Y CONTRATOS INTELIGENTES</h4>
                  <div className="token-vaults-grid">
                    {(data?.vaults || []).map((vault, i) => (
                      <div key={i} className={`token-vault-card token-vault-card--${vault.type}`}>
                        <div className="token-vault-top">
                          <span className="vault-badge">CONTRATO OFICIAL</span>
                          <span className="vault-share">{vault.sharePct.toFixed(1)}%</span>
                        </div>
                        <h5 className="vault-name">{vault.name}</h5>
                        <div className="vault-amount-row">
                          <strong className="vault-amount">{vault.allocation.toLocaleString()} PLANTS</strong>
                        </div>
                        <code className="vault-address">{vault.address}</code>
                        <p className="vault-desc">{vault.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Players Ranking */}
              {(activeTab === 'all' || activeTab === 'players') && (
                <div className="token-players-section">
                  <h4 className="token-section-title">
                    🎮 JUGADORES HOLDERS CON BALANCE (DATOS EN VIVO)
                  </h4>

                  {filteredHolders.length === 0 ? (
                    <div className="token-empty-holders-card">
                      <span className="empty-icon">🌱</span>
                      <h5>Aún no hay jugadores con balance de PLANTS</h5>
                      <p>
                        Gana partidas competitivas en Arena 3+ (2,001+ copas) o adquiere un Pack Fundador en la Preventa
                        para ser el primer holder en aparecer en este salón de la fama.
                      </p>
                    </div>
                  ) : (
                    <div className="token-holders-table">
                      <div className="holders-th">
                        <span>#</span>
                        <span>JUGADOR</span>
                        <span>COPAS (ELO)</span>
                        <span>LÍQUIDO</span>
                        <span>EN VESTING</span>
                        <span>TOTAL</span>
                        <span>% SUPPLY</span>
                      </div>
                      {filteredHolders.map((h) => (
                        <div key={h.userId} className="holders-tr">
                          <span className="holders-rank">#{h.rank}</span>
                          <div className="holders-player-cell">
                            <img
                              src={getPlayerAvatarUrl(h.avatar)}
                              alt={h.username}
                              className="holders-avatar-img"
                              onError={(e) => {
                                e.currentTarget.src = '/game-assets/greenfoot/peashooterpacket1.webp'
                              }}
                            />
                            <strong className="holders-username">{h.username}</strong>
                          </div>
                          <span className="holders-elo">🏆 {h.eloRating}</span>
                          <span className="holders-liquid text-cyan">{h.liquidPlants.toLocaleString()}</span>
                          <span className="holders-vesting text-gold">{h.vestingPlants.toLocaleString()}</span>
                          <span className="holders-total text-mint font-bold">{h.totalPlants.toLocaleString()}</span>
                          <span className="holders-share">{h.sharePct.toFixed(3)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="token-modal-footer">
          <span className="token-modal-footer-note">
            🛡️ Todos los balances provienen de cuentas verificadas en PostgreSQL Supabase y contratos AMM.
          </span>
          <button type="button" className="token-modal-btn-primary" onClick={handleClose}>
            ENTENDIDO
          </button>
        </footer>
      </div>
    </div>
  )
}
