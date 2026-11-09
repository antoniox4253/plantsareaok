CREATE OR REPLACE FUNCTION public._grant_reward(p_uid uuid, p_type text, p_pack_id text DEFAULT NULL::text, p_pack_count integer DEFAULT NULL::integer, p_plant_id text DEFAULT NULL::text, p_copies_count integer DEFAULT NULL::integer, p_gems numeric DEFAULT NULL::numeric, p_gold bigint DEFAULT NULL::bigint, p_source text DEFAULT 'lottery'::text, p_item_id text DEFAULT NULL::text, p_item_count integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  i INTEGER;
  v_is_new BOOLEAN;
  v_rarity TEXT;
  v_inv JSONB;
BEGIN
  -- BLOQUEO ESTRICTO: commando_bandana es exclusiva del Top 3 de Temporada 1
  IF p_item_id = 'commando_bandana' THEN
    RAISE EXCEPTION 'REWARD_FORBIDDEN: La Bandana de Comando es exclusiva para el Top 3 de Temporada 1 y no puede ser asignada en ninguna recompensa.';
  END IF;

  IF p_type = 'pack' AND p_pack_id IS NOT NULL THEN
    FOR i IN 1..COALESCE(p_pack_count, 1) LOOP
      INSERT INTO public.player_packs (user_id, pack_id, source)
      VALUES (p_uid, p_pack_id, p_source);
    END LOOP;
    RETURN jsonb_build_object('type', 'pack', 'packId', p_pack_id, 'count', COALESCE(p_pack_count, 1));

  ELSIF p_type IN ('copies', 'plant') AND p_plant_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.plant_instances
      WHERE (owner_id = p_uid OR user_id = p_uid) AND plant_id = p_plant_id AND is_base = TRUE AND COALESCE(is_golden, FALSE) = FALSE
    ) INTO v_is_new;

    IF v_is_new THEN
      SELECT rarity INTO v_rarity
        FROM public.plant_catalog
       WHERE plant_id = p_plant_id;

      IF v_rarity IS NULL THEN
        v_rarity := 'common';
      END IF;

      INSERT INTO public.plant_instances (
        owner_id, user_id, plant_id, rarity, star_level, level, stat_rolls,
        is_base, is_in_deck, deck_slot, is_listed_for_sale, is_golden, created_at
      ) VALUES (
        p_uid, p_uid, p_plant_id, v_rarity, 1, 0, '{}'::text[],
        TRUE, FALSE, NULL, FALSE, FALSE, NOW()
      );

      INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
      VALUES (p_uid, p_plant_id, FALSE, 1)
      ON CONFLICT (user_id, plant_id, is_golden)
      DO UPDATE SET copies = LEAST(5, GREATEST(1, public.plant_copies.copies));
    ELSE
      INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)
      VALUES (p_uid, p_plant_id, FALSE, LEAST(5, COALESCE(p_copies_count, 1)))
      ON CONFLICT (user_id, plant_id, is_golden)
      DO UPDATE SET copies = LEAST(5, public.plant_copies.copies + COALESCE(p_copies_count, 1));
    END IF;

    RETURN jsonb_build_object('type', 'plant', 'plantId', p_plant_id, 'count', COALESCE(p_copies_count, 1));

  ELSIF p_type = 'item' AND p_item_id IS NOT NULL THEN
    SELECT COALESCE(farming_inventory, '{}'::jsonb) INTO v_inv
    FROM public.profiles WHERE id = p_uid;

    v_inv := jsonb_set(
      v_inv,
      ARRAY[p_item_id],
      to_jsonb(COALESCE((v_inv->>p_item_id)::INTEGER, 0) + COALESCE(p_item_count, 1))
    );

    UPDATE public.profiles
    SET farming_inventory = v_inv
    WHERE id = p_uid;

    INSERT INTO public.farm_inventory(user_id, item_id, quantity)
    VALUES (p_uid, p_item_id, COALESCE(p_item_count, 1))
    ON CONFLICT (user_id, item_id)
    DO UPDATE SET quantity = public.farm_inventory.quantity + COALESCE(p_item_count, 1),
                  updated_at = NOW();

    RETURN jsonb_build_object('type', 'item', 'itemId', p_item_id, 'count', COALESCE(p_item_count, 1));

  ELSIF p_type = 'gems' AND p_gems IS NOT NULL THEN
    UPDATE public.profiles
       SET gems_balance = gems_balance + p_gems
     WHERE id = p_uid;
    RETURN jsonb_build_object('type', 'gems', 'amount', p_gems);

  ELSIF p_type = 'gold' AND p_gold IS NOT NULL THEN
    UPDATE public.profiles
       SET gold_balance = gold_balance + p_gold
     WHERE id = p_uid;
    RETURN jsonb_build_object('type', 'gold', 'amount', p_gold);
  END IF;

  RETURN jsonb_build_object('type', 'unknown');
END;
$function$
