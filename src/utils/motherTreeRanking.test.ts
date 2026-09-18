import { describe, it, expect } from 'vitest'

interface CandidateProfile {
  user_id: string
  username: string
  tree_level: number
  tree_xp: number
  tree_level_5_at: string | null
  updated_at: string
}

function computeMotherTreeTop5(profiles: CandidateProfile[]) {
  const sorted = [...profiles]
    .filter((p) => p.tree_level > 0 || p.tree_xp > 0)
    .sort((a, b) => {
      const aLvl5 = a.tree_level >= 5
      const bLvl5 = b.tree_level >= 5

      // 1. Quienes llegaron a Nivel 5 van primero
      if (aLvl5 && !bLvl5) return -1
      if (!aLvl5 && bLvl5) return 1

      // Si ambos son nivel 5, se ordena por quién llegó primero en el tiempo
      if (aLvl5 && bLvl5) {
        const aTime = a.tree_level_5_at ? new Date(a.tree_level_5_at).getTime() : 0
        const bTime = b.tree_level_5_at ? new Date(b.tree_level_5_at).getTime() : 0
        if (aTime !== bTime) return aTime - bTime
      }

      // 2. Si están en carrera hacia nivel 5, por mayor nivel
      if (b.tree_level !== a.tree_level) {
        return b.tree_level - a.tree_level
      }

      // 3. Por mayor XP
      if (b.tree_xp !== a.tree_xp) {
        return b.tree_xp - a.tree_xp
      }

      // 4. Desempate por timestamp
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    })
    .slice(0, 5)

  return sorted.map((c, idx) => ({
    rank: idx + 1,
    user_id: c.user_id,
    username: c.username,
    tree_level: c.tree_level,
    tree_xp: c.tree_xp,
    tree_level_5_at: c.tree_level_5_at,
    reached_level_5: c.tree_level >= 5,
  }))
}

describe('Ranking Top 5 Árbol Madre - Carrera al Nivel 5', () => {
  it('ordena por nivel y xp cuando ningún jugador ha alcanzado nivel 5', () => {
    const mockProfiles: CandidateProfile[] = [
      { user_id: 'u1', username: 'Danifan', tree_level: 2, tree_xp: 900, tree_level_5_at: null, updated_at: '2026-09-18T10:00:00Z' },
      { user_id: 'u2', username: 'Dagger22', tree_level: 4, tree_xp: 4, tree_level_5_at: null, updated_at: '2026-09-18T10:00:00Z' },
      { user_id: 'u3', username: 'Navi', tree_level: 3, tree_xp: 420, tree_level_5_at: null, updated_at: '2026-09-18T10:00:00Z' },
      { user_id: 'u4', username: 'Jon Snow', tree_level: 2, tree_xp: 946, tree_level_5_at: null, updated_at: '2026-09-18T10:00:00Z' },
      { user_id: 'u5', username: 'Elvmarei', tree_level: 2, tree_xp: 623, tree_level_5_at: null, updated_at: '2026-09-18T10:00:00Z' },
      { user_id: 'u6', username: 'Merak', tree_level: 2, tree_xp: 164, tree_level_5_at: null, updated_at: '2026-09-18T10:00:00Z' },
    ]

    const top5 = computeMotherTreeTop5(mockProfiles)

    expect(top5).toHaveLength(5)
    expect(top5[0].username).toBe('Dagger22') // Nvl 4
    expect(top5[1].username).toBe('Navi')     // Nvl 3
    expect(top5[2].username).toBe('Jon Snow') // Nvl 2, 946 XP
    expect(top5[3].username).toBe('Danifan')  // Nvl 2, 900 XP
    expect(top5[4].username).toBe('Elvmarei') // Nvl 2, 623 XP
  })

  it('los primeros 5 en llegar a nivel 5 se ordenan por su timestamp de llegada', () => {
    const mockProfiles: CandidateProfile[] = [
      { user_id: 'u1', username: 'Primero', tree_level: 5, tree_xp: 0, tree_level_5_at: '2026-09-18T12:00:00Z', updated_at: '2026-09-18T12:00:00Z' },
      { user_id: 'u2', username: 'Segundo', tree_level: 5, tree_xp: 0, tree_level_5_at: '2026-09-18T12:15:00Z', updated_at: '2026-09-18T12:15:00Z' },
      { user_id: 'u3', username: 'CasiLlega', tree_level: 4, tree_xp: 999, tree_level_5_at: null, updated_at: '2026-09-18T12:20:00Z' },
    ]

    const top5 = computeMotherTreeTop5(mockProfiles)

    expect(top5[0].username).toBe('Primero')
    expect(top5[0].reached_level_5).toBe(true)
    expect(top5[1].username).toBe('Segundo')
    expect(top5[1].reached_level_5).toBe(true)
    expect(top5[2].username).toBe('CasiLlega')
    expect(top5[2].reached_level_5).toBe(false)
  })
})
