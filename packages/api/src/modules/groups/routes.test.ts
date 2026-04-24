import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import authPlugin from '../../plugins/auth';
import errorsPlugin from '../../plugins/errors';
import groupsRoutes from './routes';

const TEST_SECRET = 'test-secret-at-least-16-chars-long';

// Minimal in-memory fake matching the narrow db surface the routes touch.
// Only exercised methods are implemented — enough for error-path unit tests.
function createFakeDb() {
  const state = {
    groups: [] as any[],
    memberships: [] as any[],
    users: [] as any[],
    notifications: [] as any[],
  };

  const fake: any = {
    _state: state,
    transaction: async (fn: (tx: any) => Promise<unknown>) => fn(fake),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [] as unknown[],
          orderBy: async () => [] as unknown[],
        }),
        innerJoin: () => ({
          where: () => ({
            orderBy: async () => [] as unknown[],
            limit: async () => [] as unknown[],
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: '00000000-0000-0000-0000-0000000000aa' }],
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [] as unknown[],
        }),
      }),
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

describe('groups routes', () => {
  const app = Fastify();
  const db = createFakeDb();

  beforeAll(async () => {
    await app.register(sensible);
    await app.register(errorsPlugin);
    await app.register(authPlugin, { jwtSecret: TEST_SECRET });
    await app.register(groupsRoutes, { db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires auth on POST /groups', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/groups',
      payload: { name: 'Ops', referenceTz: 'UTC' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid body on POST /groups', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/groups',
      headers: {
        authorization: `Bearer ${tokenFor('11111111-1111-1111-1111-111111111111')}`,
      },
      payload: { name: '', referenceTz: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when non-member GETs a group', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/groups/00000000-0000-0000-0000-000000000001',
      headers: {
        authorization: `Bearer ${tokenFor('11111111-1111-1111-1111-111111111111')}`,
      },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('GROUP_NOT_FOUND');
  });

  it('returns 403 when non-admin PATCHes a group', async () => {
    // Our fake returns no group when queried — requireAdmin throws GROUP_NOT_FOUND.
    // For the admin/non-admin distinction, override select once.
    const caller = '22222222-2222-2222-2222-222222222222';
    const otherAdmin = '33333333-3333-3333-3333-333333333333';
    db.select = () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ adminUserId: otherAdmin }],
          orderBy: async () => [],
        }),
      }),
    });
    const res = await app.inject({
      method: 'PATCH',
      url: '/groups/00000000-0000-0000-0000-000000000002',
      headers: { authorization: `Bearer ${tokenFor(caller)}` },
      payload: { name: 'Renamed' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('NOT_ADMIN');
  });

  it('rejects invalid invite code shape on /groups/join', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/groups/join',
      headers: {
        authorization: `Bearer ${tokenFor('11111111-1111-1111-1111-111111111111')}`,
      },
      payload: { inviteCode: 'nope' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 ADMIN_MUST_TRANSFER when admin leaves', async () => {
    const caller = '44444444-4444-4444-4444-444444444444';
    // First the /leave route checks membership, then fetches the group.
    // Sequence two different select responses.
    let call = 0;
    db.select = () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            call += 1;
            if (call === 1) return [{ role: 'admin' }]; // requireMember
            return [{ adminUserId: caller }]; // group lookup
          },
          orderBy: async () => [],
        }),
      }),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/groups/00000000-0000-0000-0000-000000000003/leave',
      headers: { authorization: `Bearer ${tokenFor(caller)}` },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('ADMIN_MUST_TRANSFER');
  });
});
