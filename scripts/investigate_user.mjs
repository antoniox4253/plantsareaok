import pg from 'pg';

const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres';
const pool = new pg.Pool({ connectionString });

async function investigate() {
  const uid = 'a9c3e1af-105c-42cf-b7f3-2c9978968cdf';
  console.log('Investigating User ID:', uid);

  const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    const colsRes = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
      [tableName]
    );
    for (const col of colsRes.rows) {
      if (['uuid', 'text', 'character varying'].includes(col.data_type)) {
        try {
          const q = `SELECT count(*) as cnt FROM public."${tableName}" WHERE "${col.column_name}"::text = $1`;
          const countRes = await pool.query(q, [uid]);
          const cnt = parseInt(countRes.rows[0].cnt, 10);
          if (cnt > 0) {
            console.log(`-> ${tableName}.${col.column_name}: ${cnt} record(s)`);
          }
        } catch (e) {
          // ignore column mismatch errors
        }
      }
    }
  }

  // Also search for 'Jaimerodriguez' string in text columns
  console.log('\nSearching for username string "Jaimerodriguez"...');
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    const colsRes = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
      [tableName]
    );
    for (const col of colsRes.rows) {
      if (['text', 'character varying'].includes(col.data_type)) {
        try {
          const q = `SELECT count(*) as cnt FROM public."${tableName}" WHERE "${col.column_name}"::text ILIKE $1`;
          const countRes = await pool.query(q, ['%Jaimerodriguez%']);
          const cnt = parseInt(countRes.rows[0].cnt, 10);
          if (cnt > 0) {
            console.log(`-> [Username Match] ${tableName}.${col.column_name}: ${cnt} record(s)`);
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  await pool.end();
}

investigate().catch(console.error);
