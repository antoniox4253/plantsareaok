-- Migración 383: Eliminación definitiva de bloqueos por desconexión (Leaver Buster)
-- y restauración de todos los usuarios bloqueados para que puedan jugar.

-- 1. Desactivar _apply_disconnect_penalty para que nunca aplique bloqueos ni strikes
CREATE OR REPLACE FUNCTION public._apply_disconnect_penalty(
  p_user_id UUID,
  p_penalty_copas INTEGER DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Bloqueos y sanciones temporales por desconexión desactivados a petición.
  -- No se imponen strikes, no se aplica matchmaking_banned_until ni penalización extra de copas.
  RETURN jsonb_build_object(
    'success', TRUE,
    'disabled', TRUE,
    'message', 'Bloqueos por desconexión desactivados'
  );
END;
$function$;

-- 2. Actualizar enter_matchmaking para eliminar la validación de bloqueos de desconexión
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
  SELECT is_banned, ban_reason, unban_at, is_bot_only, elo_rating
    INTO v_is_banned, v_ban_reason, v_unban_at, v_is_bot_only, v_elo
    FROM public.profiles
   WHERE id = v_uid;

  -- ── BLOQUEO PERMANENTE O SANCIÓN ADMINISTRATIVA (Sin bloqueos de desconexión) ──
  IF COALESCE(v_is_banned, FALSE) = TRUE THEN
    IF v_unban_at IS NOT NULL AND v_unban_at <= v_now THEN
      -- Sanción temporal administrativa cumplida: levantar ban automáticamente
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

  -- NOTA: Se eliminó intencionalmente el bloqueo temporal por desconexiones (Leaver Buster).
  -- Ya no hay bloqueos de matchmaking_banned_until.

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

-- 3. Limpiar todos los bloqueos temporales de matchmaking y strikes en profiles
UPDATE public.profiles
   SET matchmaking_banned_until = NULL,
       disconnect_strikes = 0,
       updated_at = NOW()
 WHERE matchmaking_banned_until IS NOT NULL
    OR disconnect_strikes > 0;

-- 4. Levantar suspensiones a los usuarios bloqueados por desconexión o abandono
UPDATE public.profiles
   SET is_banned = FALSE,
       ban_reason = NULL,
       unban_at = NULL,
       matchmaking_banned_until = NULL,
       disconnect_strikes = 0,
       updated_at = NOW()
 WHERE ban_reason ILIKE '%desconex%'
    OR ban_reason ILIKE '%abandono%'
    OR ban_reason ILIKE '%leaver%'
    OR ban_reason ILIKE '%rendic%';
