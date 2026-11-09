import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString });

async function run() {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (r.player1_id)
      p.username, p.elo_rating, r.p1_deck, r.p1_tree_level, r.created_at
    FROM game_rooms r
    JOIN profiles p ON r.player1_id = p.id
    WHERE p.elo_rating >= 2500
    ORDER BY r.player1_id, r.created_at DESC
    LIMIT 25;
  `);

  const plantCounts = {};
  const levels = [];

  console.log(`=== ESTUDIO DE MAZOS DE JUGADORES TOP (ELO >= 2500) ===\n`);

  rows.forEach(r => {
    const deck = r.p1_deck || [];
    const plantNames = deck.map(c => {
      levels.push(c.level || 1);
      return `${c.plantId} (Nv.${c.level}${c.equippedItem ? ` + ${c.equippedItem}` : ''}${c.statRolls ? ` rolls:${c.statRolls.join('/')}` : ''})`;
    });
    console.log(`👤 ${r.username} [ELO: ${r.elo_rating} | Árbol: ${r.p1_tree_level || 0}]`);
    console.log(`   🃏 Mazo: ${plantNames.join(' | ')}\n`);

    deck.forEach(c => {
      plantCounts[c.plantId] = (plantCounts[c.plantId] || 0) + 1;
    });
  });

  console.log('=== FRECUENCIA DE PLANTAS PREFERIDAS POR LOS TOPS ===');
  const sorted = Object.entries(plantCounts).sort((a,b) => b[1] - a[1]);
  sorted.forEach(([plant, count]) => {
    console.log(`  - ${plant.padEnd(16)}: ${count} apariciones (${((count / rows.length) * 100).toFixed(0)}% de los jugadores)`);
  });

  const avgLevel = levels.length ? (levels.reduce((a,b) => a+b, 0) / levels.length).toFixed(1) : 0;
  console.log(`\nPromedio de nivel de carta de los tops: Nv. ${avgLevel}`);

  await pool.end();
}

run().catch(console.error);

async function studyActions() {
  const { rows } = await pool.query(`
    SELECT r.id, p.username, r.verification_payload
    FROM game_rooms r
    JOIN profiles p ON r.player1_id = p.id
    WHERE p.elo_rating >= 2900 AND r.verification_payload IS NOT NULL
    ORDER BY r.created_at DESC
    LIMIT 4;
  `);

  console.log('\n=== ESTUDIO DE TIEMPOS Y RITMO DE JUEGO REAL (ACCIONES TOP) ===\n');

  for (const r of rows) {
    const payload = r.verification_payload;
    const actions = payload.actions || payload.p1_actions || [];
    console.log(`🎮 Partida: ${r.id} | Jugador: ${r.username} | Total Acciones P1: ${actions.length}`);
    if (actions.length > 0) {
      actions.slice(0, 10).forEach((a, idx) => {
        const tick = a.issuedTick ?? a.tick ?? 0;
        const s = (tick * 0.033).toFixed(1);
        console.log(`   [#${idx+1}] t=${s}s: Plantó ${a.plantId || 'planta'} (carril ${a.lane}, col ${a.col})`);
      });
    }
    console.log('');
  }
}

studyActions().catch(console.error);
