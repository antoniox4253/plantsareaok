-- 276-fix-presale-pack-payment.sql
-- Valida el pago en Gemas o Cripto al comprar packs de preventa PLANTS

CREATE OR REPLACE FUNCTION public.buy_plants_presale_pack(
  p_pack_id TEXT,
  p_payment_method TEXT DEFAULT 'gems'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
      'bonusGems', v_bonus_gems
    )
  );

  -- Registrar orden con vesting de 30 días
  INSERT INTO public.plants_presale_orders (
    user_id, pack_id, price_usdt, plants_amount, gems_amount, vesting_daily_rate
  ) VALUES (
    v_uid, p_pack_id, v_price, v_plants, v_bonus_gems, ROUND(v_plants / 30.0, 4)
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
    'newPoolUsdt', ROUND(v_new_pool, 4)
  );
END;
$$;
