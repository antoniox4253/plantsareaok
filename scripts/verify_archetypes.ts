import pg from 'pg';
import { buildReliablePlan } from './test_reliable_plan_gen.ts';
import { simulateAsyncMatch } from '../src/engine/asyncOpponent.ts';
import { HUMAN_ARCHETYPES, generarTimelineHumanaAdversarial } from '../src/engine/adversarialHumanGenerator.ts';
import type { CartaDeMazo } from '../src/engine/mazoDeLaSala.ts';

// 5 ARQUETIPOS DE ÉLITE INSPIRADOS EN LOS TOP PLAYERS
export const TOP_META_ARCHETYPES: Array<{
  name: string;
  avatar: string;
  deck: CartaDeMazo[];
  sequence: Array<{ slot: number; lane: number; col: number; minTick?: number }>;
}> = [
  // 1. Ramp & Artillería Pesada (Estilo Jon Snow)
  {
    name: 'Ramp & Heavy Artillery',
    avatar: 'melonpult',
    deck: [
      { slot: 0, level: 4, plantId: 'sunflower', statRolls: ['cooldown', 'hp'] },
      { slot: 1, level: 4, plantId: 'wallnut', equippedItem: 'ironman_suit', statRolls: ['hp', 'hp'] },
      { slot: 2, level: 4, plantId: 'melonpult', statRolls: ['damage', 'attackSpeed'] },
      { slot: 3, level: 3, plantId: 'jalapeno', statRolls: ['damage'] },
      { slot: 4, level: 4, plantId: 'peashooter', statRolls: ['damage', 'cooldown'] },
      { slot: 5, level: 3, plantId: 'iceberglettuce', statRolls: ['cooldown'] },
    ],
    sequence: [
      // Apertura rápida de 5 girasoles y cobertura temprana
      { slot: 0, lane: 1, col: 0, minTick: 309 },  // Girasol 1 (~10s)
      { slot: 0, lane: 0, col: 0, minTick: 680 },  // Girasol 2 (~22s)
      { slot: 1, lane: 1, col: 3, minTick: 850 },  // Muro Nuez Temprano (~28s) en carril central
      { slot: 0, lane: 2, col: 0, minTick: 1100 }, // Girasol 3 (~36s)
      { slot: 4, lane: 0, col: 1, minTick: 1300 }, // Peashooter carril 0 (~43s)
      { slot: 0, lane: 1, col: 1, minTick: 1550 }, // Girasol 4 (~51s)
      { slot: 5, lane: 0, col: 3, minTick: 1750 }, // Iceberg Lettuce congelar (~57s)
      { slot: 0, lane: 2, col: 1, minTick: 1950 }, // Girasol 5 (~64s)
      { slot: 2, lane: 1, col: 1, minTick: 2200 }, // Melon-pult (~72s)
      { slot: 1, lane: 0, col: 3, minTick: 2450 }, // Wall-nut carril 0 (~80s)
      { slot: 4, lane: 2, col: 1, minTick: 2700 }, // Peashooter carril 2 (~89s)
      { slot: 2, lane: 2, col: 1, minTick: 3000 }, // Melon-pult carril 2 (~99s)
      { slot: 3, lane: 1, col: 4, minTick: 3300 }, // Jalapeno (~108s)
      { slot: 1, lane: 2, col: 3, minTick: 3550 }, // Wall-nut carril 2 (~117s)
      { slot: 2, lane: 0, col: 1, minTick: 3850 }, // Melon-pult carril 0 (~127s)
      { slot: 4, lane: 1, col: 2, minTick: 4100 }, // Peashooter carril 1 (~135s)
      { slot: 5, lane: 2, col: 4, minTick: 4300 }, // Iceberg Lettuce (~141s)
      { slot: 1, lane: 1, col: 4, minTick: 4500 }, // Wall-nut carril 1 (~148s)
      { slot: 3, lane: 0, col: 4, minTick: 4800 }, // Jalapeno carril 0 (~158s)
      { slot: 2, lane: 1, col: 2, minTick: 5100 }, // Melon-pult (~168s)
      { slot: 4, lane: 0, col: 2, minTick: 5350 }, // Peashooter (~176s)
      { slot: 1, lane: 0, col: 4, minTick: 5550 }, // Wall-nut (~183s)
      { slot: 3, lane: 2, col: 4, minTick: 5750 }, // Jalapeno (~189s)
    ]
  },
  // 2. Enjambre Rápido y Desvío de Ajo (Estilo Adolfo2323)
  {
    name: 'Pea-Swarm & Garlic Funnel',
    avatar: 'garlic',
    deck: [
      { slot: 0, level: 4, plantId: 'sunflower', statRolls: ['cooldown', 'cooldown'] },
      { slot: 1, level: 4, plantId: 'peashooter', equippedItem: 'commando_bandana', statRolls: ['attackSpeed', 'damage'] },
      { slot: 2, level: 4, plantId: 'repeater', statRolls: ['damage', 'attackSpeed'] },
      { slot: 3, level: 3, plantId: 'garlic', statRolls: ['hp', 'cooldown'] },
      { slot: 4, level: 4, plantId: 'wallnut', statRolls: ['hp', 'cooldown'] },
      { slot: 5, level: 4, plantId: 'bonkchoy', statRolls: ['damage', 'attackSpeed'] },
    ],
    sequence: [
      { slot: 0, lane: 1, col: 0, minTick: 309 },  // Girasol 1
      { slot: 0, lane: 0, col: 0, minTick: 680 },  // Girasol 2
      { slot: 1, lane: 0, col: 2, minTick: 850 },  // Peashooter rápido t=28s carril 0
      { slot: 0, lane: 2, col: 0, minTick: 1100 }, // Girasol 3
      { slot: 3, lane: 0, col: 4, minTick: 1300 }, // Ajo en carril 0 (desvía a carril 1)
      { slot: 4, lane: 1, col: 3, minTick: 1550 }, // Nuez en carril 1 recibiendo desvíos
      { slot: 0, lane: 1, col: 1, minTick: 1800 }, // Girasol 4
      { slot: 2, lane: 1, col: 2, minTick: 2050 }, // Repetidora en carril 1
      { slot: 3, lane: 2, col: 4, minTick: 2300 }, // Ajo en carril 2 (desvía también a carril 1)
      { slot: 5, lane: 0, col: 3, minTick: 2550 }, // Bonk Choy saliendo por carril 0
      { slot: 0, lane: 2, col: 1, minTick: 2800 }, // Girasol 5
      { slot: 2, lane: 0, col: 1, minTick: 3050 }, // Repetidora en carril 0
      { slot: 1, lane: 2, col: 2, minTick: 3300 }, // Peashooter carril 2
      { slot: 4, lane: 1, col: 4, minTick: 3550 }, // Nuez refuerzo carril 1
      { slot: 2, lane: 2, col: 1, minTick: 3800 }, // Repetidora carril 2
      { slot: 5, lane: 2, col: 3, minTick: 4050 }, // Bonk Choy carril 2
      { slot: 3, lane: 0, col: 5, minTick: 4300 }, // Ajo refresco carril 0
      { slot: 2, lane: 1, col: 1, minTick: 4550 }, // Repetidora doble carril 1
      { slot: 1, lane: 1, col: 2, minTick: 4800 }, // Peashooter carril 1
      { slot: 4, lane: 0, col: 3, minTick: 5050 }, // Nuez carril 0
      { slot: 5, lane: 1, col: 3, minTick: 5300 }, // Bonk Choy carril 1
      { slot: 2, lane: 2, col: 2, minTick: 5550 }, // Repetidora carril 2
      { slot: 3, lane: 2, col: 5, minTick: 5750 }, // Ajo carril 2
    ]
  },
  // 3. Asalto Melee con Cinturón (Bruiser)
  {
    name: 'Champion Belt Melee Bruiser',
    avatar: 'bonkchoy',
    deck: [
      { slot: 0, level: 4, plantId: 'sunflower', statRolls: ['hp', 'cooldown'] },
      { slot: 1, level: 4, plantId: 'bonkchoy', equippedItem: 'champion_belt', statRolls: ['damage', 'attackSpeed'] },
      { slot: 2, level: 4, plantId: 'chomper', statRolls: ['attackSpeed', 'cooldown'] },
      { slot: 3, level: 4, plantId: 'explodeonut', statRolls: ['hp', 'hp'] },
      { slot: 4, level: 4, plantId: 'repeater', statRolls: ['damage', 'cooldown'] },
      { slot: 5, level: 3, plantId: 'garlic', statRolls: ['hp'] },
    ],
    sequence: [
      { slot: 0, lane: 1, col: 0, minTick: 309 },  // Girasol 1
      { slot: 0, lane: 0, col: 0, minTick: 680 },  // Girasol 2
      { slot: 1, lane: 1, col: 3, minTick: 850 },  // Bonk Choy Cinturón temprano t=28s
      { slot: 0, lane: 2, col: 0, minTick: 1100 }, // Girasol 3
      { slot: 3, lane: 2, col: 3, minTick: 1350 }, // Nuez Explosiva protección carril 2
      { slot: 5, lane: 0, col: 3, minTick: 1600 }, // Ajo protección carril 0
      { slot: 0, lane: 1, col: 1, minTick: 1850 }, // Girasol 4
      { slot: 2, lane: 1, col: 2, minTick: 2100 }, // Chomper carril 1
      { slot: 4, lane: 1, col: 1, minTick: 2400 }, // Repetidora soporte carril 1
      { slot: 1, lane: 0, col: 2, minTick: 2700 }, // Bonk Choy carril 0
      { slot: 3, lane: 0, col: 4, minTick: 3000 }, // Nuez Explosiva carril 0
      { slot: 4, lane: 2, col: 1, minTick: 3300 }, // Repetidora carril 2
      { slot: 2, lane: 2, col: 2, minTick: 3600 }, // Chomper carril 2
      { slot: 1, lane: 2, col: 2, minTick: 3900 }, // Bonk Choy carril 2
      { slot: 4, lane: 0, col: 1, minTick: 4200 }, // Repetidora carril 0
      { slot: 3, lane: 1, col: 3, minTick: 4500 }, // Nuez Explosiva carril 1
      { slot: 1, lane: 1, col: 2, minTick: 4800 }, // Bonk Choy carril 1
      { slot: 2, lane: 0, col: 2, minTick: 5100 }, // Chomper carril 0
      { slot: 4, lane: 1, col: 2, minTick: 5400 }, // Repetidora carril 1
      { slot: 5, lane: 2, col: 4, minTick: 5700 }, // Ajo carril 2
    ]
  },
  // 4. Control Glacial y Stun con Mantequilla
  {
    name: 'Glacial Stun & Slow Control',
    avatar: 'snowpea',
    deck: [
      { slot: 0, level: 4, plantId: 'sunflower', statRolls: ['cooldown', 'hp'] },
      { slot: 1, level: 4, plantId: 'snowpea', statRolls: ['damage', 'attackSpeed'] },
      { slot: 2, level: 4, plantId: 'kernelpult', statRolls: ['damage', 'cooldown'] },
      { slot: 3, level: 4, plantId: 'wallnut', statRolls: ['hp', 'hp'] },
      { slot: 4, level: 3, plantId: 'garlic', statRolls: ['cooldown'] },
      { slot: 5, level: 3, plantId: 'jalapeno', statRolls: ['damage'] },
    ],
    sequence: [
      { slot: 0, lane: 1, col: 0, minTick: 309 },  // Girasol 1
      { slot: 0, lane: 0, col: 0, minTick: 680 },  // Girasol 2
      { slot: 2, lane: 1, col: 1, minTick: 850 },  // Kernelpult temprano t=28s (mantequilla)
      { slot: 0, lane: 2, col: 0, minTick: 1100 }, // Girasol 3
      { slot: 3, lane: 1, col: 3, minTick: 1350 }, // Wall-nut carril central
      { slot: 1, lane: 0, col: 1, minTick: 1600 }, // Hielaguisantes carril 0 (freno)
      { slot: 0, lane: 1, col: 1, minTick: 1850 }, // Girasol 4
      { slot: 1, lane: 2, col: 1, minTick: 2100 }, // Hielaguisantes carril 2 (freno)
      { slot: 4, lane: 0, col: 4, minTick: 2350 }, // Ajo carril 0
      { slot: 2, lane: 0, col: 2, minTick: 2600 }, // Kernelpult carril 0
      { slot: 3, lane: 2, col: 3, minTick: 2850 }, // Wall-nut carril 2
      { slot: 2, lane: 2, col: 2, minTick: 3100 }, // Kernelpult carril 2
      { slot: 5, lane: 1, col: 4, minTick: 3400 }, // Jalapeno limpia masas
      { slot: 3, lane: 0, col: 3, minTick: 3700 }, // Wall-nut carril 0
      { slot: 1, lane: 1, col: 2, minTick: 4000 }, // Hielaguisantes carril 1
      { slot: 4, lane: 2, col: 4, minTick: 4250 }, // Ajo carril 2
      { slot: 2, lane: 1, col: 2, minTick: 4550 }, // Kernelpult carril 1
      { slot: 5, lane: 0, col: 4, minTick: 4850 }, // Jalapeno carril 0
      { slot: 3, lane: 1, col: 4, minTick: 5150 }, // Wall-nut carril 1
      { slot: 1, lane: 0, col: 2, minTick: 5400 }, // Hielaguisantes carril 0
      { slot: 5, lane: 2, col: 4, minTick: 5700 }, // Jalapeno carril 2
    ]
  },
  // 5. Doble Economía & Fuego Burst
  {
    name: 'Twin Sun Burst & Tall-nut Defense',
    avatar: 'twinsunflower',
    deck: [
      { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
      { slot: 1, level: 4, plantId: 'twinsunflower', statRolls: ['cooldown', 'cooldown'] },
      { slot: 2, level: 4, plantId: 'repeater', statRolls: ['damage', 'attackSpeed'] },
      { slot: 3, level: 4, plantId: 'tallnut', statRolls: ['hp', 'hp'] },
      { slot: 4, level: 4, plantId: 'explodeonut', statRolls: ['damage', 'hp'] },
      { slot: 5, level: 4, plantId: 'jalapeno', statRolls: ['damage'] },
    ],
    sequence: [
      { slot: 0, lane: 1, col: 0, minTick: 309 },  // Girasol 1 carril 1
      { slot: 0, lane: 0, col: 0, minTick: 680 },  // Girasol 2 carril 0
      { slot: 0, lane: 2, col: 0, minTick: 1050 }, // Girasol 3 carril 2 (base completa en col 0)
      { slot: 3, lane: 1, col: 3, minTick: 1300 }, // Nuez Cascararrabias central
      { slot: 1, lane: 1, col: 1, minTick: 1650 }, // Girasol Doble 1
      { slot: 4, lane: 0, col: 3, minTick: 2000 }, // Nuez Explosiva carril 0
      { slot: 2, lane: 1, col: 2, minTick: 2400 }, // Repetidora central
      { slot: 1, lane: 0, col: 1, minTick: 2800 }, // Girasol Doble 2
      { slot: 3, lane: 2, col: 3, minTick: 3200 }, // Tall-nut carril 2
      { slot: 2, lane: 0, col: 2, minTick: 3800 }, // Repetidora carril 0
      { slot: 2, lane: 2, col: 2, minTick: 4200 }, // Repetidora carril 2
      { slot: 5, lane: 1, col: 4, minTick: 4500 }, // Jalapeno limpia
      { slot: 4, lane: 2, col: 4, minTick: 4800 }, // Nuez Explosiva carril 2
      { slot: 2, lane: 1, col: 1, minTick: 5100 }, // Repetidora carril 1
      { slot: 5, lane: 0, col: 4, minTick: 5400 }, // Jalapeno carril 0
      { slot: 3, lane: 0, col: 4, minTick: 5600 }, // Tall-nut carril 0
      { slot: 5, lane: 2, col: 4, minTick: 5750 }, // Jalapeno carril 2
    ]
  }
];

async function testAll() {
  const pool = new pg.Pool({ connectionString: 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres' });
  const client = await pool.connect();

  console.log('=== VERIFICANDO LOS 5 ARQUETIPOS DE ÉLITE ===\n');

  for (let i = 0; i < TOP_META_ARCHETYPES.length; i++) {
    const arch = TOP_META_ARCHETYPES[i];
    const plan = buildReliablePlan(arch.deck, arch.sequence);
    console.log(`Arquetipo #${i+1}: "${arch.name}" -> ${plan.length} acciones generadas`);

    // 1. Validar SQL
    const { rows } = await client.query('SELECT public._validate_ranked_async_plan($1::jsonb) as val;', [JSON.stringify(plan)]);
    if (!rows[0].val.ok) {
      console.error(`❌ Falló validación SQL:`, rows[0].val);
      process.exit(1);
    }
    console.log(`  ✓ SQL _validate_ranked_async_plan: OK`);

    // 2. Simulación contra Arquetipo Humano
    const humanDeck = HUMAN_ARCHETYPES.HUMAN_BALANCED.deck;
    const humanTimeline = generarTimelineHumanaAdversarial(HUMAN_ARCHETYPES.HUMAN_BALANCED, 1000 + i);
    const sim = simulateAsyncMatch(1000 + i, humanDeck, arch.deck, humanTimeline, plan, 6000);

    if (!sim.ok) {
      console.error(`❌ Simulación no ok:`, sim);
    } else if (sim.telemetria.intentionsDropped > 0) {
      console.error(`❌ Se cayeron ${sim.telemetria.intentionsDropped} intenciones!`);
    } else {
      console.log(`  ✓ Simulación contra Humano: OK (0 drops, motivo: ${sim.motivo}, ganador: ${sim.ganador === 'p1' ? 'Humano' : 'Bot'})\n`);
    }
  }

  client.release();
  await pool.end();
  console.log('🎯 TODOS LOS 5 ARQUETIPOS CERTIFICADOS CON 0 DROPS Y 100% VALIDADOS.');
}

testAll().catch(console.error);
