import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Migración 266: Auditoría Autoritativa de Desconexión / Abandono y Restauración de Dagger22', () => {
  const migPath = join(
    process.cwd(),
    'supabase',
    'migrations',
    '266-fix-disconnection-audit-and-restore-dagger22-victories.sql'
  )

  it('1. El archivo de migración 266 existe', () => {
    expect(existsSync(migPath)).toBe(true)
  })

  it('2. enter_matchmaking premia al rival si un jugador abandona una partida PvP para emparejar de nuevo', () => {
    const content = readFileSync(migPath, 'utf8')
    expect(content).toMatch(/v_rival UUID := CASE WHEN v_room_record\.player1_id = v_uid THEN v_room_record\.player2_id ELSE v_room_record\.player1_id END/i)
    expect(content).toMatch(/PERFORM public\._settle_room\(v_room_record\.id, v_rival\)/i)
    expect(content).toMatch(/Victoria autoritativa para el rival: jugador abandonó la partida para entrar a nuevo emparejamiento/i)
  })

  it('3. _settle_if_abandoned audita match_actions y otorga la victoria al jugador activo si el rival no puso plantas', () => {
    const content = readFileSync(migPath, 'utf8')
    expect(content).toMatch(/COUNT\(\*\) FILTER \(WHERE user_id = v_room\.player1_id AND kind = 'plant'\)/i)
    expect(content).toMatch(/COUNT\(\*\) FILTER \(WHERE user_id = v_room\.player2_id AND kind = 'plant'\)/i)
    expect(content).toMatch(/IF v_p1_plants > 0 AND v_p2_plants = 0 THEN/i)
    expect(content).toMatch(/RETURN public\._settle_room\(p_room_id, v_room\.player1_id\)/i)
    expect(content).toMatch(/IF v_p2_plants > 0 AND v_p1_plants = 0 THEN/i)
    expect(content).toMatch(/RETURN public\._settle_room\(p_room_id, v_room\.player2_id\)/i)
  })

  it('4. _settle_if_abandoned audita última actividad temporal si ambos colocaron plantas pero uno se desconectó (>20s)', () => {
    const content = readFileSync(migPath, 'utf8')
    expect(content).toMatch(/v_p1_last_action > v_p2_last_action \+ INTERVAL '20 seconds'/i)
    expect(content).toMatch(/v_p2_last_action > v_p1_last_action \+ INTERVAL '20 seconds'/i)
  })

  it('5. _settle_room sincroniza ranked_player_stats para partidas Ranked', () => {
    const content = readFileSync(migPath, 'utf8')
    expect(content).toMatch(/INSERT INTO public\.ranked_player_stats \(user_id, wins, losses, draws, updated_at\)/i)
    expect(content).toMatch(/SET wins = ranked_player_stats\.wins \+ 1/i)
    expect(content).toMatch(/SET losses = ranked_player_stats\.losses \+ 1/i)
  })

  it('6. report_match_result acelera resolución por desconexión a 8s si el rival tiene 0 plantas colocadas', () => {
    const content = readFileSync(migPath, 'utf8')
    expect(content).toMatch(/v_p2_plants = 0 AND v_room\.p1_reported_at <= NOW\(\) - INTERVAL '8 seconds'/i)
    expect(content).toMatch(/v_p1_plants = 0 AND v_room\.p2_reported_at <= NOW\(\) - INTERVAL '8 seconds'/i)
  })

  it('7. La migración contiene la restauración autoritativa de las salas e87cd4f0 y bce279c6 para Dagger22', () => {
    const content = readFileSync(migPath, 'utf8')
    expect(content).toContain('e87cd4f0-de0f-454e-bc31-7723f468e97c')
    expect(content).toContain('bce279c6-8a41-4cfb-b89a-083ce538c8a6')
    expect(content).toContain('dac4e1f0-fe0e-4f29-9d92-58386f915163')
    expect(content).toMatch(/Restauración autoritativa: victoria legítima de Dagger22 por desconexión\/abandono del rival/i)
  })
})
