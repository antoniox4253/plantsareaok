import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  const roomId = '068862be-1ee1-462d-9b73-c0fada1630e3'
  
  const roomRes = await client.query(`
    SELECT r.*,
           p1.username as p1_name, p1.elo_rating as p1_elo,
           p2.username as p2_name, p2.elo_rating as p2_elo
    FROM public.game_rooms r
    LEFT JOIN public.profiles p1 ON p1.id = r.player1_id
    LEFT JOIN public.profiles p2 ON p2.id = r.player2_id
    WHERE r.id = $1
  `, [roomId])

  const room = roomRes.rows[0]
  console.log('=== ROOM BASIC INFO ===')
  console.log('Room ID:', room.id)
  console.log('Mode:', room.mode)
  console.log('Status:', room.status)
  console.log('P1:', room.p1_name, `(${room.player1_id})`, 'ELO:', room.p1_elo)
  console.log('P2:', room.p2_name, `(${room.player2_id})`, 'ELO:', room.p2_elo)
  console.log('P1 reported winner:', room.p1_reported_winner)
  console.log('P2 reported winner:', room.p2_reported_winner)
  console.log('Verification Status:', room.verification_status)
  console.log('Verification Note:', room.verification_note)
  console.log('Server Winner ID:', room.server_winner_id)
  console.log('Verification Attempts:', room.verification_attempts)
  console.log('Verification Last Error:', room.verification_last_error)
  console.log('Settled At:', room.settled_at)

  console.log('\n=== VERIFICATION PAYLOAD ===')
  console.log(JSON.stringify(room.verification_payload, null, 2))

  // Inspect match_actions
  const actionsRes = await client.query(`
    SELECT id, user_id, seq, kind, plant_id, lane, col, tick, issued_tick, target_id, created_at
    FROM public.match_actions
    WHERE room_id = $1
    ORDER BY id ASC
  `, [roomId])

  console.log(`\n=== MATCH ACTIONS (${actionsRes.rows.length} total) ===`)
  for (const a of actionsRes.rows) {
    const isP1 = a.user_id === room.player1_id
    console.log(`ID:${a.id} | ${isP1 ? 'P1(elcruel)' : 'P2(Luxuriant)'} | seq:${a.seq} | kind:${a.kind} | plant:${a.plant_id} | lane:${a.lane} | col:${a.col} | tick:${a.tick} | issued_tick:${a.issued_tick} | target:${a.target_id}`)
  }

  await client.end()
}

run().catch(console.error)
