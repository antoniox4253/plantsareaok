-- ==============================================================================
-- Migration 280: Blindaje de Seguridad y Cierre de Brechas Lógicas en Token PLANTS
-- 1. Cierra brecha en buy_plants_presale_pack: Exige exclusivamente 'gems' y elimina rama insegura.
-- 2. Idempotencia en claim_pvp_plants_reward: Crea tabla plants_pvp_room_claims para evitar que una misma victoria se reclame múltiples veces.
-- 3. Mínimo de seguridad en request_plants_cashout: Exige al menos 500 PLANTS para evitar spam de micro-retiros.
-- ==============================================================================

-- ── 1. TABLA DE IDEMPOTENCIA DE RECLAMOS PVP ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plants_pvp_room_claims (
  room_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plants_awarded NUMERIC(10, 4) NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plants_pvp_claims_user 
  ON public.plants_pvp_room_claims(user_id);

ALTER TABLE public.plants_pvp_room_claims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'plants_pvp_room_claims' 
      AND policyname = 'plants_pvp_room_claims_select'
  ) THEN
    CREATE POLICY plants_pvp_room_claims_select
      ON public.plants_pvp_room_claims
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. BLINDAJE DE buy_plants_presale_pack ───────────────────────────────────
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

  -- Registrar en historial
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

  -- Actualizar perfil: descontar costo de gemas y acreditar bono y tokens en vesting
  UPDATE public.profiles
  SET
    gems_balance = gems_balance - v_gem_cost + v_bonus_gems,
    plants_vesting_locked = COALESCE(plants_vesting_locked, 0) + v_plants,
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'packId', p_pack_id,
    'plantsLocked', v_plants,
    'gemsBonus', v_bonus_gems,
    'paymentMethod', 'gems',
    'newSpotPrice', ROUND(v_new_spot, 8),
    'newPoolUsdt', ROUND(v_new_pool, 4)
  );
END;
$$;

-- ── 3. BLINDAJE DE claim_pvp_plants_reward (IDEMPOTENCIA POR SALA) ───────────
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
  IF p_room_id IS NULL THEN RAISE EXCEPTION 'ID de sala inválido'; END IF;

  -- 1. SEGURIDAD: Validar que esta sala no haya sido cobrada previamente
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

  -- 2. Validar que el usuario sea el ganador legítimo
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

  -- 3. Filtro Maestro: Solo Arena 3+ (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ARENA_TOO_LOW', 'plantsAwarded', 0);
  END IF;

  -- 4. Anti-Collusion: Mínimo 45s de duración y 4 plantas del rival
  IF p_match_duration_sec < 45.0 OR p_enemy_plants_placed < 4 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MATCH_TOO_SHORT_OR_COLLUSION', 'plantsAwarded', 0);
  END IF;

  -- 5. Tope Diario Estricto (Máx 20 victorias al día)
  v_claims_date := COALESCE(v_prof.plants_daily_claims_date, CURRENT_DATE);
  v_daily_claims := COALESCE(v_prof.plants_daily_claims_count, 0);

  IF v_claims_date < CURRENT_DATE THEN
    v_daily_claims := 0;
    v_claims_date := CURRENT_DATE;
  END IF;

  IF v_daily_claims >= 20 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'DAILY_CLAIM_CAP_REACHED', 'plantsAwarded', 0);
  END IF;

  -- 6. Cálculo del Performance Score (0 a 100)
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

  -- Base: 2.0 a 6.0 PLANTS
  v_base_reward := 2.0 + (v_total_score / 100.0) * 4.0;

  -- 7. Bonus PvP Humano en Vivo (+25% durante los primeros 7 días)
  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;

  IF NOT v_room.is_async_match THEN
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

  v_final_plants := ROUND(v_base_reward * v_pvp_mult * v_era_factor, 2);

  -- 9. REGISTRAR EL RECLAMO DE LA SALA (Previene cualquier segundo cobro)
  INSERT INTO public.plants_pvp_room_claims (room_id, user_id, plants_awarded)
  VALUES (p_room_id, v_uid, v_final_plants);

  -- 10. Acreditar al perfil
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
    'isLivePvP', NOT v_room.is_async_match,
    'bonusActive', v_bonus_active,
    'bonusPct', CASE WHEN v_bonus_active THEN 25 ELSE 0 END,
    'dailyClaimsUsed', v_daily_claims + 1,
    'dailyClaimsMax', 20
  );
END;
$$;

-- ── 4. BLINDAJE DE request_plants_cashout ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_plants_cashout(
  p_amount NUMERIC,
  p_wallet TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_amm RECORD;
  v_new_v NUMERIC;
  v_new_r NUMERIC;
  v_gross_usdt NUMERIC;
  v_fee_usdt NUMERIC;
  v_net_usdt NUMERIC;
  v_pool_retained NUMERIC;
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

  -- Fórmula AMM: Vende p_amount PLANTS al pool
  v_new_v := v_amm.virtual_plants + p_amount;
  v_new_r := v_amm.k_constant / v_new_v;
  v_gross_usdt := v_amm.usdt_pool - v_new_r;

  IF v_gross_usdt <= 0 THEN
    RAISE EXCEPTION 'Error de cálculo de liquidez en la curva';
  END IF;

  -- 10% Fee total: 5% se queda en el pool (refuerzo), 5% dev
  v_fee_usdt := v_gross_usdt * 0.10;
  v_net_usdt := v_gross_usdt * 0.90;
  v_pool_retained := v_gross_usdt * 0.05;

  v_new_r := v_amm.usdt_pool - (v_gross_usdt - v_pool_retained);
  v_new_spot := v_new_r / v_amm.virtual_plants;

  -- Actualizar AMM
  UPDATE public.plants_amm_state
  SET
    usdt_pool = v_new_r,
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
    v_new_spot, v_new_r, v_amm.virtual_plants, 'cashout', -(v_gross_usdt - v_pool_retained), -p_amount, v_uid,
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

-- ── 5. PERMISOS ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.buy_plants_presale_pack(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_pvp_plants_reward(UUID, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_plants_cashout(NUMERIC, TEXT) TO authenticated, anon;
