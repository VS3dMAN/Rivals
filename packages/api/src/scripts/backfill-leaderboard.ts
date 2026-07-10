/**
 * Backfill script for leaderboard scores and streaks.
 *
 * Iterates over every active (user_id, group_id) pair and calls
 * recomputeScores to populate the streaks and leaderboard_scores tables.
 *
 * Safe to run multiple times — relies on upserts.
 *
 * Usage: pnpm --filter @rivals/api run backfill:leaderboard
 */
import 'dotenv/config';
import { isNull } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { recomputeScores } from '../modules/leaderboard/service';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const db = getDb(url);
  console.log('Starting leaderboard backfill…');

  // Get all active memberships
  const memberships = await db
    .select({
      userId: schema.groupMemberships.userId,
      groupId: schema.groupMemberships.groupId,
    })
    .from(schema.groupMemberships)
    .where(isNull(schema.groupMemberships.leftAt));

  console.log(`Found ${memberships.length} active memberships to backfill.`);

  let success = 0;
  let errors = 0;

  for (const { userId, groupId } of memberships) {
    try {
      // We pass a dummy habitId — recomputeScores computes group-level anyway
      await recomputeScores(db, {
        userId,
        groupId,
        affectedHabitId: '',
      });
      success++;
      if (success % 50 === 0) {
        console.log(`  Processed ${success} / ${memberships.length}…`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error for user=${userId} group=${groupId}:`, err);
    }
  }

  console.log(`\nBackfill complete. Success: ${success}, Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
