// EXPLAIN ANALYZE for the hot read paths: leaderboard, feed, today-habits.
// Run on a populated DB (or a Supabase branch snapshot) to verify the planner
// chooses index scans and no sequential scans appear on tables > 10k rows.
//
//   pnpm --filter @rivals/api exec tsx src/scripts/explain-leaderboard.ts <group_id>

import postgres from 'postgres';
import { getEnv } from '../env';

interface PlanRow {
  'QUERY PLAN': string;
}

async function explain(sql: postgres.Sql, label: string, query: string, params: unknown[] = []) {
  const rows = (await sql.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${query}`, params as never)) as PlanRow[];
  const text = rows.map((r) => r['QUERY PLAN']).join('\n');
  console.info(`\n=== ${label} ===\n${text}\n`);
  if (/Seq Scan/.test(text)) {
    console.warn(`[explain] ${label} → sequential scan detected`);
  }
}

async function main() {
  const env = getEnv();
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  const groupId = process.argv[2];
  if (!groupId) {
    console.error('usage: explain-leaderboard <group_id>');
    process.exit(2);
  }

  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

  await explain(
    sql,
    'leaderboard.streak',
    `
    SELECT user_id, score
    FROM leaderboard_scores
    WHERE group_id = $1 AND mode = 'streak'
    ORDER BY score DESC NULLS LAST
    LIMIT 50
  `,
    [groupId],
  );

  await explain(
    sql,
    'feed.recent',
    `
    SELECT id, kind, payload_json, created_at
    FROM feed_events
    WHERE group_id = $1
    ORDER BY created_at DESC
    LIMIT 20
  `,
    [groupId],
  );

  await explain(
    sql,
    'habit_logs.today',
    `
    SELECT id
    FROM habit_logs
    WHERE group_id = $1 AND log_date = CURRENT_DATE AND deleted_at IS NULL
  `,
    [groupId],
  );

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
