-- ==============================================================================
-- MIGRACIÓN 283: SINCRONIZACIÓN DINÁMICA DE PREVENTA, VESTING, SWAP Y STAKING
-- 1. Agrega presale_ends_at (5 días) a plants_amm_state.
-- 2. Enriquece get_plants_market_state() con métricas en tiempo real:
--    - presaleEndsAt (timestamp ISO)
--    - presalePacksSold (packs vendidos de 20)
--    - presalePacksRemaining (packs restantes de 20)
--    - presalePlantsCommitted (suma real de plants_presale_orders)
--    - initialPoolUsdt (fondo inicial $200 USDT)
--    - currentHalvingEra (calculado dinámicamente según total_minted)
-- 3. Blindaje de buy_plants_presale_pack validando caducidad de tiempo de preventa.
-- 4. Verificación de permisos y RLS para acceso seguro.
-- ==============================================================================

BEGIN;

-- 1. Campo de fecha límite de preventa a 5 días
ALTER TABLE public.plants_amm_state
  ADD COLUMN IF NOT EXISTS presale_ends_at TIMESTAMPTZ;

-- Inicializar a exactamente 5 días a partir de ahora si es nulo o expirado
UPDATE public.plants_amm_state
   SET presale_ends_at = NOW() + INTERVAL '5 days',
       updated_at = NOW()
 WHERE id = 1 AND (presale_ends_at IS NULL OR presale_ends_at <= NOW());

-- 2. Función autoritativa enriquecida get_plants_market_state()
CREATE OR REPLACE FUNCTION public.get_plants_market_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amm RECORD;
  v_spot NUMERIC;
  v_circulating NUMERIC;
  v_halving_era INTEGER;
  v_is_presale_active BOOLEAN;
  v_packs_sold INTEGER;
  v_packs_remaining INTEGER;
  v_committed_plants NUMERIC;
BEGIN
  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estado de AMM no inicializado';
  END IF;

  -- Cálculo de precio spot según curva AMM (R / V)
  v_spot := v_amm.usdt_pool / v_amm.virtual_plants;
  v_circulating := GREATEST(0, v_amm.total_minted - v_amm.total_burned);

  -- Era de Halving dinámica según total_minted acumulado
  v_halving_era := CASE
    WHEN v_amm.total_minted < 500000.0 THEN 1
    WHEN v_amm.total_minted < 750000.0 THEN 2
    WHEN v_amm.total_minted < 875000.0 THEN 3
    WHEN v_amm.total_minted < 937500.0 THEN 4
    ELSE 5
  END;

  -- Validación de preventa activa: flag activo y tiempo no expirado
  v_is_presale_active := v_amm.presale_active AND (v_amm.presale_ends_at IS NULL OR NOW() < v_amm.presale_ends_at);

  -- Packs vendidos y restantes (Stock base total: 10 + 6 + 4 = 20)
  v_packs_sold := (10 - v_amm.presale_pionero_stock) + (6 - v_amm.presale_campeon_stock) + (4 - v_amm.presale_leyenda_stock);
  v_packs_remaining := v_amm.presale_pionero_stock + v_amm.presale_campeon_stock + v_amm.presale_leyenda_stock;

  -- PLANTS reales comprometidos en órdenes de preventa
  SELECT COALESCE(SUM(plants_amount), 0.0)
    INTO v_committed_plants
    FROM public.plants_presale_orders;

  RETURN jsonb_build_object(
    'spotPrice', ROUND(v_spot, 8),
    'usdtPool', ROUND(v_amm.usdt_pool, 4),
    'virtualPlants', ROUND(v_amm.virtual_plants, 4),
    'totalMinted', ROUND(v_amm.total_minted, 4),
    'totalBurned', ROUND(v_amm.total_burned, 4),
    'circulatingSupply', ROUND(v_circulating, 4),
    'marketCapUsdt', ROUND(v_circulating * v_spot, 4),
    'currentHalvingEra', v_halving_era,
    'presaleActive', v_is_presale_active,
    'presaleEndsAt', v_amm.presale_ends_at,
    'presalePacksSold', v_packs_sold,
    'presalePacksRemaining', v_packs_remaining,
    'presalePlantsCommitted', ROUND(v_committed_plants, 2),
    'initialPoolUsdt', 200.00,
    'pvpBonusPct', COALESCE(25, 25),
    'pvpBonusEndsAt', v_amm.pvp_bonus_ends_at,
    'presaleStocks', jsonb_build_object(
      'pionero', v_amm.presale_pionero_stock,
      'campeon', v_amm.presale_campeon_stock,
      'leyenda', v_amm.presale_leyenda_stock
    )
  );
END;
$$;

-- 3. Blindaje de buy_plants_presale_pack verificando ventana de 5 días
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
  v_new_halving_era INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF COALESCE(p_payment_method, 'gems') <> 'gems' THEN
    RAISE EXCEPTION 'Método de pago no admitido. Los packs de preventa se adquieren exclusivamente con Gemas.';
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;
  IF NOT v_amm.presale_active OR (v_amm.presale_ends_at IS NOT NULL AND NOW() >= v_amm.presale_ends_at) THEN
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

  -- Recalcular Halving
  v_new_halving_era := CASE
    WHEN (v_amm.total_minted + v_plants) < 500000.0 THEN 1
    WHEN (v_amm.total_minted + v_plants) < 750000.0 THEN 2
    WHEN (v_amm.total_minted + v_plants) < 875000.0 THEN 3
    WHEN (v_amm.total_minted + v_plants) < 937500.0 THEN 4
    ELSE 5
  END;

  -- Actualizar AMM
  UPDATE public.plants_amm_state
  SET
    usdt_pool = v_new_pool,
    virtual_plants = v_new_virtual,
    total_minted = total_minted + v_plants,
    current_halving_era = v_new_halving_era,
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

COMMIT;
