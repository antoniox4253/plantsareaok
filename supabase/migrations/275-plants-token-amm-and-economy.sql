-- ==============================================================================
-- MIGRACIÓN 275: ECOSISTEMA DEL TOKEN PLANTS (AMM BONDING CURVE, PREVENTA & HALVINGS)
-- ==============================================================================

-- 1. Tabla de Estado Central del AMM
CREATE TABLE IF NOT EXISTS public.plants_amm_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  usdt_pool NUMERIC(18, 4) NOT NULL DEFAULT 200.0000,
  virtual_plants NUMERIC(18, 4) NOT NULL DEFAULT 1000000.0000,
  k_constant NUMERIC(28, 4) NOT NULL DEFAULT 200000000.0000,
  total_minted NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  total_burned NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  current_halving_era INTEGER NOT NULL DEFAULT 1,
  presale_active BOOLEAN NOT NULL DEFAULT TRUE,
  presale_pionero_stock INTEGER NOT NULL DEFAULT 10,
  presale_campeon_stock INTEGER NOT NULL DEFAULT 6,
  presale_leyenda_stock INTEGER NOT NULL DEFAULT 4,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row_amm CHECK (id = 1)
);

-- Semilla inicial del AMM si no existe
INSERT INTO public.plants_amm_state (
  id, usdt_pool, virtual_plants, k_constant, total_minted, total_burned, current_halving_era
) VALUES (
  1, 200.0000, 1000000.0000, 200000000.0000, 0.0000, 0.0000, 1
) ON CONFLICT (id) DO NOTHING;

-- 2. Historial de Precios y Velas para la Gráfica en Vivo
CREATE TABLE IF NOT EXISTS public.plants_price_history (
  id BIGSERIAL PRIMARY KEY,
  spot_price NUMERIC(18, 8) NOT NULL,
  usdt_pool NUMERIC(18, 4) NOT NULL,
  virtual_plants NUMERIC(18, 4) NOT NULL,
  event_type TEXT NOT NULL, -- 'seed', 'presale_pack', 'gem_purchase', 'cashout', 'swap_gems', 'pvp_reward'
  delta_usdt NUMERIC(18, 4) NOT NULL DEFAULT 0,
  delta_plants NUMERIC(18, 4) NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plants_price_history_created ON public.plants_price_history (created_at DESC);

-- Semilla inicial del gráfico si está vacío
INSERT INTO public.plants_price_history (
  spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants
)
SELECT 0.00020000, 200.0000, 1000000.0000, 'seed', 200.0000, 0.0000
WHERE NOT EXISTS (SELECT 1 FROM public.plants_price_history LIMIT 1);

-- 3. Tabla de Órdenes de Preventa
CREATE TABLE IF NOT EXISTS public.plants_presale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pack_id TEXT NOT NULL,
  price_usdt NUMERIC(10, 2) NOT NULL,
  plants_amount NUMERIC(18, 4) NOT NULL,
  gems_amount INTEGER NOT NULL,
  vesting_daily_rate NUMERIC(18, 4) NOT NULL,
  vesting_days_total INTEGER NOT NULL DEFAULT 30,
  vesting_claimed_days INTEGER NOT NULL DEFAULT 0,
  last_vesting_claim_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plants_presale_user ON public.plants_presale_orders (user_id);

-- 4. Tabla de Solicitudes de Cash-out (Retiros)
CREATE TABLE IF NOT EXISTS public.plants_cashout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plants_amount NUMERIC(18, 4) NOT NULL,
  gross_usdt NUMERIC(18, 4) NOT NULL,
  fee_usdt NUMERIC(18, 4) NOT NULL,
  net_usdt NUMERIC(18, 4) NOT NULL,
  destination_wallet TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  cooldown_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plants_cashout_user ON public.plants_cashout_requests (user_id);

-- 5. Campos de Token en Profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plants_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plants_vesting_locked NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plants_daily_claims_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plants_daily_claims_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS last_plants_cashout_at TIMESTAMPTZ;

-- 6. RPC: Obtener Estado del AMM y Token
CREATE OR REPLACE FUNCTION public.get_plants_market_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amm RECORD;
  v_spot NUMERIC;
  v_circulating NUMERIC;
BEGIN
  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMM state no inicializado';
  END IF;

  v_spot := v_amm.usdt_pool / v_amm.virtual_plants;
  v_circulating := GREATEST(0, v_amm.total_minted - v_amm.total_burned);

  RETURN jsonb_build_object(
    'spotPrice', ROUND(v_spot, 8),
    'usdtPool', v_amm.usdt_pool,
    'virtualPlants', v_amm.virtual_plants,
    'totalMinted', v_amm.total_minted,
    'totalBurned', v_amm.total_burned,
    'circulatingSupply', v_circulating,
    'currentHalvingEra', v_amm.current_halving_era,
    'presaleActive', v_amm.presale_active,
    'presaleStocks', jsonb_build_object(
      'pionero', v_amm.presale_pionero_stock,
      'campeon', v_amm.presale_campeon_stock,
      'leyenda', v_amm.presale_leyenda_stock
    )
  );
END;
$$;

-- 7. RPC: Historial de Velas para la Gráfica
CREATE OR REPLACE FUNCTION public.get_plants_price_history(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id BIGINT,
  spot_price NUMERIC,
  usdt_pool NUMERIC,
  event_type TEXT,
  delta_usdt NUMERIC,
  delta_plants NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    h.id,
    ROUND(h.spot_price, 8) as spot_price,
    ROUND(h.usdt_pool, 4) as usdt_pool,
    h.event_type,
    h.delta_usdt,
    h.delta_plants,
    h.created_at
  FROM public.plants_price_history h
  ORDER BY h.created_at ASC
  LIMIT p_limit;
$$;

-- 8. RPC: Compra de Pack de Preventa con Vesting e Inyección AMM
CREATE OR REPLACE FUNCTION public.buy_plants_presale_pack(p_pack_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_price NUMERIC;
  v_plants NUMERIC;
  v_gems INTEGER;
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

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;
  IF NOT v_amm.presale_active THEN
    RAISE EXCEPTION 'La preventa ha finalizado';
  END IF;

  IF p_pack_id = 'pack_pionero_10' THEN
    v_price := 10.0;
    v_plants := 2500.0;
    v_gems := 600;
    v_stock := v_amm.presale_pionero_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Pionero agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_pionero_stock = presale_pionero_stock - 1 WHERE id = 1;
  ELSIF p_pack_id = 'pack_campeon_25' THEN
    v_price := 25.0;
    v_plants := 7500.0;
    v_gems := 1800;
    v_stock := v_amm.presale_campeon_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Campeón agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_campeon_stock = presale_campeon_stock - 1 WHERE id = 1;
  ELSIF p_pack_id = 'pack_leyenda_50' THEN
    v_price := 50.0;
    v_plants := 15000.0;
    v_gems := 4000;
    v_stock := v_amm.presale_leyenda_stock;
    IF v_stock <= 0 THEN RAISE EXCEPTION 'Pack Leyenda agotado'; END IF;
    UPDATE public.plants_amm_state SET presale_leyenda_stock = presale_leyenda_stock - 1 WHERE id = 1;
  ELSE
    RAISE EXCEPTION 'ID de pack de preventa inválido: %', p_pack_id;
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
    jsonb_build_object('packId', p_pack_id, 'price', v_price, 'devShare', v_to_dev)
  );

  -- Registrar orden con vesting de 30 días
  INSERT INTO public.plants_presale_orders (
    user_id, pack_id, price_usdt, plants_amount, gems_amount, vesting_daily_rate
  ) VALUES (
    v_uid, p_pack_id, v_price, v_plants, v_gems, ROUND(v_plants / 30.0, 4)
  );

  -- Acreditar gemas inmediatas y guardar plants en vesting
  UPDATE public.profiles
  SET
    gems_balance = COALESCE(gems_balance, 0) + v_gems,
    plants_vesting_locked = COALESCE(plants_vesting_locked, 0) + v_plants,
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'packId', p_pack_id,
    'plantsLocked', v_plants,
    'gemsCredited', v_gems,
    'newSpotPrice', ROUND(v_new_spot, 8),
    'newPoolUsdt', v_new_pool
  );
END;
$$;

-- 9. RPC: Canjear PLANTS por Gemas (+20% Bonus instantáneo sin salida de USDT)
CREATE OR REPLACE FUNCTION public.swap_plants_for_gems(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_amm RECORD;
  v_spot NUMERIC;
  v_usdt_value NUMERIC;
  v_bonus_usdt NUMERIC;
  v_gems_to_credit INTEGER;
  v_deduct_vesting NUMERIC := 0;
  v_deduct_liquid NUMERIC := 0;
  v_total_avail NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Cantidad de PLANTS debe ser mayor a 0'; END IF;

  SELECT plants_balance, plants_vesting_locked, gems_balance
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  v_total_avail := COALESCE(v_prof.plants_balance, 0) + COALESCE(v_prof.plants_vesting_locked, 0);
  IF v_total_avail < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Tienes % PLANTS y requieres %', v_total_avail, p_amount;
  END IF;

  -- Priorizar deducir del vesting bloqueado (beneficio especial: canje in-game bypass de vesting)
  IF COALESCE(v_prof.plants_vesting_locked, 0) >= p_amount THEN
    v_deduct_vesting := p_amount;
  ELSE
    v_deduct_vesting := COALESCE(v_prof.plants_vesting_locked, 0);
    v_deduct_liquid := p_amount - v_deduct_vesting;
  END IF;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;
  v_spot := v_amm.usdt_pool / v_amm.virtual_plants;

  -- 1 Gema = 0.01 USDT ($10 = 1,000 gemas). Con +20% bonus:
  v_usdt_value := p_amount * v_spot;
  v_bonus_usdt := v_usdt_value * 1.20;
  v_gems_to_credit := GREATEST(1, ROUND(v_bonus_usdt / 0.01));

  -- Actualizar perfil (quemar tokens y sumar gemas)
  UPDATE public.profiles
  SET
    plants_vesting_locked = plants_vesting_locked - v_deduct_vesting,
    plants_balance = plants_balance - v_deduct_liquid,
    gems_balance = COALESCE(gems_balance, 0) + v_gems_to_credit,
    updated_at = NOW()
  WHERE id = v_uid;

  -- Quemar los tokens en el AMM (0 USDT salen del pool)
  UPDATE public.plants_amm_state
  SET
    total_burned = total_burned + p_amount,
    updated_at = NOW()
  WHERE id = 1;

  INSERT INTO public.plants_price_history (
    spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants, user_id, metadata
  ) VALUES (
    v_spot, v_amm.usdt_pool, v_amm.virtual_plants, 'swap_gems', 0, -p_amount, v_uid,
    jsonb_build_object('gemsCredited', v_gems_to_credit, 'bonusPct', 20)
  );

  RETURN jsonb_build_object(
    'success', true,
    'plantsBurned', p_amount,
    'gemsCredited', v_gems_to_credit,
    'spotPrice', ROUND(v_spot, 8)
  );
END;
$$;

-- 10. RPC: Solicitar Cash-out en USDT (Vía Curva AMM y Fee 10%)
CREATE OR REPLACE FUNCTION public.request_plants_cashout(p_amount NUMERIC, p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Cantidad de retiro inválida'; END IF;

  SELECT elo_rating, has_vip_pass, plants_balance, last_plants_cashout_at
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  -- 1. Regla de Oro: Mínimo Arena 3 (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RAISE EXCEPTION 'El retiro en USDT requiere alcanzar al menos Arena 3 (2,001+ copas). Tu ELO actual es %', COALESCE(v_prof.elo_rating, 0);
  END IF;

  -- 2. Validar Saldo Líquido (tokens en vesting NO se pueden retirar a USDT antes de desbloquearse)
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
  -- K = R * V => Nuevo V = V + p_amount
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

  -- El USDT que efectivamente abandona el pool es v_gross_usdt menos el 5% que se queda
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

-- 11. RPC: Reclamar PLANTS de Victoria PvP en Arena 3+
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;

  -- 1. Validar que el usuario sea el ganador legítimo
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

  -- 2. Filtro Maestro: Solo Arena 3+ (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ARENA_TOO_LOW', 'plantsAwarded', 0);
  END IF;

  -- 3. Anti-Collusion: Mínimo 45s de duración y 4 plantas del rival
  IF p_match_duration_sec < 45.0 OR p_enemy_plants_placed < 4 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MATCH_TOO_SHORT_OR_COLLUSION', 'plantsAwarded', 0);
  END IF;

  -- 4. Tope Diario de Partidas Gratuitas (Máx 20 victorias al día)
  v_claims_date := COALESCE(v_prof.plants_daily_claims_date, CURRENT_DATE);
  v_daily_claims := COALESCE(v_prof.plants_daily_claims_count, 0);

  IF v_claims_date < CURRENT_DATE THEN
    v_daily_claims := 0;
    v_claims_date := CURRENT_DATE;
  END IF;

  IF v_daily_claims >= 20 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'DAILY_CLAIM_CAP_REACHED', 'plantsAwarded', 0);
  END IF;

  -- 5. Cálculo del Performance Score (0 a 100)
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

  -- 6. Bonus PvP Humano en Vivo (+50%)
  IF NOT v_room.is_async_match THEN
    v_pvp_mult := 1.50;
  END IF;

  -- 7. Halving Factor
  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;
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
    'isLivePvP', NOT v_room.is_async_match,
    'dailyClaimsUsed', v_daily_claims + 1,
    'dailyClaimsMax', 20
  );
END;
$$;

-- 12. Quitar compra de energía con oro en buy_energy_pack
CREATE OR REPLACE FUNCTION public.buy_energy_pack(p_pack_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost_gems integer := 0;
  v_add_energy integer := 0;
  v_is_full boolean := false;
  v_current_energy integer;
  v_max_energy integer := 20;
  v_has_vip boolean;
  v_gems_balance numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- REGLA ESTRICTA: Bloqueo total de compras de energía con oro
  IF p_pack_id LIKE 'energy_gold%' THEN
    RAISE EXCEPTION 'La compra de energía con oro ha sido descontinuada. La energía se adquiere exclusivamente con Gemas.';
  END IF;

  IF p_pack_id IN ('energy_5', 'energy_gem_5') THEN
    v_cost_gems := 200;
    v_add_energy := 5;
  ELSIF p_pack_id IN ('energy_10', 'energy_gem_10') THEN
    v_cost_gems := 300;
    v_add_energy := 10;
  ELSIF p_pack_id IN ('energy_full', 'energy_gem_full') THEN
    v_cost_gems := 500;
    v_is_full := true;
  ELSIF p_pack_id = 'energy_3' THEN
    v_cost_gems := 200;
    v_add_energy := 3;
  ELSIF p_pack_id = 'energy_12' THEN
    v_cost_gems := 600;
    v_add_energy := 12;
  ELSE
    RAISE EXCEPTION 'Paquete de energía inválido: %', p_pack_id;
  END IF;

  SELECT energy_current, has_vip_pass, gems_balance
  INTO v_current_energy, v_has_vip, v_gems_balance
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  IF v_has_vip THEN v_max_energy := 25; END IF;
  v_current_energy := COALESCE(v_current_energy, v_max_energy);

  IF v_is_full THEN
    IF v_current_energy >= v_max_energy THEN
      RAISE EXCEPTION 'Tu energía ya está completa (%/%)', v_current_energy, v_max_energy;
    END IF;
    v_add_energy := v_max_energy - v_current_energy;
  END IF;

  IF COALESCE(v_gems_balance, 0) < v_cost_gems THEN
    RAISE EXCEPTION 'Gemas insuficientes. Tienes % y requieres %', COALESCE(v_gems_balance, 0), v_cost_gems;
  END IF;

  -- 70% de la compra de gemas de energía inyecta liquidez al AMM de PLANTS
  -- 1 Gema = 0.01 USDT => v_cost_gems * 0.01 = USDT gastados. 70% va a R.
  UPDATE public.plants_amm_state
  SET
    usdt_pool = usdt_pool + ((v_cost_gems * 0.01) * 0.70),
    updated_at = NOW()
  WHERE id = 1;

  UPDATE public.profiles
  SET
    gems_balance = gems_balance - v_cost_gems,
    energy_current = LEAST(v_max_energy, v_current_energy + v_add_energy),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'energyAdded', v_add_energy,
    'energyCurrent', LEAST(v_max_energy, v_current_energy + v_add_energy),
    'spentGems', v_cost_gems
  );
END;
$$;
