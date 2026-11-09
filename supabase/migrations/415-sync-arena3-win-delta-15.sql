-- ==============================================================================
-- MIGRACIÓN 415: CALIBRAR DELTA DE VICTORIA EN ARENA 3 A +15 COPAS
-- Garantiza que tanto la asignación en DB como el modal reflejen exactamente +15 copas.
-- ==============================================================================

-- 1. ACTUALIZAR TABLA elo_rewards
UPDATE public.elo_rewards
   SET win_elo = 15
 WHERE max_elo = 5000;

-- 2. ACTUALIZAR FUNCIÓN AUTORITATIVA _ranked_elo_delta
CREATE OR REPLACE FUNCTION public._ranked_elo_delta(
  p_player_rating INTEGER,
  p_opponent_rating INTEGER,
  p_score NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_p           INTEGER;
  v_win_delta   INTEGER;
  v_lose_delta  INTEGER;
  v_nominal_new INTEGER;
  v_clamped_new INTEGER;
  v_final_delta INTEGER;
BEGIN
  v_p := GREATEST(0, COALESCE(p_player_rating, 1000));

  -- 1. Empate exacto (score ~ 0.5): 0 copas
  IF p_score > 0.4 AND p_score < 0.6 THEN
    RETURN 0;
  END IF;

  -- 2. Determinar ganancia / pérdida nominal por Arena calibrada
  IF v_p <= 1600 THEN
    -- Arena 1: Jardín Clásico (0 - 1600)
    v_win_delta  := 15;
    v_lose_delta := -5;
  ELSIF v_p <= 3000 THEN
    -- Arena 2: Desierto Nocturno (1601 - 3000)
    v_win_delta  := 18;
    v_lose_delta := -8;
  ELSIF v_p <= 5000 THEN
    -- Arena 3: Rascacielos Cyberpunk (3001 - 5000) -> Exacto +15 en victoria
    v_win_delta  := 15;
    v_lose_delta := -12;
  ELSIF v_p <= 8000 THEN
    -- Arena 4: Coliseo Galáctico (5001 - 8000)
    v_win_delta  := 25;
    v_lose_delta := -20;
  ELSE
    -- Arena 5: Olimpo de Leyendas (8001+)
    v_win_delta  := 30;
    v_lose_delta := -30;
  END IF;

  -- 3. Cálculo de victoria o derrota con piso absoluto en 0 copas
  IF p_score >= 1.0 THEN
    v_final_delta := v_win_delta;
  ELSE
    v_nominal_new := v_p + v_lose_delta;
    v_clamped_new := GREATEST(0, v_nominal_new);
    v_final_delta := v_clamped_new - v_p;
  END IF;

  RETURN v_final_delta;
END;
$$;

-- 3. ACTUALIZAR settle_verified_async_ranked_match
CREATE OR REPLACE FUNCTION public.settle_verified_async_ranked_match(
  p_room_id uuid,
  p_winner_side smallint,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_room             RECORD;
  v_elo_p1_before    INTEGER;
  v_opponent_rating  INTEGER;
  v_delta_p1         INTEGER;
  v_elo_p1_after     INTEGER;
  v_cofre            JSONB := NULL;
  v_vip_gold         INTEGER := 0;
  v_recent_wins      INTEGER;
  v_audit_elo        JSONB;
  v_uid              UUID := auth.uid();
  v_role             TEXT := COALESCE(auth.role(), '');
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala no encontrada: %', p_room_id; END IF;

  IF current_user <> 'postgres' AND v_role <> 'service_role' AND (v_uid IS NULL OR v_uid IS DISTINCT FROM v_room.player1_id) THEN
    RAISE EXCEPTION 'No autorizado para liquidar partida asíncrona';
  END IF;

  IF v_room.engine_version NOT IN ('auth-v1', 'auth-v2') THEN
    RAISE EXCEPTION 'Sala no autoritativa: %', v_room.engine_version;
  END IF;

  IF v_room.mode <> 'ranked' THEN
    RAISE EXCEPTION 'La sala no es ranked: %', v_room.mode;
  END IF;

  IF v_room.is_async_match IS NOT TRUE THEN
    RAISE EXCEPTION 'La sala no es asíncrona';
  END IF;

  IF v_room.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'ya_liquidada',
      'winner', v_room.server_winner_id,
      'winnerSide', CASE WHEN v_room.status = 'p1_won' THEN 1 WHEN v_room.status = 'p2_won' THEN 2 ELSE NULL END,
      'elo', v_room.verification_payload->'elo',
      'vipGoldBonus', COALESCE((v_room.verification_payload->>'vipGoldBonus')::INTEGER, 0)
    );
  END IF;

  IF p_winner_side NOT IN (1, 2) THEN
    RAISE EXCEPTION 'winner_side inválido: %', p_winner_side;
  END IF;

  SELECT elo_rating INTO v_elo_p1_before FROM public.profiles WHERE id = v_room.player1_id FOR UPDATE;
  v_elo_p1_before := COALESCE(v_elo_p1_before, 1000);
  v_opponent_rating := COALESCE(v_room.async_rating_snapshot, 1000);

  IF p_winner_side = 1 THEN
    v_delta_p1 := public._ranked_elo_delta(v_elo_p1_before, v_opponent_rating, 1.0);

    -- Escalado asíncrono según nuevo espectro de arenas
    IF v_elo_p1_before > 8000 THEN
      -- Arena 5: Máximo +6 copas por bot (PvP real da +30)
      v_delta_p1 := LEAST(v_delta_p1, 6);
    ELSIF v_elo_p1_before > 5000 THEN
      -- Arena 4: Máximo +10 copas por bot (PvP real da +25)
      v_delta_p1 := LEAST(v_delta_p1, 10);
    ELSIF v_elo_p1_before > 3000 THEN
      -- Arena 3: Exactamente +15 copas en victoria
      v_delta_p1 := LEAST(v_delta_p1, 15);
    END IF;

    v_elo_p1_after := GREATEST(0, v_elo_p1_before + v_delta_p1);

    SELECT COUNT(*) INTO v_recent_wins
      FROM public.game_rooms
     WHERE player1_id = v_room.player1_id
       AND is_async_match IS TRUE
       AND status = 'p1_won'
       AND settled_at > NOW() - INTERVAL '30 minutes';

    IF v_recent_wins < 5 THEN
      v_cofre := public._award_victory_chest_for(v_room.player1_id);
    ELSE
      v_cofre := jsonb_build_object('awarded', FALSE, 'reason', 'anti_farming_limite_alcanzado');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = v_room.player1_id
         AND has_vip_pass IS TRUE
         AND (vip_pass_expires_at IS NULL OR vip_pass_expires_at > NOW())
     ) THEN
      v_vip_gold := 50;
      UPDATE public.profiles
         SET gold_balance = COALESCE(gold_balance, 0) + v_vip_gold
       WHERE id = v_room.player1_id;
    END IF;

    UPDATE public.profiles
       SET elo_rating = v_elo_p1_after,
           updated_at = NOW()
     WHERE id = v_room.player1_id;

    v_audit_elo := jsonb_build_object(
      'before', v_elo_p1_before,
      'after', v_elo_p1_after,
      'delta', v_delta_p1
    );

    UPDATE public.game_rooms
       SET status = 'p1_won',
           server_winner_id = v_room.player1_id,
           settled_at = NOW(),
           verification_payload = jsonb_build_object(
             'elo', v_audit_elo,
             'chest', v_cofre,
             'vipGoldBonus', v_vip_gold,
             'clientPayload', p_payload
           ),
           verification_note = 'Partida asíncrona verificada y liquidada: victoria P1'
     WHERE id = p_room_id;

  ELSE
    -- Derrota P1
    v_delta_p1 := public._ranked_elo_delta(v_elo_p1_before, v_opponent_rating, 0.0);
    v_elo_p1_after := GREATEST(0, v_elo_p1_before + v_delta_p1);

    UPDATE public.profiles
       SET elo_rating = v_elo_p1_after,
           updated_at = NOW()
     WHERE id = v_room.player1_id;

    v_audit_elo := jsonb_build_object(
      'before', v_elo_p1_before,
      'after', v_elo_p1_after,
      'delta', v_delta_p1
    );

    UPDATE public.game_rooms
       SET status = 'p2_won',
           server_winner_id = v_room.player2_id,
           settled_at = NOW(),
           verification_payload = jsonb_build_object(
             'elo', v_audit_elo,
             'chest', NULL,
             'vipGoldBonus', 0,
             'clientPayload', p_payload
           ),
           verification_note = 'Partida asíncrona verificada y liquidada: derrota P1'
     WHERE id = p_room_id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'status', CASE WHEN p_winner_side = 1 THEN 'p1_won' ELSE 'p2_won' END,
    'winner', CASE WHEN p_winner_side = 1 THEN v_room.player1_id ELSE v_room.player2_id END,
    'winnerSide', p_winner_side,
    'elo', v_audit_elo,
    'chest', v_cofre,
    'vipGoldBonus', v_vip_gold
  );
END;
$$;
