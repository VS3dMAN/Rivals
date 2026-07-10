/**
 * Challenge windows lifecycle management.
 *
 * - POST /groups/:id/challenges — admin creates a challenge window
 * - GET /groups/:id/challenges — list challenge windows by status
 */
import { and, eq, sql, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import { HttpError, requireAdmin, requireMember } from '../groups/service';
import { todayInTz } from '../../lib/tz';

export const createChallengeSchema = z.object({
  name: z.string().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;


/**
 * Create a new challenge window for a group.
 */
export async function createChallenge(
  db: Db,
  groupId: string,
  adminUserId: string,
  input: CreateChallengeInput,
) {
  await requireAdmin(db, groupId, adminUserId);

  const { name, startDate, endDate } = input;

  // Validate minimum 3 days (endDate >= startDate + 2)
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 2) {
    throw new HttpError(400, 'WINDOW_TOO_SHORT', 'Challenge window must be at least 3 days');
  }
  if (diffDays > 365) {
    throw new HttpError(400, 'WINDOW_TOO_LONG', 'Challenge window cannot exceed 365 days');
  }

  // Check for overlapping windows (upcoming or active)
  const overlapping = await db
    .select({ id: schema.challengeWindows.id })
    .from(schema.challengeWindows)
    .where(
      and(
        eq(schema.challengeWindows.groupId, groupId),
        inArray(schema.challengeWindows.status, ['upcoming', 'active']),
        // Overlap: existing.start <= input.end AND existing.end >= input.start
        sql`${schema.challengeWindows.startDate} <= ${endDate}`,
        sql`${schema.challengeWindows.endDate} >= ${startDate}`,
      ),
    )
    .limit(1);

  if (overlapping.length > 0) {
    throw new HttpError(409, 'WINDOW_OVERLAP', 'A challenge window already overlaps this range');
  }

  // Determine initial status based on today vs startDate
  const [group] = await db
    .select({ referenceTz: schema.groups.referenceTz })
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1);

  const tz = group?.referenceTz ?? 'UTC';
  const today = todayInTz(tz);
  const status = startDate <= today ? 'active' : 'upcoming';

  const [window] = await db
    .insert(schema.challengeWindows)
    .values({
      groupId,
      name,
      startDate,
      endDate,
      status,
    })
    .returning();

  if (!window) {
    throw new HttpError(500, 'INSERT_FAILED', 'Failed to create challenge window');
  }

  // Insert feed event for window start if active immediately
  if (status === 'active') {
    await db.insert(schema.feedEvents).values({
      groupId,
      actorUserId: adminUserId,
      kind: 'window_start',
      payloadJson: {
        challengeWindowId: window.id,
        name,
        startDate,
        endDate,
      },
    });
  }

  return window;
}

/**
 * List challenge windows for a group, optionally filtered by status.
 */
export async function listChallenges(
  db: Db,
  groupId: string,
  userId: string,
  status?: string,
) {
  await requireMember(db, groupId, userId);

  const conditions = [eq(schema.challengeWindows.groupId, groupId)];
  if (status && ['upcoming', 'active', 'completed'].includes(status)) {
    conditions.push(
      eq(schema.challengeWindows.status, status as 'upcoming' | 'active' | 'completed'),
    );
  }

  const windows = await db
    .select()
    .from(schema.challengeWindows)
    .where(and(...conditions))
    .orderBy(desc(schema.challengeWindows.startDate));

  return windows;
}
