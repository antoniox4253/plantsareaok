import pg from 'pg';

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres';
const client = new pg.Client({ connectionString });

async function run() {
  await client.connect();

  console.log('=== 1. TOP REFERRERS ===');
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
    LIMIT 15;
  `);
  console.table(topRef.rows);

  console.log('\n=== 2. RANKED WIN-TRADING PAIRS ===');
  const rankedPairs = await client.query(`
    WITH ranked_pairs AS (
      SELECT 
        LEAST(player1_id, player2_id) as user_a,
        GREATEST(player1_id, player2_id) as user_b,
        COUNT(*) as total_matches,
        COUNT(CASE WHEN status = 'p1_won' AND player1_id = LEAST(player1_id, player2_id) THEN 1 
                   WHEN status = 'p2_won' AND player2_id = LEAST(player1_id, player2_id) THEN 1 END) as user_a_wins,
        COUNT(CASE WHEN status = 'p1_won' AND player1_id = GREATEST(player1_id, player2_id) THEN 1 
                   WHEN status = 'p2_won' AND player2_id = GREATEST(player1_id, player2_id) THEN 1 END) as user_b_wins,
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
      CASE WHEN ref.referred_id IS NOT NULL THEN 'SI (A ref B)'
           WHEN ref2.referred_id IS NOT NULL THEN 'SI (B ref A)'
           ELSE 'NO' END as referral_link
    FROM ranked_pairs rp
    JOIN profiles pa ON pa.id = rp.user_a
    JOIN profiles pb ON pb.id = rp.user_b
    WHERE (pa.is_banned = FALSE OR pb.is_banned = FALSE)
    ORDER BY rp.total_matches DESC, rp.avg_duration_sec ASC;
  `);
  console.table(rankedPairs.rows);

  console.log('\n=== 3. CUENTAS >= 1300 ELO CON <= 5 PARTIDAS RANKED ===');
  const abnormal = await client.query(`
    WITH player_stats AS (
      SELECT 
        p.id,
        p.username,
        p.elo_rating,
        COUNT(gr.id) as total_ranked_played,
        COUNT(CASE WHEN (gr.player1_id = p.id AND gr.status = 'p1_won') OR (gr.player2_id = p.id AND gr.status = 'p2_won') THEN 1 END) as ranked_wins,
        ref_p.username as referrer_username
      FROM profiles p
      LEFT JOIN game_rooms gr ON (gr.player1_id = p.id OR gr.player2_id = p.id) AND gr.mode = 'ranked' AND gr.settled_at IS NOT NULL
      LEFT JOIN referrals ref ON ref.referred_id = p.id
      LEFT JOIN profiles ref_p ON ref_p.id = ref.referrer_id
      WHERE p.elo_rating >= 1300 AND p.is_banned = FALSE
      GROUP BY p.id, p.username, p.elo_rating, ref_p.username
    )
    SELECT *
    FROM player_stats
    WHERE total_ranked_played <= 5
    ORDER BY total_ranked_played ASC, elo_rating DESC;
  `);
  console.table(abnormal.rows);

  await client.end();
}

run().catch(console.error);
