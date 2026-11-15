import { useEffect, useRef } from 'react'
import type { EstadoCola, ModoPartida } from '../../hooks/useMatchmaking'
import { RANKED_MATCHMAKING_TIMEOUT_SECONDS } from '../../utils/gameConstants'
import './MatchmakingScreen.css'

interface Props {
  modo: ModoPartida
  estado: EstadoCola
  apuesta?: { gemas: number; conTicket: boolean } | null
  onCancelar: () => void
}

const TITULOS: Record<ModoPartida, string> = {
  ranked:     'Buscando rival',
  friendly:   'Buscando partida amistosa',
  tournament: 'Buscando rival del torneo',
}

const SUBTITULOS: Record<ModoPartida, string> = {
  ranked:     'En juego: puntos de arena y un cofre si ganas.',
  friendly:   'Sin puntos ni recompensas. Sólo por jugar.',
  tournament: 'Sólo contra jugadores reales del torneo. Cero bots.',
}

function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function MatchmakingScreen({
  modo,
  estado,
  onCancelar,
}: Props) {
  const cancelarRef = useRef(onCancelar)
  cancelarRef.current = onCancelar
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelarRef.current()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [])

  const timeoutBotSegundos = RANKED_MATCHMAKING_TIMEOUT_SECONDS || 45
  const esRanked = modo === 'ranked'
  const segundos = estado.segundos
  const porcentaje = Math.min(100, Math.round((segundos / timeoutBotSegundos) * 100))
  const tiempoRestante = Math.max(0, timeoutBotSegundos - segundos)
  const botActivado = segundos >= timeoutBotSegundos

  return (
    <div className="mm">
      <div className="mm__panel" role="status" aria-live="polite">
        <div className="mm__latido" aria-hidden="true">
          <span className="mm__hoja">🌿</span>
        </div>

        <h1 className="mm__titulo">{TITULOS[modo] || 'Buscando rival'}</h1>
        <p className="mm__subtitulo">{SUBTITULOS[modo] || ''}</p>

        <div className="mm__tiempo">
          <span className="mm__tiempo-num">{reloj(segundos)}</span>
          <span className="mm__tiempo-eti">esperando</span>
        </div>

        {esRanked && (
          <div className="mm__bot-banner" role="region" aria-label="Aviso de emparejamiento con bot">
            <div className="mm__bot-banner-badge">
              <span className="mm__bot-banner-icon" aria-hidden="true">🤖</span>
              <span className="mm__bot-banner-badge-text">Emparejamiento Rápido</span>
            </div>

            <p className="mm__bot-banner-msg">
              Si no encuentras jugadores en <strong>{`${timeoutBotSegundos} segundos`}</strong>, se te emparejará con un bot. <span className="mm__bot-banner-disfruta">¡Disfruta el juego!</span>
            </p>

            <div className="mm__bot-barra-track" aria-hidden="true">
              <div
                className={`mm__bot-barra-fill ${botActivado ? 'mm__bot-barra-fill--listo' : ''}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>

            <div className="mm__bot-banner-status">
              {!botActivado ? (
                <>
                  <span className="mm__bot-pulse-dot" aria-hidden="true" />
                  <span>{`Buscando rivales... ${tiempoRestante}s restantes`}</span>
                </>
              ) : (
                <span className="mm__bot-ready-msg">
                  🎮 ¡Emparejando con bot! ¡A disfrutar la partida!
                </span>
              )}
            </div>
          </div>
        )}

        {estado.error && (
          <p className="mm__error" role="alert">
            {estado.error}
          </p>
        )}

        <button type="button" className="mm__boton" onClick={onCancelar}>
          Cancelar búsqueda
        </button>

        <p className="mm__pista">Pulsa Esc para cancelar</p>
      </div>
    </div>
  )
}
