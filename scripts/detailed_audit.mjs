import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) connectionString = match[1];
  }
}
if (!connectionString) {
  connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres';
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();

  console.log('--- 1. TOP REFERRERS NO BANEADOS CON REFERIDOS ---');
  const topRef = await client.query(`
    SELECT 
      p.id,
      p.username,
      p.elo_rating,
      p.gold_balance,
      p.gems_balance,
      COUNT(r.referred_id) as total_ref,
      COUNT(r.valid_at) as valid_ref,
      COUNT(r.gold_claimed_at) as gold_claimed,
      COUNT(CASE WHEN ref_p.is_banned THEN 1 END) as banned_ref
    FROM profiles p
    JOIN referrals r ON r.referrer_id = p.id
    LEFT JOIN profiles ref_p ON ref_p.id = r.referred_id
    WHERE p.is_banned = FALSE
    GROUP BY p.id, p.username, p.elo_rating, p.gold_balance, p.gems_balance
    HAVING COUNT(r.referred_id) >= 2
    ORDER BY valid_ref DESC, total_ref DESC
    LIMIT 20;
  `);
  console.log(JSON.stringify(topRef.rows, null, 2));

  console.log('\n--- 2. PAREJAS DE WIN-TRADING EN RANKED (>= 4 PARTIDAS RANKED) ---');
  const winTrading = await client.query(`
    WITH ranked_pairs AS (
      SELECT 
        LEAST(player1_id, player2_id) as user_a,
        GREATEST(player1_id, player2_id) as user_b,
        COUNT(*) as total_matches,
        COUNT(CASE WHEN status = 'p1_won' AND player1_id = LEAST(player1_id, player2_id) THEN 1 
                   WHEN status = 'p2_won' AND player2_id = LEAST(player1_id, player2_id) THEN 1 END) as user_a_wins,
        COUNT(CASE WHEN status = 'p1_won' AND player1_id = GREATEST(player1_id, player2_id) THEN 1 
                   WHEN status = 'p2_won' AND player2_id = GREATEST(player1_id, player2_id) THEN 1 END) as user_b_wins,
        COUNT(CASE WHEN status = 'abandoned' OR status = 'draw' THEN 1 END) as other_matches,
        ROUND(AVG(EXTRACT(EPOCH FROM (settled_at - created_at)))) as avg_duration_sec,
        MIN(created_at) as first_match,
        MAX(created_at) as last_match
      FROM game_rooms
      WHERE mode = 'ranked' 
        AND player1_id IS NOT NULL 
        AND player2_id IS NOT NULL
        AND settled_at IS NOT NULL
      GROUP BY LEAST(player1_id, player2_id), GREATEST(player1_id, player2_id)
      HAVING COUNT(*) >= 4
    )
    SELECT 
      pa.id as a_id,
      pa.username as player_a,
      pa.is_banned as a_banned,
      pa.elo_rating as a_elo,
      pb.id as b_id,
      pb.username as player_b,
      pb.is_banned as b_banned,
      pb.elo_rating as b_elo,
      rp.total_matches,
      rp.user_a_wins,
      rp.user_b_wins,
      rp.avg_duration_sec,
      rp.first_match,
      rp.last_match,
      CASE WHEN ref.referred_id IS NOT NULL THEN 'SI (A ref B)'
           WHEN ref2.referred_id IS NOT NULL THEN 'SI (B ref A)'
           ELSE 'NO' END as referral_link
    FROM ranked_pairs rp
    JOIN profiles pa ON pa.id = rp.user_a
    JOIN profiles pb ON pb.id = rp.user_b
    LEFT JOIN referrals ref ON ref.referrer_id = rp.user_a AND ref.referred_id = rp.user_b
    LEFT JOIN referrals ref2 ON ref2.referrer_id = rp.user_b AND ref2.referred_id = rp.user_a
    WHERE (pa.is_banned = FALSE OR pb.is_banned = FALSE)
    ORDER BY rp.total_matches DESC, rp.avg_duration_sec ASC
    LIMIT 25;
  `);
  console.log(JSON.stringify(winTrading.rows, null, 2));

  console.log('\n--- 3. JUGADORES >= 1300 ELO CON PARTIDAS ANORMALES O 0 PARTIDAS ---');
  const abnormal1300 = await client.query(`
    WITH player_stats AS (
      SELECT 
        p.id,
        p.username,
        p.elo_rating,
        p.created_at,
        p.is_banned,
        p.gold_balance,
        p.gems_balance,
        COUNT(gr.id) as total_ranked_played,
        COUNT(CASE WHEN (gr.player1_id = p.id AND gr.status = 'p1_won') OR (gr.player2_id = p.id AND gr.status = 'p2_won') THEN 1 END) as ranked_wins,
        ref.referrer_id,
        ref_p.username as referrer_username
      FROM profiles p
      LEFT JOIN game_rooms gr ON (gr.player1_id = p.id OR gr.player2_id = p.id) AND gr.mode = 'ranked' AND gr.settled_at IS NOT NULL
      LEFT JOIN referrals ref ON ref.referred_id = p.id
      LEFT JOIN profiles ref_p ON ref_p.id = ref.referrer_id
      WHERE p.elo_rating >= 1300 AND p.is_banned = FALSE
      GROUP BY p.id, p.username, p.elo_rating, p.created_at, p.is_banned, p.gold_balance, p.gems_balance, ref.referrer_id, ref_p.username
    )
    SELECT 
      id,
      username,
      elo_rating,
      total_ranked_played,
      ranked_wins,
      referrer_username,
      gold_balance,
      gems_balance,
      created_at
    FROM player_stats
    WHERE total_ranked_played <= 5
    ORDER BY total_ranked_played ASC, elo_rating DESC
    LIMIT 30;
  `);
  console.log(JSON.stringify(abnormal1300.rows, null, 2));

  console.log('\n--- 4. DETALLE DE USUARIOS JON SNOW / GHOST / DAINERIS ---');
  const jonCluster = await client.query(`
    SELECT p.id, p.username, u.email, p.elo_rating, p.gold_balance, p.gems_balance, p.is_banned, p.created_at,
           r.referrer_id, ref_p.username as referrer_name
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN referrals r ON r.referred_id = p.id
    LEFT JOIN profiles ref_p ON ref_p.id = r.referrer_id
    WHERE p.username IN ('Jon Snow', 'Ghost', 'Daineris', 'Elas Sylphiel', 'issegab', 'elcruel', 'Sadokun');
  `);
  console.log(JSON.stringify(jonCluster.rows, null, 2));

  console.log('\n--- 5. REFERIDOS DE JON SNOW, ELAS SYLPHIEL, Y OTROS ---');
  const refsOfSuspicious = await client.query(`
    SELECT 
      ref_p.username as referrer,
      p.id as referred_id,
      p.username as referred_name,
      u.email as referred_email,
      p.elo_rating,
      p.gold_balance,
      p.gems_balance,
      p.is_banned,
      r.valid_at,
      r.gold_claimed_at,
      r.created_at as ref_date
    FROM referrals r
    JOIN profiles ref_p ON ref_p.id = r.referrer_id
    JOIN profiles p ON p.id = r.referred_id
    JOIN auth.users u ON u.id = p.id
    WHERE ref_p.username IN ('Jon Snow', 'Elas Sylphiel', 'issegab', 'elcruel', 'Sadokun')
    ORDER BY ref_p.username, r.created_at;
  `);
  console.log(JSON.stringify(refsOfSuspicious.rows, null, 2));

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
