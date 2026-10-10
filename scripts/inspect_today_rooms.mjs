import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const res = await client.query(`
  SELECT 
    r.id,
    r.created_at,
    p1.username as p1_name,
    p2.username as p2_name,
    r.p1_reported_winner,
    r.p2_reported_winner,
    r.status,
    r.verification_status,
    r.verification_note,
    r.verification_payload
  FROM game_rooms r
  LEFT JOIN profiles p1 ON p1.id = r.player1_id
  LEFT JOIN profiles p2 ON p2.id = r.player2_id
  WHERE r.created_at > '2026-10-10 00:00:00Z'
    AND r.is_async_match = false
    AND r.mode = 'ranked'
  ORDER BY r.created_at DESC
  LIMIT 20;
`)

for (const row of res.rows) {
  console.log('----------------------------------------------------')
  console.log(`ROOM: ${row.id} at ${row.created_at.toISOString()}`)
  console.log(`Players: P1=${row.p1_name} vs P2=${row.p2_name}`)
  console.log(`Reported winners: p1_reported=${row.p1_reported_winner === row.player1_id ? 'P1' : 'P2'} p2_reported=${row.p2_reported_winner === row.player1_id ? 'P1' : 'P2'}`)
  console.log(`Status: ${row.status} | VerifStatus: ${row.verification_status} | Note: ${row.verification_note}`)
  const p = row.verification_payload
  if (p) {
    console.log(`Payload reason: ${p.reason}, winnerSide: ${p.winnerSide}, ticks: ${p.ticks}, illegalCount: ${p.illegalCount}`)
    if (p.illegalActions && p.illegalActions.length > 0) {
      console.log(`First 3 illegal actions:`, JSON.stringify(p.illegalActions.slice(0, 3)))
    }
  }
}

await client.end()
