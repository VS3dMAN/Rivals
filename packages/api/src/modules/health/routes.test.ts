import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import healthRoutes from './routes';

describe('GET /health', () => {
  const app = Fastify();

  beforeAll(async () => {
    await app.register(sensible);
    await app.register(healthRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(typeof body.version).toBe('string');
  });

  it('reports db unconfigured when no db is provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json().db).toBe('unconfigured');
  });
});

describe('GET /health with a db', () => {
  it('pings the db and reports ok', async () => {
    const app = Fastify();
    let pinged = false;
    const fakeDb = {
      execute: async () => {
        pinged = true;
        return [];
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await app.register(sensible);
    await app.register(healthRoutes, { db: fakeDb });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().db).toBe('ok');
    expect(pinged).toBe(true);
    await app.close();
  });

  it('stays 200 but reports db error when the ping throws', async () => {
    const app = Fastify({ logger: false });
    const fakeDb = {
      execute: async () => {
        throw new Error('connection refused');
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await app.register(sensible);
    await app.register(healthRoutes, { db: fakeDb });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().db).toBe('error');
    await app.close();
  });
});
