import pg from 'pg'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const res = await client.query(`
  SELECT 
    r.id,
    r.created_at,
    p1.id as p1_id,
    p1.username as p1_username,
    p1.elo_rating as p1_elo,
    p2.id as p2_id,
    p2.username as p2_username,
    p2.elo_rating as p2_elo,
    r.status,
    r.verification_status,
    r.verification_note,
    r.p1_reported_winner,
    r.p2_reported_winner,
    (SELECT COUNT(*) FROM match_actions WHERE room_id = r.id) as actions_count
  FROM game_rooms r
  JOIN profiles p1 ON p1.id = r.player1_id
  JOIN profiles p2 ON p2.id = r.player2_id
  WHERE r.mode = 'ranked'
    AND r.is_async_match = false
    AND r.created_at >= '2026-10-10 00:00:00Z'
  ORDER BY r.created_at ASC;
`)

console.log(`Partidas PvP Real (Humano vs Humano) hoy: ${res.rows.length}\n`)

const table = []
for (const r of res.rows) {
  let consensuado = null
  let ganadorNombre = 'Sin consenso'
  if (r.p1_reported_winner && r.p1_reported_winner === r.p2_reported_winner) {
    consensuado = r.p1_reported_winner
    ganadorNombre = consensuado === r.p1_id ? r.p1_username : r.p2_username
  } else if (r.p1_reported_winner && !r.p2_reported_winner) {
    ganadorNombre = `${r.p1_reported_winner === r.p1_id ? r.p1_username : r.p2_username} (Sólo P1 reportó)`
  } else if (!r.p1_reported_winner && r.p2_reported_winner) {
    ganadorNombre = `${r.p2_reported_winner === r.p1_id ? r.p1_username : r.p2_username} (Sólo P2 reportó)`
  }

  table.push({
    Hora_UTC: r.created_at.toISOString().slice(11, 19),
    ID_Sala: r.id.slice(0, 8) + '...',
    P1: r.p1_username,
    P2: r.p2_username,
    Acciones: r.actions_count,
    Estado: r.status,
    Verificacion: r.verification_status,
    Ganador_Declarado: ganadorNombre,
    Nota: r.verification_note?.slice(0, 30) || 'null'
  })
}

console.table(table)

await client.end()
