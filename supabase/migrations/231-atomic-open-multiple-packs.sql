-- Migración 231: Función RPC atómica para apertura de sobres múltiples en lote
-- Elimina peticiones HTTP redundantes y previene condiciones de carrera o conteos erróneos

CREATE OR REPLACE FUNCTION public.open_multiple_packs(p_pack_row_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_pack_row_id   UUID;
  v_pack          RECORD;
  v_count         INTEGER;
  v_rarity        TEXT;
  v_plant         TEXT;
  v_was_new       BOOLEAN;
  v_all_drops     JSONB := '[]'::JSONB;
  v_tickets_won   INTEGER := 0;
  v_packs_opened  INTEGER := 0;
  i               INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_pack_row_ids IS NULL OR cardinality(p_pack_row_ids) = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No se enviaron sobres para abrir'
    );
  END IF;

  -- Iterar cada sobre solicitado con bloqueo FOR UPDATE
  FOREACH v_pack_row_id IN ARRAY p_pack_row_ids LOOP
    SELECT * INTO v_pack FROM public.player_packs
     WHERE id = v_pack_row_id AND user_id = v_uid FOR UPDATE;

    -- Si el sobre ya no existe o fue consumido previamente, ignorar sin abortar el lote
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_packs_opened := v_packs_opened + 1;
    v_count := CASE v_pack.pack_id WHEN 'basic' THEN 3 ELSE 4 END;

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

      v_plant := public._random_plant_of_rarity(v_rarity);

      -- Blindaje estricto: Jalapeño y Lanzamaíz jamás caen en sobres de cartas
      IF v_plant IN ('jalapeno', 'kernelpult') OR v_plant IS NULL THEN
        IF v_rarity = 'rare' THEN
          v_plant := 'twinsunflower';
        ELSE
          CONTINUE;
        END IF;
      END IF;

      v_was_new := NOT EXISTS (
        SELECT 1 FROM public.plant_copies
         WHERE user_id = v_uid AND plant_id = v_plant AND copies > 0
      ) AND NOT EXISTS (
        SELECT 1 FROM public.plant_instances
         WHERE (owner_id = v_uid OR user_id = v_uid) AND plant_id = v_plant
      );

      -- Incremento con TOPE MÁXIMO DE 5 COPIAS
      INSERT INTO public.plant_copies (user_id, plant_id, copies)
      VALUES (v_uid, v_plant, 1)
      ON CONFLICT (user_id, plant_id) DO UPDATE
        SET copies = LEAST(5, plant_copies.copies + 1);

      v_all_drops := v_all_drops || jsonb_build_object(
        'plantId', v_plant,
        'rarity',  v_rarity,
        'isNew',   v_was_new
      );
    END LOOP;

    -- Probabilidad de ticket de Coliseo por sobre (15%)
    IF random() < 0.15 THEN
      v_tickets_won := v_tickets_won + 1;
    END IF;

    -- Consumir sobre de la base de datos
    DELETE FROM public.player_packs WHERE id = v_pack_row_id;
  END LOOP;

  -- Acreditar tickets ganados en el perfil de una sola vez
  IF v_tickets_won > 0 THEN
    UPDATE public.profiles
       SET colosseum_tickets = COALESCE(colosseum_tickets, 0) + v_tickets_won
     WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success',        TRUE,
    'packsOpened',    v_packs_opened,
    'drops',          v_all_drops,
    'ticketsWon',     v_tickets_won
  );
END;
$$;

REVOKE ALL ON FUNCTION public.open_multiple_packs(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_multiple_packs(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_multiple_packs(UUID[]) TO authenticated;
