import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const DRY_RUN = process.argv.includes('--apply') ? false : true

console.log(`=== MODO DE EJECUCIÓN: ${DRY_RUN ? 'DRY-RUN (Simulación sin modificar datos)' : 'APLICAR CAMBIOS EN PRODUCCIÓN'} ===\n`)

const res = await client.query(`
  SELECT 
    r.id,
    r.created_at,
    r.status,
    r.verification_status,
    r.verification_note,
    r.p1_reported_winner,
    r.p2_reported_winner,
    p1.id as p1_id, p1.username as p1_username, p1.elo_rating as p1_elo,
    p2.id as p2_id, p2.username as p2_username, p2.elo_rating as p2_elo
  FROM game_rooms r
  JOIN profiles p1 ON p1.id = r.player1_id
  JOIN profiles p2 ON p2.id = r.player2_id
  WHERE r.mode = 'ranked'
    AND r.is_async_match = false
    AND r.created_at >= '2026-10-10 06:10:00Z'
    AND r.status IN ('abandoned', 'failed')
  ORDER BY r.created_at ASC;
`)

const toSettle = []

for (const r of res.rows) {
  let winnerId = null
  let winnerName = null
  let loserId = null
  let loserName = null
  let reason = ''

  if (r.p1_reported_winner && r.p1_reported_winner === r.p2_reported_winner) {
    winnerId = r.p1_reported_winner
    winnerName = winnerId === r.p1_id ? r.p1_username : r.p2_username
    loserId = winnerId === r.p1_id ? r.p2_id : r.p1_id
    loserName = winnerId === r.p1_id ? r.p2_username : r.p1_username
    reason = 'Consenso mutuo verificado'
  } else if (r.p1_reported_winner && !r.p2_reported_winner && r.verification_note?.includes('abandon')) {
    winnerId = r.p1_reported_winner
    winnerName = winnerId === r.p1_id ? r.p1_username : r.p2_username
    loserId = winnerId === r.p1_id ? r.p2_id : r.p1_id
    loserName = winnerId === r.p1_id ? r.p2_username : r.p1_username
    reason = 'Abandono del rival verificado'
  } else if (!r.p1_reported_winner && r.p2_reported_winner && r.verification_note?.includes('abandon')) {
    winnerId = r.p2_reported_winner
    winnerName = winnerId === r.p1_id ? r.p1_username : r.p2_username
    loserId = winnerId === r.p1_id ? r.p2_id : r.p1_id
    loserName = winnerId === r.p1_id ? r.p2_username : r.p1_username
    reason = 'Abandono del rival verificado'
  }

  if (winnerId) {
    toSettle.push({
      roomId: r.id,
      winnerId,
      winnerName,
      loserId,
      loserName,
      reason
    })
  }
}

console.log(`Partidas a liquidar: ${toSettle.length}`)

for (const item of toSettle) {
  console.log(`Procesando sala ${item.roomId.slice(0, 8)}: Ganador -> ${item.winnerName} vs ${item.loserName} (${item.reason})`)
  if (!DRY_RUN) {
    try {
      const settleResult = await client.query(`SELECT public._settle_room($1, $2) as result;`, [item.roomId, item.winnerId])
      console.log(`  -> Liquidada con éxito:`, settleResult.rows[0].result)
    } catch (e) {
      console.error(`  -> ERROR liquidando sala ${item.roomId}:`, e.message)
    }
  }
}

if (DRY_RUN) {
  console.log(`\nSimulación completada. Para aplicar en la base de datos real, ejecuta: node scripts/settle_pending_matches.mjs --apply`)
} else {
  console.log(`\n¡Todas las partidas fueron liquidadas exitosamente!`)
}

await client.end()
