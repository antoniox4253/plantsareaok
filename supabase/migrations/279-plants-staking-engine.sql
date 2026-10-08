-- ==============================================================================
-- Migration 279: Sistema de Staking Botánico para Token PLANTS
-- 1. Agrega plants_staked_balance a profiles.
-- 2. Tabla plants_staking_positions para posiciones libres con rendimientos de Gemas y Oro.
-- 3. RPC stake_plants(p_amount NUMERIC, p_duration_days INT): 30, 60 o 90 días.
-- 4. RPC get_my_staking_positions(): Resumen en tiempo real y cálculo de acumulación.
-- 5. RPC claim_staking_daily_rewards(p_position_id UUID): Cobro de Gemas y Oro diarios.
-- 6. RPC unstake_plants(p_position_id UUID): Devolución de capital al vencer + Sobres y Skins de bonificación.
-- ==============================================================================

-- ── 1. COLUMNA EN PROFILES ──────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plants_staked_balance NUMERIC NOT NULL DEFAULT 0.0;

-- ── 2. TABLA DE POSICIONES DE STAKING ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plants_staking_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(14, 4) NOT NULL CHECK (amount > 0),
  duration_days INTEGER NOT NULL CHECK (duration_days IN (30, 60, 90)),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  daily_gem_rate NUMERIC(10, 4) NOT NULL,
  daily_gold_rate NUMERIC(10, 4) NOT NULL,
  total_gems_claimed NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_gold_claimed BIGINT NOT NULL DEFAULT 0,
  last_reward_claim_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  completed_at TIMESTAMPTZ,
  bonus_packs_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plants_staking_user_status 
  ON public.plants_staking_positions(user_id, status);

ALTER TABLE public.plants_staking_positions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'plants_staking_positions' 
      AND policyname = 'plants_staking_positions_owner_select'
  ) THEN
    CREATE POLICY plants_staking_positions_owner_select
      ON public.plants_staking_positions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. RPC: Iniciar Staking de PLANTS ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.stake_plants(NUMERIC, INTEGER);

CREATE OR REPLACE FUNCTION public.stake_plants(
  p_amount NUMERIC,
  p_duration_days INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof RECORD;
  v_min_amount NUMERIC;
  v_gem_rate NUMERIC;
  v_gold_rate NUMERIC;
  v_end_date TIMESTAMPTZ;
  v_pos_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monto de staking inválido.');
  END IF;

  IF p_duration_days NOT IN (30, 60, 90) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plazo de staking inválido. Elige 30, 60 o 90 días.');
  END IF;

  -- Validar montos mínimos simbólicos para evitar exploits
  IF p_duration_days = 30 THEN
    v_min_amount := 500;
    v_gem_rate := ROUND(p_amount * 0.0008, 4);
    v_gold_rate := ROUND(p_amount * 0.0050, 4);
  ELSIF p_duration_days = 60 THEN
    v_min_amount := 5000;
    v_gem_rate := ROUND(p_amount * 0.0010, 4);
    v_gold_rate := ROUND(p_amount * 0.0060, 4);
  ELSE -- 90 días
    v_min_amount := 25000;
    v_gem_rate := ROUND(p_amount * 0.0012, 4);
    v_gold_rate := ROUND(p_amount * 0.0070, 4);
  END IF;

  IF p_amount < v_min_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('El monto mínimo para el plan de %s días es de %s PLANTS.', p_duration_days, v_min_amount)
    );
  END IF;

  SELECT * INTO v_prof
    FROM public.profiles
   WHERE id = v_uid
   FOR UPDATE;

  IF COALESCE(v_prof.plants_balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Saldo insuficiente de PLANTS líquidos. Tienes %s PLANTS disponibles.', ROUND(COALESCE(v_prof.plants_balance, 0), 2))
    );
  END IF;

  -- Calcular fecha de finalización
  v_end_date := NOW() + (p_duration_days || ' days')::INTERVAL;

  -- Descontar saldo líquido y sumar a staked
  UPDATE public.profiles
     SET plants_balance = plants_balance - p_amount,
         plants_staked_balance = COALESCE(plants_staked_balance, 0) + p_amount,
         updated_at = NOW()
   WHERE id = v_uid;

  -- Insertar posición de staking
  INSERT INTO public.plants_staking_positions (
    user_id, amount, duration_days, start_date, end_date,
    daily_gem_rate, daily_gold_rate, last_reward_claim_at
  ) VALUES (
    v_uid, p_amount, p_duration_days, NOW(), v_end_date,
    v_gem_rate, v_gold_rate, NOW()
  ) RETURNING id INTO v_pos_id;

  RETURN jsonb_build_object(
    'success', true,
    'positionId', v_pos_id,
    'amount', p_amount,
    'durationDays', p_duration_days,
    'dailyGemRate', v_gem_rate,
    'dailyGoldRate', v_gold_rate,
    'endDate', v_end_date,
    'newLiquidBalance', ROUND(v_prof.plants_balance - p_amount, 4),
    'newStakedBalance', ROUND(COALESCE(v_prof.plants_staked_balance, 0) + p_amount, 4)
  );
END;
$$;

-- ── 4. RPC: Consultar Posiciones de Staking y Acumulación en Vivo ─────────────
DROP FUNCTION IF EXISTS public.get_my_staking_positions();

CREATE OR REPLACE FUNCTION public.get_my_staking_positions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_pos RECORD;
  v_positions_json JSONB := '[]'::jsonb;
  v_total_staked NUMERIC := 0.0;
  v_total_claimable_gems NUMERIC := 0.0;
  v_total_claimable_gold BIGINT := 0;
  v_active_count INTEGER := 0;
  v_secs_remaining INTEGER;
  v_is_mature BOOLEAN;
  v_effective_claim_until TIMESTAMPTZ;
  v_days_elapsed NUMERIC;
  v_claimable_gems NUMERIC;
  v_claimable_gold BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'totalStaked', 0,
      'totalClaimableGems', 0,
      'totalClaimableGold', 0,
      'activeCount', 0,
      'positions', '[]'::jsonb
    );
  END IF;

  FOR v_pos IN
    SELECT *
      FROM public.plants_staking_positions
     WHERE user_id = v_uid
     ORDER BY created_at DESC
  LOOP
    v_secs_remaining := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_pos.end_date - NOW())))::INTEGER);
    v_is_mature := (NOW() >= v_pos.end_date);

    IF v_pos.status = 'active' THEN
      v_active_count := v_active_count + 1;
      v_total_staked := v_total_staked + v_pos.amount;

      -- Acumulación de Gemas y Oro en tiempo real
      v_effective_claim_until := LEAST(NOW(), v_pos.end_date);
      v_days_elapsed := GREATEST(0.0, EXTRACT(EPOCH FROM (v_effective_claim_until - v_pos.last_reward_claim_at)) / 86400.0);
      v_claimable_gems := ROUND(v_days_elapsed * v_pos.daily_gem_rate, 2);
      v_claimable_gold := ROUND(v_days_elapsed * v_pos.daily_gold_rate)::BIGINT;

      v_total_claimable_gems := v_total_claimable_gems + v_claimable_gems;
      v_total_claimable_gold := v_total_claimable_gold + v_claimable_gold;
    ELSE
      v_claimable_gems := 0.0;
      v_claimable_gold := 0;
    END IF;

    v_positions_json := v_positions_json || jsonb_build_object(
      'id', v_pos.id,
      'amount', v_pos.amount,
      'durationDays', v_pos.duration_days,
      'startDate', v_pos.start_date,
      'endDate', v_pos.end_date,
      'dailyGemRate', v_pos.daily_gem_rate,
      'dailyGoldRate', v_pos.daily_gold_rate,
      'totalGemsClaimed', v_pos.total_gems_claimed,
      'totalGoldClaimed', v_pos.total_gold_claimed,
      'claimableGemsNow', v_claimable_gems,
      'claimableGoldNow', v_claimable_gold,
      'secondsRemaining', v_secs_remaining,
      'isMature', v_is_mature,
      'status', v_pos.status,
      'bonusPacksClaimed', v_pos.bonus_packs_claimed,
      'completedAt', v_pos.completed_at,
      'createdAt', v_pos.created_at
    );
  END LOOP;

  RETURN jsonb_build_object(
    'totalStaked', ROUND(v_total_staked, 4),
    'totalClaimableGems', ROUND(v_total_claimable_gems, 2),
    'totalClaimableGold', v_total_claimable_gold,
    'activeCount', v_active_count,
    'positions', v_positions_json
  );
END;
$$;

-- ── 5. RPC: Reclamar Recompensas Diarias Acumuladas ─────────────────────────
DROP FUNCTION IF EXISTS public.claim_staking_daily_rewards(UUID);

CREATE OR REPLACE FUNCTION public.claim_staking_daily_rewards(
  p_position_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_pos RECORD;
  v_total_gems_granted NUMERIC := 0.0;
  v_total_gold_granted BIGINT := 0;
  v_effective_claim_until TIMESTAMPTZ;
  v_days_elapsed NUMERIC;
  v_pos_gems NUMERIC;
  v_pos_gold BIGINT;
  v_claimed_positions_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  FOR v_pos IN
    SELECT *
      FROM public.plants_staking_positions
     WHERE user_id = v_uid
       AND status = 'active'
       AND (p_position_id IS NULL OR id = p_position_id)
     FOR UPDATE
  LOOP
    v_effective_claim_until := LEAST(NOW(), v_pos.end_date);
    v_days_elapsed := GREATEST(0.0, EXTRACT(EPOCH FROM (v_effective_claim_until - v_pos.last_reward_claim_at)) / 86400.0);
    v_pos_gems := ROUND(v_days_elapsed * v_pos.daily_gem_rate, 2);
    v_pos_gold := ROUND(v_days_elapsed * v_pos.daily_gold_rate)::BIGINT;

    IF v_pos_gems > 0 OR v_pos_gold > 0 THEN
      UPDATE public.plants_staking_positions
         SET total_gems_claimed = total_gems_claimed + v_pos_gems,
             total_gold_claimed = total_gold_claimed + v_pos_gold,
             last_reward_claim_at = v_effective_claim_until
       WHERE id = v_pos.id;

      v_total_gems_granted := v_total_gems_granted + v_pos_gems;
      v_total_gold_granted := v_total_gold_granted + v_pos_gold;
      v_claimed_positions_count := v_claimed_positions_count + 1;
    END IF;
  END LOOP;

  IF v_total_gems_granted > 0 OR v_total_gold_granted > 0 THEN
    UPDATE public.profiles
       SET gems_balance = gems_balance + v_total_gems_granted,
           gold_balance = gold_balance + v_total_gold_granted,
           updated_at = NOW()
     WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'claimedGems', v_total_gems_granted,
    'claimedGold', v_total_gold_granted,
    'positionsCount', v_claimed_positions_count
  );
END;
$$;

-- ── 6. RPC: Desbloquear Staking y Reclamar Bonus al Vencer ────────────────────
DROP FUNCTION IF EXISTS public.unstake_plants(UUID);

CREATE OR REPLACE FUNCTION public.unstake_plants(
  p_position_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_pos RECORD;
  v_prof RECORD;
  v_effective_claim_until TIMESTAMPTZ;
  v_days_elapsed NUMERIC;
  v_pos_gems NUMERIC := 0.0;
  v_pos_gold BIGINT := 0;
  v_bonus_desc TEXT;
  v_bonus_packs_list JSONB := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_pos
    FROM public.plants_staking_positions
   WHERE id = p_position_id
     AND user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posición de staking no encontrada.');
  END IF;

  IF v_pos.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta posición de staking ya ha sido finalizada.');
  END IF;

  IF NOW() < v_pos.end_date THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('El periodo de staking aún no finaliza. Vence el %s.', to_char(v_pos.end_date, 'YYYY-MM-DD HH24:MI:SS UTC'))
    );
  END IF;

  -- 1. Cobrar cualquier remanente diario acumulado pendiente
  v_effective_claim_until := v_pos.end_date;
  v_days_elapsed := GREATEST(0.0, EXTRACT(EPOCH FROM (v_effective_claim_until - v_pos.last_reward_claim_at)) / 86400.0);
  v_pos_gems := ROUND(v_days_elapsed * v_pos.daily_gem_rate, 2);
  v_pos_gold := ROUND(v_days_elapsed * v_pos.daily_gold_rate)::BIGINT;

  -- 2. Devolver los tokens PLANTS al balance líquido
  UPDATE public.profiles
     SET plants_balance = plants_balance + v_pos.amount,
         plants_staked_balance = GREATEST(0, COALESCE(plants_staked_balance, 0) - v_pos.amount),
         gems_balance = gems_balance + v_pos_gems,
         gold_balance = gold_balance + v_pos_gold,
         updated_at = NOW()
   WHERE id = v_uid;

  -- 3. Entregar Sobres y Bonus según el Plazo y Monto
  IF v_pos.duration_days = 30 THEN
    -- Plan 30 Días: 1 Sobre Básico
    INSERT INTO public.player_packs (user_id, pack_id, source)
    VALUES (v_uid, 'basic', 'staking_bonus_30d');
    v_bonus_desc := '1 Sobre Básico';
    v_bonus_packs_list := v_bonus_packs_list || '["1x Sobre Básico"]'::jsonb;

  ELSIF v_pos.duration_days = 60 THEN
    -- Plan 60 Días: 3 Sobres Básicos
    INSERT INTO public.player_packs (user_id, pack_id, source)
    SELECT v_uid, 'basic', 'staking_bonus_60d' FROM generate_series(1, 3);
    v_bonus_desc := '3 Sobres Básicos';
    v_bonus_packs_list := v_bonus_packs_list || '["3x Sobres Básicos"]'::jsonb;

    -- Si el monto supera los 15,000 PLANTS, agrega 1 Sobre Épico adicional
    IF v_pos.amount >= 15000 THEN
      INSERT INTO public.player_packs (user_id, pack_id, source)
      VALUES (v_uid, 'epic', 'staking_bonus_60d');
      v_bonus_desc := v_bonus_desc || ' + 1 Sobre Épico';
      v_bonus_packs_list := v_bonus_packs_list || '["1x Sobre Épico"]'::jsonb;
    END IF;

  ELSIF v_pos.duration_days = 90 THEN
    -- Plan 90 Días: 3 Sobres Épicos + 1 Sobre Legendario + Skin Exclusiva
    INSERT INTO public.player_packs (user_id, pack_id, source)
    SELECT v_uid, 'epic', 'staking_bonus_90d' FROM generate_series(1, 3);

    INSERT INTO public.player_packs (user_id, pack_id, source)
    VALUES (v_uid, 'legendary', 'staking_bonus_90d');

    -- Item / Skin Exclusiva en farm_inventory
    INSERT INTO public.farm_inventory (user_id, item_id, quantity, updated_at)
    VALUES (v_uid, 'gold_24k', 1, NOW())
    ON CONFLICT (user_id, item_id)
    DO UPDATE SET quantity = farm_inventory.quantity + 1, updated_at = NOW();

    v_bonus_desc := '3 Sobres Épicos + 1 Sobre Legendario + Skin/Item Oro 24K';
    v_bonus_packs_list := v_bonus_packs_list || '["3x Sobres Épicos", "1x Sobre Legendario", "1x Skin Oro 24K"]'::jsonb;
  END IF;

  -- 4. Actualizar estado de la posición a completada
  UPDATE public.plants_staking_positions
     SET status = 'completed',
         completed_at = NOW(),
         bonus_packs_claimed = TRUE,
         total_gems_claimed = total_gems_claimed + v_pos_gems,
         total_gold_claimed = total_gold_claimed + v_pos_gold,
         last_reward_claim_at = v_effective_claim_until
   WHERE id = v_pos.id;

  RETURN jsonb_build_object(
    'success', true,
    'unlockedPlants', v_pos.amount,
    'finalGemsGranted', v_pos_gems,
    'finalGoldGranted', v_pos_gold,
    'bonusDescription', v_bonus_desc,
    'bonusPacks', v_bonus_packs_list
  );
END;
$$;

-- ── 7. PERMISOS ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.stake_plants(NUMERIC, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_my_staking_positions() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_staking_daily_rewards(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.unstake_plants(UUID) TO authenticated, anon;
