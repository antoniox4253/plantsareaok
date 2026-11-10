-- =============================================================================
-- MIGRACIÓN 430: CORREGIR BUG DE REEMBOLSO GRATUITO DE ENERGÍA EN enter_matchmaking
--                Y BLINDAR DEDUCCIÓN ATÓMICA + EXPIRACIÓN VIP EN TODAS LAS RPCS
-- =============================================================================
-- Problemas detectados en auditoría de BD en vivo (2026-11-10):
--   1. enter_matchmaking llamaba incondicionalmente a _refund_room_energy(...)
--      ANTES de _settle_if_abandoned(...) en salas pendientes > 30s. Esto
--      provocaba reembolsos de +1 energía gratuita en partidas que sí se
--      liquidaban con victoria/derrota (e incluso doble reembolso +2 cuando
--      la sala se cerraba como abandoned).
--   2. _create_room no validaba COALESCE(energy_current, 0) >= 1 ni reseteaba
--      medianoche UTC al descontar 1 energía en PvP Ranked > 1602 copas.
--   3. _refund_room_energy, check_and_reset_player_energy, enter_matchmaking y
--      claim_ranked_async_opponent evaluaban has_vip_pass sin validar
--      vip_pass_expires_at > NOW().
--
-- Corrección autoritativa:
--   1. Eliminar _refund_room_energy de enter_matchmaking; delegar únicamente
--      a _settle_if_abandoned (que sólo reembolsa si hubo 0 acciones y 0 plantas).
--   2. Blindar idempotencia por sala en _refund_room_energy y no recortar
--      energía comprada por encima del máximo diario.
--   3. Validar vip_pass_expires_at y deducción atómica >= 1 en todas las RPCs.
-- =============================================================================

BEGIN;

-- ── 1. check_and_reset_player_energy: validar expiración VIP ─────────────────
CREATE OR REPLACE FUNCTION public.check_and_reset_player_energy(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_last_reset TIMESTAMPTZ;
  v_flag_vip   BOOLEAN := FALSE;
  v_expires_at TIMESTAMPTZ;
  v_has_vip    BOOLEAN := FALSE;
  v_now        TIMESTAMPTZ := NOW();
  v_now_utc    TIMESTAMPTZ := (NOW() AT TIME ZONE 'utc');
  v_max_energy INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT energy_last_reset_utc, COALESCE(has_vip_pass, FALSE), vip_pass_expires_at
    INTO v_last_reset, v_flag_vip, v_expires_at
    FROM public.profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  v_has_vip := v_flag_vip AND (v_expires_at IS NULL OR v_expires_at > v_now);

  -- Limpiar flag VIP si expiró por fecha
  IF v_flag_vip AND NOT v_has_vip THEN
    UPDATE public.profiles
       SET has_vip_pass = FALSE,
           updated_at = v_now
     WHERE id = p_user_id;
  END IF;

  v_max_energy := CASE WHEN v_has_vip THEN 20 ELSE 15 END;

  -- Si es la primera vez o si ya pasamos la medianoche UTC de ese día
  IF v_last_reset IS NULL OR (date_trunc('day', v_now_utc) > date_trunc('day', v_last_reset AT TIME ZONE 'utc')) THEN
    UPDATE public.profiles
       SET energy_current = v_max_energy,
           energy_last_reset_utc = v_now_utc
     WHERE id = p_user_id;
  END IF;
END;
$function$;


-- ── 2. _refund_room_energy: idempotente por sala + expiración VIP + respeta recargas compradas ──
CREATE OR REPLACE FUNCTION public._refund_room_energy(p_room_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room RECORD;
  v_tag  TEXT;
  v_desc TEXT;
BEGIN
  IF p_room_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_room.mode <> 'ranked' THEN RETURN; END IF;

  v_tag := '[room:' || p_room_id::text || ']';
  v_desc := COALESCE(p_reason, 'Reembolso de energía por partida no liquidada') || ' ' || v_tag;

  IF v_room.player1_id IS NOT NULL THEN
    -- Idempotencia estricta: nunca reembolsar dos veces por la misma sala
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t
       WHERE t.user_id = v_room.player1_id
         AND t.type = 'energy_refund'
         AND t.description LIKE '%' || v_tag || '%'
    ) THEN
      UPDATE public.profiles p
         SET energy_current = LEAST(
               GREATEST(
                 COALESCE(p.energy_current, 0),
                 CASE
                   WHEN COALESCE(p.has_vip_pass, FALSE) AND (p.vip_pass_expires_at IS NULL OR p.vip_pass_expires_at > NOW())
                   THEN 20 ELSE 15
                 END
               ),
               COALESCE(p.energy_current, 0) + 1
             ),
             updated_at = NOW()
       WHERE p.id = v_room.player1_id
         AND COALESCE(p.elo_rating, 1000) > 1602;

      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      SELECT p.id, 'energy_refund', 0, v_desc, 'completed'
        FROM public.profiles p
       WHERE p.id = v_room.player1_id
         AND COALESCE(p.elo_rating, 1000) > 1602;
    END IF;
  END IF;

  IF v_room.player2_id IS NOT NULL AND COALESCE(v_room.is_async_match, FALSE) = FALSE THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t
       WHERE t.user_id = v_room.player2_id
         AND t.type = 'energy_refund'
         AND t.description LIKE '%' || v_tag || '%'
    ) THEN
      UPDATE public.profiles p
         SET energy_current = LEAST(
               GREATEST(
                 COALESCE(p.energy_current, 0),
                 CASE
                   WHEN COALESCE(p.has_vip_pass, FALSE) AND (p.vip_pass_expires_at IS NULL OR p.vip_pass_expires_at > NOW())
                   THEN 20 ELSE 15
                 END
               ),
               COALESCE(p.energy_current, 0) + 1
             ),
             updated_at = NOW()
       WHERE p.id = v_room.player2_id
         AND COALESCE(p.elo_rating, 1000) > 1602;

      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      SELECT p.id, 'energy_refund', 0, v_desc, 'completed'
        FROM public.profiles p
       WHERE p.id = v_room.player2_id
         AND COALESCE(p.elo_rating, 1000) > 1602;
    END IF;
  END IF;
END;
$function$;


-- ── 3. _create_room (5 args): deducción atómica >= 1 con reset diario y orden anti-deadlock ──
CREATE OR REPLACE FUNCTION public._create_room(p_mode text, p_p1 uuid, p_p2 uuid, p_bet numeric DEFAULT 0, p_tournament_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room          UUID;
  v_seed          BIGINT;
  v_cuenta        INTEGER;
  v_p1_deck       JSONB;
  v_p2_deck       JSONB;
  v_now           TIMESTAMPTZ := NOW();
  v_p1_tree_level INTEGER := 0;
  v_p2_tree_level INTEGER := 0;
  v_p1_tree_skin  TEXT := NULL;
  v_p2_tree_skin  TEXT := NULL;
  v_p1_elo        INTEGER := 1000;
  v_p2_elo        INTEGER := 1000;
  v_first_uid     UUID;
  v_second_uid    UUID;
BEGIN
  IF p_p1 IS NULL OR p_p2 IS NULL THEN
    RAISE EXCEPTION 'p_p1 y p_p2 son requeridos';
  END IF;

  IF COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_p1), FALSE)
     OR COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_p2), FALSE) THEN
    RETURN NULL;
  END IF;

  -- Orden determinístico de bloqueo para evitar deadlocks entre pares concurrentes
  v_first_uid := LEAST(p_p1, p_p2);
  v_second_uid := GREATEST(p_p1, p_p2);

  IF p_mode = 'ranked' THEN
    PERFORM public.check_and_reset_player_energy(v_first_uid);
    IF v_second_uid <> v_first_uid THEN
      PERFORM public.check_and_reset_player_energy(v_second_uid);
    END IF;
  END IF;

  v_room := gen_random_uuid();
  v_seed := 1 + floor(random() * 2147483646)::BIGINT;

  IF p_mode = 'tournament' AND p_tournament_id IS NOT NULL THEN
    v_p1_deck := public._resolve_tournament_deck(p_p1, p_tournament_id);
    v_p2_deck := public._resolve_tournament_deck(p_p2, p_tournament_id);

    SELECT
      COALESCE(pr1.tree_level, 0), COALESCE(pr2.tree_level, 0),
      pr1.equipped_tree_skin, pr2.equipped_tree_skin,
      COALESCE(pr1.elo_rating, 1000), COALESCE(pr2.elo_rating, 1000)
    INTO
      v_p1_tree_level, v_p2_tree_level,
      v_p1_tree_skin, v_p2_tree_skin,
      v_p1_elo, v_p2_elo
    FROM public.profiles pr1
    LEFT JOIN public.profiles pr2 ON pr2.id = p_p2
    WHERE pr1.id = p_p1;
  ELSE
    v_p1_deck := public._active_deck(p_p1);
    v_p2_deck := public._active_deck(p_p2);

    SELECT
      COALESCE(pr1.tree_level, 0), COALESCE(pr2.tree_level, 0),
      pr1.equipped_tree_skin, pr2.equipped_tree_skin,
      COALESCE(pr1.elo_rating, 1000), COALESCE(pr2.elo_rating, 1000)
    INTO
      v_p1_tree_level, v_p2_tree_level,
      v_p1_tree_skin, v_p2_tree_skin,
      v_p1_elo, v_p2_elo
    FROM public.profiles pr1
    LEFT JOIN public.profiles pr2 ON pr2.id = p_p2
    WHERE pr1.id = p_p1;
  END IF;

  SELECT COUNT(*) INTO v_cuenta
    FROM jsonb_array_elements(COALESCE(v_p1_deck, '[]'::jsonb));
  IF v_cuenta < 3 THEN
    RAISE EXCEPTION 'El mazo de P1 tiene % cartas, se requieren al menos 3', v_cuenta;
  END IF;

  SELECT COUNT(*) INTO v_cuenta
    FROM jsonb_array_elements(COALESCE(v_p2_deck, '[]'::jsonb));
  IF v_cuenta < 3 THEN
    RAISE EXCEPTION 'El mazo de P2 tiene % cartas, se requieren al menos 3', v_cuenta;
  END IF;

  -- Descuento atómico obligatorio de 1 energía para Ranked > 1602 copas (en orden determinístico)
  IF p_mode = 'ranked' THEN
    IF v_first_uid = p_p1 AND v_p1_elo > 1602 THEN
      UPDATE public.profiles
         SET energy_current = energy_current - 1,
             updated_at = v_now
       WHERE id = p_p1
         AND COALESCE(energy_current, 0) >= 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'sin_energia_p1';
      END IF;
    ELSIF v_first_uid = p_p2 AND v_p2_elo > 1602 THEN
      UPDATE public.profiles
         SET energy_current = energy_current - 1,
             updated_at = v_now
       WHERE id = p_p2
         AND COALESCE(energy_current, 0) >= 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'sin_energia_p2';
      END IF;
    END IF;

    IF v_second_uid <> v_first_uid THEN
      IF v_second_uid = p_p1 AND v_p1_elo > 1602 THEN
        UPDATE public.profiles
           SET energy_current = energy_current - 1,
               updated_at = v_now
         WHERE id = p_p1
           AND COALESCE(energy_current, 0) >= 1;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'sin_energia_p1';
        END IF;
      ELSIF v_second_uid = p_p2 AND v_p2_elo > 1602 THEN
        UPDATE public.profiles
           SET energy_current = energy_current - 1,
               updated_at = v_now
         WHERE id = p_p2
           AND COALESCE(energy_current, 0) >= 1;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'sin_energia_p2';
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.game_rooms (
    id, mode, player1_id, player2_id, colosseum_bet, tournament_id,
    seed, status, p1_deck, p2_deck, created_at, started_at, engine_version,
    user_elo, elo_rating, p1_tree_level, p2_tree_level, p1_tree_skin, p2_tree_skin
  ) VALUES (
    v_room, p_mode, p_p1, p_p2, COALESCE(p_bet, 0), p_tournament_id,
    v_seed, 'playing', v_p1_deck, v_p2_deck, v_now, v_now, 'auth-v2',
    v_p1_elo, v_p2_elo, v_p1_tree_level, v_p2_tree_level, v_p1_tree_skin, v_p2_tree_skin
  );

  IF p_mode = 'ranked' AND v_p1_elo > 1602 THEN
    BEGIN
      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      VALUES (p_p1, 'energy_spend', 0, 'Consumo de 1 energía para partida Ranked PvP', 'completed');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF p_mode = 'ranked' AND v_p2_elo > 1602 THEN
    BEGIN
      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      VALUES (p_p2, 'energy_spend', 0, 'Consumo de 1 energía para partida Ranked PvP', 'completed');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_room;
END;
$function$;


-- ── 4. claim_ranked_async_opponent: expiración VIP + deducción atómica >= 1 ──
CREATE OR REPLACE FUNCTION public.claim_ranked_async_opponent()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid               UUID := auth.uid();
  v_queue             RECORD;
  v_user_prof         RECORD;
  v_player_elo        INTEGER := 1000;
  v_player_deck       JSONB;
  v_cur_en            INTEGER;
  v_max_en            INTEGER;
  v_is_vip            BOOLEAN := FALSE;
  v_now               TIMESTAMPTZ := NOW();
  v_existing_is_async BOOLEAN;
  v_human_room        UUID;
  v_ghost_timeout     INTEGER := 30;
  v_waited            INTEGER := 0;
  v_is_bot_only       BOOLEAN := FALSE;

  v_cand_id           UUID := NULL;
  v_cand_deck         JSONB := NULL;
  v_cand_plan         JSONB := NULL;
  v_cand_name         TEXT := NULL;
  v_cand_avatar       TEXT := NULL;
  v_candidate_elo     INTEGER := 1000;
  v_cand_tree_level   INTEGER := 0;
  v_cand_row          RECORD;
  v_cand_deck_val     JSONB;
  v_cand_plan_val     JSONB;

  v_recent            UUID[];
  v_new_seed          BIGINT;
  v_new_room_id       UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT *
    INTO v_queue
    FROM public.matchmaking_queue
   WHERE user_id = v_uid
     AND mode = 'ranked'
     AND tournament_id IS NULL
     AND status IN ('waiting', 'searching', 'matched')
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', FALSE, 'error', 'no_en_cola');
  END IF;

  IF v_queue.mode <> 'ranked' THEN
    RETURN jsonb_build_object(
      'matched', FALSE,
      'error', 'modo_no_soporta_semilla',
      'message', 'En torneos y coliseo sólo se admiten jugadores reales. Cero bots.'
    );
  END IF;

  IF v_queue.status = 'matched' AND v_queue.matched_room_id IS NOT NULL THEN
    SELECT is_async_match INTO v_existing_is_async
      FROM public.game_rooms
     WHERE id = v_queue.matched_room_id
       AND status = 'playing'
       AND settled_at IS NULL;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'matched', TRUE,
        'roomId', v_queue.matched_room_id,
        'isAsyncMatch', COALESCE(v_existing_is_async, TRUE)
      );
    ELSE
      UPDATE public.matchmaking_queue
         SET status = 'searching', matched_room_id = NULL, updated_at = v_now
       WHERE id = v_queue.id;
    END IF;
  END IF;

  IF v_queue.client_engine_version IS NULL OR v_queue.client_engine_version <> 'auth-v2' THEN
    RETURN jsonb_build_object(
      'matched', FALSE,
      'error', 'client_update_required',
      'message', 'Se requiere actualizar el juego para emparejar con un Rival Semilla.'
    );
  END IF;

  SELECT COALESCE(is_bot_only, FALSE) INTO v_is_bot_only
    FROM public.profiles
   WHERE id = v_uid;

  IF v_uid = 'f3fc7e3f-9eeb-45f6-90a2-7c6203a09daf'::uuid OR v_is_bot_only IS TRUE THEN
    v_ghost_timeout := 0;
  ELSE
    BEGIN
      SELECT COALESCE(MAX(CASE WHEN key = 'mm_ranked_ghost_after_seconds' THEN value::INTEGER END), 30)
        INTO v_ghost_timeout
        FROM public.shop_config;
    EXCEPTION WHEN OTHERS THEN
      v_ghost_timeout := 30;
    END;
  END IF;

  v_waited := EXTRACT(EPOCH FROM (v_now - v_queue.created_at))::INTEGER;
  IF v_ghost_timeout > 0 AND v_waited < GREATEST(0, v_ghost_timeout - 2) THEN
    RETURN jsonb_build_object(
      'matched', FALSE,
      'error', 'tiempo_insuficiente',
      'segundos_restantes', GREATEST(0, v_ghost_timeout - v_waited)
    );
  END IF;

  -- Prioridad Humana Absoluta
  BEGIN
    v_human_room := public._try_match(v_uid);
  EXCEPTION WHEN OTHERS THEN
    v_human_room := NULL;
  END;

  IF v_human_room IS NOT NULL THEN
    RETURN jsonb_build_object(
      'matched', TRUE,
      'roomId', v_human_room,
      'isAsyncMatch', FALSE
    );
  END IF;

  -- Control de energía (SÓLO para jugadores con ELO > 1602; ELO <= 1602 tiene vidas infinitas)
  SELECT elo_rating, energy_current, energy_last_reset_utc, has_vip_pass, vip_pass_expires_at,
         COALESCE(tree_level, 0) AS tree_level, equipped_tree_skin
    INTO v_user_prof
    FROM public.profiles
   WHERE id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  v_player_elo := COALESCE(v_user_prof.elo_rating, 1000);
  v_is_vip := COALESCE(v_user_prof.has_vip_pass, FALSE)
              AND (v_user_prof.vip_pass_expires_at IS NULL OR v_user_prof.vip_pass_expires_at > v_now);

  IF COALESCE(v_user_prof.has_vip_pass, FALSE) AND NOT v_is_vip THEN
    UPDATE public.profiles SET has_vip_pass = FALSE, updated_at = v_now WHERE id = v_uid;
  END IF;

  v_max_en := CASE WHEN v_is_vip THEN 20 ELSE 15 END;

  IF v_user_prof.energy_last_reset_utc IS NULL
     OR v_user_prof.energy_current IS NULL
     OR (DATE_TRUNC('day', v_now AT TIME ZONE 'UTC') > DATE_TRUNC('day', v_user_prof.energy_last_reset_utc AT TIME ZONE 'UTC')) THEN
    v_cur_en := v_max_en;
    UPDATE public.profiles
       SET energy_current = v_max_en,
           energy_last_reset_utc = v_now,
           updated_at = v_now
     WHERE id = v_uid;
  ELSE
    v_cur_en := v_user_prof.energy_current;
  END IF;

  IF v_player_elo > 1602 AND COALESCE(v_cur_en, 0) < 1 THEN
    RETURN jsonb_build_object(
      'matched', FALSE,
      'error', 'sin_energia',
      'message', 'Has agotado tus energías diarias de Ranked. Se recargan a las 00:00 UTC o puedes recargar ahora en la Tienda.'
    );
  END IF;

  v_player_deck := public._active_deck(v_uid);

  IF v_player_deck IS NULL OR jsonb_array_length(v_player_deck) < 3 THEN
    RETURN jsonb_build_object(
      'matched', FALSE,
      'error', 'mazo_invalido',
      'message', 'Debes configurar al menos 3 plantas en tu mazo activo para jugar.'
    );
  END IF;

  SELECT ARRAY(
    SELECT async_opponent_id
      FROM public.game_rooms
     WHERE player1_id = v_uid
       AND is_async_match IS TRUE
       AND async_opponent_id IS NOT NULL
       AND created_at > v_now - INTERVAL '3 hours'
  ) INTO v_recent;

  FOR v_cand_row IN
    SELECT *
      FROM public.ranked_async_opponents
     WHERE is_active IS TRUE
       AND (v_recent IS NULL OR id <> ALL(v_recent))
     ORDER BY ABS(elo_rating - v_player_elo) ASC, usage_count ASC, RANDOM()
     LIMIT 5
  LOOP
    v_cand_deck_val := v_cand_row.deck_snapshot;
    v_cand_plan_val := v_cand_row.actions_snapshot;

    IF v_cand_deck_val IS NOT NULL AND jsonb_array_length(v_cand_deck_val) >= 3 THEN
      v_cand_id         := v_cand_row.id;
      v_cand_deck       := v_cand_deck_val;
      v_cand_plan       := v_cand_plan_val;
      v_cand_name       := v_cand_row.display_name;
      v_cand_avatar     := v_cand_row.avatar_id;
      v_candidate_elo   := v_cand_row.elo_rating;
      v_cand_tree_level := COALESCE(v_cand_row.tree_level, 0);
      EXIT;
    END IF;
  END LOOP;

  IF v_cand_id IS NULL THEN
    FOR v_cand_row IN
      SELECT *
        FROM public.ranked_async_opponents
       WHERE is_active IS TRUE
       ORDER BY ABS(elo_rating - v_player_elo) ASC, usage_count ASC, RANDOM()
       LIMIT 5
    LOOP
      v_cand_deck_val := v_cand_row.deck_snapshot;
      v_cand_plan_val := v_cand_row.actions_snapshot;

      IF v_cand_deck_val IS NOT NULL AND jsonb_array_length(v_cand_deck_val) >= 3 THEN
        v_cand_id         := v_cand_row.id;
        v_cand_deck       := v_cand_deck_val;
        v_cand_plan       := v_cand_plan_val;
        v_cand_name       := v_cand_row.display_name;
        v_cand_avatar     := v_cand_row.avatar_id;
        v_candidate_elo   := v_cand_row.elo_rating;
        v_cand_tree_level := COALESCE(v_cand_row.tree_level, 0);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_cand_id IS NULL THEN
    RETURN jsonb_build_object('matched', FALSE, 'error', 'no_seed_available');
  END IF;

  -- Deducción atómica obligatoria de 1 energía ANTES de crear sala (ELO > 1602)
  IF v_player_elo > 1602 THEN
    UPDATE public.profiles
       SET energy_current = energy_current - 1,
           updated_at = v_now
     WHERE id = v_uid
       AND COALESCE(energy_current, 0) >= 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'matched', FALSE,
        'error', 'sin_energia',
        'message', 'Has agotado tus energías diarias de Ranked. Se recargan a las 00:00 UTC o puedes recargar ahora en la Tienda.'
      );
    END IF;
  END IF;

  v_new_seed := 1 + floor(random() * 2147483646)::BIGINT;
  v_new_room_id := gen_random_uuid();

  INSERT INTO public.game_rooms (
    id, mode, player1_id, player2_id, seed, status, p1_deck, p2_deck,
    created_at, started_at, engine_version, is_async_match,
    async_opponent_id, seed_opponent_id, async_display_name, async_player_name,
    async_avatar_id, async_player_avatar, async_rating_snapshot, async_player_elo,
    async_deck_snapshot, user_elo, elo_rating, p1_tree_level, p2_tree_level,
    p1_tree_skin, p2_tree_skin
  ) VALUES (
    v_new_room_id, 'ranked', v_uid, NULL, v_new_seed, 'playing', v_player_deck, v_cand_deck,
    v_now, v_now, 'auth-v2', TRUE,
    v_cand_id, v_cand_id, v_cand_name, v_cand_name,
    v_cand_avatar, v_cand_avatar, v_candidate_elo, v_candidate_elo,
    v_cand_deck, v_player_elo, v_player_elo, COALESCE(v_user_prof.tree_level, 0), v_cand_tree_level,
    v_user_prof.equipped_tree_skin, NULL
  );

  BEGIN
    INSERT INTO public.ranked_async_room_plans (
      room_id, async_opponent_id, actions_snapshot, protocol_version, created_at
    ) VALUES (
      v_new_room_id, v_cand_id, COALESCE(v_cand_plan, '[]'::jsonb), 'ranked-async-v1', v_now
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF v_player_elo > 1602 THEN
    BEGIN
      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      VALUES (v_uid, 'energy_spend', 0, 'Consumo de 1 energía para partida Ranked (Rival Semilla)', 'completed');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  UPDATE public.matchmaking_queue
     SET status = 'matched',
         matched_room_id = v_new_room_id,
         updated_at = v_now
   WHERE id = v_queue.id;

  UPDATE public.ranked_async_opponents
     SET usage_count = COALESCE(usage_count, 0) + 1,
         last_used_at = v_now
   WHERE id = v_cand_id;

  RETURN jsonb_build_object(
    'matched', TRUE,
    'roomId', v_new_room_id,
    'isAsyncMatch', TRUE
  );
END;
$function$;


-- ── 5. enter_matchmaking: ELIMINAR reembolso prematuro _refund_room_energy + validar VIP ──
CREATE OR REPLACE FUNCTION public.enter_matchmaking(
  p_mode text,
  p_bet numeric DEFAULT 0,
  p_use_ticket boolean DEFAULT false,
  p_room_code text DEFAULT NULL::text,
  p_engine_version text DEFAULT 'auth-v2'::text,
  p_tournament_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid                      UUID := auth.uid();
  v_elo                      INTEGER := 1000;
  v_now                      TIMESTAMPTZ := NOW();
  v_room_record              RECORD;
  v_is_bot_only              BOOLEAN := FALSE;
  v_is_banned                BOOLEAN := FALSE;
  v_ban_reason               TEXT := NULL;
  v_unban_at                 TIMESTAMPTZ := NULL;
  v_lockout_seconds          INTEGER := 0;
  v_client_version           TEXT := COALESCE(p_engine_version, 'auth-v2');
  v_tournament_id            UUID := p_tournament_id;
  v_tourn                    RECORD;
  v_tourn_part               RECORD;
  v_user_prof                RECORD;
  v_is_new_day               BOOLEAN := FALSE;
  v_is_vip                   BOOLEAN := FALSE;
  v_max_en                   INTEGER := 15;
  v_cur_en                   INTEGER := 15;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_mode NOT IN ('ranked', 'friendly', 'tournament') THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'mode_deprecated',
      'message', 'El modo ' || COALESCE(p_mode, '') || ' ya no está disponible. Modos activos: Ranked, Arena Ads y Torneos.'
    );
  END IF;

  SELECT is_banned, ban_reason, unban_at, is_bot_only, elo_rating,
         energy_current, energy_last_reset_utc, has_vip_pass, vip_pass_expires_at
    INTO v_user_prof
    FROM public.profiles
   WHERE id = v_uid;

  v_is_banned := COALESCE(v_user_prof.is_banned, FALSE);
  v_ban_reason := v_user_prof.ban_reason;
  v_unban_at := v_user_prof.unban_at;
  v_is_bot_only := COALESCE(v_user_prof.is_bot_only, FALSE);
  v_elo := COALESCE(v_user_prof.elo_rating, 1000);

  IF v_is_banned = TRUE THEN
    IF v_unban_at IS NOT NULL AND v_unban_at <= v_now THEN
      UPDATE public.profiles
         SET is_banned = FALSE,
             ban_reason = NULL,
             unban_at = NULL,
             matchmaking_banned_until = NULL,
             updated_at = v_now
       WHERE id = v_uid;
    ELSE
      v_lockout_seconds := CASE
        WHEN v_unban_at IS NOT NULL AND v_unban_at > v_now THEN
          GREATEST(1, EXTRACT(EPOCH FROM (v_unban_at - v_now))::INTEGER)
        ELSE 0
      END;
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'account_banned',
        'banReason', COALESCE(v_ban_reason, 'Esta cuenta ha sido suspendida permanentemente.'),
        'lockoutSeconds', v_lockout_seconds,
        'message', COALESCE(v_ban_reason, 'Esta cuenta ha sido suspendida permanentemente.')
      );
    END IF;
  END IF;

  IF v_is_bot_only = TRUE THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'bot_restricted',
      'message', 'Las cuentas de prueba o bot no pueden ingresar al matchmaking global.'
    );
  END IF;

  IF v_client_version <> 'auth-v2' THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'client_update_required',
      'message', 'Se requiere actualizar el juego para buscar partida (versión desactualizada).'
    );
  END IF;

  IF p_mode = 'tournament' THEN
    IF v_tournament_id IS NULL AND p_room_code IS NOT NULL AND p_room_code ~* '^[0-9a-f\-]{36}$' THEN
      v_tournament_id := p_room_code::UUID;
    END IF;

    IF v_tournament_id IS NULL THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'missing_tournament_id',
        'message', 'Debes especificar el identificador del torneo.'
      );
    END IF;

    SELECT * INTO v_tourn FROM public.tournaments WHERE id = v_tournament_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'tournament_not_found',
        'message', 'Torneo no encontrado.'
      );
    END IF;

    IF v_tourn.status = 'scheduled' AND v_now >= v_tourn.start_time AND v_now < v_tourn.end_time THEN
      UPDATE public.tournaments SET status = 'live', updated_at = v_now WHERE id = v_tournament_id;
      v_tourn.status := 'live';
    END IF;

    IF v_now >= v_tourn.end_time OR v_tourn.status = 'ended' THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'tournament_ended',
        'message', 'El torneo ya ha finalizado.'
      );
    END IF;

    IF v_tourn.status NOT IN ('live', 'active') THEN
      IF v_now < v_tourn.start_time THEN
        RETURN jsonb_build_object(
          'matched', FALSE, 'searching', FALSE,
          'error', 'tournament_not_started',
          'message', 'El torneo aún no ha comenzado.'
        );
      ELSE
        RETURN jsonb_build_object(
          'matched', FALSE, 'searching', FALSE,
          'error', 'tournament_not_active',
          'message', 'El torneo no está activo en este momento.'
        );
      END IF;
    END IF;

    SELECT * INTO v_tourn_part
      FROM public.tournament_participants
     WHERE tournament_id = v_tournament_id AND user_id = v_uid;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'not_registered_in_tournament',
        'message', 'No estás inscrito en este torneo.'
      );
    END IF;

    IF v_tourn_part.is_eliminated OR v_tourn_part.losses >= COALESCE(v_tourn.max_losses, 3) THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'tournament_eliminated',
        'message', 'Has sido eliminado del torneo (0 vidas restantes).'
      );
    END IF;
  ELSE
    v_tournament_id := NULL;
  END IF;

  -- Gatekeeper autoritativo de energía en Ranked > 1602 copas
  IF p_mode = 'ranked' AND v_elo > 1602 THEN
    v_is_vip := COALESCE(v_user_prof.has_vip_pass, FALSE)
                AND (v_user_prof.vip_pass_expires_at IS NULL OR v_user_prof.vip_pass_expires_at > v_now);

    IF COALESCE(v_user_prof.has_vip_pass, FALSE) AND NOT v_is_vip THEN
      UPDATE public.profiles SET has_vip_pass = FALSE, updated_at = v_now WHERE id = v_uid;
    END IF;

    v_is_new_day := (v_user_prof.energy_last_reset_utc IS NULL OR
                     DATE_TRUNC('day', v_user_prof.energy_last_reset_utc AT TIME ZONE 'UTC') < DATE_TRUNC('day', v_now AT TIME ZONE 'UTC'));

    v_max_en := CASE WHEN v_is_vip THEN 20 ELSE 15 END;

    IF v_is_new_day THEN
      v_cur_en := v_max_en;
      UPDATE public.profiles
         SET energy_current = v_cur_en,
             energy_last_reset_utc = v_now,
             updated_at = v_now
       WHERE id = v_uid;
    ELSE
      v_cur_en := COALESCE(v_user_prof.energy_current, v_max_en);
    END IF;

    IF v_cur_en < 1 THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'sin_energia',
        'message', 'No tienes suficiente energía para jugar en Ranked competitivo.'
      );
    END IF;
  END IF;

  -- Limpieza de búsquedas previas en cola
  UPDATE public.matchmaking_queue
     SET status = 'cancelled', updated_at = v_now
   WHERE user_id = v_uid
     AND status IN ('searching', 'waiting', 'matched');

  -- Resolución de salas previas pendientes:
  -- IMPORTANTE: NO llamar a _refund_room_energy antes de _settle_if_abandoned.
  -- _settle_if_abandoned decide autoritativamente ganador/perdedor si hubo combate,
  -- y SÓLO reembolsa si la sala abortó con 0 acciones y 0 plantas de ambos lados.
  FOR v_room_record IN
    SELECT id, mode, tournament_id, created_at, status, is_async_match, player1_id, player2_id,
           p1_reported_winner, p2_reported_winner
      FROM public.game_rooms
     WHERE (player1_id = v_uid OR player2_id = v_uid)
       AND status = 'playing'
       AND settled_at IS NULL
     ORDER BY created_at ASC
  LOOP
    IF v_room_record.created_at < v_now - INTERVAL '30 seconds' THEN
      PERFORM public._settle_if_abandoned(v_room_record.id);
    ELSE
      RETURN jsonb_build_object(
        'matched', TRUE,
        'roomId', v_room_record.id,
        'searching', FALSE,
        'resumed', TRUE
      );
    END IF;
  END LOOP;

  -- Encolar en matchmaking_queue
  INSERT INTO public.matchmaking_queue (
    user_id, mode, elo_rating, user_elo, elo, status, colosseum_bet, tournament_id, room_code, client_engine_version, created_at, updated_at, last_seen_at
  ) VALUES (
    v_uid, p_mode, v_elo, v_elo, v_elo, 'searching', p_bet, v_tournament_id, p_room_code, p_engine_version, v_now, v_now, v_now
  );

  PERFORM public._emparejar_lote(p_mode, p_bet, p_room_code, v_tournament_id);

  SELECT matched_room_id INTO v_room_record
    FROM public.matchmaking_queue
   WHERE user_id = v_uid AND status = 'matched'
   ORDER BY updated_at DESC LIMIT 1;

  IF v_room_record.matched_room_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'matched', TRUE,
      'roomId', v_room_record.matched_room_id,
      'searching', FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'matched', FALSE,
    'searching', TRUE
  );
END;
$function$;


INSERT INTO public._migration_audit (fase, detalle)
VALUES (
  '430-fix-enter-matchmaking-energy-refund-bug-and-vip-expiry',
  jsonb_build_object(
    'removed_premature_refund_in_enter_matchmaking', true,
    'enforced_atomic_energy_deduction', ARRAY['_create_room', 'claim_ranked_async_opponent'],
    'enforced_idempotent_refund_and_vip_expiry', ARRAY['_refund_room_energy', 'check_and_reset_player_energy', 'enter_matchmaking', 'claim_ranked_async_opponent']
  )
);

COMMIT;
