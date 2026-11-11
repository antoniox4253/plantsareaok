-- =============================================================================
-- MIGRACIÓN 432: CIERRE Y CONGELAMIENTO ESTRICTO DE SURVIVOR ADS
-- FECHA LÍMITE OFICIAL: 12 DE NOVIEMBRE DE 2026 A LAS 00:00:00 UTC
-- REGLA: NO CONTABILIZAR MÁS PARTIDAS EN EL RANKING NI PERMITIR NUEVAS ENTRADAS
-- =============================================================================

BEGIN;

-- 1. ACTUALIZAR record_survivor_ads_run CON VENCIMIENTO ESTRICTO A LAS 00:00:00 UTC
CREATE OR REPLACE FUNCTION public.record_survivor_ads_run(
  p_level INTEGER,
  p_playtime_seconds INTEGER DEFAULT 0,
  p_spent_gems BOOLEAN DEFAULT true,
  p_gems_spent INTEGER DEFAULT 50,
  p_revived BOOLEAN DEFAULT false,
  p_revive_count INTEGER DEFAULT 0,
  p_total_rewards JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'completed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_row RECORD;
  v_current_best RECORD;
  v_new_best BOOLEAN := false;
  v_level INTEGER;
  v_final_rewards JSONB;
  v_tokens NUMERIC;
  v_packs INTEGER;
  v_rares INTEGER;
  v_freeze_time TIMESTAMPTZ := '2026-11-12 00:00:00+00'::TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- Nivel máximo permitido (100)
  v_level := LEAST(GREATEST(1, COALESCE(p_level, 1)), 100);

  SELECT id, username, avatar_id
    INTO v_user_row
    FROM public.profiles
   WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- Recompensas estándar según nivel alcanzado
  v_tokens := ROUND((v_level * 2.0)::numeric, 4);
  v_packs := v_level / 10;
  v_rares := v_level / 25;

  v_final_rewards := jsonb_build_object(
    'tokenPlants', COALESCE((p_total_rewards->>'tokenPlants')::numeric, v_tokens),
    'basicPacks', COALESCE((p_total_rewards->>'basicPacks')::integer, v_packs),
    'rareCards', COALESCE((p_total_rewards->>'rareCards')::integer, v_rares),
    'gold', 0,
    'gems', 0,
    'items', COALESCE(p_total_rewards->'items', '{}'::jsonb)
  );

  -- ── REGLA DE CONGELAMIENTO ESTRICTO (12 DE NOVIEMBRE 00:00:00 UTC) ───────────
  -- Una vez alcanzada la fecha límite (12-Nov 00:00 UTC), el ranking queda sellado.
  -- Se retorna el resultado del intento sin sobreescribir ni contabilizar más récords.
  IF NOW() >= v_freeze_time THEN
    RETURN jsonb_build_object(
      'success', true,
      'frozen', true,
      'newBest', false,
      'levelReached', v_level,
      'totalRewards', v_final_rewards,
      'message', 'El modo Survivor ADS ha finalizado formalmente (12 de Noviembre 00:00 UTC). El ranking está congelado y no se contabilizan más partidas.'
    );
  END IF;

  SELECT * INTO v_current_best
    FROM public.survivor_ads_runs
   WHERE user_id = v_uid;

  IF v_current_best IS NULL THEN
    INSERT INTO public.survivor_ads_runs (
      user_id, username, avatar_url, level_reached, playtime_seconds,
      spent_gems, gems_spent, revived, revive_count, total_rewards, status,
      created_at, updated_at
    ) VALUES (
      v_uid, v_user_row.username, v_user_row.avatar_id, v_level, p_playtime_seconds,
      p_spent_gems, p_gems_spent, p_revived, p_revive_count, v_final_rewards, p_status,
      NOW(), NOW()
    );
    v_new_best := true;
  ELSE
    -- Comparamos si es un nuevo récord (nivel mayor, o mismo nivel con menos tiempo)
    IF v_level > v_current_best.level_reached OR 
       (v_level = v_current_best.level_reached AND (p_playtime_seconds < v_current_best.playtime_seconds OR v_current_best.playtime_seconds = 0)) THEN
      UPDATE public.survivor_ads_runs
         SET level_reached = v_level,
             playtime_seconds = p_playtime_seconds,
             spent_gems = p_spent_gems,
             gems_spent = p_gems_spent,
             revived = p_revived,
             revive_count = p_revive_count,
             total_rewards = v_final_rewards,
             status = p_status,
             updated_at = NOW()
       WHERE user_id = v_uid;
      v_new_best := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'frozen', false,
    'newBest', v_new_best,
    'levelReached', v_level,
    'totalRewards', v_final_rewards
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_survivor_ads_run(INTEGER, INTEGER, BOOLEAN, INTEGER, BOOLEAN, INTEGER, JSONB, TEXT) TO authenticated, anon;


-- 2. ACTUALIZAR enter_survivor_ads PARA BLOQUEAR NUEVAS ENTRADAS TRAS EL CIERRE
CREATE OR REPLACE FUNCTION public.enter_survivor_ads()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_gems BIGINT;
  v_locked_gems BIGINT;
  v_cost INTEGER := 50;
  v_freeze_time TIMESTAMPTZ := '2026-11-12 00:00:00+00'::TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- ── REGLA DE CIERRE ESTRICTO (12 DE NOVIEMBRE 00:00:00 UTC) ──────────────────
  IF NOW() >= v_freeze_time THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Survivor ADS ha finalizado formalmente (12 de Noviembre 00:00 UTC). Las inscripciones y el ranking están cerrados.',
      'is_frozen', true
    );
  END IF;

  SELECT COALESCE(gems_balance, 0), COALESCE(locked_gems_balance, 0)
  INTO v_gems, v_locked_gems
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF v_gems < v_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Gemas insuficientes para entrar a Survivor ADS. Se requieren 50 💎 Gemas.',
      'current_gems_balance', v_gems
    );
  END IF;

  UPDATE public.profiles
  SET
    gems_balance = gems_balance - v_cost,
    locked_gems_balance = GREATEST(0, COALESCE(locked_gems_balance, 0) - v_cost),
    updated_at = NOW()
  WHERE id = v_uid
  RETURNING gems_balance, locked_gems_balance INTO v_gems, v_locked_gems;

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_cost,
    'currency', 'gems',
    'newGemsBalance', v_gems,
    'newLockedGemsBalance', v_locked_gems
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enter_survivor_ads() TO authenticated, service_role, anon;


-- 3. AUDITORÍA DE MIGRACIÓN
INSERT INTO public._migration_audit (fase, detalle, ejecutado_en)
VALUES (
  '432-freeze-survivor-ads-november-12-00-utc',
  jsonb_build_object(
    'freeze_time_utc', '2026-11-12 00:00:00+00',
    'survivor_record_freeze', true,
    'survivor_entry_freeze', true,
    'reason', 'Temporizador ajustado a 12 de Noviembre 00:00 UTC y cese definitivo de contabilización de partidas.'
  ),
  NOW()
);

COMMIT;

NOTIFY pgrst, 'reload schema';
