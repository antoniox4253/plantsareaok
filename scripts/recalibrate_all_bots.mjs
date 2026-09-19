import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { arenaArchetypes, buildDeterministicArenaPlan } from './generate_competitive_bot_plans.mjs'

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

console.log('1. Generating all verified bot plans...')
const verifiedArchetypes = {}
for (const [key, deck] of Object.entries(arenaArchetypes)) {
  const res = buildDeterministicArenaPlan(deck)
  if (res.stats.intentionsDropped > 0) {
    throw new Error(`FATAL: ${key} has ${res.stats.intentionsDropped} dropped intentions!`)
  }
  verifiedArchetypes[key] = {
    deck: res.deck,
    plan: res.plan,
    plants: res.plan.length,
    firstPlant: (res.plan[0].issuedTick / 30.3).toFixed(1) + 's',
    lastPlant: (res.plan[res.plan.length - 1].issuedTick / 30.3).toFixed(1) + 's',
  }
  console.log(`  ✓ ${key}: ${res.plan.length} plants, 0 dropped, ${verifiedArchetypes[key].firstPlant} to ${verifiedArchetypes[key].lastPlant}`)
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

console.log('\n2. Fetching all bot records from database...')
const res = await client.query(`
  SELECT id, display_name, rating_snapshot, elo_rating
  FROM public.ranked_async_opponents
  ORDER BY id ASC;
`)
const allBots = res.rows
console.log(`Found ${allBots.length} bot records in public.ranked_async_opponents.`)

// Identify legendary Arena 5 bots by name
const legendaryA5Names = new Set([
  'Dios Primordial',
  'Rey del Olimpo',
  'Soberano Astral',
  'Señor del Eclipse',
  'Valkiria Solar',
  'Furia Estelar',
  'Oráculo del Cosmos',
  'Guardián Celestial',
  'Centinela Estelar',
  'Titán Cósmico'
])

const a5LegendaryBots = allBots.filter(b => legendaryA5Names.has(b.display_name))
const regularBots = allBots.filter(b => !legendaryA5Names.has(b.display_name))

console.log(`Legendary Arena 5 bots: ${a5LegendaryBots.length}, Other bots: ${regularBots.length}`)

// Target quotas:
// Arena 5: ~25 total bots (legendary + 15 high-tier)
// Arena 4: 100 bots (ELO 3001 - 4000)
// Arena 3: 150 bots (ELO 2001 - 3000)
// Arena 2: 150 bots (ELO 1601 - 2000)
// Arena 1: remaining (~516 bots, ELO 500 - 1600)

const a5Extra = regularBots.slice(0, 15)
const a4Bots = regularBots.slice(15, 115)
const a3Bots = regularBots.slice(115, 265)
const a2Bots = regularBots.slice(265, 415)
const a1Bots = regularBots.slice(415)

console.log(`\nPartitioning plan:`)
console.log(`  Arena 5: ${a5LegendaryBots.length + a5Extra.length} bots (ELO 4200 - 8600)`)
console.log(`  Arena 4: ${a4Bots.length} bots (ELO 3001 - 4000)`)
console.log(`  Arena 3: ${a3Bots.length} bots (ELO 2001 - 3000)`)
console.log(`  Arena 2: ${a2Bots.length} bots (ELO 1601 - 2000)`)
console.log(`  Arena 1: ${a1Bots.length} bots (ELO 500 - 1600)`)

const legendaryEloMap = {
  'Dios Primordial': 8600,
  'Rey del Olimpo': 7800,
  'Soberano Astral': 7000,
  'Señor del Eclipse': 6262,
  'Valkiria Solar': 6232,
  'Furia Estelar': 6200,
  'Oráculo del Cosmos': 6166,
  'Guardián Celestial': 5500,
  'Centinela Estelar': 4895,
  'Titán Cósmico': 4800,
}

const legendaryArchetypeMap = {
  'Dios Primordial': 'arena5_devastation',
  'Rey del Olimpo': 'arena5_devastation',
  'Soberano Astral': 'arena5_freeze',
  'Señor del Eclipse': 'arena5_devastation',
  'Valkiria Solar': 'arena5_firestorm',
  'Furia Estelar': 'arena5_firestorm',
  'Oráculo del Cosmos': 'arena5_devastation',
  'Guardián Celestial': 'arena5_freeze',
  'Centinela Estelar': 'arena5_firestorm',
  'Titán Cósmico': 'arena5_devastation',
}

const a5ArchetypePool = ['arena5_devastation', 'arena5_firestorm', 'arena5_freeze']
const a4ArchetypePool = ['arena4_artillery', 'arena4_inferno']
const a3ArchetypePool = ['arena3_repeater_siege', 'arena3_artillery']
const a2ArchetypePool = ['arena2_boxer', 'arena2_repeater']
const a1ArchetypePool = ['arena1_swarm', 'arena1_tactical', 'arena1_brawler']

console.log('\n3. Starting database update transaction...')
await client.query('BEGIN;')

try {
  // A. Legendary Arena 5 bots
  for (const bot of a5LegendaryBots) {
    const elo = legendaryEloMap[bot.display_name] || 5000
    const archKey = legendaryArchetypeMap[bot.display_name] || 'arena5_devastation'
    const arch = verifiedArchetypes[archKey]
    await client.query(`
      UPDATE public.ranked_async_opponents
         SET rating_snapshot = $1,
             elo_rating = $1,
             elo = $1,
             deck_snapshot = $2,
             actions_snapshot = $3,
             active = TRUE,
             is_active = TRUE,
             updated_at = NOW()
       WHERE id = $4;
    `, [elo, JSON.stringify(arch.deck), JSON.stringify(arch.plan), bot.id])
  }

  // B. Extra Arena 5 bots
  for (let i = 0; i < a5Extra.length; i++) {
    const bot = a5Extra[i]
    const elo = 4200 + Math.floor((i / a5Extra.length) * 1800) // 4200 - 6000
    const archKey = a5ArchetypePool[i % a5ArchetypePool.length]
    const arch = verifiedArchetypes[archKey]
    await client.query(`
      UPDATE public.ranked_async_opponents
         SET rating_snapshot = $1,
             elo_rating = $1,
             elo = $1,
             deck_snapshot = $2,
             actions_snapshot = $3,
             active = TRUE,
             is_active = TRUE,
             updated_at = NOW()
       WHERE id = $4;
    `, [elo, JSON.stringify(arch.deck), JSON.stringify(arch.plan), bot.id])
  }

  // C. Arena 4 bots (3001 - 4000)
  for (let i = 0; i < a4Bots.length; i++) {
    const bot = a4Bots[i]
    const elo = 3010 + Math.floor((i / a4Bots.length) * 980) // 3010 - 3990
    const archKey = a4ArchetypePool[i % a4ArchetypePool.length]
    const arch = verifiedArchetypes[archKey]
    await client.query(`
      UPDATE public.ranked_async_opponents
         SET rating_snapshot = $1,
             elo_rating = $1,
             elo = $1,
             deck_snapshot = $2,
             actions_snapshot = $3,
             active = TRUE,
             is_active = TRUE,
             updated_at = NOW()
       WHERE id = $4;
    `, [elo, JSON.stringify(arch.deck), JSON.stringify(arch.plan), bot.id])
  }

  // D. Arena 3 bots (2001 - 3000)
  for (let i = 0; i < a3Bots.length; i++) {
    const bot = a3Bots[i]
    const elo = 2010 + Math.floor((i / a3Bots.length) * 980) // 2010 - 2990
    const archKey = a3ArchetypePool[i % a3ArchetypePool.length]
    const arch = verifiedArchetypes[archKey]
    await client.query(`
      UPDATE public.ranked_async_opponents
         SET rating_snapshot = $1,
             elo_rating = $1,
             elo = $1,
             deck_snapshot = $2,
             actions_snapshot = $3,
             active = TRUE,
             is_active = TRUE,
             updated_at = NOW()
       WHERE id = $4;
    `, [elo, JSON.stringify(arch.deck), JSON.stringify(arch.plan), bot.id])
  }

  // E. Arena 2 bots (1601 - 2000)
  for (let i = 0; i < a2Bots.length; i++) {
    const bot = a2Bots[i]
    const elo = 1610 + Math.floor((i / a2Bots.length) * 380) // 1610 - 1990
    const archKey = a2ArchetypePool[i % a2ArchetypePool.length]
    const arch = verifiedArchetypes[archKey]
    await client.query(`
      UPDATE public.ranked_async_opponents
         SET rating_snapshot = $1,
             elo_rating = $1,
             elo = $1,
             deck_snapshot = $2,
             actions_snapshot = $3,
             active = TRUE,
             is_active = TRUE,
             updated_at = NOW()
       WHERE id = $4;
    `, [elo, JSON.stringify(arch.deck), JSON.stringify(arch.plan), bot.id])
  }

  // F. Arena 1 bots (500 - 1600)
  for (let i = 0; i < a1Bots.length; i++) {
    const bot = a1Bots[i]
    const elo = 500 + Math.floor((i / a1Bots.length) * 1090) // 500 - 1590
    const archKey = a1ArchetypePool[i % a1ArchetypePool.length]
    const arch = verifiedArchetypes[archKey]
    await client.query(`
      UPDATE public.ranked_async_opponents
         SET rating_snapshot = $1,
             elo_rating = $1,
             elo = $1,
             deck_snapshot = $2,
             actions_snapshot = $3,
             active = TRUE,
             is_active = TRUE,
             updated_at = NOW()
       WHERE id = $4;
    `, [elo, JSON.stringify(arch.deck), JSON.stringify(arch.plan), bot.id])
  }

  await client.query('COMMIT;')
  console.log('✅ All 931 bots successfully recalibrated and committed in database!')
} catch (err) {
  await client.query('ROLLBACK;')
  console.error('❌ Error during update, rolled back:', err)
  process.exit(1)
} finally {
  await client.end()
}
