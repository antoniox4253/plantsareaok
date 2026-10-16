import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'


const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
const fnNames = ['swap_plants_for_gems', 'swap_plants_for_usdt']
for (const fn of fnNames) {
  const res = await client.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = $1;`, [fn])
  console.log(`\n=================== ${fn} ===================\n`)
  if (res.rows[0]) {
    console.log(res.rows[0].def)
  }
}
await client.end()

