-- =============================================================================
-- MIGRACIÓN 286: RECALIBRACIÓN COMPETITIVA DE BOTS EN ARENA 4 Y ARENA 5
-- NICKS REALISTAS ESTILO GAMER PVP + PLANES TÁCTICOS CERTIFICADOS CON 0 DROPS
-- =============================================================================

BEGIN;

-- 1. Tabla temporal con los 5 planes y mazos certificados
CREATE TEMP TABLE tmp_bot_archetypes (
  archetype_idx INT PRIMARY KEY,
  deck JSONB NOT NULL,
  actions JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_bot_archetypes (archetype_idx, deck, actions) VALUES (
  0,
  '[{"slot":0,"level":3,"plantId":"sunflower","statRolls":["hp"]},{"slot":1,"level":3,"plantId":"repeater","statRolls":["damage"]},{"slot":2,"level":3,"plantId":"tallnut","statRolls":["hp"]},{"slot":3,"level":3,"plantId":"bonkchoy","statRolls":["attackSpeed"]},{"slot":4,"level":3,"plantId":"squash","statRolls":["cooldown"]},{"slot":5,"level":3,"plantId":"jalapeno","statRolls":["damage"]}]'::jsonb,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":1,"plantId":"repeater","lane":1,"col":1,"issuedTick":1765,"tick":1771},{"seq":3,"kind":"plant","slot":2,"plantId":"tallnut","lane":1,"col":3,"issuedTick":2675,"tick":2681},{"seq":4,"kind":"plant","slot":1,"plantId":"repeater","lane":0,"col":1,"issuedTick":4131,"tick":4137},{"seq":5,"kind":"plant","slot":1,"plantId":"repeater","lane":2,"col":1,"issuedTick":5587,"tick":5593}]'::jsonb
);

INSERT INTO tmp_bot_archetypes (archetype_idx, deck, actions) VALUES (
  1,
  '[{"slot":0,"level":4,"plantId":"sunflower","statRolls":["hp"]},{"slot":1,"level":4,"plantId":"threepeater","statRolls":["damage","attackSpeed"]},{"slot":2,"level":4,"plantId":"tallnut","statRolls":["damage","attackSpeed"]},{"slot":3,"level":4,"plantId":"bonkchoy","statRolls":["damage","attackSpeed"]},{"slot":4,"level":3,"plantId":"repeater","statRolls":["hp"]},{"slot":5,"level":3,"plantId":"jalapeno","statRolls":["hp"]}]'::jsonb,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":1,"plantId":"threepeater","lane":1,"col":1,"issuedTick":2493,"tick":2499},{"seq":3,"kind":"plant","slot":2,"plantId":"tallnut","lane":1,"col":3,"issuedTick":3403,"tick":3409},{"seq":4,"kind":"plant","slot":1,"plantId":"threepeater","lane":0,"col":1,"issuedTick":5587,"tick":5593}]'::jsonb
);

INSERT INTO tmp_bot_archetypes (archetype_idx, deck, actions) VALUES (
  2,
  '[{"slot":0,"level":3,"plantId":"sunflower","statRolls":["hp"]},{"slot":1,"level":4,"plantId":"kernelpult","statRolls":["damage","attackSpeed"]},{"slot":2,"level":4,"plantId":"garlic","statRolls":["damage","attackSpeed"]},{"slot":3,"level":4,"plantId":"wallnut","statRolls":["damage","attackSpeed"]},{"slot":4,"level":3,"plantId":"repeater","statRolls":["hp"]},{"slot":5,"level":3,"plantId":"jalapeno","statRolls":["hp"]}]'::jsonb,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":1,"plantId":"kernelpult","lane":1,"col":1,"issuedTick":1037,"tick":1043},{"seq":3,"kind":"plant","slot":3,"plantId":"wallnut","lane":1,"col":3,"issuedTick":1401,"tick":1407},{"seq":4,"kind":"plant","slot":1,"plantId":"kernelpult","lane":0,"col":1,"issuedTick":2129,"tick":2135},{"seq":5,"kind":"plant","slot":1,"plantId":"kernelpult","lane":2,"col":1,"issuedTick":2857,"tick":2863},{"seq":6,"kind":"plant","slot":3,"plantId":"wallnut","lane":0,"col":3,"issuedTick":3221,"tick":3227},{"seq":7,"kind":"plant","slot":3,"plantId":"wallnut","lane":2,"col":3,"issuedTick":3821,"tick":3827},{"seq":8,"kind":"plant","slot":5,"plantId":"jalapeno","lane":1,"col":5,"issuedTick":4495,"tick":4501},{"seq":9,"kind":"plant","slot":2,"plantId":"garlic","lane":0,"col":4,"issuedTick":4859,"tick":4865},{"seq":10,"kind":"plant","slot":5,"plantId":"jalapeno","lane":1,"col":5,"issuedTick":5769,"tick":5775}]'::jsonb
);

INSERT INTO tmp_bot_archetypes (archetype_idx, deck, actions) VALUES (
  3,
  '[{"slot":0,"level":3,"plantId":"sunflower","statRolls":["hp"]},{"slot":1,"level":4,"plantId":"garlic","statRolls":["damage","attackSpeed"]},{"slot":2,"level":4,"plantId":"bonkchoy","statRolls":["damage","attackSpeed"]},{"slot":3,"level":4,"plantId":"wallnut","statRolls":["damage","attackSpeed"]},{"slot":4,"level":3,"plantId":"repeater","statRolls":["hp"]},{"slot":5,"level":3,"plantId":"jalapeno","statRolls":["hp"]}]'::jsonb,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":4,"plantId":"repeater","lane":1,"col":1,"issuedTick":1765,"tick":1771},{"seq":3,"kind":"plant","slot":3,"plantId":"wallnut","lane":1,"col":3,"issuedTick":2129,"tick":2135},{"seq":4,"kind":"plant","slot":4,"plantId":"repeater","lane":0,"col":1,"issuedTick":3585,"tick":3591},{"seq":5,"kind":"plant","slot":4,"plantId":"repeater","lane":2,"col":1,"issuedTick":5041,"tick":5047},{"seq":6,"kind":"plant","slot":3,"plantId":"wallnut","lane":0,"col":3,"issuedTick":5405,"tick":5411},{"seq":7,"kind":"plant","slot":1,"plantId":"garlic","lane":0,"col":4,"issuedTick":5769,"tick":5775}]'::jsonb
);

INSERT INTO tmp_bot_archetypes (archetype_idx, deck, actions) VALUES (
  4,
  '[{"slot":0,"level":3,"plantId":"sunflower","statRolls":["hp"]},{"slot":1,"level":4,"plantId":"bonkchoy","statRolls":["damage","attackSpeed"]},{"slot":2,"level":4,"plantId":"squash","statRolls":["damage","attackSpeed"]},{"slot":3,"level":4,"plantId":"peashooter","statRolls":["damage","attackSpeed"]},{"slot":4,"level":3,"plantId":"wallnut","statRolls":["hp"]},{"slot":5,"level":3,"plantId":"jalapeno","statRolls":["hp"]}]'::jsonb,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":3,"plantId":"peashooter","lane":1,"col":1,"issuedTick":1037,"tick":1043},{"seq":3,"kind":"plant","slot":4,"plantId":"wallnut","lane":1,"col":3,"issuedTick":1401,"tick":1407},{"seq":4,"kind":"plant","slot":3,"plantId":"peashooter","lane":0,"col":1,"issuedTick":2129,"tick":2135},{"seq":5,"kind":"plant","slot":3,"plantId":"peashooter","lane":2,"col":1,"issuedTick":2857,"tick":2863},{"seq":6,"kind":"plant","slot":4,"plantId":"wallnut","lane":0,"col":3,"issuedTick":3221,"tick":3227},{"seq":7,"kind":"plant","slot":4,"plantId":"wallnut","lane":2,"col":3,"issuedTick":3821,"tick":3827},{"seq":8,"kind":"plant","slot":2,"plantId":"squash","lane":1,"col":5,"issuedTick":3949,"tick":3955},{"seq":9,"kind":"plant","slot":1,"plantId":"bonkchoy","lane":0,"col":4,"issuedTick":5041,"tick":5047},{"seq":10,"kind":"plant","slot":2,"plantId":"squash","lane":1,"col":5,"issuedTick":5405,"tick":5411}]'::jsonb
);

-- 2. Tabla temporal con los 125 nicks comunes estilo PvP
CREATE TEMP TABLE tmp_bot_nicks (
  rn INT PRIMARY KEY,
  nick TEXT NOT NULL,
  avatar TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_bot_nicks (rn, nick, avatar) VALUES
  (1, 'Alex_CR', 'bonkchoy'),
  (2, 'Santi_PvZ', 'repeater'),
  (3, 'Nicoo_07', 'melonpult'),
  (4, 'Sebas_23', 'threepeater'),
  (5, 'Camilo_GZ', 'tallnut'),
  (6, 'Facu_AR', 'peashooter'),
  (7, 'Matias_10', 'sunflower'),
  (8, 'Fercho_94', 'garlic'),
  (9, 'Lucas_Gamer', 'squash'),
  (10, 'Santy_99', 'wallnut'),
  (11, 'Nico_Playz', 'bonkchoy'),
  (12, 'David_CR', 'repeater'),
  (13, 'Diego_Master', 'melonpult'),
  (14, 'Feli_03', 'threepeater'),
  (15, 'Valen_Gamer', 'tallnut'),
  (16, 'Pipe_CR', 'peashooter'),
  (17, 'Diego_11', 'sunflower'),
  (18, 'Thiago_Pro', 'garlic'),
  (19, 'Maxi_Killer', 'squash'),
  (20, 'Mateo_CR', 'wallnut'),
  (21, 'Javi_PvZ', 'bonkchoy'),
  (22, 'Lucas_07', 'repeater'),
  (23, 'Agus_22', 'melonpult'),
  (24, 'Santi_Pro', 'threepeater'),
  (25, 'Mateo_99', 'tallnut'),
  (26, 'Alejo_CR', 'peashooter'),
  (27, 'Tomi_Playz', 'sunflower'),
  (28, 'Bauti_08', 'garlic'),
  (29, 'Joaquin_17', 'squash'),
  (30, 'Lautaro_X', 'wallnut'),
  (31, 'Marcos_Pro', 'bonkchoy'),
  (32, 'Leo_PvZ', 'repeater'),
  (33, 'Bruno_Gamer', 'melonpult'),
  (34, 'Cris_98', 'threepeater'),
  (35, 'Migue_CR', 'tallnut'),
  (36, 'Alvaro_22', 'peashooter'),
  (37, 'Manu_09', 'sunflower'),
  (38, 'Lucas_PvZ', 'garlic'),
  (39, 'Gabo_CR', 'squash'),
  (40, 'Nacho_95', 'wallnut'),
  (41, 'Enzo_20', 'bonkchoy'),
  (42, 'Esteban_CR', 'repeater'),
  (43, 'Dani_Playz', 'melonpult'),
  (44, 'Franco_12', 'threepeater'),
  (45, 'Renato_01', 'tallnut'),
  (46, 'Tomas_PvZ', 'peashooter'),
  (47, 'Samu_77', 'sunflower'),
  (48, 'Rodrigo_99', 'garlic'),
  (49, 'Kevin_CR', 'squash'),
  (50, 'Mateo_05', 'wallnut'),
  (51, 'Fede_Gamer', 'bonkchoy'),
  (52, 'Alan_PvZ', 'repeater'),
  (53, 'Julian_19', 'melonpult'),
  (54, 'Mati_Gamer', 'threepeater'),
  (55, 'Santi_CR', 'tallnut'),
  (56, 'Lucas_99', 'peashooter'),
  (57, 'Nico_Gamer', 'sunflower'),
  (58, 'Alejo_PvZ', 'garlic'),
  (59, 'Maxi_Pro', 'squash'),
  (60, 'Valen_CR', 'wallnut'),
  (61, 'Diego_07', 'bonkchoy'),
  (62, 'Agus_Playz', 'repeater'),
  (63, 'Pipe_Gamer', 'melonpult'),
  (64, 'Danix_CR', 'threepeater'),
  (65, 'Fercho_Pro', 'tallnut'),
  (66, 'Juanma_99', 'peashooter'),
  (67, 'Tomas_CR', 'sunflower'),
  (68, 'Nacho_Playz', 'garlic'),
  (69, 'Leo_CR', 'squash'),
  (70, 'Lucas_Gamer99', 'wallnut'),
  (71, 'Santy_08', 'bonkchoy'),
  (72, 'Sebas_Pro', 'repeater'),
  (73, 'Migue_Playz', 'melonpult'),
  (74, 'David_Pro', 'threepeater'),
  (75, 'Mati_Pro', 'tallnut'),
  (76, 'Julian_Gamer', 'peashooter'),
  (77, 'Franco_CR', 'sunflower'),
  (78, 'Bruno_Pro', 'garlic'),
  (79, 'Carlos_07', 'squash'),
  (80, 'Javi_CR', 'wallnut'),
  (81, 'Alvaro_Pro', 'bonkchoy'),
  (82, 'Camilo_Playz', 'repeater'),
  (83, 'Cris_CR', 'melonpult'),
  (84, 'Dani_Gamer', 'threepeater'),
  (85, 'Fede_CR', 'tallnut'),
  (86, 'Joaquin_Pro', 'peashooter'),
  (87, 'Lautaro_CR', 'sunflower'),
  (88, 'Renato_Gamer', 'garlic'),
  (89, 'Enzo_CR', 'squash'),
  (90, 'Manu_Pro', 'wallnut'),
  (91, 'Rodrigo_CR', 'bonkchoy'),
  (92, 'Kevin_Pro', 'repeater'),
  (93, 'Samu_CR', 'melonpult'),
  (94, 'Bauti_CR', 'threepeater'),
  (95, 'Alan_Pro', 'tallnut'),
  (96, 'Facu_CR', 'peashooter'),
  (97, 'Martin_Pro', 'sunflower'),
  (98, 'Alex_CR_99', 'garlic'),
  (99, 'Gabo_Pro', 'squash'),
  (100, 'Tomi_CR', 'wallnut'),
  (101, 'Pablo_92', 'bonkchoy'),
  (102, 'Gero_PvZ', 'repeater'),
  (103, 'Santy_CR', 'melonpult'),
  (104, 'Andres_Gamer', 'threepeater'),
  (105, 'Maxi_CR', 'tallnut'),
  (106, 'Lucas_Pro', 'peashooter'),
  (107, 'Nico_CR', 'sunflower'),
  (108, 'Valen_Playz', 'garlic'),
  (109, 'Diego_CR', 'squash'),
  (110, 'Pipe_Pro', 'wallnut'),
  (111, 'Fer_Gamer', 'bonkchoy'),
  (112, 'Mati_CR', 'repeater'),
  (113, 'Juan_PvZ', 'melonpult'),
  (114, 'Leo_Pro', 'threepeater'),
  (115, 'Sebas_CR', 'tallnut'),
  (116, 'David_Gamer', 'peashooter'),
  (117, 'Agus_CR', 'sunflower'),
  (118, 'Cami_CR', 'garlic'),
  (119, 'Javi_Pro', 'squash'),
  (120, 'Cris_Pro', 'wallnut'),
  (121, 'Danix_Pro', 'bonkchoy'),
  (122, 'Tomas_Pro', 'repeater'),
  (123, 'Nacho_CR', 'melonpult'),
  (124, 'Franco_Pro', 'threepeater'),
  (125, 'Bruno_CR', 'tallnut');

-- 3. Actualización autoritativa de todos los bots de Arena 4 y Arena 5 (ELO >= 3000)
WITH high_bots AS (
  SELECT id,
         elo_rating,
         ROW_NUMBER() OVER (ORDER BY elo_rating DESC, id ASC) AS rn
    FROM public.ranked_async_opponents
   WHERE elo_rating >= 3000
)
UPDATE public.ranked_async_opponents o
   SET display_name    = tn.nick,
       avatar_id       = tn.avatar,
       deck_snapshot   = ta.deck,
       actions_snapshot = ta.actions,
       tree_level      = CASE 
                           WHEN o.elo_rating >= 6000 THEN 3
                           WHEN o.elo_rating >= 4000 THEN 2
                           ELSE 1
                         END,
       is_active       = TRUE,
       active          = TRUE,
       updated_at      = NOW()
  FROM high_bots hb
  JOIN tmp_bot_nicks tn ON tn.rn = hb.rn
  JOIN tmp_bot_archetypes ta ON ta.archetype_idx = (hb.rn % 5)
 WHERE o.id = hb.id;

-- 4. Sincronizar ranked_async_room_plans en salas activas si existieran
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ranked_async_room_plans') THEN
    UPDATE public.ranked_async_room_plans rp
       SET actions_snapshot = o.actions_snapshot
      FROM public.ranked_async_opponents o
     WHERE rp.async_opponent_id = o.id
       AND o.elo_rating >= 3000;
  END IF;
END $$;

COMMIT;
