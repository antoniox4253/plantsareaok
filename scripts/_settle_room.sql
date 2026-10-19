CREATE OR REPLACE FUNCTION public._settle_room(p_room_id uuid, p_winner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room                 RECORD;
  v_escrow_rec           RECORD;
  v_pozo                 NUMERIC(10,2) := 0;
  v_loser_id             UUID;
  v_p1                   UUID;
  v_p2                   UUID;
  v_perdedor             UUID;
  v_elo_p1_before        INTEGER := 1000;
  v_elo_p2_before        INTEGER := 1000;
  v_delta_p1             INTEGER := 0;
  v_delta_p2             INTEGER := 0;
  v_elo_p1_after         INTEGER := 1000;
  v_elo_p2_after         INTEGER := 1000;
  v_cofre                JSONB   := NULL;
  v_vip_gold             INTEGER := 0;
  v_audit_elo            JSONB   := NULL;
  v_tourn_id             UUID;
  v_max_losses           INTEGER := 3;
  v_winner_name          TEXT;
  v_loser_name           TEXT;
  v_loser_losses         INTEGER;
  v_loser_eliminated     BOOLEAN;
  v_daily_matches        INTEGER := 0;
  v_streak_wins          INTEGER := 0;
  v_total_transferred    NUMERIC := 0;
  v_fast_matches         INTEGER := 0;
  v_match_duration       NUMERIC := 0;
  v_plants_count         INTEGER := 0;
  v_is_early_surrender   BOOLEAN := FALSE;
  v_verification_note    TEXT;
  v_winner_vip           BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala no encontrada: %', p_room_id; END IF;

  IF v_room.is_async_match = TRUE THEN
    RAISE EXCEPTION 'ASYNC_SETTLEMENT_REQUIRED: Las salas asíncronas deben liquidarse mediante settle_verified_async_ranked_match';
  END IF;

  IF v_room.status IN ('p1_won', 'p2_won', 'draw', 'abandoned', 'cancelled') AND v_room.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'status', 'ya_liquidada', 'winner', v_room.server_winner_id);
  END IF;

  IF p_winner_id IS NOT NULL AND p_winner_id NOT IN (v_room.player1_id, v_room.player2_id) THEN
    RAISE EXCEPTION 'Ganador inválido para la sala: %', p_winner_id;
  END IF;

  v_p1 := v_room.player1_id;
  v_p2 := v_room.player2_id;

  -- ── 1. MODO TORNEO ──────────────────────────────────────────────────────────
  IF v_room.mode = 'tournament' THEN
    IF p_winner_id IS NULL THEN
      UPDATE public.game_rooms
         SET status = 'draw',
             settled_at = NOW(),
             server_winner_id = NULL,
             verification_status = 'verified',
             verification_note = 'Empate de torneo verificado'
       WHERE id = p_room_id;
      RETURN jsonb_build_object('success', TRUE, 'status', 'empate', 'mode', 'tournament', 'eloGained', 0, 'eloLost', 0, 'payout', 0);
    END IF;

    v_perdedor := CASE WHEN p_winner_id = v_room.player1_id THEN v_room.player2_id ELSE v_room.player1_id END;

    v_tourn_id := v_room.tournament_id;
    IF v_tourn_id IS NULL THEN
      SELECT tournament_id INTO v_tourn_id
        FROM public.matchmaking_queue
       WHERE matched_room_id = p_room_id
       LIMIT 1;
    END IF;
    IF v_tourn_id IS NULL THEN
      SELECT id INTO v_tourn_id
        FROM public.tournaments
       WHERE status = 'live'
       ORDER BY created_at DESC
       LIMIT 1;
    END IF;

    IF v_tourn_id IS NOT NULL AND p_winner_id IS NOT NULL THEN
      SELECT COALESCE(max_losses, 3) INTO v_max_losses 
        FROM public.tournaments WHERE id = v_tourn_id;
      v_max_losses := COALESCE(v_max_losses, 3);

      UPDATE public.tournament_participants
         SET wins = wins + 1,
             updated_at = NOW()
       WHERE tournament_id = v_tourn_id AND user_id = p_winner_id;

      IF v_perdedor IS NOT NULL THEN
        UPDATE public.tournament_participants
           SET losses = losses + 1,
               is_eliminated = (losses + 1 >= v_max_losses),
               updated_at = NOW()
         WHERE tournament_id = v_tourn_id AND user_id = v_perdedor
         RETURNING losses, is_eliminated INTO v_loser_losses, v_loser_eliminated;
      END IF;

      SELECT username INTO v_winner_name FROM public.profiles WHERE id = p_winner_id;
      SELECT username INTO v_loser_name FROM public.profiles WHERE id = v_perdedor;

      IF NOT EXISTS (SELECT 1 FROM public.tournament_matches WHERE room_id = p_room_id AND player_id = p_winner_id) THEN
        INSERT INTO public.tournament_matches (
          tournament_id, player_id, opponent_name, result, player_deck, room_id
        ) VALUES (
          v_tourn_id, p_winner_id,
          COALESCE(v_loser_name, 'Rival de Torneo'),
          'victory',
          COALESCE((SELECT deck FROM public.tournament_participants WHERE tournament_id = v_tourn_id AND user_id = p_winner_id), '[]'::jsonb),
          p_room_id
        );
      END IF;

      IF v_perdedor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tournament_matches WHERE room_id = p_room_id AND player_id = v_perdedor) THEN
        INSERT INTO public.tournament_matches (
          tournament_id, player_id, opponent_name, result, player_deck, room_id
        ) VALUES (
          v_tourn_id, v_perdedor,
          COALESCE(v_winner_name, 'Rival de Torneo'),
          'defeat',
          COALESCE((SELECT deck FROM public.tournament_participants WHERE tournament_id = v_tourn_id AND user_id = v_perdedor), '[]'::jsonb),
          p_room_id
        );
      END IF;
    END IF;

    UPDATE public.game_rooms
       SET status = CASE 
                      WHEN p_winner_id = player1_id THEN 'p1_won'
                      ELSE 'p2_won' 
                    END,
           settled_at = NOW(),
           server_winner_id = p_winner_id,
           verification_status = 'verified',
           verification_note = COALESCE(verification_note, 'Consenso mutuo verificado (Torneo)')
     WHERE id = p_room_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'liquidada',
      'winner', p_winner_id,
      'mode', 'tournament',
      'eloGained', 0,
      'eloLost', 0,
      'payout', 0
    );
  END IF;

  -- ── 2. MODO RANKED ──────────────────────────────────────────────────────────
  IF v_room.mode = 'ranked' THEN
    v_perdedor := CASE WHEN p_winner_id = v_room.player1_id THEN v_room.player2_id ELSE v_room.player1_id END;

    IF v_room.created_at IS NOT NULL THEN
      v_match_duration := EXTRACT(EPOCH FROM (NOW() - v_room.created_at));
    ELSE
      v_match_duration := 60;
    END IF;

    SELECT COUNT(*) INTO v_plants_count 
      FROM public.match_actions 
     WHERE room_id = p_room_id;

    IF p_winner_id IS NOT NULL AND v_perdedor IS NOT NULL THEN
      SELECT COUNT(*) INTO v_daily_matches
        FROM public.game_rooms
       WHERE mode = 'ranked'
         AND ((player1_id = v_p1 AND player2_id = v_p2) OR (player1_id = v_p2 AND player2_id = v_p1))
         AND settled_at > NOW() - INTERVAL '24 hours';

      SELECT COUNT(*) INTO v_streak_wins
        FROM public.game_rooms
       WHERE mode = 'ranked'
         AND server_winner_id = p_winner_id
         AND ((player1_id = v_p1 AND player2_id = v_p2) OR (player1_id = v_p2 AND player2_id = v_p1))
         AND settled_at > NOW() - INTERVAL '24 hours';

      SELECT COUNT(*) INTO v_fast_matches
        FROM public.game_rooms
       WHERE mode = 'ranked'
         AND ((player1_id = v_p1 AND player2_id = v_p2) OR (player1_id = v_p2 AND player2_id = v_p1))
         AND settled_at > NOW() - INTERVAL '24 hours'
         AND EXTRACT(EPOCH FROM (settled_at - created_at)) < 30;

      IF v_fast_matches >= 3 OR v_streak_wins >= 6 OR (v_daily_matches >= 8 AND v_streak_wins >= 7) THEN
        UPDATE public.profiles
           SET is_banned = true,
               ban_reason = format('Árbitro Antifraude: Win-Trading y colusión sistemática en PvP Ranked entre %s y %s', v_p1, v_p2),
               exclude_from_ranking = true,
               updated_at = NOW()
         WHERE id IN (v_p1, v_p2);

        INSERT INTO public.security_fraud_incidents (
          user_id, counterparty_id, incident_type, action_taken, description, payload, created_at
        ) VALUES (
          p_winner_id, v_perdedor, 'wintrading_ranked_autoban', 'auto_ban',
          format('Árbitro: Auto-ban aplicado por Win-Trading en Ranked (%s partidas sospechosas en 24h)', v_fast_matches + 1),
          jsonb_build_object('winner_id', p_winner_id, 'loser_id', v_perdedor, 'duration', v_match_duration, 'plants', v_plants_count, 'streak', v_streak_wins + 1),
          NOW()
        );

        UPDATE public.game_rooms
           SET status = 'cancelled',
               settled_at = NOW(),
               verification_status = 'failed',
               verification_note = 'Partida cancelada por árbitro antifraude (Win-Trading detectado)'
         WHERE id = p_room_id;

        RAISE EXCEPTION 'ALERTA DE SEGURIDAD DEL ÁRBITRO: Colusión y Win-Trading detectado en Ranked. Ambas cuentas han sido suspendidas automáticamente.';
      END IF;

      IF v_match_duration < 20 OR v_plants_count < 2 THEN
        v_is_early_surrender := TRUE;
      ELSE
        v_is_early_surrender := FALSE;
      END IF;
    END IF;

    -- Lectura determinista de ELO
    IF v_room.player1_id < v_room.player2_id THEN
      SELECT elo_rating INTO v_elo_p1_before FROM public.profiles WHERE id = v_room.player1_id FOR UPDATE;
      IF v_room.player2_id IS NOT NULL THEN
        SELECT elo_rating INTO v_elo_p2_before FROM public.profiles WHERE id = v_room.player2_id FOR UPDATE;
      END IF;
    ELSE
      IF v_room.player2_id IS NOT NULL THEN
        SELECT elo_rating INTO v_elo_p2_before FROM public.profiles WHERE id = v_room.player2_id FOR UPDATE;
      END IF;
      SELECT elo_rating INTO v_elo_p1_before FROM public.profiles WHERE id = v_room.player1_id FOR UPDATE;
    END IF;

    v_elo_p1_before := COALESCE(v_elo_p1_before, 1000);
    v_elo_p2_before := COALESCE(v_elo_p2_before, 1000);

    v_delta_p1 := CASE WHEN p_winner_id = v_room.player1_id THEN public._ranked_elo_delta(v_elo_p1_before, v_elo_p2_before, 1.0) ELSE public._ranked_elo_delta(v_elo_p1_before, v_elo_p2_before, 0.0) END;
    v_delta_p2 := CASE WHEN p_winner_id = v_room.player2_id THEN public._ranked_elo_delta(v_elo_p2_before, v_elo_p1_before, 1.0) ELSE public._ranked_elo_delta(v_elo_p2_before, v_elo_p1_before, 0.0) END;

    IF v_is_early_surrender THEN
      IF p_winner_id = v_room.player1_id THEN
        v_delta_p1 := 0;
      ELSE
        v_delta_p2 := 0;
      END IF;

      -- Restaurar 1 energía al ganador legítimo
      IF p_winner_id IS NOT NULL THEN
        SELECT COALESCE(has_vip_pass, FALSE) INTO v_winner_vip FROM public.profiles WHERE id = p_winner_id;
        UPDATE public.profiles
           SET energy_current = LEAST(CASE WHEN v_winner_vip THEN 25 ELSE 20 END, COALESCE(energy_current, 0) + 1),
               updated_at = NOW()
         WHERE id = p_winner_id;

        INSERT INTO public.transactions (user_id, type, amount_gems, amount_gold, description, status)
        VALUES (p_winner_id, 'energy_refund', 0, 0, 'Restauración de 1 energía por abandono temprano del rival (<20s)', 'completed');
      END IF;
    END IF;

    v_elo_p1_after := GREATEST(0, v_elo_p1_before + v_delta_p1);
    v_elo_p2_after := GREATEST(0, v_elo_p2_before + v_delta_p2);

    UPDATE public.profiles
       SET elo_rating = v_elo_p1_after, updated_at = NOW()
     WHERE id = v_room.player1_id;

    IF v_room.player2_id IS NOT NULL THEN
      UPDATE public.profiles
         SET elo_rating = v_elo_p2_after, updated_at = NOW()
       WHERE id = v_room.player2_id;
    END IF;

    -- Estadísticas oficiales
    IF p_winner_id IS NOT NULL THEN
      INSERT INTO public.ranked_player_stats (user_id, wins, losses, draws, updated_at)
      VALUES (p_winner_id, 1, 0, 0, NOW())
      ON CONFLICT (user_id) DO UPDATE
         SET wins = ranked_player_stats.wins + 1,
             updated_at = NOW();
    END IF;

    IF v_perdedor IS NOT NULL THEN
      INSERT INTO public.ranked_player_stats (user_id, wins, losses, draws, updated_at)
      VALUES (v_perdedor, 0, 1, 0, NOW())
      ON CONFLICT (user_id) DO UPDATE
         SET losses = ranked_player_stats.losses + 1,
             updated_at = NOW();
    END IF;

    -- Asignación de Sobre de Victoria PvP
    BEGIN
      IF p_winner_id IS NOT NULL AND NOT v_is_early_surrender THEN
        SELECT public._award_victory_chest_for(p_winner_id) INTO v_cofre;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_cofre := NULL;
    END;

    -- Bono VIP de Oro por Victoria
    BEGIN
      IF p_winner_id IS NOT NULL AND NOT v_is_early_surrender THEN
        SELECT public._award_vip_victory_gold(p_winner_id) INTO v_vip_gold;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_vip_gold := 0;
    END;

    -- Otorgar +25 XP para el Pase de Batalla (para todos los jugadores)
    IF p_winner_id IS NOT NULL AND NOT v_is_early_surrender THEN
      PERFORM public._award_battle_pass_xp(p_winner_id, 25, 'ranked_win');
    END IF;

    v_audit_elo := jsonb_build_object(
      'p1Before', v_elo_p1_before, 'p1After', v_elo_p1_after, 'p1Delta', v_delta_p1,
      'p2Before', v_elo_p2_before, 'p2After', v_elo_p2_after, 'p2Delta', v_delta_p2,
      'isEarlySurrender', v_is_early_surrender
    );

    IF v_is_early_surrender THEN
      v_verification_note := 'Victoria por abandono - No se asignaron copas ni se descontó energía';
    ELSIF v_room.verification_note ILIKE '%surrender%' THEN
      v_verification_note := 'Victoria por rendición del rival confirmada';
    ELSE
      v_verification_note := COALESCE(v_room.verification_note, 'Consenso mutuo verificado');
    END IF;

    UPDATE public.game_rooms
       SET status = CASE WHEN p_winner_id = player1_id THEN 'p1_won' ELSE 'p2_won' END,
           settled_at = NOW(),
           server_winner_id = p_winner_id,
           verification_status = 'verified',
           verification_note = v_verification_note,
           verification_payload = COALESCE(verification_payload, '{}'::JSONB) || jsonb_build_object(
             'elo', v_audit_elo,
             'vipGoldBonus', v_vip_gold,
             'chest', v_cofre,
             'bpXpGained', CASE WHEN NOT v_is_early_surrender THEN 25 ELSE 0 END,
             'earlySurrender', v_is_early_surrender,
             'energyRestored', v_is_early_surrender
           )
     WHERE id = p_room_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'liquidada',
      'winner', p_winner_id,
      'mode', 'ranked',
      'eloGained', CASE WHEN p_winner_id = v_room.player1_id THEN v_delta_p1 ELSE v_delta_p2 END,
      'eloLost', CASE WHEN p_winner_id = v_room.player1_id THEN ABS(v_delta_p2) ELSE ABS(v_delta_p1) END,
      'eloAfter', CASE WHEN p_winner_id = v_room.player1_id THEN v_elo_p1_after ELSE v_elo_p2_after END,
      'eloDelta', CASE WHEN p_winner_id = v_room.player1_id THEN v_delta_p1 ELSE v_delta_p2 END,
      'rawElo', v_audit_elo,
      'chest', v_cofre,
      'vipGoldBonus', v_vip_gold,
      'bpXpGained', CASE WHEN NOT v_is_early_surrender THEN 25 ELSE 0 END,
      'earlySurrender', v_is_early_surrender,
      'energyRestored', v_is_early_surrender,
      'message', v_verification_note
    );
  END IF;

  -- ── 3. DUELOS AMISTOSOS ───────────────────────────────────────────────────
  IF v_room.mode = 'friendly' THEN
    IF p_winner_id IS NULL THEN
      FOR v_escrow_rec IN
        SELECT id, user_id, bet_gems FROM public.colosseum_escrow
         WHERE room_id = p_room_id AND status = 'held'
      LOOP
        UPDATE public.profiles
           SET gems_balance = gems_balance + v_escrow_rec.bet_gems
         WHERE id = v_escrow_rec.user_id;

        INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
        VALUES (v_escrow_rec.user_id, 'colosseum_refund', v_escrow_rec.bet_gems,
                'Duelo amistoso en empate (apuesta devuelta)', 'completed');
      END LOOP;

      UPDATE public.colosseum_escrow
         SET status = 'refunded'
       WHERE room_id = p_room_id AND status = 'held';

      UPDATE public.game_rooms
         SET status = 'draw',
             settled_at = NOW(),
             server_winner_id = NULL
       WHERE id = p_room_id;

      RETURN jsonb_build_object('success', TRUE, 'status', 'empate', 'mode', 'friendly', 'refunded', TRUE);
    END IF;

    SELECT COALESCE(SUM(bet_gems), 0) INTO v_pozo
      FROM public.colosseum_escrow
     WHERE room_id = p_room_id AND status = 'held';

    IF v_pozo > 0 THEN
      UPDATE public.profiles
         SET gems_balance = gems_balance + v_pozo
       WHERE id = p_winner_id;

      INSERT INTO public.transactions (user_id, type, amount_gems, description, status)
      VALUES (p_winner_id, 'colosseum_win', v_pozo,
              format('Premio de duelo amistoso (Pozo: %s Gemas)', v_pozo), 'completed');

      UPDATE public.colosseum_escrow
         SET status = 'released',
             settled_at = NOW()
       WHERE room_id = p_room_id AND status = 'held';
    END IF;

    UPDATE public.game_rooms
       SET status = CASE WHEN p_winner_id = player1_id THEN 'p1_won' ELSE 'p2_won' END,
           settled_at = NOW(),
           server_winner_id = p_winner_id,
           verification_status = 'verified'
     WHERE id = p_room_id;

    RETURN jsonb_build_object('success', TRUE, 'status', 'liquidada', 'winner', p_winner_id, 'mode', 'friendly', 'payout', v_pozo);
  END IF;

  RETURN jsonb_build_object('success', FALSE, 'error', 'Modo de sala no soportado');
END;
$function$
