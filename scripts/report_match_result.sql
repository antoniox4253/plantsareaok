CREATE OR REPLACE FUNCTION public.report_match_result(p_room_id uuid, p_winner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid             UUID := auth.uid();
  v_room            RECORD;
  v_is_p1           BOOLEAN;
  v_p1_plants       INTEGER := 0;
  v_p2_plants       INTEGER := 0;
  v_p1_actions      INTEGER := 0;
  v_p2_actions      INTEGER := 0;
  v_p1_last_action  TIMESTAMPTZ;
  v_p2_last_action  TIMESTAMPTZ;
  v_decided_winner  UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala no encontrada: %', p_room_id; END IF;

  IF v_room.is_async_match THEN
    IF v_uid <> v_room.player1_id THEN
      RAISE EXCEPTION 'No participas en esta partida';
    END IF;
  ELSE
    IF v_uid NOT IN (v_room.player1_id, v_room.player2_id) THEN
      RAISE EXCEPTION 'No participas en esta partida';
    END IF;
  END IF;

  -- Si la sala ya fue liquidada, retornar el resultado consolidado
  IF v_room.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'ya_liquidada',
      'winner', v_room.server_winner_id,
      'elo', v_room.verification_payload->'elo',
      'vipGoldBonus', COALESCE((v_room.verification_payload->>'vipGoldBonus')::INTEGER, 0),
      'chest', v_room.verification_payload->'chest'
    );
  END IF;

  -- ── RAMA ASÍNCRONA: LIQUIDACIÓN DIRECTA Y DEFINITIVA ────────────────────────
  IF v_room.is_async_match IS TRUE THEN
    UPDATE public.game_rooms
       SET p1_reported_winner = p_winner_id,
           p1_reported_at = COALESCE(p1_reported_at, NOW()),
           verification_status = 'verifying'
     WHERE id = p_room_id;

    IF p_winner_id = v_room.player1_id THEN
      RETURN public.settle_verified_async_ranked_match(
        p_room_id,
        1::SMALLINT,
        jsonb_build_object('source', 'client_report', 'reportedWinner', p_winner_id)
      );
    ELSE
      RETURN public.settle_verified_async_ranked_match(
        p_room_id,
        2::SMALLINT,
        jsonb_build_object('source', 'client_report', 'reportedWinner', p_winner_id)
      );
    END IF;
  END IF;

  -- ── RAMA SÍNCRONA (PVP HUMANO VS HUMANO) ────────────────────────────────────
  IF p_winner_id IS NOT NULL AND p_winner_id NOT IN (v_room.player1_id, v_room.player2_id) THEN
    RAISE EXCEPTION 'Ganador inválido para la sala: %', p_winner_id;
  END IF;

  v_is_p1 := (v_uid = v_room.player1_id);

  IF v_is_p1 THEN
    IF v_room.p1_reported_at IS NOT NULL AND v_room.p1_reported_winner IS DISTINCT FROM p_winner_id THEN
      RAISE EXCEPTION 'No puedes cambiar tu reporte';
    END IF;
    UPDATE public.game_rooms
       SET p1_reported_winner = p_winner_id,
           p1_reported_at = COALESCE(p1_reported_at, NOW())
     WHERE id = p_room_id;
    v_room.p1_reported_winner := p_winner_id;
    v_room.p1_reported_at := COALESCE(v_room.p1_reported_at, NOW());
  ELSE
    IF v_room.p2_reported_at IS NOT NULL AND v_room.p2_reported_winner IS DISTINCT FROM p_winner_id THEN
      RAISE EXCEPTION 'No puedes cambiar tu reporte';
    END IF;
    UPDATE public.game_rooms
       SET p2_reported_winner = p_winner_id,
           p2_reported_at = COALESCE(p2_reported_at, NOW())
     WHERE id = p_room_id;
    v_room.p2_reported_winner := p_winner_id;
    v_room.p2_reported_at := COALESCE(v_room.p2_reported_at, NOW());
  END IF;

  -- ── REGLA MAESTRA DE CONCESIÓN / DERROTA UNILATERAL INMEDIATA ───────────────
  -- Si el jugador que reporta reconoce que su RIVAL ganó (admitiendo derrota o concediendo),
  -- NO hay ninguna duda técnica ni motivo para esperar al rival. Se liquida DE INMEDIATO.
  IF v_is_p1 AND p_winner_id = v_room.player2_id THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por concesión/reconocimiento del jugador 1'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.player2_id);
  ELSIF (NOT v_is_p1) AND p_winner_id = v_room.player1_id THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por concesión/reconocimiento del jugador 2'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.player1_id);
  END IF;

  -- Auditar match_actions para desempate y evaluación de desconexión
  SELECT
    COUNT(*) FILTER (WHERE user_id = v_room.player1_id AND kind = 'plant'),
    COUNT(*) FILTER (WHERE user_id = v_room.player2_id AND kind = 'plant'),
    COUNT(*) FILTER (WHERE user_id = v_room.player1_id),
    COUNT(*) FILTER (WHERE user_id = v_room.player2_id),
    MAX(created_at) FILTER (WHERE user_id = v_room.player1_id),
    MAX(created_at) FILTER (WHERE user_id = v_room.player2_id)
  INTO
    v_p1_plants, v_p2_plants,
    v_p1_actions, v_p2_actions,
    v_p1_last_action, v_p2_last_action
  FROM public.match_actions
  WHERE room_id = p_room_id;

  -- CASO A: AMBOS JUGADORES HAN REPORTADO
  IF v_room.p1_reported_at IS NOT NULL AND v_room.p2_reported_at IS NOT NULL THEN
    -- Consenso mutuo legítimo
    IF v_room.p1_reported_winner IS NOT NULL AND v_room.p1_reported_winner = v_room.p2_reported_winner THEN
      RETURN public._settle_room(p_room_id, v_room.p1_reported_winner);
    END IF;

    -- Si ambos reportaron pero discrepan (o uno se desincronizó):
    -- NUNCA MARCAR EMPATE (draw). Desempatar por dominancia y presencia activa en servidor.
    IF v_p1_plants > v_p2_plants THEN
      v_decided_winner := v_room.player1_id;
    ELSIF v_p2_plants > v_p1_plants THEN
      v_decided_winner := v_room.player2_id;
    ELSIF v_p1_last_action IS NOT NULL AND v_p2_last_action IS NOT NULL AND v_p1_last_action > v_p2_last_action + INTERVAL '3 seconds' THEN
      v_decided_winner := v_room.player1_id;
    ELSIF v_p2_last_action IS NOT NULL AND v_p1_last_action IS NOT NULL AND v_p2_last_action > v_p1_last_action + INTERVAL '3 seconds' THEN
      v_decided_winner := v_room.player2_id;
    ELSIF v_p1_actions > v_p2_actions THEN
      v_decided_winner := v_room.player1_id;
    ELSIF v_p2_actions > v_p1_actions THEN
      v_decided_winner := v_room.player2_id;
    ELSE
      -- Si todo es idéntico, gana quien reportó primero la victoria
      v_decided_winner := CASE WHEN v_room.p1_reported_at <= v_room.p2_reported_at THEN v_room.player1_id ELSE v_room.player2_id END;
    END IF;

    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por dominancia y actividad tras reporte discrepante'
     WHERE id = p_room_id;

    RETURN public._settle_room(p_room_id, v_decided_winner);
  END IF;

  -- CASO B: SÓLO UNO HA REPORTADO (DESCONEXIÓN DEL RIVAL)
  IF v_room.p1_reported_at IS NOT NULL AND v_room.p2_reported_at IS NULL THEN
    IF v_room.p1_reported_winner = v_room.player1_id THEN
      -- Si el rival nunca puso plantas o no ha reportado tras 10 segundos, victoria inmediata
      IF v_p2_plants = 0
         OR v_room.p1_reported_at <= NOW() - INTERVAL '10 seconds'
         OR (v_p2_last_action IS NOT NULL AND v_p1_last_action > v_p2_last_action + INTERVAL '10 seconds') THEN
        UPDATE public.game_rooms
           SET verification_note = 'Victoria autoritativa por desconexión/abandono del rival'
         WHERE id = p_room_id;
        RETURN public._settle_room(p_room_id, v_room.player1_id);
      END IF;
    END IF;
  END IF;

  IF v_room.p2_reported_at IS NOT NULL AND v_room.p1_reported_at IS NULL THEN
    IF v_room.p2_reported_winner = v_room.player2_id THEN
      IF v_p1_plants = 0
         OR v_room.p2_reported_at <= NOW() - INTERVAL '10 seconds'
         OR (v_p1_last_action IS NOT NULL AND v_p2_last_action > v_p1_last_action + INTERVAL '10 seconds') THEN
        UPDATE public.game_rooms
           SET verification_note = 'Victoria autoritativa por desconexión/abandono del rival'
         WHERE id = p_room_id;
        RETURN public._settle_room(p_room_id, v_room.player2_id);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'status', 'esperando_al_rival');
END;
$function$
