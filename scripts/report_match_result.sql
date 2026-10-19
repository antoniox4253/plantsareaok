CREATE OR REPLACE FUNCTION public.report_match_result(p_room_id uuid, p_winner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  v_room       RECORD;
  v_is_p1      BOOLEAN;
  v_p1_plants  INTEGER := 0;
  v_p2_plants  INTEGER := 0;
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

  -- CASO A: AMBOS JUGADORES HAN REPORTADO
  IF v_room.p1_reported_at IS NOT NULL AND v_room.p2_reported_at IS NOT NULL THEN
    IF v_room.p1_reported_winner IS NOT NULL AND v_room.p1_reported_winner = v_room.p2_reported_winner THEN
      RETURN public._settle_room(p_room_id, v_room.p1_reported_winner);
    END IF;

    IF v_room.p1_reported_winner IS NULL AND v_room.p2_reported_winner IS NULL THEN
      UPDATE public.game_rooms
         SET status = 'draw',
             settled_at = NOW(),
             server_winner_id = NULL,
             verification_status = 'verified',
             verification_note = 'Empate tácito por consenso mutuo verificado'
       WHERE id = p_room_id;

      RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'empate',
        'mode', v_room.mode,
        'eloGained', 0,
        'eloLost', 0,
        'eloDelta', 0,
        'payout', 0
      );
    END IF;

    -- Discrepancia real entre reportes
    UPDATE public.game_rooms 
       SET status = 'draw',
           settled_at = NOW(),
           verification_status = 'disputed',
           verification_note = 'Reportes de clientes discrepantes'
     WHERE id = p_room_id;

    IF v_room.mode = 'ranked' THEN
      UPDATE public.profiles p
         SET energy_current = LEAST(CASE WHEN COALESCE(p.has_vip_pass, FALSE) THEN 25 ELSE 20 END, COALESCE(p.energy_current, 0) + 1),
             updated_at = NOW()
       WHERE p.id IN (v_room.player1_id, v_room.player2_id);

      BEGIN
        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        SELECT p.id, 'energy_refund', 0, 'Reembolso de 1 energía por partida en arbitraje (disputa técnica)', 'completed'
          FROM public.profiles p
         WHERE p.id IN (v_room.player1_id, v_room.player2_id);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    RETURN jsonb_build_object('success', FALSE, 'status', 'resultado_en_disputa', 'refunded', TRUE);
  END IF;

  -- CASO B: SÓLO UNO HA REPORTADO (RESOLUCIÓN POR ABANDONO O DESCONEXIÓN)
  IF v_room.p1_reported_at IS NOT NULL AND v_room.p2_reported_at IS NULL THEN
    IF v_room.p1_reported_winner = v_room.player1_id THEN
      SELECT COUNT(*) INTO v_p2_plants
        FROM public.match_actions
       WHERE room_id = p_room_id AND user_id = v_room.player2_id AND kind = 'plant';

      IF (v_p2_plants = 0 AND v_room.p1_reported_at <= NOW() - INTERVAL '8 seconds')
         OR (v_p2_plants > 0 AND v_room.p1_reported_at <= NOW() - INTERVAL '30 seconds') THEN
        UPDATE public.game_rooms
           SET verification_note = CASE 
                 WHEN v_p2_plants = 0 THEN 'Victoria por abandono/desconexión del rival (rival sin plantas)'
                 ELSE 'Victoria por abandono o desconexión del rival (>30s sin reporte)'
               END
         WHERE id = p_room_id;
        RETURN public._settle_room(p_room_id, v_room.player1_id);
      END IF;
    END IF;
  END IF;

  IF v_room.p2_reported_at IS NOT NULL AND v_room.p1_reported_at IS NULL THEN
    IF v_room.p2_reported_winner = v_room.player2_id THEN
      SELECT COUNT(*) INTO v_p1_plants
        FROM public.match_actions
       WHERE room_id = p_room_id AND user_id = v_room.player1_id AND kind = 'plant';

      IF (v_p1_plants = 0 AND v_room.p2_reported_at <= NOW() - INTERVAL '8 seconds')
         OR (v_p1_plants > 0 AND v_room.p2_reported_at <= NOW() - INTERVAL '30 seconds') THEN
        UPDATE public.game_rooms
           SET verification_note = CASE 
                 WHEN v_p1_plants = 0 THEN 'Victoria por abandono/desconexión del rival (rival sin plantas)'
                 ELSE 'Victoria por abandono o desconexión del rival (>30s sin reporte)'
               END
         WHERE id = p_room_id;
        RETURN public._settle_room(p_room_id, v_room.player2_id);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'status', 'esperando_al_rival');
END;
$function$
