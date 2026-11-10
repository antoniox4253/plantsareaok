-- =============================================================================
-- MIGRACIÓN 426: ELIMINAR TOPE DIARIO DE VICTORIAS PARA TOKEN PLANTS
--                (MANTENIENDO EL TOPE DE ENERGÍA DIARIA DE 15 FREE / 20 VIP)
-- =============================================================================
-- La energía diaria inicial es 15 (Free) o 20 (VIP). Quien agote su energía
-- puede comprar recargas con Gemas en la Tienda (quemando gemas e inyectando
-- liquidez al AMM) y seguir jugando y ganando Token PLANTS en cada victoria
-- en Arena 3+ SIN límite diario de victorias bloqueante.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_pvp_plants_reward(
  p_room_id uuid,
  p_match_duration_sec numeric,
  p_enemy_kills integer,
  p_suns_collected integer,
  p_plants_placed integer,
  p_enemy_plants_placed integer DEFAULT 4
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

  -- 5. Contador Diario Informativo (SIN TOPE BLOQUEANTE: las victorias siempre otorgan
  --    Token PLANTS mientras el jugador tenga energía o compre recargas con gemas)
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

  -- 11. Actualizar emisión en AMM
  UPDATE public.plants_amm_state
  SET
    virtual_plants = virtual_plants + v_final_plants,
    total_minted = total_minted + v_final_plants,
    current_halving_era = CASE
      WHEN total_minted + v_final_plants >= 937500 THEN 5
      WHEN total_minted + v_final_plants >= 875000 THEN 4
      WHEN total_minted + v_final_plants >= 750000 THEN 3
      WHEN total_minted + v_final_plants >= 500000 THEN 2
      ELSE 1
    END,
    updated_at = NOW()
  WHERE id = 1;

  -- 12. Insertar en historial de precios y eventos auditables con columnas canónicas
  INSERT INTO public.plants_price_history (
    spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants, user_id, metadata
  ) VALUES (
    v_spot, v_amm.usdt_pool, v_amm.virtual_plants + v_final_plants,
    CASE WHEN v_is_bot THEN 'pvp_bot_reward' ELSE 'pvp_match_reward' END,
    0, v_final_plants, v_uid,
    jsonb_build_object(
      'roomId', p_room_id,
      'isBot', v_is_bot,
      'score', ROUND(v_total_score, 1),
      'baseReward', v_base_reward,
      'pvpMult', v_pvp_mult,
      'bonusActive', v_bonus_active,
      'dailyClaimsUsed', v_daily_claims + 1,
      'dailyClaimsMax', NULL,
      'isVip', v_is_vip,
      'goldenCardsCount', v_golden_count,
      'goldenBonusPct', v_golden_bonus_pct
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'plantsAwarded', v_final_plants,
    'score', v_total_score,
    'baseReward', v_base_reward,
    'isLivePvP', NOT v_is_bot,
    'isBotMatch', v_is_bot,
    'bonusActive', v_bonus_active,
    'dailyClaimsUsed', v_daily_claims + 1,
    'dailyClaimsMax', NULL,
    'isVip', v_is_vip,
    'goldenCardsCount', v_golden_count,
    'goldenBonusPct', v_golden_bonus_pct
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_pvp_plants_reward(uuid, numeric, integer, integer, integer, integer) TO authenticated, anon, service_role;

INSERT INTO public._migration_audit (fase, detalle)
VALUES (
  '426-remove-plants-daily-victory-cap-keep-energy-cap',
  jsonb_build_object(
    'energy_free', 15,
    'energy_vip', 20,
    'plants_daily_victory_cap', 'unlimited',
    'reason', 'Jugadores pueden comprar energía quemando gemas y seguir ganando Token PLANTS por victoria'
  )
);
