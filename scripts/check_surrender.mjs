import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'surrender_match';
  `);
  console.log(res.rows[0]?.def);
  await client.end();
}

main().catch(console.error);
