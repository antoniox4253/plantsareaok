import { getScaledPlantConfig } from '../src/utils/gameConstants.ts';
import type { CartaDeMazo } from '../src/engine/mazoDeLaSala.ts';
import type { PlantId } from '../types/game.ts';
import { msToTicks } from '../src/engine/time.ts';
import { simulateAsyncMatch } from '../src/engine/asyncOpponent.ts';
import { HUMAN_ARCHETYPES, generarTimelineHumanaAdversarial } from '../src/engine/adversarialHumanGenerator.ts';

export interface TacticalAction {
  seq: number;
  kind: 'plant';
  slot: number;
  plantId: string;
  lane: number;
  col: number;
  issuedTick: number;
  tick: number;
}

export function buildReliablePlan(
  deck: CartaDeMazo[],
  desiredSequence: Array<{ slot: number; lane: number; col: number; minTick?: number }>
): TacticalAction[] {
  const plan: TacticalAction[] = [];
  let seq = 1;

  let currentSun = 0;
  let nextSkySunTick = 121;
  const skyInterval = 182; // 6s / 33ms
  const producers: Array<{ tick: number; yield: number; interval: number }> = [];
  const slotCooldowns: Record<number, number> = {};
  const occupiedTiles = new Set<string>(); // "lane:col"
  let currentTick = 250;

  const advanceSun = (targetTick: number) => {
    while (nextSkySunTick <= targetTick) {
      currentSun += 25;
      nextSkySunTick += skyInterval;
    }
    for (const p of producers) {
      while (p.tick <= targetTick) {
        currentSun += p.yield;
        p.tick += p.interval;
      }
    }
  };

  for (const step of desiredSequence) {
    const card = deck[step.slot];
    if (!card) continue;
    const config = getScaledPlantConfig(card.plantId as PlantId, card.statRolls ?? undefined, card.equippedItem ?? undefined);
    const cost = config?.cost ?? 100;
    const cdMs = config?.cooldownMs ?? 7500;
    const cdTicks = msToTicks(cdMs);

    let candidateTick = Math.max(currentTick, step.minTick ?? 0, slotCooldowns[step.slot] ?? 0);
    advanceSun(candidateTick);

    // Wait until sun is available
    while (currentSun < cost && candidateTick <= 5850) {
      let nextArrival = nextSkySunTick;
      for (const p of producers) {
        if (p.tick < nextArrival) nextArrival = p.tick;
      }
      candidateTick = Math.max(candidateTick + 1, nextArrival + 2);
      advanceSun(candidateTick);
    }

    if (candidateTick > 5850 || currentSun < cost) break;

    // Check tile occupancy (walking/instant plants don't block tiles permanently)
    let lane = step.lane;
    let col = step.col;
    const isWalking = ['bonkchoy', 'ghostpepper'].includes(card.plantId);
    const isInstant = ['jalapeno', 'iceberglettuce'].includes(card.plantId);

    if (!isWalking && !isInstant) {
      if (occupiedTiles.has(`${lane}:${col}`)) {
        // find another col in same lane, or adjacent lane
        let found = false;
        for (let tryCol = 0; tryCol < 6; tryCol++) {
          if (!occupiedTiles.has(`${lane}:${tryCol}`)) {
            col = tryCol;
            found = true;
            break;
          }
        }
        if (!found) {
          for (let tryLane = 0; tryLane < 3; tryLane++) {
            for (let tryCol = 0; tryCol < 6; tryCol++) {
              if (!occupiedTiles.has(`${tryLane}:${tryCol}`)) {
                lane = tryLane;
                col = tryCol;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
      }
      occupiedTiles.add(`${lane}:${col}`);
    }

    currentSun -= cost;
    slotCooldowns[step.slot] = candidateTick + cdTicks;
    currentTick = candidateTick + 8; // human separation

    if (card.plantId === 'sunflower' || card.plantId === 'twinsunflower') {
      const isDouble = card.plantId === 'twinsunflower';
      producers.push({
        tick: candidateTick + 6 + 455 + 15, // buffer seguro para que el sol ya esté acreditado
        yield: isDouble ? 50 : 25,
        interval: 455,
      });
    }

    plan.push({
      seq: seq++,
      kind: 'plant',
      slot: step.slot,
      plantId: card.plantId,
      lane,
      col,
      issuedTick: candidateTick,
      tick: candidateTick + 6,
    });
  }

  return plan;
}
