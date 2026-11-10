-- ==============================================================================
-- MIGRACIÓN 428: CORRECCIÓN INTEGRAL DEL REPARTO DE EXCEDENTE DE GEMAS DEL CLAN
-- 1. Corrige sobre-reparto cuando hay miembros nuevos con reward_percentage NULL
--    junto a miembros con cuotas ya configuradas (evita romper la Reserva de 2,800 💎).
-- 2. Corrige comprobación de rol ('leader' en inglés según constraint, no 'Líder')
--    y usa IS DISTINCT FROM para manejar leader_id nulo con seguridad.
-- 3. Valida suma estricta del 100% cuando hay cuotas configuradas y tope estricto
--    para garantizar que vault_gems nunca baje de la Reserva de Guerra (2,800 💎).
-- 4. Endurece update_clan_reward_shares para reinicializar a 0 a miembros omitidos,
--    rechazar porcentajes negativos y registrar performed_by_name en auditoría.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_clan_reward_shares(
  p_clan_id UUID,
  p_shares  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_clan        RECORD;
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_item        JSONB;
  v_user_id     UUID;
  v_percentage  NUMERIC;
  v_total       NUMERIC := 0;
  v_updated     INTEGER := 0;
  v_shares_obj  JSONB := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED', 'message', 'Debes iniciar sesión');
  END IF;

  IF p_clan_id IS NULL OR p_shares IS NULL OR jsonb_typeof(p_shares) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENTS', 'message', 'Argumentos inválidos');
  END IF;

  SELECT * INTO v_clan FROM public.clans WHERE id = p_clan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLAN_NOT_FOUND', 'message', 'Clan no encontrado');
  END IF;

  SELECT cm.role, p.username
    INTO v_caller_role, v_caller_name
    FROM public.clan_members cm
    LEFT JOIN public.profiles p ON p.id = cm.user_id
   WHERE cm.clan_id = p_clan_id AND cm.user_id = v_uid;

  IF v_caller_name IS NULL THEN
    SELECT username INTO v_caller_name FROM public.profiles WHERE id = v_uid;
  END IF;

  IF v_clan.leader_id IS DISTINCT FROM v_uid AND COALESCE(v_caller_role, '') <> 'leader' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ONLY_LEADER_ALLOWED', 'message', 'Solo el Líder puede configurar las cuotas de ganancias');
  END IF;

  -- Validar porcentajes y calcular suma total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_shares)
  LOOP
    v_percentage := COALESCE((v_item->>'percentage')::NUMERIC, 0);
    IF v_percentage < 0 OR v_percentage > 100 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_PERCENTAGE',
        'message', 'Cada porcentaje debe estar entre 0% y 100%.'
      );
    END IF;
    v_total := v_total + v_percentage;
  END LOOP;

  -- Validar suma de 100% si hay miembros en el array
  IF jsonb_array_length(p_shares) > 0 AND ROUND(v_total) <> 100 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TOTAL_PERCENTAGE',
      'message', 'La suma de las cuotas de reparto debe ser exactamente 100%. Suma actual: ' || v_total || '%'
    );
  END IF;

  -- Poner primero todos los miembros activos del clan en 0% para evitar NULLs residuales
  UPDATE public.clan_members
     SET reward_percentage = 0.0
   WHERE clan_id = p_clan_id;

  -- Aplicar a cada miembro incluido en p_shares
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_shares)
  LOOP
    v_user_id := (v_item->>'user_id')::UUID;
    v_percentage := COALESCE((v_item->>'percentage')::NUMERIC, 0);

    UPDATE public.clan_members
       SET reward_percentage = v_percentage
     WHERE clan_id = p_clan_id AND user_id = v_user_id;

    IF FOUND THEN
      v_updated := v_updated + 1;
      v_shares_obj := v_shares_obj || jsonb_build_object(v_user_id::text, v_percentage);
    END IF;
  END LOOP;

  -- Actualizar objeto reward_shares en tabla clans
  UPDATE public.clans
     SET reward_shares = v_shares_obj,
         updated_at = NOW()
   WHERE id = p_clan_id;

  INSERT INTO public.clan_audit_logs (
    clan_id, clan_name, action, performed_by, performed_by_name, details
  ) VALUES (
    p_clan_id, v_clan.name, 'UPDATE_REWARD_SHARES', v_uid, COALESCE(v_caller_name, 'Líder'),
    jsonb_build_object('shares', v_shares_obj, 'total_percentage', v_total)
  );

  RETURN jsonb_build_object(
    'success', true,
    'total_percentage', v_total,
    'members_updated', v_updated
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.distribute_clan_surplus_earnings(p_clan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                   UUID := auth.uid();
  v_clan                  RECORD;
  v_caller_role           TEXT;
  v_caller_name           TEXT;
  c_WAR_RESERVE           CONSTANT NUMERIC := 2800.0;
  v_surplus               NUMERIC;
  v_distributable_pool    NUMERIC;
  v_member                RECORD;
  v_member_pct            NUMERIC;
  v_member_share          NUMERIC;
  v_total_distributed     NUMERIC := 0.0;
  v_members_paid_count    INTEGER := 0;
  v_payout_details        JSONB := '[]'::JSONB;
  v_members_count         INTEGER;
  v_has_configured_shares BOOLEAN := FALSE;
  v_total_pct             NUMERIC := 0.0;
  v_has_negative          BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED', 'message', 'Debes iniciar sesión para repartir ganancias.');
  END IF;

  -- 1. Validar existencia y bloquear registro del clan para concurrencia
  SELECT * INTO v_clan FROM public.clans WHERE id = p_clan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLAN_NOT_FOUND', 'message', 'Clan no encontrado.');
  END IF;

  -- 2. Validar que quien invoca sea el Líder del clan
  SELECT cm.role, p.username
    INTO v_caller_role, v_caller_name
    FROM public.clan_members cm
    LEFT JOIN public.profiles p ON p.id = cm.user_id
   WHERE cm.clan_id = p_clan_id AND cm.user_id = v_uid;

  IF v_caller_name IS NULL THEN
    SELECT username INTO v_caller_name FROM public.profiles WHERE id = v_uid;
  END IF;

  IF v_clan.leader_id IS DISTINCT FROM v_uid AND COALESCE(v_caller_role, '') <> 'leader' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_LEADER_ONLY', 'message', 'Solo el Líder del clan puede repartir las ganancias excedentes.');
  END IF;

  -- 3. Calcular el excedente neto por encima de la reserva de 2,800 gemas
  v_surplus := GREATEST(0.0, COALESCE(v_clan.vault_gems, 0.0) - c_WAR_RESERVE);
  v_distributable_pool := FLOOR(v_surplus);

  IF v_distributable_pool <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_SURPLUS',
      'message', format('El Tesoro actual (%s 💎) se encuentra en o por debajo de la Reserva Operativa (2,800 💎). No hay ganancias excedentes enteras para retirar.', v_clan.vault_gems)
    );
  END IF;

  -- 4. Contar miembros activos
  SELECT COUNT(*) INTO v_members_count FROM public.clan_members WHERE clan_id = p_clan_id;
  IF v_members_count <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_MEMBERS', 'message', 'El clan no tiene miembros registrados.');
  END IF;

  -- 5. Verificar si el clan tiene cuotas configuradas; si las tiene, los nuevos miembros NULL reciben 0%
  SELECT EXISTS (
    SELECT 1 FROM public.clan_members
    WHERE clan_id = p_clan_id AND reward_percentage IS NOT NULL
  ) INTO v_has_configured_shares;

  IF v_has_configured_shares THEN
    SELECT COALESCE(SUM(COALESCE(reward_percentage, 0.0)), 0.0),
           EXISTS (
             SELECT 1 FROM public.clan_members
             WHERE clan_id = p_clan_id AND reward_percentage < 0
           )
      INTO v_total_pct, v_has_negative
      FROM public.clan_members
     WHERE clan_id = p_clan_id;

    IF v_has_negative THEN
      RETURN jsonb_build_object('success', false, 'error', 'NEGATIVE_PERCENTAGE', 'message', 'Las cuotas configuradas no pueden contener porcentajes negativos.');
    END IF;

    IF ROUND(v_total_pct) <> 100 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_TOTAL_PERCENTAGE',
        'message', format('La suma de las cuotas configuradas debe ser exactamente 100%% (actual: %s%%). Ajusta los porcentajes antes de repartir.', ROUND(v_total_pct, 2))
      );
    END IF;
  END IF;

  -- 6. Iterar miembros y calcular su pago protegiendo estrictamente v_distributable_pool
  FOR v_member IN (
    SELECT cm.user_id,
           CASE
             WHEN v_has_configured_shares THEN COALESCE(cm.reward_percentage, 0.0)
             ELSE (100.0 / v_members_count)
           END AS percentage,
           p.username
      FROM public.clan_members cm
      JOIN public.profiles p ON p.id = cm.user_id
     WHERE cm.clan_id = p_clan_id
     ORDER BY cm.joined_at ASC
  ) LOOP
    v_member_pct := GREATEST(0.0, COALESCE(v_member.percentage, 0.0));
    IF v_member_pct > 0.0 THEN
      v_member_share := FLOOR(v_surplus * (v_member_pct / 100.0));

      -- Tope de seguridad: jamás superar el excedente real sobre 2,800 💎
      IF (v_total_distributed + v_member_share) > v_distributable_pool THEN
        v_member_share := GREATEST(0, FLOOR(v_distributable_pool - v_total_distributed));
      END IF;

      IF v_member_share > 0 THEN
        UPDATE public.profiles
           SET gems_balance = gems_balance + v_member_share,
               updated_at = NOW()
         WHERE id = v_member.user_id;

        INSERT INTO public.transactions (
          user_id, type, amount_gems, description, status, created_at
        ) VALUES (
          v_member.user_id,
          'admin_gift',
          v_member_share,
          format('Reparto de excedente del Clan %s (%s%% de %s 💎)', v_clan.name, ROUND(v_member_pct, 2), v_distributable_pool),
          'completed',
          NOW()
        );

        v_total_distributed := v_total_distributed + v_member_share;
        v_members_paid_count := v_members_paid_count + 1;

        v_payout_details := v_payout_details || jsonb_build_object(
          'user_id', v_member.user_id,
          'username', v_member.username,
          'percentage', ROUND(v_member_pct, 2),
          'gems_received', v_member_share
        );
      END IF;
    END IF;
  END LOOP;

  IF v_total_distributed <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOTHING_DISTRIBUTED', 'message', 'Las cuotas calculadas para los miembros resultan en 0 Gemas.');
  END IF;

  -- 7. Descontar las gemas repartidas del Tesoro del Clan (Reserva de 2,800 💎 intacta)
  UPDATE public.clans
     SET vault_gems = vault_gems - v_total_distributed,
         updated_at = NOW()
   WHERE id = p_clan_id;

  -- 8. Registrar en el libro contable de auditoría del clan
  INSERT INTO public.clan_audit_logs (
    clan_id, clan_name, action, performed_by, performed_by_name,
    amount_gems, amount_gold, currency, details, created_at
  ) VALUES (
    p_clan_id,
    v_clan.name,
    'SURPLUS_DISTRIBUTED',
    v_uid,
    COALESCE(v_caller_name, 'Líder'),
    v_total_distributed,
    0,
    'gems',
    jsonb_build_object(
      'surplus_pool', v_surplus,
      'total_distributed', v_total_distributed,
      'war_reserve_retained', c_WAR_RESERVE,
      'new_vault_gems', (v_clan.vault_gems - v_total_distributed),
      'members_paid_count', v_members_paid_count,
      'payouts', v_payout_details,
      'notice', 'Reparto total de excedente ejecutado por el Líder. Tesoro preservado en Reserva Operativa.'
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'surplus_distributed', v_total_distributed,
    'new_vault_gems', (v_clan.vault_gems - v_total_distributed),
    'members_paid_count', v_members_paid_count,
    'payouts', v_payout_details,
    'message', format('¡Reparto completado con éxito! Se transfirieron %s Gemas entre %s miembros. El Tesoro ahora cuenta con %s Gemas (Reserva Operativa preservada).', v_total_distributed, v_members_paid_count, (v_clan.vault_gems - v_total_distributed))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_clan_reward_shares(UUID, JSONB) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.distribute_clan_surplus_earnings(UUID) TO authenticated, service_role, postgres;

COMMIT;

NOTIFY pgrst, 'reload schema';
