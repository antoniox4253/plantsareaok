CREATE OR REPLACE FUNCTION public.spin_lottery_multi(p_currency text DEFAULT 'gold'::text, p_spins integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid            UUID := auth.uid();
  v_username       TEXT;
  v_gold_balance   BIGINT;
  v_gems_balance   NUMERIC;
  v_is_banned      BOOLEAN;
  c_gold_spin_cost CONSTANT BIGINT := 500;
  c_gems_spin_cost CONSTANT NUMERIC := 50;
  v_total_cost     NUMERIC;
  v_results        JSONB := '[]'::jsonb;
  v_r              NUMERIC;
  v_acc            NUMERIC;
  v_sector         RECORD;
  v_dado           JSONB;
  i                INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_spins IS NULL OR p_spins < 1 OR p_spins > 10 THEN
    RAISE EXCEPTION 'La cantidad de tiros debe ser entre 1 y 10';
  END IF;

  IF p_currency NOT IN ('gold', 'gems') THEN
    RAISE EXCEPTION 'Moneda de ruleta inválida. Usa "gold" o "gems"';
  END IF;

  SELECT username, COALESCE(gold_balance, 0), COALESCE(gems_balance, 0), COALESCE(is_banned, false)
    INTO v_username, v_gold_balance, v_gems_balance, v_is_banned
    FROM public.profiles
   WHERE id = v_uid
     FOR UPDATE;

  IF v_is_banned THEN
    RAISE EXCEPTION 'Tu cuenta se encuentra suspendida por actividades irregulares.';
  END IF;

  -- Validar y descontar costo (500 Oro o 50 Gemas por tiro)
  IF p_currency = 'gold' THEN
    v_total_cost := c_gold_spin_cost * p_spins;
    IF v_gold_balance < v_total_cost THEN
      RAISE EXCEPTION 'Oro insuficiente. Necesitas % de Oro para % tiro(s). Tienes: %', v_total_cost, p_spins, v_gold_balance;
    END IF;

    UPDATE public.profiles
       SET gold_balance = gold_balance - v_total_cost
     WHERE id = v_uid;

    INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
    VALUES (v_uid, 'spend', 0, 'Ruleta (' || p_spins || 'x) (-' || v_total_cost || ' Oro 💰)', 'completed');
  ELSE
    v_total_cost := c_gems_spin_cost * p_spins;
    IF v_gems_balance < v_total_cost THEN
      RAISE EXCEPTION 'Gemas insuficientes. Necesitas % Gemas para % tiro(s) VIP. Tienes: %', v_total_cost, p_spins, v_gems_balance;
    END IF;

    UPDATE public.profiles
       SET gems_balance = gems_balance - v_total_cost
     WHERE id = v_uid;

    INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
    VALUES (v_uid, 'spend', v_total_cost, 'Ruleta VIP (' || p_spins || 'x) (-' || v_total_cost || ' Gemas 💎)', 'completed');
  END IF;

  -- Procesar cada tiro secuencialmente
  FOR i IN 1..p_spins LOOP
    v_r := random() * 100;
    v_acc := 0;
    v_sector := NULL;

    FOR v_sector IN
      SELECT *
        FROM public.lottery_sectors
       WHERE is_active AND wheel_mode = p_currency
       ORDER BY sector_id
    LOOP
      v_acc := v_acc + v_sector.weight;
      IF v_r <= v_acc THEN
        EXIT;
      END IF;
    END LOOP;

    IF v_sector IS NULL THEN
      SELECT * INTO v_sector
        FROM public.lottery_sectors
       WHERE is_active AND wheel_mode = p_currency
       LIMIT 1;
    END IF;

    -- Entregar recompensa
    IF v_sector.reward_type <> 'none' THEN
      v_dado := public._grant_reward(
        v_uid,
        v_sector.reward_type,
        v_sector.pack_id,
        v_sector.pack_qty,
        v_sector.plant_id,
        v_sector.plant_qty,
        v_sector.gems_amount,
        v_sector.gold_amount,
        'lottery_' || p_currency,
        v_sector.item_id,
        v_sector.item_qty
      );

      -- Registrar transacción de premio para marquesina en vivo e historial
      IF v_sector.reward_type = 'gems' AND COALESCE(v_sector.gems_amount, 0) > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        VALUES (v_uid, 'deposit', v_sector.gems_amount,
                'Premio de Ruleta: +' || v_sector.gems_amount || ' Gemas 💎', 'completed');
      ELSIF v_sector.reward_type = 'plant' THEN
        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        VALUES (v_uid, 'deposit', 0,
                'Premio de Ruleta: Carta ' || COALESCE(v_sector.label, 'Planta 🌱'), 'completed');
      ELSIF v_sector.reward_type = 'gold' AND COALESCE(v_sector.gold_amount, 0) > 0 THEN
        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        VALUES (v_uid, 'deposit', 0,
                'Premio de Ruleta: +' || v_sector.gold_amount || ' Oro 💰', 'completed');
      ELSIF v_sector.reward_type = 'pack' THEN
        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        VALUES (v_uid, 'deposit', 0,
                'Premio de Ruleta: ' || COALESCE(v_sector.label, 'Sobre'), 'completed');
      ELSIF v_sector.reward_type = 'item' THEN
        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        VALUES (v_uid, 'deposit', 0,
                'Premio de Ruleta: +' || COALESCE(v_sector.label, 'Insumo'), 'completed');
      END IF;
    ELSE
      v_dado := jsonb_build_object('type', 'none');
    END IF;

    -- Anuncio en chat global para el Jackpot de Jalapeño
    IF v_sector.sector_id IN ('gold_jalapeno', 'gems_jalapeno', 'gems_jalapeno_jack') THEN
      BEGIN
        INSERT INTO public.global_chat_messages (user_id, username, message, has_vip, avatar_id)
        VALUES (
          v_uid,
          COALESCE(v_username, 'Un jugador'),
          '🌶️ ¡¡MEGA JACKPOT BOTÁNICO!! ¡Acaba de ganar una carta de Jalapeño 🌶️ en la Ruleta (' || CASE WHEN p_currency = 'gems' THEN 'Modo VIP 💎' ELSE 'Modo Oro 💰' END || ')! 🔥🎉',
          TRUE,
          'jalapeno'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    v_results := v_results || jsonb_build_object(
      'spinIndex',  i,
      'sectorId',   v_sector.sector_id,
      'label',      v_sector.label,
      'rewardType', v_sector.reward_type,
      'plantId',    v_sector.plant_id,
      'plantQty',   v_sector.plant_qty,
      'gemsAmount', v_sector.gems_amount,
      'granted',    v_dado
    );
  END LOOP;

  -- Incrementar contador de giros del usuario
  INSERT INTO public.user_lottery (user_id, total_spins, updated_at)
  VALUES (v_uid, p_spins, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET total_spins = COALESCE(public.user_lottery.total_spins, 0) + p_spins,
                updated_at = NOW();

  RETURN jsonb_build_object(
    'success',    TRUE,
    'currency',   p_currency,
    'spinsCount', p_spins,
    'totalSpent', v_total_cost,
    'results',    v_results
  );
END;
$function$
