import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq, ilike, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import { notificationPrefsSchema } from '@rivals/shared/zod/notifications';

interface UsersRouteOptions {
  db: Db;
}

const patchMeSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().optional(),
});

const searchQuerySchema = z.object({
  u: z
    .string()
    .min(1)
    .max(24)
    .regex(/^[a-z0-9_]+$/i),
});

const routes: FastifyPluginAsync<UsersRouteOptions> = async (app, opts) => {
  const { db } = opts;

  app.get('/me', async (req) => {
    const auth = await app.requireAuth(req);
    const [row] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        timezone: schema.users.timezone,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, auth.id))
      .limit(1);

    if (!row) {
      const err = new Error('User not found') as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    return row;
  });

  app.patch('/me', async (req) => {
    const auth = await app.requireAuth(req);
    const patch = patchMeSchema.parse(req.body);
    if (Object.keys(patch).length === 0) return { ok: true };

    const [updated] = await db
      .update(schema.users)
      .set(patch)
      .where(eq(schema.users.id, auth.id))
      .returning({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        timezone: schema.users.timezone,
      });
    return updated;
  });

  // GET /users/search?u=<prefix> — up to 10 matches, excludes current user
  app.get('/users/search', async (req) => {
    const auth = await app.requireAuth(req);
    const { u } = searchQuerySchema.parse(req.query);
    const rows = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .where(and(ilike(schema.users.username, `${u}%`), ne(schema.users.id, auth.id)))
      .limit(10);
    return { users: rows };
  });

  // GET /me/notification-prefs
  app.get('/me/notification-prefs', async (req) => {
    const auth = await app.requireAuth(req);
    const [row] = await db
      .select({ notificationPrefs: schema.users.notificationPrefs })
      .from(schema.users)
      .where(eq(schema.users.id, auth.id))
      .limit(1);
    return row?.notificationPrefs ?? {};
  });

  // PATCH /me/notification-prefs
  app.patch('/me/notification-prefs', async (req) => {
    const auth = await app.requireAuth(req);
    const patch = notificationPrefsSchema.parse(req.body);

    // Merge with existing prefs
    const [current] = await db
      .select({ notificationPrefs: schema.users.notificationPrefs })
      .from(schema.users)
      .where(eq(schema.users.id, auth.id))
      .limit(1);

    const merged = { ...(current?.notificationPrefs as Record<string, unknown> ?? {}), ...patch };

    await db
      .update(schema.users)
      .set({ notificationPrefs: merged })
      .where(eq(schema.users.id, auth.id));

    return merged;
  });

  // POST /me/export — enqueue a data export job
  app.post('/me/export', {
    config: { rateLimit: { max: 3, timeWindow: 24 * 60 * 60 * 1000 } },
  }, async (req, reply) => {
    const auth = await app.requireAuth(req);

    // Reuse an in-flight job if present.
    const [existing] = await db
      .select()
      .from(schema.dataExportJobs)
      .where(
        and(
          eq(schema.dataExportJobs.userId, auth.id),
          sql`${schema.dataExportJobs.status} IN ('queued', 'processing')`,
        ),
      )
      .orderBy(desc(schema.dataExportJobs.requestedAt))
      .limit(1);
    if (existing) return reply.status(202).send({ id: existing.id, status: existing.status });

    const inserted = await db
      .insert(schema.dataExportJobs)
      .values({ userId: auth.id })
      .returning();
    const job = inserted[0];
    if (!job) {
      const err = new Error('Failed to create export job') as Error & { statusCode?: number; code?: string };
      err.statusCode = 500;
      err.code = 'EXPORT_CREATE_FAILED';
      throw err;
    }
    return reply.status(202).send({ id: job.id, status: job.status });
  });

  // GET /me/export/:id — status + signed URL once ready
  app.get('/me/export/:id', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [job] = await db
      .select()
      .from(schema.dataExportJobs)
      .where(and(eq(schema.dataExportJobs.id, id), eq(schema.dataExportJobs.userId, auth.id)))
      .limit(1);
    if (!job) {
      const err = new Error('Export not found') as Error & { statusCode?: number; code?: string };
      err.statusCode = 404;
      err.code = 'EXPORT_NOT_FOUND';
      throw err;
    }
    return {
      id: job.id,
      status: job.status,
      signedUrl: job.signedUrl,
      urlExpiresAt: job.urlExpiresAt,
      requestedAt: job.requestedAt,
      completedAt: job.completedAt,
      error: job.error,
    };
  });

  // DELETE /me — GDPR account deletion (soft delete + purge enqueue + revoke sessions)
  app.delete('/me', async (req) => {
    const auth = await app.requireAuth(req);
    const now = new Date();

    await db.transaction(async (tx) => {
      // Soft-delete user. Anonymize PII fields. Keep id so existing logs can be re-pointed.
      const anonUsername = `deleted_${auth.id.replace(/-/g, '').slice(0, 16)}`;
      const anonEmail = `${anonUsername}@deleted.invalid`;

      await tx
        .update(schema.users)
        .set({
          deletedAt: now,
          email: anonEmail,
          username: anonUsername,
          displayName: 'Deleted user',
          avatarUrl: null,
        })
        .where(eq(schema.users.id, auth.id));

      // Soft-leave from all active groups.
      await tx
        .update(schema.groupMemberships)
        .set({ leftAt: now })
        .where(
          and(
            eq(schema.groupMemberships.userId, auth.id),
            sql`${schema.groupMemberships.leftAt} IS NULL`,
          ),
        );

      // Drop push tokens.
      await tx.delete(schema.pushTokens).where(eq(schema.pushTokens.userId, auth.id));

      // Enqueue purge of photos via R2.
      const photoRows = await tx
        .select({ photoUrl: schema.habitLogs.photoUrl })
        .from(schema.habitLogs)
        .where(eq(schema.habitLogs.userId, auth.id));
      if (photoRows.length > 0) {
        await tx.insert(schema.purgeQueue).values(
          photoRows.map((r) => ({
            userId: auth.id,
            kind: 'r2_object',
            payload: { objectKey: r.photoUrl },
          })),
        );
      }
      await tx.insert(schema.purgeQueue).values({
        userId: auth.id,
        kind: 'profile_anonymize',
        payload: { id: auth.id },
      });

      // Soft-delete the user's logs so they no longer surface.
      await tx
        .update(schema.habitLogs)
        .set({ deletedAt: now })
        .where(eq(schema.habitLogs.userId, auth.id));
    });

    // Revoke refresh tokens via Supabase admin signOut. Best-effort — don't fail the deletion if this throws.
    try {
      await app.supabase.auth.admin.signOut(auth.id, 'global');
    } catch (e) {
      app.log?.warn?.({ err: e }, 'signOut failed during account deletion');
    }

    return { ok: true };
  });

  void sql;
};

export default routes;
