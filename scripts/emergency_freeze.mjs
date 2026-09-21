import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('--- APLICANDO MEDIDAS DE EMERGENCIA INMEDIATAS ---')

  // 1. Rechazar retiros fraudulentos en requested
  const res1 = await client.query(`
    UPDATE public.withdrawal_transactions 
    SET status = 'rejected', 
        failure_reason = 'EXPLOIT_DETECTED_FRIENDLY_ESCROW_DUPLICATION' 
    WHERE status = 'requested'
    RETURNING id, user_id, amount_gems, net_amount_usdt;
  `)
  console.log(`✅ Retiros fraudulentos cancelados/rechazados (${res1.rowCount} filas):`)
  console.table(res1.rows)

  // 2. Actualizar transactions ledger
  const res2 = await client.query(`
    UPDATE public.transactions 
    SET status = 'rejected', 
        description = description || ' [RECHAZADO: EXPLOIT FRAUDULENTO DETECTADO]' 
    WHERE type = 'withdrawal' AND status = 'pending';
  `)
  console.log(`✅ Transacciones pendientes actualizadas a rejected: ${res2.rowCount}`)

  // 3. Limpiar escrows huérfanos en 'held'
  const res4 = await client.query(`
    UPDATE public.colosseum_escrow 
    SET status = 'expired' 
    WHERE status = 'held' AND room_id IS NULL;
  `)
  console.log(`✅ Escrows huérfanos expirados: ${res4.rowCount}`)

  // 4. Congelar y resetear saldo de los 6 atacantes
  const exploiters = [
    '453fec1f-9a69-44ff-90c7-5fcbd04c978e',
    'e15d6856-a311-4b0b-86b3-83d9bfa11783',
    'a8209ae9-3deb-4cd2-ad4f-e663ca14d499',
    '122ddca6-993c-4eae-be03-5b2ae97bb3f8',
    'b5a7dd5e-d38e-4049-a41e-3419f312a495',
    'ca262a78-1fcd-4c9f-b146-c804ef52fedb'
  ]

  const res5 = await client.query(`
    UPDATE public.profiles 
    SET gems_balance = 0,
        locked_gems_balance = 0
    WHERE id = ANY($1::uuid[])
    RETURNING id, username, gems_balance;
  `, [exploiters])
  console.log(`✅ Perfiles de atacantes congelados a 0 gemas:`)
  console.table(res5.rows)

  // 5. Configurar bandera de pausa de retiros en crypto_treasury_config
  await client.query(`
    INSERT INTO public.crypto_treasury_config (key, value, description)
    VALUES ('withdrawals_paused', 'true', 'Pausa de emergencia para retiros de tesorería')
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW();
  `)
  console.log(`✅ Bandera withdrawals_paused establecida en true.`)

  await client.end()
}

run().catch(console.error)
