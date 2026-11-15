-- ==============================================================================
-- MIGRACIÓN 436: CORRECCIÓN DEFINITIVA DE RPC swap_plants_for_usdt (CURVA AMM Y QUEMA)
-- ==============================================================================
-- Problema:
-- Al convertir tokens PLANTS a saldo USDT, la función fallaba con el error:
-- column "total_plants_burned" does not exist
-- debido a que la columna en public.plants_amm_state es `total_burned`.
-- Adicionalmente, intentaba insertar en una tabla inexistente `plants_amm_swaps`
-- y tenía descalibrado el filtro de Arena 3 a 3001 copas en vez de 2001 copas.
--
-- Solución:
-- 1. Corregir `total_plants_burned` por `total_burned`.
-- 2. Registrar la auditoría contable en `public.plants_price_history` y `public.transactions`.
-- 3. Alinear la regla de Arena 3 a 2,001+ copas (estándar de la economía de PLANTS).
-- 4. Aplicar la fórmula canónica de Constant Product (x * y = k):
--    Delta_Y (gross USDT) = (usdt_pool * p_amount) / (virtual_plants + p_amount)
--    Fee (5% retención para el pool) = gross * 0.05
--    Net USDT acreditado al usuario = gross * 0.95
--    R_new = usdt_pool - Net_USDT
--    V_new = ROUND(k_constant / R_new, 4)
--    Spot_new = R_new / V_new
-- 5. Retornar tanto `usdtCredited`, `netUsdt` y `usdtReceived` para compatibilidad total con la UI.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.swap_plants_for_usdt(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto de PLANTS inválido';
  END IF;

  -- 1. Bloquear y verificar perfil de usuario
  SELECT elo_rating, has_vip_pass, plants_balance, usdt_balance
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  -- 2. Regla canónica de retiro/swap: Arena 3+ (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RAISE EXCEPTION 'El Swap a USDT requiere alcanzar al menos Arena 3 (2,001+ copas). Tu ELO actual es %', COALESCE(v_prof.elo_rating, 0);
  END IF;

  -- 3. Validar saldo líquido de PLANTS
  IF COALESCE(v_prof.plants_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Saldo líquido insuficiente. Tienes % PLANTS y solicitas %', COALESCE(v_prof.plants_balance, 0), p_amount;
  END IF;

  -- 4. Bloquear estado del AMM
  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;

  -- 5. Curva AMM canónica: Vende p_amount PLANTS al pool
  -- Delta_Y_gross = (Pool_USDT * Delta_Plants) / (Virtual_Plants + Delta_Plants)
  v_gross_usdt := (v_amm.usdt_pool * p_amount) / (v_amm.virtual_plants + p_amount);

  IF v_gross_usdt <= 0 THEN
    RAISE EXCEPTION 'Error de cálculo de liquidez en la curva AMM';
  END IF;

  -- 6. Comisión del 5% retenida en el pool (quema de tokens e inyección de respaldo)
  v_fee_usdt := v_gross_usdt * 0.05;
  v_net_usdt := v_gross_usdt * 0.95;

  IF v_net_usdt > v_amm.usdt_pool THEN
    RAISE EXCEPTION 'El pool de liquidez no dispone de suficientes fondos USDT';
  END IF;

  -- 7. Salida neta de USDT del pool hacia el saldo de usuario
  v_new_r := v_amm.usdt_pool - v_net_usdt;
  -- Mantener la curva AMM balanceada (K = R * V)
  v_new_v := ROUND(v_amm.k_constant / v_new_r, 4);
  v_new_spot := v_new_r / v_new_v;

  -- 8. Actualizar AMM: usdt_pool, virtual_plants y quema en total_burned
  UPDATE public.plants_amm_state
  SET
    usdt_pool = v_new_r,
    virtual_plants = v_new_v,
    total_burned = total_burned + p_amount,
    updated_at = NOW()
  WHERE id = 1;

  -- 9. Actualizar Perfil del Usuario: Deducir PLANTS y Acreditar USDT
  UPDATE public.profiles
  SET
    plants_balance = plants_balance - p_amount,
    usdt_balance = COALESCE(usdt_balance, 0) + v_net_usdt,
    updated_at = NOW()
  WHERE id = v_uid;

  -- 10. Registrar en historial de precios de la curva AMM
  INSERT INTO public.plants_price_history (
    spot_price,
    usdt_pool,
    virtual_plants,
    event_type,
    delta_usdt,
    delta_plants,
    user_id,
    metadata
  ) VALUES (
    v_new_spot,
    v_new_r,
    v_new_v,
    'swap_usdt',
    -v_net_usdt,
    -p_amount,
    v_uid,
    jsonb_build_object(
      'grossUsdt', ROUND(v_gross_usdt, 4),
      'netUsdt', ROUND(v_net_usdt, 4),
      'feeUsdt', ROUND(v_fee_usdt, 4),
      'plantsSold', p_amount
    )
  );

  -- 11. Auditoría contable en transactions
  INSERT INTO public.transactions (
    user_id,
    type,
    amount_usd,
    description,
    status
  ) VALUES (
    v_uid,
    'swap_plants_to_usdt',
    ROUND(v_net_usdt, 4),
    format('Swap AMM: %s PLANTS -> %s USDT', ROUND(p_amount, 2), ROUND(v_net_usdt, 4)),
    'completed'
  );

  -- 12. Respuesta completa para el cliente
  RETURN jsonb_build_object(
    'success', true,
    'plantsSold', p_amount,
    'grossUsdt', ROUND(v_gross_usdt, 4),
    'netUsdt', ROUND(v_net_usdt, 4),
    'usdtCredited', ROUND(v_net_usdt, 4),
    'usdtReceived', ROUND(v_net_usdt, 4),
    'feeUsdt', ROUND(v_fee_usdt, 4),
    'newUsdtBalance', ROUND(COALESCE(v_prof.usdt_balance, 0) + v_net_usdt, 4),
    'newSpotPrice', ROUND(v_new_spot, 8)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_plants_for_usdt(NUMERIC) TO authenticated, anon, service_role;

-- Auditoría
INSERT INTO public._migration_audit (fase, detalle)
VALUES (
  '436-fix-plants-token-swap-usdt-curve-and-burned-column',
  jsonb_build_object(
    'timestamp', NOW(),
    'function_repaired', 'swap_plants_for_usdt',
    'total_burned_column_fixed', true,
    'amm_curve_synced', true,
    'arena_3_threshold', 2001
  )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
