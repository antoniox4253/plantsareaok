CREATE OR REPLACE FUNCTION public.buy_packs(p_pack_id text, p_qty integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid           UUID := auth.uid();
  v_pack          RECORD;
  v_max           INTEGER;
  v_total_gems    NUMERIC;
  v_gold_per_pack INTEGER := 0;
  v_total_gold    INTEGER := 0;
  v_saldo_gems    NUMERIC;
  v_has_starter   BOOLEAN := FALSE;
  v_ids           UUID[] := '{}';
  v_id            UUID;
  i               INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT value::INTEGER INTO v_max FROM public.shop_config
   WHERE key = 'max_packs_per_purchase';
  v_max := COALESCE(v_max, 10);

  IF p_qty IS NULL OR p_qty < 1 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
  IF p_qty > v_max THEN
    RAISE EXCEPTION 'Máximo % sobres por compra', v_max;
  END IF;

  -- Validación estricta para Pack Starter (Compra única de 1 unidad)
  IF p_pack_id = 'starter' THEN
    IF p_qty <> 1 THEN
      RAISE EXCEPTION 'El Pack Starter solo puede adquirirse individualmente (cantidad: 1).';
    END IF;
  END IF;

  SELECT * INTO v_pack FROM public.shop_packs
   WHERE pack_id = p_pack_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sobre no disponible: %', p_pack_id; END IF;

  v_total_gems := v_pack.price_gems * p_qty;
  v_gold_per_pack := COALESCE(v_pack.gold_reward, 0);
  v_total_gold := v_gold_per_pack * p_qty;

  -- Bloquear perfil para control estricto de concurrencia
  SELECT gems_balance, COALESCE(has_purchased_starter_pack, FALSE)
    INTO v_saldo_gems, v_has_starter
    FROM public.profiles
   WHERE id = v_uid FOR UPDATE;

  IF p_pack_id = 'starter' AND v_has_starter THEN
    RAISE EXCEPTION 'Ya has adquirido el Pack Starter previamente. Solo se permite una compra por jugador.';
  END IF;

  IF v_saldo_gems IS NULL OR v_saldo_gems < v_total_gems THEN
    RAISE EXCEPTION 'Gemas insuficientes: necesitas % y tienes %',
      v_total_gems, COALESCE(v_saldo_gems, 0);
  END IF;

  -- Descontar gemas, acreditar oro y marcar starter si aplica
  IF p_pack_id = 'starter' THEN
    UPDATE public.profiles
       SET gems_balance = gems_balance - v_total_gems,
           gold_balance = COALESCE(gold_balance, 0) + v_total_gold,
           has_purchased_starter_pack = TRUE
     WHERE id = v_uid;
  ELSE
    UPDATE public.profiles
       SET gems_balance = gems_balance - v_total_gems,
           gold_balance = COALESCE(gold_balance, 0) + v_total_gold
     WHERE id = v_uid;
  END IF;

  -- Insertar sobres en inventario
  FOR i IN 1..p_qty LOOP
    INSERT INTO public.player_packs (user_id, pack_id, source)
    VALUES (v_uid, p_pack_id, 'purchase')
    RETURNING id INTO v_id;
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  -- Auditoría de transacciones
  INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
  VALUES (v_uid, 'shop_purchase', v_total_gems,
          p_qty || ' × ' || v_pack.name || CASE WHEN v_total_gold > 0 THEN ' (+' || v_total_gold || ' Oro)' ELSE '' END, 'completed');

  IF v_total_gold > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount_gold, description, status)
    VALUES (v_uid, 'shop_pack_gold_bonus', v_total_gold,
            'Bonificación de ' || v_total_gold || ' Oro por compra de ' || p_qty || ' × ' || v_pack.name, 'completed');
  END IF;

  -- 70% de inyección automática al AMM de PLANTS
  PERFORM public._inject_plants_amm_liquidity(
    v_total_gems,
    v_uid,
    'shop_purchase',
    jsonb_build_object('packId', p_pack_id, 'qty', p_qty, 'packName', v_pack.name)
  );

  RETURN jsonb_build_object(
    'success',   TRUE,
    'packIds',   to_jsonb(v_ids),
    'spent',     v_total_gems,
    'goldAdded', v_total_gold,
    'quantity',  p_qty
  );
END;
$function$
