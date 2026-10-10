import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const res = await client.query(`
  SELECT id, user_id, seq, tick, issued_tick, kind, plant_id, lane, col, slot, target_id
  FROM match_actions 
  WHERE room_id = '5b659421-2120-4162-806c-a0d7471eb80a'
    AND user_id = (SELECT player2_id FROM game_rooms WHERE id = '5b659421-2120-4162-806c-a0d7471eb80a')
    AND seq IN (90, 91, 92, 93)
`)
console.table(res.rows)

await client.end()
