import React from 'react'
import type { PlayerNotificationItem } from '../../services/supabaseService'
import { soundManager } from '../../utils/audioManager'
import './NotificationModal.css'

interface NotificationModalProps {
  isOpen: boolean
  onClose: () => void
  notifications: PlayerNotificationItem[]
  unreadCount: number
  onMarkAllAsRead: () => void
  onRefresh: () => void
  loading?: boolean
}

function formatNotificationTime(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
    if (diff < 60) return 'Hace un momento'
    const minutes = Math.floor(diff / 60)
    if (minutes < 60) return `Hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Hace ${hours} h`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Ayer'
    return `Hace ${days} días`
  } catch {
    return 'Reciente'
  }
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onRefresh,
  loading = false,
}) => {
  if (!isOpen) return null

  return (
    <div className="notif-modal-backdrop" onClick={onClose}>
      <div className="notif-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <div className="notif-modal-header">
          <div className="notif-modal-title-wrap">
            <span className="notif-modal-icon">🔔</span>
            <div>
              <h3 className="notif-modal-title">CENTRO DE NOTIFICACIONES</h3>
              <p className="notif-modal-subtitle">
                Avisos de alquileres, ingresos de gemas y actividad de tu Jardín
              </p>
            </div>
          </div>

          <div className="notif-modal-header-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-mark-read-btn"
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  onMarkAllAsRead()
                }}
                title="Marcar todas como leídas"
              >
                ✓ Marcar leídas
              </button>
            )}
            <button
              type="button"
              className="notif-refresh-btn"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                onRefresh()
              }}
              disabled={loading}
              title="Refrescar notificaciones"
            >
              {loading ? '⏳' : '🔄'}
            </button>
            <button
              type="button"
              className="notif-modal-close-btn"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                onClose()
              }}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Lista de Notificaciones */}
        <div className="notif-modal-body">
          {notifications.length === 0 ? (
            <div className="notif-empty-state">
              <span className="notif-empty-icon">📭</span>
              <h4>Sin notificaciones nuevas</h4>
              <p>
                Aquí verás los avisos de tus alquileres de cartas, ingresos pasivos de gemas 💎,
                renovaciones y plantas devueltas a tu Jardín.
              </p>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map((n) => {
                const isIncome = n.type === 'rental_income' || n.title.includes('INGRESO')
                const isRenew = n.type === 'rental_renewed'
                const isReturn = n.type === 'rental_return'

                return (
                  <div
                    key={n.id}
                    className={`notif-item ${!n.isRead ? 'notif-item--unread' : ''} ${
                      isIncome ? 'notif-item--income' : isRenew ? 'notif-item--renew' : isReturn ? 'notif-item--return' : ''
                    }`}
                  >
                    <div className="notif-item-left">
                      <span className="notif-item-icon">{n.icon || '🔔'}</span>
                      {!n.isRead && <span className="notif-unread-dot" title="No leída" />}
                    </div>

                    <div className="notif-item-content">
                      <div className="notif-item-top">
                        <strong className="notif-item-title">{n.title}</strong>
                        <span className="notif-item-time">{formatNotificationTime(n.createdAt)}</span>
                      </div>
                      <p className="notif-item-message">{n.message}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="notif-modal-footer">
          <span className="notif-footer-note">
            💡 Las cartas en alquiler te generan gemas pasivas de forma segura y automática.
          </span>
          <button
            type="button"
            className="clan-dialog-btn clan-dialog-btn--cancel"
            onClick={onClose}
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationModal
