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

const client = new pg.Client({
  connectionString,
});

async function main() {
  await client.connect();
  console.log('=== AUDITORÍA INTEGRAL DE MULTICUENTAS, GRANJAS Y WIN-TRADING ===\n');

  // 1. TOP REFERRERS CON MAYOR ACTIVIDAD (NO BANEADOS)
  console.log('--- 1. TOP REFERRERS NO BANEADOS CON REFERIDOS VÁLIDOS/TOTALES ---');
  const topReferrers = await client.query(`
    SELECT 
      p.id,
      p.username,
      p.elo_rating,
      p.gold_balance,
      p.gems_balance,
      p.is_banned,
      COUNT(r.referred_id) as total_referred,
      COUNT(r.valid_at) as valid_referred,
      COUNT(r.gold_claimed_at) as gold_claimed_count,
      COUNT(CASE WHEN ref_p.is_banned THEN 1 END) as banned_referred_count
    FROM profiles p
    JOIN referrals r ON r.referrer_id = p.id
    LEFT JOIN profiles ref_p ON ref_p.id = r.referred_id
    WHERE p.is_banned = FALSE
    GROUP BY p.id, p.username, p.elo_rating, p.gold_balance, p.gems_balance, p.is_banned
    HAVING COUNT(r.referred_id) >= 3
    ORDER BY valid_referred DESC, total_referred DESC
    LIMIT 25;
  `);
  console.table(topReferrers.rows);

  // 2. DETECCIÓN DE WIN-TRADING EN PARTIDAS RANKED (PAREJAS REPETITIVAS)
  console.log('\n--- 2. SOSPECHA DE WIN-TRADING (PAREJAS CON >= 5 PARTIDAS RANKED MUTUAS) ---');
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
      HAVING COUNT(*) >= 5
    )
    SELECT 
      pa.username as player_a,
      pa.is_banned as a_banned,
      pa.elo_rating as a_elo,
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
    LIMIT 30;
  `);
  console.table(winTrading.rows);

  // 3. ANÁLISIS DE CORREOS / PATRONES SECUENCIALES EN CUENTAS ACTIVAS
  console.log('\n--- 3. PATRONES SECUENCIALES DE EMAILS / USERNAMES SOSPECHOSOS ---');
  const sequentialAccounts = await client.query(`
    SELECT 
      p.id,
      p.username,
      u.email,
      p.elo_rating,
      p.is_banned,
      p.created_at,
      p.gold_balance,
      p.gems_balance,
      ref.referrer_id,
      ref_p.username as referrer_username
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN referrals ref ON ref.referred_id = p.id
    LEFT JOIN profiles ref_p ON ref_p.id = ref.referrer_id
    WHERE p.is_banned = FALSE
      AND (
        u.email ~* '^[a-zA-Z]+[0-9]{3,}@'
        OR p.username ~* '[0-9]{3,}$'
        OR u.email LIKE '%temp%'
        OR u.email LIKE '%fake%'
        OR u.email LIKE '%bot%'
      )
    ORDER BY p.created_at DESC
    LIMIT 30;
  `);
  console.table(sequentialAccounts.rows);

  // 4. JUGADORES QUE SUBIERON A >= 1300 COPAS CON MUY POCAS PARTIDAS O PARTIDAS ANORMALES
  console.log('\n--- 4. JUGADORES >= 1300 COPAS CON PARTIDAS RANKED Y RATIOS SOSPECHOSOS ---');
  const suspicious1300 = await client.query(`
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
      username,
      elo_rating,
      total_ranked_played,
      ranked_wins,
      ROUND(ranked_wins::numeric / NULLIF(total_ranked_played, 0)::numeric * 100, 1) as winrate_pct,
      referrer_username,
      gold_balance,
      gems_balance,
      created_at
    FROM player_stats
    WHERE total_ranked_played < 10 OR (ranked_wins = total_ranked_played AND total_ranked_played >= 5)
    ORDER BY total_ranked_played ASC, elo_rating DESC
    LIMIT 30;
  `);
  console.table(suspicious1300.rows);

  // 5. MOVIMIENTOS SOSPECHOSOS EN MARKETPLACE (TRANSFERENCIA ENTRE CUENTAS / WASH TRADING)
  console.log('\n--- 5. VENTAS EN MARKETPLACE ENTRE MISMOS JUGADORES / REFERIDOS ---');
  const marketWash = await client.query(`
    SELECT 
      seller.username as seller_name,
      seller.is_banned as seller_banned,
      buyer.username as buyer_name,
      buyer.is_banned as buyer_banned,
      ml.item_type,
      ml.item_id,
      ml.quantity,
      ml.price_gems,
      ml.created_at,
      ml.closed_at,
      CASE WHEN r1.referred_id IS NOT NULL THEN 'SI (Seller ref Buyer)'
           WHEN r2.referred_id IS NOT NULL THEN 'SI (Buyer ref Seller)'
           ELSE 'NO' END as referral_link
    FROM marketplace_listings ml
    JOIN profiles seller ON seller.id = ml.seller_id
    JOIN profiles buyer ON buyer.id = ml.buyer_id
    LEFT JOIN referrals r1 ON r1.referrer_id = ml.seller_id AND r1.referred_id = ml.buyer_id
    LEFT JOIN referrals r2 ON r2.referrer_id = ml.buyer_id AND r2.referred_id = ml.seller_id
    WHERE ml.status = 'sold'
      AND (r1.referred_id IS NOT NULL OR r2.referred_id IS NOT NULL OR ml.price_gems >= 500)
    ORDER BY ml.closed_at DESC
    LIMIT 30;
  `);
  console.table(marketWash.rows);

  await client.end();
}

main().catch(err => {
  console.error('Error en auditoría:', err);
  process.exit(1);
});
