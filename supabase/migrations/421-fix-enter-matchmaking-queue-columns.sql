-- ==============================================================================
-- Migración 421: Corrección Crítica en enter_matchmaking y _emparejar_lote
-- ==============================================================================
-- Problema detectado:
-- Funciones en producción hacían referencia a columnas inexistentes:
-- 1. enter_matchmaking insertaba en matchmaking_queue con:
--    (user_id, mode, bet_amount, use_ticket, engine_version, tournament_id, room_code, status, created_at, updated_at)
--    arrojando el error fatal:
--    "column 'bet_amount' of relation 'matchmaking_queue' does not exist"
--    además de asignar status = 'waiting' (en vez de 'searching') y retornar check_matchmaking() (inexistente).
-- 2. _emparejar_lote hacía INSERT directo a game_rooms con "bet_amount" y "room_code"
--    (inexistentes en game_rooms) y UPDATE matchmaking_queue SET room_id (inexistente, debe ser matched_room_id),
--    en lugar de llamar a la función autoritativa public._create_room.
--
-- Solución:
-- 1. Restaurar enter_matchmaking con las 13 columnas autoritativas de matchmaking_queue:
--    (user_id, mode, elo_rating, user_elo, elo, status, colosseum_bet, tournament_id, room_code, client_engine_version, created_at, updated_at, last_seen_at)
--    status 'searching', gatekeeper de energía (15 sin pase / 20 VIP), y ejecución de _emparejar_lote.
-- 2. Restaurar _emparejar_lote para que invoque public._create_room y asigne matched_room_id,
--    preservando los rangos calibrados de arenas de Temporada 3 (8000, 5001-8000, 5000, 3000, 1600).
-- ==============================================================================

BEGIN;

-- ── 1. CORREGIR _emparejar_lote ──────────────────────────────────────────────
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
           -- 1. Arena 5 (8,001+ copas): Todos contra todos en Arena 5
           OR (p_mode = 'ranked' AND v_fila.user_elo > 8000 AND q.user_elo > 8000)
           -- 2. Arena 4 (5,001 a 8,000 copas): Todos contra todos en Arena 4
           OR (p_mode = 'ranked' AND (v_fila.user_elo BETWEEN 5001 AND 8000) AND (q.user_elo BETWEEN 5001 AND 8000))
           -- 3. Cruce Arenas Altas (ambos > 5,000 copas): permitido tras 10s o en pasada 2
           OR (
             p_mode = 'ranked'
             AND v_fila.user_elo > 5000
             AND q.user_elo > 5000
             AND (
               v_pasada = 2
               OR EXTRACT(EPOCH FROM (NOW() - q.created_at)) >= 10
               OR EXTRACT(EPOCH FROM (NOW() - v_fila.created_at)) >= 10
             )
           )
           -- 4. Arenas Bajas (ambos <= 5,000 copas):
           -- NUNCA cruzar con Arena 4 o 5 (> 5,000)
           -- NUNCA cruzar Arena 1 (<= 1,600) con Arena 3 o superior (> 3,000)
           OR (
             p_mode = 'ranked'
             AND v_fila.user_elo <= 5000
             AND q.user_elo <= 5000
             AND NOT (v_fila.user_elo <= 1600 AND q.user_elo > 3000)
             AND NOT (q.user_elo <= 1600 AND v_fila.user_elo > 3000)
             AND (
               (v_pasada = 2 AND EXTRACT(EPOCH FROM (NOW() - q.created_at)) >= 10 AND ABS(q.user_elo - v_fila.user_elo) <= 500)
               OR ABS(q.user_elo - v_fila.user_elo) <= GREATEST(
                    v_fila.banda,
                    LEAST(v_tope, v_inicio + v_paso *
                      (EXTRACT(EPOCH FROM (NOW() - q.created_at))::INTEGER / GREATEST(1, v_cada)))
                  )
             )
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

GRANT EXECUTE ON FUNCTION public._emparejar_lote(text, numeric, text, uuid) TO authenticated, service_role;

-- ── 2. CORREGIR enter_matchmaking ───────────────────────────────────────────
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
  v_max_en                   INTEGER := 15;
  v_cur_en                   INTEGER := 15;
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

    v_max_en := CASE WHEN COALESCE(v_user_prof.has_vip_pass, FALSE) THEN 20 ELSE 15 END;

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
      PERFORM public._refund_room_energy(v_room_record.id, 'Reembolso de 1 energía: sala expirada o abandonada');
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

  -- ── ENCOLAR EN MATCHMAKING_QUEUE (COLUMNAS FÍSICAS CANÓNICAS) ──────────────
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

GRANT EXECUTE ON FUNCTION public.enter_matchmaking(text, numeric, boolean, text, text, uuid) TO authenticated, service_role;

-- ── 3. REGISTRO EN AUDITORÍA DE MIGRACIONES ─────────────────────────────────
INSERT INTO public._migration_audit (fase, detalle, ejecutado_en)
VALUES (
  '421-fix-enter-matchmaking-queue-columns',
  jsonb_build_object(
    'descripcion', 'Corrección crítica de enter_matchmaking y _emparejar_lote: eliminación de columnas inexistentes bet_amount, use_ticket, room_id y room_code en matchmaking_queue y game_rooms, restauración de _create_room autoritativo y columnas canónicas (colosseum_bet, matched_room_id, client_engine_version, searching).'
  ),
  NOW()
);

COMMIT;
