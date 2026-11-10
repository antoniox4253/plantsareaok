-- =============================================================================
-- MIGRACIÓN 429: VERIFICACIÓN ESTRICTA DE VIP Y ELIMINACIÓN DE dailyClaimsMax: NULL
-- =============================================================================
-- Problema detectado:
--   1. La migración 426 devolvía 'dailyClaimsMax', NULL para TODOS los jugadores
--      (incluso Free con has_vip_pass = false).
--   2. En la versión de frontend desplegada en main, la condición:
--      (isVip || dailyClaimsMax === null) mostraba "👑 VIP Ilimitado" a TODOS
--      los jugadores sin VIP.
--   3. Adicionalmente, claim_pvp_plants_reward, _award_vip_victory_gold y my_balance
--      no validaban la fecha de expiración vip_pass_expires_at.
--
-- Corrección:
--   1. Omitir 'dailyClaimsMax' del payload JSON de claim_pvp_plants_reward para
--      que nunca llegue como null al cliente.
--   2. Validar estrictamente VIP en BD comprobando:
--      COALESCE(has_vip_pass, false) = TRUE
--      AND (vip_pass_expires_at IS NULL OR vip_pass_expires_at > NOW()).
-- =============================================================================

BEGIN;

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

  SELECT elo_rating, has_vip_pass, vip_pass_expires_at, plants_daily_claims_count, plants_daily_claims_date
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

  -- Verificación estricta de Pase VIP activo (flag + fecha de expiración vigente)
  v_is_vip := COALESCE(v_prof.has_vip_pass, false)
              AND (v_prof.vip_pass_expires_at IS NULL OR v_prof.vip_pass_expires_at > NOW());

  -- 5. Contador Diario Informativo (sin bloqueo de tope: rige el sistema de energías)
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

  -- 10. Acreditar saldo en profiles (y limpiar flag VIP si expiró)
  UPDATE public.profiles
  SET
    plants_balance = COALESCE(plants_balance, 0) + v_final_plants,
    plants_daily_claims_count = v_daily_claims + 1,
    plants_daily_claims_date = CURRENT_DATE,
    has_vip_pass = CASE
      WHEN COALESCE(has_vip_pass, false) AND vip_pass_expires_at IS NOT NULL AND vip_pass_expires_at <= NOW() THEN FALSE
      ELSE has_vip_pass
    END,
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
      'isVip', v_is_vip,
      'goldenCardsCount', v_golden_count,
      'goldenBonusPct', v_golden_bonus_pct
    )
  );

  -- NOTA: No se envía 'dailyClaimsMax' en el JSON (antes se enviaba NULL y provocaba
  -- que clientes previos interpretaran dailyClaimsMax === null como "VIP Ilimitado").
  RETURN jsonb_build_object(
    'success', true,
    'plantsAwarded', v_final_plants,
    'score', v_total_score,
    'baseReward', v_base_reward,
    'isLivePvP', NOT v_is_bot,
    'isBotMatch', v_is_bot,
    'bonusActive', v_bonus_active,
    'dailyClaimsUsed', v_daily_claims + 1,
    'isVip', v_is_vip,
    'goldenCardsCount', v_golden_count,
    'goldenBonusPct', v_golden_bonus_pct
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_pvp_plants_reward(uuid, numeric, integer, integer, integer, integer) TO authenticated, anon, service_role;


-- ── 2. VALIDAR EXPIRACIÓN VIP EN _award_vip_victory_gold ───────────────────────
CREATE OR REPLACE FUNCTION public._award_vip_victory_gold(p_uid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_has_vip BOOLEAN := FALSE;
  v_is_saturday BOOLEAN;
  v_options INTEGER[];
  v_gold_bonus INTEGER := 0;
  v_desc TEXT;
BEGIN
  IF p_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(has_vip_pass, FALSE)
         AND (vip_pass_expires_at IS NULL OR vip_pass_expires_at > NOW())
    INTO v_has_vip
    FROM public.profiles
   WHERE id = p_uid;

  -- Sábado en UTC: EXTRACT(DOW FROM NOW() AT TIME ZONE 'UTC') = 6
  v_is_saturday := (EXTRACT(DOW FROM NOW() AT TIME ZONE 'UTC') = 6);

  IF v_is_saturday THEN
    -- EVENTO FIEBRE DE ORO
    IF v_has_vip THEN
      v_options := ARRAY[10, 20, 30];
      v_gold_bonus := v_options[1 + floor(random() * 3)::INTEGER];
      v_desc := 'Fiebre de Oro VIP (Sábado x2): +' || v_gold_bonus || ' Oro';
    ELSE
      v_options := ARRAY[5, 10];
      v_gold_bonus := v_options[1 + floor(random() * 2)::INTEGER];
      v_desc := 'Fiebre de Oro (Sábado): +' || v_gold_bonus || ' Oro';
    END IF;
  ELSE
    -- DÍAS NORMALES (Domingo a Viernes): exclusivo para VIP vigente
    IF NOT v_has_vip THEN
      RETURN 0;
    END IF;

    v_options := ARRAY[5, 10, 15];
    v_gold_bonus := v_options[1 + floor(random() * 3)::INTEGER];
    v_desc := 'Bono VIP de Oro por Victoria (+' || v_gold_bonus || ' Oro)';
  END IF;

  IF v_gold_bonus > 0 THEN
    UPDATE public.profiles
       SET gold_balance = COALESCE(gold_balance, 0) + v_gold_bonus,
           updated_at = NOW()
     WHERE id = p_uid;

    INSERT INTO public.transactions (user_id, type, amount_gems, amount_gold, description, status, created_at)
    VALUES (
      p_uid,
      'vip_victory_gold',
      0,
      v_gold_bonus,
      v_desc,
      'completed',
      NOW()
    );
  END IF;

  RETURN v_gold_bonus;
END;
$function$;


-- ── 3. VALIDAR EXPIRACIÓN VIP EN my_balance ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_balance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  r RECORD;
  v_total_gems NUMERIC := 0.0;
  v_locked_gems NUMERIC := 0.0;
  v_withdrawable NUMERIC := 0.0;
  v_max_energy INTEGER := 15;
  v_cur_energy INTEGER := 15;
  v_last_reset TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_is_new_day BOOLEAN := FALSE;
  v_is_vip BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT
    gems_balance,
    locked_gems_balance,
    gold_balance,
    colosseum_tickets,
    elo_rating,
    has_vip_pass,
    vip_pass_expires_at,
    claimed_vip_levels,
    colosseum_current_streak,
    colosseum_max_streak,
    energy_current,
    energy_last_reset_utc,
    claimed_arena_ads_levels,
    plants_balance,
    plants_vesting_locked,
    last_plants_cashout_at
  INTO r
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil no encontrado'; END IF;

  v_is_vip := COALESCE(r.has_vip_pass, FALSE)
              AND (r.vip_pass_expires_at IS NULL OR r.vip_pass_expires_at > v_now);

  -- Si el VIP estaba activo en flag pero ya expiró por fecha, corregirlo en DB
  IF COALESCE(r.has_vip_pass, FALSE) AND NOT v_is_vip THEN
    UPDATE public.profiles
       SET has_vip_pass = FALSE,
           updated_at = v_now
     WHERE id = v_uid;
  END IF;

  v_total_gems := COALESCE(r.gems_balance, 0.0);
  v_locked_gems := LEAST(v_total_gems, COALESCE(r.locked_gems_balance, 0.0));
  v_withdrawable := GREATEST(0.0, v_total_gems - v_locked_gems);
  v_max_energy := CASE WHEN v_is_vip THEN 20 ELSE 15 END;
  v_is_new_day := (r.energy_last_reset_utc IS NOT NULL)
                  AND (DATE_TRUNC('day', v_now AT TIME ZONE 'UTC') > DATE_TRUNC('day', r.energy_last_reset_utc AT TIME ZONE 'UTC'));

  IF r.energy_current IS NULL OR v_is_new_day THEN
    v_cur_energy := v_max_energy;
    v_last_reset := v_now;
    UPDATE public.profiles
       SET energy_current = v_cur_energy,
           energy_last_reset_utc = v_last_reset
     WHERE id = v_uid;
  ELSIF r.energy_last_reset_utc IS NULL THEN
    v_cur_energy := r.energy_current;
    v_last_reset := v_now;
    UPDATE public.profiles
       SET energy_last_reset_utc = v_last_reset
     WHERE id = v_uid;
  ELSE
    v_cur_energy := r.energy_current;
    v_last_reset := r.energy_last_reset_utc;
  END IF;

  RETURN jsonb_build_object(
    'gems_balance', v_total_gems,
    'locked_gems_balance', v_locked_gems,
    'withdrawable_gems_balance', v_withdrawable,
    'gold_balance', COALESCE(r.gold_balance, 0),
    'colosseum_tickets', COALESCE(r.colosseum_tickets, 0),
    'elo_rating', COALESCE(r.elo_rating, 1000),
    'has_vip_pass', v_is_vip,
    'vip_pass_expires_at', r.vip_pass_expires_at,
    'claimed_vip_levels', COALESCE(r.claimed_vip_levels, '[]'::jsonb),
    'colosseum_current_streak', COALESCE(r.colosseum_current_streak, 0),
    'colosseum_max_streak', COALESCE(r.colosseum_max_streak, 0),
    'energy_current', v_cur_energy,
    'energy_last_reset_utc', v_last_reset,
    'claimed_arena_ads_levels', COALESCE(r.claimed_arena_ads_levels, '[]'::jsonb),
    'plants_balance', COALESCE(r.plants_balance, 0),
    'plants_vesting_locked', COALESCE(r.plants_vesting_locked, 0),
    'last_plants_cashout_at', r.last_plants_cashout_at
  );
END;
$function$;


INSERT INTO public._migration_audit (fase, detalle)
VALUES (
  '429-fix-vip-verification-and-remove-null-claims-max',
  jsonb_build_object(
    'fixed_dailyClaimsMax_null', true,
    'enforced_vip_expiration_checks', ARRAY['claim_pvp_plants_reward', '_award_vip_victory_gold', 'my_balance']
  )
);

COMMIT;
