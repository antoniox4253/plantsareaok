-- Migration 348: assign-all-emotes-to-top50.sql
-- Desbloquea todos los emotes existentes del catálogo para los jugadores del Top 50 del ranking.

WITH top50 AS (
  SELECT id 
  FROM public.leaderboard 
  ORDER BY rank_position ASC 
  LIMIT 50
)
UPDATE public.profiles p
SET unlocked_emotes = ARRAY[
  'hola',
  'gg',
  'jaja',
  'grr',
  'piedad',
  'que_rico',
  'unete_clan',
  'papi_dagger',
  'wow',
  'triste'
]::text[]
FROM top50
WHERE p.id = top50.id;

-- Desbloquear también para las cuentas de prueba de testing del creador
UPDATE public.profiles
SET unlocked_emotes = ARRAY[
  'hola',
  'gg',
  'jaja',
  'grr',
  'piedad',
  'que_rico',
  'unete_clan',
  'papi_dagger',
  'wow',
  'triste'
]::text[]
WHERE username ILIKE 'navi' OR username ILIKE 'lionel';
