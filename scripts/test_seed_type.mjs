import pg from 'pg'
import { recalcularGanadorAutoritativo } from '../src/engine/replay.ts'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const roomId = '5b659421-2120-4162-806c-a0d7471eb80a'
const roomRes = await client.query('SELECT * FROM game_rooms WHERE id = $1', [roomId])
const room = roomRes.rows[0]

const actionsRes = await client.query(
  'SELECT id, user_id, seq, tick, issued_tick, kind, plant_id, lane, col, slot, target_id FROM match_actions WHERE room_id = $1 ORDER BY issued_tick ASC NULLS FIRST, id ASC',
  [roomId]
)
const actions = actionsRes.rows

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
  seed: room.seed, // let's see what happens if string or number!
  engineVersion: room.engine_version,
  jugadaEn: room.started_at ?? room.created_at,
  jugador1: { nombre: null, avatar: null, mazo: room.p1_deck },
  jugador2: { nombre: null, avatar: null, mazo: room.p2_deck },
  ganador: null,
  yoSoy: null,
  jugadas,
}

// Check with seed as string vs number
console.log('Testing with seed as STRING:', typeof room.seed, room.seed)
const resStr = recalcularGanadorAutoritativo(datos)
console.log('Result with seed as string: motivo=', resStr.motivo, 'ilegales=', resStr.ilegales.length)
console.log('P1 ilegales with string seed:', resStr.ilegales.filter(x => x.de === 1))

datos.seed = Number(room.seed)
console.log('\nTesting with seed as NUMBER:', typeof datos.seed, datos.seed)
const resNum = recalcularGanadorAutoritativo(datos)
console.log('Result with seed as number: motivo=', resNum.motivo, 'ilegales=', resNum.ilegales.length)
console.log('P1 ilegales with number seed:', resNum.ilegales.filter(x => x.de === 1))

await client.end()
