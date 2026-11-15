import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import MatchmakingScreen from './MatchmakingScreen'
import { RANKED_MATCHMAKING_TIMEOUT_SECONDS } from '../../utils/gameConstants'
import fs from 'node:fs'
import path from 'node:path'

describe('MatchmakingScreen - Experiencia de Temporizador y Bot a los 45s', () => {
  const dummyCancelar = () => {}

  it('RANKED_MATCHMAKING_TIMEOUT_SECONDS es exactamente 45 segundos', () => {
    expect(RANKED_MATCHMAKING_TIMEOUT_SECONDS).toBe(45)
  })

  it('en modo ranked, muestra el aviso de emparejamiento con bot a los 45 segundos y el mensaje para disfrutar el juego', () => {
    const estado = {
      buscando: true,
      segundos: 10,
      plazoSegundos: null,
      mensaje: null,
      error: null,
    }

    const html = renderToString(
      <MatchmakingScreen
        modo="ranked"
        estado={estado}
        onCancelar={dummyCancelar}
      />
    )

    // Debe contener el mensaje exacto solicitado por el usuario
    expect(html).toContain('Si no encuentras jugadores en')
    expect(html).toContain('45 segundos')
    expect(html).toContain('se te emparejará con un bot')
    expect(html).toContain('¡Disfruta el juego!')

    // Debe mostrar el tiempo restante (45 - 10 = 35s)
    expect(html).toContain('35s restantes')
    expect(html).toContain('style="width:22%"')
  })

  it('en modo ranked cuando se alcanzan o superan los 45 segundos, la barra llega al 100% e indica que se está emparejando con bot', () => {
    const estado = {
      buscando: true,
      segundos: 45,
      plazoSegundos: null,
      mensaje: null,
      error: null,
    }

    const html = renderToString(
      <MatchmakingScreen
        modo="ranked"
        estado={estado}
        onCancelar={dummyCancelar}
      />
    )

    expect(html).toContain('style="width:100%"')
    expect(html).toContain('mm__bot-barra-fill--listo')
    expect(html).toContain('¡Emparejando con bot! ¡A disfrutar la partida!')
  })

  it('en modo tournament no muestra el banner de bot (preserva regla de torneos: cero bots)', () => {
    const estado = {
      buscando: true,
      segundos: 15,
      plazoSegundos: null,
      mensaje: null,
      error: null,
    }

    const html = renderToString(
      <MatchmakingScreen
        modo="tournament"
        estado={estado}
        onCancelar={dummyCancelar}
      />
    )

    expect(html).not.toContain('mm__bot-banner')
    expect(html).not.toContain('se te emparejará con un bot')
    expect(html).toContain('Sólo contra jugadores reales del torneo. Cero bots.')
  })

  it('en modo friendly no muestra el banner de bot de ranked', () => {
    const estado = {
      buscando: true,
      segundos: 15,
      plazoSegundos: null,
      mensaje: null,
      error: null,
    }

    const html = renderToString(
      <MatchmakingScreen
        modo="friendly"
        estado={estado}
        onCancelar={dummyCancelar}
      />
    )

    expect(html).not.toContain('mm__bot-banner')
    expect(html).toContain('Sin puntos ni recompensas. Sólo por jugar.')
  })

  it('MatchmakingScreen.css contiene los estilos necesarios para el banner del bot', () => {
    const cssPath = path.join(__dirname, 'MatchmakingScreen.css')
    const css = fs.readFileSync(cssPath, 'utf8')

    expect(css).toContain('.mm__bot-banner')
    expect(css).toContain('.mm__bot-barra-track')
    expect(css).toContain('.mm__bot-barra-fill')
    expect(css).toContain('.mm__bot-banner-msg')
    expect(css).toContain('.mm__bot-banner-disfruta')
    expect(css).toContain('.mm__bot-pulse-dot')
  })
})
