// Script to test bot combo plans against the exact deterministic sun economy of asyncOpponent

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

export const PLANT_COSTS = {
  sunflower: 50,
  peashooter: 100,
  wallnut: 50,
  repeater: 200,
  bonkchoy: 175,
  squash: 50,
  tallnut: 125,
  threepeater: 325,
  garlic: 50,
  kernelpult: 100,
  jalapeno: 125,
}

export function simulateBotPlan(plan) {
  let sunBank = 0
  let sunflowers = []
  let executed = []
  let dropped = []
  let intentIdx = 0
  let pendingRetry = null

  for (let tick = 0; tick <= 6000; tick++) {
    // Sky sun
    if (tick >= primerSolP2Tick && (tick - primerSolP2Tick) % msToTicks(SOL_DEL_CIELO_MS) === 0) {
      sunBank += SUN_VALUE
    }

    // Sunflower sun
    for (const sf of sunflowers) {
      if (tick > sf.plantedAt && (tick - sf.plantedAt) % girasolTicks === 0) {
        sunBank += SUN_VALUE
      }
    }

    // Retry
    if (pendingRetry) {
      if (tick >= pendingRetry.expireTick) {
        dropped.push({ ...pendingRetry.intent, reason: 'EXPIRED', atTick: tick, sunAtExpire: sunBank })
        pendingRetry = null
      } else if (tick >= pendingRetry.nextRetryTick) {
        const cost = PLANT_COSTS[pendingRetry.intent.plantId]
        if (sunBank >= cost) {
          sunBank -= cost
          if (pendingRetry.intent.plantId === 'sunflower') {
            sunflowers.push({ plantedAt: tick })
          }
          executed.push({ ...pendingRetry.intent, executedAtTick: tick })
          pendingRetry = null
        } else {
          pendingRetry.nextRetryTick = tick + 15
        }
      }
    }

    // New intent
    if (intentIdx < plan.length && plan[intentIdx].issuedTick <= tick) {
      const intent = plan[intentIdx]
      intentIdx++
      const cost = PLANT_COSTS[intent.plantId]
      if (!pendingRetry && sunBank >= cost) {
        sunBank -= cost
        if (intent.plantId === 'sunflower') {
          sunflowers.push({ plantedAt: tick })
        }
        executed.push({ ...intent, executedAtTick: tick })
      } else if (!pendingRetry) {
        pendingRetry = {
          intent,
          nextRetryTick: tick + 15,
          expireTick: intent.issuedTick + 90,
        }
      } else {
        dropped.push({ ...intent, reason: 'BLOCKED_BY_PREVIOUS_RETRY', atTick: tick })
      }
    }
  }

  return { executed, dropped, finalSun: sunBank }
}
