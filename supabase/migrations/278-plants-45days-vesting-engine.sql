-- =============================================================================
-- MIGRACIÓN 278: MOTOR DE VESTING A 45 DÍAS CON LIBERACIÓN DIARIA Y RESUMEN
-- =============================================================================

BEGIN;

-- 1. Modificar tabla de órdenes para fijar vesting en 45 días por defecto
ALTER TABLE public.plants_presale_orders
  ALTER COLUMN vesting_days_total SET DEFAULT 45;

-- 2. Actualizar buy_plants_presale_pack para calcular tasa a 45 días
CREATE OR REPLACE FUNCTION public.buy_plants_presale_pack(
  p_pack_id TEXT,
  p_payment_method TEXT DEFAULT 'gems'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_price NUMERIC;
  v_plants NUMERIC;
  v_bonus_gems INTEGER;
  v_gem_cost INTEGER;
  v_prof RECORD;
  v_amm RECORD;
  v_to_pool NUMERIC;
  v_to_dev NUMERIC;
  v_new_pool NUMERIC;
  v_new_virtual NUMERIC;
  v_new_spot NUMERIC;
  v_stock INTEGER;
  v_daily_rate NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;
  IF NOT v_amm.presale_active THEN
    RAISE EXCEPTION 'La preventa ha finalizado';
  END IF;

  IF p_pack_id = 'pack_pionero_10' THEN
    v_price := 10.0;
    v_plants := 2500.0;
    v_bonus_gems := 600;
    v_stock := v_amm.presale_pionero_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Pionero agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_pionero_stock = presale_pionero_stock - 1 WHERE id = 1;
  ELSIF p_pack_id = 'pack_campeon_25' THEN
    v_price := 25.0;
    v_plants := 7500.0;
    v_bonus_gems := 1800;
    v_stock := v_amm.presale_campeon_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Campeón agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_campeon_stock = presale_campeon_stock - 1 WHERE id = 1;
  ELSIF p_pack_id = 'pack_leyenda_50' THEN
    v_price := 50.0;
    v_plants := 15000.0;
    v_bonus_gems := 4000;
    v_stock := v_amm.presale_leyenda_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Leyenda agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_leyenda_stock = presale_leyenda_stock - 1 WHERE id = 1;
  ELSE
    RAISE EXCEPTION 'ID de pack de preventa inválido: %', p_pack_id;
  END IF;

  -- 1 USDT = 100 Gemas
  v_gem_cost := ROUND(v_price * 100);

  IF p_payment_method = 'gems' THEN
    IF COALESCE(v_prof.gems_balance, 0) < v_gem_cost THEN
      RAISE EXCEPTION 'Saldo insuficiente de Gemas. Tienes % 💎 y requieres % 💎 para este pack',
        COALESCE(v_prof.gems_balance, 0), v_gem_cost;
    END IF;
  END IF;

  -- 60% al Pool USDT, 40% a Dev
  v_to_pool := v_price * 0.60;
  v_to_dev := v_price * 0.40;

  v_new_pool := v_amm.usdt_pool + v_to_pool;
  -- Ajuste de reserva virtual: para mantener K = R * V tras inyección externa
  v_new_virtual := v_amm.k_constant / v_new_pool;
  v_new_spot := v_new_pool / v_new_virtual;

  -- Actualizar AMM
  UPDATE public.plants_amm_state
  SET
    usdt_pool = v_new_pool,
    virtual_plants = v_new_virtual,
    total_minted = total_minted + v_plants,
    updated_at = NOW()
  WHERE id = 1;

  -- Registrar en historial para la gráfica
  INSERT INTO public.plants_price_history (
    spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants, user_id, metadata
  ) VALUES (
    v_new_spot, v_new_pool, v_new_virtual, 'presale_pack', v_to_pool, v_plants, v_uid,
    jsonb_build_object(
      'packId', p_pack_id,
      'price', v_price,
      'devShare', v_to_dev,
      'paymentMethod', p_payment_method,
      'bonusGems', v_bonus_gems,
      'vestingDays', 45
    )
  );

  -- Tasa diaria a 45 días
  v_daily_rate := ROUND(v_plants / 45.0, 4);

  -- Registrar orden con vesting de 45 días
  INSERT INTO public.plants_presale_orders (
    user_id, pack_id, price_usdt, plants_amount, gems_amount, vesting_daily_rate, vesting_days_total
  ) VALUES (
    v_uid, p_pack_id, v_price, v_plants, v_bonus_gems, v_daily_rate, 45
  );

  -- Actualizar perfil: si pagó con gemas, restar costo y acreditar bonus
  IF p_payment_method = 'gems' THEN
    UPDATE public.profiles
    SET
      gems_balance = gems_balance - v_gem_cost + v_bonus_gems,
      plants_vesting_locked = COALESCE(plants_vesting_locked, 0) + v_plants,
      updated_at = NOW()
    WHERE id = v_uid;
  ELSE
    UPDATE public.profiles
    SET
      gems_balance = COALESCE(gems_balance, 0) + v_bonus_gems,
      plants_vesting_locked = COALESCE(plants_vesting_locked, 0) + v_plants,
      updated_at = NOW()
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'packId', p_pack_id,
    'plantsLocked', v_plants,
    'gemsBonus', v_bonus_gems,
    'paymentMethod', p_payment_method,
    'newSpotPrice', ROUND(v_new_spot, 8),
    'newPoolUsdt', ROUND(v_new_pool, 4),
    'vestingDaysTotal', 45,
    'vestingDailyRate', v_daily_rate
  );
END;
$$;

-- 3. RPC: Obtener Resumen Detallado de Vesting del Usuario
CREATE OR REPLACE FUNCTION public.get_user_plants_vesting_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_orders_json JSONB := '[]'::jsonb;
  v_order RECORD;
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
    -- Calcular días transcurridos desde la compra
    v_days_elapsed := LEAST(v_order.vesting_days_total, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_order.created_at)) / 86400)::INTEGER);
    v_claimable_days := GREATEST(0, v_days_elapsed - v_order.vesting_claimed_days);

    IF v_claimable_days > 0 THEN
      IF (v_order.vesting_claimed_days + v_claimable_days) >= v_order.vesting_days_total THEN
        -- Reclamar el remanente exacto en el último día para evitar desfasaje de decimales
        v_order_claimable_plants := GREATEST(0, v_order.plants_amount - (v_order.vesting_claimed_days * v_order.vesting_daily_rate));
      ELSE
        v_order_claimable_plants := v_claimable_days * v_order.vesting_daily_rate;
      END IF;
    ELSE
      v_order_claimable_plants := 0;
    END IF;

    -- Calcular cuenta regresiva hasta el siguiente desbloqueo de 24h
    IF v_order.vesting_claimed_days < v_order.vesting_days_total THEN
      v_next_tick := v_order.created_at + ((v_days_elapsed + 1) * INTERVAL '1 day');
      v_secs_to_next := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_next_tick - NOW())))::INTEGER);
      IF v_min_secs_to_next IS NULL OR v_secs_to_next < v_min_secs_to_next THEN
        v_min_secs_to_next := v_secs_to_next;
      END IF;

      v_total_daily_rate := v_total_daily_rate + v_order.vesting_daily_rate;
      v_active_orders_count := v_active_orders_count + 1;
    ELSE
      v_secs_to_next := 0;
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

  -- El total reclamable no puede superar los tokens que actualmente están en vesting_locked
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

-- 4. RPC: Reclamar Tokens Diarios Desbloqueados desde Vesting
CREATE OR REPLACE FUNCTION public.claim_daily_vesting_plants()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_order RECORD;
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
    v_days_elapsed := LEAST(v_order.vesting_days_total, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_order.created_at)) / 86400)::INTEGER);
    v_claimable_days := GREATEST(0, v_days_elapsed - v_order.vesting_claimed_days);

    IF v_claimable_days > 0 THEN
      IF (v_order.vesting_claimed_days + v_claimable_days) >= v_order.vesting_days_total THEN
        v_order_to_unlock := GREATEST(0, v_order.plants_amount - (v_order.vesting_claimed_days * v_order.vesting_daily_rate));
      ELSE
        v_order_to_unlock := v_claimable_days * v_order.vesting_daily_rate;
      END IF;

      -- Limitar al saldo restante de vesting del usuario
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

  -- Actualizar perfil del usuario transfiriendo de locked a liquid
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

-- 5. Actualizar public.my_balance() para incluir saldos de PLANTS en tiempo real
CREATE OR REPLACE FUNCTION public.my_balance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  r              RECORD;
  v_total_gems   NUMERIC := 0.0;
  v_locked_gems  NUMERIC := 0.0;
  v_withdrawable NUMERIC := 0.0;
  v_max_energy   INTEGER := 20;
  v_cur_energy   INTEGER := 20;
  v_last_reset   TIMESTAMPTZ;
  v_now          TIMESTAMPTZ := NOW();
  v_is_new_day   BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT gems_balance, locked_gems_balance, gold_balance, colosseum_tickets, elo_rating,
         has_vip_pass, claimed_vip_levels,
         colosseum_current_streak, colosseum_max_streak,
         energy_current, energy_last_reset_utc,
         claimed_arena_ads_levels,
         plants_balance, plants_vesting_locked, last_plants_cashout_at
    INTO r
    FROM public.profiles
   WHERE id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil no encontrado'; END IF;

  v_total_gems := COALESCE(r.gems_balance, 0.0);
  v_locked_gems := LEAST(v_total_gems, COALESCE(r.locked_gems_balance, 0.0));
  v_withdrawable := GREATEST(0.0, v_total_gems - v_locked_gems);

  v_max_energy := CASE WHEN COALESCE(r.has_vip_pass, FALSE) THEN 25 ELSE 20 END;

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
    'withdrawable_gems', v_withdrawable,
    'gold_balance', COALESCE(r.gold_balance, 0),
    'colosseum_tickets', COALESCE(r.colosseum_tickets, 0),
    'elo_rating', COALESCE(r.elo_rating, 1000),
    'has_vip_pass', COALESCE(r.has_vip_pass, FALSE),
    'claimed_vip_levels', COALESCE(to_jsonb(r.claimed_vip_levels), '[]'::jsonb),
    'claimed_arena_ads_levels', COALESCE(to_jsonb(r.claimed_arena_ads_levels), '[]'::jsonb),
    'colosseum_current_streak', COALESCE(r.colosseum_current_streak, 0),
    'colosseum_max_streak', COALESCE(r.colosseum_max_streak, 0),
    'energy_current', v_cur_energy,
    'energy_last_reset_utc', v_last_reset,
    'plants_balance', COALESCE(r.plants_balance, 0.0),
    'plants_vesting_locked', COALESCE(r.plants_vesting_locked, 0.0),
    'last_plants_cashout_at', r.last_plants_cashout_at
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.get_user_plants_vesting_summary() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_vesting_plants() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.buy_plants_presale_pack(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.my_balance() TO authenticated, anon;

COMMIT;
