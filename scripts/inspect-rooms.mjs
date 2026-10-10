import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const res = await client.query(`
  SELECT pg_get_functiondef(oid) as def 
  FROM pg_proc 
  WHERE proname = 'enter_matchmaking'
`)

for (const r of res.rows) {
  console.log(r.def)
}

await client.end()
