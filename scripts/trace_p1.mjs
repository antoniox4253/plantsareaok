import pg from 'pg'
const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const roomId = '5b659421-2120-4162-806c-a0d7471eb80a'
const roomRes = await client.query('SELECT * FROM game_rooms WHERE id = $1', [roomId])
const room = roomRes.rows[0]

const actionsRes = await client.query(
  'SELECT id, user_id, seq, tick, issued_tick, kind, plant_id, lane, col, slot, target_id FROM match_actions WHERE room_id = $1 ORDER BY issued_tick ASC NULLS FIRST, id ASC',
  [roomId]
)
const actions = actionsRes.rows

console.log('Total actions:', actions.length)

// Let's print all actions before tick 1850 for P1
const p1EarlyActions = actions.filter(a => a.user_id === room.player1_id && a.issued_tick <= 1800)
console.log('P1 early actions (issued_tick <= 1800):')
console.table(p1EarlyActions.map(a => ({ id: a.id, seq: a.seq, kind: a.kind, plant: a.plant_id, tick: a.tick, issued: a.issued_tick, target: a.target_id })))

await client.end()
