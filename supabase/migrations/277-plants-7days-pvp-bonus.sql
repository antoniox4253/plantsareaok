-- 277-plants-7days-pvp-bonus.sql
-- Configura el bonus PvP Humano en Vivo al +25% exclusivo durante los primeros 7 días

ALTER TABLE public.plants_amm_state
ADD COLUMN IF NOT EXISTS pvp_bonus_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- Inicializar la fecha si estuviera nula
UPDATE public.plants_amm_state
SET pvp_bonus_ends_at = NOW() + INTERVAL '7 days'
WHERE pvp_bonus_ends_at IS NULL;

-- Actualizar get_plants_market_state para incluir la fecha de finalización del bonus
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
    'pvpBonusEndsAt', v_amm.pvp_bonus_ends_at,
    'pvpBonusPct', 25,
    'presaleStocks', jsonb_build_object(
      'pionero', v_amm.presale_pionero_stock,
      'campeon', v_amm.presale_campeon_stock,
      'leyenda', v_amm.presale_leyenda_stock
    )
  );
END;
$$;

-- Actualizar claim_pvp_plants_reward con multiplicador 1.25x (+25%) y límite de 7 días
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
  v_bonus_active BOOLEAN := false;
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

  -- 6. Bonus PvP Humano en Vivo (+25% durante los primeros 7 días)
  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;

  IF NOT v_room.is_async_match THEN
    IF v_amm.pvp_bonus_ends_at IS NOT NULL AND NOW() <= v_amm.pvp_bonus_ends_at THEN
      v_pvp_mult := 1.25;
      v_bonus_active := true;
    END IF;
  END IF;

  -- 7. Halving Factor
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
    'bonusActive', v_bonus_active,
    'bonusPct', CASE WHEN v_bonus_active THEN 25 ELSE 0 END,
    'dailyClaimsUsed', v_daily_claims + 1,
    'dailyClaimsMax', 20
  );
END;
$$;
