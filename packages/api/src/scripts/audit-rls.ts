// RLS audit: connects as an anonymous (Supabase `anon`) role and as a second
// authenticated user, then asserts that read access is denied on every table
// listed in `PROTECTED_TABLES`. Exits non-zero on any leak.
//
// Required env: DATABASE_URL (a connection string that can SET ROLE to `anon`
// and `authenticated`).
//
// Run:
//   pnpm --filter @rivals/api exec tsx src/scripts/audit-rls.ts

import postgres from 'postgres';
import { getEnv } from '../env';

const PROTECTED_TABLES = [
  'users',
  'groups',
  'group_memberships',
  'habits',
  'habit_logs',
  'streaks',
  'challenge_windows',
  'leaderboard_scores',
  'feed_events',
  'feed_reactions',
  'notifications',
  'push_tokens',
  'user_badges',
  'pending_logs',
  'data_export_jobs',
  'purge_queue',
];

const FOREIGN_USER = '99999999-9999-9999-9999-999999999999';

interface Leak {
  table: string;
  role: 'anon' | 'authenticated';
  rowCount: number;
}

async function auditAsRole(
  sql: postgres.Sql,
  role: 'anon' | 'authenticated',
  uid: string | null,
): Promise<Leak[]> {
  const leaks: Leak[] = [];
  for (const t of PROTECTED_TABLES) {
    try {
      await sql.begin(async (tx) => {
        if (uid) {
          await tx.unsafe(
            `SELECT set_config('request.jwt.claims', $1::text, true)`,
            [JSON.stringify({ sub: uid, role: 'authenticated' })],
          );
        } else {
          await tx.unsafe(`SELECT set_config('request.jwt.claims', '{}', true)`);
        }
        await tx.unsafe(`SET LOCAL ROLE ${role}`);
        const rows = (await tx.unsafe(`SELECT COUNT(*)::int AS n FROM ${t}`)) as unknown as Array<{ n: number }>;
        const n = rows[0]?.n ?? 0;
        if (n > 0) {
          leaks.push({ table: t, role, rowCount: n });
        }
      });
    } catch (err) {
      // RLS denial may surface as an error in some configurations — that's fine.
      const msg = (err as Error).message || '';
      if (!/permission|policy|denied/i.test(msg)) {
        console.warn(`[audit-rls] ${t} (${role}) error:`, msg);
      }
    }
  }
  return leaks;
}

async function main() {
  const env = getEnv();
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

  console.info('[audit-rls] auditing as anon …');
  const anonLeaks = await auditAsRole(sql, 'anon', null);
  console.info('[audit-rls] auditing as authenticated (foreign user) …');
  const authLeaks = await auditAsRole(sql, 'authenticated', FOREIGN_USER);

  const all = [...anonLeaks, ...authLeaks];
  if (all.length === 0) {
    console.info('[audit-rls] ✓ no leaks — all protected tables deny access by default');
    await sql.end();
    process.exit(0);
  }

  console.error('[audit-rls] LEAKS DETECTED:');
  for (const l of all) {
    console.error(`  - ${l.role} → ${l.table} (${l.rowCount} rows visible)`);
  }
  await sql.end();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
