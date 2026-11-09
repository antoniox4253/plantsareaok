CREATE OR REPLACE FUNCTION public.buy_marketplace_card(p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_buyer_id             UUID := auth.uid();
  v_listing              RECORD;
  v_buyer_gems           NUMERIC;
  v_buyer_locked         NUMERIC;
  v_seller_gems          NUMERIC;
  v_commission           NUMERIC;
  v_net_seller           NUMERIC;
  v_inv                  JSONB;
  v_current_qty          INTEGER;
  v_buyer_needs_base     BOOLEAN;
  v_paid_from_locked     NUMERIC := 0.0;
  v_locked_fraction      NUMERIC := 0.0;
  v_seller_locked_add    NUMERIC := 0.0;
  v_buyer_prof           RECORD;
  v_seller_prof          RECORD;
BEGIN
  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Debes iniciar sesión para comprar');
  END IF;

  SELECT * INTO v_buyer_prof FROM public.profiles WHERE id = v_buyer_id FOR UPDATE;
  IF COALESCE(v_buyer_prof.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cuenta suspendida');
  END IF;

  SELECT * INTO v_listing
    FROM public.marketplace_listings
   WHERE id = p_listing_id AND status = 'active'
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'La oferta ya no está disponible');
  END IF;

  IF v_listing.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes comprar tu propia oferta');
  END IF;

  SELECT * INTO v_seller_prof FROM public.profiles WHERE id = v_listing.seller_id FOR UPDATE;

  -- 🚨 CONTROL DEL ÁRBITRO: Transacciones sospechosas entre cuentas referidas
  IF (v_buyer_prof.referred_by = v_seller_prof.id OR v_seller_prof.referred_by = v_buyer_prof.id) THEN
    IF v_listing.price_gems > 300 THEN
      INSERT INTO public.security_fraud_incidents (
        user_id, counterparty_id, incident_type, action_taken, description, payload
      ) VALUES (
        v_buyer_id, v_listing.seller_id, 'marketplace_collusion', 'rejected',
        format('Bloqueo de compra de alto valor entre cuentas vinculadas: %s 💎', v_listing.price_gems),
        jsonb_build_object('listing_id', p_listing_id, 'price_gems', v_listing.price_gems)
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Transacción bloqueada por el Árbitro: Compras superiores a 300 💎 entre cuentas referidas vinculadas están restringidas.'
      );
    END IF;
  END IF;

  v_buyer_gems := COALESCE(v_buyer_prof.gems_balance, 0);
  v_buyer_locked := COALESCE(v_buyer_prof.locked_gems_balance, 0);

  IF v_buyer_gems < v_listing.price_gems THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Gemas insuficientes para completar la compra (disponible: %s 💎, requerido: %s 💎).', FLOOR(v_buyer_gems), v_listing.price_gems)
    );
  END IF;

  v_commission := ROUND(v_listing.price_gems * 0.10, 2);
  v_net_seller := v_listing.price_gems - v_commission;

  v_paid_from_locked := LEAST(v_buyer_locked, v_listing.price_gems);
  IF v_listing.price_gems > 0 THEN
    v_locked_fraction := v_paid_from_locked / v_listing.price_gems;
  ELSE
    v_locked_fraction := 0.0;
  END IF;
  v_seller_locked_add := ROUND(v_net_seller * v_locked_fraction, 2);

  -- Descontar gemas del comprador
  UPDATE public.profiles
     SET gems_balance = gems_balance - v_listing.price_gems
   WHERE id = v_buyer_id;

  -- Acreditar gemas netas al vendedor
  UPDATE public.profiles
     SET gems_balance = gems_balance + v_net_seller,
         locked_gems_balance = COALESCE(locked_gems_balance, 0) + v_seller_locked_add
   WHERE id = v_listing.seller_id;

  -- CASO A: COMPRA DE ORO
  IF v_listing.item_type = 'gold' THEN
    UPDATE public.profiles
       SET gold_balance = COALESCE(gold_balance, 0) + COALESCE(v_listing.quantity, 0)
     WHERE id = v_buyer_id;

    BEGIN
      INSERT INTO public.transactions (user_id, amount_gold, description, type, status, created_at)
      VALUES (
        v_buyer_id, v_listing.quantity,
        format('Oro adquirido en Mercado P2P por %s 💎 Gemas', v_listing.price_gems),
        'marketplace_gold_buy', 'completed', NOW()
      );
    EXCEPTION WHEN OTHERS THEN END;

  -- CASO B: COMPRA DE ÍTEM DE CULTIVO
  ELSIF v_listing.item_type = 'farming' AND v_listing.item_id IS NOT NULL THEN
    SELECT COALESCE(farming_inventory, '{}'::jsonb) INTO v_inv
      FROM public.profiles WHERE id = v_buyer_id FOR UPDATE;

    v_current_qty := COALESCE((v_inv->>v_listing.item_id)::INTEGER, 0);
    v_inv := jsonb_set(v_inv, ARRAY[v_listing.item_id], to_jsonb(v_current_qty + COALESCE(v_listing.quantity, 1)));

    UPDATE public.profiles SET farming_inventory = v_inv WHERE id = v_buyer_id;

    INSERT INTO public.farm_inventory(user_id, item_id, quantity)
    VALUES (v_buyer_id, v_listing.item_id, v_current_qty + COALESCE(v_listing.quantity, 1))
    ON CONFLICT (user_id, item_id)
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW();

  -- CASO C: COMPRA DE CARTA DE PLANTA
  ELSIF v_listing.plant_instance_id IS NOT NULL THEN
    SELECT (NOT EXISTS (
      SELECT 1 FROM public.plant_instances
       WHERE (owner_id = v_buyer_id OR user_id = v_buyer_id)
         AND plant_id = v_listing.item_id
         AND is_base = true
         AND id <> v_listing.plant_instance_id
    )) INTO v_buyer_needs_base;

    UPDATE public.plant_instances
       SET owner_id = v_buyer_id,
           user_id = v_buyer_id,
           is_listed_for_sale = false,
           is_in_deck = false,
           deck_slot = null,
           is_base = v_buyer_needs_base
     WHERE id = v_listing.plant_instance_id;

    UPDATE public.plant_instances
       SET is_base = true
     WHERE id = (
       SELECT id FROM public.plant_instances
        WHERE (owner_id = v_listing.seller_id OR user_id = v_listing.seller_id)
          AND plant_id = v_listing.item_id
          AND id <> v_listing.plant_instance_id
        ORDER BY level DESC, created_at ASC
        LIMIT 1
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.plant_instances
        WHERE (owner_id = v_listing.seller_id OR user_id = v_listing.seller_id)
          AND plant_id = v_listing.item_id
          AND is_base = true
          AND id <> v_listing.plant_instance_id
     );

    IF NOT EXISTS (
      SELECT 1 FROM public.plant_instances
       WHERE (owner_id = v_listing.seller_id OR user_id = v_listing.seller_id)
         AND plant_id = v_listing.item_id
    ) THEN
      UPDATE public.plant_copies SET copies = 0
       WHERE user_id = v_listing.seller_id AND plant_id = v_listing.item_id;
    END IF;
  END IF;

  UPDATE public.marketplace_listings
     SET status = 'sold', buyer_id = v_buyer_id, closed_at = NOW()
   WHERE id = p_listing_id;

  BEGIN
    INSERT INTO public.transactions (user_id, amount_gems, description, type, status, created_at)
    VALUES (
      v_buyer_id, -v_listing.price_gems,
      format('Compra en Mercado P2P: %s', CASE WHEN v_listing.item_type = 'gold' THEN format('%s 🪙 Oro', v_listing.quantity) ELSE format('%sx %s', COALESCE(v_listing.quantity, 1), COALESCE(v_listing.item_id, 'Carta')) END),
      'marketplace_buy', 'completed', NOW()
    );

    INSERT INTO public.transactions (user_id, amount_gems, description, type, status, created_at)
    VALUES (
      v_listing.seller_id, v_net_seller,
      format('Venta en Mercado P2P: %s (-10%% comisión, %s 💎 neto)', CASE WHEN v_listing.item_type = 'gold' THEN format('%s 🪙 Oro', v_listing.quantity) ELSE format('%sx %s', COALESCE(v_listing.quantity, 1), COALESCE(v_listing.item_id, 'Carta')) END, v_net_seller),
      'marketplace_sale', 'completed', NOW()
    );
  EXCEPTION WHEN OTHERS THEN END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Compra completada exitosamente',
    'listing_id', p_listing_id,
    'price_gems', v_listing.price_gems,
    'net_seller', v_net_seller
  );
END;
$function$
