import pg from 'pg'
import { recalcularGanadorAutoritativo } from '../src/engine/replay.ts'

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  const roomId = '068862be-1ee1-462d-9b73-c0fada1630e3'

  const res = await client.query('SELECT public.match_replay($1, NULL) as replay_data', [roomId])
  const data = res.rows[0].replay_data

  console.log('Room ID:', data.roomId)
  console.log('Mode:', data.mode)
  console.log('Seed:', data.seed)
  console.log('Engine Version:', data.engineVersion)
  console.log('Jugador 1:', data.jugador1.nombre, 'Tree level:', data.jugador1.treeLevel)
  console.log('Jugador 2:', data.jugador2.nombre, 'Tree level:', data.jugador2.treeLevel)
  console.log('Total jugadas grabadas:', data.jugadas?.length)

  // Look at action 2612939 (the one flagged for P1) and 2612913 (flagged for P2)
  const aP1 = data.jugadas.find((j: any) => j.id === 2612939)
  console.log('\nP1 Flagged Action in replay_data (id 2612939):', aP1)

  const aP2_1 = data.jugadas.find((j: any) => j.id === 2612913)
  console.log('P2 Flagged Action in replay_data (id 2612913):', aP2_1)

  const aP2_2 = data.jugadas.find((j: any) => j.id === 2612933)
  console.log('P2 Flagged Action in replay_data (id 2612933):', aP2_2)

  // Run recalcularGanadorAutoritativo
  console.log('\n--- EJECUTANDO recalcularGanadorAutoritativo ---')
  const resultado = recalcularGanadorAutoritativo(data)
  console.log('Resultado motivo:', resultado.motivo)
  console.log('Resultado ganador:', resultado.ganador)
  console.log('Resultado tics:', resultado.tics)
  console.log('Resultado baseP1:', resultado.baseP1, 'baseP2:', resultado.baseP2)
  console.log('Resultado baseP1VistaP2:', resultado.baseP1VistaP2, 'baseP2VistaP2:', resultado.baseP2VistaP2)
  console.log('Ilegales count:', resultado.ilegales.length)
  console.log('Ilegales detalle:', JSON.stringify(resultado.ilegales, null, 2))

  await client.end()
}

run().catch(console.error)
