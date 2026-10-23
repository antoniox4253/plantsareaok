-- Migration 362: Admin View & Edit Sold Streaming Orders
-- Permite al administrador visualizar todas las suscripciones entregadas/vendidas y editar sus credenciales o vigencia.

-- 1. Actualizar admin_get_streaming_overview para retornar delivered_orders
CREATE OR REPLACE FUNCTION public.admin_get_streaming_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_pending_orders JSONB;
  v_delivered_orders JSONB;
  v_stock_summary JSONB;
  v_inventory JSONB;
BEGIN
  -- Validar admin
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Se requieren permisos de administrador.';
  END IF;

  -- 1. Pedidos pendientes (Netflix / On-Demand por entregar)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ord.id,
      'user_id', ord.user_id,
      'username', p.username,
      'platform', ord.platform,
      'product_name', ord.product_name,
      'gem_cost', ord.gem_cost,
      'is_on_demand', ord.is_on_demand,
      'order_status', ord.order_status,
      'account_region', ord.account_region,
      'created_at', ord.created_at
    ) ORDER BY ord.created_at DESC
  )
  INTO v_pending_orders
  FROM public.streaming_orders ord
  LEFT JOIN public.profiles p ON p.id = ord.user_id
  WHERE ord.order_status = 'pending';

  -- 2. Pedidos entregados / Suscripciones vendidas activas o históricas
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ord.id,
      'user_id', ord.user_id,
      'username', p.username,
      'platform', ord.platform,
      'product_name', ord.product_name,
      'gem_cost', ord.gem_cost,
      'is_on_demand', ord.is_on_demand,
      'order_status', ord.order_status,
      'account_region', ord.account_region,
      'email', ord.account_email,
      'password', ord.account_password,
      'profile_number', ord.profile_number,
      'profile_pin', ord.profile_pin,
      'bot_code', ord.bot_code,
      'admin_notes', ord.admin_notes,
      'created_at', ord.created_at,
      'delivered_at', ord.delivered_at,
      'expires_at', ord.expires_at,
      'days_remaining', CASE 
        WHEN ord.expires_at IS NOT NULL AND ord.expires_at > now() THEN 
          GREATEST(1, CEIL(EXTRACT(EPOCH FROM (ord.expires_at - now())) / 86400)::INT)
        ELSE 0
      END
    ) ORDER BY ord.delivered_at DESC NULLS LAST, ord.created_at DESC
  )
  INTO v_delivered_orders
  FROM public.streaming_orders ord
  LEFT JOIN public.profiles p ON p.id = ord.user_id
  WHERE ord.order_status <> 'pending';

  -- 3. Resumen de stock disponible
  SELECT jsonb_object_agg(platform, cnt)
  INTO v_stock_summary
  FROM (
    SELECT platform, COUNT(*) as cnt
    FROM public.streaming_inventory
    WHERE status = 'available'
    GROUP BY platform
  ) s;

  -- 4. Lista completa de inventario
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', inv.id,
      'platform', inv.platform,
      'account_identifier', inv.account_identifier,
      'account_email', inv.account_email,
      'profile_number', inv.profile_number,
      'profile_pin', inv.profile_pin,
      'bot_code', inv.bot_code,
      'status', inv.status,
      'assigned_to', inv.assigned_to,
      'assigned_username', p.username,
      'assigned_at', inv.assigned_at,
      'expires_at', inv.expires_at,
      'created_at', inv.created_at
    ) ORDER BY inv.platform ASC, inv.account_identifier ASC, inv.profile_number ASC
  )
  INTO v_inventory
  FROM public.streaming_inventory inv
  LEFT JOIN public.profiles p ON p.id = inv.assigned_to;

  RETURN jsonb_build_object(
    'success', true,
    'pending_orders', COALESCE(v_pending_orders, '[]'::jsonb),
    'delivered_orders', COALESCE(v_delivered_orders, '[]'::jsonb),
    'stock_summary', COALESCE(v_stock_summary, '{}'::jsonb),
    'inventory', COALESCE(v_inventory, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_streaming_overview() TO authenticated, service_role;

-- 2. Nueva función RPC para editar credenciales y parámetros de una orden vendida
CREATE OR REPLACE FUNCTION public.admin_update_streaming_order(
  p_order_id UUID,
  p_email TEXT,
  p_password TEXT,
  p_profile_number INT DEFAULT 1,
  p_profile_pin TEXT DEFAULT NULL,
  p_bot_code TEXT DEFAULT '',
  p_days_remaining INT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_order public.streaming_orders%ROWTYPE;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  -- Validar admin
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Se requieren permisos de administrador.';
  END IF;

  SELECT * INTO v_order
  FROM public.streaming_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Orden no encontrada.';
  END IF;

  -- Calcular nueva expiración si se especificó
  IF p_days_remaining IS NOT NULL AND p_days_remaining > 0 THEN
    v_new_expires_at := now() + (p_days_remaining || ' days')::INTERVAL;
  ELSE
    v_new_expires_at := v_order.expires_at;
  END IF;

  -- Actualizar orden en streaming_orders
  UPDATE public.streaming_orders
  SET account_email = TRIM(p_email),
      account_password = TRIM(p_password),
      profile_number = COALESCE(p_profile_number, profile_number, 1),
      profile_pin = NULLIF(TRIM(p_profile_pin), ''),
      bot_code = TRIM(COALESCE(p_bot_code, '')),
      expires_at = COALESCE(v_new_expires_at, expires_at),
      order_status = COALESCE(NULLIF(TRIM(p_status), ''), order_status)
  WHERE id = p_order_id;

  -- Si la orden está vinculada a un slot en streaming_inventory, mantenerlo sincronizado
  IF v_order.inventory_id IS NOT NULL THEN
    UPDATE public.streaming_inventory
    SET account_email = TRIM(p_email),
        account_password = TRIM(p_password),
        profile_number = COALESCE(p_profile_number, profile_number, 1),
        profile_pin = NULLIF(TRIM(p_profile_pin), ''),
        bot_code = TRIM(COALESCE(p_bot_code, '')),
        expires_at = COALESCE(v_new_expires_at, expires_at),
        updated_at = now()
    WHERE id = v_order.inventory_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'message', 'Suscripción actualizada exitosamente.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_streaming_order(UUID, TEXT, TEXT, INT, TEXT, TEXT, INT, TEXT) TO authenticated, service_role;
