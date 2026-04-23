import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
});
