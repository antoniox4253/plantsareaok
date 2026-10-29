-- Migración 376: Desactivar oficialmente el modo Coliseo y garantizar independencia
-- de los 3 modos oficiales: Ranked, Arena Ads y Torneos.

-- 0. Asegurar que las columnas requeridas existan en public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unban_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS matchmaking_banned_until TIMESTAMPTZ DEFAULT NULL;

-- 1. Actualizar enter_matchmaking para restringir a los modos activos (ranked, friendly, tournament)
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
  v_matchmaking_banned_until TIMESTAMPTZ := NULL;
  v_effective_unban_at       TIMESTAMPTZ := NULL;
  v_lockout_seconds          INTEGER := 0;
  v_client_version           TEXT := COALESCE(p_engine_version, 'auth-v2');
  v_tournament_id            UUID := p_tournament_id;
  v_tourn                    RECORD;
  v_tourn_part               RECORD;
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

  -- Validación de sanción / ban / leaver buster
  SELECT is_banned, ban_reason, unban_at, matchmaking_banned_until, is_bot_only, elo_rating
    INTO v_is_banned, v_ban_reason, v_unban_at, v_matchmaking_banned_until, v_is_bot_only, v_elo
    FROM public.profiles
   WHERE id = v_uid;

  -- ── BLOQUEO PERMANENTE O SANCION PROGRAMADA ───────────────────────────────
  IF COALESCE(v_is_banned, FALSE) = TRUE THEN
    v_effective_unban_at := COALESCE(v_unban_at, v_matchmaking_banned_until);
    IF v_effective_unban_at IS NOT NULL AND v_effective_unban_at <= v_now THEN
      -- Sanción temporal cumplida: levantar ban automáticamente
      UPDATE public.profiles
         SET is_banned = FALSE,
             ban_reason = NULL,
             unban_at = NULL,
             matchmaking_banned_until = NULL,
             updated_at = v_now
       WHERE id = v_uid;
    ELSE
      v_lockout_seconds := CASE 
        WHEN v_effective_unban_at IS NOT NULL AND v_effective_unban_at > v_now THEN 
          GREATEST(1, EXTRACT(EPOCH FROM (v_effective_unban_at - v_now))::INTEGER)
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

  -- ── BLOQUEO TEMPORAL: LEAVER BUSTER POR DESCONEXIONES ──────────────────────
  v_effective_unban_at := COALESCE(v_matchmaking_banned_until, v_unban_at);
  IF v_effective_unban_at IS NOT NULL THEN
    IF v_effective_unban_at <= v_now THEN
      -- Sanción temporal expirada: limpiar columna
      UPDATE public.profiles
         SET matchmaking_banned_until = NULL,
             unban_at = NULL,
             updated_at = v_now
       WHERE id = v_uid;
    ELSE
      v_lockout_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_effective_unban_at - v_now))::INTEGER);
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'matchmaking_cooldown',
        'banReason', COALESCE(v_ban_reason, 'Bloqueo temporal por desconexión o abandono de partida.'),
        'lockoutSeconds', v_lockout_seconds,
        'message', 'Bloqueo temporal por desconexión o abandono de partida. Podrás jugar de nuevo en ' ||
                   GREATEST(1, ROUND(v_lockout_seconds / 60.0)) || ' minuto(s).'
      );
    END IF;
  END IF;

  -- ── RESTRICCIÓN DE CUENTAS BOT ────────────────────────────────────────────
  IF COALESCE(v_is_bot_only, FALSE) = TRUE THEN
    RETURN jsonb_build_object(
      'matched', FALSE, 'searching', FALSE,
      'error', 'bot_restricted',
      'message', 'Las cuentas de prueba o bot no pueden ingresar al matchmaking global.'
    );
  END IF;

  v_elo := COALESCE(v_elo, 1000);

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

-- 2. Actualizar poll_matchmaking para limpiar el chequeo del coliseo
CREATE OR REPLACE FUNCTION public.poll_matchmaking()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid         UUID := auth.uid();
  v_fila        RECORD;
  v_room        UUID;
  v_esperado    INTEGER;
  v_ghost       INTEGER;
  v_espera      INTEGER;
  v_claim_res   JSONB;
  v_is_bot_only BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_fila FROM public.matchmaking_queue
   WHERE user_id = v_uid AND status IN ('searching', 'matched')
   ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('searching', FALSE, 'matched', FALSE);
  END IF;

  -- Si está emparejado, verificar que la sala siga viva
  IF v_fila.status = 'matched' THEN
    IF v_fila.matched_room_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.game_rooms
         WHERE id = v_fila.matched_room_id
           AND status = 'playing'
           AND settled_at IS NULL
      ) THEN
        RETURN jsonb_build_object('matched', TRUE, 'roomId', v_fila.matched_room_id);
      ELSE
        UPDATE public.matchmaking_queue
           SET status = 'cancelled', updated_at = NOW()
         WHERE id = v_fila.id;
        RETURN jsonb_build_object('searching', FALSE, 'matched', FALSE);
      END IF;
    END IF;
    RETURN jsonb_build_object('matched', TRUE, 'roomId', v_fila.matched_room_id);
  END IF;

  -- Detección de versiones obsoletas
  IF v_fila.status = 'searching' AND (v_fila.client_engine_version IS NULL OR v_fila.client_engine_version <> 'auth-v2') THEN
    RETURN jsonb_build_object(
      'searching', FALSE,
      'matched', FALSE,
      'error', 'client_update_required',
      'message', 'Se requiere actualizar el juego para continuar buscando partida.'
    );
  END IF;

  -- Señal de vida
  UPDATE public.matchmaking_queue SET last_seen_at = NOW() WHERE id = v_fila.id;

  -- 1. Intentar emparejamiento con rival humano prioritario (protegido contra fallos)
  BEGIN
    v_room := public._try_match(v_uid);
  EXCEPTION WHEN OTHERS THEN
    v_room := NULL;
  END;

  IF v_room IS NOT NULL THEN
    RETURN jsonb_build_object('matched', TRUE, 'roomId', v_room);
  END IF;

  v_esperado := EXTRACT(EPOCH FROM (NOW() - v_fila.created_at))::INTEGER;

  SELECT COALESCE(MAX(CASE WHEN key = 'mm_ranked_ghost_after_seconds'   THEN value::INTEGER END), 30),
         COALESCE(MAX(CASE WHEN key = 'mm_espera_de_lote_segundos'      THEN value::INTEGER END), 4)
    INTO v_ghost, v_espera
    FROM public.shop_config;

  SELECT COALESCE(is_bot_only, FALSE) INTO v_is_bot_only
    FROM public.profiles
   WHERE id = v_uid;

  IF v_uid = 'f3fc7e3f-9eeb-45f6-90a2-7c6203a09daf'::uuid OR v_is_bot_only IS TRUE THEN
    v_ghost := 0;
  END IF;

  -- AUTO-ASIGNACIÓN DE BOT EN RANKED TRAS CUMPLIR LA VENTANA COMPLETA DE 30s
  IF v_fila.mode = 'ranked' AND v_esperado >= v_ghost THEN
    BEGIN
      v_claim_res := public.claim_ranked_async_opponent();
      IF (v_claim_res->>'matched')::BOOLEAN IS TRUE THEN
        RETURN jsonb_build_object(
          'matched', TRUE,
          'roomId', (v_claim_res->>'roomId')::UUID,
          'isAsyncMatch', TRUE
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'searching',        TRUE,
    'matched',          FALSE,
    'waitedSeconds',    v_esperado,
    'mode',             v_fila.mode,
    'sorteoEnSegundos', GREATEST(0, v_espera - v_esperado),
    'ghostAvailable',   (v_fila.mode = 'ranked' AND v_esperado >= v_ghost)
  );
END;
$function$;
