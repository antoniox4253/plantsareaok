import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const res = await client.query("SELECT p1_deck, p2_deck FROM game_rooms WHERE id = '5b659421-2120-4162-806c-a0d7471eb80a'")
console.log('P1 Deck:', JSON.stringify(res.rows[0].p1_deck, null, 2))
console.log('P2 Deck:', JSON.stringify(res.rows[0].p2_deck, null, 2))

await client.end()
