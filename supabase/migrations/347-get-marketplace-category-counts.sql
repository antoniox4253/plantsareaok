-- Migration 347: get_marketplace_category_counts RPC
-- Permite consultar de forma instantánea el conteo real de ofertas activas agrupadas por categoría (plantas, recursos, oro).

CREATE OR REPLACE FUNCTION public.get_marketplace_category_counts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_plants INT;
  v_farming INT;
  v_gold INT;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE status = 'active' AND (item_type = 'plant' OR item_type IS NULL))::INT,
    COUNT(*) FILTER (WHERE status = 'active' AND item_type = 'farming')::INT,
    COUNT(*) FILTER (WHERE status = 'active' AND item_type = 'gold')::INT
  INTO v_plants, v_farming, v_gold
  FROM public.marketplace_listings;

  RETURN jsonb_build_object(
    'plants', COALESCE(v_plants, 0),
    'farming', COALESCE(v_farming, 0),
    'gold', COALESCE(v_gold, 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_category_counts() TO anon, authenticated, service_role;
