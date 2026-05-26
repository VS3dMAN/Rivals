import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import {
  uploadUrlRequestSchema,
  confirmLogSchema,
  ALLOWED_PHOTO_CONTENT_TYPES,
  MAX_PHOTO_BYTES,
} from '@rivals/shared/zod/logs';
import { HttpError, requireMember } from '../groups/service';
import { todayInTz } from '../../lib/tz';
import type { R2Module } from '../../lib/r2';
import { recomputeScores } from '../leaderboard/service';
import { notifyGroupMembers } from '../notifications/service';
import { evaluateBadges } from '../badges/service';
import { track } from '../../lib/analytics';

interface LogsRouteOptions {
  db: Db;
  r2: R2Module;
}

const logIdParam = z.object({ id: z.string().uuid() });

const FIVE_MIN_MS = 5 * 60 * 1000;
const PENDING_TTL_MS = 15 * 60 * 1000;

const routes: FastifyPluginAsync<LogsRouteOptions> = async (app, opts) => {
  const { db, r2 } = opts;

  // POST /logs/upload-url — issue a presigned PUT URL for the user's next proof.
  app.post('/logs/upload-url', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const auth = await app.requireAuth(req);
    const { groupId, habitId, contentType, contentLength } = uploadUrlRequestSchema.parse(req.body);
    if (contentLength !== undefined && contentLength > MAX_PHOTO_BYTES) {
      throw new HttpError(413, 'PHOTO_TOO_LARGE', `Photo must be <= ${MAX_PHOTO_BYTES} bytes`);
    }
    if (!ALLOWED_PHOTO_CONTENT_TYPES.includes(contentType)) {
      throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only jpeg/png/webp allowed');
    }

    await requireMember(db, groupId, auth.id);

    // Verify habit belongs to the group and is active.
    const [habit] = await db
      .select({
        id: schema.habits.id,
        groupId: schema.habits.groupId,
        isActive: schema.habits.isActive,
      })
      .from(schema.habits)
      .where(eq(schema.habits.id, habitId))
      .limit(1);
    if (!habit || habit.groupId !== groupId || !habit.isActive) {
      throw new HttpError(404, 'HABIT_NOT_FOUND', 'Habit not found in this group');
    }

    const logId = randomUUID();
    const objectKey = r2.objectKeyForLog(groupId, habitId, auth.id, logId);
    const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

    await db.insert(schema.pendingLogs).values({
      id: logId,
      userId: auth.id,
      groupId,
      habitId,
      objectKey,
      expiresAt,
    });

    const presigned = await r2.issuePresignedPut(objectKey, contentType, 3600);

    return reply.status(201).send({
      logId,
      uploadUrl: presigned.url,
      headers: presigned.headers,
      objectKey,
      expiresAt: expiresAt.toISOString(),
    });
  });

  // POST /logs — confirm an upload, validate timestamps, write the habit_log row.
  app.post('/logs', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req) => {
    const auth = await app.requireAuth(req);
    const { logId, clientTimestamp } = confirmLogSchema.parse(req.body);

    const [pending] = await db
      .select()
      .from(schema.pendingLogs)
      .where(eq(schema.pendingLogs.id, logId))
      .limit(1);

    if (!pending || pending.userId !== auth.id) {
      throw new HttpError(404, 'LOG_NOT_FOUND', 'Pending log not found');
    }

    const now = new Date();
    if (pending.expiresAt.getTime() < now.getTime()) {
      throw new HttpError(410, 'UPLOAD_EXPIRED', 'Upload window expired');
    }

    const skewMs = Math.abs(now.getTime() - new Date(clientTimestamp).getTime());
    if (skewMs > FIVE_MIN_MS) {
      throw new HttpError(422, 'CLOCK_SKEW', 'Client clock skew exceeds 5 minutes');
    }

    const head = await r2.headObject(pending.objectKey);
    if (!head) {
      throw new HttpError(422, 'UPLOAD_NOT_FOUND', 'Photo upload not found in storage');
    }
    if (head.contentLength > MAX_PHOTO_BYTES) {
      throw new HttpError(413, 'PHOTO_TOO_LARGE', `Photo must be <= ${MAX_PHOTO_BYTES} bytes`);
    }

    // Resolve user-tz so the log_date matches the user's local calendar day.
    const [user] = await db
      .select({ timezone: schema.users.timezone })
      .from(schema.users)
      .where(eq(schema.users.id, auth.id))
      .limit(1);
    const [habitRow] = await db
      .select({ name: schema.habits.name })
      .from(schema.habits)
      .where(eq(schema.habits.id, pending.habitId))
      .limit(1);

    const tz = user?.timezone || 'UTC';
    const today = todayInTz(tz, now);

    return db.transaction(async (tx) => {
      // Soft-delete any prior same-day log.
      await tx
        .update(schema.habitLogs)
        .set({ deletedAt: now })
        .where(
          and(
            eq(schema.habitLogs.habitId, pending.habitId),
            eq(schema.habitLogs.userId, auth.id),
            eq(schema.habitLogs.logDate, today),
            isNull(schema.habitLogs.deletedAt),
          ),
        );

      const [inserted] = await tx
        .insert(schema.habitLogs)
        .values({
          id: logId,
          habitId: pending.habitId,
          userId: auth.id,
          groupId: pending.groupId,
          logDate: today,
          clientTimestamp: new Date(clientTimestamp),
          serverTimestamp: now,
          photoUrl: pending.objectKey,
        })
        .returning();

      await tx.insert(schema.feedEvents).values({
        groupId: pending.groupId,
        actorUserId: auth.id,
        kind: 'log',
        payloadJson: {
          logId,
          objectKey: pending.objectKey,
          habitId: pending.habitId,
          habitName: habitRow?.name ?? '',
        },
      });

      await tx.delete(schema.pendingLogs).where(eq(schema.pendingLogs.id, logId));

      // Recompute leaderboard scores for all three modes
      await recomputeScores(tx as unknown as Db, {
        userId: auth.id,
        groupId: pending.groupId,
        affectedHabitId: pending.habitId,
      });

      // Evaluate badges (fire-and-forget, uses db not tx)
      const clientDate = new Date(clientTimestamp);
      const localHour = clientDate.getHours();
      // Read fresh streak for badge evaluation
      db.select({ currentStreak: schema.streaks.currentStreak })
        .from(schema.streaks)
        .where(
          and(
            eq(schema.streaks.userId, auth.id),
            eq(schema.streaks.groupId, pending.groupId),
            isNull(schema.streaks.habitId),
          ),
        )
        .limit(1)
        .then(([s]) => {
          evaluateBadges(db, {
            userId: auth.id,
            groupId: pending.groupId,
            currentStreak: s?.currentStreak ?? 0,
            localHour,
          });
        })
        .catch(() => {});

      track('log_submitted', auth.id, {
        groupId: pending.groupId,
        habitId: pending.habitId,
      }).catch(() => void 0);

      // Notify group members (fire-and-forget, outside transaction)
      notifyGroupMembers(db, {
        groupId: pending.groupId,
        excludeUserId: auth.id,
        kind: 'group_activity',
        payload: {
          title: 'New proof submitted',
          body: `Someone completed ${habitRow?.name ?? 'a habit'}`,
          groupId: pending.groupId,
          logId,
          habitName: habitRow?.name ?? '',
        },
      }).catch(() => {});

      return {
        logId,
        habitLog: inserted,
      };
    });
  });

  // DELETE /logs/:id — soft-delete the log if it belongs to the user AND is today.
  app.delete('/logs/:id', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = logIdParam.parse(req.params);

    const [log] = await db
      .select({
        id: schema.habitLogs.id,
        userId: schema.habitLogs.userId,
        logDate: schema.habitLogs.logDate,
        deletedAt: schema.habitLogs.deletedAt,
      })
      .from(schema.habitLogs)
      .where(eq(schema.habitLogs.id, id))
      .limit(1);

    if (!log || log.userId !== auth.id || log.deletedAt) {
      throw new HttpError(404, 'LOG_NOT_FOUND', 'Log not found');
    }

    const [user] = await db
      .select({ timezone: schema.users.timezone })
      .from(schema.users)
      .where(eq(schema.users.id, auth.id))
      .limit(1);
    const today = todayInTz(user?.timezone || 'UTC');

    if ((log.logDate as string) < today) {
      throw new HttpError(409, 'LOG_LOCKED', 'Prior-day logs cannot be edited');
    }

    await db
      .update(schema.habitLogs)
      .set({ deletedAt: new Date() })
      .where(eq(schema.habitLogs.id, id));

    return { ok: true };
  });

  // GET /logs/:id/photo-url — issue a short-lived signed GET URL for a member.
  app.get('/logs/:id/photo-url', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = logIdParam.parse(req.params);

    const [log] = await db
      .select({
        id: schema.habitLogs.id,
        groupId: schema.habitLogs.groupId,
        photoUrl: schema.habitLogs.photoUrl,
        deletedAt: schema.habitLogs.deletedAt,
      })
      .from(schema.habitLogs)
      .where(eq(schema.habitLogs.id, id))
      .limit(1);

    if (!log || log.deletedAt) {
      throw new HttpError(404, 'LOG_NOT_FOUND', 'Log not found');
    }

    // Member of the log's group?
    await requireMember(db, log.groupId, auth.id);

    const presigned = await r2.issuePresignedGet(log.photoUrl, 3600);
    return presigned;
  });

  // Touch unused import so eslint doesn't complain in some configurations.
  void lt;
};

export default routes;
