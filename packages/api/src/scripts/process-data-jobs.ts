// Background worker that fulfils data-export jobs and processes the purge queue.
//
// Designed to be invoked on a schedule (pg_cron HTTP call, GitHub Actions, or a
// long-running pm2 task). Run via:
//   pnpm --filter @rivals/api exec tsx src/scripts/process-data-jobs.ts
//
// One pass:
//   1. Pick up to N queued export jobs, mark 'processing', build a JSON bundle,
//      upload to R2, sign a 7-day GET URL, mark 'ready'.
//   2. Pick up to N pending purge tasks, delete R2 objects / finalise anonymisation,
//      mark 'done'.

import { and, asc, eq, sql } from 'drizzle-orm';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDb, schema } from '../db/client';
import { getR2Client } from '../lib/r2';
import { getEnv } from '../env';

const EXPORT_URL_TTL_SEC = 7 * 24 * 3600;
const BATCH = 20;

async function gatherUserData(db: ReturnType<typeof getDb>, userId: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const memberships = await db
    .select()
    .from(schema.groupMemberships)
    .where(eq(schema.groupMemberships.userId, userId));
  const habitLogs = await db.select().from(schema.habitLogs).where(eq(schema.habitLogs.userId, userId));
  const badges = await db
    .select()
    .from(schema.userBadges)
    .where(eq(schema.userBadges.userId, userId));
  const notifications = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId));
  return {
    exportedAt: new Date().toISOString(),
    user,
    memberships,
    habitLogs,
    badges,
    notifications,
  };
}

async function processExportJobs(db: ReturnType<typeof getDb>) {
  const env = getEnv();
  if (!env.R2_BUCKET) throw new Error('R2_BUCKET missing — cannot upload exports');

  const jobs = await db
    .update(schema.dataExportJobs)
    .set({ status: 'processing', startedAt: new Date() })
    .where(eq(schema.dataExportJobs.status, 'queued'))
    .returning();

  for (const job of jobs.slice(0, BATCH)) {
    try {
      const bundle = await gatherUserData(db, job.userId);
      const objectKey = `exports/${job.userId}/${job.id}.json`;
      const client = getR2Client();
      await client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET!,
          Key: objectKey,
          Body: JSON.stringify(bundle, null, 2),
          ContentType: 'application/json',
        }),
      );
      const signedUrl = await getSignedUrl(
        client,
        new (await import('@aws-sdk/client-s3')).GetObjectCommand({
          Bucket: env.R2_BUCKET!,
          Key: objectKey,
        }),
        { expiresIn: EXPORT_URL_TTL_SEC },
      );
      const urlExpiresAt = new Date(Date.now() + EXPORT_URL_TTL_SEC * 1000);
      await db
        .update(schema.dataExportJobs)
        .set({
          status: 'ready',
          objectKey,
          signedUrl,
          urlExpiresAt,
          completedAt: new Date(),
        })
        .where(eq(schema.dataExportJobs.id, job.id));
      console.info(`[export] job ${job.id} ready for user ${job.userId}`);
    } catch (err) {
      await db
        .update(schema.dataExportJobs)
        .set({
          status: 'failed',
          error: (err as Error).message,
          completedAt: new Date(),
        })
        .where(eq(schema.dataExportJobs.id, job.id));
      console.error(`[export] job ${job.id} failed`, err);
    }
  }
}

async function processPurgeQueue(db: ReturnType<typeof getDb>) {
  const env = getEnv();
  const tasks = await db
    .update(schema.purgeQueue)
    .set({ status: 'processing', attempts: sql`${schema.purgeQueue.attempts} + 1` })
    .where(and(eq(schema.purgeQueue.status, 'pending'), sql`${schema.purgeQueue.attempts} < 5`))
    .returning();

  for (const t of tasks.slice(0, BATCH)) {
    try {
      if (t.kind === 'r2_object') {
        const objectKey = (t.payload as { objectKey?: string }).objectKey;
        if (objectKey && env.R2_BUCKET) {
          await getR2Client().send(
            new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey }),
          );
        }
      } else if (t.kind === 'profile_anonymize') {
        // Already anonymised by DELETE /me — this entry is a hook for any future
        // downstream cleanup (cache busts, third-party SaaS deletes, etc.).
      }
      await db
        .update(schema.purgeQueue)
        .set({ status: 'done', processedAt: new Date() })
        .where(eq(schema.purgeQueue.id, t.id));
    } catch (err) {
      await db
        .update(schema.purgeQueue)
        .set({ status: 'failed', lastError: (err as Error).message })
        .where(eq(schema.purgeQueue.id, t.id));
      console.error(`[purge] task ${t.id} failed`, err);
    }
  }
}

async function main() {
  const env = getEnv();
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  const db = getDb(env.DATABASE_URL);
  await processExportJobs(db);
  await processPurgeQueue(db);
  void asc;
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
