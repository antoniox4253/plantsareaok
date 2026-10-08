-- ==============================================================================
-- MIGRACIÓN 287: ELIMINACIÓN TOTAL DE NOMBRES DE BOT EN ARENAS 1, 2 Y 3
-- Reemplazo de los últimos 32 'Sombra Ancestral' y 1 'Fénix Dorado'
-- por nicknames reales estilo gamer PvP
-- ==============================================================================

BEGIN;

CREATE TEMP TABLE tmp_clean_nicks (
  rn INT PRIMARY KEY,
  nick TEXT NOT NULL,
  avatar TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_clean_nicks (rn, nick, avatar) VALUES
  (1,  'Juanma_08',       'peashooter'),
  (2,  'Thiago_CR7',      'bonkchoy'),
  (3,  'Nico_Gamer99',    'repeater'),
  (4,  'Facu_Playz',      'threepeater'),
  (5,  'Santi_Crack',     'melonpult'),
  (6,  'Lucas_Pro21',     'tallnut'),
  (7,  'Mati_PvZ',        'wallnut'),
  (8,  'David_98',        'sunflower'),
  (9,  'Cami_Pro',        'twinsunflower'),
  (10, 'Enzo_Playz',      'kernelpult'),
  (11, 'Alejo_Master',    'squash'),
  (12, 'Diego_Gamer05',   'garlic'),
  (13, 'Fer_CR',          'bonkchoy'),
  (14, 'Lautaro_Playz',   'peashooter'),
  (15, 'Bruno_PvZ',       'repeater'),
  (16, 'Kevin_Gamer',     'threepeater'),
  (17, 'Julian_CR',       'melonpult'),
  (18, 'Santy_Master',    'tallnut'),
  (19, 'Pipe_Playz',      'wallnut'),
  (20, 'Joaco_CR',        'sunflower'),
  (21, 'Martin_99',       'twinsunflower'),
  (22, 'Agus_Master',     'kernelpult'),
  (23, 'Tomas_PvZ',       'squash'),
  (24, 'Franco_Playz',    'garlic'),
  (25, 'Maxi_07',         'bonkchoy'),
  (26, 'Bauti_Playz',     'peashooter'),
  (27, 'Leo_Master',      'repeater'),
  (28, 'Alan_CR',         'threepeater'),
  (29, 'Manu_Gamer',      'melonpult'),
  (30, 'Nacho_Playz',     'tallnut'),
  (31, 'Valen_Master99',  'wallnut'),
  (32, 'Emi_CR',          'sunflower'),
  (33, 'Simon_Gamer',     'kernelpult');

WITH targets AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY elo_rating DESC, id ASC) AS rn
  FROM public.ranked_async_opponents
  WHERE display_name IN ('Sombra Ancestral', 'Fénix Dorado')
)
UPDATE public.ranked_async_opponents b
SET display_name = n.nick,
    avatar_id    = n.avatar,
    updated_at   = NOW()
FROM targets t
JOIN tmp_clean_nicks n ON t.rn = n.rn
WHERE b.id = t.id;

COMMIT;
