-- =============================================================================
-- MIGRACIÓN 427: REEMPLAZAR ÍNDICE ÚNICO POR ESPECIE POR ÍNDICE POR VARIANTE
--                (PERMITE USAR PLANTA BASE Y PLANTA DORADA SIMULTÁNEAMENTE)
-- =============================================================================
-- La migración 418 actualizó la RPC save_active_deck para permitir equipar
-- simultáneamente 1 carta base y 1 carta dorada de la misma especie, pero en
-- PostgreSQL seguía activo el viejo índice único:
--   idx_plant_instances_single_species_in_deck ON (owner_id, plant_id)
-- lo que bloqueaba a nivel de tabla cualquier intento de guardar ambas en el mazo.
--
-- Esta migración reemplaza ese índice por uno por variante (especie + is_golden),
-- permitiendo equipar p.ej. Wall-nut Base + Wall-nut Dorada como cartas distintas.
-- =============================================================================

DROP INDEX IF EXISTS public.idx_plant_instances_single_species_in_deck;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plant_instances_single_variant_in_deck
  ON public.plant_instances USING btree (owner_id, plant_id, COALESCE(is_golden, false))
  WHERE (is_in_deck = true);

INSERT INTO public._migration_audit (fase, detalle)
VALUES (
  '427-fix-dual-base-and-golden-deck-index',
  jsonb_build_object(
    'dropped_index', 'idx_plant_instances_single_species_in_deck',
    'created_index', 'idx_plant_instances_single_variant_in_deck',
    'rule', 'Permite máximo 1 copia base y 1 copia dorada de cada plant_id en plant_instances.is_in_deck'
  )
);
