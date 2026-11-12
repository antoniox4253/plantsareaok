-- =============================================================================
-- MIGRACIÓN 433: LIQUIDACIÓN DE RECOMPENSAS SURVIVOR ADS (TOP 1 - 3)
-- Y BLOQUEO DEFINITIVO DE ACCESO AL MODO SURVIVOR
-- =============================================================================
-- 1. Entrega 2 Plantas Doradas aleatorias a cada ganador del TOP 1 al 3 de
--    survivor_ads_runs, excluyendo estrictamente las legendarias (iceberglettuce).
-- 2. Registra las instancias/copias y notificaciones oficiales en player_notifications.
-- 3. Bloquea permanentemente enter_survivor_ads y record_survivor_ads_run.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  -- Pool de 9 plantas doradas excluyendo las legendarias (iceberglettuce / threepeater)
  v_pool TEXT[] := ARRAY['sunflower', 'peashooter', 'wallnut', 'garlic', 'bonkchoy', 'repeater', 'melonpult', 'twinsunflower', 'jalapeno'];
  v_winner RECORD;
  v_rank INTEGER := 0;
  v_unowned TEXT[];
  v_chosen1 TEXT;
  v_chosen2 TEXT;
  v_rarity1 TEXT;
  v_rarity2 TEXT;
  v_name1 TEXT;
  v_name2 TEXT;
  v_winners_audit JSONB := '[]'::JSONB;
BEGIN
  -- 1. Iterar sobre el Top 3 oficial de survivor_ads_runs
  FOR v_winner IN (
    SELECT user_id, username, level_reached, playtime_seconds, updated_at
      FROM public.survivor_ads_runs
     ORDER BY level_reached DESC, playtime_seconds ASC, updated_at ASC
     LIMIT 3
  ) LOOP
    v_rank := v_rank + 1;

    -- Buscar plantas doradas no legendarias que el usuario AÚN NO posea en dorado
    SELECT ARRAY_AGG(t.plant) INTO v_unowned
      FROM UNNEST(v_pool) AS t(plant)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.plant_instances
        WHERE (owner_id = v_winner.user_id OR user_id = v_winner.user_id)
          AND plant_id = t.plant
          AND is_golden = TRUE
     );

    -- Si tiene al menos 2 no poseídas, seleccionamos 2 distintas al azar de ellas
    IF v_unowned IS NOT NULL AND array_length(v_unowned, 1) >= 2 THEN
      SELECT plant INTO v_chosen1 FROM UNNEST(v_unowned) AS t(plant) ORDER BY random() LIMIT 1;
      SELECT plant INTO v_chosen2 FROM UNNEST(v_unowned) AS t(plant) WHERE plant <> v_chosen1 ORDER BY random() LIMIT 1;
    ELSIF v_unowned IS NOT NULL AND array_length(v_unowned, 1) = 1 THEN
      v_chosen1 := v_unowned[1];
      SELECT plant INTO v_chosen2 FROM UNNEST(v_pool) AS t(plant) WHERE plant <> v_chosen1 ORDER BY random() LIMIT 1;
    ELSE
      -- Ya posee todas las doradas no legendarias: seleccionar 2 distintas del pool para otorgar copias de fusión
      SELECT plant INTO v_chosen1 FROM UNNEST(v_pool) AS t(plant) ORDER BY random() LIMIT 1;
      SELECT plant INTO v_chosen2 FROM UNNEST(v_pool) AS t(plant) WHERE plant <> v_chosen1 ORDER BY random() LIMIT 1;
    END IF;

    -- Obtener rareza y nombres oficiales
    SELECT rarity, name INTO v_rarity1, v_name1 FROM public.plant_catalog WHERE plant_id = v_chosen1;
    SELECT rarity, name INTO v_rarity2, v_name2 FROM public.plant_catalog WHERE plant_id = v_chosen2;

    -- Acreditar Planta 1
    IF NOT EXISTS (
      SELECT 1 FROM public.plant_instances
       WHERE (owner_id = v_winner.user_id OR user_id = v_winner.user_id)
         AND plant_id = v_chosen1
         AND is_golden = TRUE
    ) THEN
      INSERT INTO public.plant_instances (
        owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls, is_base, is_in_deck, is_golden, germinations_count, in_tournament_escrow
      ) VALUES (
        v_winner.user_id, v_winner.user_id, v_chosen1, COALESCE(v_rarity1, 'common'), 1, 0, '{}'::text[], true, false, true, 0, false
      );
    ELSE
      INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
      VALUES (v_winner.user_id, v_chosen1, TRUE, 1)
      ON CONFLICT (user_id, plant_id, is_golden) DO UPDATE
        SET copies = LEAST(5, plant_copies.copies + 1);
    END IF;

    -- Acreditar Planta 2
    IF NOT EXISTS (
      SELECT 1 FROM public.plant_instances
       WHERE (owner_id = v_winner.user_id OR user_id = v_winner.user_id)
         AND plant_id = v_chosen2
         AND is_golden = TRUE
    ) THEN
      INSERT INTO public.plant_instances (
        owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls, is_base, is_in_deck, is_golden, germinations_count, in_tournament_escrow
      ) VALUES (
        v_winner.user_id, v_winner.user_id, v_chosen2, COALESCE(v_rarity2, 'common'), 1, 0, '{}'::text[], true, false, true, 0, false
      );
    ELSE
      INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
      VALUES (v_winner.user_id, v_chosen2, TRUE, 1)
      ON CONFLICT (user_id, plant_id, is_golden) DO UPDATE
        SET copies = LEAST(5, plant_copies.copies + 1);
    END IF;

    -- Enviar notificación personal al ganador
    INSERT INTO public.player_notifications (
      user_id, title, message, icon, type, is_read, metadata, created_at
    ) VALUES (
      v_winner.user_id,
      '🏆 ¡Premio de Survivor ADS Entregado!',
      '¡Felicidades por alcanzar el puesto #' || v_rank || ' en Survivor ADS (Nivel ' || v_winner.level_reached || ')! Has recibido tus 2 Plantas Doradas de recompensa: ' || COALESCE(v_name1, v_chosen1) || ' Dorada y ' || COALESCE(v_name2, v_chosen2) || ' Dorada.',
      '🌟',
      'reward',
      false,
      jsonb_build_object(
        'event', 'survivor_ads_top3',
        'rank', v_rank,
        'level_reached', v_winner.level_reached,
        'plants', jsonb_build_array(v_chosen1, v_chosen2)
      ),
      NOW()
    );

    -- Acumular en JSON de auditoría
    v_winners_audit := v_winners_audit || jsonb_build_object(
      'rank', v_rank,
      'user_id', v_winner.user_id,
      'username', v_winner.username,
      'level_reached', v_winner.level_reached,
      'playtime_seconds', v_winner.playtime_seconds,
      'plant1', v_chosen1,
      'plant2', v_chosen2
    );
  END LOOP;

  -- Registrar en _migration_audit
  INSERT INTO public._migration_audit (fase, detalle, ejecutado_en)
  VALUES (
    '433-settle-survivor-ads-rewards-and-block-access',
    jsonb_build_object(
      'action', 'settle_survivor_ads_rewards',
      'winners', v_winners_audit,
      'pool_used', v_pool,
      'excluded_legendaries', ARRAY['iceberglettuce', 'threepeater'],
      'settled_at', NOW()
    ),
    NOW()
  );
END $$;


-- 2. BLOQUEO PERMANENTE DE ENTER_SURVIVOR_ADS
CREATE OR REPLACE FUNCTION public.enter_survivor_ads()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'El modo Survivor ADS ha finalizado definitivamente. Las inscripciones y partidas están permanentemente cerradas.',
    'is_frozen', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enter_survivor_ads() TO authenticated, service_role, anon;


-- 3. BLOQUEO PERMANENTE DE RECORD_SURVIVOR_ADS_RUN
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
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'frozen', true,
    'newBest', false,
    'levelReached', p_level,
    'message', 'El modo Survivor ADS ha finalizado definitivamente. El ranking está cerrado y no se contabilizan más partidas.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_survivor_ads_run(INTEGER, INTEGER, BOOLEAN, INTEGER, BOOLEAN, INTEGER, JSONB, TEXT) TO authenticated, anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
