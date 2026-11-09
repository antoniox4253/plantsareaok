-- ==============================================================================
-- MIGRACIÓN 414: APLICAR REINICIO EXACTO A VALORES INICIALES DE LAS ARENAS
-- (Temporada 3: Arena 4 y 5 -> 3,001 copas exactas, Arena 3 -> 1,601 copas exactas)
-- ==============================================================================

-- 1. ACTUALIZAR TABLA elo_rewards AL NUEVO ESPECTRO OFICIAL
DELETE FROM public.elo_rewards;
INSERT INTO public.elo_rewards (max_elo, win_elo, lose_elo) VALUES
  (1600,   15, 5),   -- Arena 1: 0 - 1600
  (3000,   18, 8),   -- Arena 2: 1601 - 3000
  (5000,   20, 12),  -- Arena 3: 3001 - 5000
  (8000,   25, 20),  -- Arena 4: 5001 - 8000
  (999999, 30, 30);  -- Arena 5: 8001+

-- 2. APLICAR EL REINICIO INMEDIATO A LOS VALORES INICIALES EXACTOS
-- A. Los 94 jugadores de Arena 4 y 5 (actualmente entre 2001 y 2999) caen exactamente a 3,001 copas (inicio de Arena 3)
UPDATE public.profiles
   SET elo_rating = 3001,
       elo = 3001,
       updated_at = NOW()
 WHERE elo_rating >= 2001 AND elo_rating <= 2999;

-- B. Los jugadores de Arena 3 (actualmente entre 1601 y 2000) caen exactamente a 1,601 copas (inicio de Arena 2)
UPDATE public.profiles
   SET elo_rating = 1601,
       elo = 1601,
       updated_at = NOW()
 WHERE elo_rating >= 1601 AND elo_rating <= 2000;

-- 3. REDEFINIR soft_reset_season_cups PARA FUTUROS CIERRES AUTOMÁTICOS CON EL NUEVO ESPECTRO
CREATE OR REPLACE FUNCTION public.soft_reset_season_cups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count_a4a5  INTEGER := 0;
  v_count_a3    INTEGER := 0;
BEGIN
  -- Contar afectados bajo el nuevo espectro oficial (Temporada 3+):
  -- Arena 4 y 5: elo_rating >= 5001
  -- Arena 3: elo_rating >= 3001 AND elo_rating <= 5000
  SELECT COUNT(*) INTO v_count_a4a5 FROM public.profiles WHERE elo_rating >= 5001;
  SELECT COUNT(*) INTO v_count_a3   FROM public.profiles WHERE elo_rating >= 3001 AND elo_rating <= 5000;

  -- 1. Jugadores de Arena 3 caen exactamente al valor inicial de Arena 2 (1,601)
  UPDATE public.profiles
     SET elo_rating = 1601,
         elo = 1601,
         updated_at = NOW()
   WHERE elo_rating >= 3001 AND elo_rating <= 5000;

  -- 2. Jugadores de Arena 4 y 5 caen exactamente al valor inicial de Arena 3 (3,001)
  UPDATE public.profiles
     SET elo_rating = 3001,
         elo = 3001,
         updated_at = NOW()
   WHERE elo_rating >= 5001;

  RETURN jsonb_build_object(
    'success', TRUE,
    'arena4_5_to_arena3_count', v_count_a4a5,
    'arena3_to_arena2_count', v_count_a3,
    'message', format('Soft reset completado a valores iniciales exactos: %s jugadores de Arena 4 y 5 reiniciados a 3001 copas (Arena 3), y %s jugadores de Arena 3 reiniciados a 1601 copas (Arena 2).', v_count_a4a5, v_count_a3)
  );
END;
$$;
