-- ==============================================================================
-- MIGRACIÓN 281: REGISTRO AUDITABLE DE MINTEO, TOP HOLDERS Y TRAZABILIDAD REAL
-- ==============================================================================

-- 1. Actualizar claim_pvp_plants_reward para registrar en plants_price_history cada recompensa PvP
CREATE OR REPLACE FUNCTION public.claim_pvp_plants_reward(
  p_room_id UUID,
  p_match_duration_sec NUMERIC,
  p_enemy_kills INTEGER,
  p_suns_collected INTEGER,
  p_plants_placed INTEGER,
  p_enemy_plants_placed INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  v_spot NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_room_id IS NULL THEN RAISE EXCEPTION 'ID de sala inválido'; END IF;

  -- 1. SEGURIDAD: Validar que esta sala no haya sido cobrada previamente
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

  -- 2. Validar que la partida terminó en victoria válida para el usuario
  IF v_room.status NOT IN ('p1_won', 'p2_won') THEN
    RAISE EXCEPTION 'La partida no terminó en victoria válida';
  END IF;

  IF v_room.player1_id = v_uid AND v_room.status <> 'p1_won' THEN
    RAISE EXCEPTION 'Solo las victorias otorgan PLANTS';
  ELSIF v_room.player2_id = v_uid AND v_room.status <> 'p2_won' THEN
    RAISE EXCEPTION 'Solo las victorias otorgan PLANTS';
  END IF;

  SELECT elo_rating, plants_daily_claims_count, plants_daily_claims_date
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  -- 3. Filtro Maestro: Solo Arena 3+ (2,001+ copas)
  IF COALESCE(v_prof.elo_rating, 0) < 2001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ARENA_TOO_LOW', 'plantsAwarded', 0);
  END IF;

  -- 4. Anti-Collusion: Mínimo 45s de duración y 4 plantas del rival
  IF p_match_duration_sec < 45.0 OR p_enemy_plants_placed < 4 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MATCH_TOO_SHORT_OR_COLLUSION', 'plantsAwarded', 0);
  END IF;

  -- 5. Tope Diario Estricto (Máx 20 victorias al día)
  v_claims_date := COALESCE(v_prof.plants_daily_claims_date, CURRENT_DATE);
  v_daily_claims := COALESCE(v_prof.plants_daily_claims_count, 0);

  IF v_claims_date < CURRENT_DATE THEN
    v_daily_claims := 0;
    v_claims_date := CURRENT_DATE;
  END IF;

  IF v_daily_claims >= 20 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'DAILY_CLAIM_CAP_REACHED', 'plantsAwarded', 0);
  END IF;

  -- 6. Algoritmo de Rendimiento Competitivo (40 a 100 puntos)
  v_combat_score := LEAST(25.0, (p_enemy_kills * 2.5));
  v_econ_score := LEAST(20.0, (p_suns_collected * 0.04));
  v_deploy_score := LEAST(15.0, (p_plants_placed * 1.5));
  IF p_match_duration_sec <= 120.0 THEN v_blitz_score := 5.0; END IF;

  v_total_score := LEAST(100.0, v_base_score + v_combat_score + v_econ_score + v_deploy_score + v_blitz_score);

  -- Recompensa base: 2.0 a 6.0 PLANTS
  v_base_reward := 2.0 + ((v_total_score - 40.0) / 60.0) * 4.0;

  -- 7. Bono Especial de Lanzamiento (+25% primeros 7 días)
  SELECT * INTO v_amm FROM public.plants_amm_state WHERE id = 1 FOR UPDATE;
  IF v_amm.pvp_bonus_ends_at IS NOT NULL AND NOW() <= v_amm.pvp_bonus_ends_at THEN
    v_pvp_mult := 1.25;
    v_bonus_active := true;
  END IF;

  -- 8. Factor de Halving
  IF v_amm.current_halving_era = 2 THEN v_era_factor := 0.5;
  ELSIF v_amm.current_halving_era = 3 THEN v_era_factor := 0.25;
  ELSIF v_amm.current_halving_era = 4 THEN v_era_factor := 0.125;
  ELSIF v_amm.current_halving_era >= 5 THEN v_era_factor := 0.0625;
  END IF;

  v_final_plants := ROUND(v_base_reward * v_pvp_mult * v_era_factor, 2);
  v_spot := v_amm.usdt_pool / v_amm.virtual_plants;

  -- 9. REGISTRAR EL RECLAMO DE LA SALA
  INSERT INTO public.plants_pvp_room_claims (room_id, user_id, plants_awarded)
  VALUES (p_room_id, v_uid, v_final_plants);

  -- 10. Acreditar al perfil del jugador
  UPDATE public.profiles
  SET
    plants_balance = COALESCE(plants_balance, 0) + v_final_plants,
    plants_daily_claims_count = v_daily_claims + 1,
    plants_daily_claims_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = v_uid;

  -- 11. Actualizar emisión en AMM
  UPDATE public.plants_amm_state
  SET
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

  -- 12. Insertar en historial de precios y eventos auditables
  INSERT INTO public.plants_price_history (
    spot_price, usdt_pool, virtual_plants, event_type, delta_usdt, delta_plants, user_id, metadata
  ) VALUES (
    v_spot, v_amm.usdt_pool, v_amm.virtual_plants, 'pvp_reward', 0, v_final_plants, v_uid,
    jsonb_build_object(
      'roomId', p_room_id,
      'score', ROUND(v_total_score, 1),
      'bonusActive', v_bonus_active,
      'dailyClaimsUsed', v_daily_claims + 1
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'plantsAwarded', v_final_plants,
    'score', v_total_score,
    'isLivePvP', NOT v_room.is_async_match,
    'bonusActive', v_bonus_active,
    'bonusPct', CASE WHEN v_bonus_active THEN 25 ELSE 0 END,
    'dailyClaimsUsed', v_daily_claims + 1,
    'dailyClaimsMax', 20
  );
END;
$$;

-- 2. RPC: Obtener Top Holders reales con distribución del suministro
CREATE OR REPLACE FUNCTION public.get_plants_top_holders(p_limit INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users JSONB;
  v_total_circulating NUMERIC;
  v_holders_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(plants_balance + plants_vesting_locked), 0), COUNT(*)
  INTO v_total_circulating, v_holders_count
  FROM public.profiles
  WHERE (plants_balance + plants_vesting_locked) > 0;

  SELECT jsonb_agg(h)
  INTO v_users
  FROM (
    SELECT
      ROW_NUMBER() OVER (ORDER BY (p.plants_balance + p.plants_vesting_locked) DESC, p.elo_rating DESC) as rank,
      p.id as user_id,
      p.username,
      COALESCE(p.avatar_id, 'peashooter') as avatar,
      p.elo_rating,
      ROUND(p.plants_balance, 4) as liquid_plants,
      ROUND(p.plants_vesting_locked, 4) as vesting_plants,
      ROUND(p.plants_balance + p.plants_vesting_locked, 4) as total_plants,
      CASE 
        WHEN (p.plants_balance + p.plants_vesting_locked) > 0 THEN
          ROUND(((p.plants_balance + p.plants_vesting_locked) / 1000000.0) * 100, 3)
        ELSE 0
      END as share_pct
    FROM public.profiles p
    WHERE (p.plants_balance + p.plants_vesting_locked) > 0
    ORDER BY (p.plants_balance + p.plants_vesting_locked) DESC
    LIMIT p_limit
  ) h;

  RETURN jsonb_build_object(
    'success', true,
    'totalCirculating', v_total_circulating,
    'holdersCount', COALESCE(v_holders_count, 0),
    'holders', COALESCE(v_users, '[]'::jsonb),
    'vaults', jsonb_build_array(
      jsonb_build_object(
        'name', 'Bóveda de Recompensas PvP & Halving',
        'type', 'vault_pvp',
        'address', '0x12b8...4a29 (Contrato de Recompensas)',
        'allocation', 500000,
        'sharePct', 50.0,
        'desc', 'Minteo programado por victorias clasificatorias en Arena 3+ (5 Eras de Halving)'
      ),
      jsonb_build_object(
        'name', 'Reserva de Liquidez AMM & Respaldo USDT',
        'type', 'vault_amm',
        'address', '0x7f3a...91e4 (Pool Público P=R/V)',
        'allocation', 370000,
        'sharePct', 37.0,
        'desc', 'Fondo de respaldo contractual AMM con 100% de solvencia garantizada'
      ),
      jsonb_build_object(
        'name', 'Asignación Preventa Fundadores',
        'type', 'vault_presale',
        'address', '0x48e2...bc71 (Contrato de Vesting)',
        'allocation', 130000,
        'sharePct', 13.0,
        'desc', 'Contrato de Vesting Lineal de 45 Días para los 20 Packs de Preventa Fundadores'
      )
    )
  );
END;
$$;

-- 3. RPC: Obtener Historial Completo de Minteo y Quemas
CREATE OR REPLACE FUNCTION public.get_plants_minting_history(p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_events JSONB;
BEGIN
  SELECT jsonb_agg(e)
  INTO v_events
  FROM (
    SELECT
      h.id,
      h.event_type,
      ROUND(h.delta_plants, 4) as delta_plants,
      ROUND(h.delta_usdt, 4) as delta_usdt,
      ROUND(h.spot_price, 8) as spot_price,
      ROUND(h.usdt_pool, 4) as usdt_pool,
      h.user_id,
      COALESCE(p.username, 'Sistema Génesis') as username,
      COALESCE(p.avatar_id, 'peashooter') as avatar,
      h.metadata,
      h.created_at
    FROM public.plants_price_history h
    LEFT JOIN public.profiles p ON p.id = h.user_id
    ORDER BY h.created_at DESC
    LIMIT p_limit
  ) e;

  RETURN jsonb_build_object(
    'success', true,
    'events', COALESCE(v_events, '[]'::jsonb)
  );
END;
$$;

-- 4. Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_plants_top_holders(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_plants_minting_history(INTEGER) TO authenticated, anon;
