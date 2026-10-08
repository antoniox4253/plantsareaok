-- ==============================================================================
-- MIGRACIÓN 285: SINCRONIZACIÓN OFICIAL AL CIERRE DE LA TEMPORADA 1 BETA (15 OCTUBRE)
-- 
-- 1. Fija presale_ends_at al 15 de Octubre 2026 a las 00:00:00 UTC (Fin oficial de Beta T1).
-- 2. Fija pvp_bonus_ends_at al 22 de Octubre 2026 a las 00:00:00 UTC (7 días de bonus post-beta).
-- 3. Actualiza get_user_plants_vesting_summary para reportar la cuenta regresiva hacia el 
--    fin de la beta incluso para usuarios sin órdenes previas.
-- ==============================================================================

BEGIN;

-- 1. Alinear con el cierre oficial de la Fase Beta: Temporada 1
UPDATE public.plants_amm_state
   SET presale_ends_at = '2026-10-15 00:00:00+00',
       pvp_bonus_ends_at = '2026-10-22 00:00:00+00',
       updated_at = NOW()
 WHERE id = 1;

-- 2. Asegurar que get_user_plants_vesting_summary reporte la cuenta regresiva al fin de la beta
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
  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1;
  v_is_presale_running := (v_amm.presale_active AND (v_amm.presale_ends_at IS NOT NULL AND NOW() < v_amm.presale_ends_at));

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'liquidBalance', 0,
      'vestingLocked', 0,
      'totalPlants', 0,
      'claimablePlantsNow', 0,
      'dailyAccrualRate', 0,
      'activeOrdersCount', 0,
      'secondsToNextUnlock', CASE WHEN v_is_presale_running THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_amm.presale_ends_at - NOW())))::INTEGER) ELSE 0 END,
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
    IF v_is_presale_running THEN
      -- Durante la beta/preventa: 0 días transcurridos para reclamo y el próximo tick es el fin de la beta
      v_days_elapsed := 0;
      v_claimable_days := 0;
      v_order_claimable_plants := 0;
      v_secs_to_next := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_amm.presale_ends_at - NOW())))::INTEGER);
    ELSE
      -- Post-beta: transcurso normal de días de vesting
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

  -- Fallback si no tiene órdenes y la preventa está activa: muestra el tiempo hacia el fin de la beta
  IF v_is_presale_running AND v_min_secs_to_next IS NULL THEN
    v_min_secs_to_next := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_amm.presale_ends_at - NOW())))::INTEGER);
  END IF;

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
