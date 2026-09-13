#!/usr/bin/env node
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Intentar leer de .env si existe
let connectionString = process.env.DATABASE_URL
if (!connectionString) {
  const envPath = path.resolve(__dirname, '../.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/)
    if (match) connectionString = match[1]
  }
}

// Fallback al pooler IPv4 verificado (ca-central-1)
if (!connectionString) {
  connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
}

const arg = process.argv.slice(2).join(' ').trim()

if (!arg) {
  console.log(`Uso:
  node scripts/db.mjs "SELECT id, username, gold_balance FROM profiles LIMIT 5;"
  node scripts/db.mjs -f supabase/migrations/149-fix-referral-gold-claim.sql`)
  process.exit(0)
}

let sql = arg
if (process.argv[2] === '-f' || process.argv[2] === '--file') {
  const filePath = path.resolve(process.cwd(), process.argv[3])
  sql = fs.readFileSync(filePath, 'utf8')
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  const result = await client.query(sql)
  if (Array.isArray(result)) {
    console.log(JSON.stringify(result.map(r => r.rows), null, 2))
  } else if (result.rows && result.rows.length > 0) {
    console.table(result.rows)
  } else {
    console.log(`✅ Consulta ejecutada exitosamente. Filas afectadas: ${result.rowCount ?? 0}`)
  }
} catch (err) {
  console.error('❌ Error de consulta:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
