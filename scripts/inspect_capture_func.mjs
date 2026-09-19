import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let connectionString = process.env.DATABASE_URL
if (!connectionString) {
  const envPath = path.resolve(__dirname, '../.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/)
    if (match) connectionString = match[1]
  }
}
if (!connectionString) {
  connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
const res = await client.query(`
  SELECT pg_get_functiondef(p.oid) as def
  FROM pg_proc p
  WHERE p.proname = 'capture_ranked_async_opponents_from_room';
`)
console.log(res.rows[0]?.def)
await client.end()
