import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
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
import personalRoutes from './modules/personal/routes';
import logsRoutes from './modules/logs/routes';
import leaderboardRoutes from './modules/leaderboard/routes';
import feedRoutes from './modules/feed/routes';
import pushRoutes from './modules/push/routes';
import notificationRoutes from './modules/notifications/routes';
import badgeRoutes from './modules/badges/routes';
import statsRoutes from './modules/stats/routes';
import { r2 } from './lib/r2';
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
  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  const forceHttps = env.FORCE_HTTPS ?? env.NODE_ENV === 'production';
  if (forceHttps) {
    app.addHook('onRequest', async (req, reply) => {
      const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
      if (proto && proto !== 'https') {
        const host = req.headers.host ?? '';
        return reply.code(301).redirect(`https://${host}${req.url}`);
      }
    });
  }

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

  await app.register(healthRoutes, { db });
  await app.register(usersRoutes, { db });
  await app.register(authRoutes, { db, supabase });
  await app.register(groupsRoutes, { db });
  await app.register(habitsRoutes, { db });
  await app.register(personalRoutes, { db });
  await app.register(logsRoutes, { db, r2 });
  await app.register(leaderboardRoutes, { db });
  await app.register(feedRoutes, { db, r2 });
  await app.register(pushRoutes, { db });
  await app.register(notificationRoutes, { db });
  await app.register(badgeRoutes, { db });
  await app.register(statsRoutes, { db });

  return app;
}
