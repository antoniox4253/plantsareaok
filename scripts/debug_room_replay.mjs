import pg from 'pg'
import { recalcularGanadorAutoritativo } from '../src/engine/replay.ts'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const roomId = process.argv[2] || '5b659421-2120-4162-806c-a0d7471eb80a'

const roomRes = await client.query('SELECT * FROM game_rooms WHERE id = $1', [roomId])
if (!roomRes.rows.length) {
  console.log('Room not found')
  process.exit(1)
}
const room = roomRes.rows[0]

const actionsRes = await client.query(
  'SELECT id, user_id, seq, tick, issued_tick, kind, plant_id, lane, col, slot, target_id FROM match_actions WHERE room_id = $1 ORDER BY issued_tick ASC NULLS FIRST, id ASC',
  [roomId]
)
const actions = actionsRes.rows

console.log('Room ID:', room.id)
console.log('Mode:', room.mode, 'is_async:', room.is_async_match, 'engine_version:', room.engine_version)
console.log('Player 1:', room.player1_id)
console.log('Player 2:', room.player2_id)
console.log('Total actions:', actions.length)

const jugadas = actions.map((a) => ({
  id: Number(a.id),
  seq: a.seq,
  de: a.user_id === room.player1_id ? 1 : 2,
  tick: a.tick,
  issuedTick: a.issued_tick,
  kind: a.kind,
  plantId: a.plant_id,
  lane: a.lane,
  col: a.col,
  slot: a.slot,
  targetId: a.target_id,
}))

const datos = {
  roomId: room.id,
  mode: room.mode,
  seed: Number(room.seed),
  engineVersion: room.engine_version,
  jugadaEn: room.started_at ?? room.created_at,
  jugador1: { nombre: null, avatar: null, mazo: room.p1_deck },
  jugador2: { nombre: null, avatar: null, mazo: room.p2_deck },
  ganador: null,
  yoSoy: null,
  jugadas,
}

const resultado = recalcularGanadorAutoritativo(datos)
console.log('\n--- RESULTADO AUTORITATIVO ---')
console.log('Ganador:', resultado.ganador)
console.log('Motivo:', resultado.motivo)
console.log('Tics:', resultado.tics)
console.log('Base P1:', resultado.baseP1, 'Base P2:', resultado.baseP2)
console.log('Ilegales count:', resultado.ilegales.length)
console.log('Primeras 15 ilegales:')
console.dir(resultado.ilegales.slice(0, 15), { depth: null })

await client.end()
