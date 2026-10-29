-- ============================================================================
-- Migration 374: Corrección Integral de Matchmaking y Motor de Combate para Torneos
-- 
-- Problemas resueltos:
-- 1. enter_matchmaking validaba v_tourn.status <> 'active', pero los torneos activos
--    en la plataforma tienen status = 'live'. Esto provocaba que el matchmaking rechazara
--    a los jugadores con el error 'tournament_not_active'. Se admite 'live' y 'active',
--    y se realiza la transición automática de 'scheduled' a 'live' si llegó start_time.
-- 2. _create_room ahora recibe p_tournament_id explícito y _emparejar_lote lo propaga,
--    garantizando que game_rooms.tournament_id nunca quede en NULL.
-- 3. _settle_room en modo tournament registraba la partida en tournament_matches pero
--    NUNCA actualizaba tournament_participants.wins ni tournament_participants.losses.
--    Ahora actualiza atómicamente victorias, derrotas, vidas restantes y eliminación.
-- 4. reenter_tournament ahora actualiza también lives_remaining = 2 para consistencia.
-- ============================================================================

-- 1. _create_room con soporte explícito de p_tournament_id
CREATE OR REPLACE FUNCTION public._create_room(
  p_mode text,
  p_p1 uuid,
  p_p2 uuid,
  p_bet numeric DEFAULT 0,
  p_tournament_id uuid DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room          UUID;
  v_seed          BIGINT;
  v_cuenta        INTEGER;
  v_tournament_id UUID := p_tournament_id;
  v_p1_deck       JSONB;
  v_p2_deck       JSONB;
  v_p1_tree_level INTEGER := 0;
  v_p2_tree_level INTEGER := 0;
  v_p1_tree_skin  TEXT := NULL;
  v_p2_tree_skin  TEXT := NULL;
  v_p1_elo        INTEGER := 1000;
  v_p2_elo        INTEGER := 1000;
BEGIN
  IF COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_p1), FALSE) IS TRUE
     OR COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_p2), FALSE) IS TRUE THEN
    RAISE EXCEPTION 'Usuario bot-only no puede ser emparejado en salas humanas.';
  END IF;

  v_seed := 1 + floor(random() * 2147483646)::BIGINT;

  SELECT COALESCE(value::INTEGER, 3) INTO v_cuenta
    FROM public.shop_config WHERE key = 'mm_cuenta_atras_segundos';
  v_cuenta := GREATEST(1, COALESCE(v_cuenta, 3));

  IF p_mode = 'tournament' THEN
    IF v_tournament_id IS NULL THEN
      SELECT tournament_id INTO v_tournament_id
        FROM public.matchmaking_queue
       WHERE user_id IN (p_p1, p_p2)
         AND mode = 'tournament'
         AND tournament_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1;
    END IF;

    IF v_tournament_id IS NOT NULL THEN
      v_p1_deck := public._resolve_tournament_deck(p_p1, v_tournament_id);
      v_p2_deck := public._resolve_tournament_deck(p_p2, v_tournament_id);
    END IF;
  END IF;

  IF v_p1_deck IS NULL OR jsonb_array_length(v_p1_deck) < 3 THEN
    v_p1_deck := public._active_deck(p_p1);
  END IF;

  IF v_p2_deck IS NULL OR jsonb_array_length(v_p2_deck) < 3 THEN
    v_p2_deck := public._active_deck(p_p2);
  END IF;

  SELECT COALESCE(tree_level, 0), equipped_tree_skin, COALESCE(elo_rating, 1000)
    INTO v_p1_tree_level, v_p1_tree_skin, v_p1_elo
    FROM public.profiles WHERE id = p_p1;

  IF p_p2 IS NOT NULL THEN
    SELECT COALESCE(tree_level, 0), equipped_tree_skin, COALESCE(elo_rating, 1000)
      INTO v_p2_tree_level, v_p2_tree_skin, v_p2_elo
      FROM public.profiles WHERE id = p_p2;
  END IF;

  v_room := gen_random_uuid();

  INSERT INTO public.game_rooms (
    id,
    mode,
    player1_id,
    player2_id,
    seed,
    status,
    p1_deck,
    p2_deck,
    created_at,
    started_at,
    colosseum_bet,
    tournament_id,
    engine_version,
    is_async_match,
    p1_tree_level,
    p2_tree_level,
    p1_tree_skin,
    p2_tree_skin
  ) VALUES (
    v_room,
    p_mode,
    p_p1,
    p_p2,
    v_seed,
    'playing',
    v_p1_deck,
    v_p2_deck,
    NOW(),
    NOW() + make_interval(secs => v_cuenta),
    COALESCE(p_bet, 0),
    v_tournament_id,
    'auth-v2',
    FALSE,
    v_p1_tree_level,
    v_p2_tree_level,
    v_p1_tree_skin,
    v_p2_tree_skin
  );

  IF p_mode = 'colosseum' THEN
    UPDATE public.colosseum_escrow
       SET room_id = v_room
     WHERE user_id IN (p_p1, p_p2)
       AND status = 'held'
       AND room_id IS NULL;

    UPDATE public.game_rooms
       SET escrow_gems = COALESCE((
         SELECT SUM(bet_gems) FROM public.colosseum_escrow
          WHERE room_id = v_room AND status = 'held'
       ), 0)
     WHERE id = v_room;
  END IF;

  -- Deducción de energía sólo en Ranked PvP para ELO > 1602
  IF p_mode = 'ranked' THEN
    IF v_p1_elo > 1602 THEN
      UPDATE public.profiles
         SET energy_current = GREATEST(0, COALESCE(energy_current, 1) - 1),
             updated_at = NOW()
       WHERE id = p_p1;

      BEGIN
        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        VALUES (p_p1, 'energy_spend', 0, 'Consumo de 1 energía para partida Ranked PvP', 'completed');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    IF p_p2 IS NOT NULL AND v_p2_elo > 1602 THEN
      UPDATE public.profiles
         SET energy_current = GREATEST(0, COALESCE(energy_current, 1) - 1),
             updated_at = NOW()
       WHERE id = p_p2;

      BEGIN
        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        VALUES (p_p2, 'energy_spend', 0, 'Consumo de 1 energía para partida Ranked PvP', 'completed');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN v_room;
END;
$function$;

-- 2. _create_room overload con matchmaking_queue
CREATE OR REPLACE FUNCTION public._create_room(p_cand matchmaking_queue, p_fila matchmaking_queue)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room UUID;
  v_mode TEXT;
  v_bet  NUMERIC;
  v_torneo UUID;
BEGIN
  IF COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_cand.user_id), FALSE) 
     OR COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_fila.user_id), FALSE) THEN
    RETURN NULL;
  END IF;

  v_mode := COALESCE(p_cand.mode, p_fila.mode, 'ranked');
  v_bet  := COALESCE(p_cand.colosseum_bet, p_fila.colosseum_bet, 0);
  v_torneo := COALESCE(p_cand.tournament_id, p_fila.tournament_id);

  IF p_cand.created_at <= p_fila.created_at THEN
    v_room := public._create_room(v_mode, p_cand.user_id, p_fila.user_id, v_bet, v_torneo);
  ELSE
    v_room := public._create_room(v_mode, p_fila.user_id, p_cand.user_id, v_bet, v_torneo);
  END IF;

  IF p_cand.escrow_id IS NOT NULL THEN
    UPDATE public.colosseum_escrow
       SET room_id = v_room
     WHERE id = p_cand.escrow_id AND status = 'held' AND room_id IS NULL;
  END IF;

  IF p_fila.escrow_id IS NOT NULL THEN
    UPDATE public.colosseum_escrow
       SET room_id = v_room
     WHERE id = p_fila.escrow_id AND status = 'held' AND room_id IS NULL;
  END IF;

  UPDATE public.game_rooms
     SET escrow_gems = LEAST(
       COALESCE(v_bet, 0) * 2,
       COALESCE((
         SELECT SUM(bet_gems) FROM public.colosseum_escrow
          WHERE room_id = v_room AND status = 'held'
       ), 0)
     )
   WHERE id = v_room;

  UPDATE public.matchmaking_queue
     SET status = 'matched', matched_room_id = v_room
   WHERE id IN (p_cand.id, p_fila.id);

  RETURN v_room;
END;
$function$;

-- 3. _emparejar_lote propagando p_torneo a _create_room
CREATE OR REPLACE FUNCTION public._emparejar_lote(
  p_mode text,
  p_bet numeric DEFAULT 0,
  p_room_code text DEFAULT NULL::text,
  p_torneo uuid DEFAULT NULL::uuid
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_espera  INTEGER;
  v_inicio  INTEGER;
  v_paso    INTEGER;
  v_cada    INTEGER;
  v_tope    INTEGER;
  v_norepe  INTEGER;
  v_lote    UUID[] := ARRAY[]::UUID[];
  v_hechos  INTEGER := 0;
  v_fila    RECORD;
  v_cand    RECORD;
  v_room    UUID;
  v_pasada  INTEGER;
BEGIN
  IF p_mode = 'ranked' THEN
    SELECT COALESCE(MAX(CASE WHEN key = 'mm_espera_de_lote_segundos' THEN value::INTEGER END), 4)
      INTO v_espera
      FROM public.shop_config;
  ELSE
    v_espera := 0;
  END IF;

  SELECT COALESCE(MAX(CASE WHEN key = 'mm_elo_band_start'        THEN value::INTEGER END), 250),
         COALESCE(MAX(CASE WHEN key = 'mm_elo_band_step'         THEN value::INTEGER END), 100),
         COALESCE(MAX(CASE WHEN key = 'mm_elo_band_step_seconds' THEN value::INTEGER END), 5),
         COALESCE(MAX(CASE WHEN key = 'mm_elo_band_max'          THEN value::INTEGER END), 1200),
         COALESCE(MAX(CASE WHEN key = 'mm_no_repetir_minutos'    THEN value::INTEGER END), 10)
    INTO v_inicio, v_paso, v_cada, v_tope, v_norepe
    FROM public.shop_config;

  v_norepe := GREATEST(10, COALESCE(v_norepe, 10));

  FOR v_pasada IN 1..2 LOOP
    FOR v_fila IN
      SELECT q.*,
             LEAST(v_tope, v_inicio + v_paso *
               (EXTRACT(EPOCH FROM (NOW() - q.created_at))::INTEGER / GREATEST(1, v_cada))
             ) AS banda
        FROM public.matchmaking_queue q
       WHERE q.status = 'searching'
         AND q.mode = p_mode
         AND NOT COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = q.user_id), FALSE)
         AND COALESCE(q.colosseum_bet, 0) = COALESCE(p_bet, 0)
         AND q.room_code IS NOT DISTINCT FROM p_room_code
         AND q.tournament_id IS NOT DISTINCT FROM p_torneo
         AND q.created_at <= NOW() - make_interval(secs => v_espera)
         AND q.last_seen_at > NOW() - INTERVAL '45 seconds'
       ORDER BY
         q.created_at ASC
    LOOP
      IF v_fila.user_id = ANY(v_lote) THEN
        CONTINUE;
      END IF;

      SELECT q.* INTO v_cand
        FROM public.matchmaking_queue q
       WHERE q.status = 'searching'
         AND q.mode = p_mode
         AND q.user_id <> v_fila.user_id
         AND NOT COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = q.user_id), FALSE)
         AND NOT (q.user_id = ANY(v_lote))
         AND COALESCE(q.colosseum_bet, 0) = COALESCE(p_bet, 0)
         AND q.room_code IS NOT DISTINCT FROM p_room_code
         AND q.tournament_id IS NOT DISTINCT FROM p_torneo
         AND q.created_at <= NOW() - make_interval(secs => v_espera)
         AND q.last_seen_at > NOW() - INTERVAL '45 seconds'
         AND (
           p_mode IN ('tournament', 'friendly')
           OR (p_mode = 'ranked' AND v_fila.user_elo > 4000 AND q.user_elo > 4000)
           OR (p_mode = 'ranked' AND (v_fila.user_elo BETWEEN 3001 AND 4000) AND (q.user_elo BETWEEN 3001 AND 4000))
           OR (
             p_mode = 'ranked' 
             AND v_fila.user_elo > 3000 
             AND q.user_elo > 3000 
             AND (
               v_pasada = 2 
               OR EXTRACT(EPOCH FROM (NOW() - q.created_at)) >= 10 
               OR EXTRACT(EPOCH FROM (NOW() - v_fila.created_at)) >= 10
             )
           )
           OR (v_pasada = 2 AND EXTRACT(EPOCH FROM (NOW() - q.created_at)) >= 10 AND ABS(q.user_elo - v_fila.user_elo) <= 800)
           OR ABS(q.user_elo - v_fila.user_elo) <= GREATEST(
                v_fila.banda,
                LEAST(v_tope, v_inicio + v_paso *
                  (EXTRACT(EPOCH FROM (NOW() - q.created_at))::INTEGER / GREATEST(1, v_cada)))
              )
         )
         AND (
           p_mode = 'friendly'
           OR (v_pasada = 2 AND p_mode = 'tournament')
           OR (
             p_mode IN ('ranked', 'colosseum')
             AND NOT EXISTS (
               SELECT 1 FROM public.game_rooms r
                WHERE r.created_at > NOW() - INTERVAL '30 minutes'
                  AND ((r.player1_id = v_fila.user_id AND r.player2_id = q.user_id)
                    OR (r.player2_id = v_fila.user_id AND r.player1_id = q.user_id))
                  AND (
                    r.status IN ('abandoned', 'cancelled')
                    OR r.verification_note ILIKE '%desconex%'
                    OR r.verification_note ILIKE '%forfeit%'
                    OR r.verification_note ILIKE '%aband%'
                    OR (r.settled_at IS NOT NULL AND r.started_at IS NOT NULL AND EXTRACT(EPOCH FROM (r.settled_at - r.started_at)) < 30)
                  )
             )
             AND NOT EXISTS (
               SELECT 1 FROM public.game_rooms r
                WHERE r.created_at > NOW() - make_interval(mins => v_norepe)
                  AND ((r.player1_id = v_fila.user_id AND r.player2_id = q.user_id)
                    OR (r.player2_id = v_fila.user_id AND r.player1_id = q.user_id))
             )
           )
         )
       ORDER BY
         ABS(q.user_elo - v_fila.user_elo) ASC,
         random()
       FOR UPDATE SKIP LOCKED
       LIMIT 1;

      CONTINUE WHEN NOT FOUND;

      BEGIN
        IF v_cand.created_at <= v_fila.created_at THEN
          v_room := public._create_room(p_mode, v_cand.user_id, v_fila.user_id, p_bet, p_torneo);
        ELSE
          v_room := public._create_room(p_mode, v_fila.user_id, v_cand.user_id, p_bet, p_torneo);
        END IF;

        IF v_room IS NOT NULL THEN
          UPDATE public.matchmaking_queue
             SET status = 'matched', matched_room_id = v_room
           WHERE id IN (v_fila.id, v_cand.id);

          v_lote := v_lote || ARRAY[v_fila.user_id, v_cand.user_id];
          v_hechos := v_hechos + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  RETURN v_hechos;
END;
$function$;

-- 4. enter_matchmaking corregido para torneos
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
  v_uid             UUID := auth.uid();
  v_elo             INTEGER := 1000;
  v_now             TIMESTAMPTZ := NOW();
  v_room_record     RECORD;
  v_is_bot_only     BOOLEAN := FALSE;
  v_is_banned       BOOLEAN := FALSE;
  v_ban_reason      TEXT := NULL;
  v_unban_at        TIMESTAMPTZ := NULL;
  v_lockout_seconds INTEGER := 0;
  v_client_version  TEXT := COALESCE(p_engine_version, 'auth-v2');
  v_tournament_id   UUID := p_tournament_id;
  v_tourn           RECORD;
  v_tourn_part      RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Validación de sanción / ban / leaver buster
  SELECT is_banned, ban_reason, unban_at, is_bot_only, elo_rating
    INTO v_is_banned, v_ban_reason, v_unban_at, v_is_bot_only, v_elo
    FROM public.profiles
   WHERE id = v_uid;

  IF v_is_banned IS TRUE THEN
    IF v_unban_at IS NOT NULL AND v_unban_at <= v_now THEN
      UPDATE public.profiles
         SET is_banned = FALSE, ban_reason = NULL, unban_at = NULL, updated_at = v_now
       WHERE id = v_uid;
    ELSE
      v_lockout_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_unban_at - v_now))::INTEGER);
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'banned',
        'banReason', COALESCE(v_ban_reason, 'Cuenta sancionada temporalmente por abandono o conducta antideportiva.'),
        'lockoutSeconds', v_lockout_seconds,
        'message', COALESCE(v_ban_reason, 'Bloqueo temporal de matchmaking activo.')
      );
    END IF;
  END IF;

  v_elo := COALESCE(v_elo, 1000);

  IF v_client_version <> 'auth-v2' THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'client_update_required',
      'message', 'Se requiere actualizar el juego para buscar partida (versión desactualizada).'
    );
  END IF;

  -- ── VERIFICACIONES SEGÚN EL MODO ──────────────────────────────────────────
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

    -- Si el torneo ya alcanzó su fecha de inicio y no ha vencido, actualizar estado a 'live'
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

    -- Validación de las 3 vidas
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

  -- ── LIMPIEZA TOTAL DE BÚSQUEDAS PREVIAS EN COLA ───────────────────────────
  UPDATE public.matchmaking_queue
     SET status = 'cancelled', updated_at = v_now
   WHERE user_id = v_uid
     AND status IN ('searching', 'waiting', 'matched');

  -- ── RESOLUCIÓN DE SALAS PREVIAS PENDIENTES DEL USUARIO ────────────────────
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

  -- ── ENCOLAR EN MATCHMAKING_QUEUE ──────────────────────────────────────────
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

-- 5. _settle_room: Registro autoritativo completo de victorias/derrotas de torneos
CREATE OR REPLACE FUNCTION public._settle_room(p_room_id uuid, p_winner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room                 RECORD;
  v_escrow_rec           RECORD;
  v_pozo                 NUMERIC(10,2) := 0;
  v_loser_id             UUID;
  v_p1                   UUID;
  v_p2                   UUID;
  v_perdedor             UUID;
  v_elo_p1_before        INTEGER := 1000;
  v_elo_p2_before        INTEGER := 1000;
  v_delta_p1             INTEGER := 0;
  v_delta_p2             INTEGER := 0;
  v_elo_p1_after         INTEGER := 1000;
  v_elo_p2_after         INTEGER := 1000;
  v_cofre                JSONB   := NULL;
  v_vip_gold             INTEGER := 0;
  v_audit_elo            JSONB   := NULL;
  v_tourn_id             UUID;
  v_max_losses           INTEGER := 3;
  v_winner_name          TEXT;
  v_loser_name           TEXT;
  v_match_duration       NUMERIC := 0;
  v_plants_count         INTEGER := 0;
  v_loser_plants         INTEGER := 0;
  v_is_disconnect_loss   BOOLEAN := FALSE;
  v_verification_note    TEXT;
  v_winner_vip           BOOLEAN := FALSE;
  v_penalty_res          JSONB   := NULL;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala no encontrada: %', p_room_id; END IF;

  IF v_room.is_async_match = TRUE THEN
    RAISE EXCEPTION 'ASYNC_SETTLEMENT_REQUIRED: Las salas asíncronas deben liquidarse mediante settle_verified_async_ranked_match o _settle_async_abandoned_loss';
  END IF;

  IF v_room.status IN ('p1_won', 'p2_won', 'draw', 'abandoned', 'cancelled') AND v_room.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'status', 'ya_liquidada', 'winner', v_room.server_winner_id);
  END IF;

  IF p_winner_id IS NOT NULL AND p_winner_id NOT IN (v_room.player1_id, v_room.player2_id) THEN
    RAISE EXCEPTION 'Ganador inválido para la sala: %', p_winner_id;
  END IF;

  v_p1 := v_room.player1_id;
  v_p2 := v_room.player2_id;

  -- ── 1. MODO TORNEO ──────────────────────────────────────────────────────────
  IF v_room.mode = 'tournament' THEN
    IF p_winner_id IS NULL THEN
      UPDATE public.game_rooms
         SET status = 'draw',
             settled_at = NOW(),
             server_winner_id = NULL,
             verification_status = 'verified',
             verification_note = 'Empate de torneo verificado'
       WHERE id = p_room_id;
      RETURN jsonb_build_object('success', TRUE, 'status', 'empate', 'mode', 'tournament', 'eloGained', 0, 'eloLost', 0, 'payout', 0);
    END IF;

    v_perdedor := CASE WHEN p_winner_id = v_room.player1_id THEN v_room.player2_id ELSE v_room.player1_id END;
    v_tourn_id := v_room.tournament_id;

    IF v_tourn_id IS NULL THEN
      SELECT tournament_id INTO v_tourn_id
        FROM public.matchmaking_queue
       WHERE matched_room_id = p_room_id AND tournament_id IS NOT NULL
       LIMIT 1;
    END IF;

    IF v_tourn_id IS NULL THEN
      -- Búsqueda de respaldo: torneo activo donde ambos jugadores estén inscritos
      SELECT tp1.tournament_id INTO v_tourn_id
        FROM public.tournament_participants tp1
        JOIN public.tournament_participants tp2 ON tp2.tournament_id = tp1.tournament_id
        JOIN public.tournaments t ON t.id = tp1.tournament_id
       WHERE tp1.user_id = p_winner_id
         AND tp2.user_id = v_perdedor
         AND t.status IN ('live', 'active', 'scheduled')
       ORDER BY t.start_time DESC
       LIMIT 1;
    END IF;

    IF v_tourn_id IS NOT NULL THEN
      SELECT max_losses INTO v_max_losses FROM public.tournaments WHERE id = v_tourn_id;
      v_max_losses := COALESCE(v_max_losses, 3);

      SELECT username INTO v_winner_name FROM public.profiles WHERE id = p_winner_id;
      SELECT username INTO v_loser_name FROM public.profiles WHERE id = v_perdedor;

      -- 1. Registrar victoria y actualizar atómicamente al participante ganador
      IF p_winner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tournament_matches WHERE room_id = p_room_id AND player_id = p_winner_id) THEN
        INSERT INTO public.tournament_matches (
          tournament_id, player_id, opponent_name, result, player_deck, room_id
        ) VALUES (
          v_tourn_id, p_winner_id,
          COALESCE(v_loser_name, 'Rival de Torneo'),
          'victory',
          COALESCE((SELECT deck FROM public.tournament_participants WHERE tournament_id = v_tourn_id AND user_id = p_winner_id), '[]'::jsonb),
          p_room_id
        );

        UPDATE public.tournament_participants
           SET wins = wins + 1,
               updated_at = NOW()
         WHERE tournament_id = v_tourn_id AND user_id = p_winner_id;
      END IF;

      -- 2. Registrar derrota y descontar vida al participante perdedor
      IF v_perdedor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tournament_matches WHERE room_id = p_room_id AND player_id = v_perdedor) THEN
        INSERT INTO public.tournament_matches (
          tournament_id, player_id, opponent_name, result, player_deck, room_id
        ) VALUES (
          v_tourn_id, v_perdedor,
          COALESCE(v_winner_name, 'Rival de Torneo'),
          'defeat',
          COALESCE((SELECT deck FROM public.tournament_participants WHERE tournament_id = v_tourn_id AND user_id = v_perdedor), '[]'::jsonb),
          p_room_id
        );

        UPDATE public.tournament_participants
           SET losses = losses + 1,
               is_eliminated = (losses + 1 >= v_max_losses),
               lives_remaining = GREATEST(0, v_max_losses - (losses + 1)),
               updated_at = NOW()
         WHERE tournament_id = v_tourn_id AND user_id = v_perdedor;
      END IF;
    END IF;

    UPDATE public.game_rooms
       SET status = CASE WHEN p_winner_id = player1_id THEN 'p1_won' ELSE 'p2_won' END,
           settled_at = NOW(),
           server_winner_id = p_winner_id,
           tournament_id = COALESCE(tournament_id, v_tourn_id),
           verification_status = 'verified',
           verification_note = 'Combate de torneo verificado autoritativamente'
     WHERE id = p_room_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'liquidada',
      'winner', p_winner_id,
      'mode', 'tournament',
      'tournament_id', v_tourn_id
    );
  END IF;

  -- ── 2. MODO COLISEO / APUESTAS ──────────────────────────────────────────────
  IF v_room.mode = 'colosseum' THEN
    SELECT * INTO v_escrow_rec FROM public.colosseum_escrow WHERE room_id = p_room_id AND status = 'held' FOR UPDATE;
    IF FOUND THEN
      v_pozo := COALESCE(v_escrow_rec.bet_gems, 0) * 2;
    ELSE
      v_pozo := COALESCE(v_room.colosseum_bet, 0) * 2;
    END IF;

    IF v_pozo > 0 AND p_winner_id IS NOT NULL THEN
      UPDATE public.profiles
         SET gems_balance = gems_balance + v_pozo,
             updated_at = NOW()
       WHERE id = p_winner_id;

      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      VALUES (p_winner_id, 'colosseum_win', v_pozo, 'Premio Coliseo ganado', 'completed');

      UPDATE public.colosseum_escrow
         SET status = 'settled'
       WHERE room_id = p_room_id AND status = 'held';
    END IF;

    UPDATE public.game_rooms
       SET status = CASE WHEN p_winner_id = player1_id THEN 'p1_won' ELSE 'p2_won' END,
           settled_at = NOW(),
           server_winner_id = p_winner_id,
           verification_status = 'verified',
           verification_note = COALESCE(verification_note, 'Consenso mutuo verificado')
     WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'status', 'liquidada', 'winner', p_winner_id, 'payout', v_pozo, 'mode', 'colosseum');
  END IF;

  -- ── 3. MODO RANKED CLASIFICATORIO ───────────────────────────────────────────
  IF v_room.mode = 'ranked' THEN
    SELECT elo_rating INTO v_elo_p1_before FROM public.profiles WHERE id = v_p1 FOR UPDATE;
    SELECT elo_rating INTO v_elo_p2_before FROM public.profiles WHERE id = v_p2 FOR UPDATE;

    v_elo_p1_before := COALESCE(v_elo_p1_before, 1000);
    v_elo_p2_before := COALESCE(v_elo_p2_before, 1000);

    -- Detección estricta de desconexión o abandono
    SELECT
      COALESCE(EXTRACT(EPOCH FROM (v_room.settled_at - v_room.started_at)), 0),
      (SELECT COUNT(*) FROM public.match_actions WHERE room_id = p_room_id AND kind = 'plant'),
      (SELECT COUNT(*) FROM public.match_actions WHERE room_id = p_room_id AND kind = 'plant' AND user_id <> p_winner_id)
    INTO
      v_match_duration, v_plants_count, v_loser_plants;

    IF v_room.verification_note ILIKE '%desconex%'
       OR v_room.verification_note ILIKE '%forfeit%'
       OR v_room.verification_note ILIKE '%inactivo%'
       OR (v_loser_plants = 0 AND v_plants_count > 0) THEN
      v_is_disconnect_loss := TRUE;
    END IF;

    IF p_winner_id IS NULL THEN
      -- Empate en Ranked: sin cambio de ELO
      v_delta_p1 := 0;
      v_delta_p2 := 0;
      v_elo_p1_after := v_elo_p1_before;
      v_elo_p2_after := v_elo_p2_before;
    ELSIF p_winner_id = v_p1 THEN
      v_delta_p1 := 30;
      v_delta_p2 := -30;
      v_elo_p1_after := v_elo_p1_before + v_delta_p1;
      v_elo_p2_after := GREATEST(0, v_elo_p2_before + v_delta_p2);
      v_perdedor := v_p2;
    ELSE
      v_delta_p1 := -30;
      v_delta_p2 := 30;
      v_elo_p1_after := GREATEST(0, v_elo_p1_before + v_delta_p1);
      v_elo_p2_after := v_elo_p2_before + v_delta_p2;
      v_perdedor := v_p1;
    END IF;

    -- Aplicar ELO
    UPDATE public.profiles SET elo_rating = v_elo_p1_after, updated_at = NOW() WHERE id = v_p1;
    UPDATE public.profiles SET elo_rating = v_elo_p2_after, updated_at = NOW() WHERE id = v_p2;

    -- Penalización estricta de abandono/desconexión
    IF v_is_disconnect_loss AND v_perdedor IS NOT NULL THEN
      v_penalty_res := public._apply_disconnect_penalty(v_perdedor, 15);
    END IF;

    -- Estadísticas oficiales
    IF p_winner_id IS NOT NULL THEN
      INSERT INTO public.ranked_player_stats (user_id, wins, losses, draws, updated_at)
      VALUES (p_winner_id, 1, 0, 0, NOW())
      ON CONFLICT (user_id) DO UPDATE
         SET wins = ranked_player_stats.wins + 1,
             updated_at = NOW();
    END IF;

    IF v_perdedor IS NOT NULL THEN
      INSERT INTO public.ranked_player_stats (user_id, wins, losses, draws, updated_at)
      VALUES (v_perdedor, 0, 1, 0, NOW())
      ON CONFLICT (user_id) DO UPDATE
         SET losses = ranked_player_stats.losses + 1,
             updated_at = NOW();
    END IF;

    -- Recompensas de Victoria PvP para el ganador legítimo
    BEGIN
      IF p_winner_id IS NOT NULL THEN
        SELECT public._award_victory_chest_for(p_winner_id) INTO v_cofre;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_cofre := NULL;
    END;

    BEGIN
      IF p_winner_id IS NOT NULL THEN
        SELECT public._award_vip_victory_gold(p_winner_id) INTO v_vip_gold;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_vip_gold := 0;
    END;

    IF p_winner_id IS NOT NULL THEN
      PERFORM public._award_battle_pass_xp(p_winner_id, 25, 'ranked_win');
    END IF;

    v_audit_elo := jsonb_build_object(
      'p1Before', v_elo_p1_before, 'p1After', v_elo_p1_after, 'p1Delta', v_delta_p1,
      'p2Before', v_elo_p2_before, 'p2After', v_elo_p2_after, 'p2Delta', v_delta_p2,
      'isDisconnectLoss', v_is_disconnect_loss,
      'disconnectPenalty', v_penalty_res
    );

    IF v_is_disconnect_loss THEN
      v_verification_note := 'Victoria por abandono/desconexión del rival (con penalización aplicada)';
    ELSIF v_room.verification_note ILIKE '%surrender%' OR v_room.verification_note ILIKE '%rendición%' THEN
      v_verification_note := 'Victoria por rendición del rival confirmada';
    ELSE
      v_verification_note := COALESCE(v_room.verification_note, 'Consenso mutuo verificado');
    END IF;

    UPDATE public.game_rooms
       SET status = CASE WHEN p_winner_id = player1_id THEN 'p1_won' ELSE 'p2_won' END,
           settled_at = NOW(),
           server_winner_id = p_winner_id,
           verification_status = 'verified',
           verification_note = v_verification_note,
           verification_payload = COALESCE(verification_payload, '{}'::JSONB) || jsonb_build_object(
             'elo', v_audit_elo,
             'vipGoldBonus', v_vip_gold,
             'chest', v_cofre,
             'bpXpGained', 25,
             'isDisconnectLoss', v_is_disconnect_loss,
             'penaltyResult', v_penalty_res
           )
     WHERE id = p_room_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'liquidada',
      'winner', p_winner_id,
      'mode', 'ranked',
      'eloGained', CASE WHEN p_winner_id = v_room.player1_id THEN v_delta_p1 ELSE v_delta_p2 END,
      'eloLost', CASE WHEN p_winner_id = v_room.player1_id THEN ABS(v_delta_p2) ELSE ABS(v_delta_p1) END,
      'eloAfter', CASE WHEN p_winner_id = v_room.player1_id THEN v_elo_p1_after ELSE v_elo_p2_after END,
      'chest', v_cofre,
      'vipGoldBonus', v_vip_gold,
      'bpXpGained', 25
    );
  END IF;

  -- ── 4. MODO AMISTOSO / DUELOS ───────────────────────────────────────────────
  IF v_room.mode = 'friendly' THEN
    SELECT * INTO v_escrow_rec FROM public.colosseum_escrow WHERE room_id = p_room_id AND status = 'held' FOR UPDATE;
    IF FOUND THEN
      v_pozo := COALESCE(v_escrow_rec.bet_gems, 0);
    ELSE
      v_pozo := 0;
    END IF;

    IF v_pozo > 0 AND p_winner_id IS NOT NULL THEN
      UPDATE public.profiles
         SET gems_balance = gems_balance + v_pozo,
             updated_at = NOW()
       WHERE id = p_winner_id;

      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      VALUES (p_winner_id, 'friendly_win', v_pozo, 'Duelo amistoso ganado', 'completed');

      UPDATE public.colosseum_escrow
         SET status = 'settled'
       WHERE room_id = p_room_id AND status = 'held';
    END IF;

    UPDATE public.game_rooms
       SET status = CASE WHEN p_winner_id = player1_id THEN 'p1_won' ELSE 'p2_won' END,
           settled_at = NOW(),
           server_winner_id = p_winner_id,
           verification_status = 'verified',
           verification_note = COALESCE(verification_note, 'Consenso mutuo verificado')
     WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'status', 'liquidada', 'winner', p_winner_id, 'mode', 'friendly');
  END IF;

  RETURN jsonb_build_object('success', FALSE, 'error', 'modo_no_soportado');
END;
$function$;

-- 6. reenter_tournament con actualización de lives_remaining
CREATE OR REPLACE FUNCTION public.reenter_tournament(p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid          UUID := auth.uid();
  v_tourn        RECORD;
  v_part         RECORD;
  v_user         RECORD;
  v_reentry_cost NUMERIC(12, 2) := 200.00;
  v_now          TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_tourn
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND';
  END IF;

  IF v_tourn.status = 'ended' OR v_tourn.status = 'cancelled' OR v_now >= v_tourn.end_time THEN
    RAISE EXCEPTION 'TOURNAMENT_CLOSED';
  END IF;

  SELECT * INTO v_part
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_REGISTERED_IN_TOURNAMENT';
  END IF;

  IF NOT (v_part.is_eliminated OR v_part.losses >= 3) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PLAYER_NOT_ELIMINATED',
      'message', 'No estás eliminado de este torneo'
    );
  END IF;

  SELECT username, gems_balance INTO v_user
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  IF v_user.gems_balance IS NULL OR v_user.gems_balance < v_reentry_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_GEMS_FOR_REENTRY';
  END IF;

  -- 1. Debitar 200 gemas del jugador para la casa
  UPDATE public.profiles
     SET gems_balance = gems_balance - v_reentry_cost,
         updated_at   = v_now
   WHERE id = v_uid;

  -- 2. Registrar en transacciones
  INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
  VALUES (
    v_uid, 'tournament_reentry', v_reentry_cost,
    '🔄 Reentrada a Torneo (2 vidas): ' || v_tourn.title, 'completed'
  );

  -- 3. Otorgar 2 vidas: losses pasa a 1, lives_remaining = 2, conservando victorias previas
  UPDATE public.tournament_participants
     SET is_eliminated   = FALSE,
         losses          = 1,
         lives_remaining = 2,
         updated_at      = v_now
   WHERE tournament_id = p_tournament_id AND user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'tournament_id', p_tournament_id,
    'lives', 2,
    'losses', 1,
    'is_eliminated', false,
    'message', 'REENTRY_SUCCESSFUL'
  );
END;
$function$;
