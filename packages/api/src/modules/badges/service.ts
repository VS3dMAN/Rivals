/**
 * Badge evaluation service.
 * Called after recomputeScores to check if the user earned any new badges.
 */
import { and, eq, isNull, sql, count } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';
import { createNotification } from '../notifications/service';
import { track } from '../../lib/analytics';

interface EvaluateBadgesParams {
  userId: string;
  groupId: string;
  currentStreak: number;
  /** The client-local hour of the log submission */
  localHour?: number;
}

interface AwardResult {
  badgeCode: string;
  badgeTitle: string;
}

export async function evaluateBadges(
  db: Db,
  params: EvaluateBadgesParams,
): Promise<AwardResult[]> {
  const { userId, groupId, currentStreak, localHour } = params;
  const awarded: AwardResult[] = [];

  // Load all badge definitions
  const allBadges = await db.select().from(schema.badges);
  const badgeMap = Object.fromEntries(allBadges.map((b) => [b.code, b]));

  // Load user's existing badges for this group
  const existing = await db
    .select({ badgeId: schema.userBadges.badgeId })
    .from(schema.userBadges)
    .where(
      and(
        eq(schema.userBadges.userId, userId),
        eq(schema.userBadges.groupId, groupId),
      ),
    );
  const earnedIds = new Set(existing.map((e) => e.badgeId));

  async function tryAward(code: string): Promise<boolean> {
    const badge = badgeMap[code];
    if (!badge || earnedIds.has(badge.id)) return false;

    await db.insert(schema.userBadges).values({
      userId,
      badgeId: badge.id,
      groupId,
    }).onConflictDoNothing();

    // Feed event
    await db.insert(schema.feedEvents).values({
      groupId,
      actorUserId: userId,
      kind: 'badge',
      payloadJson: { badgeCode: code, badgeTitle: badge.title },
    });

    // Notification
    createNotification(db, {
      userId,
      kind: 'milestone',
      payload: {
        title: 'Badge earned!',
        body: `You earned "${badge.title}"`,
        badgeCode: code,
        groupId,
      },
    }).catch(() => {});

    track('badge_awarded', userId, { groupId, badgeCode: code }).catch(() => void 0);
    if (code === 'window_winner') {
      track('window_completed', userId, { groupId }).catch(() => void 0);
    }

    awarded.push({ badgeCode: code, badgeTitle: badge.title });
    return true;
  }

  // First proof
  const [logCount] = await db
    .select({ cnt: count() })
    .from(schema.habitLogs)
    .where(
      and(
        eq(schema.habitLogs.userId, userId),
        isNull(schema.habitLogs.deletedAt),
      ),
    );
  const totalLogs = Number(logCount?.cnt ?? 0);

  if (totalLogs === 1) await tryAward('first_proof');
  if (totalLogs >= 100) await tryAward('total_100');
  if (totalLogs >= 500) await tryAward('total_500');

  // Streak badges
  if (currentStreak >= 7) await tryAward('streak_7');
  if (currentStreak >= 14) await tryAward('streak_14');
  if (currentStreak >= 30) await tryAward('streak_30');
  if (currentStreak >= 90) await tryAward('streak_90');

  // Early bird
  if (localHour !== undefined && localHour < 7) {
    await tryAward('early_bird');
  }

  return awarded;
}
