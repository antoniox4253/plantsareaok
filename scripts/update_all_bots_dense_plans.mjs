import pg from 'pg'
import { generateDenseBotPlan } from '../src/engine/denseBotPlanGenerator.ts'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const APPLY = process.argv.includes('--apply')
console.log(`=== MODO: ${APPLY ? 'APLICAR EN PRODUCCIÓN' : 'DRY-RUN (Simulación)'} ===\n`)

const res = await client.query(`
  SELECT id, display_name, elo_rating, deck_snapshot, jsonb_array_length(actions_snapshot) as old_count
  FROM ranked_async_opponents
  ORDER BY elo_rating ASC;
`)

console.log(`Total de bots en ranked_async_opponents: ${res.rows.length}\n`)

let totalUpdated = 0
let planCache = new Map()

for (const bot of res.rows) {
  const deckKey = JSON.stringify(bot.deck_snapshot)
  let plan = planCache.get(deckKey)
  if (!plan) {
    plan = generateDenseBotPlan(bot.deck_snapshot)
    planCache.set(deckKey, plan)
  }

  if (APPLY) {
    await client.query(`
      UPDATE ranked_async_opponents
      SET actions_snapshot = $1::jsonb, updated_at = NOW()
      WHERE id = $2;
    `, [JSON.stringify(plan), bot.id])
  }
  totalUpdated++
}

console.log(`\nProcesados: ${totalUpdated} bots.`)
if (!APPLY) {
  console.log(`Simulación exitosa. Para aplicar los cambios en la base de datos ejecuta: node scripts/update_all_bots_dense_plans.mjs --apply`)
} else {
  console.log(`✅ ¡Todos los ${totalUpdated} bots fueron actualizados en la base de datos con planes densos multicarril!`)
}

await client.end()
