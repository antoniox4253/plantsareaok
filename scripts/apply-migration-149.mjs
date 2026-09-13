import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Conexión por Supabase Pooler IPv4 (Sesión modo 5432 para DDL)
const client = new pg.Client({
  host: 'aws-0-ca-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.lesrjhbzsampjsjbocfa',
  password: 'Sanki4253$$',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

async function run() {
  console.log('Conectando a Supabase PostgreSQL (ca-central-1:5432)...')
  await client.connect()
  console.log('✅ Conexión establecida con éxito.')

  const migrationPath = path.resolve(__dirname, '../supabase/migrations/149-fix-referral-gold-claim.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  console.log('Ejecutando Migración 149...')
  await client.query(sql)
  console.log('🎉 ¡Migración 149 aplicada exitosamente en Supabase!')

  // Verificaciones en la base de datos
  console.log('\n--- Verificando base de datos ---')

  // 1. Verificar RPC claim_referral_gold
  const funcRes = await client.query(`
    SELECT proname, prorettype::regtype as return_type 
    FROM pg_proc 
    WHERE proname = 'claim_referral_gold';
  `)
  console.log('RPC claim_referral_gold:', funcRes.rows)

  // 2. Verificar columna amount_gold en transactions
  const colRes = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'amount_gold';
  `)
  console.log('Columna amount_gold en transactions:', colRes.rows)

  // 3. Verificar shop_config
  const confRes = await client.query(`
    SELECT key, value 
    FROM public.shop_config 
    WHERE key IN ('ref_copas_validas', 'ref_oro_por_amigo');
  `)
  console.log('Configuración de referidos en shop_config:', confRes.rows)

  await client.end()
  console.log('Conexión cerrada. Todo completado.')
}

run().catch((err) => {
  console.error('❌ Error aplicando migración:', err)
  process.exit(1)
})
