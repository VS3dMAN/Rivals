import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import * as Sentry from '@sentry/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import authPlugin from './plugins/auth';
import errorsPlugin from './plugins/errors';
import healthRoutes from './modules/health/routes';
import usersRoutes from './modules/users/routes';
import authRoutes from './modules/auth/routes';
import groupsRoutes from './modules/groups/routes';
import habitsRoutes from './modules/habits/routes';
import { getDb, type Db } from './db/client';

export interface BuildOptions {
  logger?: boolean;
  db?: Db;
  supabase?: SupabaseClient;
}

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
    db: Db;
  }
}

export async function buildServer(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const env = getEnv();

  if (env.SENTRY_DSN && !Sentry.getClient()) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }

  const app = Fastify({
    logger: opts.logger ?? env.NODE_ENV !== 'test',
    trustProxy: true,
  });

  await app.register(sensible);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  const supabase =
    opts.supabase ??
    createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  app.decorate('supabase', supabase);

  const db = opts.db ?? (env.DATABASE_URL ? getDb(env.DATABASE_URL) : (null as unknown as Db));
  app.decorate('db', db);

  await app.register(errorsPlugin);
  await app.register(authPlugin, { jwtSecret: env.SUPABASE_JWT_SECRET });

  await app.register(healthRoutes);
  await app.register(usersRoutes, { db });
  await app.register(authRoutes, { db, supabase });
  await app.register(groupsRoutes, { db });
  await app.register(habitsRoutes, { db });

  return app;
}
