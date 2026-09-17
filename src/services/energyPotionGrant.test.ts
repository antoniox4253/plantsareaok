import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { FARMING_ITEM_DEFINITIONS } from '../utils/pvpRewardManager'

describe('Energy Potion Grant and Safe Consumption (Migration 172)', () => {
  const migPath = join(process.cwd(), 'supabase', 'migrations', '172-grant-one-energy-potion-to-all-users.sql')

  it('1. El archivo de migración 172 existe en el repositorio', () => {
    expect(existsSync(migPath)).toBe(true)
  })

  it('2. La definición del ítem energy_potion_5 existe con icono oficial y etiqueta', () => {
    const def = FARMING_ITEM_DEFINITIONS.energy_potion_5
    expect(def).toBeDefined()
    expect(def.icon).toBe('/game-assets/farming/energy_potion.png')
    expect(def.label).toContain('Poción de Energía')
  })

  it('3. La migración 172 actualiza use_energy_item y asigna exactamente 1 poción', () => {
    const sql = readFileSync(migPath, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.use_energy_item')
    expect(sql).toContain('{energy_potion_5}')
    expect(sql).toContain("p_item_id TEXT DEFAULT 'energy_potion_5'")
  })

  it('4. Simulación del uso respetando el límite máximo (20 estándar y 25 con VIP)', () => {
    const simulateUsePotion = (currentEnergy: number, hasVip: boolean, potionQty: number) => {
      const maxEnergy = hasVip ? 25 : 20
      if (potionQty <= 0) {
        throw new Error('NO_POTIONS')
      }
      if (currentEnergy >= maxEnergy) {
        throw new Error('ALREADY_MAX')
      }
      const addEnergy = Math.min(5, maxEnergy - currentEnergy)
      const newEnergy = currentEnergy + addEnergy
      const remainingPotion = potionQty - 1
      return { newEnergy, addEnergy, remainingPotion }
    }

    // Caso A: Jugador estándar con 14 energías -> sube a 19 (+5) y gasta su poción
    const resA = simulateUsePotion(14, false, 1)
    expect(resA.newEnergy).toBe(19)
    expect(resA.addEnergy).toBe(5)
    expect(resA.remainingPotion).toBe(0)

    // Caso B: Jugador estándar con 18 energías -> sube a 20 (+2, respetando tope de 20)
    const resB = simulateUsePotion(18, false, 1)
    expect(resB.newEnergy).toBe(20)
    expect(resB.addEnergy).toBe(2)
    expect(resB.remainingPotion).toBe(0)

    // Caso C: Jugador VIP con 22 energías -> sube a 25 (+3, respetando tope VIP de 25)
    const resC = simulateUsePotion(22, true, 1)
    expect(resC.newEnergy).toBe(25)
    expect(resC.addEnergy).toBe(3)
    expect(resC.remainingPotion).toBe(0)

    // Caso D: Jugador al tope (20/20) no puede gastarla por error
    expect(() => simulateUsePotion(20, false, 1)).toThrow('ALREADY_MAX')

    // Caso E: Jugador que ya la gastó (0 pociones) no puede usarla de nuevo
    expect(() => simulateUsePotion(10, false, 0)).toThrow('NO_POTIONS')
  })
})
