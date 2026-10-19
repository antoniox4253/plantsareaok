CREATE OR REPLACE FUNCTION public.settle_verified_match_authoritative(p_room_id uuid, p_winner_id uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room             RECORD;
  v_res              JSONB;
  v_real_winner_id   UUID := p_winner_id;
  v_reason           TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Sólo service_role';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala no encontrada'; END IF;
  IF v_room.engine_version NOT IN ('auth-v1', 'auth-v2') THEN RAISE EXCEPTION 'Sala no autoritativa'; END IF;

  IF v_room.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'ya_liquidada',
      'winner', v_room.server_winner_id
    );
  END IF;

  IF v_room.verification_status <> 'verifying' THEN
    RAISE EXCEPTION 'La sala no está en verificación';
  END IF;

  v_reason := p_payload->>'reason';

  IF v_reason = 'forfeit_p1' AND v_room.p1_reported_winner = v_room.player1_id AND v_room.p2_reported_winner IS NULL THEN
    v_real_winner_id := v_room.player1_id;
  ELSIF v_reason = 'forfeit_p2' AND v_room.p2_reported_winner = v_room.player2_id AND v_room.p1_reported_winner IS NULL THEN
    v_real_winner_id := v_room.player2_id;
  END IF;

  UPDATE public.game_rooms
     SET verification_status  = 'verified',
         verified_at          = NOW(),
         server_winner_id     = v_real_winner_id,
         verification_note    = CASE 
           WHEN v_real_winner_id <> p_winner_id THEN 'server_verified_anti_desync_override'
           ELSE 'server_verified'
         END,
         verification_payload = COALESCE(p_payload, '{}'::JSONB) || jsonb_build_object(
           'realWinnerId', v_real_winner_id,
           'overriddenForfeit', (v_real_winner_id <> p_winner_id)
         )
   WHERE id = p_room_id;

  v_res := public._settle_room(p_room_id, v_real_winner_id);

  RETURN v_res || jsonb_build_object('authoritative', TRUE, 'winner', v_real_winner_id);
END;
$function$
