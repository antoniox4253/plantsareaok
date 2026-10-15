import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  PVP_ALLOWED_COMMON_PLANTS,
  PVP_ALLOWED_UNCOMMON_PLANTS,
  PVP_ALLOWED_PLANTS,
  FORBIDDEN_PVP_PLANTS,
  isAllowedPvpPlant,
  type PvpRewardDrop,
} from '../utils/pvpRewardManager'
import type { PlantId } from '../types/game'

/**
 * Emula la función PL/pgSQL claim_pack_slot de la Migración 77.
 */
function simulateClaimPackSlotDrop(rollPlant: number, rollRarity: number, rollIndex: number): {
  plantId?: PlantId
  rarity?: 'common' | 'uncommon'
  isPlant: boolean
} {
  const isPlant = rollPlant < 0.75 // probabilidad máxima (sobre de 6h)
  if (!isPlant) {
    return { isPlant: false }
  }

  let pool: PlantId[]
  let rarity: 'common' | 'uncommon'
  if (rollRarity < 0.70) {
    pool = [...PVP_ALLOWED_COMMON_PLANTS]
    rarity = 'common'
  } else {
    pool = [...PVP_ALLOWED_UNCOMMON_PLANTS]
    rarity = 'uncommon'
  }

  const plantId = pool[Math.floor(rollIndex * pool.length)]

  // Guarda idéntica al SQL
  if (FORBIDDEN_PVP_PLANTS.includes(plantId)) {
    throw new Error(`ILLEGAL_PVP_PACK_PLANT: ${plantId}`)
  }

  return { isPlant: true, plantId, rarity }
}

describe('MIGRACIÓN 77 & 327 & SEGURIDAD PVP — EXCLUSIÓN ESTRICTA DE PICKLED PEPPER, EXPLODE-O-NUT Y JALAPEÑO', () => {
  const migration77Path = path.resolve(
    __dirname,
    '../../supabase/migrations/77-pvp-packs-strictly-no-rare-cards.sql'
  )
  const migration327Path = path.resolve(
    __dirname,
    '../../supabase/migrations/327-pvp-packs-strictly-exclude-pickled-pepper-explodeonut-jalapeno.sql'
  )

  it('1. Los archivos de migración 77 y 327 existen y son legibles', () => {
    expect(fs.existsSync(migration77Path)).toBe(true)
    expect(fs.existsSync(migration327Path)).toBe(true)
  })

  it('2. claim_pack_slot y claim_reward_pack definen SECURITY DEFINER y permisos revocados de anon', () => {
    const sql = fs.readFileSync(migration327Path, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_pack_slot(p_slot_index INTEGER)')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_reward_pack(p_pack_id UUID)')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.claim_pack_slot(INTEGER) FROM anon;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_pack_slot(INTEGER) TO authenticated;')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.claim_reward_pack(UUID) FROM anon;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_reward_pack(UUID) TO authenticated;')
  })

  it('3. Ambos procedimientos PL/pgSQL contienen la guarda de seguridad ILLEGAL_PVP_PACK_PLANT con pickledpepper, explodeonut y jalapeno', () => {
    const sql = fs.readFileSync(migration327Path, 'utf8')
    expect(sql).toContain('pickledpepper')
    expect(sql).toContain('explodeonut')
    expect(sql).toContain('jalapeno')
    expect(sql).toContain("RAISE EXCEPTION 'ILLEGAL_PVP_PACK_PLANT: %', v_plant_id;")
  })

  it('4. Las listas de cartas permitidas en el SQL solo incluyen Comunes (4) y Poco Comunes (6 con snowpea)', () => {
    const sql = fs.readFileSync(migration327Path, 'utf8')
    // Comunes
    expect(sql).toContain("ARRAY['sunflower', 'peashooter', 'wallnut', 'chomper']")
    // Poco comunes
    expect(sql).toContain("ARRAY['garlic', 'bonkchoy', 'repeater', 'melonpult', 'squash', 'snowpea']")
    // Ninguna tabla de rareza rara, épica o legendaria como pool
    expect(sql).not.toContain("ARRAY['twinsunflower', 'jalapeno']")
    expect(sql).not.toContain("ARRAY['pickledpepper', 'explodeonut']")
  })

  it('5. Validación estricta en TypeScript: isAllowedPvpPlant prohíbe Pickled Pepper, Explode-o-nut, Jalapeño y todas las raras/épicas/legendarias', () => {
    // Excluidas expresamente por orden del usuario
    expect(isAllowedPvpPlant('pickledpepper')).toBe(false)
    expect(isAllowedPvpPlant('explodeonut')).toBe(false)
    expect(isAllowedPvpPlant('jalapeno')).toBe(false)

    // Otras raras / épicas / legendarias excluidas
    expect(isAllowedPvpPlant('twinsunflower')).toBe(false)
    expect(isAllowedPvpPlant('kernelpult')).toBe(false)
    expect(isAllowedPvpPlant('aloe')).toBe(false)
    expect(isAllowedPvpPlant('tallnut')).toBe(false)
    expect(isAllowedPvpPlant('gatlingpea')).toBe(false)
    expect(isAllowedPvpPlant('iceberglettuce')).toBe(false)
    expect(isAllowedPvpPlant('threepeater')).toBe(false)

    // FORBIDDEN_PVP_PLANTS debe incluirlas expresamente
    expect(FORBIDDEN_PVP_PLANTS).toContain('pickledpepper')
    expect(FORBIDDEN_PVP_PLANTS).toContain('explodeonut')
    expect(FORBIDDEN_PVP_PLANTS).toContain('jalapeno')

    // Las 10 plantas oficiales PvP deben ser permitidas (4 comunes + 6 poco comunes)
    expect(isAllowedPvpPlant('sunflower')).toBe(true)
    expect(isAllowedPvpPlant('peashooter')).toBe(true)
    expect(isAllowedPvpPlant('wallnut')).toBe(true)
    expect(isAllowedPvpPlant('chomper')).toBe(true)
    expect(isAllowedPvpPlant('garlic')).toBe(true)
    expect(isAllowedPvpPlant('bonkchoy')).toBe(true)
    expect(isAllowedPvpPlant('repeater')).toBe(true)
    expect(isAllowedPvpPlant('melonpult')).toBe(true)
    expect(isAllowedPvpPlant('squash')).toBe(true)
    expect(isAllowedPvpPlant('snowpea')).toBe(true)
  })

  it('6. Simulación estadística de 10,000 tiradas: CERO Pickled Peppers, CERO Nuez Explosiva, CERO Jalapeños', () => {
    const rolledPlants = new Map<PlantId, number>()
    let forbiddenCount = 0

    for (let i = 0; i < 10000; i++) {
      const rollPlant = Math.random()
      const rollRarity = Math.random()
      const rollIndex = Math.random()

      const res = simulateClaimPackSlotDrop(rollPlant, rollRarity, rollIndex)
      if (res.isPlant && res.plantId) {
        if (FORBIDDEN_PVP_PLANTS.includes(res.plantId)) {
          forbiddenCount++
        }
        rolledPlants.set(res.plantId, (rolledPlants.get(res.plantId) || 0) + 1)
      }
    }

    expect(forbiddenCount).toBe(0)
    expect(rolledPlants.has('pickledpepper')).toBe(false)
    expect(rolledPlants.has('explodeonut')).toBe(false)
    expect(rolledPlants.has('jalapeno')).toBe(false)
    expect(rolledPlants.has('twinsunflower')).toBe(false)
    expect(rolledPlants.has('aloe')).toBe(false)
    expect(rolledPlants.has('tallnut')).toBe(false)
    expect(rolledPlants.has('iceberglettuce')).toBe(false)
    expect(rolledPlants.has('threepeater')).toBe(false)

    // Comprobar que todas las permitidas pueden salir
    PVP_ALLOWED_PLANTS.forEach((plantId) => {
      expect((rolledPlants.get(plantId) || 0)).toBeGreaterThan(0)
    })
  })

  it('7. Filtro de seguridad en cliente elimina cualquier drop ilegal recibido por error', () => {
    const mockServerResponseDrops: PvpRewardDrop[] = [
      { type: 'plant', plantId: 'peashooter', rarity: 'common', isNew: false, quantity: 1 },
      { type: 'plant', plantId: 'pickledpepper' as any, rarity: 'uncommon' as any, isNew: true, quantity: 1 },
      { type: 'plant', plantId: 'explodeonut' as any, rarity: 'uncommon' as any, isNew: true, quantity: 1 },
      { type: 'plant', plantId: 'jalapeno' as any, rarity: 'uncommon' as any, isNew: true, quantity: 1 },
      { type: 'gold', quantity: 30 },
    ]

    const sanitizedDrops = mockServerResponseDrops.filter((d) => {
      if (d.type === 'plant') {
        return isAllowedPvpPlant(d.plantId)
      }
      return true
    })

    expect(sanitizedDrops.length).toBe(2)
    expect(sanitizedDrops.some((d) => d.type === 'plant' && d.plantId === 'pickledpepper')).toBe(false)
    expect(sanitizedDrops.some((d) => d.type === 'plant' && d.plantId === 'explodeonut')).toBe(false)
    expect(sanitizedDrops.some((d) => d.type === 'plant' && d.plantId === 'jalapeno')).toBe(false)
    expect(sanitizedDrops.some((d) => d.type === 'plant' && d.plantId === 'peashooter')).toBe(true)
    expect(sanitizedDrops.some((d) => d.type === 'gold' && d.quantity === 30)).toBe(true)
  })
})
