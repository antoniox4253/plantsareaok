#!/usr/bin/env node
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

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function run() {
  console.log('🚀 Iniciando proceso de depuración y optimización de datos antiguos (> 30 días)...')
  const startTime = Date.now()

  await client.connect()
  console.log('✅ Conectado a PostgreSQL Supabase.')

  // 1. Obtener tamaño inicial
  const sizeInitRes = await client.query(`
    SELECT 
      pg_size_pretty(pg_total_relation_size('match_actions')) as actions_size,
      pg_size_pretty(pg_total_relation_size('match_checkpoints')) as checkpoints_size,
      pg_size_pretty(pg_database_size(current_database())) as total_db_size;
  `)
  console.log('📊 Tamaños actuales:', sizeInitRes.rows[0])

  // 2. Determinar el límite superior de ID en match_actions para 30 días
  console.log('\n🔍 Analizando IDs y fechas en match_actions...')
  const cutoffRes = await client.query(`
    SELECT 
      MIN(id) as min_id,
      MAX(id) as max_id,
      COUNT(*) as total_old
    FROM public.match_actions 
    WHERE created_at < NOW() - INTERVAL '30 days';
  `)

  const minId = cutoffRes.rows[0].min_id ? BigInt(cutoffRes.rows[0].min_id) : null
  const maxId = cutoffRes.rows[0].max_id ? BigInt(cutoffRes.rows[0].max_id) : null
  const totalOld = Number(cutoffRes.rows[0].total_old || 0)

  console.log(`🎯 Registros a depurar en match_actions: ${totalOld.toLocaleString()} filas (Rango ID: ${minId} -> ${maxId})`)

  let deletedActions = 0
  if (minId !== null && maxId !== null && totalOld > 0) {
    const BATCH_SIZE = 50000n
    let currentStart = minId

    while (currentStart <= maxId) {
      const currentEnd = currentStart + BATCH_SIZE
      const delRes = await client.query(
        `DELETE FROM public.match_actions WHERE id >= $1 AND id < $2;`,
        [currentStart.toString(), currentEnd.toString()]
      )
      deletedActions += delRes.rowCount || 0
      process.stdout.write(
        `\r🧹 Purgando match_actions: ${deletedActions.toLocaleString()} / ${totalOld.toLocaleString()} filas eliminadas...`
      )
      currentStart = currentEnd
      await sleep(40) // Pausa de 40ms entre lotes para no competir con el tráfico de jugadores activos
    }
    console.log(`\n✅ match_actions: ${deletedActions.toLocaleString()} filas eliminadas con éxito.`)
  } else {
    console.log('ℹ️ No hay registros antiguos de más de 30 días en match_actions.')
  }

  // 3. Purgar match_checkpoints (> 30 días)
  console.log('\n🔍 Purgando match_checkpoints (> 30 días)...')
  const countCpRes = await client.query(`
    SELECT COUNT(*) as total_cp
    FROM public.match_checkpoints
    WHERE created_at < NOW() - INTERVAL '30 days';
  `)
  const totalCp = Number(countCpRes.rows[0].total_cp || 0)
  console.log(`🎯 Registros a depurar en match_checkpoints: ${totalCp.toLocaleString()} filas`)

  let deletedCp = 0
  if (totalCp > 0) {
    // Purgar en bloques de 25000 usando ctid para evitar bloqueo de tabla
    while (true) {
      const delCpRes = await client.query(`
        DELETE FROM public.match_checkpoints
        WHERE ctid IN (
          SELECT ctid FROM public.match_checkpoints
          WHERE created_at < NOW() - INTERVAL '30 days'
          LIMIT 25000
        );
      `)
      const count = delCpRes.rowCount || 0
      deletedCp += count
      process.stdout.write(`\r🧹 Purgando match_checkpoints: ${deletedCp.toLocaleString()} / ${totalCp.toLocaleString()}...`)
      if (count === 0) break
      await sleep(40)
    }
    console.log(`\n✅ match_checkpoints: ${deletedCp.toLocaleString()} filas eliminadas con éxito.`)
  }

  // 4. Purgar cron.job_run_details (> 7 días)
  console.log('\n🔍 Purgando logs históricos de cron.job_run_details (> 7 días)...')
  try {
    const cronDelRes = await client.query(`
      DELETE FROM cron.job_run_details WHERE start_time < NOW() - INTERVAL '7 days';
    `)
    console.log(`✅ cron.job_run_details: ${(cronDelRes.rowCount || 0).toLocaleString()} logs eliminados.`)
  } catch (err) {
    console.log('ℹ️ Omitiendo cron.job_run_details:', err.message)
  }

  // 5. Ejecutar VACUUM ANALYZE para reorganizar y reutilizar espacio
  console.log('\n🧹 Ejecutando VACUUM ANALYZE en tablas depuradas...')
  await client.query('VACUUM ANALYZE public.match_actions;')
  await client.query('VACUUM ANALYZE public.match_checkpoints;')
  console.log('✅ VACUUM ANALYZE completado.')

  // 6. Consultar estadísticas finales
  const sizeFinalRes = await client.query(`
    SELECT 
      pg_size_pretty(pg_total_relation_size('match_actions')) as actions_size,
      pg_size_pretty(pg_total_relation_size('match_checkpoints')) as checkpoints_size,
      pg_size_pretty(pg_database_size(current_database())) as total_db_size;
  `)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n=============================================')
  console.log(`🎉 DEPURACIÓN COMPLETADA EN ${elapsed}s`)
  console.log('=============================================')
  console.log('📊 Estado antes:', sizeInitRes.rows[0])
  console.log('📊 Estado después:', sizeFinalRes.rows[0])
  console.log(`🗑️ Total match_actions eliminadas: ${deletedActions.toLocaleString()}`)
  console.log(`🗑️ Total match_checkpoints eliminadas: ${deletedCp.toLocaleString()}`)
}

run()
  .catch((err) => {
    console.error('❌ Error durante la depuración:', err)
    process.exit(1)
  })
  .finally(async () => {
    await client.end()
  })
