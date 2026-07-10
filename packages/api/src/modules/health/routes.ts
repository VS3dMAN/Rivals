import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Db } from '../../db/client';

const startedAt = Date.now();

interface HealthRouteOptions {
  db?: Db;
}

const routes: FastifyPluginAsync<HealthRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // Touch the database on every hit. Supabase free-tier projects auto-pause
  // after ~7 days with no DB activity, so an uptime pinger on this endpoint
  // (every 5 min) keeps Postgres warm as well as the API process. We still
  // return 200 whenever the API process is alive — a transient DB blip should
  // not take the whole service "down" for Render's health check / Uptime Robot;
  // the `db` field reports the real state for anyone who cares.
  app.get('/health', async () => {
    let dbStatus: 'ok' | 'error' | 'unconfigured' = 'unconfigured';
    if (db) {
      try {
        await db.execute(sql`select 1`);
        dbStatus = 'ok';
      } catch (err) {
        dbStatus = 'error';
        app.log.warn({ err }, 'health check db ping failed');
      }
    }

    return {
      status: 'ok',
      db: dbStatus,
      version: process.env.npm_package_version ?? '0.1.0',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    };
  });
};

export default routes;
