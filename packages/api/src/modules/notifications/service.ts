/**
 * Notification service — creates in-app notifications and dispatches push.
 */
import { and, eq, isNull, ne } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';
import { sendPush } from '../push/dispatcher';

export type NotificationKind =
  | 'daily_reminder'
  | 'streak_at_risk'
  | 'group_activity'
  | 'milestone'
  | 'challenge_start'
  | 'challenge_end'
  | 'challenge_window_ending_soon'
  | 'member_join'
  | 'admin_transfer';

interface CreateNotificationParams {
  userId: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
}

/**
 * Insert an in-app notification row and dispatch a push.
 */
export async function createNotification(
  db: Db,
  params: CreateNotificationParams,
): Promise<void> {
  await db.insert(schema.notifications).values({
    userId: params.userId,
    kind: params.kind,
    payloadJson: params.payload,
  });

  // Fire-and-forget push
  sendPush(db, {
    userIds: [params.userId],
    title: (params.payload.title as string) ?? 'Rivals',
    body: (params.payload.body as string) ?? '',
    data: params.payload,
    notifKind: params.kind,
  }).catch((err) => console.error('[notifications] push failed:', err));
}

/**
 * Notify all group members except the actor about an event.
 */
export async function notifyGroupMembers(
  db: Db,
  params: {
    groupId: string;
    excludeUserId: string;
    kind: NotificationKind;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const members = await db
    .select({ userId: schema.groupMemberships.userId })
    .from(schema.groupMemberships)
    .where(
      and(
        eq(schema.groupMemberships.groupId, params.groupId),
        isNull(schema.groupMemberships.leftAt),
        ne(schema.groupMemberships.userId, params.excludeUserId),
      ),
    );

  if (members.length === 0) return;

  const userIds = members.map((m) => m.userId);

  // Insert in-app notifications for all
  await db.insert(schema.notifications).values(
    userIds.map((userId) => ({
      userId,
      kind: params.kind,
      payloadJson: params.payload,
    })),
  );

  // Fan-out push
  sendPush(db, {
    userIds,
    title: (params.payload.title as string) ?? 'Rivals',
    body: (params.payload.body as string) ?? '',
    data: params.payload,
    notifKind: params.kind,
  }).catch((err) => console.error('[notifications] push failed:', err));
}
