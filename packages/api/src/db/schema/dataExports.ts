import { pgTable, uuid, text, timestamp, smallint, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const dataExportStatus = pgEnum('data_export_status', [
  'queued',
  'processing',
  'ready',
  'failed',
  'expired',
]);

export const dataExportJobs = pgTable('data_export_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  status: dataExportStatus('status').notNull().default('queued'),
  objectKey: text('object_key'),
  signedUrl: text('signed_url'),
  urlExpiresAt: timestamp('url_expires_at', { withTimezone: true }),
  error: text('error'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const purgeStatus = pgEnum('purge_status', ['pending', 'processing', 'done', 'failed']);

export const purgeQueue = pgTable('purge_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull().default('{}'),
  status: purgeStatus('status').notNull().default('pending'),
  attempts: smallint('attempts').notNull().default(0),
  lastError: text('last_error'),
  enqueuedAt: timestamp('enqueued_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});
