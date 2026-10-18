import pg from 'pg';
import fs from 'fs';

const pool = new pg.Pool({ connectionString: 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres' });
const res = await pool.query("SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'buy_packs'");
if (res.rows.length > 0) {
  fs.writeFileSync('scratch_buy_packs.sql', res.rows[0].def);
  console.log('Saved scratch_buy_packs.sql');
} else {
  console.log('No proc found');
}
await pool.end();
