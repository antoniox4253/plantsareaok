-- ==============================================================================
-- Migración 384: Deducción autoritativa de energía en Ranked PvP y Gatekeeper de Matchmaking
-- ==============================================================================
-- 1. Restaura en _create_room el cobro atómico de 1 energía en Ranked competitivo
--    para P1 (si ELO > 1602) y para P2 (si ELO > 1602), registrando 'energy_spend'.
-- 2. Restaura en enter_matchmaking el gatekeeper de energía para Ranked competitivo
--    (v_elo > 1602 y v_cur_en < 1) con verificación de reset diario (00:00 UTC).
-- ==============================================================================

BEGIN;

-- ── 1. ACTUALIZAR _create_room CON DEDUCCIÓN ATÓMICA DE ENERGÍA RANKED ────────
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
  v_p1_deck       JSONB;
  v_p2_deck       JSONB;
  v_now           TIMESTAMPTZ := NOW();
  v_p1_tree_level INTEGER := 0;
  v_p2_tree_level INTEGER := 0;
  v_p1_tree_skin  TEXT := NULL;
  v_p2_tree_skin  TEXT := NULL;
  v_p1_elo        INTEGER := 1000;
  v_p2_elo        INTEGER := 1000;
BEGIN
  IF p_p1 IS NULL OR p_p2 IS NULL THEN
    RAISE EXCEPTION 'p_p1 y p_p2 son requeridos';
  END IF;

  IF COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_p1), FALSE) 
     OR COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_p2), FALSE) THEN
    RETURN NULL;
  END IF;

  v_room := gen_random_uuid();
  v_seed := 1 + floor(random() * 2147483646)::BIGINT;

  -- Si es torneo, resolver los mazos usando el mazo de torneo registrado y las reglas del torneo
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
    -- Asignación directa y robusta de JSONB devuelto por _active_deck
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

  INSERT INTO public.game_rooms (
    id,
    mode,
    player1_id,
    player2_id,
    colosseum_bet,
    tournament_id,
    seed,
    status,
    p1_deck,
    p2_deck,
    created_at,
    started_at,
    engine_version,
    user_elo,
    elo_rating,
    p1_tree_level,
    p2_tree_level,
    p1_tree_skin,
    p2_tree_skin
  ) VALUES (
    v_room,
    p_mode,
    p_p1,
    p_p2,
    COALESCE(p_bet, 0),
    p_tournament_id,
    v_seed,
    'playing',
    v_p1_deck,
    v_p2_deck,
    v_now,
    v_now,
    'auth-v2',
    v_p1_elo,
    v_p2_elo,
    v_p1_tree_level,
    v_p2_tree_level,
    v_p1_tree_skin,
    v_p2_tree_skin
  );

  -- Descontar energía para partidas Ranked PvP (sólo para jugadores > 1602 copas; <= 1602 tienen vidas infinitas)
  IF p_mode = 'ranked' AND v_p1_elo > 1602 THEN
    UPDATE public.profiles
       SET energy_current = GREATEST(0, COALESCE(energy_current, 1) - 1),
           updated_at = v_now
     WHERE id = p_p1;

    BEGIN
      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      VALUES (p_p1, 'energy_spend', 0, 'Consumo de 1 energía para partida Ranked PvP', 'completed');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF p_mode = 'ranked' AND v_p2_elo > 1602 THEN
    UPDATE public.profiles
       SET energy_current = GREATEST(0, COALESCE(energy_current, 1) - 1),
           updated_at = v_now
     WHERE id = p_p2;

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

-- ── 2. ACTUALIZAR enter_matchmaking CON GATEKEEPER DE ENERGÍA Y RESET DIARIO ──
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
  v_max_en                   INTEGER := 20;
  v_cur_en                   INTEGER := 20;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Modos válidos soportados: Ranked, Friendly y Torneos
  IF p_mode NOT IN ('ranked', 'friendly', 'tournament') THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'mode_deprecated',
      'message', 'El modo ' || COALESCE(p_mode, '') || ' ya no está disponible. Modos activos: Ranked, Arena Ads y Torneos.'
    );
  END IF;

  -- Validación de perfil
  SELECT is_banned, ban_reason, unban_at, is_bot_only, elo_rating, energy_current, energy_last_reset_utc, has_vip_pass
    INTO v_user_prof
    FROM public.profiles
   WHERE id = v_uid;

  v_is_banned := COALESCE(v_user_prof.is_banned, FALSE);
  v_ban_reason := v_user_prof.ban_reason;
  v_unban_at := v_user_prof.unban_at;
  v_is_bot_only := COALESCE(v_user_prof.is_bot_only, FALSE);
  v_elo := COALESCE(v_user_prof.elo_rating, 1000);

  -- ── BLOQUEO PERMANENTE O SANCIÓN ADMINISTRATIVA ──
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

  -- ── RESTRICCIÓN DE CUENTAS BOT ────────────────────────────────────────────
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

  -- ── VERIFICACIONES DE TORNEOS ──────────────────────────────────────────────
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

  -- ── GATEKEEPER AUTORITATIVO DE ENERGÍA EN RANKED COMPETITIVO (> 1602 COPAS) ──
  IF p_mode = 'ranked' AND v_elo > 1602 THEN
    -- Check reset diario de energía (00:00 UTC)
    v_is_new_day := (v_user_prof.energy_last_reset_utc IS NULL OR
                     DATE_TRUNC('day', v_user_prof.energy_last_reset_utc AT TIME ZONE 'UTC') < DATE_TRUNC('day', v_now AT TIME ZONE 'UTC'));

    v_max_en := CASE WHEN COALESCE(v_user_prof.has_vip_pass, FALSE) THEN 25 ELSE 20 END;

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
    -- NOTA: El cobro atómico de 1 energía se realiza al crear la sala en _create_room (PvP) o claim_ranked_async_opponent (Bot).
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

COMMIT;
