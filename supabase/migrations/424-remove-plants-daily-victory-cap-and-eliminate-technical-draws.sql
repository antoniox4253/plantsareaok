-- ==============================================================================
-- Migración 424: Eliminación del tope artificial de victorias en Token PLANTS
-- y erradicación definitiva de empates técnicos en desconexiones PvP
-- ==============================================================================
-- 1. Token PLANTS: Se elimina el bloqueo artificial de "15/20 victorias máximas".
--    La energía diaria (15 Free / 20 VIP) es la regla única autoritativa que
--    regula las partidas jugadas. Cada partida ganada en Arena 3+ con energía otorga PLANTS.
-- 2. PvP Desconexiones: Se erradica status = 'draw' (empate técnico). Toda partida
--    disputada donde ocurra una desconexión o desync de reporte SIEMPRE termina
--    en VICTORIA para el jugador activo/dominante y DERROTA para el desconectado.
-- ==============================================================================

BEGIN;

-- ── 1. ACTUALIZAR claim_pvp_plants_reward SIN TOPE BLOQUEANTE DE VICTORIAS ─────
CREATE OR REPLACE FUNCTION public.claim_pvp_plants_reward(
  p_room_id uuid,
  p_match_duration_sec numeric,
  p_enemy_kills integer,
  p_suns_collected integer,
  p_plants_placed integer,
  p_enemy_plants_placed integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_room RECORD;
  v_prof RECORD;
  v_amm RECORD;
  v_base_score NUMERIC := 40.0;
  v_combat_score NUMERIC;
  v_econ_score NUMERIC;
  v_deploy_score NUMERIC;
  v_blitz_score NUMERIC := 0.0;
  v_total_score NUMERIC;
  v_base_reward NUMERIC;
  v_pvp_mult NUMERIC := 1.0;
  v_final_plants NUMERIC;
  v_era_factor NUMERIC := 1.0;
  v_daily_claims INTEGER;
  v_claims_date DATE;
  v_bonus_active BOOLEAN := false;
  v_is_bot BOOLEAN := false;
  v_is_vip BOOLEAN := false;
  v_spot NUMERIC;
  v_golden_count INTEGER := 0;
  v_golden_bonus_pct NUMERIC := 0.0;
  v_golden_mult NUMERIC := 1.0;
  v_effective_duration NUMERIC;
  v_effective_enemy_plants INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_room_id IS NULL THEN RAISE EXCEPTION 'ID de sala inválido'; END IF;

  -- 1. SEGURIDAD: Evitar doble reclamo de la misma sala
  IF EXISTS (SELECT 1 FROM public.plants_pvp_room_claims WHERE room_id = p_room_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'ROOM_ALREADY_CLAIMED',
      'error', 'La recompensa de esta partida ya fue reclamada.',
      'plantsAwarded', 0
    );
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;

  v_is_bot := COALESCE(v_room.is_async_match, false) OR (v_room.async_opponent_id IS NOT NULL);

  -- 2. Validar victoria
  IF v_room.status NOT IN ('p1_won', 'p2_won') THEN
    RAISE EXCEPTION 'La partida no terminó en victoria válida';
  END IF;

  IF v_room.player1_id = v_uid AND v_room.status <> 'p1_won' THEN
    RAISE EXCEPTION 'Solo las victorias otorgan PLANTS';
  ELSIF v_room.player2_id = v_uid AND v_room.status <> 'p2_won' THEN
    RAISE EXCEPTION 'Solo las victorias otorgan PLANTS';
  END IF;

  SELECT elo_rating, has_vip_pass, plants_daily_claims_count, plants_daily_claims_date
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  -- 3. Solo Arena 3+ (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ARENA_TOO_LOW', 'plantsAwarded', 0);
  END IF;

  -- 4. Anti-Collusion Resiliente: Duración efectiva combinando cliente y timestamp de base de datos
  v_effective_duration := GREATEST(
    COALESCE(p_match_duration_sec, 0),
    COALESCE(EXTRACT(EPOCH FROM (COALESCE(v_room.settled_at, NOW()) - v_room.created_at)), 0)
  );

  v_effective_enemy_plants := GREATEST(
    COALESCE(p_enemy_plants_placed, 0),
    COALESCE(p_enemy_kills, 0),
    CASE WHEN v_effective_duration >= 45.0 THEN 4 ELSE 0 END
  );

  IF v_effective_duration < 40.0 OR v_effective_enemy_plants < 4 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MATCH_TOO_SHORT_OR_COLLUSION', 'plantsAwarded', 0);
  END IF;

  v_is_vip := COALESCE(v_prof.has_vip_pass, false);

  -- 5. Contador Diario Informativo (SIN TOPE BLOQUEANTE: el límite de partidas lo regula 100% la energía)
  v_claims_date := COALESCE(v_prof.plants_daily_claims_date, CURRENT_DATE);
  v_daily_claims := COALESCE(v_prof.plants_daily_claims_count, 0);

  IF v_claims_date < CURRENT_DATE THEN
    v_daily_claims := 0;
    v_claims_date := CURRENT_DATE;
  END IF;

  -- 6. Rendimiento Competitivo (40 a 100 puntos)
  v_combat_score := LEAST(25.0, (GREATEST(COALESCE(p_enemy_kills, 0), 1) * 2.5));
  v_econ_score := LEAST(20.0, (GREATEST(COALESCE(p_suns_collected, 0), 50) * 0.04));
  v_deploy_score := LEAST(15.0, (GREATEST(COALESCE(p_plants_placed, 0), 2) * 1.5));
  IF v_effective_duration <= 120.0 THEN v_blitz_score := 5.0; END IF;

  v_total_score := LEAST(100.0, v_base_score + v_combat_score + v_econ_score + v_deploy_score + v_blitz_score);

  -- Recompensa base (2.0 a 6.0 PLANTS)
  v_base_reward := 2.0 + ((v_total_score - 40.0) / 60.0) * 4.0;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;

  -- 7. REGLA: CONTRA JUGADOR VS BOT
  IF v_is_bot THEN
    v_base_reward := v_base_reward * 0.5;
    v_pvp_mult := 1.0;
    v_bonus_active := false;
  ELSE
    IF v_amm.pvp_bonus_ends_at IS NOT NULL AND NOW() <= v_amm.pvp_bonus_ends_at THEN
      v_pvp_mult := 1.25;
      v_bonus_active := true;
    END IF;
  END IF;

  -- 8. Factor de Halving
  IF v_amm.current_halving_era = 2 THEN v_era_factor := 0.5;
  ELSIF v_amm.current_halving_era = 3 THEN v_era_factor := 0.25;
  ELSIF v_amm.current_halving_era = 4 THEN v_era_factor := 0.125;
  ELSIF v_amm.current_halving_era >= 5 THEN v_era_factor := 0.0625;
  END IF;

  -- 8.1 BONIFICADOR DE CARTAS DORADAS
  SELECT COUNT(*) INTO v_golden_count
    FROM jsonb_to_recordset(public._active_deck(v_uid)) AS d("isGolden" BOOLEAN)
   WHERE d."isGolden" = TRUE;

  v_golden_count := LEAST(6, COALESCE(v_golden_count, 0));
  v_golden_bonus_pct := v_golden_count * 10.0;
  v_golden_mult := 1.0 + (v_golden_bonus_pct / 100.0);

  v_final_plants := ROUND(v_base_reward * v_pvp_mult * v_era_factor * v_golden_mult, 2);
  v_spot := v_amm.usdt_pool / v_amm.virtual_plants;

  -- 9. Registrar reclamo de sala
  INSERT INTO public.plants_pvp_room_claims (room_id, user_id, plants_awarded)
  VALUES (p_room_id, v_uid, v_final_plants);

  -- 10. Acreditar saldo en profiles
  UPDATE public.profiles
  SET
    plants_balance = COALESCE(plants_balance, 0) + v_final_plants,
    plants_daily_claims_count = v_daily_claims + 1,
    plants_daily_claims_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = v_uid;

  -- 11. Impacto en AMM
  UPDATE public.plants_amm_state
  SET
    virtual_plants = virtual_plants + v_final_plants,
    total_minted = total_minted + v_final_plants,
    updated_at = NOW()
  WHERE id = 1;

  INSERT INTO public.plants_price_history (spot_price_usdt, total_supply_plants, usdt_pool, reason)
  VALUES (
    v_spot,
    v_amm.virtual_plants + v_final_plants,
    v_amm.usdt_pool,
    CASE WHEN v_is_bot THEN 'pvp_bot_reward' ELSE 'pvp_match_reward' END
  );

  RETURN jsonb_build_object(
    'success', true,
    'plantsAwarded', v_final_plants,
    'score', v_total_score,
    'baseReward', v_base_reward,
    'isLivePvP', NOT v_is_bot,
    'isBotMatch', v_is_bot,
    'pvpMultiplier', v_pvp_mult,
    'bonusActive', v_bonus_active,
    'halvingEra', v_amm.current_halving_era,
    'halvingFactor', v_era_factor,
    'dailyClaimsUsed', v_daily_claims + 1,
    'isVip', v_is_vip,
    'goldenCardsCount', v_golden_count,
    'goldenBonusPct', v_golden_bonus_pct
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_pvp_plants_reward(uuid, numeric, integer, integer, integer, integer) TO authenticated, anon, service_role;


-- ── 2. ACTUALIZAR report_match_result: ERRADICAR EMPATES Y RESOLVER DESCONEXIONES ──
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

  -- REGLA 1: CONCESIÓN / DERROTA ADMITIDA INMEDIATA
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

  RETURN jsonb_build_object('success', TRUE, 'status', 'pending_opponent_report');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.report_match_result(uuid, uuid) TO authenticated, anon, service_role;


-- ── 3. ACTUALIZAR _settle_if_abandoned: ELIMINAR STATUS = 'draw' ───────────────
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
  v_decided_winner      UUID;
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
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE kind = 'plant')
    INTO
      v_p1_actions, v_p1_plants
    FROM public.match_actions
    WHERE room_id = p_room_id AND user_id = v_room.player1_id;

    IF v_p1_plants > 0 OR v_p1_actions >= 2 OR (v_room.created_at IS NOT NULL AND v_now > v_room.created_at + INTERVAL '25 seconds') THEN
      RETURN public._settle_async_abandoned_loss(p_room_id, v_room.player1_id);
    ELSE
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
  -- B1: Si uno reportó y el otro no (desconexión del rival)
  IF v_room.p1_reported_winner IS NOT NULL AND v_room.p2_reported_winner IS NULL THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por desconexión del rival (>12s sin reporte)'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.p1_reported_winner);
  ELSIF v_room.p2_reported_winner IS NOT NULL AND v_room.p1_reported_winner IS NULL THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por desconexión del rival (>12s sin reporte)'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.p2_reported_winner);
  ELSIF v_room.p1_reported_winner IS NOT NULL AND v_room.p2_reported_winner IS NOT NULL THEN
    IF v_room.p1_reported_winner = v_room.p2_reported_winner THEN
      RETURN public._settle_room(p_room_id, v_room.p1_reported_winner);
    END IF;
  END IF;

  -- Auditar acciones de combate
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

  -- B2.1: Si P1 colocó plantas y P2 colocó 0
  IF v_p1_plants > 0 AND v_p2_plants = 0 THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa: rival desconectado sin plantas'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.player1_id);
  END IF;

  -- B2.2: Si P2 colocó plantas y P1 colocó 0
  IF v_p2_plants > 0 AND v_p1_plants = 0 THEN
    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa: rival desconectado sin plantas'
     WHERE id = p_room_id;
    RETURN public._settle_room(p_room_id, v_room.player2_id);
  END IF;

  -- B2.3: Si ambos combatieron (pusieron plantas o emitieron acciones):
  -- DESEMPATE AUTORITATIVO OBLIGATORIO: NUNCA STATUS = 'draw'
  IF v_p1_plants > 0 OR v_p2_plants > 0 OR v_p1_actions > 0 OR v_p2_actions > 0 THEN
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
      v_decided_winner := v_room.player1_id;
    END IF;

    UPDATE public.game_rooms
       SET verification_note = 'Victoria autoritativa por desempate técnico en combate disputado'
     WHERE id = p_room_id;

    RETURN public._settle_room(p_room_id, v_decided_winner);
  END IF;

  -- B3: Inactividad mutua absoluta (0 plantas y 0 acciones de ambos)
  UPDATE public.game_rooms
     SET status = 'abandoned',
         settled_at = v_now,
         verification_status = COALESCE(verification_status, 'failed'),
         verification_note = 'auto_settled_abandoned_no_combat_activity'
   WHERE id = p_room_id;

  PERFORM public._refund_room_energy(p_room_id, 'Reembolso de 1 energía: partida abandonada sin actividad');
  RETURN jsonb_build_object('success', TRUE, 'status', 'abandoned', 'refunded', TRUE);
END;
$function$;

GRANT EXECUTE ON FUNCTION public._settle_if_abandoned(uuid) TO authenticated, anon, service_role;


-- ── 4. ACTUALIZAR mark_match_verification_failed: EVITAR FALSOS ABANDONOS ────
CREATE OR REPLACE FUNCTION public.mark_match_verification_failed(
  p_room_id uuid,
  p_note text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room RECORD;
  v_p1_base NUMERIC;
  v_p2_base NUMERIC;
  v_p1_plants INTEGER := 0;
  v_p2_plants INTEGER := 0;
  v_decided_winner UUID;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Sólo service_role';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala no encontrada'; END IF;

  IF v_room.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', TRUE, 'alreadySettled', TRUE);
  END IF;

  -- RESCATE 1: Si uno o ambos reportaron ganador
  IF v_room.p1_reported_winner IS NOT NULL AND v_room.p1_reported_winner = v_room.p2_reported_winner THEN
    RETURN public.settle_verified_match(
      p_room_id,
      v_room.p1_reported_winner,
      COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
        'rescuedFromVerificationFailed', TRUE,
        'rescueReason', 'client_consensus_matches'
      )
    );
  ELSIF v_room.p1_reported_winner IS NOT NULL AND v_room.p2_reported_winner IS NULL THEN
    RETURN public.settle_verified_match(
      p_room_id,
      v_room.p1_reported_winner,
      COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
        'rescuedFromVerificationFailed', TRUE,
        'rescueReason', 'unilateral_p1_report'
      )
    );
  ELSIF v_room.p2_reported_winner IS NOT NULL AND v_room.p1_reported_winner IS NULL THEN
    RETURN public.settle_verified_match(
      p_room_id,
      v_room.p2_reported_winner,
      COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
        'rescuedFromVerificationFailed', TRUE,
        'rescueReason', 'unilateral_p2_report'
      )
    );
  END IF;

  -- RESCATE 2: Destrucción de base comprobada en payload
  BEGIN
    v_p1_base := COALESCE((p_payload->'bases'->>'p1')::NUMERIC, (p_payload->>'baseP1')::NUMERIC, NULL);
    v_p2_base := COALESCE((p_payload->'bases'->>'p2')::NUMERIC, (p_payload->>'baseP2')::NUMERIC, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_p1_base := NULL;
    v_p2_base := NULL;
  END;

  IF v_p1_base IS NOT NULL AND v_p2_base IS NOT NULL THEN
    IF v_p2_base <= 0 AND v_p1_base > 0 THEN
      RETURN public.settle_verified_match(
        p_room_id,
        v_room.player1_id,
        COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
          'rescuedFromVerificationFailed', TRUE,
          'rescueReason', 'base_destruction_p1_won'
        )
      );
    ELSIF v_p1_base <= 0 AND v_p2_base > 0 THEN
      RETURN public.settle_verified_match(
        p_room_id,
        v_room.player2_id,
        COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
          'rescuedFromVerificationFailed', TRUE,
          'rescueReason', 'base_destruction_p2_won'
        )
      );
    END IF;
  END IF;

  -- RESCATE 3: Desempate por plantas colocadas si hubo combate
  SELECT
    COUNT(*) FILTER (WHERE user_id = v_room.player1_id AND kind = 'plant'),
    COUNT(*) FILTER (WHERE user_id = v_room.player2_id AND kind = 'plant')
  INTO v_p1_plants, v_p2_plants
  FROM public.match_actions WHERE room_id = p_room_id;

  IF v_p1_plants > 0 OR v_p2_plants > 0 THEN
    v_decided_winner := CASE WHEN v_p1_plants >= v_p2_plants THEN v_room.player1_id ELSE v_room.player2_id END;
    RETURN public.settle_verified_match(
      p_room_id,
      v_decided_winner,
      COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
        'rescuedFromVerificationFailed', TRUE,
        'rescueReason', 'plant_dominance_tiebreaker'
      )
    );
  END IF;

  -- Sólo si no hubo ninguna actividad de combate
  UPDATE public.game_rooms
     SET status = 'abandoned',
         settled_at = NOW(),
         verification_status = 'failed',
         verification_note = LEFT(COALESCE(p_note, 'verification_failed'), 500),
         verification_payload = COALESCE(p_payload, '{}'::JSONB)
   WHERE id = p_room_id;

  PERFORM public._refund_room_energy(p_room_id, 'Reembolso de 1 energía: sala cerrada por inactividad total');
  RETURN jsonb_build_object('ok', TRUE, 'status', 'failed', 'settled', TRUE);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_match_verification_failed(uuid, text, jsonb) TO service_role;


-- ── 5. REGISTRAR AUDITORÍA DE MIGRACIÓN ───────────────────────────────────────
INSERT INTO public._migration_audit (fase, detalle)
VALUES (
  '424-remove-plants-daily-victory-cap-and-eliminate-technical-draws',
  jsonb_build_object(
    'descripcion', 'Eliminacion del tope artificial de victorias en Token PLANTS (regulado por 15 free / 20 VIP energia) y erradicacion definitiva de empates tecnicos en desconexiones.',
    'energy_rules', '15 free / 20 VIP',
    'plants_claim_cap', 'unlimited_per_victory_with_energy',
    'technical_draws', 'eliminated'
  )
);

COMMIT;
