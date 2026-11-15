import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  SeasonManager,
  SEASON_3_START_UTC,
  SEASON_3_END_UTC,
  SEASON_4_START_UTC,
  SEASON_4_END_UTC,
} from '../utils/seasonManager'

describe('Temporada 3 - Finalización 20 de Diciembre 2026 UTC & Transición Festiva a Temporada 4', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      length: store.size,
    } as Storage
  })

  it('1. Constantes canónicas: Temporada 3 termina el 20 de Diciembre de 2026 23:59:59 UTC', () => {
    const expectedEnd = new Date('2026-12-20T23:59:59.000Z').getTime()
    expect(SEASON_3_END_UTC).toBe(expectedEnd)
    expect(new Date(SEASON_3_END_UTC).toISOString()).toBe('2026-12-20T23:59:59.000Z')
  })

  it('2. Constantes canónicas: Temporada 4 inicia oficialmente el 10 de Enero de 2027 00:00 UTC', () => {
    const expectedStart = new Date('2027-01-10T00:00:00.000Z').getTime()
    expect(SEASON_4_START_UTC).toBe(expectedStart)
    expect(new Date(SEASON_4_START_UTC).toISOString()).toBe('2027-01-10T00:00:00.000Z')
    expect(SEASON_4_END_UTC).toBeGreaterThan(SEASON_4_START_UTC)
  })

  it('3. Durante la Temporada 3 (ej. 15 de Noviembre de 2026), el temporizador cuenta hacia el 20 de Diciembre', () => {
    const nov15 = new Date('2026-11-15T12:00:00.000Z').getTime()
    const status = SeasonManager.getSeasonStatus(nov15)

    expect(status.seasonNumber).toBe(3)
    expect(status.isStarted).toBe(true)
    expect(status.isEnded).toBe(false)
    expect(status.isHolidayBreak).toBe(false)
    expect(status.daysLeft).toBe(35) // Del 15 de nov al 20 de dic
  })

  it('4. Durante el receso festivo (ej. 25 de Diciembre de 2026), activa mensaje de Navidad/Año Nuevo y cuenta regresiva a Temporada 4', () => {
    const navidad = new Date('2026-12-25T12:00:00.000Z').getTime()
    const status = SeasonManager.getSeasonStatus(navidad)

    expect(status.isHolidayBreak).toBe(true)
    expect(status.holidayMessage).toContain('Feliz Navidad y Próspero Año Nuevo')
    expect(status.holidayMessage).toContain('10 de enero de 2027')
    expect(status.daysLeft).toBe(15) // Del 25 de dic al 10 de ene (16 días - 12h = 15d)
    expect(status.seasonNumber).toBe(4)
  })

  it('5. La migración 437 y el script de liquidación automática están presentes y verificados', () => {
    const rootDir = process.cwd()
    const migrationPath = path.join(rootDir, 'supabase', 'migrations', '437-extend-season-3-dec-20-and-holiday-auto-settle.sql')
    expect(fs.existsSync(migrationPath)).toBe(true)

    const migrationSql = fs.readFileSync(migrationPath, 'utf8')
    expect(migrationSql).toContain('2026-12-20 23:59:59+00')
    expect(migrationSql).toContain('2027-01-10 00:00:00+00')
    expect(migrationSql).toContain('Feliz Navidad y Próspero Año Nuevo')
    expect(migrationSql).toContain('auto_settle_expired_season')

    const scriptPath = path.join(rootDir, 'scripts', 'auto_settle_season.mjs')
    expect(fs.existsSync(scriptPath)).toBe(true)
  })
})
