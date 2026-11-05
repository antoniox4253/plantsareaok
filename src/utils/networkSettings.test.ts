import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  getNetworkQuality,
  isLowSignalMode,
  applyNetworkQuality,
  toggleNetworkQuality,
  subscribeNetworkQuality,
  getMaxInFlightActions,
  getAsyncPollInterval,
  getPvpRecoveryInterval,
} from './networkSettings'

describe('Network Resilience & Low Signal Mode (Cuba, Venezuela & Mobile Networks)', () => {
  beforeEach(() => {
    applyNetworkQuality('standard')
  })

  it('1. Default and toggle functionality', () => {
    expect(getNetworkQuality()).toBe('standard')
    expect(isLowSignalMode()).toBe(false)

    const next = toggleNetworkQuality()
    expect(next).toBe('low_signal')
    expect(getNetworkQuality()).toBe('low_signal')
    expect(isLowSignalMode()).toBe(true)

    const back = toggleNetworkQuality()
    expect(back).toBe('standard')
    expect(isLowSignalMode()).toBe(false)
  })

  it('2. Reactive listeners trigger upon quality change', () => {
    let notified: string | null = null
    const unsubscribe = subscribeNetworkQuality((q) => {
      notified = q
    })

    applyNetworkQuality('low_signal')
    expect(notified).toBe('low_signal')

    applyNetworkQuality('standard')
    expect(notified).toBe('standard')

    unsubscribe()
  })

  it('3. Dynamic tolerances and intervals adapt to network mode', () => {
    // Standard mode
    applyNetworkQuality('standard')
    expect(getMaxInFlightActions()).toBe(6) // Greater than old 3 to prevent input lock
    expect(getAsyncPollInterval()).toBe(450)
    expect(getPvpRecoveryInterval()).toBe(3000)

    // Low Signal mode (optimizado para Cuba, Venezuela, alta latencia)
    applyNetworkQuality('low_signal')
    expect(getMaxInFlightActions()).toBe(8) // More buffer for actions in flight
    expect(getAsyncPollInterval()).toBe(1100) // 60% reduction in HTTP polling congestion
    expect(getPvpRecoveryInterval()).toBe(4500)
  })

  it('4. Migration 390 increases disconnection and single-report timeout thresholds', () => {
    const rootDir = process.cwd()
    const migPath = path.join(rootDir, 'supabase', 'migrations', '390-high-latency-disconnect-tolerance.sql')
    expect(fs.existsSync(migPath)).toBe(true)

    const sql = fs.readFileSync(migPath, 'utf8')
    // Inactivity margin increased to 45s (was 20s)
    expect(sql).toContain("INTERVAL '45 seconds'")
    // Single-report timeouts increased (was 8s and 15s)
    expect(sql).toContain("INTERVAL '20 seconds'")
    expect(sql).toContain("INTERVAL '35 seconds'")
  })

  it('5. Battlefield.tsx integrates clock sync retries and dynamic network intervals', () => {
    const rootDir = process.cwd()
    const bfPath = path.join(rootDir, 'src', 'components', 'Battlefield', 'Battlefield.tsx')
    const bf = fs.readFileSync(bfPath, 'utf8')

    expect(bf).toContain('getMaxInFlightActions')
    expect(bf).toContain('getAsyncPollInterval')
    expect(bf).toContain('getPvpRecoveryInterval')
    expect(bf).toContain('trySync')
    expect(bf).toContain('Reintentando sincronizar partida')
  })

  it('6. useMatchmaking.ts gracefully tolerates transient network errors during polling', () => {
    const rootDir = process.cwd()
    const mmPath = path.join(rootDir, 'src', 'hooks', 'useMatchmaking.ts')
    const mm = fs.readFileSync(mmPath, 'utf8')

    expect(mm).toContain('transientErrorCountRef')
    expect(mm).toContain('isTransient')
  })

  it('7. MainMenu.tsx settings dropdown includes the Low Signal toggle option', () => {
    const rootDir = process.cwd()
    const mmPath = path.join(rootDir, 'src', 'components', 'MainMenu', 'MainMenu.tsx')
    const mm = fs.readFileSync(mmPath, 'utf8')

    expect(mm).toContain('useNetworkQuality')
    expect(mm).toContain('Red: Baja Señal / Ahorro')
  })
})
