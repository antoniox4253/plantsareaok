import pg from 'pg'
import fs from 'fs'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const r = await client.query("SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'report_match_result'")
if (r.rows[0]) fs.writeFileSync('scripts/report_match_result.sql', r.rows[0].def)

console.log('Saved report_match_result.sql')
await client.end()
