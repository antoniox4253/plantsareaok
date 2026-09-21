import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('=== INICIANDO SUITE DE PRUEBAS DE SEGURIDAD (MIGRACIÓN 215) ===\n')

  // Iniciar transacción de prueba para rollback
  await client.query('BEGIN;')

  try {
    // Seleccionar 2 usuarios existentes para la prueba dentro del bloque de rollback
    const existingUsers = await client.query(`SELECT id FROM public.profiles LIMIT 2;`)
    const user1 = existingUsers.rows[0].id
    const user2 = existingUsers.rows[1].id

    // Guardar balances iniciales y setear temporalmente a 1000 gemas para el test
    await client.query(`UPDATE public.profiles SET gems_balance = 1000, locked_gems_balance = 0, is_banned = FALSE WHERE id IN ($1, $2);`, [user1, user2])

    console.log(`[+] Usuarios de prueba creados: U1 (${user1}), U2 (${user2}) con 1000 gemas cada uno`)

    // TEST 1: Apuesta amistosa y cancelación
    console.log('\n--- TEST 1: Apuesta en amistoso y cancelación de cola ---')
    const betRes = await client.query(`SELECT public._apostar_en_amistoso($1, 100) as escrow_id;`, [user1])
    const escrowId = betRes.rows[0].escrow_id
    console.log(`  Escrow creado: ${escrowId}`)

    // Encolar
    await client.query(`
      INSERT INTO public.matchmaking_queue (user_id, mode, colosseum_bet, status, escrow_id)
      VALUES ($1, 'friendly', 100, 'searching', $2);
    `, [user1, escrowId])

    // Verificar saldo U1 (debe ser 900)
    const bal1 = await client.query(`SELECT gems_balance FROM public.profiles WHERE id = $1;`, [user1])
    console.log(`  Saldo tras apostar 100: ${bal1.rows[0].gems_balance} (Esperado: 900)`)

    // Cancelar matchmaking simulando sesión de user1
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${user1}';`)
    await client.query(`SET LOCAL ROLE authenticated;`)
    const cancelRes = await client.query(`SELECT public.cancel_matchmaking() as result;`)
    console.log(`  Cancelación resultado:`, cancelRes.rows[0].result)

    await client.query(`RESET ROLE;`)

    // Verificar que el escrow ahora esté en 'refunded'
    const escCheck = await client.query(`SELECT status FROM public.colosseum_escrow WHERE id = $1;`, [escrowId])
    console.log(`  Estado del escrow tras cancelar: ${escCheck.rows[0].status} (Esperado: refunded)`)

    // Verificar saldo U1 tras cancelación (debe ser 1000)
    const bal2 = await client.query(`SELECT gems_balance FROM public.profiles WHERE id = $1;`, [user1])
    console.log(`  Saldo tras cancelación: ${bal2.rows[0].gems_balance} (Esperado: 1000)`)

    // Intentar segundo cancel: NO debe aumentar saldo
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${user1}';`)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SELECT public.cancel_matchmaking();`)
    await client.query(`RESET ROLE;`)

    const bal3 = await client.query(`SELECT gems_balance FROM public.profiles WHERE id = $1;`, [user1])
    console.log(`  Saldo tras segundo intento de cancel: ${bal3.rows[0].gems_balance} (Esperado: 1000 - CERO DOBLE REEMBOLSO)`)

    if (bal3.rows[0].gems_balance === '1000.00' && escCheck.rows[0].status === 'refunded') {
      console.log('  ✅ TEST 1 PASADO: Reembolso atómico y protección contra doble gasto comprobada.')
    } else {
      throw new Error('TEST 1 FALLÓ')
    }

    // TEST 2: Hard cap en _create_room y _settle_room
    console.log('\n--- TEST 2: Hard cap en _create_room y _settle_room ---')
    // Crear intencionalmente 5 escrows huérfanos para user1
    for (let i = 0; i < 5; i++) {
      await client.query(`
        INSERT INTO public.colosseum_escrow (user_id, bet_gems, status, paid_with, expires_at)
        VALUES ($1, 100, 'held', 'gems', NOW() + INTERVAL '30 min');
      `, [user1])
    }
    // Crear 1 escrow para user2
    await client.query(`
      INSERT INTO public.colosseum_escrow (user_id, bet_gems, status, paid_with, expires_at)
      VALUES ($1, 100, 'held', 'gems', NOW() + INTERVAL '30 min');
    `, [user2])

    // Crear sala de amistoso con apuesta 100
    const roomRes = await client.query(`
      SELECT public._create_room('friendly', $1, $2, 100) as room_id;
    `, [user1, user2])
    const roomId = roomRes.rows[0].room_id

    // Verificar cuántos escrows se vincularon a la sala
    const escCount = await client.query(`
      SELECT COUNT(*) as c, SUM(bet_gems) as s FROM public.colosseum_escrow WHERE room_id = $1;
    `, [roomId])
    console.log(`  Escrows vinculados a la sala: ${escCount.rows[0].c}, Total gemas en escrow: ${escCount.rows[0].s}`)

    const roomCheck = await client.query(`SELECT escrow_gems FROM public.game_rooms WHERE id = $1;`, [roomId])
    console.log(`  escrow_gems en game_rooms: ${roomCheck.rows[0].escrow_gems} (Hard cap esperado: <= 200)`)

    // Liquidar sala con ganador user1
    const settleRes = await client.query(`SELECT public._settle_room($1, $2) as result;`, [roomId, user1])
    console.log(`  Resultado de liquidación:`, settleRes.rows[0].result)

    if (Number(roomCheck.rows[0].escrow_gems) <= 200 && Number(settleRes.rows[0].result.payout) <= 200) {
      console.log('  ✅ TEST 2 PASADO: Pozo restringido a 2x la apuesta sin multiplicar escrows.')
    } else {
      throw new Error('TEST 2 FALLÓ: Pozo superó 200 gemas')
    }

    // TEST 3: Seguridad de Retiros (request_withdrawal)
    console.log('\n--- TEST 3: Seguridad en request_withdrawal ---')

    // 3a. Pausa global de retiros
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${user1}';`)
    await client.query(`SET LOCAL ROLE authenticated;`)
    const wdPaused = await client.query(`
      SELECT public.request_withdrawal(1000, '0x1111111111111111111111111111111111111111', 'k1') as res;
    `)
    await client.query(`RESET ROLE;`)
    console.log(`  3a. Retiro con pausa activa:`, wdPaused.rows[0].res)

    // Desactivar temporalmente pausa para probar los demás filtros
    await client.query(`UPDATE public.crypto_treasury_config SET value = 'false' WHERE key = 'withdrawals_paused';`)

    // 3b. Wallet en lista negra
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${user1}';`)
    await client.query(`SET LOCAL ROLE authenticated;`)
    const wdBlacklist = await client.query(`
      SELECT public.request_withdrawal(1000, '0x7A2358040C5b7dDffB61E0A8062f39Ca45b2C338', 'k2') as res;
    `)
    await client.query(`RESET ROLE;`)
    console.log(`  3b. Retiro a wallet blacklisteada:`, wdBlacklist.rows[0].res)

    // 3c. Usuario baneado
    await client.query(`UPDATE public.profiles SET is_banned = TRUE WHERE id = $1;`, [user1])
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${user1}';`)
    await client.query(`SET LOCAL ROLE authenticated;`)
    const wdBanned = await client.query(`
      SELECT public.request_withdrawal(1000, '0x2222222222222222222222222222222222222222', 'k3') as res;
    `)
    await client.query(`RESET ROLE;`)
    console.log(`  3c. Retiro desde usuario baneado:`, wdBanned.rows[0].res)

    if (
      wdPaused.rows[0].res.error === 'WITHDRAWALS_PAUSED' &&
      wdBlacklist.rows[0].res.error === 'WALLET_BLACKLISTED' &&
      wdBanned.rows[0].res.error === 'ACCOUNT_BANNED'
    ) {
      console.log('  ✅ TEST 3 PASADO: Todos los filtros de seguridad de retiros responden con bloqueo certero.')
    } else {
      throw new Error('TEST 3 FALLÓ')
    }

  } catch (err) {
    console.error('❌ Error en pruebas:', err)
  } finally {
    // Revertir todos los cambios temporales de la suite de pruebas
    await client.query('ROLLBACK;')
    console.log('\n[!] Transacción de pruebas revertida (ROLLBACK). DB de producción intacta.')
    await client.end()
  }
}

run().catch(console.error)
