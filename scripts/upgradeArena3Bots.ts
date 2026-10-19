import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateDenseBotPlan } from '../src/engine/denseBotPlanGenerator.ts'
import type { CartaDeMazo } from '../src/engine/mazoDeLaSala.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let connectionString = process.env.DATABASE_URL
if (!connectionString) {
  const envPath = path.resolve(__dirname, '../.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/)
    if (match) connectionString = match[1]
  }
}
if (!connectionString) {
  connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
}

// 5 Arquetipos de Élite para Arena 3 (ELO 2001 - 3000)
// Siguen estrictamente:
// 1. Cero Papa Mina ('squash')
// 2. Girasoles de economía
// 3. Núcleo mixto: Lanzaguisantes ('peashooter') + Lanzamaíz ('kernelpult')
// 4. Muro sólido Wall-nut ('wallnut')
// 5. Spam de Squash ('garlic', Aplastador)
// 6. Progresión con Chile Fantasma ('ghostpepper'), Nuez Explosiva ('explodeonut') y Hielaguisantes ('snowpea')
const ARENA_3_ARCHETYPES: CartaDeMazo[][] = [
  // Arquetipo 0: Dúo Mixto Lanzaguisantes + Lanzamaíz + Wall-nut + Squash + Chile Fantasma
  [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 3, plantId: 'peashooter', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 3, plantId: 'kernelpult', statRolls: ['damage', 'attackSpeed'] },
    { slot: 3, level: 3, plantId: 'wallnut', statRolls: ['hp'] },
    { slot: 4, level: 3, plantId: 'garlic', statRolls: ['damage', 'hp'] },
    { slot: 5, level: 3, plantId: 'ghostpepper', statRolls: ['damage'] },
  ],
  // Arquetipo 1: Control de Hielo con Hielaguisantes + Lanzamaíz + Wall-nut + Squash + Jalapeño
  [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 3, plantId: 'snowpea', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 3, plantId: 'kernelpult', statRolls: ['damage', 'cooldown'] },
    { slot: 3, level: 3, plantId: 'wallnut', statRolls: ['hp'] },
    { slot: 4, level: 3, plantId: 'garlic', statRolls: ['damage', 'attackSpeed'] },
    { slot: 5, level: 3, plantId: 'jalapeno', statRolls: ['damage'] },
  ],
  // Arquetipo 2: Defensa Explosiva Nuez Explosiva + Lanzamaíz + Peashooter + Squash + Bonk Choy
  [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 3, plantId: 'peashooter', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 3, plantId: 'kernelpult', statRolls: ['damage', 'attackSpeed'] },
    { slot: 3, level: 3, plantId: 'explodeonut', statRolls: ['hp'] },
    { slot: 4, level: 3, plantId: 'garlic', statRolls: ['damage', 'hp'] },
    { slot: 5, level: 3, plantId: 'bonkchoy', statRolls: ['damage', 'attackSpeed'] },
  ],
  // Arquetipo 3: Doble Defensa Wall-nut + Nuez Explosiva + Lanzamaíz + Peashooter + Squash
  [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 3, plantId: 'kernelpult', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 3, plantId: 'peashooter', statRolls: ['damage'] },
    { slot: 3, level: 3, plantId: 'wallnut', statRolls: ['hp'] },
    { slot: 4, level: 3, plantId: 'garlic', statRolls: ['damage', 'cooldown'] },
    { slot: 5, level: 3, plantId: 'explodeonut', statRolls: ['hp', 'damage'] },
  ],
  // Arquetipo 4: Asedio Rápido con Chile Fantasma + Hielaguisantes + Lanzamaíz + Wall-nut + Squash
  [
    { slot: 0, level: 3, plantId: 'sunflower', statRolls: ['hp'] },
    { slot: 1, level: 3, plantId: 'snowpea', statRolls: ['damage', 'attackSpeed'] },
    { slot: 2, level: 3, plantId: 'kernelpult', statRolls: ['damage', 'attackSpeed'] },
    { slot: 3, level: 3, plantId: 'wallnut', statRolls: ['hp'] },
    { slot: 4, level: 3, plantId: 'garlic', statRolls: ['damage', 'attackSpeed'] },
    { slot: 5, level: 3, plantId: 'ghostpepper', statRolls: ['damage', 'attackSpeed'] },
  ],
]

async function run() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('✅ Conectado a Supabase PostgreSQL')

    // 1. Obtener todos los bots de Arena 3 (ELO 2001 - 3000)
    const arena3Res = await client.query(`
      SELECT id, display_name, elo_rating, deck_snapshot
      FROM ranked_async_opponents
      WHERE elo_rating BETWEEN 2001 AND 3000
      ORDER BY elo_rating ASC;
    `)

    console.log(`\n🎯 Procesando ${arena3Res.rows.length} bots de Arena 3 (ELO 2001-3000)...`)

    let arena3Updated = 0
    for (let i = 0; i < arena3Res.rows.length; i++) {
      const row = arena3Res.rows[i]
      const archIndex = i % ARENA_3_ARCHETYPES.length
      const deckTemplate = ARENA_3_ARCHETYPES[archIndex]

      // Ajustar nivel según ELO específico dentro de Arena 3 (2001-3000)
      const baseLevel = row.elo_rating >= 2800 ? 4 : row.elo_rating >= 2400 ? 3 : 2
      const deck: CartaDeMazo[] = deckTemplate.map((c, slot) => ({
        ...c,
        slot,
        level: Math.max(1, baseLevel + (slot === 0 ? 0 : slot % 2 === 0 ? 1 : 0)),
      }))

      // Generar plan denso táctico de 0 drops
      const plan = generateDenseBotPlan(deck)

      await client.query(
        `UPDATE ranked_async_opponents
         SET deck_snapshot = $1::jsonb,
             actions_snapshot = $2::jsonb,
             updated_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(deck), JSON.stringify(plan), row.id]
      )
      arena3Updated++
    }
    console.log(`✅ ${arena3Updated} bots de Arena 3 actualizados con éxito con los nuevos arquetipos tácticos.`)

    // 2. Limpiar CUALQUIER otro bot en cualquier ELO que aún tenga 'squash' (Papa Mina)
    const otherSquashRes = await client.query(`
      SELECT id, display_name, elo_rating, deck_snapshot
      FROM ranked_async_opponents
      WHERE deck_snapshot::text LIKE '%"plantId": "squash"%'
         OR deck_snapshot::text LIKE '%"plantId":"squash"%';
    `)

    console.log(`\n🔍 Buscando otros bots con Papa Mina ('squash') fuera de Arena 3... Encontrados: ${otherSquashRes.rows.length}`)

    let othersUpdated = 0
    for (const row of otherSquashRes.rows) {
      let deck: CartaDeMazo[] = row.deck_snapshot
      if (typeof deck === 'string') deck = JSON.parse(deck)

      // Reemplazar 'squash' por 'kernelpult' (Lanzamaíz) o 'garlic' (Squash Aplastador)
      deck = deck.map((c) => {
        if (c.plantId === 'squash') {
          const hasKernel = deck.some((x) => x.plantId === 'kernelpult')
          const replacementId = hasKernel ? 'garlic' : 'kernelpult'
          return {
            ...c,
            plantId: replacementId,
          }
        }
        return c
      })

      const plan = generateDenseBotPlan(deck)

      await client.query(
        `UPDATE ranked_async_opponents
         SET deck_snapshot = $1::jsonb,
             actions_snapshot = $2::jsonb,
             updated_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(deck), JSON.stringify(plan), row.id]
      )
      othersUpdated++
    }

    console.log(`✅ ${othersUpdated} bots adicionales limpiados de Papa Mina y actualizados con nuevos planes.`)

    // 3. Verificación final en BD
    const checkSquash = await client.query(`
      SELECT count(*) as remaining_squash
      FROM ranked_async_opponents
      WHERE deck_snapshot::text LIKE '%"plantId": "squash"%'
         OR deck_snapshot::text LIKE '%"plantId":"squash"%';
    `)
    console.log(`\n🎉 Verificación Final: Bots restantes con Papa Mina ('squash') = ${checkSquash.rows[0].remaining_squash}`)

    // 4. Muestra de un bot de Arena 3
    const sample = await client.query(`
      SELECT display_name, elo_rating, jsonb_pretty(deck_snapshot) as deck, jsonb_array_length(actions_snapshot) as actions
      FROM ranked_async_opponents
      WHERE elo_rating BETWEEN 2001 AND 3000
      LIMIT 1;
    `)
    console.log('\nEjemplo de bot de Arena 3 actualizado:')
    console.log(`Bot: ${sample.rows[0].display_name} (ELO: ${sample.rows[0].elo_rating}), Acciones en plan: ${sample.rows[0].actions}`)
    console.log(`Mazo:\n${sample.rows[0].deck}`)

  } catch (err) {
    console.error('❌ Error actualizando bots:', err)
  } finally {
    await client.end()
  }
}

run()
