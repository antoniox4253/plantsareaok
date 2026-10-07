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
  console.log('--- INICIO AUDITORÍA PLANT ARENA ---')

  // 1. Partidas jugadas y desglose general
  console.log('\n=== 1. PARTIDAS JUGADAS HASTA EL MOMENTO ===')
  const resRooms = await client.query(`
    SELECT
      count(*) as total_rooms,
      count(*) filter (where status = 'p1_won') as p1_won,
      count(*) filter (where status = 'p2_won') as p2_won,
      count(*) filter (where status = 'draw') as draw,
      count(*) filter (where status = 'abandoned') as abandoned,
      count(*) filter (where status = 'playing') as playing,
      count(*) filter (where mode = 'ranked') as ranked,
      count(*) filter (where mode = 'friendly') as friendly,
      count(*) filter (where mode = 'tournament') as tournament,
      count(*) filter (where is_async_match = true) as async_matches,
      count(*) filter (where is_async_match = false) as live_matches,
      min(created_at) as primer_partida,
      max(created_at) as ultima_partida
    FROM game_rooms;
  `)
  console.table(resRooms.rows)

  // Evolución semanal (Pico vs Actual)
  console.log('\n--- EVOLUCIÓN SEMANAL DE PARTIDAS (PICO VS ACTUAL) ---')
  const resWeekly = await client.query(`
    SELECT
      to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as semana,
      count(*) as partidas,
      count(distinct player1_id) as jugadores_activos,
      round(count(*)::numeric / nullif(count(distinct player1_id), 0), 1) as partidas_por_jugador,
      count(*) filter (where status = 'p1_won') as victorias_p1,
      count(*) filter (where status = 'p2_won') as victorias_p2,
      count(*) filter (where status = 'abandoned') as abandonadas
    FROM game_rooms
    GROUP BY 1
    ORDER BY 1;
  `)
  console.table(resWeekly.rows)

  // 2. Duración de las partidas
  console.log('\n=== 2. DURACIÓN DE LAS PARTIDAS ===')
  const resDuration = await client.query(`
    WITH duraciones AS (
      SELECT
        id,
        created_at,
        extract(epoch from (settled_at - started_at)) as duracion_seg
      FROM game_rooms
      WHERE started_at IS NOT NULL
        AND settled_at IS NOT NULL
        AND status IN ('p1_won', 'p2_won', 'draw')
        AND extract(epoch from (settled_at - started_at)) >= 5
    )
    SELECT
      count(*) as partidas_analizadas,
      round(avg(duracion_seg)::numeric, 1) as prom_global_seg,
      round((avg(duracion_seg) / 60.0)::numeric, 2) as prom_global_min,
      round(percentile_cont(0.5) within group (order by duracion_seg)::numeric, 1) as mediana_seg,
      round((percentile_cont(0.5) within group (order by duracion_seg) / 60.0)::numeric, 2) as mediana_min,
      round(percentile_cont(0.25) within group (order by duracion_seg)::numeric, 1) as p25_seg,
      round(percentile_cont(0.75) within group (order by duracion_seg)::numeric, 1) as p75_seg,
      round(percentile_cont(0.90) within group (order by duracion_seg)::numeric, 1) as p90_seg,
      round(avg(duracion_seg) filter (where duracion_seg <= 600)::numeric, 1) as prom_sin_inactivos_seg,
      round((avg(duracion_seg) filter (where duracion_seg <= 600) / 60.0)::numeric, 2) as prom_sin_inactivos_min,
      count(*) filter (where duracion_seg < 60) as menos_1m,
      count(*) filter (where duracion_seg >= 60 and duracion_seg < 120) as entre_1m_2m,
      count(*) filter (where duracion_seg >= 120 and duracion_seg < 180) as entre_2m_3m,
      count(*) filter (where duracion_seg >= 180 and duracion_seg < 300) as entre_3m_5m,
      count(*) filter (where duracion_seg >= 300) as mas_5m
    FROM duraciones;
  `)
  console.table(resDuration.rows)

  // Duración semanal (para ver si cambió la duración de partida con el tiempo)
  console.log('\n--- DURACIÓN MEDIANA Y PROMEDIO POR SEMANA ---')
  const resDurationWeekly = await client.query(`
    WITH duraciones AS (
      SELECT
        to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as semana,
        extract(epoch from (settled_at - started_at)) as duracion_seg
      FROM game_rooms
      WHERE started_at IS NOT NULL
        AND settled_at IS NOT NULL
        AND status IN ('p1_won', 'p2_won', 'draw')
        AND extract(epoch from (settled_at - started_at)) >= 5
    )
    SELECT
      semana,
      count(*) as partidas,
      round(percentile_cont(0.5) within group (order by duracion_seg)::numeric, 1) as mediana_seg,
      round(avg(duracion_seg) filter (where duracion_seg <= 600)::numeric, 1) as prom_seg
    FROM duraciones
    GROUP BY semana
    ORDER BY semana;
  `)
  console.table(resDurationWeekly.rows)

  // 3. Soles producidos en partidas
  console.log('\n=== 3. SOLES PRODUCIDOS EN PARTIDAS ===')
  const resSun = await client.query(`
    WITH room_sun AS (
      SELECT
        room_id,
        count(*) as collects,
        count(*) * 25 as soles_recolectados
      FROM match_actions
      WHERE kind = 'collect'
      GROUP BY room_id
    )
    SELECT
      count(*) as partidas_con_colectas,
      sum(collects) as total_colectas,
      sum(soles_recolectados) as total_soles,
      round(avg(soles_recolectados)::numeric, 1) as prom_soles_por_partida,
      percentile_cont(0.5) within group (order by soles_recolectados) as mediana_soles_partida,
      min(soles_recolectados) as min_soles,
      max(soles_recolectados) as max_soles
    FROM room_sun;
  `)
  console.table(resSun.rows)

  // Evolución semanal de soles
  console.log('\n--- EVOLUCIÓN SEMANAL DE SOLES POR PARTIDA ---')
  const resSunWeekly = await client.query(`
    WITH room_stats AS (
      SELECT
        r.id as room_id,
        to_char(date_trunc('week', r.created_at), 'YYYY-MM-DD') as semana,
        count(a.id) filter (where a.kind = 'collect') * 25 as soles_recolectados
      FROM game_rooms r
      LEFT JOIN match_actions a ON a.room_id = r.id
      WHERE r.status IN ('p1_won', 'p2_won', 'draw')
      GROUP BY r.id, r.created_at
    )
    SELECT
      semana,
      count(*) as partidas,
      sum(soles_recolectados) as total_soles_semana,
      round(avg(soles_recolectados)::numeric, 1) as prom_soles_por_partida,
      percentile_cont(0.5) within group (order by soles_recolectados) as mediana_soles
    FROM room_stats
    GROUP BY semana
    ORDER BY semana;
  `)
  console.table(resSunWeekly.rows)

  // 4. Plantas colocadas por jugador
  console.log('\n=== 4. PLANTAS COLOCADAS POR JUGADOR ===')
  const resPlantsPlaced = await client.query(`
    WITH player_room_plants AS (
      SELECT
        room_id,
        user_id,
        count(*) as plantas_colocadas
      FROM match_actions
      WHERE kind = 'plant'
      GROUP BY room_id, user_id
    )
    SELECT
      count(*) as total_registros_jugador_partida,
      sum(plantas_colocadas) as total_plantas_colocadas,
      round(avg(plantas_colocadas)::numeric, 1) as prom_plantas_por_partida_jugador,
      percentile_cont(0.5) within group (order by plantas_colocadas) as mediana_plantas_partida,
      min(plantas_colocadas) as min_plantas,
      max(plantas_colocadas) as max_plantas
    FROM player_room_plants;
  `)
  console.table(resPlantsPlaced.rows)

  // Top plantas más colocadas
  console.log('\n--- TOP 10 PLANTAS MÁS COLOCADAS ---')
  const resTopPlants = await client.query(`
    SELECT
      plant_id,
      count(*) as total_sembradas,
      round(count(*)::numeric * 100.0 / sum(count(*)) over (), 2) as porcentaje
    FROM match_actions
    WHERE kind = 'plant'
    GROUP BY plant_id
    ORDER BY total_sembradas DESC
    LIMIT 10;
  `)
  console.table(resTopPlants.rows)

  // 6. Cantidad de partidas por jugador
  console.log('\n=== 6. CANTIDAD DE PARTIDAS POR JUGADORES ===')
  const resMatchesPerPlayer = await client.query(`
    WITH partidas_por_usuario AS (
      SELECT
        player1_id as user_id,
        count(*) as total_partidas
      FROM game_rooms
      GROUP BY player1_id
    )
    SELECT
      count(*) as jugadores_con_partidas,
      sum(total_partidas) as suma_partidas,
      round(avg(total_partidas)::numeric, 1) as prom_partidas_por_jugador,
      percentile_cont(0.5) within group (order by total_partidas) as mediana_partidas,
      percentile_cont(0.75) within group (order by total_partidas) as p75_partidas,
      percentile_cont(0.90) within group (order by total_partidas) as p90_partidas,
      max(total_partidas) as max_partidas_un_jugador,
      count(*) filter (where total_partidas = 1) as jugadores_1_partida,
      count(*) filter (where total_partidas between 2 and 5) as jugadores_2_a_5,
      count(*) filter (where total_partidas between 6 and 20) as jugadores_6_a_20,
      count(*) filter (where total_partidas between 21 and 50) as jugadores_21_a_50,
      count(*) filter (where total_partidas between 51 and 100) as jugadores_51_a_100,
      count(*) filter (where total_partidas between 101 and 500) as jugadores_101_a_500,
      count(*) filter (where total_partidas > 500) as jugadores_mas_de_500
    FROM partidas_por_usuario;
  `)
  console.table(resMatchesPerPlayer.rows)

  // Top 10 jugadores con más partidas
  console.log('\n--- TOP 10 JUGADORES CON MÁS PARTIDAS ---')
  const resTopPlayers = await client.query(`
    SELECT
      p.username,
      count(r.id) as partidas_jugadas,
      count(r.id) filter (where r.status = 'p1_won') as victorias,
      round(count(r.id) filter (where r.status = 'p1_won')::numeric * 100.0 / nullif(count(r.id), 0), 1) as winrate_pct,
      p.elo_rating
    FROM game_rooms r
    JOIN profiles p ON p.id = r.player1_id
    GROUP BY p.id, p.username, p.elo_rating
    ORDER BY partidas_jugadas DESC
    LIMIT 10;
  `)
  console.table(resTopPlayers.rows)

  // 7. Victorias por jugadores
  console.log('\n=== 7. VICTORIAS POR JUGADORES ===')
  const resWins = await client.query(`
    SELECT
      count(*) as total_jugadores_con_stats,
      sum(wins) as total_victorias,
      sum(losses) as total_derrotas,
      round(avg(wins)::numeric, 1) as prom_victorias_por_jugador,
      percentile_cont(0.5) within group (order by wins) as mediana_victorias,
      max(wins) as max_victorias,
      round(sum(wins)::numeric * 100.0 / nullif(sum(wins + losses), 0), 2) as winrate_global_pct,
      count(*) filter (where wins = 0) as jugadores_0_victorias,
      count(*) filter (where wins between 1 and 5) as jugadores_1_a_5_victorias,
      count(*) filter (where wins between 6 and 20) as jugadores_6_a_20_victorias,
      count(*) filter (where wins between 21 and 100) as jugadores_21_a_100_victorias,
      count(*) filter (where wins > 100) as jugadores_mas_de_100_victorias
    FROM ranked_player_stats;
  `)
  console.table(resWins.rows)

  // 8. Jugadores a partir de la Arena 3
  console.log('\n=== 8. JUGADORES A PARTIR DE LA ARENA 3 ===')
  const resArenas = await client.query(`
    SELECT
      count(*) as total_perfiles,
      count(*) filter (where elo_rating <= 1600) as arena_1_clasico,
      count(*) filter (where elo_rating between 1601 and 2000) as arena_2_desierto,
      count(*) filter (where elo_rating between 2001 and 3000) as arena_3_cyberpunk,
      count(*) filter (where elo_rating between 3001 and 4000) as arena_4_coliseo,
      count(*) filter (where elo_rating >= 4001) as arena_5_infinito,
      count(*) filter (where elo_rating >= 2001) as total_arena_3_o_mas,
      round(count(*) filter (where elo_rating >= 2001)::numeric * 100.0 / nullif(count(*), 0), 2) as porcentaje_del_total
    FROM profiles;
  `)
  console.table(resArenas.rows)

  // Arena 3 entre jugadores activos (con al menos 1 partida)
  console.log('\n--- JUGADORES EN ARENA 3 O MÁS QUE SON ACTIVOS (AL MENOS 1 PARTIDA) ---')
  const resArenasActive = await client.query(`
    WITH jugadores_activos AS (
      SELECT distinct player1_id as user_id FROM game_rooms
    )
    SELECT
      count(*) as activos_totales,
      count(*) filter (where p.elo_rating <= 1600) as arena_1,
      count(*) filter (where p.elo_rating between 1601 and 2000) as arena_2,
      count(*) filter (where p.elo_rating between 2001 and 3000) as arena_3,
      count(*) filter (where p.elo_rating between 3001 and 4000) as arena_4,
      count(*) filter (where p.elo_rating >= 4001) as arena_5,
      count(*) filter (where p.elo_rating >= 2001) as activos_arena_3_o_mas,
      round(count(*) filter (where p.elo_rating >= 2001)::numeric * 100.0 / nullif(count(*), 0), 2) as pct_activos_arena_3_o_mas
    FROM jugadores_activos ja
    JOIN profiles p ON p.id = ja.user_id;
  `)
  console.table(resArenasActive.rows)

  console.log('--- FIN AUDITORÍA ---')
}

run()
  .catch((err) => {
    console.error('Error durante la auditoría:', err)
    process.exit(1)
  })
  .finally(() => {
    client.end()
  })
