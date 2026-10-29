-- ==============================================================================
-- MIGRACIÓN 373: Corrección de Doble Cobro de Energía, Desbaneo de Bless,
--                Ajuste de Leaver Buster (1 hora a las 2 faltas) y
--                Restitución de Energía a Jon Snow y Jugadores Afectados
-- ==============================================================================

BEGIN;

-- ── 1. DESBANEO EXCLUSIVO DE LA CUENTA PRINCIPAL DE BLESS (Bles_sd) ───────────
UPDATE public.profiles
   SET is_banned = FALSE,
       ban_reason = NULL,
       matchmaking_banned_until = NULL,
       disconnect_strikes = 0,
       updated_at = NOW()
 WHERE id = '41e0ad2c-e665-42f8-8c22-7498f3ac93e6'; -- Bles_sd

-- ── 2. RESTITUCIÓN DE ENERGÍA DE JON SNOW Y JUGADORES AFECTADOS ───────────────
UPDATE public.profiles
   SET energy_current = 25,
       farming_inventory = jsonb_set(
         COALESCE(farming_inventory, '{}'::jsonb),
         '{energy_potion_5}',
         to_jsonb(COALESCE((farming_inventory->>'energy_potion_5')::integer, 0) + 5)
       ),
       updated_at = NOW()
 WHERE id = '26c64a60-8fb2-47e1-be21-4e4e9eee64ad'; -- Jon Snow

-- Restituir energía al resto de jugadores afectados por el doble cobro
UPDATE public.profiles
   SET energy_current = CASE WHEN COALESCE(has_vip_pass, FALSE) THEN 25 ELSE 20 END,
       updated_at = NOW()
 WHERE username IN ('Eja', 'JH', 'yjrg', 'Blaky', 'MrMopedais177', 'pineda95');

-- ── 3. AJUSTE DE LEAVER BUSTER: 1 HORA DE BLOQUEO A LAS 2 FALTAS ─────────────
CREATE OR REPLACE FUNCTION public._apply_disconnect_penalty(
  p_user_id UUID,
  p_penalty_copas INTEGER DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prof           RECORD;
  v_new_strikes    INTEGER := 1;
  v_cooldown_mins  INTEGER := 10;
  v_cooldown_until TIMESTAMPTZ;
  v_elo_after      INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'user_id_null');
  END IF;

  SELECT elo_rating, disconnect_strikes, last_disconnect_at, is_bot_only
    INTO v_prof
    FROM public.profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_prof.is_bot_only, FALSE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'perfil_no_elegible');
  END IF;

  -- Si el último abandono fue hace más de 24 horas, resetea la racha de strikes a 1
  IF v_prof.last_disconnect_at IS NULL OR v_prof.last_disconnect_at < NOW() - INTERVAL '24 hours' THEN
    v_new_strikes := 1;
  ELSE
    v_new_strikes := COALESCE(v_prof.disconnect_strikes, 0) + 1;
  END IF;

  -- Escalera de bloqueo temporal (Leaver Buster):
  -- 1 falta: 10 minutos (aviso corto)
  -- 2 faltas: 60 minutos (1 hora exacta solicitada)
  -- 3+ faltas: 720 minutos (12 horas para reincidencia persistente)
  IF v_new_strikes = 1 THEN
    v_cooldown_mins := 10;
  ELSIF v_new_strikes = 2 THEN
    v_cooldown_mins := 60;
  ELSE
    v_cooldown_mins := 720;
  END IF;

  v_cooldown_until := NOW() + make_interval(mins => v_cooldown_mins);

  -- Deducción agravada de copas por desconexión / abandono
  v_elo_after := GREATEST(0, COALESCE(v_prof.elo_rating, 1000) - p_penalty_copas);

  UPDATE public.profiles
     SET elo_rating = v_elo_after,
         disconnect_strikes = v_new_strikes,
         last_disconnect_at = NOW(),
         matchmaking_banned_until = v_cooldown_until,
         updated_at = NOW()
   WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'strikes', v_new_strikes,
    'cooldownMins', v_cooldown_mins,
    'cooldownUntil', v_cooldown_until,
    'penaltyCopas', p_penalty_copas,
    'eloAfter', v_elo_after
  );
END;
$function$;

-- ── 4. CORRECCIÓN EN ENTER_MATCHMAKING: ELIMINAR DOBLE COBRO DE ENERGÍA ────────
-- enter_matchmaking solo debe actuar como GATEKEEPER autoritativo (verificar que tenga >= 1).
-- El cobro real atómico de 1 energía se realiza al crear la sala:
-- - En partidas PvP: dentro de public._create_room.
-- - En partidas Bot: dentro de public.claim_ranked_async_opponent.
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
  v_now             TIMESTAMPTZ := NOW();
  v_user_prof       RECORD;
  v_elo             INTEGER;
  v_deck            JSONB;
  v_active_room     UUID;
  v_escrow          UUID := NULL;
  v_room_record     RECORD;
  v_auto_plant      RECORD;
  v_auto_slot       INTEGER := 0;
  v_starters        TEXT[] := ARRAY['sunflower', 'peashooter', 'wallnut', 'chomper'];
  v_starter         TEXT;
  v_tournament_id   UUID := p_tournament_id;
  v_tourn           RECORD;
  v_tourn_part      RECORD;
  v_apuesta         JSONB;
  v_cur_en          INTEGER;
  v_max_en          INTEGER;
  v_is_new_day      BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('matched', FALSE, 'searching', FALSE, 'error', 'no_autenticado');
  END IF;

  SELECT * INTO v_user_prof FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', FALSE, 'searching', FALSE, 'error', 'perfil_no_existe');
  END IF;

  -- ── BLOQUEO PERMANENTE: CUENTAS BANEADAS ──────────────────────────────────
  IF COALESCE(v_user_prof.is_banned, FALSE) = TRUE THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'account_banned',
      'message', COALESCE(v_user_prof.ban_reason, 'Esta cuenta ha sido suspendida permanentemente.')
    );
  END IF;

  -- ── BLOQUEO TEMPORAL: LEAVER BUSTER POR DESCONEXIONES ──────────────────────
  IF v_user_prof.matchmaking_banned_until IS NOT NULL AND v_user_prof.matchmaking_banned_until > v_now THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'matchmaking_cooldown',
      'message', 'Bloqueo temporal por desconexión o abandono de partida. Podrás jugar de nuevo en ' ||
                 GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_user_prof.matchmaking_banned_until - v_now)) / 60)) || ' minuto(s).'
    );
  END IF;

  v_elo := COALESCE(v_user_prof.elo_rating, 1000);

  -- ── GATE DE VERSIÓN DEL CLIENTE ───────────────────────────────────────────
  IF COALESCE(p_engine_version, '') <> 'auth-v2' THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'client_update_required',
      'message', 'Hay una nueva versión del juego. Recarga la página para actualizar.'
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

    IF v_tourn.status <> 'active' THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'tournament_not_active',
        'message', 'El torneo no está activo en este momento.'
      );
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
       AND settled_at IS NULL
       AND status = 'playing'
  LOOP
    BEGIN
      IF COALESCE(v_room_record.is_async_match, FALSE) = FALSE AND v_room_record.player2_id IS NOT NULL THEN
        IF (v_room_record.player1_id = v_uid AND v_room_record.p2_reported_winner = v_uid)
           OR (v_room_record.player2_id = v_uid AND v_room_record.p1_reported_winner = v_uid) THEN
          PERFORM public._settle_room(v_room_record.id, v_uid);
        ELSE
          PERFORM public._settle_if_abandoned(v_room_record.id);
        END IF;
      ELSE
        PERFORM public._settle_if_abandoned(v_room_record.id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- No bloquear matchmaking si falla la limpieza de sala huérfana
    END;
  END LOOP;

  -- ── GATEKEEPER AUTORITATIVO DE ENERGÍA EN RANKED (SIN COBRO ANTICIPADO) ───
  IF p_mode = 'ranked' THEN
    IF v_elo > 1602 THEN
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
      -- NOTA: El cobro real atómico de 1 energía se realiza exclusivamente al
      -- crear la partida en _create_room (PvP) o claim_ranked_async_opponent (Bot).
    END IF;
  END IF;

  -- ── RESOLVER MAZO ACTIVO ──────────────────────────────────────────────────
  SELECT public._active_deck(v_uid) INTO v_deck;

  IF v_deck IS NULL OR jsonb_array_length(v_deck) = 0 THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'mazo_vacio',
      'message', 'Tu mazo está vacío. Configura tu mazo antes de jugar.'
    );
  END IF;

  -- Insertar en la cola con las columnas autoritativas de matchmaking_queue
  INSERT INTO public.matchmaking_queue (
    user_id, mode, elo_rating, user_elo, elo, status, colosseum_bet, tournament_id, room_code, client_engine_version, created_at, updated_at, last_seen_at
  ) VALUES (
    v_uid, p_mode, v_elo, v_elo, v_elo, 'searching', p_bet, v_tournament_id, p_room_code, p_engine_version, v_now, v_now, v_now
  );

  -- Disparar emparejamiento inmediato
  PERFORM public._emparejar_lote(p_mode, p_bet, p_room_code, v_tournament_id);

  -- Comprobar si fue emparejado de inmediato
  SELECT matched_room_id INTO v_active_room
    FROM public.matchmaking_queue
   WHERE user_id = v_uid AND status = 'matched'
   LIMIT 1;

  IF v_active_room IS NOT NULL THEN
    RETURN jsonb_build_object(
      'matched', TRUE,
      'searching', FALSE,
      'roomId', v_active_room
    );
  END IF;

  RETURN jsonb_build_object(
    'matched', FALSE,
    'searching', TRUE
  );
END;
$function$;

COMMIT;
