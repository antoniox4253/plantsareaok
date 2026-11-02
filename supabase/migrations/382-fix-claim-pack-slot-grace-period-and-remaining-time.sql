-- Migración 382: Corrección de ventana de sincronización y reporte de tiempo restante en claim_pack_slot y sync_pack_slots
-- Evita que discrepancias de reloj (clock drift) de pocos segundos o minutos dejen los cofres congelados en 'sincronizando'.

-- 1. Actualizar claim_pack_slot con ventana de gracia de 60s y reporte de segundos restantes
CREATE OR REPLACE FUNCTION public.claim_pack_slot(p_slot_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user         UUID := auth.uid();
  v_slot         RECORD;
  v_drops        JSONB := '[]'::jsonb;
  v_roll         DOUBLE PRECISION;
  v_pool         TEXT[];
  v_rarity       TEXT;
  v_plant_id     TEXT;
  v_is_new       BOOLEAN;
  v_water        INTEGER := 0;
  v_fert         INTEGER := 0;
  v_gold         INTEGER := 0;
  v_nonplant     DOUBLE PRECISION;
  v_plant_chance DOUBLE PRECISION;
  v_plant_seen   BOOLEAN := FALSE;
  v_inventory    JSONB;
  v_gold_balance BIGINT;
  v_rem_sec      BIGINT;
  i              INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_slot_index IS NULL OR p_slot_index < 0 OR p_slot_index > 3 THEN
    RAISE EXCEPTION 'INVALID_SLOT_INDEX';
  END IF;

  SELECT * INTO v_slot
  FROM public.pack_slots
  WHERE user_id = v_user AND slot_index = p_slot_index
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SLOT_NOT_FOUND'; END IF;
  IF v_slot.status = 'empty' THEN RAISE EXCEPTION 'SLOT_IS_EMPTY'; END IF;
  IF v_slot.status = 'locked' THEN RAISE EXCEPTION 'SLOT_IS_LOCKED'; END IF;

  IF v_slot.status = 'unlocking' THEN
    IF v_slot.unlock_started_at IS NULL THEN RAISE EXCEPTION 'SLOT_NOT_READY'; END IF;
    -- Ventana de tolerancia de 60 segundos por clock drift del cliente
    IF NOW() < v_slot.unlock_started_at + (v_slot.duration_hours || ' hours')::interval - INTERVAL '60 seconds' THEN
      v_rem_sec := GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_slot.unlock_started_at + (v_slot.duration_hours || ' hours')::interval) - NOW())))::BIGINT);
      RAISE EXCEPTION 'SLOT_NOT_READY:%', v_rem_sec;
    END IF;
  END IF;

  v_plant_chance := CASE WHEN v_slot.duration_hours = 6 THEN 0.75 ELSE 0.12 END;

  FOR i IN 1..3 LOOP
    v_roll := random();

    IF NOT v_plant_seen AND v_roll < v_plant_chance THEN
      v_plant_seen := TRUE;

      IF random() < 0.70 THEN
        v_pool := ARRAY['sunflower', 'peashooter', 'wallnut', 'chomper'];
        v_rarity := 'common';
      ELSE
        -- Incluye Snow Pea ('snowpea') de Temporada 2
        v_pool := ARRAY['garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash', 'snowpea'];
        v_rarity := 'uncommon';
      END IF;

      v_plant_id := v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];

      -- GUARDA DE SEGURIDAD ESTRICTA:
      IF v_plant_id IN ('pickledpepper', 'explodeonut', 'jalapeno', 'kernelpult', 'twinsunflower', 'aloe', 'tallnut', 'iceberglettuce', 'threepeater', 'gatlingpea', 'torchwood', 'ghostpepper', 'toadstool', 'marigold', 'guacodile')
         OR NOT (v_plant_id = ANY(ARRAY['sunflower', 'peashooter', 'wallnut', 'chomper', 'garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash', 'snowpea'])) THEN
        RAISE EXCEPTION 'ILLEGAL_PVP_PACK_PLANT: %', v_plant_id;
      END IF;

      SELECT NOT EXISTS (
        SELECT 1 FROM public.plant_instances
        WHERE (owner_id = v_user OR user_id = v_user) AND plant_id = v_plant_id AND COALESCE(is_golden, FALSE) = FALSE
      ) INTO v_is_new;

      IF v_is_new THEN
        INSERT INTO public.plant_instances (
          owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls,
          is_base, is_in_deck, deck_slot, is_listed_for_sale, is_golden
        ) VALUES (
          v_user, v_user, v_plant_id, v_rarity, 1, 0, '{}'::text[],
          TRUE, FALSE, NULL, FALSE, FALSE
        );
      ELSE
        -- Tope estricto de 5 copias
        INSERT INTO public.plant_copies(user_id, plant_id, is_golden, copies)
        VALUES (v_user, v_plant_id, FALSE, 1)
        ON CONFLICT (user_id, plant_id, is_golden)
        DO UPDATE SET copies = LEAST(5, public.plant_copies.copies + 1);
      END IF;

      v_drops := v_drops || jsonb_build_array(jsonb_build_object(
        'type', 'plant',
        'plantId', v_plant_id,
        'rarity', v_rarity,
        'isNew', v_is_new,
        'quantity', 1
      ));
    ELSE
      v_nonplant := random() * 0.88;

      IF v_nonplant < 0.34 THEN
        v_water := v_water + 1;
        v_drops := v_drops || jsonb_build_array(jsonb_build_object('type','item','itemId','water','quantity',1));
      ELSIF v_nonplant < 0.58 THEN
        v_fert := v_fert + 1;
        v_drops := v_drops || jsonb_build_array(jsonb_build_object('type','item','itemId','fertilizer','quantity',1));
      ELSIF v_nonplant < 0.72 THEN
        v_gold := v_gold + 15;
        v_drops := v_drops || jsonb_build_array(jsonb_build_object('type','gold','quantity',15));
      ELSIF v_nonplant < 0.78 THEN
        v_gold := v_gold + 30;
        v_drops := v_drops || jsonb_build_array(jsonb_build_object('type','gold','quantity',30));
      ELSIF v_nonplant < 0.82 THEN
        v_water := v_water + 2;
        v_drops := v_drops || jsonb_build_array(jsonb_build_object('type','item','itemId','water','quantity',2));
      ELSIF v_nonplant < 0.85 THEN
        v_fert := v_fert + 2;
        v_drops := v_drops || jsonb_build_array(jsonb_build_object('type','item','itemId','fertilizer','quantity',2));
      ELSE
        v_gold := v_gold + 50;
        v_drops := v_drops || jsonb_build_array(jsonb_build_object('type','gold','quantity',50));
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(farming_inventory, '{}'::jsonb)
    INTO v_inventory
  FROM public.profiles
  WHERE id = v_user
  FOR UPDATE;

  IF v_water > 0 THEN
    v_inventory := jsonb_set(
      v_inventory,
      '{water}',
      to_jsonb(COALESCE((v_inventory->>'water')::integer, 0) + v_water),
      TRUE
    );
    INSERT INTO public.farm_inventory(user_id, item_id, quantity)
    VALUES (v_user, 'water', v_water)
    ON CONFLICT (user_id, item_id)
    DO UPDATE SET quantity = public.farm_inventory.quantity + EXCLUDED.quantity;
  END IF;

  IF v_fert > 0 THEN
    v_inventory := jsonb_set(
      v_inventory,
      '{fertilizer}',
      to_jsonb(COALESCE((v_inventory->>'fertilizer')::integer, 0) + v_fert),
      TRUE
    );
    INSERT INTO public.farm_inventory(user_id, item_id, quantity)
    VALUES (v_user, 'fertilizer', v_fert)
    ON CONFLICT (user_id, item_id)
    DO UPDATE SET quantity = public.farm_inventory.quantity + EXCLUDED.quantity;
  END IF;

  UPDATE public.profiles
  SET gold_balance = COALESCE(gold_balance, 0) + v_gold,
      farming_inventory = v_inventory,
      updated_at = NOW()
  WHERE id = v_user
  RETURNING gold_balance INTO v_gold_balance;

  UPDATE public.pack_slots
  SET status = 'empty',
      duration_hours = NULL,
      unlock_started_at = NULL,
      reward_drops = v_drops,
      reward_generated_at = NOW()
  WHERE user_id = v_user AND slot_index = p_slot_index;

  RETURN jsonb_build_object(
    'success', TRUE,
    'drops', v_drops,
    'farmingItems', v_inventory,
    'goldBalance', v_gold_balance,
    'slotIndex', p_slot_index
  );
END;
$function$;

-- 2. Actualizar sync_pack_slots para dar tolerancia de 60 segundos
CREATE OR REPLACE FUNCTION public.sync_pack_slots(p_slots jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  v_in         JSONB;
  v_idx        INTEGER;
  v_dur        INTEGER;
  v_arena      INTEGER;
  v_want       TEXT;
  v_final      TEXT;
  v_started    TIMESTAMPTZ;
  v_prev       RECORD;
  v_rechazados JSONB := '[]'::JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'Se esperaba un array de slots';
  END IF;
  IF jsonb_array_length(p_slots) > 4 THEN
    RAISE EXCEPTION 'Máximo 4 cofres';
  END IF;

  FOR v_in IN SELECT * FROM jsonb_array_elements(p_slots)
  LOOP
    v_idx := COALESCE((v_in->>'slotId')::INTEGER, (v_in->>'slot_index')::INTEGER);
    IF v_idx IS NULL OR v_idx < 0 OR v_idx > 3 THEN
      RAISE EXCEPTION 'Índice de cofre inválido: %', COALESCE(v_idx::TEXT, 'null');
    END IF;

    SELECT status, unlock_started_at, duration_hours, arena_level
      INTO v_prev
      FROM public.pack_slots
     WHERE user_id = v_uid AND slot_index = v_idx
     FOR UPDATE;

    v_dur := COALESCE(v_prev.duration_hours,
                      CASE v_idx WHEN 0 THEN 2 WHEN 1 THEN 4 WHEN 2 THEN 8 ELSE 12 END);

    v_arena := COALESCE(v_prev.arena_level, 1);
    v_arena := GREATEST(1, LEAST(5, v_arena));

    v_want := COALESCE(v_in->>'status', 'empty');
    IF v_want NOT IN ('empty', 'locked', 'unlocking', 'ready') THEN
      RAISE EXCEPTION 'Estado de cofre inválido: %', v_want;
    END IF;

    v_final   := v_want;
    v_started := NULL;

    IF v_want = 'unlocking' THEN
      IF v_prev.status = 'unlocking' AND v_prev.unlock_started_at IS NOT NULL THEN
        v_started := v_prev.unlock_started_at;
      ELSE
        v_started := NOW();
      END IF;

    ELSIF v_want = 'ready' THEN
      IF v_prev.status = 'ready' THEN
        v_final := 'ready';
      ELSIF v_prev.status = 'unlocking'
            AND v_prev.unlock_started_at IS NOT NULL
            AND NOW() >= v_prev.unlock_started_at + make_interval(hours => v_dur) - INTERVAL '60 seconds'
      THEN
        v_final := 'ready';
      ELSE
        v_final   := COALESCE(v_prev.status, 'empty');
        v_started := v_prev.unlock_started_at;
        v_rechazados := v_rechazados || jsonb_build_object(
          'slotId', v_idx, 'motivo', 'todavia_no_esta_listo', 'estado_real', v_final
        );
      END IF;

    ELSIF v_want = 'locked' AND v_prev.status IS NULL THEN
      v_final := 'empty';
      v_rechazados := v_rechazados || jsonb_build_object(
        'slotId', v_idx, 'motivo', 'los_cofres_los_concede_el_servidor'
      );
    END IF;

    INSERT INTO public.pack_slots
      (user_id, slot_index, status, duration_hours, arena_level, unlock_started_at)
    VALUES
      (v_uid, v_idx, v_final, v_dur, v_arena, v_started)
    ON CONFLICT (user_id, slot_index) DO UPDATE
      SET status            = EXCLUDED.status,
          duration_hours    = EXCLUDED.duration_hours,
          arena_level       = EXCLUDED.arena_level,
          unlock_started_at = EXCLUDED.unlock_started_at;
  END LOOP;

  RETURN jsonb_build_object(
    'success',    TRUE,
    'rechazados', v_rechazados,
    'slots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'slotId',          slot_index,
               'status',          status,
               'durationHours',   duration_hours,
               'arenaLevel',      arena_level,
               'unlockStartedAt', CASE WHEN unlock_started_at IS NULL THEN NULL
                                       ELSE (EXTRACT(EPOCH FROM unlock_started_at) * 1000)::BIGINT
                                  END
             ) ORDER BY slot_index)
        FROM public.pack_slots WHERE user_id = v_uid
    ), '[]'::JSONB)
  );
END;
$function$;
