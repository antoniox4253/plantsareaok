import { describe, it, expect } from 'vitest'
import pg from 'pg'
import { generateDenseBotPlan } from './denseBotPlanGenerator.ts'
import { simulateAsyncMatch } from './asyncOpponent.ts'
import { HUMAN_ARCHETYPES, generarTimelineHumanaAdversarial } from './adversarialHumanGenerator.ts'

describe('Certify All Bot Decks in Database with Dense Plans', () => {
  it('certifies every unique deck in ranked_async_opponents with 0 drops and SQL validation', async () => {
    const connectionString = 'postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
    await client.connect()

    const res = await client.query(`
      SELECT DISTINCT deck_snapshot
      FROM ranked_async_opponents;
    `)

    console.log(`Decks únicos en ranked_async_opponents: ${res.rows.length}`)
    expect(res.rows.length).toBeGreaterThan(0)

    for (let i = 0; i < res.rows.length; i++) {
      const deck = res.rows[i].deck_snapshot
      const plan = generateDenseBotPlan(deck)

      expect(plan.length).toBeGreaterThanOrEqual(5)

      // Test SQL validation function
      const sqlVal = await client.query(`SELECT public._validate_ranked_async_plan($1::jsonb) as val;`, [JSON.stringify(plan)])
      expect(sqlVal.rows[0].val.ok).toBe(true)

      // Test simulation
      const humanTimeline = generarTimelineHumanaAdversarial(HUMAN_ARCHETYPES.HUMAN_BALANCED, 9999 + i)
      const sim = simulateAsyncMatch(9999 + i, deck, deck, humanTimeline, plan, 6000)
      expect(sim.ok).toBe(true)
      expect(sim.telemetria.intentionsDropped).toBe(0)
    }

    await client.end()
  }, 60000)
})
