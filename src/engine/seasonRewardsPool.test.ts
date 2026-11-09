import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { getRankReward } from '../components/Ranking/Ranking'

describe('Distribución de Recompensas de Temporada Ranked (Top 50)', () => {
  it('1. Distribución de Gemas y Plantas Doradas en el Top 5', () => {
    const top1 = getRankReward(1)
    const top2 = getRankReward(2)
    const top3 = getRankReward(3)
    const top4 = getRankReward(4)
    const top5 = getRankReward(5)

    expect(top1).not.toBeNull()
    expect(top2).not.toBeNull()
    expect(top3).not.toBeNull()
    expect(top4).not.toBeNull()
    expect(top5).not.toBeNull()

    expect(top1!.gems).toBe(5000)
    expect(top2!.gems).toBe(3500)
    expect(top3!.gems).toBe(2500)
    expect(top4!.gems).toBe(1800)
    expect(top5!.gems).toBe(1800)

    // Top 1 al 5 no reciben oro (solo gemas, pack y planta dorada)
    expect(top1!.gold).toBe(0)
    expect(top2!.gold).toBe(0)
    expect(top3!.gold).toBe(0)
    expect(top4!.gold).toBe(0)
    expect(top5!.gold).toBe(0)

    // Todos en el Top 5 reciben Planta Dorada
    expect(top1!.goldenPlant).toBeDefined()
    expect(top2!.goldenPlant).toBeDefined()
    expect(top3!.goldenPlant).toBeDefined()
    expect(top4!.goldenPlant).toBeDefined()
    expect(top5!.goldenPlant).toBeDefined()
  })

  it('2. Verificación de sobres, gemas y oro por escalafón del Top 50', () => {
    const top1 = getRankReward(1)!
    expect(top1.pack).toContain('Legendario')
    expect(top1.fullText).toContain('5,000 Gemas')
    expect(top1.fullText).toContain('Planta Dorada')

    const top2 = getRankReward(2)!
    expect(top2.pack).toContain('Legendario')
    expect(top2.fullText).toContain('3,500 Gemas')

    const top3 = getRankReward(3)!
    expect(top3.pack).toContain('Legendario')
    expect(top3.fullText).toContain('2,500 Gemas')

    const top4 = getRankReward(4)!
    expect(top4.pack).toContain('Épico')
    expect(top4.fullText).toContain('1,800 Gemas')

    const top5 = getRankReward(5)!
    expect(top5.pack).toContain('Épico')
    expect(top5.fullText).toContain('1,800 Gemas')

    // Rango 6 al 10: 1,200 gemas, 1x Pack Épico, Dorada Común, 0 oro
    for (let r = 6; r <= 10; r++) {
      const rew = getRankReward(r)!
      expect(rew.gems).toBe(1200)
      expect(rew.pack).toContain('Épico')
      expect(rew.goldenPlant).toContain('Dorada Común')
      expect(rew.gold).toBe(0)
    }

    // Rango 11 al 20: 800 gemas, 1x Pack Básico, 3,000 oro, sin dorada
    for (let r = 11; r <= 20; r++) {
      const rew = getRankReward(r)!
      expect(rew.gems).toBe(800)
      expect(rew.pack).toContain('Básico')
      expect(rew.gold).toBe(3000)
      expect(rew.goldenPlant).toBeNull()
    }

    // Rango 21 al 35: 500 gemas, 1x Pack Básico, 2,000 oro
    for (let r = 21; r <= 35; r++) {
      const rew = getRankReward(r)!
      expect(rew.gems).toBe(500)
      expect(rew.pack).toContain('Básico')
      expect(rew.gold).toBe(2000)
      expect(rew.goldenPlant).toBeNull()
    }

    // Rango 36 al 50: 400 gemas de piso, 1x Pack Básico, 1,000 oro
    for (let r = 36; r <= 50; r++) {
      const rew = getRankReward(r)!
      expect(rew.gems).toBe(400)
      expect(rew.pack).toContain('Básico')
      expect(rew.gold).toBe(1000)
      expect(rew.goldenPlant).toBeNull()
    }

    // Rango > 50: sin recompensas
    expect(getRankReward(51)).toBeNull()
  })

  describe('3. Auditoría Estática de Migración 91 (Backend Authoritative Settlement)', () => {
    const migPath = path.resolve(__dirname, '../../supabase/migrations/91-settle-season-rewards-100-usd-pool.sql')
    const sql = fs.readFileSync(migPath, 'utf8')

    it('A. Define la función settle_season_rewards con SECURITY DEFINER y chequeo de permisos de administrador', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.settle_season_rewards')
      expect(sql).toContain('SECURITY DEFINER')
      expect(sql).toContain('UNAUTHORIZED_ADMIN_ONLY')
    })

    it('B. Distribuye los valores canónicos exactos de gemas al Top 5 (4000, 2500, 1500, 1200, 800)', () => {
      expect(sql).toContain('v_gems := 4000')
      expect(sql).toContain('v_gems := 2500')
      expect(sql).toContain('v_gems := 1500')
      expect(sql).toContain('v_gems := 1200')
      expect(sql).toContain('v_gems := 800')
    })

    it('C. Otorga sobres en player_packs y registra auditoría en transactions con amount_usd', () => {
      expect(sql).toContain('INSERT INTO public.player_packs')
      expect(sql).toContain('legendary')
      expect(sql).toContain('epic')
      expect(sql).toContain('basic')
      expect(sql).toContain('INSERT INTO public.transactions')
      expect(sql).toContain('season_reward')
    })

    it('D. Finaliza la temporada en public.seasons marcándola finished y cerrando is_current = FALSE', () => {
      expect(sql).toContain("status = 'finished'")
      expect(sql).toContain('is_current = FALSE')
      expect(sql).toContain('top1_elo_reward = 4000')
      expect(sql).toContain('top2_elo_reward = 2500')
      expect(sql).toContain('top3_elo_reward = 1500')
    })
  })

  describe('4. Auditoría Estática de Migración 409 (Auto-Settle y Rollover Continuo)', () => {
    const migPath = path.resolve(__dirname, '../../supabase/migrations/409-auto-settle-season-rewards-and-rollover.sql')
    const sql = fs.readFileSync(migPath, 'utf8')

    it('A. Define auto_settle_expired_season y settle_season_rewards con rollover automático', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.settle_season_rewards')
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.auto_settle_expired_season')
      expect(sql).toContain('SECURITY DEFINER')
    })

    it('B. Crea automáticamente la siguiente temporada con 25 días de duración', () => {
      expect(sql).toContain("v_next_num := COALESCE(v_season.season_number, 2) + 1")
      expect(sql).toContain("INTERVAL '25 days'")
      expect(sql).toContain("INSERT INTO public.seasons")
      expect(sql).toContain("is_current")
    })

    it('C. Configura el job cron para auto-liquidación periódica en pg_cron', () => {
      expect(sql).toContain("cron.schedule")
      expect(sql).toContain("auto_settle_season_job")
      expect(sql).toContain("SELECT public.auto_settle_expired_season()")
    })
  })

  describe('5. Auditoría Estática de Migración 410 (Reinicio de VIPs, Soft Reset de Copas y Corrección AQP)', () => {
    const migPath = path.resolve(__dirname, '../../supabase/migrations/410-reset-vips-and-season-cups.sql')
    const sql = fs.readFileSync(migPath, 'utf8')

    it('A. Corrige el dominio de AQP Game Fest a aqpgamefest.com', () => {
      expect(sql).toContain('aqpgamefest.com')
      expect(sql).toContain('replace(replace(content')
    })

    it('B. Define reset_all_season_vips para limpiar pases VIP y XP', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.reset_all_season_vips()')
      expect(sql).toContain('has_vip_pass = FALSE')
      expect(sql).toContain('claimed_vip_levels = \'{}\'::INTEGER[]')
      expect(sql).toContain('battle_pass_xp = 0')
    })

    it('C. Define soft_reset_season_cups para desplazar Arena 4/5 a Arena 3 y Arena 3 a Arena 2 proporcionalmente', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.soft_reset_season_cups()')
      expect(sql).toContain('WHEN elo_rating > 3000')
      expect(sql).toContain('WHEN elo_rating >= 2001 AND elo_rating <= 3000')
      expect(sql).toContain('2001')
      expect(sql).toContain('1601')
    })
  })

  describe('6. Auditoría Estática de Migración 411 (Ajuste Oficial Temporada 2 Top 50 con Plantas Doradas)', () => {
    const migPath = path.resolve(__dirname, '../../supabase/migrations/411-settle-season-2-golden-plants-and-top-50-adjustments.sql')
    const sql = fs.readFileSync(migPath, 'utf8')

    it('A. Asigna Plantas Doradas de Élite al Top 1 al 5 y Comunes al Top 6 al 10', () => {
      expect(sql).toContain('v_elite_pool')
      expect(sql).toContain('v_common_pool')
      expect(sql).toContain('is_golden')
      expect(sql).toContain('plant_instances')
    })

    it('B. Acredita las diferencias canónicas de gemas y oro a los 50 ganadores de la Temporada 2', () => {
      expect(sql).toContain('season_reward')
      expect(sql).toContain('gems_balance')
      expect(sql).toContain('gold_balance')
    })

    it('C. Actualiza settle_season_rewards para automatizar la tabla completa del Top 50 en temporadas futuras', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.settle_season_rewards')
      expect(sql).toContain('LIMIT 50')
      expect(sql).toContain('top1_elo_reward = 5000')
      expect(sql).toContain('top2_elo_reward = 3500')
      expect(sql).toContain('top3_elo_reward = 2500')
    })
  })

  describe('7. Auditoría Estática de Migración 412 (Re-roll Canónico de Plantas Doradas con Assets)', () => {
    const migPath = path.resolve(__dirname, '../../supabase/migrations/412-reroll-season-2-golden-plants-with-official-assets.sql')
    const sql = fs.readFileSync(migPath, 'utf8')

    it('A. Reemplaza plantas sin asset por las 10 doradas oficiales y protege al Top 1 sin hielo', () => {
      expect(sql).toContain("plant_id = 'melonpult'")
      expect(sql).toContain("plant_id = 'iceberglettuce'")
      expect(sql).toContain("plant_id = 'bonkchoy'")
      expect(sql).toContain("plant_id = 'repeater'")
      expect(sql).toContain("plant_id = 'peashooter'")
      expect(sql).toContain("plant_id = 'sunflower'")
    })

    it('B. Blindar pools canónicos en settle_season_rewards con sólo las 10 plantas con WebP', () => {
      expect(sql).toContain("c_elite_pool          TEXT[] := ARRAY['melonpult', 'bonkchoy', 'twinsunflower', 'repeater', 'garlic', 'jalapeno', 'iceberglettuce']")
      expect(sql).toContain("c_common_pool         TEXT[] := ARRAY['peashooter', 'sunflower', 'wallnut']")
    })
  })

  describe('8. Auditoría Estática de Migración 413 (Nuevo Espectro de Arenas Temporada 3+)', () => {
    const migPath = path.resolve(__dirname, '../../supabase/migrations/413-calibrate-arena-spectrum-season3.sql')
    const sql = fs.readFileSync(migPath, 'utf8')

    it('A. Calibra los nuevos umbrales de arenas en _award_victory_chest_for (8001, 5001, 3001, 1601)', () => {
      expect(sql).toContain('WHEN v_elo >= 8001 THEN 5')
      expect(sql).toContain('WHEN v_elo >= 5001 THEN 4')
      expect(sql).toContain('WHEN v_elo >= 3001 THEN 3')
      expect(sql).toContain('WHEN v_elo >= 1601 THEN 2')
    })

    it('B. Calibra los deltas de copas en _ranked_elo_delta según el nuevo espectro', () => {
      expect(sql).toContain('ELSIF v_p <= 3000 THEN')
      expect(sql).toContain('ELSIF v_p <= 5000 THEN')
      expect(sql).toContain('ELSIF v_p <= 8000 THEN')
      expect(sql).toContain('v_win_delta  := 30')
    })

    it('C. Aplica el blindaje de matchmaking de arenas altas y bajas en _emparejar_lote', () => {
      expect(sql).toContain('v_fila.user_elo > 8000 AND q.user_elo > 8000')
      expect(sql).toContain('v_fila.user_elo BETWEEN 5001 AND 8000')
      expect(sql).toContain('NOT (v_fila.user_elo <= 1600 AND q.user_elo > 3000)')
    })
  })
})
