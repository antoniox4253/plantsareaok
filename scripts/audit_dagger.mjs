import pg from 'pg'
import { recalcularGanadorAutoritativo } from '../src/engine/replay.ts'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const daggerId = 'dac4e1f0-fe0e-4f29-9d92-58386f915163'
const roomsRes = await client.query(
  'SELECT * FROM game_rooms WHERE (player1_id = $1 OR player2_id = $1) ORDER BY created_at DESC LIMIT 50',
  [daggerId]
)

console.log('Auditing ' + roomsRes.rows.length + ' rooms for Dagger22...\n')

let discrepancies = []

for (const room of roomsRes.rows) {
  const actionsRes = await client.query(
    'SELECT id, user_id, seq, tick, issued_tick, kind, plant_id, lane, col, slot, target_id FROM match_actions WHERE room_id = $1 ORDER BY issued_tick ASC NULLS FIRST, id ASC',
    [room.id]
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

  const replay = recalcularGanadorAutoritativo({
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
  })

  const daggerIsP1 = room.player1_id === daggerId
  const daggerShouldWin = replay.ganador === (daggerIsP1 ? 1 : 2)
  const roomGaveDaggerWin = (room.status === 'p1_won' && daggerIsP1) || (room.status === 'p2_won' && !daggerIsP1)

  if (daggerShouldWin && !roomGaveDaggerWin) {
    discrepancies.push({
      roomId: room.id,
      date: room.created_at,
      mode: room.mode,
      isAsync: room.is_async_match,
      dbStatus: room.status,
      serverWinnerId: room.server_winner_id,
      p1Reported: room.p1_reported_winner,
      p2Reported: room.p2_reported_winner,
      replayWinner: replay.ganador,
      daggerRole: daggerIsP1 ? 'P1' : 'P2',
      replayMotivo: replay.motivo,
      baseP1: replay.baseP1,
      baseP2: replay.baseP2,
      verificationNote: room.verification_note,
      p1LastSeen: room.p1_last_seen,
      p2LastSeen: room.p2_last_seen,
    })
  }
}

console.log('Total discrepancies found (Dagger won simulation, but DB gave loss):', discrepancies.length)
console.log(JSON.stringify(discrepancies, null, 2))

await client.end()
