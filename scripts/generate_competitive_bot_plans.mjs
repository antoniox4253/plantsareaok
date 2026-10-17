import { createBattleState, stepTick } from '../src/engine/simulate.ts'
import { createAsyncOpponentController, stepAsyncOpponent, casillaOcupadaP2 } from '../src/engine/asyncOpponent.ts'
import { PLANT_CONFIGS } from '../src/utils/gameConstants.ts'

export const arenaArchetypes = {
  // ── ARENA 1 (0 - 1600 ELO) ────────────────────────────────────────────────
  arena1_swarm: [
    { slot: 0, plantId: 'sunflower', level: 0, statRolls: [] },
    { slot: 1, plantId: 'peashooter', level: 0, statRolls: [] },
    { slot: 2, plantId: 'wallnut', level: 0, statRolls: [] },
    { slot: 3, plantId: 'chomper', level: 0, statRolls: [] },
  ],
  arena1_tactical: [
    { slot: 0, plantId: 'sunflower', level: 0, statRolls: [] },
    { slot: 1, plantId: 'peashooter', level: 0, statRolls: [] },
    { slot: 2, plantId: 'wallnut', level: 0, statRolls: [] },
    { slot: 3, plantId: 'squash', level: 0, statRolls: [] },
  ],
  arena1_brawler: [
    { slot: 0, plantId: 'sunflower', level: 0, statRolls: [] },
    { slot: 1, plantId: 'peashooter', level: 0, statRolls: [] },
    { slot: 2, plantId: 'wallnut', level: 0, statRolls: [] },
    { slot: 3, plantId: 'bonkchoy', level: 0, statRolls: [] },
  ],

  // ── ARENA 2 (1601 - 2000 ELO) ─────────────────────────────────────────────
  arena2_boxer: [
    { slot: 0, plantId: 'sunflower', level: 1, statRolls: ['hp'] },
    { slot: 1, plantId: 'peashooter', level: 1, statRolls: ['damage'] },
    { slot: 2, plantId: 'wallnut', level: 1, statRolls: ['hp'] },
    { slot: 3, plantId: 'bonkchoy', level: 1, statRolls: ['attackSpeed'] },
    { slot: 4, plantId: 'squash', level: 1, statRolls: ['cooldown'] },
  ],
  arena2_repeater: [
    { slot: 0, plantId: 'sunflower', level: 1, statRolls: ['hp'] },
    { slot: 1, plantId: 'repeater', level: 1, statRolls: ['damage'] },
    { slot: 2, plantId: 'wallnut', level: 1, statRolls: ['hp'] },
    { slot: 3, plantId: 'bonkchoy', level: 1, statRolls: ['attackSpeed'] },
    { slot: 4, plantId: 'garlic', level: 1, statRolls: ['hp'] },
  ],

  // ── ARENA 3 (2001 - 3000 ELO) ─────────────────────────────────────────────
  arena3_repeater_siege: [
    { slot: 0, plantId: 'sunflower', level: 2, statRolls: ['hp'] },
    { slot: 1, plantId: 'repeater', level: 2, statRolls: ['damage'] },
    { slot: 2, plantId: 'tallnut', level: 2, statRolls: ['hp'] },
    { slot: 3, plantId: 'bonkchoy', level: 2, statRolls: ['damage'] },
    { slot: 4, plantId: 'squash', level: 2, statRolls: ['cooldown'] },
    { slot: 5, plantId: 'garlic', level: 2, statRolls: ['hp'] },
  ],
  arena3_artillery: [
    { slot: 0, plantId: 'sunflower', level: 2, statRolls: ['hp'] },
    { slot: 1, plantId: 'repeater', level: 2, statRolls: ['damage'] },
    { slot: 2, plantId: 'tallnut', level: 2, statRolls: ['hp'] },
    { slot: 3, plantId: 'melonpult', level: 2, statRolls: ['damage'] },
    { slot: 4, plantId: 'bonkchoy', level: 2, statRolls: ['damage'] },
    { slot: 5, plantId: 'squash', level: 2, statRolls: ['cooldown'] },
  ],

  // ── ARENA 4 (3001 - 4000 ELO) ─────────────────────────────────────────────
  arena4_artillery: [
    { slot: 0, plantId: 'sunflower', level: 3, statRolls: ['hp'] },
    { slot: 1, plantId: 'repeater', level: 3, statRolls: ['damage'] },
    { slot: 2, plantId: 'tallnut', level: 3, statRolls: ['hp'] },
    { slot: 3, plantId: 'melonpult', level: 3, statRolls: ['damage'] },
    { slot: 4, plantId: 'bonkchoy', level: 3, statRolls: ['attackSpeed'] },
    { slot: 5, plantId: 'squash', level: 3, statRolls: ['cooldown'] },
  ],
  arena4_inferno: [
    { slot: 0, plantId: 'sunflower', level: 3, statRolls: ['hp'] },
    { slot: 1, plantId: 'repeater', level: 3, statRolls: ['damage'] },
    { slot: 2, plantId: 'tallnut', level: 3, statRolls: ['hp'] },
    { slot: 3, plantId: 'bonkchoy', level: 3, statRolls: ['attackSpeed'] },
    { slot: 4, plantId: 'squash', level: 3, statRolls: ['cooldown'] },
    { slot: 5, plantId: 'jalapeno', level: 3, statRolls: ['damage'] },
  ],

  // ── ARENA 5 (4001+ ELO) ───────────────────────────────────────────────────
  arena5_devastation: [
    { slot: 0, plantId: 'sunflower', level: 4, statRolls: ['hp'] },
    { slot: 1, plantId: 'threepeater', level: 4, statRolls: ['damage'] },
    { slot: 2, plantId: 'tallnut', level: 4, statRolls: ['hp'] },
    { slot: 3, plantId: 'melonpult', level: 4, statRolls: ['damage'] },
    { slot: 4, plantId: 'bonkchoy', level: 4, statRolls: ['attackSpeed'] },
    { slot: 5, plantId: 'squash', level: 4, statRolls: ['cooldown'] },
  ],
  arena5_firestorm: [
    { slot: 0, plantId: 'sunflower', level: 4, statRolls: ['hp'] },
    { slot: 1, plantId: 'repeater', level: 4, statRolls: ['damage'] },
    { slot: 2, plantId: 'tallnut', level: 4, statRolls: ['hp'] },
    { slot: 3, plantId: 'bonkchoy', level: 4, statRolls: ['attackSpeed'] },
    { slot: 4, plantId: 'squash', level: 4, statRolls: ['cooldown'] },
    { slot: 5, plantId: 'jalapeno', level: 4, statRolls: ['damage'] },
  ],
  arena5_freeze: [
    { slot: 0, plantId: 'sunflower', level: 4, statRolls: ['hp'] },
    { slot: 1, plantId: 'threepeater', level: 4, statRolls: ['damage'] },
    { slot: 2, plantId: 'tallnut', level: 4, statRolls: ['hp'] },
    { slot: 3, plantId: 'melonpult', level: 4, statRolls: ['damage'] },
    { slot: 4, plantId: 'bonkchoy', level: 4, statRolls: ['attackSpeed'] },
    { slot: 5, plantId: 'iceberglettuce', level: 4, statRolls: ['cooldown'] },
  ],
}

/**
 * Builds a 100% verified, zero-dropped deterministic bot plan by interacting directly
 * with the game engine's stepAsyncOpponent loop.
 */
export function buildDeterministicArenaPlan(deck, options = {}) {
  const state = createBattleState(1, false, true)
  const controller = createAsyncOpponentController(deck, [])

  const plan = []
  let nextSeq = 1

  const getCard = (id) => deck.find(c => c.plantId === id)
  const sunflowerCard = getCard('sunflower') || getCard('twinsunflower')
  const tankCard = getCard('tallnut') || getCard('wallnut')
  const heavyRanged = getCard('melonpult') || getCard('threepeater')
  const primaryAttacker = getCard('threepeater') || getCard('repeater') || getCard('peashooter') || getCard('bonkchoy')
  const secondaryAttacker = getCard('melonpult') || getCard('bonkchoy') || getCard('repeater') || getCard('chomper') || getCard('peashooter')
  const meleeAttacker = getCard('bonkchoy') || getCard('chomper')
  const earlyAttacker = getCard('peashooter') || getCard('repeater') || primaryAttacker
  const emergencyCard = getCard('squash') || getCard('jalapeno') || getCard('iceberglettuce')
  const diversionCard = getCard('garlic')

  const laneNextCol = {
    0: { sunflower: 0, attacker: 1, tank: 4 },
    1: { sunflower: 0, attacker: 1, tank: 4 },
    2: { sunflower: 0, attacker: 1, tank: 4 },
  }

  const targetLanes = [1, 0, 2] // rotation
  let laneIdx = 0

  const slotReadyAt = {}
  deck.forEach(c => { slotReadyAt[c.slot] = 0 })
  let reservedSun = 0

  function canAffordAndReady(card, t) {
    if (!card) return false
    const config = PLANT_CONFIGS[card.plantId]
    if (!config) return false
    if ((controller.sunBank - reservedSun) < config.cost) return false
    if ((slotReadyAt[card.slot] || 0) > t) return false
    if ((controller.slotCooldowns[card.slot] || 0) > t) return false
    return true
  }

  const occupiedGrid = new Set() // stores `${lane}-${col}`

  function isCellFree(lane, col) {
    return !occupiedGrid.has(`${lane}-${col}`)
  }

  function hasFreeCellInLane(lane) {
    for (let c = 0; c < 6; c++) {
      if (!casillaOcupadaP2(state, lane, c) && isCellFree(lane, c)) {
        return true
      }
    }
    return false
  }

  function findFreeLaneForStationary(type = 'attacker') {
    for (let i = 0; i < 3; i++) {
      const lane = targetLanes[(laneIdx + i) % 3]
      const col = type === 'attacker' ? laneNextCol[lane].attacker : laneNextCol[lane].tank
      const maxCol = type === 'attacker' ? 3 : 5
      if (col <= maxCol && isCellFree(lane, col) && !casillaOcupadaP2(state, lane, col)) {
        return { lane, col }
      }
      if (hasFreeCellInLane(lane)) {
        for (let c = (type === 'attacker' ? 1 : 4); c <= maxCol; c++) {
          if (isCellFree(lane, c) && !casillaOcupadaP2(state, lane, c)) {
            return { lane, col: c }
          }
        }
      }
    }
    return null
  }

  function queueAndExecute(card, lane, col, t) {
    const config = PLANT_CONFIGS[card.plantId]
    const camina = config.category === 'melee' || !!config.moveSpeed || card.plantId === 'chomper'
    const instant = card.plantId === 'jalapeno' || card.plantId === 'iceberglettuce'

    const intent = {
      seq: nextSeq++,
      tick: t + 6,
      issuedTick: t,
      kind: 'plant',
      plantId: card.plantId,
      slot: card.slot,
      lane: lane,
      col: camina ? (col ?? 3) : col
    }
    controller.intents.push(intent)
    plan.push(intent)

    if (!camina && !instant) {
      occupiedGrid.add(`${lane}-${col}`)
    }

    const cooldownTicks = Math.ceil(config.cooldownMs / 33) + 6
    slotReadyAt[card.slot] = t + cooldownTicks
    reservedSun += config.cost
  }

  // Simulation run: tick 0 to 5400
  for (let t = 0; t <= 5400; t++) {
    state.tick = t
    reservedSun = 0

    // 1. Advance passive economy in engine first
    stepAsyncOpponent(controller, state)

    // 2. Only consider planting if no retry is pending
    if (!controller.pendingRetry) {
      const sunflowersPlaced = plan.filter(p => p.plantId === 'sunflower' || p.plantId === 'twinsunflower').length

      // A. Early Surprise: Squash / Iceberglettuce opening (4.0s, tick 121)
      if (t >= 121 && t <= 150 && emergencyCard && (emergencyCard.plantId === 'squash' || emergencyCard.plantId === 'iceberglettuce') && canAffordAndReady(emergencyCard, t)) {
        queueAndExecute(emergencyCard, 1, 2, t)
      }
      // B. Sunflower #1 (10s, tick 303)
      else if (sunflowersPlaced === 0 && canAffordAndReady(sunflowerCard, t) && isCellFree(1, 0)) {
        queueAndExecute(sunflowerCard, 1, 0, t)
      }
      // C. Early Frontline Tank (Wall-nut) at ~22s (tick 667)
      else if (t >= 667 && t <= 750 && tankCard && canAffordAndReady(tankCard, t) && isCellFree(1, 4)) {
        queueAndExecute(tankCard, 1, 4, t)
      }
      // D. Sunflower #2 at ~28s (tick 850)
      else if (sunflowersPlaced === 1 && t >= 850 && canAffordAndReady(sunflowerCard, t) && isCellFree(0, 0)) {
        queueAndExecute(sunflowerCard, 0, 0, t)
      }
      // E. Early Walking Melee (Bonk Choy / Chomper) at ~52s (tick 1575)
      else if (t >= 1500 && t <= 1650 && meleeAttacker && canAffordAndReady(meleeAttacker, t)) {
        queueAndExecute(meleeAttacker, targetLanes[laneIdx % 3], 3, t)
        laneIdx++
      }
      // F. Sunflower #3 at ~60s (tick 1820)
      else if (sunflowersPlaced === 2 && t >= 1820 && canAffordAndReady(sunflowerCard, t) && (options.maxSunflowers || 3) >= 3 && isCellFree(2, 0)) {
        queueAndExecute(sunflowerCard, 2, 0, t)
      }
      // G. Regular Combat Cadence (t >= 750, check every 15 ticks ~0.5s)
      else if (t >= 750 && (t % 15 === 0)) {
        function tryDeploy(card, type = 'attacker') {
          if (!card || !canAffordAndReady(card, t)) return false
          const config = PLANT_CONFIGS[card.plantId]
          const isWalking = config && (config.category === 'melee' || !!config.moveSpeed || card.plantId === 'chomper')
          const isInstant = card.plantId === 'jalapeno' || card.plantId === 'iceberglettuce'

          if (isWalking || isInstant) {
            const lane = targetLanes[laneIdx % 3]
            queueAndExecute(card, lane, isWalking ? 3 : 2, t)
            laneIdx++
            return true
          }

          // Stationary plant
          const slot = findFreeLaneForStationary(type)
          if (slot) {
            if (type === 'attacker') laneNextCol[slot.lane].attacker++
            else if (type === 'tank') laneNextCol[slot.lane].tank++
            queueAndExecute(card, slot.lane, slot.col, t)
            laneIdx++
            return true
          }
          return false
        }

        const rangedAttackersPlaced = plan.filter(p => ['peashooter', 'repeater', 'threepeater', 'melonpult'].includes(p.plantId)).length
        const attackersPlaced = plan.filter(p => !['sunflower', 'twinsunflower', 'wallnut', 'tallnut', 'garlic'].includes(p.plantId)).length
        const tanksPlaced = plan.filter(p => ['wallnut', 'tallnut'].includes(p.plantId)).length
        const diversionsPlaced = plan.filter(p => p.plantId === 'garlic').length
        const meleesPlaced = meleeAttacker ? plan.filter(p => p.plantId === meleeAttacker.plantId).length : 0

        const meleeCost = meleeAttacker ? (PLANT_CONFIGS[meleeAttacker.plantId]?.cost || 150) : 0
        const primaryCost = primaryAttacker ? (PLANT_CONFIGS[primaryAttacker.plantId]?.cost || 100) : 100

        // If bot has a walking melee attacker and hasn't placed one yet, reserve sun for it
        const isSavingForMelee = meleeAttacker && meleesPlaced < 1 && sunflowersPlaced >= 2 && controller.sunBank < meleeCost && t < 2000

        // If primary attacker is heavy (e.g. Repeater >= 200) and we have no ranged attackers yet, reserve sun for it
        const isSavingForPrimary = primaryCost >= 150 && rangedAttackersPlaced < 1 && controller.sunBank < primaryCost && t < 3000

        const isSaving = isSavingForMelee || isSavingForPrimary

        // Tank allowance: max 3 tanks total (1 per lane), only when not saving
        const allowTank = !isSaving && tanksPlaced < 3 && (attackersPlaced >= 1 || controller.sunBank >= 150)

        // Diversion allowance (Garlic): max 2 total, only when not saving and at least 1 attacker is already out
        const allowDiversion = !isSaving && diversionsPlaced < 2 && attackersPlaced >= 1

        let deployed = false
        // 1. Heavy Artillery (Melonpult / Threepeater) if sun >= 300
        if (heavyRanged && controller.sunBank >= (PLANT_CONFIGS[heavyRanged.plantId]?.cost || 300)) {
          deployed = tryDeploy(heavyRanged, 'attacker')
        }
        // 2. If we have melee out and need ranged, deploy primary attacker first
        if (!deployed && primaryAttacker && (attackersPlaced === 0 || attackersPlaced <= meleesPlaced)) {
          deployed = tryDeploy(primaryAttacker, 'attacker')
        }
        // 3. Walking melee attacker (Bonk Choy / Chomper) - pressure player!
        const canDeployMelee = meleeAttacker && (
          meleesPlaced === 0 ||
          (meleesPlaced < 3 && rangedAttackersPlaced >= 1) ||
          controller.sunBank >= (meleeCost + primaryCost)
        )
        if (!deployed && canDeployMelee) {
          deployed = tryDeploy(meleeAttacker, 'attacker')
        }
        // 4. Primary or early attacker
        if (!deployed && !isSavingForMelee) {
          deployed = tryDeploy(primaryAttacker || earlyAttacker, 'attacker')
        }
        // 5. Secondary attacker (only if different from meleeAttacker)
        if (!deployed && secondaryAttacker && secondaryAttacker.plantId !== meleeAttacker?.plantId && !isSavingForMelee) {
          deployed = tryDeploy(secondaryAttacker, 'attacker')
        }
        // 5. Frontline Tank
        if (!deployed && allowTank) {
          deployed = tryDeploy(tankCard, 'tank')
        }
        // 6. Emergency / instant / spell (Squash, Jalapeno, Iceberg)
        if (!deployed && emergencyCard) {
          deployed = tryDeploy(emergencyCard, 'attacker')
        }
        // 7. Diversion (Garlic)
        if (!deployed && allowDiversion && diversionCard) {
          deployed = tryDeploy(diversionCard, 'attacker')
        }
      }
    }

    stepTick(state)
  }

  // Double check: Verify by re-running a fresh simulation with the generated plan
  const verifyState = createBattleState(1, false, true)
  const verifyController = createAsyncOpponentController(deck, plan)

  for (let t = 0; t <= 5400; t++) {
    verifyState.tick = t
    stepAsyncOpponent(verifyController, verifyState)
    stepTick(verifyState)
  }

  return {
    deck,
    plan,
    stats: verifyController.stats
  }
}

console.log('=== VERIFIED DETERMINISTIC PLANNER (ALL ARCHETYPES) ===')
for (const [name, deck] of Object.entries(arenaArchetypes)) {
  const result = buildDeterministicArenaPlan(deck)
  console.log(`\n--- ${name.toUpperCase()} ---`)
  console.log(`Total plants planned: ${result.plan.length}`)
  console.log(`Verified Execution: Executed: ${result.stats.intentionsExecuted}, Dropped: ${result.stats.intentionsDropped}`)
  const firstPlant = result.plan[0]
  const firstAttacker = result.plan.find(p => !['sunflower', 'wallnut', 'tallnut'].includes(p.plantId))
  const lastPlant = result.plan[result.plan.length - 1]
  console.log(`First plant: ${(firstPlant.issuedTick/30.3).toFixed(1)}s (${firstPlant.plantId} at lane ${firstPlant.lane})`)
  console.log(`First attacker: ${(firstAttacker?.issuedTick/30.3).toFixed(1)}s (${firstAttacker?.plantId} at lane ${firstAttacker?.lane})`)
  console.log(`Last plant: ${(lastPlant.issuedTick/30.3).toFixed(1)}s (${lastPlant.plantId})`)

  const lanesWithAttacker = new Set(result.plan.filter(p => !['sunflower', 'wallnut', 'tallnut'].includes(p.plantId)).map(p => p.lane))
  console.log(`Lanes with attackers: ${[...lanesWithAttacker].sort().join(', ')} (Total: ${lanesWithAttacker.size}/3)`)
}
