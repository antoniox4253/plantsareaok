import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 5 Combos aprobados por el usuario: 4, 3, 2, 6, 10
const BASE_COMBOS = [
  // 0 -> Combo 4: Sombra Ancestral Pesado
  {
    code: 'combo4',
    name: 'Combo 4: Sombra Ancestral Pesado',
    archetype: 'sombra_pesado',
    deckTemplate: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'repeater' },
      { slot: 2, plantId: 'tallnut' },
      { slot: 3, plantId: 'bonkchoy' },
      { slot: 4, plantId: 'squash' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 1, col: 3, issuedTick: 654, tick: 660 },
      { seq: 5, kind: 'plant', slot: 1, plantId: 'repeater', lane: 1, col: 1, issuedTick: 1014, tick: 1020 },
      { seq: 6, kind: 'plant', slot: 1, plantId: 'repeater', lane: 0, col: 1, issuedTick: 1374, tick: 1380 },
      { seq: 7, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 0, col: 3, issuedTick: 1590, tick: 1596 },
      { seq: 8, kind: 'plant', slot: 1, plantId: 'repeater', lane: 2, col: 1, issuedTick: 1950, tick: 1956 },
      { seq: 9, kind: 'plant', slot: 3, plantId: 'bonkchoy', lane: 1, col: 4, issuedTick: 2262, tick: 2268 },
      { seq: 10, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 2, col: 3, issuedTick: 2499, tick: 2505 },
      { seq: 11, kind: 'plant', slot: 3, plantId: 'bonkchoy', lane: 0, col: 4, issuedTick: 2754, tick: 2760 },
      { seq: 12, kind: 'plant', slot: 3, plantId: 'bonkchoy', lane: 2, col: 4, issuedTick: 3294, tick: 3300 },
      { seq: 13, kind: 'plant', slot: 4, plantId: 'squash', lane: 1, col: 5, issuedTick: 3594, tick: 3600 },
      { seq: 14, kind: 'plant', slot: 1, plantId: 'repeater', lane: 1, col: 2, issuedTick: 4194, tick: 4200 },
      { seq: 15, kind: 'plant', slot: 4, plantId: 'squash', lane: 0, col: 5, issuedTick: 4794, tick: 4800 },
      { seq: 16, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 2, col: 5, issuedTick: 5394, tick: 5400 },
    ]
  },

  // 1 -> Combo 3: Parálisis Mantequilla + Ajo
  {
    code: 'combo3',
    name: 'Combo 3: Parálisis Mantequilla + Ajo',
    archetype: 'mantequilla_ajo',
    deckTemplate: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'kernelpult' },
      { slot: 2, plantId: 'garlic' },
      { slot: 3, plantId: 'wallnut' },
      { slot: 4, plantId: 'repeater' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 2, plantId: 'garlic', lane: 0, col: 5, issuedTick: 654, tick: 660 },
      { seq: 5, kind: 'plant', slot: 2, plantId: 'garlic', lane: 2, col: 5, issuedTick: 894, tick: 900 },
      { seq: 6, kind: 'plant', slot: 3, plantId: 'wallnut', lane: 1, col: 5, issuedTick: 1134, tick: 1140 },
      { seq: 7, kind: 'plant', slot: 1, plantId: 'kernelpult', lane: 1, col: 1, issuedTick: 1434, tick: 1440 },
      { seq: 8, kind: 'plant', slot: 1, plantId: 'kernelpult', lane: 0, col: 1, issuedTick: 1734, tick: 1740 },
      { seq: 9, kind: 'plant', slot: 1, plantId: 'kernelpult', lane: 2, col: 1, issuedTick: 2034, tick: 2040 },
      { seq: 10, kind: 'plant', slot: 4, plantId: 'repeater', lane: 1, col: 2, issuedTick: 2394, tick: 2400 },
      { seq: 11, kind: 'plant', slot: 4, plantId: 'repeater', lane: 1, col: 3, issuedTick: 2754, tick: 2760 },
      { seq: 12, kind: 'plant', slot: 1, plantId: 'kernelpult', lane: 1, col: 4, issuedTick: 3114, tick: 3120 },
      { seq: 13, kind: 'plant', slot: 4, plantId: 'repeater', lane: 0, col: 2, issuedTick: 3594, tick: 3600 },
      { seq: 14, kind: 'plant', slot: 4, plantId: 'repeater', lane: 2, col: 2, issuedTick: 4094, tick: 4100 },
      { seq: 15, kind: 'plant', slot: 2, plantId: 'garlic', lane: 0, col: 4, issuedTick: 4694, tick: 4700 },
      { seq: 16, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 1, col: 5, issuedTick: 5294, tick: 5300 },
    ]
  },

  // 2 -> Combo 2: Embudo Mortal de Ajo
  {
    code: 'combo2',
    name: 'Combo 2: Embudo Mortal de Ajo',
    archetype: 'embudo_ajo',
    deckTemplate: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'garlic' },
      { slot: 2, plantId: 'bonkchoy' },
      { slot: 3, plantId: 'wallnut' },
      { slot: 4, plantId: 'repeater' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 1, plantId: 'garlic', lane: 0, col: 5, issuedTick: 654, tick: 660 },
      { seq: 5, kind: 'plant', slot: 1, plantId: 'garlic', lane: 2, col: 5, issuedTick: 894, tick: 900 },
      { seq: 6, kind: 'plant', slot: 3, plantId: 'wallnut', lane: 1, col: 5, issuedTick: 1134, tick: 1140 },
      { seq: 7, kind: 'plant', slot: 2, plantId: 'bonkchoy', lane: 1, col: 4, issuedTick: 1434, tick: 1440 },
      { seq: 8, kind: 'plant', slot: 2, plantId: 'bonkchoy', lane: 1, col: 3, issuedTick: 1734, tick: 1740 },
      { seq: 9, kind: 'plant', slot: 4, plantId: 'repeater', lane: 1, col: 1, issuedTick: 2094, tick: 2100 },
      { seq: 10, kind: 'plant', slot: 4, plantId: 'repeater', lane: 1, col: 2, issuedTick: 2494, tick: 2500 },
      { seq: 11, kind: 'plant', slot: 4, plantId: 'repeater', lane: 0, col: 1, issuedTick: 2894, tick: 2900 },
      { seq: 12, kind: 'plant', slot: 4, plantId: 'repeater', lane: 2, col: 1, issuedTick: 3294, tick: 3300 },
      { seq: 13, kind: 'plant', slot: 2, plantId: 'bonkchoy', lane: 0, col: 4, issuedTick: 3694, tick: 3700 },
      { seq: 14, kind: 'plant', slot: 2, plantId: 'bonkchoy', lane: 2, col: 4, issuedTick: 4094, tick: 4100 },
      { seq: 15, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 1, col: 5, issuedTick: 4794, tick: 4800 },
      { seq: 16, kind: 'plant', slot: 1, plantId: 'garlic', lane: 2, col: 4, issuedTick: 5394, tick: 5400 },
    ]
  },

  // 3 -> Combo 6: Tridente de Tres Líneas
  {
    code: 'combo6',
    name: 'Combo 6: Tridente de Tres Líneas',
    archetype: 'tridente_tres_lineas',
    deckTemplate: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'threepeater' },
      { slot: 2, plantId: 'tallnut' },
      { slot: 3, plantId: 'squash' },
      { slot: 4, plantId: 'repeater' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 1, col: 3, issuedTick: 654, tick: 660 },
      { seq: 5, kind: 'plant', slot: 1, plantId: 'threepeater', lane: 1, col: 1, issuedTick: 1230, tick: 1236 },
      { seq: 6, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 0, col: 3, issuedTick: 1594, tick: 1600 },
      { seq: 7, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 2, col: 3, issuedTick: 1894, tick: 1900 },
      { seq: 8, kind: 'plant', slot: 1, plantId: 'threepeater', lane: 1, col: 2, issuedTick: 2394, tick: 2400 },
      { seq: 9, kind: 'plant', slot: 3, plantId: 'squash', lane: 1, col: 4, issuedTick: 2894, tick: 2900 },
      { seq: 10, kind: 'plant', slot: 4, plantId: 'repeater', lane: 0, col: 1, issuedTick: 3394, tick: 3400 },
      { seq: 11, kind: 'plant', slot: 4, plantId: 'repeater', lane: 2, col: 1, issuedTick: 3894, tick: 3900 },
      { seq: 12, kind: 'plant', slot: 2, plantId: 'tallnut', lane: 1, col: 4, issuedTick: 4394, tick: 4400 },
      { seq: 13, kind: 'plant', slot: 3, plantId: 'squash', lane: 0, col: 4, issuedTick: 4894, tick: 4900 },
      { seq: 14, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 2, col: 5, issuedTick: 5394, tick: 5400 },
      { seq: 15, kind: 'plant', slot: 3, plantId: 'squash', lane: 2, col: 4, issuedTick: 5794, tick: 5800 },
    ]
  },

  // 4 -> Combo 10: Rush Agresivo de Presión Temprana
  {
    code: 'combo10',
    name: 'Combo 10: Rush Agresivo',
    archetype: 'rush_agresivo',
    deckTemplate: [
      { slot: 0, plantId: 'sunflower' },
      { slot: 1, plantId: 'bonkchoy' },
      { slot: 2, plantId: 'squash' },
      { slot: 3, plantId: 'peashooter' },
      { slot: 4, plantId: 'wallnut' },
      { slot: 5, plantId: 'jalapeno' },
    ],
    actions: [
      { seq: 1, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 1, col: 0, issuedTick: 54, tick: 60 },
      { seq: 2, kind: 'plant', slot: 1, plantId: 'bonkchoy', lane: 1, col: 3, issuedTick: 282, tick: 288 },
      { seq: 3, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 0, col: 0, issuedTick: 510, tick: 516 },
      { seq: 4, kind: 'plant', slot: 2, plantId: 'squash', lane: 1, col: 4, issuedTick: 744, tick: 750 },
      { seq: 5, kind: 'plant', slot: 4, plantId: 'wallnut', lane: 1, col: 4, issuedTick: 1044, tick: 1050 },
      { seq: 6, kind: 'plant', slot: 1, plantId: 'bonkchoy', lane: 0, col: 3, issuedTick: 1344, tick: 1350 },
      { seq: 7, kind: 'plant', slot: 0, plantId: 'sunflower', lane: 2, col: 0, issuedTick: 1644, tick: 1650 },
      { seq: 8, kind: 'plant', slot: 3, plantId: 'peashooter', lane: 1, col: 1, issuedTick: 1944, tick: 1950 },
      { seq: 9, kind: 'plant', slot: 4, plantId: 'wallnut', lane: 0, col: 4, issuedTick: 2244, tick: 2250 },
      { seq: 10, kind: 'plant', slot: 1, plantId: 'bonkchoy', lane: 2, col: 3, issuedTick: 2544, tick: 2550 },
      { seq: 11, kind: 'plant', slot: 2, plantId: 'squash', lane: 0, col: 5, issuedTick: 2894, tick: 2900 },
      { seq: 12, kind: 'plant', slot: 3, plantId: 'peashooter', lane: 0, col: 1, issuedTick: 3294, tick: 3300 },
      { seq: 13, kind: 'plant', slot: 3, plantId: 'peashooter', lane: 2, col: 1, issuedTick: 3694, tick: 3700 },
      { seq: 14, kind: 'plant', slot: 4, plantId: 'wallnut', lane: 2, col: 4, issuedTick: 4194, tick: 4200 },
      { seq: 15, kind: 'plant', slot: 2, plantId: 'squash', lane: 2, col: 5, issuedTick: 4694, tick: 4700 },
      { seq: 16, kind: 'plant', slot: 5, plantId: 'jalapeno', lane: 1, col: 5, issuedTick: 5194, tick: 5200 },
    ]
  }
]

// Función para generar el deck con niveles y rolls correspondientes a la arena
function buildDeckForArena(combo, arenaNumber) {
  return combo.deckTemplate.map((item, idx) => {
    let level = 1
    let statRolls = []

    if (arenaNumber === 1) {
      level = 1
      statRolls = []
    } else if (arenaNumber === 2) {
      level = idx % 2 === 0 ? 2 : 1
      statRolls = level === 2 ? ['hp'] : []
    } else if (arenaNumber === 3) {
      level = idx % 2 === 0 ? 3 : 2
      statRolls = level === 3 ? ['damage'] : ['hp']
    } else if (arenaNumber === 4) {
      // Estrictamente Nivel 3 en Arena 4
      level = 3
      statRolls = idx % 2 === 0 ? ['damage'] : ['hp']
    } else if (arenaNumber === 5) {
      // Estrictamente Nivel 3 y Nivel 4 en Arena 5
      level = (idx === 1 || idx === 2 || idx === 3) ? 4 : 3
      statRolls = level === 4 ? ['damage', 'attackSpeed'] : ['hp']
    }

    return {
      slot: item.slot,
      plantId: item.plantId,
      level,
      statRolls
    }
  })
}

export function generateMigrationSql() {
  const sqlLines = []
  sqlLines.push('-- =============================================================================')
  sqlLines.push('-- MIGRACIÓN 197: RECALIBRACIÓN INTEGRAL DE BOTS CON LOS 5 COMBOS ELEGIDOS')
  sqlLines.push('-- Combos: 4 (Sombra Pesado), 3 (Mantequilla + Ajo), 2 (Embudo Ajo), 6 (Tridente), 10 (Rush)')
  sqlLines.push('-- Reglas estrictas: 0 lechugas/minas, 0 carnívoras, Arena 4 nivel 3, Arena 5 niveles 3 y 4.')
  sqlLines.push('-- =============================================================================\n')

  // Creamos una función PL/pgSQL temporal para actualizar todos los bots por arena
  sqlLines.push(`DO $$
DECLARE
  v_row RECORD;
  v_arena INT;
  v_combo_idx INT;
  v_deck JSONB;
  v_actions JSONB;
BEGIN
  FOR v_row IN
    SELECT id, elo_rating, ROW_NUMBER() OVER (ORDER BY elo_rating ASC, id ASC) as seq_id
      FROM public.ranked_async_opponents
  LOOP
    -- Determinar arena
    IF v_row.elo_rating < 1000 THEN
      v_arena := 1;
    ELSIF v_row.elo_rating < 2000 THEN
      v_arena := 2;
    ELSIF v_row.elo_rating < 3000 THEN
      v_arena := 3;
    ELSIF v_row.elo_rating < 4000 THEN
      v_arena := 4;
    ELSE
      v_arena := 5;
    END IF;

    -- Asignar combo rotativo
    v_combo_idx := (v_row.seq_id % 5);
`)

  // Bloques para cada arena y combo
  for (let a = 1; a <= 5; a++) {
    sqlLines.push(`    IF v_arena = ${a} THEN`)
    for (let c = 0; c < 5; c++) {
      const combo = BASE_COMBOS[c]
      const deck = buildDeckForArena(combo, a)
      const deckJson = JSON.stringify(deck).replace(/'/g, "''")
      const actionsJson = JSON.stringify(combo.actions).replace(/'/g, "''")

      sqlLines.push(`      ${c === 0 ? '' : 'ELS'}IF v_combo_idx = ${c} THEN`)
      sqlLines.push(`        v_deck := '${deckJson}'::jsonb;`)
      sqlLines.push(`        v_actions := '${actionsJson}'::jsonb;`)
    }
    sqlLines.push(`      END IF;`)
    sqlLines.push(`    END IF;\n`)
  }

  sqlLines.push(`    -- Actualizar el bot en la tabla autoritativa
    UPDATE public.ranked_async_opponents
       SET deck_snapshot = v_deck,
           actions_snapshot = v_actions,
           protocol_version = 'ranked-async-v1',
           active = TRUE,
           is_active = TRUE,
           updated_at = NOW()
     WHERE id = v_row.id;
  END LOOP;
END $$;\n`)

  sqlLines.push(`-- 2. Asegurar que las salas actualmente jugando reciban los planes actualizados
UPDATE public.ranked_async_room_plans p
   SET actions_snapshot = o.actions_snapshot
  FROM public.ranked_async_opponents o
 WHERE p.async_opponent_id = o.id;\n`)

  return sqlLines.join('\n')
}

// Generar archivo de migración
const sql = generateMigrationSql()
const migrationPath = path.resolve(__dirname, '../supabase/migrations/197-rebalance-arenas-with-combos-4-3-2-6-10.sql')
fs.writeFileSync(migrationPath, sql, 'utf8')
console.log(`✅ Migración 197 generada exitosamente en ${migrationPath} (${Buffer.byteLength(sql)} bytes)`)
