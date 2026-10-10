import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const res = await client.query(`
  SELECT 
    r.id,
    r.mode,
    r.is_async_match,
    r.created_at,
    r.settled_at,
    r.player1_id,
    p1.username as p1_username,
    p1.elo_rating as p1_current_elo,
    r.player2_id,
    p2.username as p2_username,
    p2.elo_rating as p2_current_elo,
    r.status,
    r.verification_status,
    r.server_winner_id,
    r.verification_note,
    r.p1_reported_winner,
    r.p2_reported_winner,
    (SELECT COUNT(*) FROM match_actions WHERE room_id = r.id) as actions_count
  FROM game_rooms r
  LEFT JOIN profiles p1 ON p1.id = r.player1_id
  LEFT JOIN profiles p2 ON p2.id = r.player2_id
  WHERE r.mode = 'ranked'
    AND r.created_at >= '2026-10-10 00:00:00Z'
  ORDER BY r.created_at ASC;
`)

console.log(`Total Ranked rooms created on 2026-10-10: ${res.rows.length}\n`)

const affectedRooms = []
const playerStats = {}

for (const row of res.rows) {
  // Check if match was properly settled with ELO and winner
  const isSettledOk = (row.status === 'p1_won' || row.status === 'p2_won') && row.verification_status === 'verified' && row.server_winner_id !== null
  
  if (!isSettledOk) {
    affectedRooms.push(row)
    
    // Track affected players
    const p1 = row.p1_username || row.player1_id
    const p2 = row.p2_username || row.player2_id || '(Async bot)'
    
    if (row.player1_id) {
      playerStats[p1] = playerStats[p1] || { id: row.player1_id, totalAffected: 0, reportsWon: 0, consensusWon: 0 }
      playerStats[p1].totalAffected++
      if (row.p1_reported_winner === row.player1_id) playerStats[p1].reportsWon++
      if (row.p1_reported_winner === row.player1_id && row.p2_reported_winner === row.player1_id) playerStats[p1].consensusWon++
    }
    
    if (row.player2_id) {
      playerStats[p2] = playerStats[p2] || { id: row.player2_id, totalAffected: 0, reportsWon: 0, consensusWon: 0 }
      playerStats[p2].totalAffected++
      if (row.p2_reported_winner === row.player2_id) playerStats[p2].reportsWon++
      if (row.p1_reported_winner === row.player2_id && row.p2_reported_winner === row.player2_id) playerStats[p2].consensusWon++
    }
  }
}

console.log(`=== PARTIDAS AFECTADAS (TOTAL: ${affectedRooms.length}) ===`)
for (const r of affectedRooms) {
  const p1 = r.p1_username
  const p2 = r.p2_username || (r.is_async_match ? 'Async Opponent' : 'N/A')
  const winnerReported = 
    r.p1_reported_winner && r.p1_reported_winner === r.p2_reported_winner
      ? (r.p1_reported_winner === r.player1_id ? `${p1} (CONSENSO MUTUO)` : `${p2} (CONSENSO MUTUO)`)
      : `P1 reportó: ${r.p1_reported_winner === r.player1_id ? p1 : p2 || 'null'} | P2 reportó: ${r.p2_reported_winner === r.player2_id ? p2 : p1 || 'null'}`

  console.log(`- Sala ${r.id} (${r.created_at.toISOString().slice(11, 19)} UTC) [${r.is_async_match ? 'ASYNC' : 'PVP REAL'}]:`)
  console.log(`  ${p1} vs ${p2} | Acciones: ${r.actions_count}`)
  console.log(`  Status: ${r.status} | Verif: ${r.verification_status} | Nota: ${r.verification_note}`)
  console.log(`  Resultado según jugadores: ${winnerReported}`)
  console.log('')
}

console.log('=== JUGADORES AFECTADOS ===')
console.table(Object.entries(playerStats).map(([name, data]) => ({
  Jugador: name,
  'Partidas Afectadas': data.totalAffected,
  'Reportó Victoria': data.reportsWon,
  'Victorias por Consenso': data.consensusWon,
})))

await client.end()
