import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString });

async function studyPlayerActions() {
  const { rows } = await pool.query(`
    SELECT seq, issued_tick, kind, plant_id, lane, col
    FROM match_actions
    WHERE room_id = '8926bad7-d924-40cb-bb56-b280e28659b2'
    ORDER BY seq ASC
    LIMIT 25;
  `);

  console.log('=== PRIMERAS 25 ACCIONES DE ADOLFO2323 (TOP 1, 3166 ELO) ===\n');
  rows.forEach(r => {
    const s = ((r.issued_tick || 0) * 0.033).toFixed(1);
    console.log(`  #${String(r.seq).padStart(2)} [t=${s.padStart(5)}s]: ${r.kind.padEnd(5)} ${(r.plant_id || '').padEnd(14)} -> Carril ${r.lane}, Columna ${r.col}`);
  });

  const { rows: rowsJon } = await pool.query(`
    SELECT seq, issued_tick, kind, plant_id, lane, col
    FROM match_actions
    WHERE room_id = '0e47a9d8-ac3c-4fc5-b2bd-ae70b990afec'
    ORDER BY seq ASC
    LIMIT 25;
  `);

  console.log('\n=== PRIMERAS 25 ACCIONES DE JON SNOW (3092 ELO) ===\n');
  rowsJon.forEach(r => {
    const s = ((r.issued_tick || 0) * 0.033).toFixed(1);
    console.log(`  #${String(r.seq).padStart(2)} [t=${s.padStart(5)}s]: ${r.kind.padEnd(5)} ${(r.plant_id || '').padEnd(14)} -> Carril ${r.lane}, Columna ${r.col}`);
  });

  await pool.end();
}

studyPlayerActions().catch(console.error);
