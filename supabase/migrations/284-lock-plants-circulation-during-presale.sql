-- ==============================================================================
-- MIGRACIÓN 284: BLOQUEO TOTAL DE EMISIÓN DE TOKENS DURANTE LA PREVENTA (5 DÍAS)
-- 
-- Objetivos:
-- 1. Nadie recibe tokens líquidos durante los 5 días de preventa (Circulating Supply = 0).
-- 2. El minado de combate PvP (claim_pvp_plants_reward) queda en pausa hasta NOW() >= presale_ends_at.
-- 3. Los reclamos de vesting (claim_daily_vesting_plants) se bloquean hasta NOW() >= presale_ends_at.
-- 4. El resumen de vesting (get_user_plants_vesting_summary) muestra la cuenta regresiva hacia el fin de la preventa.
-- 5. El bono de PvP de 7 días (+25%) se programa para durar 7 días a partir del fin de la preventa.
-- ==============================================================================

BEGIN;

-- 1. Actualizar pvp_bonus_ends_at para que comience al terminar la preventa y dure 7 días
UPDATE public.plants_amm_state
   SET pvp_bonus_ends_at = presale_ends_at + INTERVAL '7 days',
       updated_at = NOW()
 WHERE id = 1 AND presale_ends_at IS NOT NULL;

-- 2. Pausar el minado de PvP mientras la preventa esté activa
CREATE OR REPLACE FUNCTION public.claim_pvp_plants_reward(
  p_room_id UUID,
  p_match_duration_sec NUMERIC,
  p_enemy_kills INTEGER,
  p_suns_collected INTEGER,
  p_plants_placed INTEGER,
  p_enemy_plants_placed INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estado AMM no encontrado'; END IF;

  -- ── REGLA ESTRICTA DE PREVENTA: 0 EMISIÓN DE TOKENS HASTA QUE FINALICE ──
  IF v_amm.presale_active AND (v_amm.presale_ends_at IS NULL OR NOW() < v_amm.presale_ends_at) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'PRESALE_ACTIVE_MINING_PAUSED',
      'message', 'El minado de PLANTS en combates PvP comenzará al finalizar la preventa oficial.',
      'plantsAwarded', 0
    );
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;

  -- Validar que el usuario sea el ganador legítimo
  IF v_room.status NOT IN ('p1_won', 'p2_won') THEN
    RAISE EXCEPTION 'La partida no terminó en victoria válida';
  END IF;

  IF v_room.player1_id = v_uid AND v_room.status <> 'p1_won' THEN
    RAISE EXCEPTION 'Solo las victorias otorgan PLANTS';
  ELSIF v_room.player2_id = v_uid AND v_room.status <> 'p2_won' THEN
    RAISE EXCEPTION 'Solo las victorias otorgan PLANTS';
  END IF;

  SELECT elo_rating, plants_daily_claims_count, plants_daily_claims_date
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  -- Filtro de Arena 3+ (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ARENA_TOO_LOW', 'plantsAwarded', 0);
  END IF;

  -- Anti-Collusion: Mínimo 45s de duración y 4 plantas del rival
  IF p_match_duration_sec < 45.0 OR p_enemy_plants_placed < 4 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MATCH_TOO_SHORT_OR_COLLUSION', 'plantsAwarded', 0);
  END IF;

  -- Tope Diario de Partidas (Máx 20 victorias al día)
  v_claims_date := COALESCE(v_prof.plants_daily_claims_date, CURRENT_DATE);
  v_daily_claims := COALESCE(v_prof.plants_daily_claims_count, 0);

  IF v_claims_date < CURRENT_DATE THEN
    v_daily_claims := 0;
    v_claims_date := CURRENT_DATE;
  END IF;

  IF v_daily_claims >= 20 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'DAILY_CLAIM_CAP_REACHED', 'plantsAwarded', 0);
  END IF;

  -- Cálculo del Performance Score (0 a 100)
  v_combat_score := LEAST(20.0, GREATEST(0, p_enemy_kills * 2.0));
  v_econ_score   := LEAST(15.0, GREATEST(0, (p_suns_collected / 100.0)));
  v_deploy_score := LEAST(10.0, GREATEST(0, p_plants_placed * 0.5));

  IF p_match_duration_sec < 90.0 THEN
    v_blitz_score := 15.0;
  ELSIF p_match_duration_sec <= 130.0 THEN
    v_blitz_score := 10.0;
  ELSIF p_match_duration_sec <= 180.0 THEN
    v_blitz_score := 5.0;
  END IF;

  v_total_score := v_base_score + v_combat_score + v_econ_score + v_deploy_score + v_blitz_score;
  v_base_reward := 2.0 + (v_total_score / 100.0) * 4.0;

  -- Bonus PvP Humano en Vivo (+25% durante los 7 días post-preventa)
  IF NOT v_room.is_async_match THEN
    IF v_amm.pvp_bonus_ends_at IS NOT NULL AND NOW() <= v_amm.pvp_bonus_ends_at THEN
      v_pvp_mult := 1.25;
      v_bonus_active := true;
    END IF;
  END IF;

  -- Halving Factor
  IF v_amm.current_halving_era = 2 THEN v_era_factor := 0.5;
  ELSIF v_amm.current_halving_era = 3 THEN v_era_factor := 0.25;
  ELSIF v_amm.current_halving_era = 4 THEN v_era_factor := 0.125;
  ELSIF v_amm.current_halving_era >= 5 THEN v_era_factor := 0.0625;
  END IF;

  v_final_plants := ROUND(v_base_reward * v_pvp_mult * v_era_factor, 2);

  -- Acreditar al perfil
  UPDATE public.profiles
  SET
    plants_balance = COALESCE(plants_balance, 0) + v_final_plants,
    plants_daily_claims_count = v_daily_claims + 1,
    plants_daily_claims_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = v_uid;

  -- Actualizar emisión en AMM
  UPDATE public.plants_amm_state
  SET
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

  RETURN jsonb_build_object(
    'success', true,
    'plantsAwarded', v_final_plants,
    'score', v_total_score,
    'bonusApplied', v_bonus_active,
    'newDailyClaims', v_daily_claims + 1
  );
END;
$$;

-- 3. Pausar reclamos de vesting diario durante la preventa
CREATE OR REPLACE FUNCTION public.claim_daily_vesting_plants()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_amm RECORD;
  v_prof RECORD;
  v_order RECORD;
  v_base_date TIMESTAMPTZ;
  v_days_elapsed INTEGER;
  v_claimable_days INTEGER;
  v_order_to_unlock NUMERIC;
  v_total_unlocked NUMERIC := 0.0;
  v_user_locked NUMERIC := 0.0;
  v_liquid NUMERIC := 0.0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estado AMM no encontrado';
  END IF;

  -- ── REGLA ESTRICTA: NO SE LIBERAN TOKENS DURANTE LA PREVENTA ──
  IF v_amm.presale_active AND (v_amm.presale_ends_at IS NULL OR NOW() < v_amm.presale_ends_at) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Los tokens adquiridos en preventa comenzarán a liberarse una vez concluida la preventa oficial (5 días).'
    );
  END IF;

  SELECT * INTO v_prof
    FROM public.profiles
   WHERE id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  v_user_locked := COALESCE(v_prof.plants_vesting_locked, 0.0);
  v_liquid := COALESCE(v_prof.plants_balance, 0.0);

  IF v_user_locked <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No tienes tokens en vesting para desbloquear.'
    );
  END IF;

  -- Iterar sobre las órdenes con días pendientes
  FOR v_order IN
    SELECT *
      FROM public.plants_presale_orders
     WHERE user_id = v_uid
       AND vesting_claimed_days < vesting_days_total
     ORDER BY created_at ASC
     FOR UPDATE
  LOOP
    -- La base de cálculo de días transcurridos arranca al finalizar la preventa (o created_at si la orden es posterior)
    v_base_date := GREATEST(v_order.created_at, COALESCE(v_amm.presale_ends_at, v_order.created_at));
    v_days_elapsed := LEAST(v_order.vesting_days_total, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_base_date)) / 86400)::INTEGER);
    v_claimable_days := GREATEST(0, v_days_elapsed - v_order.vesting_claimed_days);

    IF v_claimable_days > 0 THEN
      IF (v_order.vesting_claimed_days + v_claimable_days) >= v_order.vesting_days_total THEN
        v_order_to_unlock := GREATEST(0, v_order.plants_amount - (v_order.vesting_claimed_days * v_order.vesting_daily_rate));
      ELSE
        v_order_to_unlock := v_claimable_days * v_order.vesting_daily_rate;
      END IF;

      v_order_to_unlock := LEAST(v_user_locked, v_order_to_unlock);

      IF v_order_to_unlock > 0 THEN
        v_total_unlocked := v_total_unlocked + v_order_to_unlock;
        v_user_locked := v_user_locked - v_order_to_unlock;

        UPDATE public.plants_presale_orders
           SET vesting_claimed_days = vesting_claimed_days + v_claimable_days,
               last_vesting_claim_at = NOW()
         WHERE id = v_order.id;
      END IF;
    END IF;
  END LOOP;

  IF v_total_unlocked <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aún no se ha cumplido el siguiente ciclo de 24 horas para desbloquear tokens. Revisa el temporizador.'
    );
  END IF;

  -- Acreditar balance líquido al usuario
  UPDATE public.profiles
     SET plants_vesting_locked = GREATEST(0, plants_vesting_locked - v_total_unlocked),
         plants_balance = COALESCE(plants_balance, 0) + v_total_unlocked,
         updated_at = NOW()
   WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'unlockedPlants', ROUND(v_total_unlocked, 4),
    'newLiquidBalance', ROUND(v_liquid + v_total_unlocked, 4),
    'remainingVestingLocked', ROUND(v_user_locked, 4)
  );
END;
$$;

-- 4. Actualizar get_user_plants_vesting_summary con cuenta regresiva vinculada al fin de preventa si está activa
CREATE OR REPLACE FUNCTION public.get_user_plants_vesting_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_amm RECORD;
  v_prof RECORD;
  v_orders_json JSONB := '[]'::jsonb;
  v_order RECORD;
  v_base_date TIMESTAMPTZ;
  v_days_elapsed INTEGER;
  v_claimable_days INTEGER;
  v_order_claimable_plants NUMERIC;
  v_total_claimable_plants NUMERIC := 0.0;
  v_total_daily_rate NUMERIC := 0.0;
  v_active_orders_count INTEGER := 0;
  v_next_tick TIMESTAMPTZ;
  v_secs_to_next INTEGER := 0;
  v_min_secs_to_next INTEGER := NULL;
  v_liquid NUMERIC := 0.0;
  v_locked NUMERIC := 0.0;
  v_is_presale_running BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'liquidBalance', 0,
      'vestingLocked', 0,
      'totalPlants', 0,
      'claimablePlantsNow', 0,
      'dailyAccrualRate', 0,
      'activeOrdersCount', 0,
      'secondsToNextUnlock', 0,
      'orders', '[]'::jsonb
    );
  END IF;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1;
  v_is_presale_running := (v_amm.presale_active AND (v_amm.presale_ends_at IS NOT NULL AND NOW() < v_amm.presale_ends_at));

  SELECT plants_balance, plants_vesting_locked, last_plants_cashout_at
    INTO v_prof
    FROM public.profiles
   WHERE id = v_uid;

  v_liquid := COALESCE(v_prof.plants_balance, 0.0);
  v_locked := COALESCE(v_prof.plants_vesting_locked, 0.0);

  FOR v_order IN
    SELECT id, pack_id, price_usdt, plants_amount, gems_amount,
           vesting_daily_rate, vesting_days_total, vesting_claimed_days,
           last_vesting_claim_at, created_at
      FROM public.plants_presale_orders
     WHERE user_id = v_uid
     ORDER BY created_at DESC
  LOOP
    IF v_is_presale_running THEN
      -- Durante la preventa: 0 días transcurridos para reclamo y el próximo tick es el fin de preventa
      v_days_elapsed := 0;
      v_claimable_days := 0;
      v_order_claimable_plants := 0;
      v_secs_to_next := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_amm.presale_ends_at - NOW())))::INTEGER);
    ELSE
      -- Post-preventa: transcurso normal de días
      v_base_date := GREATEST(v_order.created_at, COALESCE(v_amm.presale_ends_at, v_order.created_at));
      v_days_elapsed := LEAST(v_order.vesting_days_total, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_base_date)) / 86400)::INTEGER);
      v_claimable_days := GREATEST(0, v_days_elapsed - v_order.vesting_claimed_days);

      IF v_claimable_days > 0 THEN
        IF (v_order.vesting_claimed_days + v_claimable_days) >= v_order.vesting_days_total THEN
          v_order_claimable_plants := GREATEST(0, v_order.plants_amount - (v_order.vesting_claimed_days * v_order.vesting_daily_rate));
        ELSE
          v_order_claimable_plants := v_claimable_days * v_order.vesting_daily_rate;
        END IF;
      ELSE
        v_order_claimable_plants := 0;
      END IF;

      IF v_order.vesting_claimed_days < v_order.vesting_days_total THEN
        v_next_tick := v_base_date + ((v_days_elapsed + 1) * INTERVAL '1 day');
        v_secs_to_next := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_next_tick - NOW())))::INTEGER);
      ELSE
        v_secs_to_next := 0;
      END IF;
    END IF;

    IF v_order.vesting_claimed_days < v_order.vesting_days_total THEN
      IF v_min_secs_to_next IS NULL OR v_secs_to_next < v_min_secs_to_next THEN
        v_min_secs_to_next := v_secs_to_next;
      END IF;

      v_total_daily_rate := v_total_daily_rate + v_order.vesting_daily_rate;
      v_active_orders_count := v_active_orders_count + 1;
    END IF;

    v_total_claimable_plants := v_total_claimable_plants + v_order_claimable_plants;

    v_orders_json := v_orders_json || jsonb_build_object(
      'id', v_order.id,
      'packId', v_order.pack_id,
      'priceUsdt', v_order.price_usdt,
      'plantsAmount', v_order.plants_amount,
      'gemsAmount', v_order.gems_amount,
      'vestingDailyRate', v_order.vesting_daily_rate,
      'vestingDaysTotal', v_order.vesting_days_total,
      'vestingClaimedDays', v_order.vesting_claimed_days,
      'daysElapsed', v_days_elapsed,
      'claimableDays', v_claimable_days,
      'claimablePlants', ROUND(v_order_claimable_plants, 4),
      'isCompleted', (v_order.vesting_claimed_days >= v_order.vesting_days_total),
      'createdAt', v_order.created_at,
      'secondsToNextUnlock', v_secs_to_next
    );
  END LOOP;

  v_total_claimable_plants := LEAST(v_locked, v_total_claimable_plants);

  RETURN jsonb_build_object(
    'liquidBalance', ROUND(v_liquid, 4),
    'vestingLocked', ROUND(v_locked, 4),
    'totalPlants', ROUND(v_liquid + v_locked, 4),
    'claimablePlantsNow', ROUND(v_total_claimable_plants, 4),
    'dailyAccrualRate', ROUND(v_total_daily_rate, 4),
    'activeOrdersCount', v_active_orders_count,
    'secondsToNextUnlock', COALESCE(v_min_secs_to_next, 0),
    'orders', v_orders_json
  );
END;
$$;

COMMIT;
