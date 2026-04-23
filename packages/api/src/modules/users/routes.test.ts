import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import authPlugin from '../../plugins/auth';
import errorsPlugin from '../../plugins/errors';
import usersRoutes from './routes';

const TEST_SECRET = 'test-secret-at-least-16-chars-long';

const fakeDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => [
          {
            id: '00000000-0000-0000-0000-000000000001',
            username: 'alice',
            displayName: 'Alice',
            email: 'alice@example.com',
            avatarUrl: null,
            timezone: 'UTC',
            createdAt: new Date(),
          },
        ],
      }),
    }),
  }),
} as any;

describe('GET /me', () => {
  const app = Fastify();

  beforeAll(async () => {
    await app.register(sensible);
    await app.register(errorsPlugin);
    await app.register(authPlugin, { jwtSecret: TEST_SECRET });
    await app.register(usersRoutes, { db: fakeDb });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with a valid token', async () => {
    const token = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000001', email: 'alice@example.com' },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe('alice');
  });
});
