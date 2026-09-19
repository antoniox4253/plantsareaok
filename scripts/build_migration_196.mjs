import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { arenaArchetypes, buildDeterministicArenaPlan } from './generate_competitive_bot_plans.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('Generating verified bot plans for Migration 196...')

const generated = {}
for (const [key, deck] of Object.entries(arenaArchetypes)) {
  const res = buildDeterministicArenaPlan(deck)
  if (res.stats.intentionsDropped > 0) {
    throw new Error(`FATAL: Archetype ${key} has ${res.stats.intentionsDropped} dropped intentions!`)
  }
  generated[key] = {
    deckJson: JSON.stringify(res.deck),
    planJson: JSON.stringify(res.plan),
    plantCount: res.plan.length,
    firstPlantSec: (res.plan[0].issuedTick / 30.3).toFixed(1),
    lastPlantSec: (res.plan[res.plan.length - 1].issuedTick / 30.3).toFixed(1),
  }
  console.log(`✅ ${key}: ${res.plan.length} plants, 0 dropped, range ${generated[key].firstPlantSec}s - ${generated[key].lastPlantSec}s`)
}

// Map named bots to archetypes
const botAssignments = [
  // ── ARENA 5 (4001+ ELO) ──
  { name: 'Dios Primordial', elo: 8600, archetype: 'arena5_devastation' },
  { name: 'Rey del Olimpo', elo: 7800, archetype: 'arena5_devastation' },
  { name: 'Soberano Astral', elo: 7000, archetype: 'arena5_freeze' },
  { name: 'Señor del Eclipse', elo: 6262, archetype: 'arena5_devastation' },
  { name: 'Valkiria Solar', elo: 6232, archetype: 'arena5_firestorm' },
  { name: 'Furia Estelar', elo: 6200, archetype: 'arena5_firestorm' },
  { name: 'Oráculo del Cosmos', elo: 6166, archetype: 'arena5_devastation' },
  { name: 'Guardián Celestial', elo: 5500, archetype: 'arena5_freeze' },
  { name: 'Centinela Estelar', elo: 4895, archetype: 'arena5_firestorm' },
  { name: 'Titán Cósmico', elo: 4800, archetype: 'arena5_devastation' },

  // ── ARENA 4 (3001 - 4000 ELO) ──
  { name: 'Santi_Gamer99', elo: 3822, archetype: 'arena4_artillery' },
  { name: 'Pipe_Crack', elo: 3813, archetype: 'arena4_inferno' },
  { name: 'Agus_Gamer', elo: 3607, archetype: 'arena4_artillery' },
  { name: 'Danix_21', elo: 3450, archetype: 'arena4_inferno' },
  { name: 'DiegoMaster', elo: 3441, archetype: 'arena4_artillery' },
  { name: 'Valen_PvZ', elo: 3357, archetype: 'arena4_inferno' },
  { name: 'Fercho_yt', elo: 3273, archetype: 'arena4_artillery' },
  { name: 'Lucas07', elo: 3162, archetype: 'arena4_inferno' },
  { name: 'Nico_Play', elo: 3142, archetype: 'arena4_artillery' },
  { name: 'Mateo_Pro', elo: 3056, archetype: 'arena4_inferno' },

  // ── ARENA 3 (2001 - 3000 ELO) ──
  { name: 'Agus_Gamer', elo: 2951, archetype: 'arena3_repeater_siege', filter: "display_name = 'Agus_Gamer' AND elo_rating = 2951" },
  { name: 'Pipe_Crack', elo: 2329, archetype: 'arena3_artillery', filter: "display_name = 'Pipe_Crack' AND elo_rating = 2329" },
  { name: 'Valen_PvZ', elo: 2150, archetype: 'arena3_repeater_siege', filter: "display_name = 'Valen_PvZ' AND elo_rating = 2150" },

  // ── ARENA 2 (1601 - 2000 ELO) ──
  { name: 'Mateo_Pro', elo: 1821, archetype: 'arena2_boxer', filter: "display_name = 'Mateo_Pro' AND elo_rating = 1821" },
  { name: 'PetalMaster', elo: 1850, archetype: 'arena2_repeater', filter: "display_name = 'PetalMaster'" },
  { name: 'NovaTitan', elo: 1650, archetype: 'arena2_boxer', filter: "display_name = 'NovaTitan'" },

  // ── ARENA 1 (0 - 1600 ELO) ──
  { name: 'BrambleGuard', elo: 1400, archetype: 'arena1_swarm', filter: "display_name = 'BrambleGuard'" },
  { name: 'Sproutling', elo: 1000, archetype: 'arena1_tactical', filter: "display_name = 'Sproutling'" },
  { name: 'ThornWeaver', elo: 1200, archetype: 'arena1_brawler', filter: "display_name = 'ThornWeaver'" },
]

let sql = `-- Migration 196: Recalibrate Ranked Bots (Zero Dropped Intentions) & Harden Capture Function
-- 1. Actualizar los bots principales de Arena 1 a Arena 5 con planes deterministas verificados (0 intenciones perdidas, 18-28 plantas, cobertura 3/3 líneas, combate activo hasta el segundo 178).
-- 2. Desactivar bots AFK/degradados (< 18 plantas o sin actividad tardía).
-- 3. Blindar capture_ranked_async_opponents_from_room para exigir ganador, duración >= 80s, >= 18 plantas y actividad final.

BEGIN;

-- ── 1. ACTUALIZACIÓN DE BOTS DE REFERENCIA CON PLANES VERIFICADOS ──────────────
`

for (const b of botAssignments) {
  const g = generated[b.archetype]
  const whereClause = b.filter || `display_name = '${b.name}'`
  sql += `
-- Bot: ${b.name} (${b.elo} ELO, Archetype: ${b.archetype}, Plants: ${g.plantCount})
UPDATE public.ranked_async_opponents
   SET rating_snapshot = ${b.elo},
       elo_rating = ${b.elo},
       elo = ${b.elo},
       deck_snapshot = '${g.deckJson}'::jsonb,
       actions_snapshot = '${g.planJson}'::jsonb,
       active = TRUE,
       is_active = TRUE,
       updated_at = NOW()
 WHERE ${whereClause};
`
}

sql += `
-- ── 2. DESACTIVAR BOTS DEGRADADOS / AFK ────────────────────────────────────────
-- Se desactivan los bots que tengan menos de 18 plantas o que no hayan plantado
-- nada después del segundo 120 (tick 3600), erradicando las partidas regaladas.
UPDATE public.ranked_async_opponents
   SET is_active = FALSE,
       active = FALSE,
       updated_at = NOW()
 WHERE is_active = TRUE
   AND (
     jsonb_array_length(actions_snapshot) < 18
     OR NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(actions_snapshot) elem
        WHERE (elem->>'issuedTick')::INTEGER >= 3600
     )
   );

-- ── 3. BLINDAR CAPTURE_RANKED_ASYNC_OPPONENTS_FROM_ROOM ───────────────────────
-- Criterios estrictos para capturar nuevas repeticiones como bots:
-- - Solo se captura al GANADOR de la sala (server_winner_id)
-- - Duración mínima: 2400 tics (80 segundos)
-- - Mínimo 18 plantas desplegadas
-- - Cobertura de al menos 2 líneas distintas
-- - Presencia de al menos 3 plantas atacantes
-- - Actividad en juego tardío (al menos 1 planta en los últimos 30s o después de tick 2400)
CREATE OR REPLACE FUNCTION public.capture_ranked_async_opponents_from_room(p_room_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room RECORD;
  v_p1_plant_count INTEGER := 0;
  v_p2_plant_count INTEGER := 0;
  v_p1_missing_issued INTEGER := 0;
  v_p2_missing_issued INTEGER := 0;
  v_p1_invalid_seq INTEGER := 0;
  v_p2_invalid_seq INTEGER := 0;
  v_p1_distinct_lanes INTEGER := 0;
  v_p2_distinct_lanes INTEGER := 0;
  v_p1_attackers INTEGER := 0;
  v_p2_attackers INTEGER := 0;
  v_p1_late_plants INTEGER := 0;
  v_p2_late_plants INTEGER := 0;
  v_p1_deck_val JSONB;
  v_p2_deck_val JSONB;
  v_p1_plan_val JSONB;
  v_p2_plan_val JSONB;
  v_p1_actions JSONB;
  v_p2_actions JSONB;
  v_p1_rating INTEGER;
  v_p2_rating INTEGER;
  v_duration INTEGER;
  v_existing_opp1 RECORD;
  v_existing_opp2 RECORD;
  v_p1_status TEXT := 'NOT_ELIGIBLE';
  v_p2_status TEXT := 'NOT_ELIGIBLE';
  v_captured_count INTEGER := 0;
  v_existing_count INTEGER := 0;
  v_not_eligible_count INTEGER := 0;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'room_not_found');
  END IF;

  IF v_room.mode <> 'ranked' THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_ranked_mode');
  END IF;

  IF v_room.status NOT IN ('finished', 'liquidated', 'p1_won', 'p2_won') THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'room_not_finished');
  END IF;

  IF v_room.resolution_source IS NULL OR v_room.resolution_source <> 'authoritative_replay' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'reason', 'INVALID_SOURCE_VERIFICATION',
      'details', 'resolutionSource debe ser authoritative_replay'
    );
  END IF;

  IF v_room.verification_payload->>'consistent' IS NULL
     OR v_room.verification_payload->>'consistent' <> 'true' THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'simulation_not_consistent');
  END IF;

  IF v_room.verification_payload->>'illegalCount' IS NULL
     OR (v_room.verification_payload->>'illegalCount') !~ '^\\d+$'
     OR (v_room.verification_payload->>'illegalCount')::INTEGER <> 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'replay_has_illegal_actions');
  END IF;

  -- Duración mínima de 2400 tics (~80s) para evitar partidas abandonadas/surrenders
  IF v_room.verification_payload->>'ticks' IS NULL
     OR (v_room.verification_payload->>'ticks') !~ '^\\d+$'
     OR (v_room.verification_payload->>'ticks')::INTEGER < 2400 THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'duration_too_short');
  END IF;
  v_duration := (v_room.verification_payload->>'ticks')::INTEGER;

  -- ── Evaluación Lado 1 (player1_id) ─────────────────────────────────────────
  -- Solo elegible si player1_id fue el GANADOR de la sala
  IF v_room.server_winner_id IS NOT NULL AND v_room.server_winner_id = v_room.player1_id THEN
    SELECT COUNT(*) INTO v_p1_plant_count
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player1_id AND kind = 'plant';

    SELECT COUNT(*) INTO v_p1_missing_issued
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player1_id AND (issued_tick IS NULL OR issued_tick < 0);

    SELECT COUNT(*) INTO v_p1_invalid_seq
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player1_id AND (seq IS NULL OR seq < 0);

    SELECT COUNT(DISTINCT lane) INTO v_p1_distinct_lanes
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player1_id AND kind = 'plant';

    SELECT COUNT(*) INTO v_p1_attackers
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player1_id AND kind = 'plant'
       AND plant_id NOT IN ('sunflower', 'twinsunflower', 'wallnut', 'tallnut');

    SELECT COUNT(*) INTO v_p1_late_plants
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player1_id AND kind = 'plant'
       AND issued_tick >= (v_duration - 900);

    -- Criterios estrictos de calidad competitiva
    IF v_p1_plant_count >= 18 
       AND v_p1_missing_issued = 0 
       AND v_p1_invalid_seq = 0
       AND v_p1_distinct_lanes >= 2
       AND v_p1_attackers >= 3
       AND v_p1_late_plants >= 1 THEN
      v_p1_deck_val := public._validate_ranked_async_deck(v_room.p1_deck);
      IF (v_p1_deck_val->>'ok')::BOOLEAN = TRUE THEN
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'seq', seq,
            'tick', tick,
            'issuedTick', issued_tick,
            'kind', kind,
            'plantId', plant_id,
            'slot', slot,
            'lane', lane,
            'col', col
          ) ORDER BY issued_tick ASC, seq ASC
        ), '[]'::JSONB)
        INTO v_p1_actions
        FROM public.match_actions
        WHERE room_id = p_room_id AND user_id = v_room.player1_id AND kind IN ('plant', 'dig');

        v_p1_plan_val := public._validate_ranked_async_plan(v_p1_actions);
        IF (v_p1_plan_val->>'ok')::BOOLEAN = TRUE THEN
          SELECT COALESCE(elo_rating, 1000) INTO v_p1_rating
            FROM public.profiles WHERE id = v_room.player1_id;

          SELECT * INTO v_existing_opp1
            FROM public.ranked_async_opponents
           WHERE source_room_id = p_room_id AND source_side = 1;

          IF FOUND THEN
            IF v_existing_opp1.deck_snapshot = v_room.p1_deck
               AND v_existing_opp1.actions_snapshot = v_p1_actions
               AND v_existing_opp1.source_engine_version = v_room.engine_version
               AND v_existing_opp1.protocol_version = 'ranked-async-v1'
               AND v_existing_opp1.source_duration_ticks = v_duration
               AND v_existing_opp1.rating_snapshot = v_p1_rating
            THEN
              v_p1_status := 'IDENTICAL_EXISTING';
            ELSE
              v_p1_status := 'CONFLICT';
            END IF;
          ELSE
            v_p1_status := 'NEW';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ── Evaluación Lado 2 (player2_id) ─────────────────────────────────────────
  -- Solo elegible si player2_id fue el GANADOR de la sala
  IF v_room.server_winner_id IS NOT NULL AND v_room.server_winner_id = v_room.player2_id THEN
    SELECT COUNT(*) INTO v_p2_plant_count
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player2_id AND kind = 'plant';

    SELECT COUNT(*) INTO v_p2_missing_issued
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player2_id AND (issued_tick IS NULL OR issued_tick < 0);

    SELECT COUNT(*) INTO v_p2_invalid_seq
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player2_id AND (seq IS NULL OR seq < 0);

    SELECT COUNT(DISTINCT lane) INTO v_p2_distinct_lanes
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player2_id AND kind = 'plant';

    SELECT COUNT(*) INTO v_p2_attackers
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player2_id AND kind = 'plant'
       AND plant_id NOT IN ('sunflower', 'twinsunflower', 'wallnut', 'tallnut');

    SELECT COUNT(*) INTO v_p2_late_plants
      FROM public.match_actions
     WHERE room_id = p_room_id AND user_id = v_room.player2_id AND kind = 'plant'
       AND issued_tick >= (v_duration - 900);

    -- Criterios estrictos de calidad competitiva
    IF v_p2_plant_count >= 18 
       AND v_p2_missing_issued = 0 
       AND v_p2_invalid_seq = 0
       AND v_p2_distinct_lanes >= 2
       AND v_p2_attackers >= 3
       AND v_p2_late_plants >= 1 THEN
      v_p2_deck_val := public._validate_ranked_async_deck(v_room.p2_deck);
      IF (v_p2_deck_val->>'ok')::BOOLEAN = TRUE THEN
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'seq', seq,
            'tick', tick,
            'issuedTick', issued_tick,
            'kind', kind,
            'plantId', plant_id,
            'slot', slot,
            'lane', lane,
            'col', col
          ) ORDER BY issued_tick ASC, seq ASC
        ), '[]'::JSONB)
        INTO v_p2_actions
        FROM public.match_actions
        WHERE room_id = p_room_id AND user_id = v_room.player2_id AND kind IN ('plant', 'dig');

        v_p2_plan_val := public._validate_ranked_async_plan(v_p2_actions);
        IF (v_p2_plan_val->>'ok')::BOOLEAN = TRUE THEN
          SELECT COALESCE(elo_rating, 1000) INTO v_p2_rating
            FROM public.profiles WHERE id = v_room.player2_id;

          SELECT * INTO v_existing_opp2
            FROM public.ranked_async_opponents
           WHERE source_room_id = p_room_id AND source_side = 2;

          IF FOUND THEN
            IF v_existing_opp2.deck_snapshot = v_room.p2_deck
               AND v_existing_opp2.actions_snapshot = v_p2_actions
               AND v_existing_opp2.source_engine_version = v_room.engine_version
               AND v_existing_opp2.protocol_version = 'ranked-async-v1'
               AND v_existing_opp2.source_duration_ticks = v_duration
               AND v_existing_opp2.rating_snapshot = v_p2_rating
            THEN
              v_p2_status := 'IDENTICAL_EXISTING';
            ELSE
              v_p2_status := 'CONFLICT';
            END IF;
          ELSE
            v_p2_status := 'NEW';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ── COMPROBACIÓN DE CONFLICTOS: All-or-nothing ─────────────────────────────
  IF v_p1_status = 'CONFLICT' OR v_p2_status = 'CONFLICT' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'reason', 'SOURCE_SNAPSHOT_CONFLICT',
      'capturedSides', 0,
      'alreadyExistingSides', 0,
      'notEligibleSides', 0,
      'conflictedSides', (CASE WHEN v_p1_status = 'CONFLICT' THEN 1 ELSE 0 END) + (CASE WHEN v_p2_status = 'CONFLICT' THEN 1 ELSE 0 END),
      'details', 'Conflicto detectado en snapshot existente para la sala fuente. No se realizaron cambios.'
    );
  END IF;

  -- ── FASE 2: ESCRITURA ATÓMICA ──────────────────────────────────────────────
  IF v_p1_status = 'NEW' THEN
    INSERT INTO public.ranked_async_opponents (
      source_room_id,
      source_side,
      rating_snapshot,
      deck_snapshot,
      actions_snapshot,
      source_engine_version,
      protocol_version,
      source_duration_ticks,
      active
    ) VALUES (
      p_room_id,
      1,
      v_p1_rating,
      v_room.p1_deck,
      v_p1_actions,
      v_room.engine_version,
      'ranked-async-v1',
      v_duration,
      TRUE
    );
    v_captured_count := v_captured_count + 1;
  ELSIF v_p1_status = 'IDENTICAL_EXISTING' THEN
    v_existing_count := v_existing_count + 1;
  ELSE
    v_not_eligible_count := v_not_eligible_count + 1;
  END IF;

  IF v_p2_status = 'NEW' THEN
    INSERT INTO public.ranked_async_opponents (
      source_room_id,
      source_side,
      rating_snapshot,
      deck_snapshot,
      actions_snapshot,
      source_engine_version,
      protocol_version,
      source_duration_ticks,
      active
    ) VALUES (
      p_room_id,
      2,
      v_p2_rating,
      v_room.p2_deck,
      v_p2_actions,
      v_room.engine_version,
      'ranked-async-v1',
      v_duration,
      TRUE
    );
    v_captured_count := v_captured_count + 1;
  ELSIF v_p2_status = 'IDENTICAL_EXISTING' THEN
    v_existing_count := v_existing_count + 1;
  ELSE
    v_not_eligible_count := v_not_eligible_count + 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'capturedSides', v_captured_count,
    'alreadyExistingSides', v_existing_count,
    'notEligibleSides', v_not_eligible_count,
    'conflictedSides', 0
  );
END;
$function$;

COMMIT;
`

const outPath = path.resolve(__dirname, '../supabase/migrations/196-recalibrate-and-sanitize-ranked-bots.sql')
fs.writeFileSync(outPath, sql, 'utf8')
console.log(`\n🎉 Successfully written Migration 196 to:\n${outPath}`)
