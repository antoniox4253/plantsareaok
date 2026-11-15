#!/usr/bin/env node
/**
 * Script de Liquidación Automática de Temporada en Plants Arena.
 *
 * Ejecuta public.auto_settle_expired_season() a través del connection pooler de Supabase.
 * Se puede ejecutar como cron job de contingencia o manualmente.
 *
 * Uso:
 *   node scripts/auto_settle_season.mjs
 *   node scripts/auto_settle_season.mjs --force
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

const isForce = process.argv.includes('--force')

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log('[AutoSettle] Conectado a la base de datos de producción.')

  if (isForce) {
    console.log('[AutoSettle] Modo --force detectado: liquidando temporada activa actual de forma forzada...')
    const currentRes = await client.query(`
      SELECT id, season_number, name, starts_at, ends_at, status
        FROM public.seasons
       WHERE is_current = TRUE OR status = 'active'
       ORDER BY season_number DESC
       LIMIT 1;
    `)
    const cur = currentRes.rows[0]
    if (!cur) {
      console.error('[AutoSettle] Error: No se encontró temporada activa.')
      process.exit(1)
    }
    console.log(`[AutoSettle] Forzando liquidación de: ${cur.name} (ID: ${cur.id})`)
    const settleRes = await client.query(`SELECT public.settle_season_rewards($1) as result;`, [cur.id])
    console.log('[AutoSettle] Resultado de liquidación forzada:')
    console.log(JSON.stringify(settleRes.rows[0].result, null, 2))
  } else {
    console.log('[AutoSettle] Ejecutando auto_settle_expired_season()...')
    const res = await client.query(`SELECT public.auto_settle_expired_season() as result;`)
    const result = res.rows[0].result
    console.log('[AutoSettle] Estado reportado:', JSON.stringify(result, null, 2))
  }
} catch (err) {
  console.error('[AutoSettle] Error fatal:', err)
  process.exit(1)
} finally {
  await client.end()
}
