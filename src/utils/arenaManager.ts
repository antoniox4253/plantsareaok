import arena1Bg from '../assets/images/battlefield-bg.webp'
import arena2Bg from '../assets/images/battlefield-bg2.webp'
import arena3Bg from '../assets/images/battlefield-bg3.webp'
import arena4Bg from '../assets/images/battlefield-bg4.webp'
import arena5Bg from '../assets/images/battlefield-bg5.webp'

export interface ArenaInfo {
  id: number
  name: string
  minElo: number
  maxElo: number
  bgImage: string
  tagline: string
  badgeColor: string
  borderColor: string
}

export const ARENAS: ArenaInfo[] = [
  {
    id: 1,
    name: 'Arena 1: Jardín Clásico',
    minElo: 0,
    maxElo: 1600,
    bgImage: arena1Bg,
    tagline: 'Campo de césped tradicional bajo el sol resplandeciente.',
    badgeColor: '#4ade80',
    borderColor: '#22c55e',
  },
  {
    id: 2,
    name: 'Arena 2: Desierto Nocturno',
    minElo: 1601,
    maxElo: 3000,
    bgImage: arena2Bg,
    tagline: 'Dunas desérticas con cactus bioluminiscentes y luna llena.',
    badgeColor: '#60a5fa',
    borderColor: '#3b82f6',
  },
  {
    id: 3,
    name: 'Arena 3: Rascacielos Cyberpunk',
    minElo: 3001,
    maxElo: 5000,
    bgImage: arena3Bg,
    tagline: 'Azotea futurista sobre la metrópolis con luces neón.',
    badgeColor: '#c084fc',
    borderColor: '#a855f7',
  },
  {
    id: 4,
    name: 'Arena 4: Coliseo Galáctico',
    minElo: 5001,
    maxElo: 8000,
    bgImage: arena4Bg,
    tagline: 'Plataforma espacial flotante entre nebulosas y meteoritos.',
    badgeColor: '#fde047',
    borderColor: '#eab308',
  },
  {
    id: 5,
    name: 'Arena 5: Olimpo de Leyendas',
    minElo: 8001,
    maxElo: Infinity,
    bgImage: arena5Bg,
    tagline: 'Palacio sagrado de oro supremo para los reyes de Plant Arena.',
    badgeColor: '#f43f5e',
    borderColor: '#ef4444',
  },
]

export function getArenaForElo(elo: number): ArenaInfo {
  const safeElo = Math.max(0, typeof elo === 'number' && !isNaN(elo) ? elo : 0)
  if (safeElo >= ARENAS[ARENAS.length - 1].minElo) {
    return ARENAS[ARENAS.length - 1]
  }
  const found = ARENAS.find((a) => safeElo >= a.minElo && safeElo <= a.maxElo)
  return found || ARENAS[0]
}

/**
 * En Plant Arena los jugadores PUEDEN descender de arena si pierden copas.
 * El único piso absoluto del sistema es 0 copas (no hay ratings negativos).
 */
export function getTrophyGateForElo(_elo?: number): number {
  return 0
}

export function getEloDeltasForElo(elo: number): { winElo: number; loseElo: number; surrenderElo: number } {
  if (elo <= 1600) {
    return { winElo: 15, loseElo: 5, surrenderElo: 5 }
  } else if (elo <= 3000) {
    return { winElo: 18, loseElo: 8, surrenderElo: 8 }
  } else if (elo <= 5000) {
    return { winElo: 15, loseElo: 12, surrenderElo: 12 }
  } else if (elo <= 8000) {
    return { winElo: 25, loseElo: 20, surrenderElo: 20 }
  } else {
    return { winElo: 30, loseElo: 30, surrenderElo: 30 }
  }
}
