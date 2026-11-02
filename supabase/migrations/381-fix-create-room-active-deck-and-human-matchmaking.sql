-- ==============================================================================
-- Migración 381: Corregir asignación de _active_deck en _create_room para
--                restaurar el emparejamiento PvP humano vs humano
-- ==============================================================================
--
-- Causa del fallo previo:
-- En la migración 379, la rama ELSE (partidas Ranked y Friendly) hacía:
--   SELECT p1.p_deck, p2.p_deck ...
--   FROM public._active_deck(p_p1) p1 CROSS JOIN public._active_deck(p_p2) p2 ...
-- Como _active_deck(uuid) retorna un único valor JSONB escalar y no una columna
-- llamada "p_deck", PostgreSQL lanzaba la excepción:
--   "column p1.p_deck does not exist"
-- En _emparejar_lote esa excepción era capturada silenciosamente (WHEN OTHERS THEN NULL),
-- por lo que la sala PvP nunca se creaba y ambos jugadores eran forzados tras 60s
-- a jugar contra rivales asíncronos (bots).
--
-- Solución:
-- Asignar directamente v_p1_deck := public._active_deck(p_p1); y v_p2_deck := public._active_deck(p_p2);
-- igual a como ya se hace limpiamente en la rama de torneos.
-- Además, relajar la validación de cartas mínimas de < 5 a < 3 para admitir jugadores iniciales.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._create_room(
  p_mode text,
  p_p1 uuid,
  p_p2 uuid,
  p_bet numeric DEFAULT 0,
  p_tournament_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room          UUID;
  v_seed          BIGINT;
  v_cuenta        INTEGER;
  v_p1_deck       JSONB;
  v_p2_deck       JSONB;
  v_now           TIMESTAMPTZ := NOW();
  v_p1_tree_level INTEGER := 0;
  v_p2_tree_level INTEGER := 0;
  v_p1_tree_skin  TEXT := NULL;
  v_p2_tree_skin  TEXT := NULL;
  v_p1_elo        INTEGER := 1000;
  v_p2_elo        INTEGER := 1000;
BEGIN
  IF p_p1 IS NULL OR p_p2 IS NULL THEN
    RAISE EXCEPTION 'p_p1 y p_p2 son requeridos';
  END IF;

  IF COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_p1), FALSE) 
     OR COALESCE((SELECT is_bot_only FROM public.profiles WHERE id = p_p2), FALSE) THEN
    RETURN NULL;
  END IF;

  v_room := gen_random_uuid();
  v_seed := 1 + floor(random() * 2147483646)::BIGINT;

  -- Si es torneo, resolver los mazos usando el mazo de torneo registrado y las reglas del torneo
  IF p_mode = 'tournament' AND p_tournament_id IS NOT NULL THEN
    v_p1_deck := public._resolve_tournament_deck(p_p1, p_tournament_id);
    v_p2_deck := public._resolve_tournament_deck(p_p2, p_tournament_id);

    SELECT
      COALESCE(pr1.tree_level, 0), COALESCE(pr2.tree_level, 0),
      pr1.equipped_tree_skin, pr2.equipped_tree_skin,
      COALESCE(pr1.elo_rating, 1000), COALESCE(pr2.elo_rating, 1000)
    INTO
      v_p1_tree_level, v_p2_tree_level,
      v_p1_tree_skin, v_p2_tree_skin,
      v_p1_elo, v_p2_elo
    FROM public.profiles pr1
    LEFT JOIN public.profiles pr2 ON pr2.id = p_p2
    WHERE pr1.id = p_p1;
  ELSE
    -- Asignación directa y robusta de JSONB devuelto por _active_deck
    v_p1_deck := public._active_deck(p_p1);
    v_p2_deck := public._active_deck(p_p2);

    SELECT
      COALESCE(pr1.tree_level, 0), COALESCE(pr2.tree_level, 0),
      pr1.equipped_tree_skin, pr2.equipped_tree_skin,
      COALESCE(pr1.elo_rating, 1000), COALESCE(pr2.elo_rating, 1000)
    INTO
      v_p1_tree_level, v_p2_tree_level,
      v_p1_tree_skin, v_p2_tree_skin,
      v_p1_elo, v_p2_elo
    FROM public.profiles pr1
    LEFT JOIN public.profiles pr2 ON pr2.id = p_p2
    WHERE pr1.id = p_p1;
  END IF;

  SELECT COUNT(*) INTO v_cuenta
    FROM jsonb_array_elements(COALESCE(v_p1_deck, '[]'::jsonb));
  IF v_cuenta < 3 THEN
    RAISE EXCEPTION 'El mazo de P1 tiene % cartas, se requieren al menos 3', v_cuenta;
  END IF;

  SELECT COUNT(*) INTO v_cuenta
    FROM jsonb_array_elements(COALESCE(v_p2_deck, '[]'::jsonb));
  IF v_cuenta < 3 THEN
    RAISE EXCEPTION 'El mazo de P2 tiene % cartas, se requieren al menos 3', v_cuenta;
  END IF;

  INSERT INTO public.game_rooms (
    id,
    mode,
    player1_id,
    player2_id,
    colosseum_bet,
    tournament_id,
    seed,
    status,
    p1_deck,
    p2_deck,
    created_at,
    started_at,
    engine_version,
    user_elo,
    elo_rating,
    p1_tree_level,
    p2_tree_level,
    p1_tree_skin,
    p2_tree_skin
  ) VALUES (
    v_room,
    p_mode,
    p_p1,
    p_p2,
    COALESCE(p_bet, 0),
    p_tournament_id,
    v_seed,
    'playing',
    v_p1_deck,
    v_p2_deck,
    v_now,
    v_now,
    'auth-v2',
    v_p1_elo,
    v_p2_elo,
    v_p1_tree_level,
    v_p2_tree_level,
    v_p1_tree_skin,
    v_p2_tree_skin
  );

  RETURN v_room;
END;
$function$;

COMMIT;
