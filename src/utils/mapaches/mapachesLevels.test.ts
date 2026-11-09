import { describe, it, expect, beforeEach } from 'vitest'
import {
  getStoryLevelConfig,
  getStoryProgress,
  saveStoryProgress,
} from './mapachesLevels'
import { getRawMapacheTemplates } from './mapachesData'

// Mock de localStorage para entorno node en vitest
const storageMap: Record<string, string> = {}
if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => storageMap[key] ?? null,
    setItem: (key: string, val: string) => {
      storageMap[key] = String(val)
    },
    removeItem: (key: string) => {
      delete storageMap[key]
    },
    clear: () => {
      Object.keys(storageMap).forEach((k) => delete storageMap[k])
    },
  }
}

describe('Modo Historia - Invasión Mapache: 20 Niveles y 3 Oleadas', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('Catálogo de 5 personajes definido correctamente', () => {
    const chars = getRawMapacheTemplates()
    expect(Object.keys(chars)).toHaveLength(5)
    expect(chars.pumpum.name).toBe('PumPum')
    expect(chars.garritas.name).toBe('Garritas')
    expect(chars.punos.name).toBe('Puños')
    expect(chars.navajas.name).toBe('Navajas')
    expect(chars.reygarra.name).toBe('Rey Garra')
    expect(chars.reygarra.boss).toBe(true)
  })

  it('Niveles 1 al 5: Solo salen Mapache 1 (PumPum) y 2 (Garritas), y Rey Garra en la 3era oleada', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const cfg = getStoryLevelConfig(lvl)
      expect(cfg.allowedMapaches).toEqual(['pumpum', 'garritas'])
      expect(cfg.waves).toHaveLength(3)

      // Oleada 1 y 2 solo tienen pumpum y garritas
      const w1Keys = cfg.waves[0].spawns.map((s) => s.key)
      expect(w1Keys.every((k) => k === 'pumpum' || k === 'garritas')).toBe(true)

      const w2Keys = cfg.waves[1].spawns.map((s) => s.key)
      expect(w2Keys.every((k) => k === 'pumpum' || k === 'garritas')).toBe(true)

      // Oleada 3 contiene al Jefe Final Rey Garra
      expect(cfg.waves[2].hasBoss).toBe(true)
      const w3Keys = cfg.waves[2].spawns.map((s) => s.key)
      expect(w3Keys).toContain('reygarra')
      expect(w3Keys.filter((k) => k !== 'reygarra').every((k) => k === 'pumpum' || k === 'garritas')).toBe(true)
    }
  })

  it('Niveles 6 al 10: Salen Mapaches 2 (Garritas), 3 (Puños) y 4 (Navajas), y Rey Garra en la 3era oleada', () => {
    for (let lvl = 6; lvl <= 10; lvl++) {
      const cfg = getStoryLevelConfig(lvl)
      expect(cfg.allowedMapaches).toEqual(['garritas', 'punos', 'navajas'])
      expect(cfg.waves).toHaveLength(3)

      // Oleada 1 y 2 solo tienen garritas, punos, navajas
      const w1Keys = cfg.waves[0].spawns.map((s) => s.key)
      expect(w1Keys.every((k) => ['garritas', 'punos', 'navajas'].includes(k))).toBe(true)

      const w2Keys = cfg.waves[1].spawns.map((s) => s.key)
      expect(w2Keys.every((k) => ['garritas', 'punos', 'navajas'].includes(k))).toBe(true)

      // Oleada 3 contiene al Jefe Final Rey Garra
      expect(cfg.waves[2].hasBoss).toBe(true)
      const w3Keys = cfg.waves[2].spawns.map((s) => s.key)
      expect(w3Keys).toContain('reygarra')
      expect(
        w3Keys
          .filter((k) => k !== 'reygarra')
          .every((k) => ['garritas', 'punos', 'navajas'].includes(k))
      ).toBe(true)
    }
  })

  it('Niveles 11 al 20: Salen TODOS los mapaches (1, 2, 3, 4 + Rey Garra en la 3era oleada) con dificultad escalada', () => {
    for (let lvl = 11; lvl <= 20; lvl++) {
      const cfg = getStoryLevelConfig(lvl)
      expect(cfg.allowedMapaches).toEqual(['pumpum', 'garritas', 'punos', 'navajas'])
      expect(cfg.waves).toHaveLength(3)

      // Escalado de dificultad
      expect(cfg.hpMultiplier).toBeGreaterThan(1.5)
      expect(cfg.bossMaxHp).toBeGreaterThan(150)

      // Oleada 3 contiene al Jefe Final Rey Garra
      expect(cfg.waves[2].hasBoss).toBe(true)
      expect(cfg.waves[2].spawns.map((s) => s.key)).toContain('reygarra')
    }
  })

  it('Gestión de Progreso en LocalStorage: desbloqueo y estrellas', () => {
    let p = getStoryProgress()
    expect(p.maxUnlockedLevel).toBe(1)
    expect(p.completedLevels).toHaveLength(0)

    // Guardar nivel 1 superado con 3 estrellas
    p = saveStoryProgress(1, 3)
    expect(p.maxUnlockedLevel).toBe(2)
    expect(p.completedLevels).toContain(1)
    expect(p.levelStars[1]).toBe(3)

    // Guardar nivel 2 superado
    p = saveStoryProgress(2, 2)
    expect(p.maxUnlockedLevel).toBe(3)
    expect(p.completedLevels).toEqual([1, 2])
    expect(p.levelStars[2]).toBe(2)
  })
})
