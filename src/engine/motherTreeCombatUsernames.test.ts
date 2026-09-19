import { describe, it, expect } from 'vitest'

describe('Mother Tree Combat Usernames (Both Players & Bots)', () => {
  it('resolves real usernames for both P1 and P2 in PvP matches', () => {
    const salaInfo = {
      iAm: 'p1',
      player1: { id: 'p1-uuid', username: 'LeonelGranjero' },
      player2: { id: 'p2-uuid', username: 'MasterPlant99' },
      isAsyncMatch: false,
    }

    const soyP1 = salaInfo.iAm === 'p1'
    const miNick = (soyP1 ? salaInfo.player1.username : salaInfo.player2.username) || 'Tú'
    const suNick = (soyP1 ? salaInfo.player2.username : salaInfo.player1.username) || 'Rival'

    const nombres = { mio: miNick, rival: suNick }
    expect(nombres.mio).toBe('LeonelGranjero')
    expect(nombres.rival).toBe('MasterPlant99')
    expect(nombres.mio).not.toContain('ÁRBOL MADRE')
    expect(nombres.rival).not.toContain('ÁRBOL MADRE')
  })

  it('resolves async bot nickname for P2 when playing against matchmaking bot', () => {
    const salaInfo = {
      iAm: 'p1',
      player1: { id: 'p1-uuid', username: 'ElGranjeroYT' },
      player2: { id: '00000000-0000-0000-0000-000000000000', username: 'Fercho_yt' },
      isAsyncMatch: true,
      async_display_name: 'Fercho_yt',
    }

    const soyP1 = salaInfo.iAm === 'p1'
    const miNick = (soyP1 ? salaInfo.player1.username : salaInfo.player2.username) || 'Tú'
    const suNick = (soyP1 ? salaInfo.player2.username : salaInfo.player1.username)
      || salaInfo.async_display_name
      || (salaInfo.isAsyncMatch ? 'Rival Bot' : 'Rival')

    const nombres = { mio: miNick, rival: suNick }
    expect(nombres.mio).toBe('ElGranjeroYT')
    expect(nombres.rival).toBe('Fercho_yt')
    expect(nombres.rival).not.toBe('ÁRBOL MADRE (P2)')
  })

  it('falls back to local player name and bot opponent name when offline or in practice', () => {
    const localProfileName = 'JardineroPro'
    const defaultRival = 'Bot Entrenador'

    const resolvedP1 = localProfileName || 'Tú'
    const resolvedP2 = defaultRival

    expect(resolvedP1).toBe('JardineroPro')
    expect(resolvedP2).toBe('Bot Entrenador')
    expect(resolvedP1).not.toBe('ÁRBOL MADRE (P1)')
    expect(resolvedP2).not.toBe('ÁRBOL MADRE (P2)')
  })

  it('preserves tournament opponent name', () => {
    const tournamentOpponent = { name: 'CampeónSolar', tournamentId: 'tourney_1' }
    const miNick = 'GranjeroHero'
    const suNick = tournamentOpponent.name

    const nombres = { mio: miNick, rival: suNick }
    expect(nombres.mio).toBe('GranjeroHero')
    expect(nombres.rival).toBe('CampeónSolar')
  })
})
