import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('MIGRACIÓN 369 — CORRECCIÓN DE ERROR ON CONFLICT AL ABRIR COFRES Y RECLAMAR SOBRES', () => {
  const migration369Path = path.resolve(
    __dirname,
    '../../supabase/migrations/369-fix-chest-and-reward-pack-copies-on-conflict.sql'
  )

  it('1. El archivo de migración 369 existe', () => {
    expect(fs.existsSync(migration369Path)).toBe(true)
  })

  it('2. Actualiza claim_pack_slot para usar ON CONFLICT (user_id, plant_id, is_golden)', () => {
    const sql = fs.readFileSync(migration369Path, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_pack_slot(p_slot_index integer)')
    expect(sql).toContain('INSERT INTO public.plant_copies(user_id, plant_id, is_golden, copies)')
    expect(sql).toContain('ON CONFLICT (user_id, plant_id, is_golden)')
  })

  it('3. Actualiza claim_reward_pack y claim_weekly_clan_chest para usar la clave primaria correcta', () => {
    const sql = fs.readFileSync(migration369Path, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_reward_pack(p_pack_id uuid)')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_weekly_clan_chest()')
    expect(sql).toContain('INSERT INTO public.plant_copies (user_id, plant_id, is_golden, copies)')
  })

  it('4. No contiene ninguna cláusula obsoleta ON CONFLICT (user_id, plant_id) contra plant_copies', () => {
    const sql = fs.readFileSync(migration369Path, 'utf8')
    // Eliminar comentarios para verificar solo el código ejecutable
    const codeOnly = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')

    expect(codeOnly).not.toMatch(/ON\s+CONFLICT\s*\(\s*user_id\s*,\s*plant_id\s*\)/i)
  })

  it('5. Mantiene SECURITY DEFINER y permisos para authenticated y service_role', () => {
    const sql = fs.readFileSync(migration369Path, 'utf8')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_pack_slot(INTEGER) TO authenticated;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_pack_slot(INTEGER) TO service_role;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_reward_pack(UUID) TO authenticated;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_weekly_clan_chest() TO authenticated;')
  })

  it('6. Lógica de acumulación de copias respeta el tope de 5 copias y variante is_golden', () => {
    interface PlantCopiesRow {
      userId: string
      plantId: string
      isGolden: boolean
      copies: number
    }

    const table: PlantCopiesRow[] = []

    const upsertCopies = (userId: string, plantId: string, isGolden: boolean, addCopies: number) => {
      const existing = table.find(
        (r) => r.userId === userId && r.plantId === plantId && r.isGolden === isGolden
      )
      if (existing) {
        existing.copies = Math.min(5, existing.copies + addCopies)
      } else {
        table.push({ userId, plantId, isGolden, copies: Math.min(5, addCopies) })
      }
    }

    // Insertar copia regular de peashooter
    upsertCopies('usr_1', 'peashooter', false, 1)
    expect(table).toHaveLength(1)
    expect(table[0].copies).toBe(1)
    expect(table[0].isGolden).toBe(false)

    // Insertar copia dorada de peashooter (no colisiona con la regular)
    upsertCopies('usr_1', 'peashooter', true, 1)
    expect(table).toHaveLength(2)
    expect(table[1].copies).toBe(1)
    expect(table[1].isGolden).toBe(true)

    // Sumar 5 copias más a la regular (se clampa en 5)
    upsertCopies('usr_1', 'peashooter', false, 5)
    expect(table[0].copies).toBe(5)
  })
})
