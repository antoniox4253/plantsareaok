-- =============================================================================
-- MIGRACIÓN 431: PLANTAS DORADAS SOLO SI SE JUEGAN EN CAMPO + ÍNDICE DEL BLOG
-- =============================================================================
-- 1. En public.claim_pvp_plants_reward:
--    - Las Plantas Doradas conservan exactamente los mismos stats base que las
--      plantas normales (sin +15% HP ni Ataque).
--    - Bono oficial en Token $PLANTS: +10% por cada carta dorada distinta
--      (máximo 6 doradas = +60% extra) en victorias de Arena 3+ (2,001+ copas).
--    - Regla estricta de campo: SOLO cuentan las cartas doradas del mazo de la
--      sala que el ganador REALMENTE JUGÓ (plantó en el césped) durante esa
--      partida, verificado autoritativamente contra public.match_actions.
-- 2. Actualización del Blog Oficial (public.game_news_posts):
--    - Anuncio destacado de "Modo Historia: Invasión Mapache (¡Próximamente!)".
--    - Índice ordenado de los últimos cambios implementados (Clanes 2.0, Energía
--      15/20 VIP, Sobres PvP, Plantas Doradas Dual Deck y Blog Panorámico).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_pvp_plants_reward(
  p_room_id uuid,
  p_match_duration_sec numeric,
  p_enemy_kills integer,
  p_suns_collected integer,
  p_plants_placed integer,
  p_enemy_plants_placed integer DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_room RECORD;
  v_prof RECORD;
  v_amm RECORD;
  v_base_score NUMERIC := 40.0;
  v_combat_score NUMERIC;
  v_econ_score NUMERIC;
  v_deploy_score NUMERIC;
  v_blitz_score NUMERIC := 0.0;
  v_total_score NUMERIC;
  v_base_reward NUMERIC;
  v_pvp_mult NUMERIC := 1.0;
  v_final_plants NUMERIC;
  v_era_factor NUMERIC := 1.0;
  v_daily_claims INTEGER;
  v_claims_date DATE;
  v_bonus_active BOOLEAN := false;
  v_is_bot BOOLEAN := false;
  v_is_vip BOOLEAN := false;
  v_spot NUMERIC;
  v_deck JSONB;
  v_golden_count INTEGER := 0;
  v_golden_bonus_pct NUMERIC := 0.0;
  v_golden_mult NUMERIC := 1.0;
  v_effective_duration NUMERIC;
  v_effective_enemy_plants INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_room_id IS NULL THEN RAISE EXCEPTION 'ID de sala inválido'; END IF;

  -- 1. SEGURIDAD: Evitar doble reclamo de la misma sala
  IF EXISTS (SELECT 1 FROM public.plants_pvp_room_claims WHERE room_id = p_room_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'ROOM_ALREADY_CLAIMED',
      'error', 'La recompensa de esta partida ya fue reclamada.',
      'plantsAwarded', 0
    );
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;

  v_is_bot := COALESCE(v_room.is_async_match, false) OR (v_room.async_opponent_id IS NOT NULL);

  -- 2. Validar victoria
  IF v_room.status NOT IN ('p1_won', 'p2_won') THEN
    RAISE EXCEPTION 'La partida no terminó en victoria válida';
  END IF;

  IF v_room.player1_id = v_uid AND v_room.status <> 'p1_won' THEN
    RAISE EXCEPTION 'Solo las victorias otorgan PLANTS';
  ELSIF v_room.player2_id = v_uid AND v_room.status <> 'p2_won' THEN
    RAISE EXCEPTION 'Solo las victorias otorgan PLANTS';
  END IF;

  SELECT elo_rating, has_vip_pass, vip_pass_expires_at, plants_daily_claims_count, plants_daily_claims_date
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  -- 3. Solo Arena 3+ (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ARENA_TOO_LOW', 'plantsAwarded', 0);
  END IF;

  -- 4. Anti-Collusion Resiliente: Duración efectiva combinando cliente y timestamp de base de datos
  v_effective_duration := GREATEST(
    COALESCE(p_match_duration_sec, 0),
    COALESCE(EXTRACT(EPOCH FROM (COALESCE(v_room.settled_at, NOW()) - v_room.created_at)), 0)
  );

  v_effective_enemy_plants := GREATEST(
    COALESCE(p_enemy_plants_placed, 0),
    COALESCE(p_enemy_kills, 0),
    CASE WHEN v_effective_duration >= 45.0 THEN 4 ELSE 0 END
  );

  IF v_effective_duration < 40.0 OR v_effective_enemy_plants < 4 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MATCH_TOO_SHORT_OR_COLLUSION', 'plantsAwarded', 0);
  END IF;

  -- Verificación estricta de Pase VIP activo (flag + fecha de expiración vigente)
  v_is_vip := COALESCE(v_prof.has_vip_pass, false)
              AND (v_prof.vip_pass_expires_at IS NULL OR v_prof.vip_pass_expires_at > NOW());

  -- 5. Contador Diario Informativo (sin bloqueo de tope: rige el sistema de energías)
  v_claims_date := COALESCE(v_prof.plants_daily_claims_date, CURRENT_DATE);
  v_daily_claims := COALESCE(v_prof.plants_daily_claims_count, 0);

  IF v_claims_date < CURRENT_DATE THEN
    v_daily_claims := 0;
    v_claims_date := CURRENT_DATE;
  END IF;

  -- 6. Rendimiento Competitivo (40 a 100 puntos)
  v_combat_score := LEAST(25.0, (GREATEST(COALESCE(p_enemy_kills, 0), 1) * 2.5));
  v_econ_score := LEAST(20.0, (GREATEST(COALESCE(p_suns_collected, 0), 50) * 0.04));
  v_deploy_score := LEAST(15.0, (GREATEST(COALESCE(p_plants_placed, 0), 2) * 1.5));
  IF v_effective_duration <= 120.0 THEN v_blitz_score := 5.0; END IF;

  v_total_score := LEAST(100.0, v_base_score + v_combat_score + v_econ_score + v_deploy_score + v_blitz_score);

  -- Recompensa base (2.0 a 6.0 PLANTS)
  v_base_reward := 2.0 + ((v_total_score - 40.0) / 60.0) * 4.0;

  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;

  -- 7. REGLA: CONTRA JUGADOR VS BOT
  IF v_is_bot THEN
    v_base_reward := v_base_reward * 0.5;
    v_pvp_mult := 1.0;
    v_bonus_active := false;
  ELSE
    IF v_amm.pvp_bonus_ends_at IS NOT NULL AND NOW() <= v_amm.pvp_bonus_ends_at THEN
      v_pvp_mult := 1.25;
      v_bonus_active := true;
    END IF;
  END IF;

  -- 8. Factor de Halving
  IF v_amm.current_halving_era = 2 THEN v_era_factor := 0.5;
  ELSIF v_amm.current_halving_era = 3 THEN v_era_factor := 0.25;
  ELSIF v_amm.current_halving_era = 4 THEN v_era_factor := 0.125;
  ELSIF v_amm.current_halving_era >= 5 THEN v_era_factor := 0.0625;
  END IF;

  -- 8.1 BONIFICADOR ESTRICTO DE CARTAS DORADAS JUGADAS EN CAMPO (+10% c/u, máx. 6 = +60%)
  v_deck := CASE
    WHEN v_room.player1_id = v_uid THEN v_room.p1_deck
    WHEN v_room.player2_id = v_uid THEN v_room.p2_deck
    ELSE NULL
  END;

  IF v_deck IS NULL OR jsonb_typeof(v_deck) <> 'array' OR jsonb_array_length(v_deck) = 0 THEN
    v_deck := public._active_deck(v_uid);
  END IF;

  SELECT COUNT(DISTINCT (COALESCE((d.elem->>'slot')::INTEGER, (d.ord - 1)::INTEGER), COALESCE(d.elem->>'plantId', '')))
    INTO v_golden_count
    FROM jsonb_array_elements(v_deck) WITH ORDINALITY AS d(elem, ord)
   WHERE COALESCE((d.elem->>'isGolden')::BOOLEAN, FALSE) = TRUE
     AND EXISTS (
       SELECT 1
         FROM public.match_actions ma
        WHERE ma.room_id = p_room_id
          AND ma.user_id = v_uid
          AND ma.kind = 'plant'
          AND (
            (
              ma.slot IS NOT NULL
              AND ma.slot = COALESCE((d.elem->>'slot')::INTEGER, (d.ord - 1)::INTEGER)
              AND (ma.plant_id IS NULL OR ma.plant_id = COALESCE(d.elem->>'plantId', ma.plant_id))
            )
            OR (ma.slot IS NULL AND ma.plant_id = COALESCE(d.elem->>'plantId', ''))
          )
     );

  v_golden_count := LEAST(6, COALESCE(v_golden_count, 0));
  v_golden_bonus_pct := v_golden_count * 10.0;
  v_golden_mult := 1.0 + (v_golden_bonus_pct / 100.0);

  v_final_plants := ROUND(v_base_reward * v_pvp_mult * v_era_factor * v_golden_mult, 2);
  v_spot := v_amm.usdt_pool / v_amm.virtual_plants;

  -- 9. Registrar reclamo de sala
  INSERT INTO public.plants_pvp_room_claims (room_id, user_id, plants_awarded)
  VALUES (p_room_id, v_uid, v_final_plants);

  -- 10. Acreditar saldo en profiles (y limpiar flag VIP si expiró)
  UPDATE public.profiles
  SET
    plants_balance = COALESCE(plants_balance, 0) + v_final_plants,
    plants_daily_claims_count = v_daily_claims + 1,
    plants_daily_claims_date = CURRENT_DATE,
    has_vip_pass = CASE
      WHEN COALESCE(has_vip_pass, false) AND vip_pass_expires_at IS NOT NULL AND vip_pass_expires_at <= NOW() THEN FALSE
      ELSE has_vip_pass
    END,
    updated_at = NOW()
  WHERE id = v_uid;

  -- 11. Actualizar emisión en AMM
  UPDATE public.plants_amm_state
  SET
    virtual_plants = virtual_plants + v_final_plants,
    total_minted = total_minted + v_final_plants,
    current_halving_era = CASE
      WHEN total_minted + v_final_plants >= 937500 THEN 5
      WHEN total_minted + v_final_plants >= 875000 THEN 4
      WHEN total_minted + v_final_plants >= 750000 THEN 3
      WHEN total_minted + v_final_plants >= 500000 THEN 2
      ELSE 1
    END,
    updated_at = NOW()
  WHERE id = 1;

  -- 12. Insertar en historial de precios y eventos auditables con columnas canónicas
  INSERT INTO public.plants_price_history (
    spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants, user_id, metadata
  ) VALUES (
    v_spot, v_amm.usdt_pool, v_amm.virtual_plants + v_final_plants,
    CASE WHEN v_is_bot THEN 'pvp_bot_reward' ELSE 'pvp_match_reward' END,
    0, v_final_plants, v_uid,
    jsonb_build_object(
      'roomId', p_room_id,
      'isBot', v_is_bot,
      'score', ROUND(v_total_score, 1),
      'baseReward', v_base_reward,
      'pvpMult', v_pvp_mult,
      'bonusActive', v_bonus_active,
      'dailyClaimsUsed', v_daily_claims + 1,
      'isVip', v_is_vip,
      'goldenCardsCount', v_golden_count,
      'goldenBonusPct', v_golden_bonus_pct,
      'goldenCountingRule', 'played_on_field_only'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'plantsAwarded', v_final_plants,
    'score', v_total_score,
    'baseReward', v_base_reward,
    'isLivePvP', NOT v_is_bot,
    'isBotMatch', v_is_bot,
    'bonusActive', v_bonus_active,
    'dailyClaimsUsed', v_daily_claims + 1,
    'isVip', v_is_vip,
    'goldenCardsCount', v_golden_count,
    'goldenBonusPct', v_golden_bonus_pct
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_pvp_plants_reward(uuid, numeric, integer, integer, integer, integer) TO authenticated, anon, service_role;


-- =============================================================================
-- 2. ACTUALIZAR E INDEXAR NOTICIAS EN EL BLOG OFICIAL (public.game_news_posts)
-- =============================================================================
-- Desanclar posts viejos de v1.5.0 para destacar lo más nuevo
UPDATE public.game_news_posts
   SET is_pinned = FALSE
 WHERE id = '854cd9b5-e96e-4504-a031-d67615ee52fc';

-- Publicación Fijada #1: Anuncio Modo Historia (¡Próximamente!)
INSERT INTO public.game_news_posts (
  id, title, summary, content, tag, category, version, author, is_pinned, published_at
) VALUES (
  '20261110-0001-4000-8000-000000000431',
  '🦝 ¡Próximamente: Modo Historia — La Invasión Mapache!',
  'Prepárate para la gran campaña PvE de 20 niveles por oleadas contra las tropas mapaches y su jefe final, el temible Rey Garra.',
  E'### 🗺️ ¡Muy Pronto en Plants Arena: Modo Historia!\n¡Estamos ultimando detalles de nuestro próximo gran modo de juego PvE para un jugador: **La Invasión Mapache**!\n\n### ⚔️ ¿Qué encontrarás en esta campaña?\n- **20 Niveles Progresivos en 3 Carriles**: Defiende tu Árbol Madre superando 3 oleadas tácticas en cada nivel (Incursión, Emboscada y Oleada Final).\n- **Economía Clásica Táctica**: Gestiona soles desde el inicio (250 soles iniciales y caída natural del cielo) antes de la llegada de la primera oleada a los 25 segundos.\n- **5 Nuevas Tropas Mapache Enemigas**:\n  - 💣 **PumPum**: Artillero pesado que dispara balas de cañón a distancia.\n  - 🐾 **Garritas**: Rasguñador ágil capaz de saltar sobre Nueces defensivas.\n  - 🥊 **Puños**: Coloso cuerpo a cuerpo que entra en **Modo Furia** cada 5 golpes.\n  - 🗡️ **Navajas**: Lanzador veloz de cuchillos arrojadizos desde media distancia.\n  - 👑 **Rey Garra (Jefe Final)**: Comandante de la oleada 3 que patrulla los 3 carriles, ruge para potenciar a sus tropas e invoca refuerzos.\n- **Recompensas de Campaña**: Gana Oro, Gemas y progreso único por superar cada nivel.\n\n*Muy pronto se activará el botón oficial en el menú **Jugar**. ¡Ve preparando tu mazo!*',
  '🔜 Próximamente',
  'evento',
  'Avance v1.7',
  'Equipo Plants Arena',
  TRUE,
  '2026-11-10T21:30:00Z'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  tag = EXCLUDED.tag,
  category = EXCLUDED.category,
  version = EXCLUDED.version,
  author = EXCLUDED.author,
  is_pinned = EXCLUDED.is_pinned,
  published_at = EXCLUDED.published_at;

-- Publicación Fijada #2: Índice Oficial de Cambios Recientes
INSERT INTO public.game_news_posts (
  id, title, summary, content, tag, category, version, author, is_pinned, published_at
) VALUES (
  '20261110-0002-4000-8000-000000000431',
  '📋 Índice de Novedades: Clanes 2.0, Energía 15/20 VIP y Plantas Doradas',
  'Resumen indexado con todas las mejoras recientes en economía PvP, tesorería de clanes, reglas oficiales de cartas doradas y el nuevo Blog.',
  E'### 🚀 Resumen Indexado de Actualizaciones Recientes\n\n#### 1. 🏰 Clanes 2.0 y Distribución del Tesoro\n- **Reparto de Excedentes del Clan**: Los líderes ahora pueden asignar porcentajes (%) exactos entre los miembros y ejecutar la distribución directa del excedente de gemas ganadas.\n- **Ranking y Cierre de Temporada**: Acreditación ordenada del premio al cofre del tesoro del clan al cierre de cada ciclo.\n\n#### 2. ⚔️ Energía PvP (15/20 VIP), Sobres y Liquidación Limpia\n- **Balance de Batallas Diarias**: Energía diaria calibrada en **15 batallas gratuitas** y **20 con Pase VIP activo** (con validación exacta de fecha de vencimiento VIP).\n- **Sobres PvP Garantizados**: Entrega confiable de cofres al ganar tus batallas PvP.\n- **Sin Topes Artificiales de Token $PLANTS**: Mientras tengas energía o recargas, cada victoria en Arena 3+ otorga recompensas y se eliminaron los empates técnicos injustos por desconexión.\n\n#### 3. ✨ Plantas Doradas (Gold Foil) & Dual Deck\n- **Mismas Estadísticas Base**: Las plantas doradas **NO** tienen +15% en HP ni ataque; conservan exactamente las mismas estadísticas de combate que su versión base para mantener el juego justo y competitivo.\n- **Uso Dual en el Mazo**: Ahora puedes llevar en tu mazo **1 carta Base + 1 carta Dorada** de la misma especie en slots distintos.\n- **Bono +10% Token $PLANTS al Jugarlas**: Cada carta dorada distinta otorga **+10% extra de Token $PLANTS** (máx. 6 doradas = **+60%**) al ganar en Arena 3+, **contando únicamente las doradas que realmente plantes/juegues en el césped durante la batalla**.\n\n#### 4. 📰 Blog Panorámico y Buzón Comunitario\n- Diseño a pantalla completa en PC y móvil con navegación limpia, acceso único **"Ver Noticias"** desde el menú y Buzón de Sugerencias integrado.',
  '🚀 Gran Índice',
  'actualizacion',
  'v1.6.5',
  'Equipo Plants Arena',
  TRUE,
  '2026-11-10T21:00:00Z'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  tag = EXCLUDED.tag,
  category = EXCLUDED.category,
  version = EXCLUDED.version,
  author = EXCLUDED.author,
  is_pinned = EXCLUDED.is_pinned,
  published_at = EXCLUDED.published_at;

-- Actualizar la nota Semanal existente para reflejar también los últimos días reales
UPDATE public.game_news_posts
SET
  title = 'Registro Semanal: Todas las Mejoras Recientes (Bloque a Bloque)',
  summary = 'Repasamos bloque a bloque los últimos avances: avance de Modo Historia, Clanes 2.0, Energía 15/20 VIP, Doradas en campo y Blog Panorámico.',
  content = E'### 📅 Bitácora Reciente de Desarrollo\n\n#### 🟢 10 de Noviembre — Economía de Doradas, Blog & Avance Historia\n- **Plantas Doradas Justas**: Confirmado 0% extra en stats de combate (mismas stats base) y +10% en $PLANTS solo por las doradas jugadas en partida (máx. 6 = +60%).\n- **Anuncio Modo Historia**: Preparando el lanzamiento de los 20 niveles contra el Rey Garra y sus mapaches.\n- **Acceso Directo Unificado**: Nuevo botón único "Ver Noticias" en el menú principal.\n\n#### 🟢 9 de Noviembre — Clanes 2.0, Energía VIP y Sobres PvP\n- **Reparto de Tesorería de Clanes**: Asignación porcentual (%) y entrega de gemas excedentes a los miembros del clan.\n- **Calibración 15/20 Energías**: Ajuste a 15 batallas free / 20 VIP con verificación estricta de expiración VIP.\n- **Cierre Sin Empates Técnicos**: Blindaje de victorias y sobres PvP.\n\n#### 🟢 8 de Noviembre — AQP Game Fest 2026 & Dual Deck\n- **Dual Base + Dorada**: Permite equipar 1 copia base y 1 copia dorada de la misma planta en el mazo.\n- **Vitrina en AQP Game Fest 2026**: Participación oficial destacada en [aqpgamefest.com/juegos.html](https://aqpgamefest.com/juegos.html).',
  version = 'Semana 46',
  published_at = '2026-11-10T20:00:00Z'
WHERE id = '746df080-d8b0-48b0-a8de-014ea22e7544';

INSERT INTO public._migration_audit (fase, detalle, ejecutado_en)
VALUES (
  '431-golden-cards-played-only-and-blog-news-index',
  jsonb_build_object(
    'golden_bonus_pct_per_card', 10,
    'golden_max_cards', 6,
    'golden_max_bonus_pct', 60,
    'golden_rule', 'Solo cuentan cartas doradas del mazo realmente plantadas en match_actions (kind=plant)',
    'blog_updated', true
  ),
  NOW()
);

COMMIT;
