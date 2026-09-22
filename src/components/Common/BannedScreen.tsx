import React from 'react'
import './BannedScreen.css'

export interface BannedScreenProps {
  username?: string | null
  banReason?: string | null
  onSignOut: () => void
}

export const BannedScreen: React.FC<BannedScreenProps> = ({
  username,
  banReason,
  onSignOut,
}) => {
  return (
    <div className="banned-screen-overlay">
      <div className="banned-screen-card" role="alertdialog" aria-modal="true" aria-labelledby="banned-title">
        <div className="banned-screen__badge" aria-hidden="true">
          🚫
        </div>

        <h1 id="banned-title" className="banned-screen__title">
          Cuenta Suspendida
        </h1>

        {username && (
          <div className="banned-screen__username">
            Jugador: <strong>{username}</strong>
          </div>
        )}

        <p className="banned-screen__desc">
          Esta cuenta ha sido inhabilitada para participar en partidas y acceder a las funciones del juego debido a infracciones de las políticas de Plant Arena (multicuentas, colusión o farmeo de recursos).
        </p>

        <div className="banned-screen__reason-box">
          <span className="banned-screen__reason-label">Motivo Registrado</span>
          <p className="banned-screen__reason-text">
            {banReason || 'Infracción de las reglas de seguridad o uso no autorizado de cuentas múltiples.'}
          </p>
        </div>

        <p className="banned-screen__support-hint">
          Si consideras que se trata de un error o deseas apelar con pruebas de juego legítimo en un hogar compartido, comunícate con la administración a través de los canales oficiales.
        </p>

        <div className="banned-screen__actions">
          <button
            type="button"
            className="banned-screen__signout-btn"
            onClick={onSignOut}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  )
}

export default BannedScreen
