-- ==============================================================================
-- MIGRACIÓN 368: INDEPENDENCIA DE CARTAS BASE Y COPIAS DE PLANTAS DORADAS (GOLD FOIL)
-- 
-- 1. Añade columna is_golden en public.plant_copies
-- 2. Actualiza clave primaria de public.plant_copies a (user_id, plant_id, is_golden)
-- 3. Actualiza el índice único uq_plant_instances_owner_base_plant para incluir COALESCE(is_golden, false)
-- 4. Promueve las plantas doradas existentes a is_base = TRUE
-- 5. Actualiza trigger ensure_unlocked_plant_instance() para respetar is_golden
-- 6. Actualiza public.my_inventory() proyectando copias doradas como <plant_id>_golden
-- 7. Actualiza public.open_pack() y public.open_multiple_packs() con copias doradas independientes
-- 8. Actualiza public.fuse_plant() y public.sprout_plant_instance() respetando is_golden
-- ==============================================================================

BEGIN;

-- 1. Columna is_golden en plant_copies
ALTER TABLE public.plant_copies 
  ADD COLUMN IF NOT EXISTS is_golden BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Actualizar clave primaria de plant_copies
ALTER TABLE public.plant_copies 
  DROP CONSTRAINT IF EXISTS plant_copies_pkey;

ALTER TABLE public.plant_copies 
  ADD PRIMARY KEY (user_id, plant_id, is_golden);

-- 3. Actualizar índice de carta base única por especie y variante dorada
DROP INDEX IF EXISTS public.uq_plant_instances_owner_base_plant;

CREATE UNIQUE INDEX uq_plant_instances_owner_base_plant 
  ON public.plant_instances (owner_id, plant_id, COALESCE(is_golden, false)) 
  WHERE (is_base = true);

-- 4. Promover las cartas doradas existentes a cartas base de su variante
UPDATE public.plant_instances
   SET is_base = TRUE
 WHERE is_golden = TRUE AND is_base = FALSE;

-- 5. Trigger ensure_unlocked_plant_instance respetando is_golden
CREATE OR REPLACE FUNCTION public.ensure_unlocked_plant_instance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_rarity TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.plant_instances
    WHERE owner_id = NEW.user_id
      AND plant_id = NEW.plant_id
      AND COALESCE(is_golden, FALSE) = COALESCE(NEW.is_golden, FALSE)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT rarity
  INTO v_rarity
  FROM public.plant_catalog
  WHERE plant_id = NEW.plant_id;

  IF v_rarity IS NULL THEN
    RAISE EXCEPTION 'Planta desconocida: %', NEW.plant_id;
  END IF;

  INSERT INTO public.plant_instances (
    owner_id,
    user_id,
    plant_id,
    rarity,
    star_level,
    level,
    stat_rolls,
    is_base,
    is_in_deck,
    deck_slot,
    is_listed_for_sale,
    is_golden
  )
  VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.plant_id,
    v_rarity,
    1,
    0,
    '{}'::TEXT[],
    TRUE,
    FALSE,
    NULL,
    FALSE,
    COALESCE(NEW.is_golden, FALSE)
  );

  RETURN NEW;
END;
$function$;

-- 6. Actualización de my_inventory proyectando copias regulares y doradas
CREATE OR REPLACE FUNCTION public.my_inventory()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  RETURN jsonb_build_object(
    'instances', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'instanceId',        id,
               'plantId',           plant_id,
               'level',             level,
               'statRolls',         stat_rolls,
               'isBase',            is_base,
               'isGolden',          COALESCE(is_golden, FALSE),
               'isInDeck',          is_in_deck,
               'deckSlot',          deck_slot,
               'isListed',          is_listed_for_sale,
               'germinationsCount', COALESCE(germinations_count, 0),
               'equippedItem',      equipped_item,
               'obtainedAt',        (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT
             ) ORDER BY deck_slot NULLS LAST, created_at)
        FROM public.plant_instances 
       WHERE (owner_id = v_uid OR user_id = v_uid)
    ), '[]'::JSONB),

    'copies', COALESCE((
      SELECT jsonb_object_agg(
        CASE WHEN is_golden THEN plant_id || '_golden' ELSE plant_id END,
        copies
      )
        FROM public.plant_copies WHERE user_id = v_uid AND copies > 0
    ), '{}'::JSONB),

    'unlocked', COALESCE((
      SELECT jsonb_agg(DISTINCT plant_id)
        FROM (
          SELECT plant_id FROM public.plant_copies WHERE user_id = v_uid AND copies > 0
          UNION
          SELECT plant_id FROM public.plant_instances WHERE (owner_id = v_uid OR user_id = v_uid)
        ) u
    ), '[]'::JSONB),

    'packs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'rowId',      id,
               'packId',     pack_id,
               'source',     source,
               'obtainedAt', (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT
             ) ORDER BY created_at)
        FROM public.player_packs WHERE user_id = v_uid
    ), '[]'::JSONB)
  );
END;
$$;

-- 7. Actualización de open_pack con copias doradas independientes
CREATE OR REPLACE FUNCTION public.open_pack(p_pack_row_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_pack        RECORD;
  v_count       INTEGER;
  v_rarity      TEXT;
  v_plant       TEXT;
  v_was_new     BOOLEAN;
  v_drops       JSONB := '[]'::JSONB;
  v_ticket      BOOLEAN := FALSE;
  v_poco_comun_pool TEXT[] := ARRAY['garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash', 'snowpea'];
  v_rara_pool       TEXT[] := ARRAY['twinsunflower', 'ghostpepper', 'guacodile', 'marigold', 'toadstool', 'torchwood'];
  v_pity        INTEGER := 0;
  v_gold_prob   NUMERIC := 0.01;
  v_is_golden   BOOLEAN := FALSE;
  v_new_inst_id UUID;
  i             INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_pack FROM public.player_packs
   WHERE id = p_pack_row_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sobre no encontrado'; END IF;

  -- Consultar contador de Pity del usuario
  SELECT COALESCE(golden_pity_counter, 0)
    INTO v_pity
    FROM public.profiles
   WHERE id = v_uid
     FOR UPDATE;

  -- Probabilidad base de dorada según el sobre
  v_gold_prob := CASE v_pack.pack_id 
    WHEN 'basic' THEN 0.010 -- 1.0%
    WHEN 'epic'  THEN 0.025 -- 2.5%
    ELSE              0.050 -- 5.0%
  END;

  -- ── DROPS PACK STARTER (5 CARTAS GARANTIZADAS) ────────────────
  IF v_pack.pack_id = 'starter' THEN
    FOR i IN 1..5 LOOP
      IF i = 1 THEN
        v_plant := 'sunflower';
        v_rarity := 'common';
      ELSIF i = 2 THEN
        v_plant := 'peashooter';
        v_rarity := 'common';
      ELSIF i = 3 THEN
        v_plant := 'wallnut';
        v_rarity := 'common';
      ELSIF i = 4 THEN
        v_plant := v_poco_comun_pool[1 + floor(random() * array_length(v_poco_comun_pool, 1))::integer];
        v_rarity := 'uncommon';
      ELSE
        v_plant := v_rara_pool[1 + floor(random() * array_length(v_rara_pool, 1))::integer];
        v_rarity := 'rare';
      END IF;

      v_was_new := NOT EXISTS (
        SELECT 1 FROM public.plant_instances
         WHERE (owner_id = v_uid OR user_id = v_uid)
           AND plant_id = v_plant
           AND COALESCE(is_golden, FALSE) = FALSE
      );

      IF v_was_new THEN
        INSERT INTO public.plant_instances (
          owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls,
          is_base, is_in_deck, deck_slot, is_listed_for_sale, is_golden
        ) VALUES (
          v_uid, v_uid, v_plant, v_rarity, 1, 0, '{}'::text[],
          TRUE, FALSE, NULL, FALSE, FALSE
        ) RETURNING id INTO v_new_inst_id;
      ELSE
        INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
        VALUES (v_uid, v_plant, FALSE, 1)
        ON CONFLICT (user_id, plant_id, is_golden) DO UPDATE
          SET copies = LEAST(5, plant_copies.copies + 1);
        v_new_inst_id := NULL;
      END IF;

      v_drops := v_drops || jsonb_build_object(
        'plantId',    v_plant,
        'rarity',     v_rarity,
        'isNew',      v_was_new,
        'isGolden',   FALSE,
        'instanceId', v_new_inst_id
      );
    END LOOP;

  -- ── DROPS SOBRES REGULARES CON PITY SYSTEM Y CARTAS DORADAS ─
  ELSE
    v_count := CASE v_pack.pack_id 
      WHEN 'basic' THEN 3 
      WHEN 'epic'  THEN 3 
      ELSE 4 
    END;

    FOR i IN 1..v_count LOOP
      IF i < v_count THEN
        v_rarity := CASE v_pack.pack_id
          WHEN 'basic' THEN public._roll_rarity(75, 25,  0,  0,  0)
          WHEN 'epic'  THEN public._roll_rarity(40, 50, 10,  0,  0)
          ELSE              public._roll_rarity( 0, 50, 40, 10,  0)
        END;
      ELSE
        v_rarity := CASE v_pack.pack_id
          WHEN 'basic' THEN public._roll_rarity(60, 30, 10,  0,  0)
          WHEN 'epic'  THEN public._roll_rarity( 0, 60, 30,  8,  2)
          ELSE              public._roll_rarity( 0, 20, 40, 30, 10)
        END;
      END IF;

      -- Evaluación de Carta Dorada y Pity System (Garantía en 100 cartas)
      IF (v_pity + 1) >= 100 THEN
        v_is_golden := TRUE;
      ELSIF random() < v_gold_prob THEN
        v_is_golden := TRUE;
      ELSE
        v_is_golden := FALSE;
      END IF;

      IF v_is_golden THEN
        v_pity := 0; -- Reset de Pity
        v_plant := public._random_golden_plant(v_rarity);
        
        -- ¿Posee ya la carta base dorada?
        v_was_new := NOT EXISTS (
          SELECT 1 FROM public.plant_instances
           WHERE (owner_id = v_uid OR user_id = v_uid)
             AND plant_id = v_plant
             AND is_golden = TRUE
        );

        IF v_was_new THEN
          -- Primera vez: crea la carta base dorada
          INSERT INTO public.plant_instances (
            owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls,
            is_base, is_in_deck, deck_slot, is_listed_for_sale, is_golden
          ) VALUES (
            v_uid, v_uid, v_plant, v_rarity, 1, 0, '{}'::text[],
            TRUE, FALSE, NULL, FALSE, TRUE
          ) RETURNING id INTO v_new_inst_id;
        ELSE
          -- Si ya la tiene: incrementa copias DORADAS con tope máximo de 5
          INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
          VALUES (v_uid, v_plant, TRUE, 1)
          ON CONFLICT (user_id, plant_id, is_golden) DO UPDATE
            SET copies = LEAST(5, plant_copies.copies + 1);
          v_new_inst_id := NULL;
        END IF;

        v_drops := v_drops || jsonb_build_object(
          'plantId',    v_plant,
          'rarity',     v_rarity,
          'isNew',      v_was_new,
          'isGolden',   TRUE,
          'instanceId', v_new_inst_id
        );
      ELSE
        v_pity := v_pity + 1; -- Progreso de Pity
        v_plant := public._random_plant_of_rarity(v_rarity);

        IF v_plant IN ('jalapeno', 'kernelpult', 'explodeonut') OR v_plant IS NULL THEN
          IF v_rarity = 'rare' THEN
            v_plant := 'twinsunflower';
          ELSE
            CONTINUE;
          END IF;
        END IF;

        -- ¿Posee ya la carta base normal?
        v_was_new := NOT EXISTS (
          SELECT 1 FROM public.plant_instances
           WHERE (owner_id = v_uid OR user_id = v_uid)
             AND plant_id = v_plant
             AND COALESCE(is_golden, FALSE) = FALSE
        );

        IF v_was_new THEN
          -- Primera vez: crea la carta base normal
          INSERT INTO public.plant_instances (
            owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls,
            is_base, is_in_deck, deck_slot, is_listed_for_sale, is_golden
          ) VALUES (
            v_uid, v_uid, v_plant, v_rarity, 1, 0, '{}'::text[],
            TRUE, FALSE, NULL, FALSE, FALSE
          ) RETURNING id INTO v_new_inst_id;
        ELSE
          -- Si ya la tiene: incrementa copias NORMALES con tope máximo de 5
          INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
          VALUES (v_uid, v_plant, FALSE, 1)
          ON CONFLICT (user_id, plant_id, is_golden) DO UPDATE
            SET copies = LEAST(5, plant_copies.copies + 1);
          v_new_inst_id := NULL;
        END IF;

        v_drops := v_drops || jsonb_build_object(
          'plantId',    v_plant,
          'rarity',     v_rarity,
          'isNew',      v_was_new,
          'isGolden',   FALSE,
          'instanceId', v_new_inst_id
        );
      END IF;
    END LOOP;
  END IF;

  -- 15% de Ticket de Coliseo
  IF random() < 0.15 THEN
    v_ticket := TRUE;
    UPDATE public.profiles
       SET colosseum_tickets = COALESCE(colosseum_tickets, 0) + 1
     WHERE id = v_uid;
  END IF;

  -- Actualizar el Pity Counter en el perfil
  UPDATE public.profiles
     SET golden_pity_counter = v_pity
   WHERE id = v_uid;

  DELETE FROM public.player_packs WHERE id = p_pack_row_id;

  RETURN jsonb_build_object(
    'success',           TRUE,
    'packId',            v_pack.pack_id,
    'drops',             v_drops,
    'colosseumTicket',   v_ticket,
    'goldenPityCounter', v_pity
  );
END;
$$;

-- 8. Actualización de open_multiple_packs con copias doradas independientes
CREATE OR REPLACE FUNCTION public.open_multiple_packs(p_pack_row_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_pack_row_id     UUID;
  v_pack            RECORD;
  v_count           INTEGER;
  v_rarity          TEXT;
  v_plant           TEXT;
  v_was_new         BOOLEAN;
  v_all_drops       JSONB := '[]'::JSONB;
  v_tickets_won     INTEGER := 0;
  v_packs_opened    INTEGER := 0;
  v_poco_comun_pool TEXT[] := ARRAY['garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash', 'snowpea'];
  v_rara_pool       TEXT[] := ARRAY['twinsunflower', 'ghostpepper', 'guacodile', 'marigold', 'toadstool', 'torchwood'];
  v_pity            INTEGER := 0;
  v_gold_prob       NUMERIC := 0.01;
  v_is_golden       BOOLEAN := FALSE;
  v_new_inst_id     UUID;
  i                 INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF p_pack_row_ids IS NULL OR cardinality(p_pack_row_ids) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'No se enviaron sobres para abrir');
  END IF;

  SELECT COALESCE(golden_pity_counter, 0)
    INTO v_pity
    FROM public.profiles
   WHERE id = v_uid
     FOR UPDATE;

  FOREACH v_pack_row_id IN ARRAY p_pack_row_ids LOOP
    SELECT * INTO v_pack FROM public.player_packs
     WHERE id = v_pack_row_id AND user_id = v_uid FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_packs_opened := v_packs_opened + 1;

    v_gold_prob := CASE v_pack.pack_id 
      WHEN 'basic' THEN 0.010
      WHEN 'epic'  THEN 0.025
      ELSE              0.050
    END;

    IF v_pack.pack_id = 'starter' THEN
      FOR i IN 1..5 LOOP
        IF i = 1 THEN
          v_plant := 'sunflower';
          v_rarity := 'common';
        ELSIF i = 2 THEN
          v_plant := 'peashooter';
          v_rarity := 'common';
        ELSIF i = 3 THEN
          v_plant := 'wallnut';
          v_rarity := 'common';
        ELSIF i = 4 THEN
          v_plant := v_poco_comun_pool[1 + floor(random() * array_length(v_poco_comun_pool, 1))::integer];
          v_rarity := 'uncommon';
        ELSE
          v_plant := v_rara_pool[1 + floor(random() * array_length(v_rara_pool, 1))::integer];
          v_rarity := 'rare';
        END IF;

        v_was_new := NOT EXISTS (
          SELECT 1 FROM public.plant_instances
           WHERE (owner_id = v_uid OR user_id = v_uid)
             AND plant_id = v_plant
             AND COALESCE(is_golden, FALSE) = FALSE
        );

        IF v_was_new THEN
          INSERT INTO public.plant_instances (
            owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls,
            is_base, is_in_deck, deck_slot, is_listed_for_sale, is_golden
          ) VALUES (
            v_uid, v_uid, v_plant, v_rarity, 1, 0, '{}'::text[],
            TRUE, FALSE, NULL, FALSE, FALSE
          ) RETURNING id INTO v_new_inst_id;
        ELSE
          INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
          VALUES (v_uid, v_plant, FALSE, 1)
          ON CONFLICT (user_id, plant_id, is_golden) DO UPDATE
            SET copies = LEAST(5, plant_copies.copies + 1);
          v_new_inst_id := NULL;
        END IF;

        v_all_drops := v_all_drops || jsonb_build_object(
          'plantId',    v_plant,
          'rarity',     v_rarity,
          'isNew',      v_was_new,
          'isGolden',   FALSE,
          'instanceId', v_new_inst_id
        );
      END LOOP;

    ELSE
      v_count := CASE v_pack.pack_id 
        WHEN 'basic' THEN 3 
        WHEN 'epic'  THEN 3 
        ELSE 4 
      END;

      FOR i IN 1..v_count LOOP
        IF i < v_count THEN
          v_rarity := CASE v_pack.pack_id
            WHEN 'basic' THEN public._roll_rarity(75, 25,  0,  0,  0)
            WHEN 'epic'  THEN public._roll_rarity(40, 50, 10,  0,  0)
            ELSE              public._roll_rarity( 0, 50, 40, 10,  0)
          END;
        ELSE
          v_rarity := CASE v_pack.pack_id
            WHEN 'basic' THEN public._roll_rarity(60, 30, 10,  0,  0)
            WHEN 'epic'  THEN public._roll_rarity( 0, 60, 30,  8,  2)
            ELSE              public._roll_rarity( 0, 20, 40, 30, 10)
          END;
        END IF;

        IF (v_pity + 1) >= 100 THEN
          v_is_golden := TRUE;
        ELSIF random() < v_gold_prob THEN
          v_is_golden := TRUE;
        ELSE
          v_is_golden := FALSE;
        END IF;

        IF v_is_golden THEN
          v_pity := 0;
          v_plant := public._random_golden_plant(v_rarity);

          v_was_new := NOT EXISTS (
            SELECT 1 FROM public.plant_instances
             WHERE (owner_id = v_uid OR user_id = v_uid)
               AND plant_id = v_plant
               AND is_golden = TRUE
          );

          IF v_was_new THEN
            INSERT INTO public.plant_instances (
              owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls,
              is_base, is_in_deck, deck_slot, is_listed_for_sale, is_golden
            ) VALUES (
              v_uid, v_uid, v_plant, v_rarity, 1, 0, '{}'::text[],
              TRUE, FALSE, NULL, FALSE, TRUE
            ) RETURNING id INTO v_new_inst_id;
          ELSE
            INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
            VALUES (v_uid, v_plant, TRUE, 1)
            ON CONFLICT (user_id, plant_id, is_golden) DO UPDATE
              SET copies = LEAST(5, plant_copies.copies + 1);
            v_new_inst_id := NULL;
          END IF;

          v_all_drops := v_all_drops || jsonb_build_object(
            'plantId',    v_plant,
            'rarity',     v_rarity,
            'isNew',      v_was_new,
            'isGolden',   TRUE,
            'instanceId', v_new_inst_id
          );
        ELSE
          v_pity := v_pity + 1;
          v_plant := public._random_plant_of_rarity(v_rarity);

          IF v_plant IN ('jalapeno', 'kernelpult', 'explodeonut') OR v_plant IS NULL THEN
            IF v_rarity = 'rare' THEN
              v_plant := 'twinsunflower';
            ELSE
              CONTINUE;
            END IF;
          END IF;

          v_was_new := NOT EXISTS (
            SELECT 1 FROM public.plant_instances
             WHERE (owner_id = v_uid OR user_id = v_uid)
               AND plant_id = v_plant
               AND COALESCE(is_golden, FALSE) = FALSE
          );

          IF v_was_new THEN
            INSERT INTO public.plant_instances (
              owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls,
              is_base, is_in_deck, deck_slot, is_listed_for_sale, is_golden
            ) VALUES (
              v_uid, v_uid, v_plant, v_rarity, 1, 0, '{}'::text[],
              TRUE, FALSE, NULL, FALSE, FALSE
            ) RETURNING id INTO v_new_inst_id;
          ELSE
            INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
            VALUES (v_uid, v_plant, FALSE, 1)
            ON CONFLICT (user_id, plant_id, is_golden) DO UPDATE
              SET copies = LEAST(5, plant_copies.copies + 1);
            v_new_inst_id := NULL;
          END IF;

          v_all_drops := v_all_drops || jsonb_build_object(
            'plantId',    v_plant,
            'rarity',     v_rarity,
            'isNew',      v_was_new,
            'isGolden',   FALSE,
            'instanceId', v_new_inst_id
          );
        END IF;
      END LOOP;
    END IF;

    IF random() < 0.15 THEN
      v_tickets_won := v_tickets_won + 1;
    END IF;

    DELETE FROM public.player_packs WHERE id = v_pack_row_id;
  END LOOP;

  IF v_tickets_won > 0 THEN
    UPDATE public.profiles
       SET colosseum_tickets = COALESCE(colosseum_tickets, 0) + v_tickets_won
     WHERE id = v_uid;
  END IF;

  UPDATE public.profiles
     SET golden_pity_counter = v_pity
   WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success',           TRUE,
    'packsOpened',       v_packs_opened,
    'drops',             v_all_drops,
    'colosseumTickets',  v_tickets_won,
    'goldenPityCounter', v_pity
  );
END;
$$;

-- 9. Actualización de fuse_plant respetando variante dorada
CREATE OR REPLACE FUNCTION public.fuse_plant(p_instance_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid         UUID := auth.uid();
  v_base_oro    BIGINT;
  c_coste_oro   BIGINT;
  c_copias_req  CONSTANT INTEGER := 5;
  v_oro         BIGINT;
  v_inst        RECORD;
  v_cat         RECORD;
  v_copies      INTEGER;
  v_stat        TEXT;
  v_is_golden   BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- 1. Bloqueo transaccional de la instancia de la carta
  SELECT * INTO v_inst
    FROM public.plant_instances
   WHERE id = p_instance_id
     AND owner_id = v_uid
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No eres el propietario de esta carta';
  END IF;

  IF v_inst.is_listed_for_sale THEN
    RAISE EXCEPTION 'No puedes fusionar una carta que está en venta';
  END IF;

  v_is_golden := COALESCE(v_inst.is_golden, FALSE);

  -- 2. Catálogo de la planta y validación de nivel máximo
  SELECT * INTO v_cat
    FROM public.plant_catalog
   WHERE plant_id = v_inst.plant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planta desconocida: %', v_inst.plant_id;
  END IF;

  IF v_inst.level >= v_cat.max_level THEN
    RAISE EXCEPTION 'Esta carta ya alcanzó el nivel máximo (%)', v_cat.max_level;
  END IF;

  -- 3. Determinar coste base según rareza
  IF v_cat.rarity = 'legendary' THEN
    v_base_oro := 3500;
  ELSIF v_cat.rarity = 'epic' THEN
    v_base_oro := 3000;
  ELSIF v_cat.rarity = 'rare' THEN
    v_base_oro := 2500;
  ELSIF v_cat.rarity = 'uncommon' THEN
    v_base_oro := 1500;
  ELSE
    v_base_oro := 1000;
  END IF;

  c_coste_oro := round(v_base_oro * power(1.5, v_inst.level));

  -- 4. Bloqueo transaccional de profiles para validar y descontar oro
  SELECT gold_balance INTO v_oro
    FROM public.profiles
   WHERE id = v_uid
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  IF COALESCE(v_oro, 0) < c_coste_oro THEN
    RAISE EXCEPTION 'Oro insuficiente para mejorar: necesitas % y tienes %', c_coste_oro, COALESCE(v_oro, 0);
  END IF;

  -- 5. Bloqueo transaccional de las copias (respetando si es dorada o normal)
  SELECT copies INTO v_copies
    FROM public.plant_copies
   WHERE user_id = v_uid
     AND plant_id = v_inst.plant_id
     AND is_golden = v_is_golden
     FOR UPDATE;

  v_copies := COALESCE(v_copies, 0);

  IF v_copies < c_copias_req THEN
    IF v_is_golden THEN
      RAISE EXCEPTION 'Se requieren % copias doradas para la fusión (tienes %/%)', c_copias_req, v_copies, c_copias_req;
    ELSE
      RAISE EXCEPTION 'Se requieren % copias base para la fusión (tienes %/%)', c_copias_req, v_copies, c_copias_req;
    END IF;
  END IF;

  -- 6. Descontar las 5 copias de la variante correspondiente
  UPDATE public.plant_copies
     SET copies = copies - c_copias_req
   WHERE user_id = v_uid
     AND plant_id = v_inst.plant_id
     AND is_golden = v_is_golden;

  -- 7. Descontar oro
  UPDATE public.profiles
     SET gold_balance = gold_balance - c_coste_oro
   WHERE id = v_uid;

  -- 8. Sorteo de estadística
  SELECT stat INTO v_stat
    FROM unnest(v_cat.eligible_stats) AS stat
   ORDER BY random()
   LIMIT 1;

  IF v_stat IS NULL THEN
    v_stat := 'hp';
  END IF;

  -- 9. Subir de nivel y registrar la nueva stat
  UPDATE public.plant_instances
     SET level = level + 1,
         stat_rolls = array_append(COALESCE(stat_rolls, '{}'::TEXT[]), v_stat)
   WHERE id = p_instance_id;

  RETURN jsonb_build_object(
    'success', true,
    'newLevel', v_inst.level + 1,
    'rolledStat', v_stat,
    'cost', c_coste_oro,
    'remainingCopies', v_copies - c_copias_req,
    'isGolden', v_is_golden
  );
END;
$function$;

-- 10. Actualización de sprout_plant_instance respetando variante dorada
CREATE OR REPLACE FUNCTION public.sprout_plant_instance(
  p_instance_id UUID DEFAULT NULL,
  p_plant_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_uid             UUID := auth.uid();
  v_instance        RECORD;
  v_copies          INTEGER := 0;
  v_water_req       INTEGER;
  v_fert_req        INTEGER;
  v_inv             JSONB;
  v_current_water   INTEGER := 0;
  v_current_fert    INTEGER := 0;
  v_new_instance_id UUID;
  v_target_plant_id TEXT;
  v_current_sprouts INTEGER := 0;
  v_rarity          TEXT;
  v_is_golden       BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- 1. Localizar la instancia específica que germinará
  IF p_instance_id IS NOT NULL THEN
    SELECT * INTO v_instance
      FROM public.plant_instances
     WHERE id = p_instance_id
       AND (owner_id = v_uid OR user_id = v_uid)
       FOR UPDATE;
  ELSE
    IF p_plant_id IS NULL OR p_plant_id = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Identificador de carta o planta no proporcionado');
    END IF;

    SELECT * INTO v_instance
      FROM public.plant_instances
     WHERE (owner_id = v_uid OR user_id = v_uid)
       AND plant_id = p_plant_id
       AND COALESCE(germinations_count, 0) < 2
     ORDER BY is_base DESC, created_at ASC
     LIMIT 1
     FOR UPDATE;
  END IF;

  IF v_instance.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Carta no encontrada o ya ha alcanzado su límite de 2 germinaciones'
    );
  END IF;

  v_target_plant_id := v_instance.plant_id;
  v_current_sprouts := COALESCE(v_instance.germinations_count, 0);
  v_rarity := COALESCE(v_instance.rarity, (SELECT rarity FROM public.plant_catalog WHERE plant_id = v_target_plant_id), 'common');
  v_is_golden := COALESCE(v_instance.is_golden, FALSE);

  -- 2. Validar límite de 2 germinaciones
  IF v_current_sprouts >= 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Esta carta ya ha germinado sus 2 plantas adicionales permitidas (2/2)'
    );
  END IF;

  -- 3. Calcular costes según rareza
  IF v_rarity = 'legendary' THEN
    IF v_current_sprouts = 0 THEN
      v_water_req := 120;
      v_fert_req := 60;
    ELSE
      v_water_req := 140;
      v_fert_req := 70;
    END IF;
  ELSIF v_rarity = 'epic' THEN
    IF v_current_sprouts = 0 THEN
      v_water_req := 50;
      v_fert_req := 30;
    ELSE
      v_water_req := 60;
      v_fert_req := 35;
    END IF;
  ELSE
    IF v_current_sprouts = 0 THEN
      v_water_req := 10;
      v_fert_req := 5;
    ELSE
      v_water_req := 12;
      v_fert_req := 7;
    END IF;
  END IF;

  -- 4. Verificar copias disponibles de la variante correspondiente
  SELECT COALESCE(copies, 0) INTO v_copies
    FROM public.plant_copies
   WHERE user_id = v_uid
     AND plant_id = v_target_plant_id
     AND is_golden = v_is_golden
   FOR UPDATE;

  IF v_copies < 5 THEN
    IF v_is_golden THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Copias doradas insuficientes de %s: necesitas 5 y tienes %s', v_target_plant_id, v_copies)
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Copias insuficientes de %s: necesitas 5 y tienes %s', v_target_plant_id, v_copies)
      );
    END IF;
  END IF;

  -- 5. Verificar recursos de farming en profiles.farming_inventory
  SELECT COALESCE(farming_inventory, '{}'::jsonb)
    INTO v_inv
    FROM public.profiles
   WHERE id = v_uid
   FOR UPDATE;

  v_current_water := COALESCE((v_inv->>'water')::INTEGER, 0);
  v_current_fert  := COALESCE((v_inv->>'fertilizer')::INTEGER, 0);

  IF v_current_water < v_water_req THEN
    SELECT COALESCE(quantity, 0) INTO v_current_water
      FROM public.farm_inventory
     WHERE user_id = v_uid AND item_id = 'water';
  END IF;

  IF v_current_fert < v_fert_req THEN
    SELECT COALESCE(quantity, 0) INTO v_current_fert
      FROM public.farm_inventory
     WHERE user_id = v_uid AND item_id = 'fertilizer';
  END IF;

  IF v_current_water < v_water_req THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Agua insuficiente: requieres %s 💧 y posees %s', v_water_req, v_current_water)
    );
  END IF;

  IF v_current_fert < v_fert_req THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Fertilizante insuficiente: requieres %s 🧪 y posees %s', v_fert_req, v_current_fert)
    );
  END IF;

  -- 6. Descontar las 5 copias de la variante correspondiente
  UPDATE public.plant_copies
     SET copies = copies - 5
   WHERE user_id = v_uid
     AND plant_id = v_target_plant_id
     AND is_golden = v_is_golden;

  -- 7. Descontar Agua y Fertilizante
  v_inv := jsonb_set(v_inv, '{water}', to_jsonb(v_current_water - v_water_req), TRUE);
  v_inv := jsonb_set(v_inv, '{fertilizer}', to_jsonb(v_current_fert - v_fert_req), TRUE);

  UPDATE public.profiles
     SET farming_inventory = v_inv
   WHERE id = v_uid;

  INSERT INTO public.farm_inventory(user_id, item_id, quantity)
  VALUES (v_uid, 'water', GREATEST(0, v_current_water - v_water_req))
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = GREATEST(0, v_current_water - v_water_req), updated_at = NOW();

  INSERT INTO public.farm_inventory(user_id, item_id, quantity)
  VALUES (v_uid, 'fertilizer', GREATEST(0, v_current_fert - v_fert_req))
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = GREATEST(0, v_current_fert - v_fert_req), updated_at = NOW();

  -- 8. Incrementar el contador de germinaciones en la carta padre
  UPDATE public.plant_instances
     SET germinations_count = v_current_sprouts + 1
   WHERE id = v_instance.id;

  -- 9. Insertar la nueva carta en Nivel 0 conservando is_golden si la madre era dorada
  INSERT INTO public.plant_instances (
    owner_id,
    user_id,
    plant_id,
    rarity,
    level,
    star_level,
    stat_rolls,
    is_base,
    is_in_deck,
    is_listed_for_sale,
    germinations_count,
    is_golden
  ) VALUES (
    v_uid,
    v_uid,
    v_target_plant_id,
    v_rarity,
    0,
    1,
    '{}'::TEXT[],
    FALSE,
    FALSE,
    FALSE,
    0,
    v_is_golden
  ) RETURNING id INTO v_new_instance_id;

  RETURN jsonb_build_object(
    'success', true,
    'instanceId', v_new_instance_id,
    'plantId', v_target_plant_id,
    'childNumber', v_current_sprouts + 1,
    'copiesRemaining', v_copies - 5,
    'waterSpent', v_water_req,
    'fertilizerSpent', v_fert_req,
    'isGolden', v_is_golden
  );
END;
$func$;

-- 11. Actualización de convert_plant_to_copy respetando variante dorada
CREATE OR REPLACE FUNCTION public.convert_plant_to_copy(
  p_instance_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid               UUID := auth.uid();
  v_target_uuid       UUID;
  v_plant             RECORD;
  v_gems              NUMERIC := 0;
  v_current_copies    INTEGER := 0;
  v_total_playable    INTEGER := 0;
  v_deck_count        INTEGER := 0;
  v_refunded_item     TEXT := NULL;
  v_inv               JSONB;
  v_item_qty          INTEGER := 0;
  v_species_count     INTEGER := 0;
  v_is_golden         BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  IF p_instance_id IS NULL OR TRIM(p_instance_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identificador de carta inválido');
  END IF;

  BEGIN
    v_target_uuid := p_instance_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_target_uuid := NULL;
  END;

  IF v_target_uuid IS NOT NULL THEN
    SELECT * INTO v_plant
      FROM public.plant_instances
     WHERE id = v_target_uuid
       AND (owner_id = v_uid OR user_id = v_uid)
       FOR UPDATE;
  ELSE
    SELECT * INTO v_plant
      FROM public.plant_instances
     WHERE (owner_id = v_uid OR user_id = v_uid)
       AND plant_id = REPLACE(p_instance_id, 'inst_base_', '')
     ORDER BY is_base DESC, created_at ASC
     LIMIT 1
     FOR UPDATE;
  END IF;

  IF v_plant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carta no encontrada en tu inventario');
  END IF;

  v_is_golden := COALESCE(v_plant.is_golden, FALSE);

  -- No se puede sacrificar si está en venta en el marketplace
  IF COALESCE(v_plant.is_listed_for_sale, FALSE) = TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes eliminar una carta que está listada para venta en el Marketplace.');
  END IF;

  -- Regla: Si el usuario solo posee 1 carta de esta especie y variante, no puede eliminarla
  SELECT COUNT(*) INTO v_species_count
    FROM public.plant_instances
   WHERE (owner_id = v_uid OR user_id = v_uid)
     AND plant_id = v_plant.plant_id
     AND COALESCE(is_golden, FALSE) = v_is_golden;

  IF v_species_count <= 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No puedes eliminar esta carta: es tu única carta de esta especie. Debes poseer al menos una cría adicional para poder usar el bote de reciclaje.'
    );
  END IF;

  -- 4. Validar saldo de 50 gemas
  SELECT COALESCE(gems_balance, 0) INTO v_gems
    FROM public.profiles
   WHERE id = v_uid
     FOR UPDATE;

  IF v_gems < 50 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Gemas insuficientes: requieres 50 gemas y posees %s', v_gems)
    );
  END IF;

  -- 5. Validar tope de 5 copias
  SELECT COALESCE(copies, 0) INTO v_current_copies
    FROM public.plant_copies
   WHERE user_id = v_uid
     AND plant_id = v_plant.plant_id
     AND is_golden = v_is_golden
   FOR UPDATE;

  IF v_current_copies >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya posees el límite máximo de 5 copias para esta planta.'
    );
  END IF;

  -- 6. Validar mínimo de 3 cartas en inventario
  SELECT COUNT(*) INTO v_total_playable
    FROM public.plant_instances
   WHERE (owner_id = v_uid OR user_id = v_uid);

  IF v_total_playable <= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No puedes eliminar esta carta: debes conservar al menos 3 plantas en tu inventario para poder combatir.'
    );
  END IF;

  -- 7. Validar mazo activo si la carta está equipada
  IF COALESCE(v_plant.is_in_deck, FALSE) = TRUE THEN
    SELECT COUNT(*) INTO v_deck_count
      FROM public.plant_instances
     WHERE (owner_id = v_uid OR user_id = v_uid)
       AND is_in_deck = TRUE;

    IF v_deck_count <= 3 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No puedes eliminar una carta de tu mazo si dejarías tu mazo con menos de 3 plantas. Desequípala o reemplázala antes.'
      );
    END IF;
  END IF;

  -- 8. Devolver ítem equipado si tenía
  IF v_plant.equipped_item IS NOT NULL THEN
    v_refunded_item := v_plant.equipped_item;

    SELECT COALESCE(farming_inventory, '{}'::JSONB) INTO v_inv
      FROM public.profiles
     WHERE id = v_uid;

    v_item_qty := COALESCE((v_inv->>v_refunded_item)::INTEGER, 0) + 1;
    v_inv := jsonb_set(v_inv, ARRAY[v_refunded_item], to_jsonb(v_item_qty), TRUE);

    UPDATE public.profiles
       SET farming_inventory = v_inv
     WHERE id = v_uid;
  END IF;

  -- 9. Descontar las 50 gemas
  UPDATE public.profiles
     SET gems_balance = gems_balance - 50
   WHERE id = v_uid;

  -- 10. Acreditar +1 copia en plant_copies
  INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
  VALUES (v_uid, v_plant.plant_id, v_is_golden, 1)
  ON CONFLICT (user_id, plant_id, is_golden)
  DO UPDATE SET copies = LEAST(5, plant_copies.copies + 1);

  -- 11. Eliminar la instancia física
  DELETE FROM public.plant_instances
   WHERE id = v_plant.id;

  -- 12. Si era carta base y le quedan crías, promover la más antigua a carta base
  IF COALESCE(v_plant.is_base, FALSE) = TRUE THEN
    UPDATE public.plant_instances
       SET is_base = TRUE
     WHERE id = (
       SELECT id FROM public.plant_instances
        WHERE (owner_id = v_uid OR user_id = v_uid)
          AND plant_id = v_plant.plant_id
          AND COALESCE(is_golden, FALSE) = v_is_golden
        ORDER BY created_at ASC
        LIMIT 1
     );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'plantId', v_plant.plant_id,
    'isGolden', v_is_golden,
    'copiesTotal', LEAST(5, v_current_copies + 1),
    'refundedItem', v_refunded_item,
    'gemsDeducted', 50
  );
END;
$$;

COMMIT;
