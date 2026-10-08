-- =============================================================================
-- MIGRACIÓN 288: RECALIBRACIÓN DE APERTURA MULTICARRIL DISTRIBUIDA EN ARENA 4 Y 5
-- DISTRIBUCIÓN EN TRIÁNGULO (CARRILES 0, 1 Y 2) PARA ELIMINAR EL CHEESE RUSHEO VACÍO
-- PRESERVANDO ESTRICTAMENTE EL PRESUPUESTO DETERMINISTA DE SOLES (0 DROPS)
-- =============================================================================

BEGIN;

CREATE TEMP TABLE tmp_bot_archetypes_v2 (
  archetype_idx INT PRIMARY KEY,
  actions JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_bot_archetypes_v2 (archetype_idx, actions) VALUES
(
  0,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":1,"plantId":"repeater","lane":0,"col":1,"issuedTick":1765,"tick":1771},{"seq":3,"kind":"plant","slot":2,"plantId":"tallnut","lane":2,"col":3,"issuedTick":2675,"tick":2681},{"seq":4,"kind":"plant","slot":1,"plantId":"repeater","lane":2,"col":1,"issuedTick":4131,"tick":4137},{"seq":5,"kind":"plant","slot":1,"plantId":"repeater","lane":1,"col":1,"issuedTick":5587,"tick":5593}]'::jsonb
),
(
  1,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":1,"plantId":"threepeater","lane":0,"col":1,"issuedTick":2493,"tick":2499},{"seq":3,"kind":"plant","slot":2,"plantId":"tallnut","lane":2,"col":3,"issuedTick":3403,"tick":3409},{"seq":4,"kind":"plant","slot":1,"plantId":"threepeater","lane":2,"col":1,"issuedTick":5587,"tick":5593}]'::jsonb
),
(
  2,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":1,"plantId":"kernelpult","lane":0,"col":1,"issuedTick":1037,"tick":1043},{"seq":3,"kind":"plant","slot":3,"plantId":"wallnut","lane":2,"col":3,"issuedTick":1401,"tick":1407},{"seq":4,"kind":"plant","slot":1,"plantId":"kernelpult","lane":2,"col":1,"issuedTick":2129,"tick":2135},{"seq":5,"kind":"plant","slot":1,"plantId":"kernelpult","lane":1,"col":1,"issuedTick":2857,"tick":2863},{"seq":6,"kind":"plant","slot":3,"plantId":"wallnut","lane":0,"col":3,"issuedTick":3221,"tick":3227},{"seq":7,"kind":"plant","slot":3,"plantId":"wallnut","lane":1,"col":3,"issuedTick":3821,"tick":3827},{"seq":8,"kind":"plant","slot":5,"plantId":"jalapeno","lane":1,"col":5,"issuedTick":4495,"tick":4501},{"seq":9,"kind":"plant","slot":2,"plantId":"garlic","lane":0,"col":4,"issuedTick":4859,"tick":4865},{"seq":10,"kind":"plant","slot":5,"plantId":"jalapeno","lane":1,"col":5,"issuedTick":5769,"tick":5775}]'::jsonb
),
(
  3,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":4,"plantId":"repeater","lane":0,"col":1,"issuedTick":1765,"tick":1771},{"seq":3,"kind":"plant","slot":3,"plantId":"wallnut","lane":2,"col":3,"issuedTick":2129,"tick":2135},{"seq":4,"kind":"plant","slot":4,"plantId":"repeater","lane":2,"col":1,"issuedTick":3585,"tick":3591},{"seq":5,"kind":"plant","slot":4,"plantId":"repeater","lane":1,"col":1,"issuedTick":5041,"tick":5047},{"seq":6,"kind":"plant","slot":3,"plantId":"wallnut","lane":0,"col":3,"issuedTick":5405,"tick":5411},{"seq":7,"kind":"plant","slot":1,"plantId":"garlic","lane":0,"col":4,"issuedTick":5769,"tick":5775}]'::jsonb
),
(
  4,
  '[{"seq":1,"kind":"plant","slot":0,"plantId":"sunflower","lane":1,"col":0,"issuedTick":309,"tick":315},{"seq":2,"kind":"plant","slot":3,"plantId":"peashooter","lane":0,"col":1,"issuedTick":1037,"tick":1043},{"seq":3,"kind":"plant","slot":4,"plantId":"wallnut","lane":2,"col":3,"issuedTick":1401,"tick":1407},{"seq":4,"kind":"plant","slot":3,"plantId":"peashooter","lane":2,"col":1,"issuedTick":2129,"tick":2135},{"seq":5,"kind":"plant","slot":3,"plantId":"peashooter","lane":1,"col":1,"issuedTick":2857,"tick":2863},{"seq":6,"kind":"plant","slot":4,"plantId":"wallnut","lane":0,"col":3,"issuedTick":3221,"tick":3227},{"seq":7,"kind":"plant","slot":4,"plantId":"wallnut","lane":1,"col":3,"issuedTick":3821,"tick":3827},{"seq":8,"kind":"plant","slot":2,"plantId":"squash","lane":1,"col":5,"issuedTick":3949,"tick":3955},{"seq":9,"kind":"plant","slot":1,"plantId":"bonkchoy","lane":0,"col":4,"issuedTick":5041,"tick":5047},{"seq":10,"kind":"plant","slot":2,"plantId":"squash","lane":1,"col":5,"issuedTick":5405,"tick":5411}]'::jsonb
);

-- Actualizar los 125 bots de Arena 4 y 5 asignándoles los nuevos planes distribuidos
WITH ordered_bots AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS rn
  FROM public.ranked_async_opponents
  WHERE elo_rating >= 2600
)
UPDATE public.ranked_async_opponents o
SET
  actions_snapshot = a.actions,
  updated_at = NOW()
FROM ordered_bots b
JOIN tmp_bot_archetypes_v2 a ON a.archetype_idx = (b.rn % 5)
WHERE o.id = b.id;

COMMIT;
