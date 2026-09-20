// Script to build perfectly timed bot combos with ZERO dropped intents
import { simulateBotPlan, PLANT_COSTS } from './simulate_bot_combos.mjs'
import { validarIntencionAsyncRankedEstricta } from '../src/engine/asyncP1History.ts'

const TICK_RATE = 30.303030303030305
function msToTicks(ms) {
  return Math.round((ms / 1000) * TICK_RATE)
}

const SOL_DEL_CIELO_MS = 6000
const P2_SKY_SUN_DELAY_TICKS = msToTicks(1500)
const SUN_VALUE = 25
const GIRASOL_MS = 24000
const primerSolP2Tick = -msToTicks(3500) + msToTicks(SOL_DEL_CIELO_MS) + P2_SKY_SUN_DELAY_TICKS
const girasolTicks = msToTicks(GIRASOL_MS)

const COOLDOWNS_MS = {
  sunflower: 7500,
  peashooter: 7500,
  wallnut: 30000,
  repeater: 7500,
  bonkchoy: 7500,
  squash: 30000,
  tallnut: 30000,
  threepeater: 7500,
  garlic: 7500,
  kernelpult: 7500,
  jalapeno: 35000,
}

function buildTimeline(sequence) {
  let sunBank = 0
  let sunflowers = []
  let slotCooldowns = {}
  let actions = []
  let curTick = 0

  for (let i = 0; i < sequence.length; i++) {
    const item = sequence[i]
    const cost = PLANT_COSTS[item.plantId]
    const cdTicks = msToTicks(COOLDOWNS_MS[item.plantId] || 7500)

    // Advance tick until sunBank >= cost AND slot cooldown is expired
    while (curTick <= 6000) {
      curTick++
      if (curTick >= primerSolP2Tick && (curTick - primerSolP2Tick) % msToTicks(SOL_DEL_CIELO_MS) === 0) {
        sunBank += SUN_VALUE
      }
      for (const sf of sunflowers) {
        if (curTick > sf.plantedAt && (curTick - sf.plantedAt) % girasolTicks === 0) {
          sunBank += SUN_VALUE
        }
      }

      const cdReady = (slotCooldowns[item.slot] || 0) <= curTick
      if (sunBank >= cost && cdReady) {
        break
      }
    }

    if (curTick > 6000) {
      console.error(`Item ${i} (${item.plantId}) failed at tick ${curTick}, sunBank: ${sunBank}, cost: ${cost}`)
      throw new Error(`Could not place item ${i} (${item.plantId}): exceeded tick 6000`)
    }
    console.log(`  Placed item ${i} (${item.plantId}) at tick ${curTick} (${(curTick / TICK_RATE).toFixed(1)}s), sun remaining: ${sunBank - cost}`)

    // Add 2-tick buffer for network safety, ensure issuedTick >= 0
    const issuedTick = Math.max(0, curTick + 2)
    const tick = issuedTick + 6

    actions.push({
      seq: i + 1,
      kind: 'plant',
      slot: item.slot,
      plantId: item.plantId,
      lane: item.lane,
      col: item.col,
      issuedTick,
      tick,
    })

    sunBank -= cost
    slotCooldowns[item.slot] = tick + cdTicks
    if (item.plantId === 'sunflower') {
      sunflowers.push({ plantedAt: tick })
    }
  }

  return actions
}

// ── DEFINICIÓN DE SECUENCIAS ESTRATÉGICAS DE LOS 5 COMBOS ──────────────────

// Combo 4: Sombra Pesado
// Deck: 0:sunflower, 1:repeater, 2:tallnut, 3:bonkchoy, 4:squash, 5:jalapeno
const seq4 = [
  { slot: 0, plantId: 'sunflower', lane: 1, col: 0 }, // 50 sun -> ~10s
  { slot: 0, plantId: 'sunflower', lane: 0, col: 0 }, // 50 sun -> ~22s
  { slot: 4, plantId: 'squash',    lane: 1, col: 4 }, // 50 sun -> ~34s
  { slot: 0, plantId: 'sunflower', lane: 2, col: 0 }, // 50 sun -> ~40s (3rd sunflower)
  { slot: 2, plantId: 'tallnut',   lane: 1, col: 3 }, // 125 sun -> ~58s
  { slot: 3, plantId: 'bonkchoy',  lane: 1, col: 4 }, // 175 sun -> ~82s
  { slot: 1, plantId: 'repeater',  lane: 1, col: 1 }, // 200 sun -> ~112s
  { slot: 2, plantId: 'tallnut',   lane: 0, col: 3 }, // 125 sun -> ~130s
  { slot: 1, plantId: 'repeater',  lane: 0, col: 1 }, // 200 sun -> ~154s
  { slot: 3, plantId: 'bonkchoy',  lane: 0, col: 4 }, // 175 sun -> ~178s
]

// Combo 3: Mantequilla + Ajo
// Deck: 0:sunflower, 1:kernelpult, 2:garlic, 3:wallnut, 4:repeater, 5:jalapeno
const seq3 = [
  { slot: 0, plantId: 'sunflower',  lane: 1, col: 0 }, // 50 sun -> ~10s
  { slot: 2, plantId: 'garlic',     lane: 0, col: 5 }, // 50 sun -> ~22s
  { slot: 2, plantId: 'garlic',     lane: 2, col: 5 }, // 50 sun -> ~34s
  { slot: 0, plantId: 'sunflower',  lane: 0, col: 0 }, // 50 sun -> ~40s
  { slot: 3, plantId: 'wallnut',    lane: 1, col: 5 }, // 50 sun -> ~46s
  { slot: 1, plantId: 'kernelpult', lane: 1, col: 1 }, // 100 sun -> ~60s
  { slot: 1, plantId: 'kernelpult', lane: 0, col: 1 }, // 100 sun -> ~74s
  { slot: 1, plantId: 'kernelpult', lane: 2, col: 1 }, // 100 sun -> ~88s
  { slot: 4, plantId: 'repeater',   lane: 1, col: 2 }, // 200 sun -> ~116s
  { slot: 3, plantId: 'wallnut',    lane: 1, col: 4 }, // 50 sun -> ~124s
  { slot: 4, plantId: 'repeater',   lane: 1, col: 3 }, // 200 sun -> ~152s
  { slot: 5, plantId: 'jalapeno',   lane: 1, col: 5 }, // 125 sun -> ~170s
]

// Combo 2: Embudo Mortal de Ajo
// Deck: 0:sunflower, 1:garlic, 2:bonkchoy, 3:wallnut, 4:repeater, 5:jalapeno
const seq2 = [
  { slot: 0, plantId: 'sunflower', lane: 1, col: 0 }, // 50 sun -> ~10s
  { slot: 1, plantId: 'garlic',    lane: 0, col: 5 }, // 50 sun -> ~22s
  { slot: 1, plantId: 'garlic',    lane: 2, col: 5 }, // 50 sun -> ~34s
  { slot: 0, plantId: 'sunflower', lane: 0, col: 0 }, // 50 sun -> ~40s
  { slot: 3, plantId: 'wallnut',   lane: 1, col: 5 }, // 50 sun -> ~46s
  { slot: 2, plantId: 'bonkchoy',  lane: 1, col: 4 }, // 175 sun -> ~72s
  { slot: 4, plantId: 'repeater',  lane: 1, col: 1 }, // 200 sun -> ~100s
  { slot: 2, plantId: 'bonkchoy',  lane: 1, col: 3 }, // 175 sun -> ~126s
  { slot: 4, plantId: 'repeater',  lane: 1, col: 2 }, // 200 sun -> ~154s
  { slot: 5, plantId: 'jalapeno',  lane: 1, col: 5 }, // 125 sun -> ~172s
]

// Combo 6: Tridente
// Deck: 0:sunflower, 1:threepeater, 2:tallnut, 3:squash, 4:repeater, 5:jalapeno
const seq6 = [
  { slot: 0, plantId: 'sunflower',   lane: 1, col: 0 }, // 50 sun -> ~10s
  { slot: 0, plantId: 'sunflower',   lane: 0, col: 0 }, // 50 sun -> ~22s
  { slot: 3, plantId: 'squash',      lane: 1, col: 4 }, // 50 sun -> ~34s
  { slot: 0, plantId: 'sunflower',   lane: 2, col: 0 }, // 50 sun -> ~40s
  { slot: 2, plantId: 'tallnut',     lane: 1, col: 3 }, // 125 sun -> ~58s
  { slot: 1, plantId: 'threepeater', lane: 1, col: 1 }, // 325 sun -> ~102s
  { slot: 2, plantId: 'tallnut',     lane: 0, col: 3 }, // 125 sun -> ~120s
  { slot: 2, plantId: 'tallnut',     lane: 2, col: 3 }, // 125 sun -> ~138s
  { slot: 4, plantId: 'repeater',    lane: 0, col: 1 }, // 200 sun -> ~166s
  { slot: 5, plantId: 'jalapeno',    lane: 2, col: 5 }, // 125 sun -> ~184s
]

// Combo 10: Rush Agresivo
// Deck: 0:sunflower, 1:bonkchoy, 2:squash, 3:peashooter, 4:wallnut, 5:jalapeno
const seq10 = [
  { slot: 0, plantId: 'sunflower',  lane: 1, col: 0 }, // 50 sun -> ~10s
  { slot: 4, plantId: 'wallnut',    lane: 1, col: 3 }, // 50 sun -> ~22s
  { slot: 3, plantId: 'peashooter', lane: 1, col: 1 }, // 100 sun -> ~40s
  { slot: 0, plantId: 'sunflower',  lane: 0, col: 0 }, // 50 sun -> ~52s
  { slot: 1, plantId: 'bonkchoy',   lane: 1, col: 2 }, // 175 sun -> ~82s
  { slot: 4, plantId: 'wallnut',    lane: 0, col: 3 }, // 50 sun -> ~88s
  { slot: 3, plantId: 'peashooter', lane: 0, col: 1 }, // 100 sun -> ~106s
  { slot: 1, plantId: 'bonkchoy',   lane: 0, col: 2 }, // 175 sun -> ~130s
  { slot: 4, plantId: 'wallnut',    lane: 2, col: 3 }, // 50 sun -> ~142s
  { slot: 2, plantId: 'squash',     lane: 1, col: 4 }, // 50 sun -> ~154s
  { slot: 5, plantId: 'jalapeno',   lane: 1, col: 5 }, // 125 sun -> ~178s
]

const combos = {
  combo4: { name: 'Combo 4: Sombra Pesado', seq: seq4 },
  combo3: { name: 'Combo 3: Mantequilla + Ajo', seq: seq3 },
  combo2: { name: 'Combo 2: Embudo Mortal de Ajo', seq: seq2 },
  combo6: { name: 'Combo 6: Tridente', seq: seq6 },
  combo10: { name: 'Combo 10: Rush Agresivo', seq: seq10 },
}

console.log('--- GENERANDO Y VERIFICANDO COMBOS CON 0 DROPS ---')
export const GENERATED_COMBOS = {}

for (const [key, c] of Object.entries(combos)) {
  const actions = buildTimeline(c.seq)
  const sim = simulateBotPlan(actions)
  console.log(`\n${c.name}:`)
  console.log(`  Total acciones: ${actions.length}`)
  console.log(`  Ejecutadas: ${sim.executed.length}`)
  console.log(`  Descartadas (DROPPED): ${sim.dropped.length}`)
  console.log(`  Soles finales en banco: ${sim.finalSun}`)

  // Validar con el validador autoritativo
  for (const a of actions) {
    const v = validarIntencionAsyncRankedEstricta(a)
    if (!v.ok) {
      console.error(`❌ Falló validador en seq ${a.seq}:`, v.reason, v.details)
    }
  }

  if (sim.dropped.length === 0) {
    console.log(`  ✅ 100% PERFECTO: ZERO INTENTS DROPPED!`)
    GENERATED_COMBOS[key] = actions
    console.log(`SQL_ACTIONS_${key.toUpperCase()}:`)
    console.log(JSON.stringify(actions))
  } else {
    console.error(`  ❌ HUBO DROPS:`, sim.dropped)
  }
}
