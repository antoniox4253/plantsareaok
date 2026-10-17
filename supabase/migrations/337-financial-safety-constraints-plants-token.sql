-- ==============================================================================
-- MIGRACIÓN 337: REGLAS Y CONSTRAINTS DE SEGURIDAD FINANCIERA ESTRICTA (PLANTS & USDT)
-- ==============================================================================
-- Blindaje a nivel de motor de base de datos para garantizar:
-- 1. Saldos de PLANTS, Vesting y USDT nunca negativos bajo ninguna circunstancia.
-- 2. Reservas de liquidez del AMM siempre válidas (usdt_pool >= 0, virtual_plants > 0).
-- 3. Solicitudes de retiro siempre con montos estrictamente positivos.
-- ==============================================================================

-- 1. Asegurar constraints de no-negatividad en perfiles de usuario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_plants_balance_non_negative'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plants_balance_non_negative CHECK (plants_balance >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_plants_vesting_non_negative'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plants_vesting_non_negative CHECK (plants_vesting_locked >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_usdt_balance_non_negative'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_usdt_balance_non_negative CHECK (usdt_balance >= 0);
  END IF;
END $$;

-- 2. Asegurar constraints de integridad matemática en la curva AMM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.plants_amm_state'::regclass AND conname = 'amm_usdt_pool_non_negative'
  ) THEN
    ALTER TABLE public.plants_amm_state
      ADD CONSTRAINT amm_usdt_pool_non_negative CHECK (usdt_pool >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.plants_amm_state'::regclass AND conname = 'amm_virtual_plants_positive'
  ) THEN
    ALTER TABLE public.plants_amm_state
      ADD CONSTRAINT amm_virtual_plants_positive CHECK (virtual_plants > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.plants_amm_state'::regclass AND conname = 'amm_k_constant_positive'
  ) THEN
    ALTER TABLE public.plants_amm_state
      ADD CONSTRAINT amm_k_constant_positive CHECK (k_constant > 0);
  END IF;
END $$;

-- 3. Validar montos positivos en órdenes de retiro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.plants_cashout_requests'::regclass AND conname = 'cashout_net_usdt_positive'
  ) THEN
    ALTER TABLE public.plants_cashout_requests
      ADD CONSTRAINT cashout_net_usdt_positive CHECK (net_usdt > 0);
  END IF;
END $$;
