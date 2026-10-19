import pg from 'pg'
const client = new pg.Client({
  connectionString: 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
})
await client.connect()
const roomId = process.argv[2] || '6e6615af-8261-4f79-a970-9e63c7e42b76'
const res = await client.query('SELECT verification_payload, verification_note, p1_reported_winner, p2_reported_winner, server_winner_id, status FROM game_rooms WHERE id = $1', [roomId])
console.log(JSON.stringify(res.rows[0], null, 2))
await client.end()
