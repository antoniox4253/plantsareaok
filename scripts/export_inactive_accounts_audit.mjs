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

async function run() {
  await client.connect()
  console.log('--- EXPORTANDO AUDITORÍA DE CUENTAS INACTIVAS ---')

  const query = `
    WITH all_act AS (
      SELECT 
        u.id,
        u.email,
        p.username,
        u.created_at as created_at,
        u.last_sign_in_at,
        GREATEST(
          u.last_sign_in_at, 
          gr.last_room_at, 
          ma.last_action_at, 
          cm.last_chat_at, 
          tx.last_tx_at, 
          ls.last_streak_at
        ) as true_last_active,
        COALESCE(gr.rooms_count, 0) as rooms_count,
        COALESCE(st.wins, 0) as wins,
        COALESCE(st.losses, 0) as losses,
        COALESCE(st.draws, 0) as draws,
        GREATEST(COALESCE(gr.rooms_count, 0), COALESCE(st.wins + st.losses + st.draws, 0)) as total_partidas,
        p.elo_rating,
        p.gold_balance,
        p.gems_balance,
        p.is_banned,
        p.ban_reason,
        ref.username as referidor
      FROM auth.users u
      JOIN profiles p ON p.id = u.id
      LEFT JOIN profiles ref ON ref.id = p.referred_by
      LEFT JOIN (
        SELECT uid, count(*) as rooms_count, max(created_at) as last_room_at FROM (
          SELECT player1_id as uid, created_at FROM game_rooms
          UNION ALL
          SELECT player2_id as uid, created_at FROM game_rooms
        ) t GROUP BY uid
      ) gr ON gr.uid = u.id
      LEFT JOIN (
        SELECT user_id, max(created_at) as last_action_at FROM match_actions GROUP BY user_id
      ) ma ON ma.user_id = u.id
      LEFT JOIN (
        SELECT user_id, max(created_at) as last_chat_at FROM (
          SELECT user_id, created_at FROM global_chat_messages
          UNION ALL
          SELECT user_id, created_at FROM clan_chat_messages
        ) c GROUP BY user_id
      ) cm ON cm.user_id = u.id
      LEFT JOIN (
        SELECT user_id, max(created_at) as last_tx_at FROM transactions GROUP BY user_id
      ) tx ON tx.user_id = u.id
      LEFT JOIN (
        SELECT user_id, max(updated_at) as last_streak_at FROM player_login_streaks GROUP BY user_id
      ) ls ON ls.user_id = u.id
      LEFT JOIN ranked_player_stats st ON st.user_id = u.id
    )
    SELECT 
      id,
      username,
      email,
      created_at,
      last_sign_in_at,
      true_last_active,
      round(extract(epoch from (NOW() - true_last_active)) / 86400, 1) as dias_sin_conexion,
      total_partidas,
      wins,
      losses,
      draws,
      rooms_count,
      elo_rating,
      gold_balance,
      gems_balance,
      referidor,
      is_banned,
      ban_reason
    FROM all_act
    WHERE true_last_active < NOW() - INTERVAL '20 days'
      AND total_partidas BETWEEN 0 AND 15
    ORDER BY total_partidas ASC, dias_sin_conexion DESC;
  `

  const res = await client.query(query)
  console.log(`Total cuentas encontradas: ${res.rows.length}`)

  // Generar CSV
  const headers = [
    'UUID',
    'Username',
    'Email',
    'Fecha_Registro',
    'Ultima_Conexion_Auth',
    'Ultima_Actividad_Real',
    'Dias_Sin_Conexion',
    'Total_Partidas',
    'Victorias',
    'Derrotas',
    'Empates',
    'Salas_Creadas_O_Jugadas',
    'ELO_Copas',
    'Balance_Oro',
    'Balance_Gemas',
    'Referido_Por',
    'Baneado',
    'Motivo_Ban'
  ]

  const csvRows = [headers.join(',')]

  for (const row of res.rows) {
    const values = [
      row.id,
      `"${(row.username || '').replace(/"/g, '""')}"`,
      `"${(row.email || '').replace(/"/g, '""')}"`,
      row.created_at ? new Date(row.created_at).toISOString().slice(0, 19).replace('T', ' ') : '',
      row.last_sign_in_at ? new Date(row.last_sign_in_at).toISOString().slice(0, 19).replace('T', ' ') : '',
      row.true_last_active ? new Date(row.true_last_active).toISOString().slice(0, 19).replace('T', ' ') : '',
      row.dias_sin_conexion,
      row.total_partidas,
      row.wins,
      row.losses,
      row.draws,
      row.rooms_count,
      row.elo_rating,
      row.gold_balance,
      row.gems_balance,
      `"${(row.referidor || 'Ninguno').replace(/"/g, '""')}"`,
      row.is_banned ? 'SI' : 'NO',
      `"${(row.ban_reason || '').replace(/"/g, '""')}"`
    ]
    csvRows.push(values.join(','))
  }

  const reportsDir = path.resolve(__dirname, '../reports')
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }

  const outputPath = path.join(reportsDir, 'auditoria_cuentas_inactivas_20d_0_a_15_partidas.csv')
  fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf8')
  console.log(`Reporte CSV exportado exitosamente en: ${outputPath}`)

  // Guardar también un resumen JSON agrupado para análisis
  const summary = {
    total_cuentas: res.rows.length,
    fecha_auditoria: new Date().toISOString(),
    criterios: {
      inactividad: '> 20 dias sin conexion o actividad real',
      partidas: 'Entre 0 y 15 partidas (wins + losses o salas)',
    },
    distribucion_por_partidas: {},
    distribucion_por_dias: {
      '20_a_25_dias': 0,
      '26_a_30_dias': 0,
      '31_a_40_dias': 0,
      'mas_de_40_dias': 0,
    },
    con_referidor: 0,
    baneadas: 0,
    oro_total_inmovilizado: 0,
    gemas_totales_inmovilizadas: 0,
  }

  for (const r of res.rows) {
    summary.distribucion_por_partidas[r.total_partidas] = (summary.distribucion_por_partidas[r.total_partidas] || 0) + 1
    const d = parseFloat(r.dias_sin_conexion)
    if (d <= 25) summary.distribucion_por_dias['20_a_25_dias']++
    else if (d <= 30) summary.distribucion_por_dias['26_a_30_dias']++
    else if (d <= 40) summary.distribucion_por_dias['31_a_40_dias']++
    else summary.distribucion_por_dias['mas_de_40_dias']++

    if (r.referidor) summary.con_referidor++
    if (r.is_banned) summary.baneadas++
    summary.oro_total_inmovilizado += parseInt(r.gold_balance, 10) || 0
    summary.gemas_totales_inmovilizadas += parseFloat(r.gems_balance) || 0
  }

  const jsonSummaryPath = path.join(reportsDir, 'resumen_auditoria_inactivas.json')
  fs.writeFileSync(jsonSummaryPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`Resumen JSON guardado en: ${jsonSummaryPath}`)
}

run()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => {
    client.end()
  })
