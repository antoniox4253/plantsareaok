-- ==============================================================================
-- MIGRACIÓN 282: ACTUALIZACIÓN ESTRICTA DE RECOMPENSAS DE PACKS DE PREVENTA
-- 1. Pack Pionero ($10 USDT / 1,000 Gemas):
--    - 💎 +200 Gemas de bono
--    - 🎁 1 Sobre Común ('basic') + 1,000 ORO
--    - 💧 Inyecta $6.0 USDT al Pool (60%)
--    - 📊 Vesting: +55.56 PLANTS/día (45d) (Total: 2,500 PLANTS)
-- 2. Pack Campeón ($25 USDT / 2,500 Gemas):
--    - 💎 +500 Gemas de bono
--    - 🎁 1 Sobre Épico ('epic') + 2,500 ORO
--    - 💧 Inyecta $15.0 USDT al Pool (60%)
--    - 📊 Vesting: +166.67 PLANTS/día (45d) (Total: 7,500 PLANTS)
-- 3. Pack Leyenda ($50 USDT / 5,000 Gemas):
--    - 💎 +1,000 Gemas de bono
--    - 🎁 1 Sobre Legendario ('legendary') + 4,000 ORO
--    - 💧 Inyecta $30.0 USDT al Pool (60%)
--    - 📊 Vesting: +333.33 PLANTS/día (45d) (Total: 15,000 PLANTS)
-- ==============================================================================

-- Eliminar posibles sobrecargas ambiguas de buy_plants_presale_pack
DROP FUNCTION IF EXISTS public.buy_plants_presale_pack(TEXT);
DROP FUNCTION IF EXISTS public.buy_plants_presale_pack(TEXT, TEXT);

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
  v_bonus_gold BIGINT;
  v_pack_reward TEXT;
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

  -- SEGURIDAD: Solo se admite pago verificado en Gemas
  IF COALESCE(p_payment_method, 'gems') <> 'gems' THEN
    RAISE EXCEPTION 'Método de pago no admitido. Los packs de preventa se adquieren exclusivamente con Gemas.';
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
    v_bonus_gems := 200;
    v_bonus_gold := 1000;
    v_pack_reward := 'basic';
    v_stock := v_amm.presale_pionero_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Pionero agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_pionero_stock = presale_pionero_stock - 1 WHERE id = 1;
  ELSIF p_pack_id = 'pack_campeon_25' THEN
    v_price := 25.0;
    v_plants := 7500.0;
    v_bonus_gems := 500;
    v_bonus_gold := 2500;
    v_pack_reward := 'epic';
    v_stock := v_amm.presale_campeon_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Campeón agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_campeon_stock = presale_campeon_stock - 1 WHERE id = 1;
  ELSIF p_pack_id = 'pack_leyenda_50' THEN
    v_price := 50.0;
    v_plants := 15000.0;
    v_bonus_gems := 1000;
    v_bonus_gold := 4000;
    v_pack_reward := 'legendary';
    v_stock := v_amm.presale_leyenda_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Leyenda agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_leyenda_stock = presale_leyenda_stock - 1 WHERE id = 1;
  ELSE
    RAISE EXCEPTION 'ID de pack de preventa inválido: %', p_pack_id;
  END IF;

  -- 1 USDT = 100 Gemas
  v_gem_cost := ROUND(v_price * 100);

  IF COALESCE(v_prof.gems_balance, 0) < v_gem_cost THEN
    RAISE EXCEPTION 'Saldo insuficiente de Gemas. Tienes % 💎 y requieres % 💎 para este pack',
      COALESCE(v_prof.gems_balance, 0), v_gem_cost;
  END IF;

  -- 60% al Pool USDT, 40% a Dev
  v_to_pool := v_price * 0.60;
  v_to_dev := v_price * 0.40;

  v_new_pool := v_amm.usdt_pool + v_to_pool;
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

  -- Registrar en historial AMM
  INSERT INTO public.plants_price_history (
    spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants, user_id, metadata
  ) VALUES (
    v_new_spot, v_new_pool, v_new_virtual, 'presale_pack', v_to_pool, v_plants, v_uid,
    jsonb_build_object(
      'packId', p_pack_id,
      'price', v_price,
      'devShare', v_to_dev,
      'paymentMethod', 'gems',
      'bonusGems', v_bonus_gems,
      'bonusGold', v_bonus_gold,
      'packReward', v_pack_reward,
      'vestingDays', 45
    )
  );

  v_daily_rate := ROUND(v_plants / 45.0, 4);

  -- Registrar orden con vesting de 45 días
  INSERT INTO public.plants_presale_orders (
    user_id, pack_id, price_usdt, plants_amount, gems_amount, vesting_daily_rate, vesting_days_total
  ) VALUES (
    v_uid, p_pack_id, v_price, v_plants, v_bonus_gems, v_daily_rate, 45
  );

  -- Actualizar perfil: descontar costo de gemas, acreditar bono de gemas, oro y tokens en vesting
  UPDATE public.profiles
  SET
    gems_balance = gems_balance - v_gem_cost + v_bonus_gems,
    gold_balance = COALESCE(gold_balance, 0) + v_bonus_gold,
    plants_vesting_locked = COALESCE(plants_vesting_locked, 0) + v_plants,
    updated_at = NOW()
  WHERE id = v_uid;

  -- Entregar Sobre al inventario de sobres del jugador (player_packs)
  INSERT INTO public.player_packs (user_id, pack_id, source)
  VALUES (v_uid, v_pack_reward, 'presale_pack');

  -- Registrar transacción contable
  INSERT INTO public.transactions (
    user_id, type, amount_gems, amount_gold, description, status
  ) VALUES (
    v_uid, 'presale_pack_bonus', v_bonus_gems, v_bonus_gold,
    'Bono Preventa ' || p_pack_id || ': +' || v_bonus_gems || ' 💎, +' || v_bonus_gold || ' Oro y 1 Sobre (' || v_pack_reward || ')',
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'packId', p_pack_id,
    'plantsLocked', v_plants,
    'gemsBonus', v_bonus_gems,
    'goldBonus', v_bonus_gold,
    'packReward', v_pack_reward,
    'paymentMethod', 'gems',
    'newSpotPrice', ROUND(v_new_spot, 8),
    'newPoolUsdt', ROUND(v_new_pool, 4)
  );
END;
$$;
