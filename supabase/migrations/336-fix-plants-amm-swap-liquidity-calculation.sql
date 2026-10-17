-- ==============================================================================
-- MIGRACIÓN 336: CORRECCIÓN DE CÁLCULO DE LIQUIDEZ Y SINCRONIZACIÓN CURVA AMM
-- ==============================================================================
-- Problema:
-- Al realizar canjes de PLANTS por USDT en la función `swap_plants_for_usdt` o
-- `request_plants_cashout`, el USDT salía del pool pero `virtual_plants` no se
-- actualizaba ni sincronizaba con `k_constant`. Esto provocaba que `k / V` fuera
-- mayor que el `usdt_pool` disponible, causando que `v_gross_usdt` fuera <= 0
-- y lanzando la excepción 'Error de cálculo de liquidez en la curva AMM'.
--
-- Solución:
-- 1. Resincronizar la reserva `virtual_plants` actual con `k_constant / usdt_pool`.
-- 2. Utilizar la fórmula canónica de Constant Product (x * y = k):
--    Delta_Y (gross USDT) = (Pool_USDT * Delta_Plants) / (Virtual_Plants + Delta_Plants)
--    Garantizando matemáticamente que siempre sea estrictamente positiva.
-- 3. Mantener `virtual_plants = k_constant / nuevo_usdt_pool` sincronizado en cada swap.
-- ==============================================================================

-- 1. Resincronizar el estado actual del AMM
UPDATE public.plants_amm_state
SET
  virtual_plants = ROUND(k_constant / usdt_pool, 4),
  updated_at = NOW()
WHERE id = 1;

-- 2. Corregir y robustecer RPC swap_plants_for_usdt
CREATE OR REPLACE FUNCTION public.swap_plants_for_usdt(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_amm RECORD;
  v_gross_usdt NUMERIC;
  v_fee_usdt NUMERIC;
  v_net_usdt NUMERIC;
  v_new_r NUMERIC;
  v_new_v NUMERIC;
  v_new_spot NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Monto de PLANTS inválido'; END IF;

  SELECT elo_rating, has_vip_pass, plants_balance, usdt_balance
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RAISE EXCEPTION 'El Swap a USDT requiere alcanzar al menos Arena 3 (2,001+ copas). Tu ELO actual es %', COALESCE(v_prof.elo_rating, 0);
  END IF;

  IF COALESCE(v_prof.plants_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Saldo líquido insuficiente. Tienes % PLANTS y solicitas %', COALESCE(v_prof.plants_balance, 0), p_amount;
  END IF;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;

  -- Curva AMM canónica: Vende p_amount PLANTS al pool
  -- Delta_Y_gross = (R * Delta_X) / (V + Delta_X)
  v_gross_usdt := (v_amm.usdt_pool * p_amount) / (v_amm.virtual_plants + p_amount);

  IF v_gross_usdt <= 0 THEN
    RAISE EXCEPTION 'Error de cálculo de liquidez en la curva AMM';
  END IF;

  -- 5% Fee de retención para el pool
  v_fee_usdt := v_gross_usdt * 0.05;
  v_net_usdt := v_gross_usdt * 0.95;

  -- El USDT que sale del pool hacia el saldo del jugador es v_net_usdt
  v_new_r := v_amm.usdt_pool - v_net_usdt;
  -- Mantener la curva AMM perfectamente balanceada (K = R * V)
  v_new_v := v_amm.k_constant / v_new_r;
  v_new_spot := v_new_r / v_new_v;

  -- Actualizar AMM
  UPDATE public.plants_amm_state
  SET
    usdt_pool = v_new_r,
    virtual_plants = v_new_v,
    total_burned = total_burned + p_amount,
    updated_at = NOW()
  WHERE id = 1;

  -- Actualizar Perfil: Deducir PLANTS y Acreditar USDT
  UPDATE public.profiles
  SET
    plants_balance = plants_balance - p_amount,
    usdt_balance = COALESCE(usdt_balance, 0) + v_net_usdt,
    updated_at = NOW()
  WHERE id = v_uid;

  -- Registrar en historial de precios
  INSERT INTO public.plants_price_history (
    spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants, user_id, metadata
  ) VALUES (
    v_new_spot, v_new_r, v_new_v, 'swap_usdt', -v_net_usdt, -p_amount, v_uid,
    jsonb_build_object('netUsdt', ROUND(v_net_usdt, 4), 'feeUsdt', ROUND(v_fee_usdt, 4))
  );

  RETURN jsonb_build_object(
    'success', true,
    'plantsSold', p_amount,
    'grossUsdt', ROUND(v_gross_usdt, 4),
    'netUsdt', ROUND(v_net_usdt, 4),
    'feeUsdt', ROUND(v_fee_usdt, 4),
    'newUsdtBalance', ROUND(COALESCE(v_prof.usdt_balance, 0) + v_net_usdt, 4),
    'newSpotPrice', ROUND(v_new_spot, 8)
  );
END;
$$;

-- 3. Corregir y robustecer RPC request_plants_cashout
CREATE OR REPLACE FUNCTION public.request_plants_cashout(p_amount NUMERIC, p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_amm RECORD;
  v_gross_usdt NUMERIC;
  v_fee_usdt NUMERIC;
  v_net_usdt NUMERIC;
  v_pool_retained NUMERIC;
  v_new_r NUMERIC;
  v_new_v NUMERIC;
  v_new_spot NUMERIC;
  v_cooldown_hours INTEGER := 72;
  v_cooldown_until TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  -- SEGURIDAD: Mínimo de retiro de 500 PLANTS
  IF p_amount IS NULL OR p_amount < 500 THEN
    RAISE EXCEPTION 'El monto mínimo de retiro es de 500 PLANTS.';
  END IF;

  IF p_wallet IS NULL OR LENGTH(TRIM(p_wallet)) < 10 THEN
    RAISE EXCEPTION 'Dirección de wallet BEP-20 inválida.';
  END IF;

  SELECT elo_rating, has_vip_pass, plants_balance, last_plants_cashout_at
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  -- 1. Regla de Oro: Mínimo Arena 3 (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RAISE EXCEPTION 'El retiro en USDT requiere alcanzar al menos Arena 3 (2,001+ copas). Tu ELO actual es %', COALESCE(v_prof.elo_rating, 0);
  END IF;

  -- 2. Validar Saldo Líquido
  IF COALESCE(v_prof.plants_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Saldo líquido insuficiente. Tienes % PLANTS disponibles para retiro', COALESCE(v_prof.plants_balance, 0);
  END IF;

  -- 3. Validar Cooldown (72h Free, 24h VIP)
  IF v_prof.has_vip_pass THEN
    v_cooldown_hours := 24;
  END IF;

  IF v_prof.last_plants_cashout_at IS NOT NULL AND v_prof.last_plants_cashout_at + (v_cooldown_hours || ' hours')::INTERVAL > NOW() THEN
    RAISE EXCEPTION 'Debes esperar a que venza tu período de enfriamiento para solicitar otro retiro';
  END IF;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;

  -- Curva AMM canónica: Vende p_amount PLANTS al pool
  v_gross_usdt := (v_amm.usdt_pool * p_amount) / (v_amm.virtual_plants + p_amount);

  IF v_gross_usdt <= 0 THEN
    RAISE EXCEPTION 'Error de cálculo de liquidez en la curva';
  END IF;

  -- 10% Fee total: 5% se queda en el pool (refuerzo), 5% dev
  v_fee_usdt := v_gross_usdt * 0.10;
  v_net_usdt := v_gross_usdt * 0.90;
  v_pool_retained := v_gross_usdt * 0.05;

  v_new_r := v_amm.usdt_pool - (v_gross_usdt - v_pool_retained);
  v_new_v := v_amm.k_constant / v_new_r;
  v_new_spot := v_new_r / v_new_v;

  -- Actualizar AMM
  UPDATE public.plants_amm_state
  SET
    usdt_pool = v_new_r,
    virtual_plants = v_new_v,
    total_burned = total_burned + p_amount,
    updated_at = NOW()
  WHERE id = 1;

  -- Actualizar Perfil
  v_cooldown_until := NOW() + (v_cooldown_hours || ' hours')::INTERVAL;
  UPDATE public.profiles
  SET
    plants_balance = plants_balance - p_amount,
    last_plants_cashout_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  -- Registrar orden de retiro
  INSERT INTO public.plants_cashout_requests (
    user_id, plants_amount, gross_usdt, fee_usdt, net_usdt, destination_wallet, cooldown_until
  ) VALUES (
    v_uid, p_amount, v_gross_usdt, v_fee_usdt, v_net_usdt, p_wallet, v_cooldown_until
  );

  INSERT INTO public.plants_price_history (
    spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants, user_id, metadata
  ) VALUES (
    v_new_spot, v_new_r, v_new_v, 'cashout', -(v_gross_usdt - v_pool_retained), -p_amount, v_uid,
    jsonb_build_object('netUsdt', v_net_usdt, 'feeUsdt', v_fee_usdt, 'retainedPool', v_pool_retained)
  );

  RETURN jsonb_build_object(
    'success', true,
    'plantsSold', p_amount,
    'grossUsdt', ROUND(v_gross_usdt, 4),
    'netUsdt', ROUND(v_net_usdt, 4),
    'feeUsdt', ROUND(v_fee_usdt, 4),
    'newSpotPrice', ROUND(v_new_spot, 8),
    'cooldownUntil', v_cooldown_until
  );
END;
$$;
