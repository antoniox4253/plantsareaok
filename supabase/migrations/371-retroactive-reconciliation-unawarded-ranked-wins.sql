-- ==============================================================================
-- MIGRACIÓN 371: RECONCILIACIÓN RETROACTIVA DE VICTORIAS Y COPAS NO ACREDITADAS
-- ==============================================================================
-- 1. Identifica las 126 salas de 'illegal_both' donde una base enemiga fue
--    destruida a 0 HP y la sala quedó erróneamente en 'abandoned' sin ganador.
-- 2. Identifica las 14 salas de Ranked donde el combate fue disputado (>= 25s
--    y >= 10 acciones) pero se asignaron 0 copas por abandono/desconexión rival.
-- 3. Actualiza game_rooms a 'verified' y asigna el ganador legítimo oficial.
-- 4. Acredita las copas (+30 por victoria) en public.profiles (elo_rating).
-- 5. Suma las victorias oficiales en public.ranked_player_stats.
-- 6. Registra la auditoría completa de la reconciliación.
-- ==============================================================================

BEGIN;

-- ── 1. TABLA TEMPORAL CON TODAS LAS VICTORIAS A RECONCILIAR ──────────────────
CREATE TEMP TABLE tmp_reconciled_rooms ON COMMIT DROP AS
WITH illegal_both_winners AS (
  SELECT 
    g.id as room_id,
    CASE 
      WHEN (g.verification_payload->'bases'->>'p1')::numeric = 0 AND (g.verification_payload->'bases'->>'p2')::numeric > 0 THEN g.player2_id
      WHEN (g.verification_payload->'bases'->>'p2')::numeric = 0 AND (g.verification_payload->'bases'->>'p1')::numeric > 0 THEN g.player1_id
    END as winner_id,
    CASE 
      WHEN (g.verification_payload->'bases'->>'p1')::numeric = 0 AND (g.verification_payload->'bases'->>'p2')::numeric > 0 THEN 'p2_won'
      WHEN (g.verification_payload->'bases'->>'p2')::numeric = 0 AND (g.verification_payload->'bases'->>'p1')::numeric > 0 THEN 'p1_won'
    END as new_status,
    'illegal_both_base_destroyed' as reason
  FROM public.game_rooms g
  WHERE g.mode = 'ranked'
    AND g.verification_note ILIKE '%illegal_both%'
    AND (
      ((g.verification_payload->'bases'->>'p1')::numeric = 0 AND (g.verification_payload->'bases'->>'p2')::numeric > 0)
      OR
      ((g.verification_payload->'bases'->>'p2')::numeric = 0 AND (g.verification_payload->'bases'->>'p1')::numeric > 0)
    )
),
zero_copas_winners AS (
  SELECT 
    g.id as room_id,
    g.server_winner_id as winner_id,
    g.status as new_status,
    'zero_copas_combat_disputed' as reason
  FROM public.game_rooms g
  WHERE g.mode = 'ranked'
    AND g.verification_note ILIKE '%0 copas%'
    AND g.server_winner_id IS NOT NULL
    AND EXTRACT(EPOCH FROM (COALESCE(g.settled_at, NOW()) - g.started_at)) >= 25
    AND (SELECT COUNT(*) FROM public.match_actions ma WHERE ma.room_id = g.id) >= 10
)
SELECT * FROM illegal_both_winners
UNION ALL
SELECT * FROM zero_copas_winners;

-- ── 2. ACTUALIZAR SALAS EN GAME_ROOMS ─────────────────────────────────────────
-- Actualizar salas illegal_both a verified con su ganador oficial
UPDATE public.game_rooms g
   SET status = r.new_status,
       server_winner_id = r.winner_id,
       verification_status = 'verified',
       verified_at = NOW(),
       verification_note = 'Restauración autoritativa retroactiva: victoria legítima por destrucción de base enemiga',
       settled_at = COALESCE(g.settled_at, NOW())
  FROM tmp_reconciled_rooms r
 WHERE g.id = r.room_id
   AND r.reason = 'illegal_both_base_destroyed';

-- Actualizar salas de 0 copas para dejar constancia de la restitución
UPDATE public.game_rooms g
   SET verification_note = 'Restauración autoritativa retroactiva: victoria legítima en combate disputado (restitución de copas)'
  FROM tmp_reconciled_rooms r
 WHERE g.id = r.room_id
   AND r.reason = 'zero_copas_combat_disputed';

-- ── 3. ACREDITAR COPAS (+30 POR CADA VICTORIA) EN PROFILES ─────────────────────
WITH copas_to_credit AS (
  SELECT 
    winner_id as user_id,
    COUNT(*) as total_wins,
    COUNT(*) * 30 as copas_to_add
  FROM tmp_reconciled_rooms
  WHERE winner_id IS NOT NULL
  GROUP BY winner_id
)
UPDATE public.profiles p
   SET elo_rating = p.elo_rating + c.copas_to_add,
       updated_at = NOW()
  FROM copas_to_credit c
 WHERE p.id = c.user_id;

-- ── 4. SUMAR VICTORIAS EN RANKED_PLAYER_STATS ─────────────────────────────────
WITH wins_to_credit AS (
  SELECT 
    winner_id as user_id,
    COUNT(*) as total_wins
  FROM tmp_reconciled_rooms
  WHERE winner_id IS NOT NULL
  GROUP BY winner_id
)
INSERT INTO public.ranked_player_stats (user_id, wins, losses, draws, updated_at)
SELECT 
  w.user_id,
  w.total_wins,
  0,
  0,
  NOW()
FROM wins_to_credit w
ON CONFLICT (user_id) DO UPDATE
   SET wins = ranked_player_stats.wins + EXCLUDED.wins,
       updated_at = NOW();

-- ── 5. REGISTRAR AUDITORÍA DE RESTITUCIÓN EN TRANSACCIONES ─────────────────────
INSERT INTO public.transactions (user_id, type, amount_gold, description, status)
SELECT 
  c.user_id,
  'admin_adjustment',
  0,
  'Restitución retroactiva oficial: +' || c.copas_to_add || ' copas ELO por ' || c.total_wins || ' victorias legítimas recuperadas',
  'completed'
FROM (
  SELECT 
    winner_id as user_id,
    COUNT(*) as total_wins,
    COUNT(*) * 30 as copas_to_add
  FROM tmp_reconciled_rooms
  WHERE winner_id IS NOT NULL
  GROUP BY winner_id
) c;

COMMIT;
