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
})
