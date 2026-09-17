import { describe, it, expect } from 'vitest'
import { createBattleState, stepTick, crearPlantaPropia, crearPlantaDelRival } from './simulate'
import type { CartaDeMazo } from './mazoDeLaSala'
import { ejecutarCapturaPlantP1, confirmarAccionP1ConSesion } from './asyncP1Capture'
import { reconstruirPartidaAsync } from './asyncOpponent'

describe('Auditoría Bonk Choy vs Bonk Choy', () => {
  function simulateDuel(p1Belt: boolean, p2Level: number, p1SpawnTick = 0, p2SpawnTick = 0) {
    const state = createBattleState(12345, false, true)
    let p1Bonk: any = null
    let p2Bonk: any = null

    const logs: string[] = []

    for (let t = 0; t <= 1500; t++) {
      if (t === p1SpawnTick) {
        p1Bonk = crearPlantaPropia(state, 'bonkchoy', 1, undefined, [], 0, p1Belt ? 'champion_belt' : null)
        state.plants.push(p1Bonk)
        logs.push(`[Tick ${t}] P1 spawns Bonk Choy (HP: ${p1Bonk.hp}, DMG: ${p1Bonk.damage}, Belt: ${p1Belt}) at x=${p1Bonk.x}`)
      }
      if (t === p2SpawnTick) {
        p2Bonk = crearPlantaDelRival(state, 'bonkchoy', 1, undefined, [], p2Level, null)
        state.enemyPlants.push(p2Bonk)
        logs.push(`[Tick ${t}] P2 spawns Bonk Choy (HP: ${p2Bonk.hp}, DMG: ${p2Bonk.damage}, Level: ${p2Level}) at x=${p2Bonk.x}`)
      }

      const p1HpBefore = p1Bonk?.hp ?? 0
      const p2HpBefore = p2Bonk?.hp ?? 0

      stepTick(state, () => {})

      if (p1Bonk && p2Bonk) {
        if (p1Bonk.hp !== p1HpBefore || p2Bonk.hp !== p2HpBefore) {
          logs.push(`[Tick ${t}] P1 x=${p1Bonk.x.toFixed(2)} HP=${p1Bonk.hp}/${p1Bonk.maxHp} | P2 x=${p2Bonk.x.toFixed(2)} HP=${p2Bonk.hp}/${p2Bonk.maxHp} | dist=${(p2Bonk.x - p1Bonk.x).toFixed(2)}`)
        }
        if (p1Bonk.hp <= 0 || p2Bonk.hp <= 0) {
          logs.push(`[Tick ${t}] FIN DEL DUELO: P1 HP=${p1Bonk.hp}, P2 HP=${p2Bonk.hp}. Ganador: ${p1Bonk.hp > 0 ? 'P1' : p2Bonk.hp > 0 ? 'P2' : 'EMPATE'}`)
          break
        }
      }
    }

    return { winner: p1Bonk?.hp > 0 ? 'P1' : p2Bonk?.hp > 0 ? 'P2' : 'EMPATE', logs }
  }

  it('Caso 1: P1 con cinturón vs P2 Nivel 0 (ambos spawnean en tick 0)', () => {
    const res = simulateDuel(true, 0, 0, 0)
    console.log('--- CASO 1: P1 Belt vs P2 Lv0 ---')
    console.log(res.logs.slice(-10).join('\n'))
  })

  it('Caso 2: P1 SIN cinturón vs P2 Nivel 0 (ambos spawnean en tick 0)', () => {
    const res = simulateDuel(false, 0, 0, 0)
    console.log('--- CASO 2: P1 NO Belt vs P2 Lv0 ---')
    console.log(res.logs.slice(-10).join('\n'))
  })

  it('Caso 3: P1 con cinturón vs P2 Nivel 1', () => {
    const res = simulateDuel(true, 1, 0, 0)
    console.log('--- CASO 3: P1 Belt vs P2 Lv1 ---')
    console.log(res.logs.slice(-10).join('\n'))
  })

  it('Caso 4: P1 con cinturón vs P2 Nivel 2', () => {
    const res = simulateDuel(true, 2, 0, 0)
    console.log('--- CASO 4: P1 Belt vs P2 Lv2 ---')
    console.log(res.logs.slice(-10).join('\n'))
  })

  it('Caso 5: P1 spawnea después (en tick 100) vs P2 tick 0', () => {
    const res = simulateDuel(true, 0, 100, 0)
    console.log('--- CASO 5: P1 Belt (tick 100) vs P2 Lv0 (tick 0) ---')
    console.log(res.logs.slice(-10).join('\n'))
  })

  it('Caso 6: P1 con cinturón vs P2 Bonk Choy + Wallnut defensivo de P2', () => {
    const state = createBattleState(12345, false, true)
    // P2 tiene un Wallnut estático en columna 5 (x ~ 50)
    // Wallnut en col 5 (para P2 espejada es col 6)
    const wallnut = crearPlantaDelRival(state, 'wallnut', 1, 4, [], 0, null)
    state.enemyPlants.push(wallnut)

    const p1Bonk = crearPlantaPropia(state, 'bonkchoy', 1, undefined, [], 0, 'champion_belt')
    state.plants.push(p1Bonk)

    // P2 spawnea Bonk Choy un poco después
    const p2Bonk = crearPlantaDelRival(state, 'bonkchoy', 1, undefined, [], 0, null)
    state.enemyPlants.push(p2Bonk)

    const logs: string[] = []
    for (let t = 0; t <= 600; t++) {
      const p1HpBefore = p1Bonk.hp
      const p2HpBefore = p2Bonk.hp
      const wallnutHpBefore = wallnut.hp

      stepTick(state, () => {})

      if (p1Bonk.hp !== p1HpBefore || p2Bonk.hp !== p2HpBefore || wallnut.hp !== wallnutHpBefore) {
        logs.push(`[Tick ${t}] P1 x=${p1Bonk.x.toFixed(1)} HP=${p1Bonk.hp} | Wallnut HP=${wallnut.hp} | P2 Bonk x=${p2Bonk.x.toFixed(1)} HP=${p2Bonk.hp}`)
      }
      if (p1Bonk.hp <= 0 || (p2Bonk.hp <= 0 && wallnut.hp <= 0)) {
        logs.push(`[Tick ${t}] FIN: P1 HP=${p1Bonk.hp}, P2 Bonk HP=${p2Bonk.hp}, Wallnut HP=${wallnut.hp}`)
        break
      }
    }
    console.log('--- CASO 6: P1 Belt vs P2 Bonk Choy + Wallnut ---')
    console.log(logs.slice(-15).join('\n'))
  })

  it('Caso 7: P1 con cinturón vs P2 Bonk Choy + Peashooter de apoyo', () => {
    const state = createBattleState(12345, false, true)
    // P2 tiene Peashooter atrás en col 0 (x ~ 80)
    const peashooter = crearPlantaDelRival(state, 'peashooter', 1, 0, [], 0, null)
    state.enemyPlants.push(peashooter)

    const p1Bonk = crearPlantaPropia(state, 'bonkchoy', 1, undefined, [], 0, 'champion_belt')
    state.plants.push(p1Bonk)

    const p2Bonk = crearPlantaDelRival(state, 'bonkchoy', 1, undefined, [], 0, null)
    state.enemyPlants.push(p2Bonk)

    const logs: string[] = []
    for (let t = 0; t <= 600; t++) {
      const p1HpBefore = p1Bonk.hp
      const p2HpBefore = p2Bonk.hp

      stepTick(state, () => {})

      if (p1Bonk.hp !== p1HpBefore || p2Bonk.hp !== p2HpBefore) {
        logs.push(`[Tick ${t}] P1 x=${p1Bonk.x.toFixed(1)} HP=${p1Bonk.hp} | P2 Bonk x=${p2Bonk.x.toFixed(1)} HP=${p2Bonk.hp}`)
      }
      if (p1Bonk.hp <= 0 || p2Bonk.hp <= 0) {
        logs.push(`[Tick ${t}] FIN: P1 HP=${p1Bonk.hp}, P2 Bonk HP=${p2Bonk.hp}`)
        break
      }
    }
    console.log('--- CASO 7: P1 Belt vs P2 Bonk Choy + Peashooter ---')
    console.log(logs.slice(-10).join('\n'))
  })

  it('Caso 8: Captura de acción P1 y reconstruirPartidaAsync deben conservar champion_belt', () => {
    const seed = 42
    const p1Deck: CartaDeMazo[] = [
      { slot: 0, plantId: 'bonkchoy', level: 0, statRolls: [], equippedItem: 'champion_belt' }
    ]
    const p2Deck: CartaDeMazo[] = [
      { slot: 0, plantId: 'sunflower', level: 0, statRolls: [] }
    ]

    // Determinar tics en los que caen soles del cielo para tener 150 soles (6 * 25)
    const baseSim = createBattleState(seed, false, true)
    const spawnedSuns: { tick: number; id: string }[] = []
    while (baseSim.tick < 1500 && spawnedSuns.length < 6) {
      stepTick(baseSim, () => {})
      for (const s of baseSim.suns) {
        if (!spawnedSuns.some((x) => x.id === s.id)) {
          spawnedSuns.push({ tick: baseSim.tick, id: s.id })
        }
      }
    }

    const state = createBattleState(seed, false, true)
    state.sunBank = 150

    const pendingActions: any[] = []
    let acceptedActions: any[] = []

    // Recolectar 6 soles
    let seq = 1
    for (const sun of spawnedSuns) {
      acceptedActions.push({
        seq: seq++,
        tick: sun.tick,
        issuedTick: sun.tick,
        kind: 'collect',
        targetId: sun.id,
      })
    }

    const plantTick = (spawnedSuns[5]?.tick ?? 1000) + 10
    state.tick = plantTick

    // 1. P1 planta Bonk Choy con cinturón
    const captureRes = ejecutarCapturaPlantP1({
      isAsyncMatch: true,
      card: 'bonkchoy',
      slotIdx: 0,
      lane: 1,
      col: 0,
      rolls: [],
      cardLevel: 0,
      equippedItem: 'champion_belt',
      state,
      seq: seq++,
      enTic: plantTick + 6,
      pending: pendingActions,
    })

    console.log('captureRes:', captureRes)
    expect(captureRes.ok).toBe(true)
    expect(pendingActions[0]?.equippedItem).toBe('champion_belt')

    // 2. Servidor confirma ACK
    const confirmRes = confirmarAccionP1ConSesion({
      currentGeneration: 1,
      seq: captureRes.seq,
      pending: pendingActions,
      accepted: acceptedActions,
    })

    expect(confirmRes.ok).toBe(true)
    if (confirmRes.ok) {
      acceptedActions = confirmRes.accepted
    }

    const lastAction = acceptedActions[acceptedActions.length - 1]
    expect(lastAction?.equippedItem).toBe('champion_belt')

    // 3. Reconstruir partida async hasta después de que la planta brote (plantTick + 15)
    const recon = reconstruirPartidaAsync(
      seed,
      p1Deck,
      p2Deck,
      [],
      acceptedActions,
      plantTick + 30
    )

    console.log('recon result:', recon)
    expect(recon.ok).toBe(true)
    const bonkRecon = recon.estado?.plants.find((p) => p.plantId === 'bonkchoy')
    console.log('Bonk in recon:', bonkRecon ? { hp: bonkRecon.hp, maxHp: bonkRecon.maxHp, damage: bonkRecon.damage, equippedItem: bonkRecon.equippedItem } : 'NOT FOUND')
    expect(bonkRecon).toBeDefined()
    expect(bonkRecon?.equippedItem).toBe('champion_belt')
    expect(bonkRecon?.maxHp).toBe(750)
  })
})


