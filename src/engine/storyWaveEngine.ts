import type { PlantEntity, PlantId } from '../types/game.ts'
import { entityId, createRng, nextFloat } from './rng.ts'
import type { GameState, SonarFn } from './simulate.ts'
import { msToTicks } from './time.ts'

export type MapacheKey = 'pumpum' | 'garritas' | 'punos' | 'navajas' | 'reygarra'

export interface StoryEnemySpawn {
  tick: number
  lane: number
  mapacheKey: MapacheKey
  moveSpeed?: number
  hpMultiplier?: number
  damageMultiplier?: number
  isBoss?: boolean
}

export interface StoryWave {
  waveNumber: 1 | 2 | 3
  name: string
  subtitle: string
  startTick: number
  spawns: StoryEnemySpawn[]
}

export interface StoryLevelConfig {
  level: number
  totalWaves: 3
  waves: [StoryWave, StoryWave, StoryWave]
  allowedMapaches: MapacheKey[]
  rewards: {
    gold: number
    gems: number
    tokens: number
  }
}

/**
 * Mapeo de fallback para compatibilidad con el motor base.
 */
export function mapacheToPlantId(key: MapacheKey): PlantId {
  switch (key) {
    case 'pumpum':
      return 'peashooter'
    case 'garritas':
      return 'bonkchoy'
    case 'punos':
      return 'bonkchoy'
    case 'navajas':
      return 'repeater'
    case 'reygarra':
      return 'bonkchoy'
  }
}

/**
 * Conjunto de mapaches permitidos por nivel según las reglas estrictas del usuario:
 * - Niveles 1 al 5: Solo Mapache 1 (PumPum) y 2 (Garritas).
 * - Niveles 6 al 10: Mapaches 2 (Garritas), 3 (Puños) y 4 (Navajas).
 * - Niveles 11 al 20: Todos los mapaches (PumPum, Garritas, Puños, Navajas) en dificultades progresivas.
 */
export function getAllowedMapachesForLevel(level: number): MapacheKey[] {
  if (level <= 5) {
    return ['pumpum', 'garritas']
  }
  if (level <= 10) {
    return ['garritas', 'punos', 'navajas']
  }
  return ['pumpum', 'garritas', 'punos', 'navajas']
}

export function getMapacheBaseHp(key: MapacheKey): number {
  switch (key) {
    case 'pumpum':
      return 260 // Artillero frágil a distancia (~9 guisantes)
    case 'garritas':
      return 200 // Rasguñador veloz común (~10 guisantes)
    case 'punos':
      return 380 // Peleador fornido (~19 guisantes, estilo cono)
    case 'navajas':
      return 280 // Lanzador ágil (~11 guisantes)
    case 'reygarra':
      return 950 // Jefe de oleada 3 (resistente y derrotable)
  }
}

export function getMapacheBaseDamage(key: MapacheKey): number {
  switch (key) {
    case 'pumpum':
      return 35
    case 'garritas':
      return 25
    case 'punos':
      return 40
    case 'navajas':
      return 30
    case 'reygarra':
      return 60
  }
}

export function getMapacheBaseSpeed(key: MapacheKey): number {
  switch (key) {
    case 'pumpum':
      return 2.0 // %/seg (~2.5s por casilla)
    case 'garritas':
      return 3.4 // %/seg (~1.5s por casilla, ágil pero balanceado estilo PvZ)
    case 'punos':
      return 2.3 // %/seg (~2.2s por casilla, tanque firme)
    case 'navajas':
      return 2.9 // %/seg (~1.7s por casilla)
    case 'reygarra':
      return 1.8 // %/seg (~2.8s por casilla, paso imponente de jefe)
  }
}

/**
 * Genera la configuración de las 3 oleadas de un nivel en Modo Historia:
 * - Determinista mediante semilla RNG
 * - 3 oleadas por nivel
 * - El Jefe Final (Rey Garra) SIEMPRE sale en la 3era oleada
 */
export function generateStoryLevel(level: number, seed: number = 1000 + level): StoryLevelConfig {
  const lanesCount = 3
  const rng = createRng(seed ^ (level * 7919))
  const nextRng = () => nextFloat(rng)

  const allowedMapaches = getAllowedMapachesForLevel(level)
  const hpMult = 1.0 + (level - 1) * 0.12
  const dmgMult = 1.0 + (level - 1) * 0.08

  const pickEnemy = (): MapacheKey => {
    const idx = Math.floor(nextRng() * allowedMapaches.length)
    return allowedMapaches[idx] || allowedMapaches[0]
  }

  // ── OLEADA 1: INCURSIÓN INICIAL (28s en Nivel 1, -1s cada 3 niveles) ──
  const w1StartSec = Math.max(20, 28 - Math.floor((level - 1) / 3))
  const w1StartTick = msToTicks(w1StartSec * 1000)
  const w1Count = Math.min(8, 3 + Math.floor(level / 3))
  const wave1Spawns: StoryEnemySpawn[] = []
  let w1Tick = w1StartTick

  for (let i = 0; i < w1Count; i++) {
    const mapacheKey = pickEnemy()
    const lane = (i * 2 + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave1Spawns.push({
      tick: w1Tick,
      lane,
      mapacheKey,
      moveSpeed: getMapacheBaseSpeed(mapacheKey),
      hpMultiplier: hpMult,
      damageMultiplier: dmgMult,
    })
    const delay = Math.max(85, 165 - level * 4 + Math.floor(nextRng() * 45))
    w1Tick += delay
  }

  const wave1: StoryWave = {
    waveNumber: 1,
    name: 'Oleada 1 (Incursión)',
    subtitle: 'Repele la primera oleada mapache',
    startTick: w1StartTick,
    spawns: wave1Spawns,
  }

  // ── OLEADA 2: EMBOSCADA Y PRESIÓN (estilo 1ra bandera PvZ) ────────────────
  const w2Count = Math.min(14, 5 + Math.floor(level / 2))
  const wave2Spawns: StoryEnemySpawn[] = []
  const w2StartTick = Math.max(w1Tick + msToTicks(6000), w1StartTick + msToTicks(28000))
  let w2Tick = w2StartTick

  for (let i = 0; i < w2Count; i++) {
    const mapacheKey = pickEnemy()
    const lane = (i * 2 + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave2Spawns.push({
      tick: w2Tick,
      lane,
      mapacheKey,
      moveSpeed: getMapacheBaseSpeed(mapacheKey),
      hpMultiplier: hpMult,
      damageMultiplier: dmgMult,
    })

    // Ataque coordinado en niveles >= 8 cada 3 mapaches
    if (level >= 8 && i > 0 && i % 3 === 0) {
      const secondLane = (lane + 1 + Math.floor(nextRng() * (lanesCount - 1))) % lanesCount
      const secondMapache = pickEnemy()
      wave2Spawns.push({
        tick: w2Tick,
        lane: secondLane,
        mapacheKey: secondMapache,
        moveSpeed: getMapacheBaseSpeed(secondMapache),
        hpMultiplier: hpMult,
        damageMultiplier: dmgMult,
      })
    }

    const delay = Math.max(65, 120 - level * 2 + Math.floor(nextRng() * 35))
    w2Tick += delay
  }

  const wave2: StoryWave = {
    waveNumber: 2,
    name: 'Oleada 2 (Emboscada)',
    subtitle: 'Asalto de refuerzos en los 3 carriles',
    startTick: w2StartTick,
    spawns: wave2Spawns,
  }

  // ── OLEADA 3: OLEADA FINAL CON EL JEFE REY GARRA ───────────────────────────
  const w3Count = Math.min(16, 6 + Math.floor(level / 2))
  const wave3Spawns: StoryEnemySpawn[] = []
  const w3StartTick = Math.max(w2Tick + msToTicks(7000), w2StartTick + msToTicks(32000))
  let w3Tick = w3StartTick

  // Escolta previa al jefe
  for (let i = 0; i < w3Count; i++) {
    const mapacheKey = pickEnemy()
    const lane = (i + Math.floor(nextRng() * lanesCount)) % lanesCount
    wave3Spawns.push({
      tick: w3Tick,
      lane,
      mapacheKey,
      moveSpeed: getMapacheBaseSpeed(mapacheKey),
      hpMultiplier: hpMult * 1.1,
      damageMultiplier: dmgMult * 1.05,
    })
    const delay = Math.max(50, 90 - level * 2 + Math.floor(nextRng() * 25))
    w3Tick += delay
  }

  // EL JEFE FINAL REY GARRA APARECE EN LA OLEADA 3 EN EL CARRIL CENTRAL (LANE 1)
  const bossHpMultiplier = hpMult * (1.2 + level * 0.08)
  const bossDamageMultiplier = dmgMult * 1.2
  const bossLane = 1 // Carril central en un tablero de 3 líneas (0, 1, 2)
  wave3Spawns.push({
    tick: w3Tick + 30,
    lane: bossLane,
    mapacheKey: 'reygarra',
    moveSpeed: getMapacheBaseSpeed('reygarra'),
    hpMultiplier: bossHpMultiplier,
    damageMultiplier: bossDamageMultiplier,
    isBoss: true,
  })

  // Escolta pesada que acompaña al Rey Garra (carriles flanqueantes 0 y 2)
  const leftEscortKey: MapacheKey = allowedMapaches.includes('punos') ? 'punos' : 'garritas'
  const rightEscortKey: MapacheKey = allowedMapaches.includes('pumpum') ? 'pumpum' : 'garritas'
  wave3Spawns.push({
    tick: w3Tick + 45,
    lane: 0,
    mapacheKey: leftEscortKey,
    moveSpeed: getMapacheBaseSpeed(leftEscortKey),
    hpMultiplier: hpMult,
    damageMultiplier: dmgMult,
  })
  wave3Spawns.push({
    tick: w3Tick + 45,
    lane: 2,
    mapacheKey: rightEscortKey,
    moveSpeed: getMapacheBaseSpeed(rightEscortKey),
    hpMultiplier: hpMult,
    damageMultiplier: dmgMult,
  })

  const wave3: StoryWave = {
    waveNumber: 3,
    name: 'Oleada 3 (Jefe Final)',
    subtitle: '👑 ¡REY GARRA HA LLEGADO!',
    startTick: w3StartTick,
    spawns: wave3Spawns,
  }

  return {
    level,
    totalWaves: 3,
    waves: [wave1, wave2, wave3],
    allowedMapaches,
    rewards: {
      gold: 150 + level * 50,
      gems: 10 + Math.floor(level * 2.5),
      tokens: 0,
    },
  }
}

/**
 * Instancia una entidad enemiga mapache en el motor de combate.
 */
export function spawnStoryEnemyEntity(
  state: GameState,
  spawn: StoryEnemySpawn,
  level: number
): PlantEntity {
  const baseHp = getMapacheBaseHp(spawn.mapacheKey)
  const scaledHp = Math.round(baseHp * (spawn.hpMultiplier ?? 1))
  const baseDmg = getMapacheBaseDamage(spawn.mapacheKey)
  const scaledDmg = Math.round(baseDmg * (spawn.damageMultiplier ?? 1))
  const plantId = mapacheToPlantId(spawn.mapacheKey)

  const entity: PlantEntity = {
    id: entityId(`mapache-${spawn.mapacheKey}`, state.tick, state.entityCounter++),
    plantId,
    mapacheKey: spawn.mapacheKey,
    level,
    statRolls: [],
    lane: spawn.lane,
    x: 94,
    hp: scaledHp,
    maxHp: scaledHp,
    damage: scaledDmg,
    attackSpeedMs: spawn.mapacheKey === 'garritas' ? 800 : spawn.mapacheKey === 'punos' ? 1000 : 1200,
    moveSpeed: spawn.moveSpeed ?? getMapacheBaseSpeed(spawn.mapacheKey),
    isWalking: true,
    state: 'walking',
    lastActionTime: state.tick,
    isBoss: Boolean(spawn.isBoss),
  }

  return entity
}

/**
 * Procesa la lógica de oleadas del Modo Historia en cada tic:
 * - Genera apariciones programadas de mapaches
 * - Gestiona el paso de Oleada 1 -> Oleada 2 -> Oleada 3 (Jefe Rey Garra)
 * - Ejecuta las habilidades únicas de los 5 Mapaches
 * - Detecta victoria total al derrotar al Rey Garra y a todos los mapaches
 */
export function processStoryWaves(
  state: GameState,
  sonar: SonarFn
): void {
  if (!state.isStoryMode || !state.storyConfig) return

  // 1. Desencadenar apariciones programadas de la oleada activa
  if (state.storySpawnsQueue && state.storySpawnsQueue.length > 0) {
    const disparar: StoryEnemySpawn[] = []
    const pendientes: StoryEnemySpawn[] = []

    for (const spawn of state.storySpawnsQueue) {
      if (spawn.tick <= state.tick) {
        disparar.push(spawn)
      } else {
        pendientes.push(spawn)
      }
    }

    if (disparar.length > 0) {
      state.storySpawnsQueue = pendientes
      for (const sp of disparar) {
        const entity = spawnStoryEnemyEntity(state, sp, state.storyConfig.level)
        state.enemyPlants.push(entity)
        if (sp.isBoss) {
          sonar('level_select', 1.0)
        } else {
          sonar('plantation', 0.6)
        }
      }
    }
  }

  const currentWaveIdx = state.storyWaveIndex ?? 0
  const livingEnemies = state.enemyPlants.filter((p: PlantEntity) => p.hp > 0).length
  const spawnsLeftInCurrentWave = (state.storySpawnsQueue || []).length

  // 2. Transición de Oleadas:
  if (currentWaveIdx === 0) {
    if (spawnsLeftInCurrentWave === 0 && livingEnemies <= 2 && !(state as any).storyWave1ClearedBannerShown) {
      ;(state as any).storyWave1ClearedBannerShown = true
      state.waveBanner = '⚠️ ¡OLEADA 1 DESPEJADA! PREPÁRATE, SE ACERCA LA SIGUIENTE...'
      state.pending.push({ atTick: state.tick + 90, kind: 'clear_wave_banner' })
    }
    const wave2 = state.storyConfig.waves[1]
    const shouldStartWave2 = (spawnsLeftInCurrentWave === 0 && livingEnemies === 0) || state.tick >= wave2.startTick
    const wave1 = state.storyConfig.waves[0]
    if (shouldStartWave2 && state.tick >= (wave1.startTick + msToTicks(12000))) {
      state.storyWaveIndex = 1
      state.wave = 2
      state.waveBanner = '🦝 ¡OLEADA 2 (EMBOSCADA)! ¡RESISTE, YA FALTA POCO!'
      state.pending.push({ atTick: state.tick + 90, kind: 'clear_wave_banner' })
      sonar('pea_hit', 0.8)
      const offset = Math.max(0, state.tick - wave2.startTick)
      state.storySpawnsQueue = wave2.spawns.map((s: StoryEnemySpawn) => ({
        ...s,
        tick: Math.max(state.tick + 30, s.tick + offset),
      }))
    }
  } else if (currentWaveIdx === 1) {
    if (spawnsLeftInCurrentWave === 0 && livingEnemies <= 2 && !(state as any).storyWave2ClearedBannerShown) {
      ;(state as any).storyWave2ClearedBannerShown = true
      state.waveBanner = '⚠️ ¡ÚLTIMO ESFUERZO! ¡YA FALTA POCO! ¡EL REY GARRA SE APROXIMA!'
      state.pending.push({ atTick: state.tick + 90, kind: 'clear_wave_banner' })
    }
    const wave3 = state.storyConfig.waves[2]
    const shouldStartWave3 = (spawnsLeftInCurrentWave === 0 && livingEnemies === 0) || state.tick >= wave3.startTick
    const wave2 = state.storyConfig.waves[1]
    if (shouldStartWave3 && state.tick >= (wave2.startTick + msToTicks(14000))) {
      state.storyWaveIndex = 2
      state.wave = 3
      state.waveBanner = '👑 ¡OLEADA 3: JEFE FINAL REY GARRA! ¡YA FALTA POCO PARA SALVAR EL JARDÍN!'
      state.pending.push({ atTick: state.tick + 120, kind: 'clear_wave_banner' })
      sonar('level_select', 1.0)
      const offset = Math.max(0, state.tick - wave3.startTick)
      state.storySpawnsQueue = wave3.spawns.map((s: StoryEnemySpawn) => ({
        ...s,
        tick: Math.max(state.tick + 45, s.tick + offset),
      }))
    }
  } else if (currentWaveIdx === 2) {
    if (spawnsLeftInCurrentWave === 0) {
      state.storyWavesCompleted = true
    }
  }

  // 3. Procesar Avance, Combate Melee/Rango y Habilidades de los 5 Mapaches:
  const dt = 0.033

  for (const enemy of state.enemyPlants) {
    if (enemy.hp <= 0 || !enemy.mapacheKey) continue

    // ALERTA DE JEFE HERIDO
    if (enemy.mapacheKey === 'reygarra' && enemy.isBoss && enemy.hp <= enemy.maxHp * 0.35 && !(state as any).storyBossCriticalBannerShown) {
      ;(state as any).storyBossCriticalBannerShown = true
      state.waveBanner = '🔥 ¡EL REY GARRA ESTÁ DEBILITADO! ¡YA FALTA MUY POCO!'
      state.pending.push({ atTick: state.tick + 90, kind: 'clear_wave_banner' })
    }

    // AURA / BUFF DEL REY GARRA (Ánimo de combate)
    if (enemy.isCommandoAura && enemy.commandoAuraEndTick && state.tick >= enemy.commandoAuraEndTick) {
      enemy.isCommandoAura = false
    }
    const isBuffed = Boolean(enemy.isCommandoAura)
    const effSpeed = (enemy.moveSpeed || 2.0) * (isBuffed ? 1.35 : 1.0)

    // =========================================================================
    // 👑 JEFE FINAL: REY GARRA
    // - Avanza hasta la retaguardia (x = 76).
    // - NO avanza más hacia la izquierda: patrulla verticalmente entre los 3 carriles (0, 1, 2).
    // - Ruge periódicamente para bufar a los mapaches.
    // - Alza el puño para invocar Garritas en otros carriles.
    // =========================================================================
    if (enemy.mapacheKey === 'reygarra' && enemy.isBoss) {
      if (enemy.x > 76) {
        // Entra caminando a su puesto de retaguardia
        enemy.x -= (enemy.moveSpeed || 1.8) * dt
        enemy.isWalking = true
        enemy.state = 'walking'
      } else {
        // Se queda en la retaguardia patrullando verticalmente entre los 3 carriles activos
        enemy.x = 76
        enemy.isWalking = false

        if (!enemy.nextLaneChangeTick) {
          enemy.nextLaneChangeTick = state.tick + msToTicks(3500)
        }

        // Cambio de carril arriba/abajo entre los 3 activos (0, 1, 2)
        if (state.tick >= enemy.nextLaneChangeTick) {
          const otherLanes = [0, 1, 2].filter((l) => l !== enemy.lane)
          const newLane = otherLanes[Math.floor(nextFloat(state.rng) * otherLanes.length)]
          enemy.lane = newLane
          enemy.nextLaneChangeTick = state.tick + msToTicks(3200 + Math.floor(nextFloat(state.rng) * 2000))
        }

        // Rugido potenciador cada 10s (~300 tics)
        if (state.tick - (enemy.lastRoarTick || 0) >= msToTicks(10000)) {
          enemy.lastRoarTick = state.tick
          enemy.isCommandoAura = true
          enemy.commandoAuraEndTick = state.tick + msToTicks(1500)
          for (const ally of state.enemyPlants) {
            if (ally.hp > 0 && ally.mapacheKey) {
              ally.isCommandoAura = true
              ally.commandoAuraEndTick = state.tick + msToTicks(5000)
            }
          }
          sonar('level_select', 1.0)
        }

        // Invocación de Garritas cada 12s (~360 tics)
        if (state.tick - (enemy.lastSummonTick || 0) >= msToTicks(12000) && livingEnemies < 7) {
          enemy.lastSummonTick = state.tick
          const otherLanes = [0, 1, 2].filter((l) => l !== enemy.lane)
          const summonLane = otherLanes[Math.floor(nextFloat(state.rng) * otherLanes.length)]
          const minion = spawnStoryEnemyEntity(
            state,
            {
              tick: state.tick,
              lane: summonLane,
              mapacheKey: 'garritas',
              moveSpeed: getMapacheBaseSpeed('garritas'),
              hpMultiplier: 1.0,
              damageMultiplier: 1.0,
            },
            state.storyConfig.level
          )
          state.enemyPlants.push(minion)
          sonar('plantation', 0.8)
        }

        // Ataque cuerpo a cuerpo si una planta aliada llega a tocar al Rey
        const targetPlant = state.plants
          .filter((p) => p.lane === enemy.lane && p.hp > 0 && Math.abs(enemy.x - p.x) <= 6.5)
          .sort((a, b) => b.x - a.x)[0]

        if (targetPlant) {
          enemy.state = 'attacking'
          if (state.tick - (enemy.lastAttackTick || 0) >= msToTicks(900)) {
            enemy.lastAttackTick = state.tick
            targetPlant.hp -= enemy.damage || 60
            sonar('pea_hit', 0.7)
            if (targetPlant.hp <= 0) {
              targetPlant.hp = 0
              sonar('zombie_fall', 0.6)
            }
          }
        }
      }
      continue
    }

    // =========================================================================
    // 🦝 TROPAS MAPACHES: AVANCE, DETECCIÓN Y COMBATE
    // =========================================================================
    const targetPlant = state.plants
      .filter((p) => p.lane === enemy.lane && p.hp > 0 && p.x < enemy.x)
      .sort((a, b) => b.x - a.x)[0]

    const targetX = targetPlant ? targetPlant.x : 15
    const distToTarget = enemy.x - targetX

    // 💣 PUMPUM (Artillero de Rango: se planta a distancia y dispara balas de cañón)
    if (enemy.mapacheKey === 'pumpum') {
      const stopDist = 26
      const rangeDist = 38
      if (distToTarget > stopDist) {
        enemy.x -= effSpeed * dt
        enemy.isWalking = true
        enemy.state = 'walking'
      } else {
        enemy.isWalking = false
        enemy.state = 'idle'
      }

      if (distToTarget <= rangeDist) {
        const cadencia = isBuffed ? 1800 : 2600
        if (state.tick - (enemy.lastShootTick || 0) >= msToTicks(cadencia)) {
          enemy.lastShootTick = state.tick
          enemy.state = 'attacking'
          state.projectiles.push({
            id: entityId('cannonball', state.tick, state.entityCounter++),
            type: 'cannonball',
            targetTeam: 'p1',
            lane: enemy.lane,
            originLane: enemy.lane,
            originX: enemy.x,
            targetX,
            x: enemy.x,
            y: 20 + enemy.lane * 19.33 + 7,
            speed: 24,
            damage: enemy.damage || 35,
            isSplash: true,
          })
          sonar('pea_shoot', 0.8)
        }
      }
    }

    // 🗡️ NAVAJAS (Lanzador de Cuchillos de Rango: se planta a distancia y arroja navajas)
    else if (enemy.mapacheKey === 'navajas') {
      const stopDist = 28
      const rangeDist = 42
      if (distToTarget > stopDist) {
        enemy.x -= effSpeed * dt
        enemy.isWalking = true
        enemy.state = 'walking'
      } else {
        enemy.isWalking = false
        enemy.state = 'idle'
      }

      if (distToTarget <= rangeDist) {
        const cadencia = isBuffed ? 1300 : 1900
        if (state.tick - (enemy.lastShootTick || 0) >= msToTicks(cadencia)) {
          enemy.lastShootTick = state.tick
          enemy.state = 'attacking'
          state.projectiles.push({
            id: entityId('knife', state.tick, state.entityCounter++),
            type: 'knife',
            targetTeam: 'p1',
            lane: enemy.lane,
            originLane: enemy.lane,
            originX: enemy.x,
            targetX,
            x: enemy.x,
            y: 20 + enemy.lane * 19.33 + 7,
            speed: 36,
            damage: enemy.damage || 30,
          })
          sonar('pea_shoot', 0.7)
        }
      }
    }

    // 🐾 GARRITAS (Melee Rápido: ataca plantas en contacto; al llegar al árbol le causa daño y desaparece)
    else if (enemy.mapacheKey === 'garritas') {
      // Salto acrobático parabólico fluido sobre defensas tipo Nuez
      if (enemy.isJumping) {
        const startT = enemy.jumpStartTick || state.tick
        const dur = enemy.jumpDurationTicks || msToTicks(1150)
        const elapsed = state.tick - startT
        const progress = Math.min(1, Math.max(0, elapsed / dur))
        // Interpolación ease-in-out suave para avance horizontal
        const easeX = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
        const startX = enemy.jumpStartX ?? enemy.x
        const endX = enemy.jumpTargetX ?? 16
        enemy.x = startX + (endX - startX) * easeX
        enemy.isWalking = false
        enemy.state = 'jumping'

        if (progress >= 1) {
          enemy.isJumping = false
          enemy.hasJumped = true
          enemy.x = endX
          enemy.state = 'walking'
          enemy.isWalking = true
        }
      } else if (targetPlant) {
        // Iniciar salto acrobático sobre defensas tipo Nuez si aún no ha saltado
        if (!enemy.hasJumped && (targetPlant.plantId === 'wallnut' || targetPlant.plantId === 'tallnut') && distToTarget <= 7.5) {
          enemy.isJumping = true
          enemy.jumpStartTick = state.tick
          enemy.jumpDurationTicks = msToTicks(1150)
          enemy.jumpStartX = enemy.x
          enemy.jumpTargetX = Math.max(16, targetPlant.x - 6.5)
          sonar('plantation', 0.8)
        } else {
          const meleeDist = 6.0
          if (distToTarget > meleeDist) {
            enemy.x -= effSpeed * dt
            enemy.isWalking = true
            enemy.state = 'walking'
          } else {
            enemy.isWalking = false
            enemy.state = 'attacking'
            const cadencia = isBuffed ? 450 : 650
            if (state.tick - (enemy.lastAttackTick || 0) >= msToTicks(cadencia)) {
              enemy.lastAttackTick = state.tick
              targetPlant.hp -= enemy.damage || 25
              sonar('pea_hit', 0.5)
              if (targetPlant.hp <= 0) {
                targetPlant.hp = 0
                sonar('zombie_fall', 0.5)
              }
            }
          }
        }
      } else {
        // Sin plantas enfrente: avanza hacia el árbol madre
        if (enemy.x > 16) {
          enemy.x -= effSpeed * dt
          enemy.isWalking = true
          enemy.state = 'walking'
        } else {
          // Impacto melee al árbol madre: inflige daño y desaparece inmediatamente
          state.p1BaseHp = Math.max(0, state.p1BaseHp - (enemy.damage || 25))
          enemy.hp = 0
          sonar('pea_hit', 0.8)
          sonar('zombie_fall', 0.8)
        }
      }
    }

    // 🥊 PUÑOS (Melee Pesado: golpea plantas cuerpo a cuerpo; al llegar al árbol inflige daño y desaparece)
    else if (enemy.mapacheKey === 'punos') {
      if (enemy.isFury && enemy.furyEndTick && state.tick >= enemy.furyEndTick) {
        enemy.isFury = false
      }

      if (targetPlant) {
        const meleeDist = 6.0
        if (distToTarget > meleeDist) {
          enemy.x -= effSpeed * dt
          enemy.isWalking = true
          enemy.state = 'walking'
        } else {
          enemy.isWalking = false
          enemy.state = 'attacking'
          const cadencia = enemy.isFury ? 320 : (isBuffed ? 480 : 700)
          if (state.tick - (enemy.lastAttackTick || 0) >= msToTicks(cadencia)) {
            enemy.lastAttackTick = state.tick
            enemy.hitCount = (enemy.hitCount || 0) + 1
            if (enemy.hitCount % 5 === 0 && !enemy.isFury) {
              enemy.isFury = true
              enemy.furyEndTick = state.tick + msToTicks(2200)
              sonar('level_select', 0.8)
            }
            const dmg = enemy.isFury ? Math.round((enemy.damage || 40) * 1.5) : (enemy.damage || 40)
            targetPlant.hp -= dmg
            sonar('pea_hit', 0.6)
            if (targetPlant.hp <= 0) {
              targetPlant.hp = 0
              sonar('zombie_fall', 0.5)
            }
          }
        }
      } else {
        // Sin plantas enfrente: avanza hacia el árbol madre
        if (enemy.x > 16) {
          enemy.x -= effSpeed * dt
          enemy.isWalking = true
          enemy.state = 'walking'
        } else {
          // Impacto melee al árbol madre: inflige daño y desaparece inmediatamente
          const dmg = enemy.isFury ? Math.round((enemy.damage || 40) * 1.5) : (enemy.damage || 40)
          state.p1BaseHp = Math.max(0, state.p1BaseHp - dmg)
          enemy.hp = 0
          sonar('pea_hit', 0.8)
          sonar('zombie_fall', 0.8)
        }
      }
    }

    // Impacto de respaldo en la Base del Árbol (x <= 16) para tropas que no sean el Rey Garra
    if (enemy.x <= 16 && enemy.hp > 0 && enemy.mapacheKey !== 'reygarra') {
      state.p1BaseHp = Math.max(0, state.p1BaseHp - (enemy.damage || 30))
      enemy.hp = 0
      sonar('zombie_fall', 0.8)
    }
  }

  // Verificación de Derrota en Story: Si el árbol madre del jugador cae a 0 HP
  if (state.p1BaseHp <= 0) {
    if (state.status === 'playing') {
      state.status = 'defeat'
    }
    return
  }

  // 4. Verificación de Victoria: Las 3 oleadas se completaron Y no quedan enemigos vivos (incluido el Rey Garra) Y el jugador sobrevivió
  if (state.storyWavesCompleted && livingEnemies === 0 && state.status === 'playing' && state.p1BaseHp > 0) {
    state.status = 'victory'
    sonar('victory', 1.0)
  }
}
