import pg from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres';
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();

  // 1. Resumen general
  const generalRes = await client.query(`
    SELECT 
      COUNT(*) AS total_profiles,
      COUNT(*) FILTER (WHERE gems_balance > 0) AS users_with_gems,
      COUNT(*) FILTER (WHERE (gems_balance - LEAST(gems_balance, COALESCE(locked_gems_balance, 0))) > 0) AS users_with_withdrawable,
      COUNT(*) FILTER (WHERE LEAST(gems_balance, COALESCE(locked_gems_balance, 0)) > 0) AS users_with_locked,
      COUNT(*) FILTER (WHERE (gems_balance - LEAST(gems_balance, COALESCE(locked_gems_balance, 0))) > 0 AND LEAST(gems_balance, COALESCE(locked_gems_balance, 0)) > 0) AS users_mixed,
      COUNT(*) FILTER (WHERE (gems_balance - LEAST(gems_balance, COALESCE(locked_gems_balance, 0))) > 0 AND LEAST(gems_balance, COALESCE(locked_gems_balance, 0)) = 0) AS users_only_withdrawable,
      COUNT(*) FILTER (WHERE (gems_balance - LEAST(gems_balance, COALESCE(locked_gems_balance, 0))) = 0 AND LEAST(gems_balance, COALESCE(locked_gems_balance, 0)) > 0) AS users_only_locked,
      ROUND(SUM(gems_balance)::numeric, 2) AS total_gems,
      ROUND(SUM(LEAST(gems_balance, COALESCE(locked_gems_balance, 0)))::numeric, 2) AS total_locked,
      ROUND(SUM(GREATEST(0, gems_balance - LEAST(gems_balance, COALESCE(locked_gems_balance, 0))))::numeric, 2) AS total_withdrawable
    FROM public.profiles;
  `);
  
  // 2. Retiros en transactions
  const withdrawalsRes = await client.query(`
    SELECT status, COUNT(*)::int as count, ROUND(COALESCE(SUM(amount_gems), 0)::numeric, 2) AS sum_gems
    FROM public.transactions
    WHERE type = 'withdrawal'
    GROUP BY status;
  `);

  // 3. Depósitos en transactions
  const depositsRes = await client.query(`
    SELECT status, COUNT(*)::int as count, ROUND(COALESCE(SUM(amount_gems), 0)::numeric, 2) AS sum_gems
    FROM public.transactions
    WHERE type = 'deposit'
    GROUP BY status;
  `);

  // 4. Todos los usuarios con gemas
  const usersRes = await client.query(`
    SELECT 
      id,
      username,
      ROUND(gems_balance::numeric, 2) AS total_gems,
      ROUND(LEAST(gems_balance, COALESCE(locked_gems_balance, 0))::numeric, 2) AS locked_gems,
      ROUND(GREATEST(0, gems_balance - LEAST(gems_balance, COALESCE(locked_gems_balance, 0)))::numeric, 2) AS withdrawable_gems,
      ROUND(COALESCE(gold_balance, 0)::numeric, 0) AS gold_balance,
      ROUND(COALESCE(elo_rating, 1000)::numeric, 0) AS elo,
      COALESCE(is_banned, false) as is_banned,
      created_at
    FROM public.profiles
    WHERE gems_balance > 0 OR locked_gems_balance > 0
    ORDER BY gems_balance DESC, withdrawable_gems DESC;
  `);

  const payload = {
    general: generalRes.rows[0],
    withdrawals: withdrawalsRes.rows,
    deposits: depositsRes.rows,
    total_users_with_gems: usersRes.rows.length,
    users: usersRes.rows
  };

  fs.writeFileSync('scripts/audit_output.json', JSON.stringify(payload, null, 2));
  console.log('✅ Auditoría exportada con éxito a scripts/audit_output.json');
  console.log('Total usuarios con saldo:', usersRes.rows.length);
  console.log('Métricas globales:', generalRes.rows[0]);

  await client.end();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
