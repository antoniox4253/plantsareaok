import fs from 'fs'
import path from 'path'
import { GENERATED_COMBOS } from './solve_combos.mjs'

// Load generated zero-drop combos
const c4 = JSON.stringify(GENERATED_COMBOS.combo4)
const c3 = JSON.stringify(GENERATED_COMBOS.combo3)
const c2 = JSON.stringify(GENERATED_COMBOS.combo2)
const c6 = JSON.stringify(GENERATED_COMBOS.combo6)
const c10 = JSON.stringify(GENERATED_COMBOS.combo10)

const migrationSql = `-- =============================================================================
-- MIGRACIÓN 200: ZERO-DROP BOT ACTIONS (ARENAS 1 A 5) Y CIERRE DEFINITIVO DE TEMPORADAS DE REFERIDOS
-- =============================================================================

BEGIN;

-- 1. RECALIBRACIÓN AUTORITATIVA DE BOTS EN ranked_async_opponents CON 0 DROPS
DO $$
DECLARE
  v_row RECORD;
  v_combo_idx INT;
  v_actions JSONB;
  v_c4 JSONB := '${c4}'::jsonb;
  v_c3 JSONB := '${c3}'::jsonb;
  v_c2 JSONB := '${c2}'::jsonb;
  v_c6 JSONB := '${c6}'::jsonb;
  v_c10 JSONB := '${c10}'::jsonb;
BEGIN
  FOR v_row IN
    SELECT id, ROW_NUMBER() OVER (ORDER BY elo_rating ASC, id ASC) as seq_id
      FROM public.ranked_async_opponents
  LOOP
    v_combo_idx := (v_row.seq_id % 5);
    IF v_combo_idx = 0 THEN
      v_actions := v_c4;
    ELSIF v_combo_idx = 1 THEN
      v_actions := v_c3;
    ELSIF v_combo_idx = 2 THEN
      v_actions := v_c2;
    ELSIF v_combo_idx = 3 THEN
      v_actions := v_c6;
    ELSIF v_combo_idx = 4 THEN
      v_actions := v_c10;
    END IF;

    UPDATE public.ranked_async_opponents
       SET actions_snapshot = v_actions,
           source_duration_ticks = 6000,
           updated_at = NOW()
     WHERE id = v_row.id;
  END LOOP;
END $$;

-- 2. ACTUALIZAR PLANES ACTIVOS EN ranked_async_room_plans SI EXISTEN
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ranked_async_room_plans') THEN
    UPDATE public.ranked_async_room_plans rp
       SET actions_snapshot = o.actions_snapshot
      FROM public.ranked_async_opponents o
     WHERE rp.async_opponent_id = o.id;
  END IF;
END $$;

-- 3. CIERRE DEFINITIVO DE TEMPORADAS DE REFERIDOS
-- Desvincular referrals de la temporada nueva auto-generada
UPDATE public.referrals
   SET season_id = NULL
 WHERE season_id = 'ee10775f-1aa3-4b6b-b0bb-982c19e3f289';

-- Eliminar la temporada nueva vacía
DELETE FROM public.referral_seasons
 WHERE id = 'ee10775f-1aa3-4b6b-b0bb-982c19e3f289';

-- Función para asegurar que no se creen nuevas temporadas automáticas
CREATE OR REPLACE FUNCTION public._asegurar_temporada_abierta()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_temp_id UUID;
BEGIN
  -- Retornar la última temporada concluida para consulta de ranking histórico
  SELECT id INTO v_temp_id
    FROM public.referral_seasons
   ORDER BY closed_at DESC NULLS LAST, starts_at DESC
   LIMIT 1;

  RETURN v_temp_id;
END;
$$;

-- Modificar _cerrar_temporada_de_referidos para NO crear temporadas nuevas
CREATE OR REPLACE FUNCTION public._cerrar_temporada_de_referidos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Las temporadas han finalizado definitivamente.
  RETURN jsonb_build_object('cerrada', FALSE, 'mensaje', 'temporadas_finalizadas');
END;
$$;

-- Actualizar my_referrals() para devolver el ranking oficial de la temporada cerrada
CREATE OR REPLACE FUNCTION public.my_referrals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_perfil RECORD;
  v_temp_id UUID;
  v_temp RECORD;
  v_validos_total INTEGER := 0;
  v_validos_temporada INTEGER := 0;
  v_total_amigos INTEGER := 0;
  v_sin_cobrar_oro INTEGER := 0;
  v_oro_por_amigo INTEGER := 100;
  v_gemas_deposito_por_cobrar NUMERIC(12,2) := 0;
  v_mi_puesto INTEGER := NULL;
  v_puedo_usar_codigo BOOLEAN := FALSE;
  v_motivo_no_puedo TEXT := NULL;
  v_amigos JSONB := '[]'::JSONB;
  v_ranking JSONB := '[]'::JSONB;
  v_referidor_nick TEXT := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- Cargar perfil
  SELECT * INTO v_perfil FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado');
  END IF;

  -- Cargar última temporada cerrada
  SELECT * INTO v_temp
    FROM public.referral_seasons
   ORDER BY closed_at DESC NULLS LAST, starts_at DESC
   LIMIT 1;

  v_temp_id := v_temp.id;

  -- Amigos del usuario
  SELECT COUNT(*) FILTER (WHERE valid_at IS NOT NULL),
         COUNT(*),
         COUNT(*) FILTER (WHERE valid_at IS NOT NULL AND gold_claimed_at IS NULL),
         COUNT(*) FILTER (WHERE valid_at IS NOT NULL AND (season_id = v_temp_id OR season_id IS NULL))
    INTO v_validos_total, v_total_amigos, v_sin_cobrar_oro, v_validos_temporada
    FROM public.referrals
   WHERE referrer_id = v_uid;

  SELECT COALESCE(value::INTEGER, 100) INTO v_oro_por_amigo
    FROM public.shop_config WHERE key = 'ref_oro_por_amigo';

  -- Comisiones de depósito pendientes de cobro
  SELECT COALESCE(SUM(commission_gems), 0) INTO v_gemas_deposito_por_cobrar
    FROM public.referral_deposit_commissions
   WHERE referrer_id = v_uid AND claimed = FALSE;

  -- Verificar si el usuario puede ingresar un código
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_uid) OR v_perfil.referred_by IS NOT NULL THEN
    v_puedo_usar_codigo := FALSE;
    v_motivo_no_puedo := 'ya_tienes_referidor';
    SELECT username INTO v_referidor_nick
      FROM public.profiles
     WHERE id = COALESCE(v_perfil.referred_by, (SELECT referrer_id FROM public.referrals WHERE referred_id = v_uid));
  ELSIF v_perfil.created_at < NOW() - INTERVAL '7 days' THEN
    v_puedo_usar_codigo := FALSE;
    v_motivo_no_puedo := 'cuenta_demasiado_antigua';
  ELSIF COALESCE(v_perfil.elo_rating, 1000) >= 1100 THEN
    v_puedo_usar_codigo := FALSE;
    v_motivo_no_puedo := 'ya_pasaste_las_copas';
  ELSE
    v_puedo_usar_codigo := TRUE;
  END IF;

  -- Puesto del usuario en el ranking oficial de la temporada cerrada
  IF v_temp_id IS NOT NULL THEN
    SELECT t.puesto INTO v_mi_puesto FROM (
      SELECT r.referrer_id,
             ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MIN(r.valid_at) ASC) AS puesto
        FROM public.referrals r
       WHERE r.season_id = v_temp_id AND r.valid_at IS NOT NULL
       GROUP BY r.referrer_id
    ) AS t WHERE t.referrer_id = v_uid;
  END IF;

  -- Lista de amigos invitados
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nombre',      p.username,
    'avatar',      p.avatar_id,
    'copas',       COALESCE(p.elo_rating, 1000),
    'valido',      r.valid_at IS NOT NULL,
    'oroCobrado',  r.gold_claimed_at IS NOT NULL,
    'desde',       r.created_at
  ) ORDER BY r.created_at DESC), '[]'::JSONB)
    INTO v_amigos
    FROM public.referrals r
    JOIN public.profiles p ON p.id = r.referred_id
   WHERE r.referrer_id = v_uid;

  -- Ranking Top 10 oficial de la temporada cerrada
  IF v_temp_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'puesto',  t.puesto,
      'nombre',  p.username,
      'avatar',  p.avatar_id,
      'validos', t.validos
    ) ORDER BY t.puesto ASC), '[]'::JSONB)
      INTO v_ranking
      FROM (
        SELECT r.referrer_id,
               COUNT(*) AS validos,
               ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MIN(r.valid_at) ASC) AS puesto
          FROM public.referrals r
         WHERE r.season_id = v_temp_id AND r.valid_at IS NOT NULL
         GROUP BY r.referrer_id
         LIMIT 10
      ) AS t
      JOIN public.profiles p ON p.id = t.referrer_id;
  END IF;

  RETURN jsonb_build_object(
    'codigo', v_perfil.referral_code,
    'puedoUsarCodigo', v_puedo_usar_codigo,
    'motivoNoPuedo', v_motivo_no_puedo,
    'miReferidor', v_referidor_nick,
    'diasParaUsarCodigo', GREATEST(0, 7 - EXTRACT(DAY FROM (NOW() - v_perfil.created_at))::INTEGER),
    'amigos', v_amigos,
    'total', v_total_amigos,
    'validos', v_validos_total,
    'validosTemporada', v_validos_temporada,
    'copasNecesarias', 1100,
    'oroPorCobrar', v_sin_cobrar_oro * v_oro_por_amigo,
    'amigosSinCobrar', v_sin_cobrar_oro,
    'oroPorAmigo', v_oro_por_amigo,
    'gemasDepositoPorCobrar', v_gemas_deposito_por_cobrar,
    'metaSobre', jsonb_build_object('objetivo', 10, 'alcanzada', false, 'cobrada', true),
    'metaGemas', jsonb_build_object('objetivo', 35, 'gemas', 500, 'alcanzada', false, 'cobrada', true),
    'temporada', jsonb_build_object(
      'terminaEn', COALESCE(v_temp.closed_at, v_temp.ends_at, NOW())::TEXT,
      'empezoEn', COALESCE(v_temp.starts_at, NOW())::TEXT,
      'segundos', 0
    ),
    'miPuesto', v_mi_puesto,
    'premios', '[]'::JSONB,
    'ranking', v_ranking
  );
END;
$$;

-- 4. ENTREGAR 2 SOBRES BÁSICOS A ELIANYER (TOP 3)
INSERT INTO public.player_packs (user_id, pack_id, source)
SELECT 'ca262a78-1fcd-4c9f-b146-c804ef52fedb', 'basic', 'gift'
FROM (VALUES (1), (2)) s(n)
WHERE (SELECT COUNT(*) FROM public.player_packs WHERE user_id = 'ca262a78-1fcd-4c9f-b146-c804ef52fedb' AND pack_id = 'basic') < 2;

COMMIT;
`

fs.writeFileSync(path.resolve('supabase/migrations/200-recalibrate-zero-drop-combos.sql'), migrationSql)
console.log('✅ Migración 200 generada con éxito en supabase/migrations/200-recalibrate-zero-drop-combos.sql')
