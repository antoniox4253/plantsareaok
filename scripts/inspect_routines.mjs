import pg from 'pg'
import fs from 'fs'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const r1 = await client.query("SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'settle_verified_match'")
if (r1.rows[0]) fs.writeFileSync('scripts/settle_verified_match.sql', r1.rows[0].def)

const r2 = await client.query("SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'settle_verified_match_authoritative'")
if (r2.rows[0]) fs.writeFileSync('scripts/settle_verified_match_authoritative.sql', r2.rows[0].def)

const r3 = await client.query("SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = '_settle_room'")
if (r3.rows[0]) fs.writeFileSync('scripts/_settle_room.sql', r3.rows[0].def)

console.log('Saved SQL files')
await client.end()
