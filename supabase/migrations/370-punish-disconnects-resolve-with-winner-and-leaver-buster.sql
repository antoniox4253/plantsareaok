-- ==============================================================================
-- MIGRACIÓN 370: SANCIONES CONTRA RAGE-QUITS / DESCONEXIÓN, RESOLUCIÓN OBLIGATORIA
--                CON GANADOR Y SISTEMA LEAVER BUSTER CON PÉRDIDA AGRAVADA DE COPAS
-- ==============================================================================
-- 1. Añade columnas de tracking de abandono y cooldown a profiles:
--    - matchmaking_banned_until TIMESTAMPTZ
--    - disconnect_strikes INTEGER DEFAULT 0
--    - last_disconnect_at TIMESTAMPTZ
-- 2. Crea _apply_disconnect_penalty(user_id, extra_copas):
--    - Suma strikes progresivos (1: 5min, 2: 15min, 3: 1h, 4+: 12h).
--    - Deduce copas adicionales al jugador sancionado.
-- 3. Crea _settle_async_abandoned_loss(room_id, user_id):
--    - Toda partida asíncrona abandonada en combate se liquida con GANADOR (p2_won).
--    - Deduce copas de derrota (-30) + penalización (-15), sin reembolso de energía.
-- 4. Modifica _settle_if_abandoned:
--    - Partidas asíncronas con acciones canalizadas a derrota autoritativa con ganador.
--    - Partidas PvP humanas siempre resueltas con ganador para el jugador activo/superviviente.
-- 5. Modifica _settle_room:
--    - El ganador que se queda recibe su victoria (+copas, cofre, BP XP).
--    - El perdedor que se desconecta recibe pérdida de copas agravada y strike.
-- 6. Modifica enter_matchmaking:
--    - Bloquea cuentas baneadas (is_banned) y jugadores bajo cooldown por desconexión.
-- ==============================================================================

BEGIN;

-- ── 1. COLUMNAS DE LEAVER BUSTER EN PROFILES ──────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS matchmaking_banned_until TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disconnect_strikes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_disconnect_at TIMESTAMPTZ DEFAULT NULL;

-- ── 2. FUNCIÓN DE PENALIZACIÓN Y BLOQUEO POR DESCONEXIÓN / ABANDONO ────────────
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
  v_cooldown_mins  INTEGER := 5;
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

  -- Escalera de bloqueo temporal (Leaver Buster)
  IF v_new_strikes = 1 THEN
    v_cooldown_mins := 5;
  ELSIF v_new_strikes = 2 THEN
    v_cooldown_mins := 15;
  ELSIF v_new_strikes = 3 THEN
    v_cooldown_mins := 60;
  ELSE
    v_cooldown_mins := 720; -- 12 Horas para reincidentes crónicos
  END IF;

  v_cooldown_until := NOW() + make_interval(mins => v_cooldown_mins);

  -- Deducción agravada de copas por desconexión / bloqueo
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

-- ── 3. LIQUIDAR DERROTA ASÍNCRONA POR ABANDONO EN COMBATE ─────────────────────
CREATE OR REPLACE FUNCTION public._settle_async_abandoned_loss(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room            RECORD;
  v_prof            RECORD;
  v_opponent_rating INTEGER;
  v_delta           INTEGER;
  v_elo_after       INTEGER;
  v_penalty_res     JSONB;
  v_audit           JSONB;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'sala_no_encontrada');
  END IF;

  IF v_room.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'status', 'ya_liquidada');
  END IF;

  SELECT elo_rating INTO v_prof FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  v_opponent_rating := COALESCE(v_room.async_rating_snapshot, 1000);

  -- Pérdida estándar de ELO por derrota
  v_delta := public._ranked_elo_delta(COALESCE(v_prof.elo_rating, 1000), v_opponent_rating, 0.0);
  v_elo_after := GREATEST(0, COALESCE(v_prof.elo_rating, 1000) + v_delta);

  UPDATE public.profiles
     SET elo_rating = v_elo_after,
         updated_at = NOW()
   WHERE id = p_user_id;

  -- Penalización agravada de copas y bloqueo por abandono voluntario
  v_penalty_res := public._apply_disconnect_penalty(p_user_id, 15);

  -- Registrar derrota en estadísticas
  INSERT INTO public.ranked_player_stats (user_id, wins, losses, draws, updated_at)
  VALUES (p_user_id, 0, 1, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE
     SET losses = ranked_player_stats.losses + 1,
         updated_at = NOW();

  v_audit := jsonb_build_object(
    'reason', 'async_abandoned_by_player',
    'surrenderedBy', p_user_id,
    'eloBefore', v_prof.elo_rating,
    'eloLossBase', v_delta,
    'penaltyResult', v_penalty_res,
    'resolvedWithWinner', true,
    'winnerSide', 2
  );

  -- Se liquida con GANADOR DEFINITIVO (p2_won = rival semilla gana)
  UPDATE public.game_rooms
     SET status = 'p2_won',
         settled_at = NOW(),
         server_winner_id = NULL,
         verification_status = 'verified',
         verified_at = NOW(),
         verification_note = 'Derrota autoritativa por abandono/desconexión de partida asíncrona',
         verification_payload = v_audit
   WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'status', 'p2_won',
    'resolvedWithWinner', TRUE,
    'eloLostTotal', ABS(v_delta) + 15
  );
END;
$function$;

-- ── 4. ACTUALIZAR _SETTLE_IF_ABANDONED ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._settle_if_abandoned(p_room_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room                RECORD;
  v_p1_plants           INTEGER := 0;
  v_p2_plants           INTEGER := 0;
  v_p1_actions          INTEGER := 0;
  v_p2_actions          INTEGER := 0;
  v_p1_last_action      TIMESTAMPTZ;
  v_p2_last_action      TIMESTAMPTZ;
  v_now                 TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'sala_no_encontrada');
  END IF;

  IF v_room.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'status', 'ya_liquidada');
  END IF;

  -- CASO A: SALA ASÍNCRONA (RIVAL BOT/SEMILLA)
  IF COALESCE(v_room.is_async_match, FALSE) = TRUE THEN
    -- Auditar acciones de P1
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE kind = 'plant')
    INTO
      v_p1_actions, v_p1_plants
    FROM public.match_actions
    WHERE room_id = p_room_id AND user_id = v_room.player1_id;

    -- Si P1 colocó plantas, emitió acciones o el combate superó los 25s:
    -- Es un combate disputado abandonado: SE LIQUIDA CON GANADOR (p2_won) y sanción.
    IF v_p1_plants > 0 OR v_p1_actions >= 2 OR (v_room.created_at IS NOT NULL AND v_now > v_room.created_at + INTERVAL '25 seconds') THEN
      RETURN public._settle_async_abandoned_loss(p_room_id, v_room.player1_id);
    ELSE
      -- Fallo de handshake antes de comenzar
      UPDATE public.game_rooms
         SET status = 'abandoned',
             settled_at = v_now,
             verification_status = COALESCE(verification_status, 'failed'),
             verification_note = 'abandoned_handshake_before_playing'
       WHERE id = p_room_id;

      PERFORM public._refund_room_energy(p_room_id, 'Reembolso de 1 energía: partida asíncrona abortada antes de iniciar');
      RETURN jsonb_build_object('success', TRUE, 'status', 'abandoned', 'isAsync', TRUE);
    END IF;
  END IF;

  -- CASO B: SALA PVP HUMANA
  -- B1: Si uno de los dos ya reportó y el otro nunca respondió
  IF v_room.p1_reported_winner IS NOT NULL AND v_room.p2_reported_winner IS NULL THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por abandono/desconexión del rival (>15s sin reporte)'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.p1_reported_winner);
  ELSIF v_room.p2_reported_winner IS NOT NULL AND v_room.p1_reported_winner IS NULL THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por abandono/desconexión del rival (>15s sin reporte)'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.p2_reported_winner);
  ELSIF v_room.p1_reported_winner IS NOT NULL AND v_room.p2_reported_winner IS NOT NULL THEN
    IF v_room.p1_reported_winner = v_room.p2_reported_winner THEN
      RETURN public._settle_room(p_room_id, v_room.p1_reported_winner);
    END IF;
  END IF;

  -- Auditar match_actions
  SELECT
    COUNT(*) FILTER (WHERE user_id = v_room.player1_id),
    COUNT(*) FILTER (WHERE user_id = v_room.player1_id AND kind = 'plant'),
    MAX(created_at) FILTER (WHERE user_id = v_room.player1_id),
    COUNT(*) FILTER (WHERE user_id = v_room.player2_id),
    COUNT(*) FILTER (WHERE user_id = v_room.player2_id AND kind = 'plant'),
    MAX(created_at) FILTER (WHERE user_id = v_room.player2_id)
  INTO
    v_p1_actions, v_p1_plants, v_p1_last_action,
    v_p2_actions, v_p2_plants, v_p2_last_action
  FROM public.match_actions
  WHERE room_id = p_room_id;

  -- B2.1: Si P1 colocó plantas y P2 colocó 0 plantas
  IF v_p1_plants > 0 AND v_p2_plants = 0 THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por desconexión/abandono del rival (rival inactivo sin plantas)'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.player1_id);
  END IF;

  -- B2.2: Si P2 colocó plantas y P1 colocó 0 plantas
  IF v_p2_plants > 0 AND v_p1_plants = 0 THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por desconexión/abandono del rival (rival inactivo sin plantas)'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.player2_id);
  END IF;

  -- B2.3: Si uno realizó acciones y el otro NUNCA envió nada
  IF v_p1_actions > 0 AND v_p2_actions = 0 THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa: P2 nunca conectó ni realizó acciones'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.player1_id);
  ELSIF v_p2_actions > 0 AND v_p1_actions = 0 THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa: P1 nunca conectó ni realizó acciones'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.player2_id);
  END IF;

  -- B2.4: Si AMBOS colocaron plantas (combate real disputado)
  IF v_p1_plants > 0 AND v_p2_plants > 0 THEN
    -- Si uno se desconectó y dejó de emitir acciones > 15s antes que el otro
    IF v_p1_last_action IS NOT NULL AND v_p2_last_action IS NOT NULL THEN
      IF v_p1_last_action > v_p2_last_action + INTERVAL '15 seconds' THEN
        UPDATE public.game_rooms
           SET verification_note = 'Victoria autoritativa por desconexión del rival (P2 inactivo >15s)'
         WHERE id = p_room_id;
        RETURN public._settle_room(p_room_id, v_room.player1_id);
      ELSIF v_p2_last_action > v_p1_last_action + INTERVAL '15 seconds' THEN
        UPDATE public.game_rooms
           SET verification_note = 'Victoria autoritativa por desconexión del rival (P1 inactivo >15s)'
         WHERE id = p_room_id;
        RETURN public._settle_room(p_room_id, v_room.player2_id);
      END IF;
    END IF;

    -- Si ambos cesaron acciones casi al mismo tiempo (ej. base destruida):
    -- Quien tenga mayor dominancia en campo es coronado ganador
    IF v_p1_plants >= v_p2_plants + 3 THEN
      UPDATE public.game_rooms
         SET verification_note = 'Victoria autoritativa por dominancia en campo ante desync de reporte'
       WHERE id = p_room_id;
      RETURN public._settle_room(p_room_id, v_room.player1_id);
    ELSIF v_p2_plants >= v_p1_plants + 3 THEN
      UPDATE public.game_rooms
         SET verification_note = 'Victoria autoritativa por dominancia en campo ante desync de reporte'
       WHERE id = p_room_id;
      RETURN public._settle_room(p_room_id, v_room.player2_id);
    ELSE
      -- Combate parejo disputado sin reporte: Empate técnico limpio
      UPDATE public.game_rooms
         SET status = 'draw',
             settled_at = v_now,
             server_winner_id = NULL,
             verification_status = 'verified',
             verification_note = 'Empate técnico por desconexión/desync simultáneo (combate disputado)'
       WHERE id = p_room_id;

      PERFORM public._refund_room_energy(p_room_id, 'Reembolso de energía: empate por desync de reporte');
      RETURN jsonb_build_object('success', TRUE, 'status', 'draw', 'draw', TRUE, 'refunded', TRUE);
    END IF;
  END IF;

  -- ── CASO B3: INACTIVIDAD MUTUA TOTAL (0 PLANTAS Y 0 ACCIONES) ───────────────
  UPDATE public.game_rooms
     SET status = 'abandoned',
         settled_at = v_now,
         verification_status = COALESCE(verification_status, 'failed'),
         verification_note = COALESCE(verification_note, 'auto_settled_abandoned_both_inactive')
   WHERE id = p_room_id;

  PERFORM public._refund_room_energy(p_room_id, 'Reembolso de 1 energía: partida abandonada sin actividad');

  RETURN jsonb_build_object('success', TRUE, 'status', 'abandoned', 'refunded', TRUE);
END;
$function$;

-- ── 5. ACTUALIZAR _SETTLE_ROOM CON PÉRDIDA AGRAVADA POR DESCONEXIÓN ───────────
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
       WHERE matched_room_id = p_room_id
       LIMIT 1;
    END IF;

    IF v_tourn_id IS NOT NULL THEN
      SELECT max_losses INTO v_max_losses FROM public.tournaments WHERE id = v_tourn_id;
      v_max_losses := COALESCE(v_max_losses, 3);

      SELECT username INTO v_winner_name FROM public.profiles WHERE id = p_winner_id;
      SELECT username INTO v_loser_name FROM public.profiles WHERE id = v_perdedor;

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
      END IF;

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
      END IF;
    END IF;

    UPDATE public.game_rooms
       SET status = CASE WHEN p_winner_id = player1_id THEN 'p1_won' ELSE 'p2_won' END,
           settled_at = NOW(),
           server_winner_id = p_winner_id,
           verification_status = 'verified',
           verification_note = COALESCE(verification_note, 'Consenso mutuo verificado (Torneo)')
     WHERE id = p_room_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'liquidada',
      'winner', p_winner_id,
      'mode', 'tournament',
      'eloGained', 0,
      'eloLost', 0,
      'payout', 0
    );
  END IF;

  -- ── 2. MODO RANKED (PVP CLASIFICATORIO) ─────────────────────────────────────
  IF v_room.mode = 'ranked' THEN
    v_perdedor := CASE WHEN p_winner_id = v_room.player1_id THEN v_room.player2_id ELSE v_room.player1_id END;

    IF v_room.created_at IS NOT NULL THEN
      v_match_duration := EXTRACT(EPOCH FROM (NOW() - v_room.created_at));
    ELSE
      v_match_duration := 60;
    END IF;

    SELECT COUNT(*) INTO v_plants_count 
      FROM public.match_actions 
     WHERE room_id = p_room_id;

    IF v_perdedor IS NOT NULL THEN
      SELECT COUNT(*) INTO v_loser_plants
        FROM public.match_actions
       WHERE room_id = p_room_id AND user_id = v_perdedor AND kind = 'plant';
    END IF;

    -- Detección de derrota por abandono/desconexión del rival
    IF v_room.verification_note ILIKE '%abandono%'
       OR v_room.verification_note ILIKE '%desconexión%'
       OR v_room.verification_note ILIKE '%sin reporte%'
       OR (v_perdedor IS NOT NULL AND v_loser_plants = 0 AND v_plants_count > 0) THEN
      v_is_disconnect_loss := TRUE;
    ELSE
      v_is_disconnect_loss := FALSE;
    END IF;

    -- Lectura determinista de ELO
    IF v_room.player1_id < v_room.player2_id THEN
      SELECT elo_rating INTO v_elo_p1_before FROM public.profiles WHERE id = v_room.player1_id FOR UPDATE;
      IF v_room.player2_id IS NOT NULL THEN
        SELECT elo_rating INTO v_elo_p2_before FROM public.profiles WHERE id = v_room.player2_id FOR UPDATE;
      END IF;
    ELSE
      IF v_room.player2_id IS NOT NULL THEN
        SELECT elo_rating INTO v_elo_p2_before FROM public.profiles WHERE id = v_room.player2_id FOR UPDATE;
      END IF;
      SELECT elo_rating INTO v_elo_p1_before FROM public.profiles WHERE id = v_room.player1_id FOR UPDATE;
    END IF;

    v_elo_p1_before := COALESCE(v_elo_p1_before, 1000);
    v_elo_p2_before := COALESCE(v_elo_p2_before, 1000);

    v_delta_p1 := CASE WHEN p_winner_id = v_room.player1_id THEN public._ranked_elo_delta(v_elo_p1_before, v_elo_p2_before, 1.0) ELSE public._ranked_elo_delta(v_elo_p1_before, v_elo_p2_before, 0.0) END;
    v_delta_p2 := CASE WHEN p_winner_id = v_room.player2_id THEN public._ranked_elo_delta(v_elo_p2_before, v_elo_p1_before, 1.0) ELSE public._ranked_elo_delta(v_elo_p2_before, v_elo_p1_before, 0.0) END;

    -- REGLA CANÓNICA: EL GANADOR SIEMPRE RECIBE SUS COPAS Y RECOMPENSAS
    -- El jugador que permaneció en la partida NUNCA es castigado con 0 copas por culpa del abandono rival.
    v_elo_p1_after := GREATEST(0, v_elo_p1_before + v_delta_p1);
    v_elo_p2_after := GREATEST(0, v_elo_p2_before + v_delta_p2);

    UPDATE public.profiles
       SET elo_rating = v_elo_p1_after, updated_at = NOW()
     WHERE id = v_room.player1_id;

    IF v_room.player2_id IS NOT NULL THEN
      UPDATE public.profiles
         SET elo_rating = v_elo_p2_after, updated_at = NOW()
       WHERE id = v_room.player2_id;
    END IF;

    -- SANCIONES AGRAVADAS AL PERDEDOR POR DESCONEXIÓN / RAGE-QUIT
    IF v_is_disconnect_loss AND v_perdedor IS NOT NULL THEN
      -- Penalización extra de 15 copas + strike de bloqueo temporal en matchmaking
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

    -- Bono VIP de Oro
    BEGIN
      IF p_winner_id IS NOT NULL THEN
        SELECT public._award_vip_victory_gold(p_winner_id) INTO v_vip_gold;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_vip_gold := 0;
    END;

    -- Pase de Batalla XP
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

    -- SE LIQUIDA CON EL GANADOR DEFINITIVO (p1_won o p2_won)
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

  -- ── 3. MODO AMISTOSO / DUELOS ───────────────────────────────────────────────
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

-- ── 6. ACTUALIZAR ENTER_MATCHMAKING CON CHEQUEO DE BAN Y COOLDOWN LEAVER BUSTER ──
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
      SELECT id INTO v_tournament_id
        FROM public.tournaments
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 1;
    END IF;

    IF v_tournament_id IS NULL THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'sin_torneo_activo',
        'message', 'No hay ningún torneo en curso en este momento.'
      );
    END IF;

    SELECT * INTO v_tourn FROM public.tournaments WHERE id = v_tournament_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('matched', FALSE, 'searching', FALSE, 'error', 'torneo_no_existe');
    END IF;

    IF v_tourn.status = 'ended' OR v_tourn.status = 'cancelled' OR v_now >= v_tourn.end_time THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'torneo_finalizado',
        'message', 'El torneo ha concluido.'
      );
    END IF;

    SELECT * INTO v_tourn_part
      FROM public.tournament_participants
     WHERE tournament_id = v_tournament_id AND user_id = v_uid;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'matched', FALSE, 'searching', FALSE,
        'error', 'no_inscrito',
        'message', 'No estás registrado en este torneo.'
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

  -- ── VERIFICACIÓN Y COBRO DE ENERGÍA EN RANKED ─────────────────────────────
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

      -- Descontar 1 de energía de forma atómica
      UPDATE public.profiles
         SET energy_current = energy_current - 1,
             updated_at = v_now
       WHERE id = v_uid;
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
