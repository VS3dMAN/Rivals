import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import authPlugin from '../../plugins/auth';
import errorsPlugin from '../../plugins/errors';
import personalRoutes from './routes';

const TEST_SECRET = 'test-secret-at-least-16-chars-long';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const HABIT_ID = '00000000-0000-0000-0000-0000000000bb';

// Minimal in-memory fake matching the narrow db surface the routes touch.
// Only exercised methods are implemented — enough for error-path unit tests.
function createFakeDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fake: any = {
    select: () => ({
      from: () => ({
        where: () => {
          const rows: unknown[] = [];
          const chain = Object.assign(Promise.resolve(rows), {
            limit: async () => rows,
            orderBy: async () => rows,
          });
          return chain;
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: HABIT_ID }],
        onConflictDoNothing: () => ({
          returning: async () => [{ id: HABIT_ID }],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [] as unknown[],
        }),
      }),
    }),
    delete: () => ({
      where: async () => undefined,
    }),
  };
  return fake;
}

function tokenFor(id: string, email = 'x@example.com') {
  return jwt.sign({ sub: id, email }, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe('personal habits routes', () => {
  const app = Fastify();
  const db = createFakeDb();

  beforeAll(async () => {
    await app.register(sensible);
    await app.register(errorsPlugin);
    await app.register(authPlugin, { jwtSecret: TEST_SECRET });
    await app.register(personalRoutes, { db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires auth on GET /me/habits', async () => {
    const res = await app.inject({ method: 'GET', url: '/me/habits' });
    expect(res.statusCode).toBe(401);
  });

  it('requires auth on POST /me/habits', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/me/habits',
      payload: { name: 'Read' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an empty habit name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/me/habits',
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects graceDays outside 0-2', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/me/habits',
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload: { name: 'Read', graceDays: 3 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates a habit with valid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/me/habits',
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload: { name: 'Read 20 pages', graceDays: 1 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(HABIT_ID);
  });

  it('404s when completing a habit the user does not own', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/me/habits/${HABIT_ID}/complete`,
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('HABIT_NOT_FOUND');
  });

  it('returns an empty habit list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me/habits',
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().habits).toEqual([]);
  });
});
