import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Sistema Integral de Misiones, Concurso TikTok, Racha y Fiebre de Oro (Migración 175)', () => {
  const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/175-social-missions-login-streaks-and-gold-rush.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  it('1. Define las 3 tablas estructurales con RLS y claves primarias/foráneas', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.social_video_submissions')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.player_login_streaks')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.player_daily_missions')

    expect(sql).toContain('ALTER TABLE public.social_video_submissions ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE public.player_login_streaks ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE public.player_daily_missions ENABLE ROW LEVEL SECURITY')
  })

  it('2. La Regla de Oro: Protege la tesorería de $350 USD acreditando gemas en locked_gems_balance', () => {
    // Recompensa TikTok de 100 gemas
    expect(sql).toContain('gems_balance = COALESCE(gems_balance, 0) + 100')
    expect(sql).toContain('locked_gems_balance = COALESCE(locked_gems_balance, 0) + 100')

    // Recompensa de misión diaria de 1 gema
    expect(sql).toContain('gems_balance = COALESCE(gems_balance, 0) + v_reward_gems')
    expect(sql).toContain('locked_gems_balance = COALESCE(locked_gems_balance, 0) + v_reward_gems')

    // Cofre semanal de plata (20 gemas)
    expect(sql).toContain('gems_balance = COALESCE(gems_balance, 0) + v_gems')
    expect(sql).toContain('locked_gems_balance = COALESCE(locked_gems_balance, 0) + v_gems')
  })

  it('3. Concurso TikTok: Controla estrictamente el cupo máximo de 50 creadores con premio', () => {
    expect(sql).toContain('SELECT COUNT(*) INTO v_approved_count')
    expect(sql).toContain("FROM public.social_video_submissions")
    expect(sql).toContain("WHERE status = 'approved' AND reward_gems > 0")
    expect(sql).toContain('IF v_approved_count < 50 THEN')
    expect(sql).toContain('v_award_gems := 100;')
    expect(sql).toContain('ELSE')
    expect(sql).toContain('v_award_gems := 0;')
  })

  it('4. Fecha límite de envío del concurso de TikTok fijada al 26 de septiembre 23:00 UTC', () => {
    expect(sql).toContain("'2026-09-26 23:00:00+00'::TIMESTAMPTZ")
    expect(sql).toContain('IF NOW() > v_deadline THEN')
    expect(sql).toContain('El plazo de envío para el concurso cerró el 26 de septiembre a las 23:00 UTC.')
  })

  it('5. Cofres Semanales: Umbrales y premios calibrados con exactitud', () => {
    // Bronce: 70 pts -> 150 Oro + 1 Sobre Básico
    expect(sql).toContain('v_req_points := 70;')
    expect(sql).toContain('v_gold := 150;')
    expect(sql).toContain("v_pack_id := 'basic';")

    // Plata: 140 pts -> 400 Oro + 20 Gemas + energy_potion_5
    expect(sql).toContain('v_req_points := 140;')
    expect(sql).toContain('v_gold := 400;')
    expect(sql).toContain('v_gems := 20;')
    expect(sql).toContain("v_item_id := 'energy_potion_5';")

    // Oro: 210 pts -> Sobre Épico exclusivo (sin gemas ni oro sueltos)
    expect(sql).toContain('v_req_points := 210;')
    expect(sql).toContain("v_pack_id := 'epic';")
  })

  it('6. Racha de Conexión de 7 Días: Recompensas en orden ascendente y reinicio por inasistencia', () => {
    expect(sql).toContain("v_next_streak := (v_s_row.current_streak % 7) + 1;")
    expect(sql).toContain('WHEN 1 THEN')
    expect(sql).toContain('v_gold := 50;')
    expect(sql).toContain('WHEN 2 THEN')
    expect(sql).toContain("v_item_id := 'energy_potion_5'; v_item_count := 1;")
    expect(sql).toContain('WHEN 3 THEN')
    expect(sql).toContain("v_pack_id := 'basic';")
    expect(sql).toContain('WHEN 4 THEN')
    expect(sql).toContain('v_gold := 120;')
    expect(sql).toContain('WHEN 5 THEN')
    expect(sql).toContain("v_item_id := 'energy_potion_5'; v_item_count := 2;")
    expect(sql).toContain('WHEN 6 THEN')
    expect(sql).toContain('v_gold := 250;')
    expect(sql).toContain('WHEN 7 THEN')
    expect(sql).toContain("v_pack_id := 'basic';")
  })

  it('7. Fiebre de Oro de los Sábados: Multiplicador x2 para VIP y oro por victoria para no-VIP', () => {
    expect(sql).toContain("v_is_saturday := (EXTRACT(DOW FROM NOW() AT TIME ZONE 'UTC') = 6);")
    expect(sql).toContain('v_options := ARRAY[10, 20, 30];')
    expect(sql).toContain("v_desc := 'Fiebre de Oro VIP (Sábado x2): +' || v_gold_bonus || ' Oro';")
    expect(sql).toContain('v_options := ARRAY[5, 10];')
    expect(sql).toContain("v_desc := 'Fiebre de Oro (Sábado): +' || v_gold_bonus || ' Oro';")
  })

  it('8. Reroll de Misión Diaria: Consume 5 Gemas con prioridad en saldo bloqueado (spend_user_gems)', () => {
    expect(sql).toContain('public.spend_user_gems(5.0)')
    expect(sql).toContain("'mission_reroll', -5, 0")
  })
})
