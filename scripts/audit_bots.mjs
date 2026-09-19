import pg from 'pg'

const client = new pg.Client({
  connectionString: 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

await client.connect()

const r = await client.query(`
  SELECT 
    id, display_name, elo_rating,
    CASE 
      WHEN elo_rating <= 1600 THEN 'Arena 1 (0-1600)'
      WHEN elo_rating <= 2000 THEN 'Arena 2 (1601-2000)'
      WHEN elo_rating <= 3000 THEN 'Arena 3 (2001-3000)'
      WHEN elo_rating <= 4000 THEN 'Arena 4 (3001-4000)'
      ELSE 'Arena 5 (4001+)'
    END as arena,
    actions_snapshot
  FROM ranked_async_opponents
  WHERE is_active = true
  ORDER BY elo_rating ASC
`)

console.log('Total active bots:', r.rows.length)

const arenaStats = {}

for (const row of r.rows) {
  const arena = row.arena
  if (!arenaStats[arena]) {
    arenaStats[arena] = {
      count: 0,
      firstPlantSecs: [],
      firstAttackerSecs: [],
      totalPlants: [],
      avgIntervalSecs: [],
      samples: []
    }
  }
  const stats = arenaStats[arena]
  stats.count++

  const actions = row.actions_snapshot || []
  const plants = actions.filter(a => a.kind === 'plant')
  
  if (plants.length > 0) {
    const firstSec = (plants[0].tick ?? plants[0].issuedTick ?? 0) / 30.3
    const lastSec = (plants[plants.length - 1].tick ?? plants[plants.length - 1].issuedTick ?? 0) / 30.3
    stats.firstPlantSecs.push(firstSec)
    stats.totalPlants.push(plants.length)

    // Check when bot stopped planting
    stats.lastPlantSecs = stats.lastPlantSecs || []
    stats.lastPlantSecs.push(lastSec)

    // Check lane coverage of attackers
    const attackers = plants.filter(p => !['sunflower', 'wallnut', 'tallnut'].includes(p.plantId))
    const attackerLanes = new Set(attackers.map(p => p.lane))
    stats.uncoveredLanes = stats.uncoveredLanes || []
    stats.uncoveredLanes.push(3 - attackerLanes.size)

    const firstAttacker = attackers[0]
    if (firstAttacker) {
      stats.firstAttackerSecs.push((firstAttacker.tick ?? firstAttacker.issuedTick ?? 0) / 30.3)
    }

    if (plants.length > 1) {
      stats.avgIntervalSecs.push((lastSec - firstSec) / (plants.length - 1))
    }

    // Plant count buckets
    stats.under10 = stats.under10 || 0
    stats.between10and19 = stats.between10and19 || 0
    stats.between20and29 = stats.between20and29 || 0
    stats.over30 = stats.over30 || 0
    if (plants.length < 10) stats.under10++
    else if (plants.length < 20) stats.between10and19++
    else if (plants.length < 30) stats.between20and29++
    else stats.over30++

    if (stats.samples.length < 2) {
      stats.samples.push({
        name: row.display_name,
        elo: row.elo_rating,
        plants: plants.map(p => ({
          sec: Math.round(((p.tick ?? p.issuedTick ?? 0) / 30.3) * 10) / 10,
          plantId: p.plantId,
          lane: p.lane,
          col: p.col
        }))
      })
    }
  }
}

for (const [arena, s] of Object.entries(arenaStats)) {
  const avg = arr => arr && arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : 'N/A'
  console.log(`\n========================================`)
  console.log(`=== ${arena} (${s.count} bots) ===`)
  console.log(`========================================`)
  console.log(`Avg first plant: ${avg(s.firstPlantSecs)}s (min: ${Math.min(...s.firstPlantSecs).toFixed(1)}s, max: ${Math.max(...s.firstPlantSecs).toFixed(1)}s)`)
  console.log(`Avg first attacker: ${avg(s.firstAttackerSecs)}s (min: ${Math.min(...s.firstAttackerSecs).toFixed(1)}s, max: ${Math.max(...s.firstAttackerSecs).toFixed(1)}s)`)
  console.log(`Avg total plants: ${avg(s.totalPlants)}`)
  console.log(`Avg last plant time: ${avg(s.lastPlantSecs)}s (AFK for ~${(180 - avg(s.lastPlantSecs)).toFixed(1)}s)`)
  console.log(`Avg uncovered lanes (zero attackers): ${avg(s.uncoveredLanes)} / 3 lanes`)
  console.log(`Avg interval between plants: ${avg(s.avgIntervalSecs)}s`)
  console.log(`Distribution: <10 plants: ${s.under10}, 10-19: ${s.between10and19}, 20-29: ${s.between20and29}, 30+: ${s.over30}`)
}

// Check recent game_rooms outcome
const matchOutcomes = await client.query(`
  SELECT status, count(*) 
  FROM game_rooms 
  WHERE is_async_match = true 
    AND status IN ('p1_won', 'p2_won', 'draw', 'abandoned')
    AND created_at > NOW() - INTERVAL '7 days'
  GROUP BY status
`)
console.log(`\n========================================`)
console.log(`=== RECENT ASYNC MATCHES (LAST 7 DAYS) ===`)
console.log(`========================================`)
console.log(matchOutcomes.rows)

await client.end()
