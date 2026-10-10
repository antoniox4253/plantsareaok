import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const res = await client.query(`
  SELECT 
    r.id,
    r.created_at,
    r.status,
    r.verification_status,
    r.verification_note,
    r.p1_reported_winner,
    r.p2_reported_winner,
    p1.id as p1_id, p1.username as p1_username, p1.elo_rating as p1_elo,
    p2.id as p2_id, p2.username as p2_username, p2.elo_rating as p2_elo,
    (SELECT COUNT(*) FROM match_actions WHERE room_id = r.id) as actions_count
  FROM game_rooms r
  JOIN profiles p1 ON p1.id = r.player1_id
  JOIN profiles p2 ON p2.id = r.player2_id
  WHERE r.mode = 'ranked'
    AND r.is_async_match = false
    AND r.created_at >= '2026-10-10 06:10:00Z'
    AND r.status IN ('abandoned', 'failed')
  ORDER BY r.created_at ASC;
`)

const players = {}
const details = []

for (const r of res.rows) {
  let winnerId = null
  let winnerName = null
  let loserId = null
  let loserName = null
  let reason = ''

  if (r.p1_reported_winner && r.p1_reported_winner === r.p2_reported_winner) {
    winnerId = r.p1_reported_winner
    winnerName = winnerId === r.p1_id ? r.p1_username : r.p2_username
    loserId = winnerId === r.p1_id ? r.p2_id : r.p1_id
    loserName = winnerId === r.p1_id ? r.p2_username : r.p1_username
    reason = r.verification_status === 'failed' ? 'Consenso mutuo (Replay desync por Lentes de Girasol)' : 'Consenso mutuo (Abandonada por auto-settle tras inactividad)'
  } else if (r.p1_reported_winner && !r.p2_reported_winner && r.verification_note?.includes('abandon')) {
    winnerId = r.p1_reported_winner
    winnerName = winnerId === r.p1_id ? r.p1_username : r.p2_username
    loserId = winnerId === r.p1_id ? r.p2_id : r.p1_id
    loserName = winnerId === r.p1_id ? r.p2_username : r.p1_username
    reason = 'Abandono del rival verificado'
  } else if (!r.p1_reported_winner && r.p2_reported_winner && r.verification_note?.includes('abandon')) {
    winnerId = r.p2_reported_winner
    winnerName = winnerId === r.p1_id ? r.p1_username : r.p2_username
    loserId = winnerId === r.p1_id ? r.p2_id : r.p1_id
    loserName = winnerId === r.p1_id ? r.p2_username : r.p1_username
    reason = 'Abandono del rival verificado'
  }

  if (winnerName) {
    players[winnerName] = (players[winnerName] || 0) + 1
    details.push({
      hora: r.created_at.toISOString().slice(11, 16),
      roomId: r.id.slice(0, 8),
      ganador: winnerName,
      perdedor: loserName,
      acciones: r.actions_count,
      tipo: reason
    })
  }
}

console.log('=== RESUMEN DE VICTORIAS LEGÍTIMAS SIN ACREDITAR HOY (DESDE 06:10 UTC) ===')
console.table(players)

console.log('\n=== LISTA DETALLADA DE PARTIDAS AFECTADAS ===')
console.table(details)

await client.end()
