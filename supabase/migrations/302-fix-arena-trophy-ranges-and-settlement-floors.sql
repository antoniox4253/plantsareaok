-- ==============================================================================
-- Migración 302: Calibración Autoritaria de Rangos de Arena y Pisos de Copas ELO
-- ==============================================================================
-- 1. Sincroniza los niveles de sobres de victoria (_award_victory_chest_for y
--    _award_reward_pack_slot_for) con los umbrales oficiales de Plant Arena:
--    Arena 1: 0 - 1,600
--    Arena 2: 1,601 - 2,000
--    Arena 3: 2,001 - 3,000
--    Arena 4: 3,001 - 4,000
--    Arena 5: 4,001+
--
-- 2. Elimina los pisos artificiales rígidos (1000, 1600, 2000, 3000, 4000) en
--    _ranked_elo_delta para permitir el descenso natural entre arenas por derrota,
--    manteniendo el piso absoluto en 0 copas (sin ratings negativos).
-- ==============================================================================

-- 1. SOBRE DE VICTORIA (RANKED ASÍNCRONO Y PVP)
CREATE OR REPLACE FUNCTION public._award_victory_chest_for(p_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_elo     INTEGER;
  v_arena   INTEGER;
  v_libre   INTEGER;
  v_dur     INTEGER;
  v_roll    DOUBLE PRECISION;
  v_ultimo  TIMESTAMPTZ;
BEGIN
  IF p_uid IS NULL THEN
    RETURN jsonb_build_object('awarded', FALSE, 'reason', 'sin_usuario');
  END IF;

  SELECT MAX(awarded_at) INTO v_ultimo
    FROM public.pack_slots
   WHERE user_id = p_uid;

  IF v_ultimo IS NOT NULL AND v_ultimo > NOW() - INTERVAL '2 minutes' THEN
    RETURN jsonb_build_object('awarded', FALSE, 'reason', 'demasiado_pronto');
  END IF;

  SELECT COALESCE(elo_rating, 1000) INTO v_elo
    FROM public.profiles
   WHERE id = p_uid;

  -- Calibración oficial de nivel de arena según copas (Whitepaper & arenaManager.ts)
  v_arena := CASE
    WHEN v_elo >= 4001 THEN 5
    WHEN v_elo >= 3001 THEN 4
    WHEN v_elo >= 2001 THEN 3
    WHEN v_elo >= 1601 THEN 2
    ELSE 1
  END;

  SELECT i INTO v_libre
    FROM generate_series(0, 3) AS i
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.pack_slots ps
      WHERE ps.user_id = p_uid
        AND ps.slot_index = i
        AND ps.status <> 'empty'
   )
   ORDER BY i
   LIMIT 1;

  IF v_libre IS NULL THEN
    RETURN jsonb_build_object('awarded', FALSE, 'reason', 'huecos_llenos');
  END IF;

  -- Distribución: 1h 50%, 2h 30%, 4h 15%, 6h 5%
  v_roll := random();
  v_dur := CASE
    WHEN v_roll < 0.50 THEN 1
    WHEN v_roll < 0.80 THEN 2
    WHEN v_roll < 0.95 THEN 4
    ELSE 6
  END;

  INSERT INTO public.pack_slots
    (user_id, slot_index, status, duration_hours, arena_level, unlock_started_at, awarded_at)
  VALUES
    (p_uid, v_libre, 'locked', v_dur, v_arena, NULL, NOW())
  ON CONFLICT (user_id, slot_index) DO UPDATE
    SET status = 'locked',
        duration_hours = EXCLUDED.duration_hours,
        arena_level = EXCLUDED.arena_level,
        unlock_started_at = NULL,
        awarded_at = NOW();

  RETURN jsonb_build_object(
    'awarded', TRUE,
    'slotId', v_libre,
    'durationHours', v_dur,
    'arenaLevel', v_arena
  );
END;
$$;

-- 2. HUECO DE SOBRE DE RECOMPENSA (BACKEND SLOTS)
CREATE OR REPLACE FUNCTION public._award_reward_pack_slot_for(p_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_elo    INTEGER;
  v_arena  INTEGER;
  v_libre  INTEGER;
  v_dur    INTEGER;
BEGIN
  IF p_uid IS NULL THEN 
    RETURN jsonb_build_object('awarded', FALSE, 'reason', 'sin_usuario'); 
  END IF;

  SELECT COALESCE(elo_rating, 1000) INTO v_elo FROM public.profiles WHERE id = p_uid;

  -- Nivel de arena según ELO con los umbrales oficiales
  v_arena := CASE
    WHEN v_elo >= 4001 THEN 5
    WHEN v_elo >= 3001 THEN 4
    WHEN v_elo >= 2001 THEN 3
    WHEN v_elo >= 1601 THEN 2
    ELSE 1
  END;

  SELECT i INTO v_libre FROM generate_series(0, 3) AS i
   WHERE NOT EXISTS (
     SELECT 1 FROM public.pack_slots ps
      WHERE ps.user_id = p_uid AND ps.slot_index = i AND ps.status <> 'empty'
   )
   ORDER BY i LIMIT 1;

  IF v_libre IS NULL THEN
    RETURN jsonb_build_object('awarded', FALSE, 'reason', 'huecos_llenos');
  END IF;

  v_dur := (ARRAY[2, 4, 8, 12])[1 + floor(random() * 4)::INTEGER];

  INSERT INTO public.pack_slots
    (user_id, slot_index, status, duration_hours, arena_level, unlock_started_at, awarded_at)
  VALUES (p_uid, v_libre, 'locked', v_dur, v_arena, NULL, NOW())
  ON CONFLICT (user_id, slot_index) DO UPDATE
    SET status = 'locked',
        duration_hours = EXCLUDED.duration_hours,
        arena_level = EXCLUDED.arena_level,
        unlock_started_at = NULL,
        awarded_at = NOW();

  RETURN jsonb_build_object(
    'awarded', TRUE,
    'slotId', v_libre,
    'durationHours', v_dur,
    'arenaLevel', v_arena
  );
END;
$$;

-- 3. CÁLCULO AUTORITATIVO DE DELTA DE COPAS RANKED (PISO EN 0 COPAS, PERMITIENDO DESCENSO)
CREATE OR REPLACE FUNCTION public._ranked_elo_delta(
  p_player_rating INTEGER,
  p_opponent_rating INTEGER,
  p_score NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_p           INTEGER;
  v_win_delta   INTEGER;
  v_lose_delta  INTEGER;
  v_nominal_new INTEGER;
  v_clamped_new INTEGER;
  v_final_delta INTEGER;
BEGIN
  v_p := GREATEST(0, COALESCE(p_player_rating, 1000));

  -- 1. Empate exacto (score ~ 0.5): 0 copas
  IF p_score > 0.4 AND p_score < 0.6 THEN
    RETURN 0;
  END IF;

  -- 2. Determinar ganancia / pérdida nominal por Arena
  IF v_p <= 1600 THEN
    -- Arena 1: Jardín Clásico (0 - 1600)
    v_win_delta  := 15;
    v_lose_delta := -5;
  ELSIF v_p <= 2000 THEN
    -- Arena 2: Desierto Nocturno (1601 - 2000)
    v_win_delta  := 18;
    v_lose_delta := -8;
  ELSIF v_p <= 3000 THEN
    -- Arena 3: Rascacielos Cyberpunk (2001 - 3000)
    v_win_delta  := 20;
    v_lose_delta := -12;
  ELSIF v_p <= 4000 THEN
    -- Arena 4: Coliseo Galáctico (3001 - 4000)
    v_win_delta  := 25;
    v_lose_delta := -20;
  ELSE
    -- Arena 5: Olimpo de Leyendas (4001+)
    v_win_delta  := 30;
    v_lose_delta := -30;
  END IF;

  -- 3. Cálculo de victoria o derrota con piso absoluto en 0 copas (sin bloqueo artificial entre arenas)
  IF p_score >= 1.0 THEN
    v_final_delta := v_win_delta;
  ELSE
    v_nominal_new := v_p + v_lose_delta;
    v_clamped_new := GREATEST(0, v_nominal_new);
    v_final_delta := v_clamped_new - v_p;
  END IF;

  RETURN v_final_delta;
END;
$$;
