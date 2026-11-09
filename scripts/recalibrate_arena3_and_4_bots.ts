import pg from 'pg';
import { buildReliablePlan } from './test_reliable_plan_gen.ts';
import { TOP_META_ARCHETYPES } from './verify_archetypes.ts';
import type { CartaDeMazo } from '../src/engine/mazoDeLaSala.ts';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres';

// 30 Nombres de jugadores reales (estilo gamer/móvil, cero nombres que parezcan bots)
const REALISTIC_GAMER_NICKS = [
  'SantiGamer_99', 'Facu_PvZ', 'Drako_07', 'Alejandro_R', 'MatyPro',
  'Valen_CR', 'CamiloX', 'Lucas_Arg', 'Thiago_Gamer', 'Nacho_95',
  'Zack_Attack', 'Dani_Fernandez', 'Gero_PvZ', 'Lautaro_10', 'Maxi_Strike',
  'El_Tigre92', 'Seba_Master', 'Franco_V', 'Bruno_Sniper', 'Mateo_04',
  'Joaco_Legend', 'Kevin_Playz', 'Tomi_CR', 'Agus_Gamer', 'Martin_08',
  'Nicoo_07', 'David_Gamer', 'Leo_Pro', 'Juan_PvZ', 'Alan_Clash'
];

async function run() {
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  console.log('=== RECALIBRACIÓN DE BOTS DE ARENA 3 Y ARENA 4+ CON 5 ARQUETIPOS TOP META ===\n');

  // 1. Obtener todos los bots con ELO >= 2000
  const { rows: bots } = await client.query(`
    SELECT id, elo_rating, display_name, avatar_id
    FROM ranked_async_opponents
    WHERE elo_rating >= 2000
    ORDER BY elo_rating ASC;
  `);

  console.log(`🎯 Encontrados ${bots.length} bots en Arena 3 y Arena 4+ (ELO >= 2000)...\n`);

  let updatedCount = 0;

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    const elo = bot.elo_rating;
    const archIdx = i % TOP_META_ARCHETYPES.length;
    const arch = TOP_META_ARCHETYPES[archIdx];
    const nick = REALISTIC_GAMER_NICKS[i % REALISTIC_GAMER_NICKS.length];

    // Ajustar niveles según Arena:
    // Arena 3 baja (2000-2499): Cartas Nv. 3, Árbol Nv. 3-4
    // Arena 3 alta (2500-2999): Cartas Nv. 3-4, Árbol Nv. 4
    // Arena 4 (3000-3499): Cartas Nv. 4-5, Árbol Nv. 5-6
    // Arena 4 Élite (3500+): Cartas Nv. 5, Árbol Nv. 6-7
    const isArena4 = elo >= 3000;
    const isHighArena3 = elo >= 2500 && elo < 3000;
    const isElite = elo >= 3500;

    const baseLevel = isElite ? 5 : isArena4 ? 4 : isHighArena3 ? 4 : 3;
    const treeLevel = isElite ? 7 : isArena4 ? 5 : 4;

    const deck: CartaDeMazo[] = arch.deck.map((c, slot) => {
      let lvl = baseLevel;
      if (c.plantId === 'wallnut' || c.plantId === 'tallnut') {
        lvl = Math.min(5, baseLevel + 1);
      }
      return {
        ...c,
        slot,
        level: lvl,
      };
    });

    // Generar plan seguro con 0 drops
    const plan = buildReliablePlan(deck, arch.sequence);

    // Validar plan con la función autoritativa de PostgreSQL
    const { rows: valRes } = await client.query(
      'SELECT public._validate_ranked_async_plan($1::jsonb) as val;',
      [JSON.stringify(plan)]
    );

    if (!valRes[0].val.ok) {
      console.error(`❌ Falló validación SQL en bot ${nick} (ELO ${elo}):`, valRes[0].val);
      process.exit(1);
    }

    // Actualizar registro en Supabase
    await client.query(
      `UPDATE ranked_async_opponents
       SET display_name = $1,
           avatar_id = $2,
           deck_snapshot = $3::jsonb,
           actions_snapshot = $4::jsonb,
           tree_level = $5,
           is_active = TRUE,
           updated_at = NOW()
       WHERE id = $6;`,
      [
        nick,
        arch.avatar,
        JSON.stringify(deck),
        JSON.stringify(plan),
        treeLevel,
        bot.id
      ]
    );

    updatedCount++;
    if (updatedCount % 25 === 0 || updatedCount === bots.length) {
      console.log(`  ✓ Actualizados ${updatedCount}/${bots.length} bots (Último: ${nick} [${elo} ELO] - Arquetipo: ${arch.name})`);
    }
  }

  console.log(`\n✅ RECALIBRACIÓN COMPLETADA: ${updatedCount} bots de Arena 3 y 4+ actualizados con éxito.`);

  // Verificación final en BD
  const { rows: verifyRows } = await client.query(`
    SELECT display_name, elo_rating, avatar_id, tree_level, jsonb_array_length(actions_snapshot) as actions_cnt
    FROM ranked_async_opponents
    WHERE elo_rating >= 2000
    ORDER BY RANDOM()
    LIMIT 10;
  `);

  console.log('\n=== MUESTRA ALEATORIA DE BOTS ACTUALIZADOS EN PRODUCCIÓN ===');
  console.table(verifyRows);

  client.release();
  await pool.end();
}

run().catch(console.error);
