-- Migration 289: Fix player_packs_source_check to include presale and staking pack sources
-- Resuelve el error: "new row for relation \"player_packs\" violates check constraint \"player_packs_source_check\""

BEGIN;

ALTER TABLE public.player_packs DROP CONSTRAINT IF EXISTS player_packs_source_check;

ALTER TABLE public.player_packs ADD CONSTRAINT player_packs_source_check 
  CHECK (source = ANY (ARRAY[
    'purchase'::text,
    'victory'::text,
    'chest'::text,
    'gift'::text,
    'admin'::text,
    'admin_gift'::text,
    'referral'::text,
    'clan_full_bonus'::text,
    'clan'::text,
    'clan_reward'::text,
    'clan_champion'::text,
    'roulette'::text,
    'lottery'::text,
    'reward_code'::text,
    'battle_pass'::text,
    'vip_pass'::text,
    'tournament'::text,
    'season_reward'::text,
    'arena_ads'::text,
    -- Preventa y Staking de Token PLANTS:
    'presale_pack'::text,
    'presale'::text,
    'staking_bonus_30d'::text,
    'staking_bonus_60d'::text,
    'staking_bonus_90d'::text,
    'staking'::text,
    'staking_bonus'::text
  ]));

COMMIT;
