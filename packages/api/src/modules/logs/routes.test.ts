import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import authPlugin from '../../plugins/auth';
import errorsPlugin from '../../plugins/errors';
import logsRoutes from './routes';
import type { R2Module } from '../../lib/r2';

const TEST_SECRET = 'test-secret-at-least-16-chars-long';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const GROUP_ID = '33333333-3333-3333-3333-333333333333';
const HABIT_ID = '44444444-4444-4444-4444-444444444444';
const PENDING_ID = '55555555-5555-5555-5555-555555555555';
const LOG_ID = '66666666-6666-6666-6666-666666666666';

function tokenFor(id: string, email = 'x@example.com') {
  return jwt.sign({ sub: id, email }, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

interface FakeState {
  members: Array<{ groupId: string; userId: string; role: 'admin' | 'member' }>;
  habits: Array<{ id: string; groupId: string; isActive: boolean; name: string }>;
  pending: Array<{
    id: string;
    userId: string;
    groupId: string;
    habitId: string;
    objectKey: string;
    expiresAt: Date;
  }>;
  habitLogs: Array<{
    id: string;
    habitId: string;
    userId: string;
    groupId: string;
    logDate: string;
    photoUrl: string;
    deletedAt: Date | null;
  }>;
  feedEvents: Array<{ groupId: string; actorUserId: string; kind: string }>;
  users: Array<{ id: string; timezone: string }>;
}

// Build a fake DB matching only the chains the logs routes invoke. Uses a
// simple "lookup" registry: each select chain decides which table by reading
// the .from() argument's symbol-stamped name. We cheat: we tag each schema
// table object by import order at runtime, but easier: peek at the columns
// passed to .select() to decide what to return.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFakeDb(state: FakeState): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fake: any = {
    _state: state,
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(fake),
    select: (cols?: Record<string, unknown>) => makeQuery(state, cols),
    insert: (table: { _: { name: string } }) => makeInsert(state, table),
    update: (table: { _: { name: string } }) => makeUpdate(state, table),
    delete: (table: { _: { name: string } }) => makeDelete(state, table),
  };
  return fake;
}

function tableNameOf(t: unknown): string {
  // drizzle pgTable returns an object whose Symbol(drizzle:Name) holds the table name
  const obj = t as Record<symbol, unknown>;
  for (const sym of Object.getOwnPropertySymbols(obj)) {
    if (sym.toString().includes('Name')) return String(obj[sym]);
  }
  return '';
}

function makeQuery(state: FakeState, _cols?: Record<string, unknown>) {
  let table = '';
  return {
    from(t: unknown) {
      table = tableNameOf(t);
      return this as unknown as {
        where: (..._w: unknown[]) => { limit: (n?: number) => Promise<unknown[]> };
      } & typeof obj;
    },
    where(..._w: unknown[]) {
      return this as unknown as {
        limit: (n?: number) => Promise<unknown[]>;
      } & typeof obj;
    },
    async limit(_n?: number): Promise<unknown[]> {
      return rowsForTable(state, table);
    },
    async orderBy(..._o: unknown[]): Promise<unknown[]> {
      return rowsForTable(state, table);
    },
  } as const;
  function obj() {}
}

function rowsForTable(state: FakeState, name: string): unknown[] {
  switch (name) {
    case 'group_memberships':
      return state.members.map((m) => ({ id: 'mid', role: m.role }));
    case 'habits':
      return state.habits;
    case 'pending_logs':
      return state.pending;
    case 'habit_logs':
      return state.habitLogs;
    case 'users':
      return state.users;
    case 'groups':
      return [{ adminUserId: USER_A }];
    default:
      return [];
  }
}

function makeInsert(state: FakeState, table: { _: { name: string } }) {
  const name = tableNameOf(table);
  return {
    values(v: Record<string, unknown> | Record<string, unknown>[]) {
      const rows = Array.isArray(v) ? v : [v];
      switch (name) {
        case 'pending_logs':
          for (const r of rows) {
            state.pending.push({
              id: r.id as string,
              userId: r.userId as string,
              groupId: r.groupId as string,
              habitId: r.habitId as string,
              objectKey: r.objectKey as string,
              expiresAt: r.expiresAt as Date,
            });
          }
          break;
        case 'habit_logs':
          for (const r of rows) {
            state.habitLogs.push({
              id: r.id as string,
              habitId: r.habitId as string,
              userId: r.userId as string,
              groupId: r.groupId as string,
              logDate: r.logDate as string,
              photoUrl: r.photoUrl as string,
              deletedAt: null,
            });
          }
          break;
        case 'feed_events':
          for (const r of rows) {
            state.feedEvents.push({
              groupId: r.groupId as string,
              actorUserId: r.actorUserId as string,
              kind: r.kind as string,
            });
          }
          break;
      }
      return {
        async returning() {
          if (name === 'habit_logs') {
            return [state.habitLogs[state.habitLogs.length - 1]];
          }
          return rows;
        },
      };
    },
  };
}

function makeUpdate(state: FakeState, table: { _: { name: string } }) {
  const name = tableNameOf(table);
  let patch: Record<string, unknown> = {};
  return {
    set(p: Record<string, unknown>) {
      patch = p;
      return this;
    },
    where(..._w: unknown[]) {
      // Best-effort: when soft-deleting habit_logs, mark *all* matching rows.
      if (name === 'habit_logs' && patch.deletedAt) {
        for (const log of state.habitLogs) {
          if (log.deletedAt === null) log.deletedAt = patch.deletedAt as Date;
        }
      }
      return {
        async returning() {
          return [];
        },
      };
    },
  };
}

function makeDelete(state: FakeState, table: { _: { name: string } }) {
  const name = tableNameOf(table);
  return {
    where(..._w: unknown[]) {
      if (name === 'pending_logs') state.pending.length = 0;
      return Promise.resolve();
    },
  };
}

function makeR2Mock(): R2Module & {
  _calls: { put: number; get: number; head: number; headReturn: 'ok' | 'null' };
} {
  const calls = { put: 0, get: 0, head: 0, headReturn: 'ok' as 'ok' | 'null' };
  return {
    _calls: calls,
    objectKeyForLog: (g, h, u, l) => `proofs/${g}/${h}/${u}/${l}.jpg`,
    issuePresignedPut: vi.fn(async (key: string) => {
      calls.put++;
      return {
        url: `https://r2.example.com/${key}?X-Amz-Expires=3600`,
        method: 'PUT' as const,
        headers: { 'Content-Type': 'image/jpeg' },
      };
    }),
    issuePresignedGet: vi.fn(async (key: string) => {
      calls.get++;
      return {
        url: `https://r2.example.com/${key}?X-Amz-Expires=3600&signed=get`,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };
    }),
    headObject: vi.fn(async () => {
      calls.head++;
      if (calls.headReturn === 'null') return null;
      return { contentLength: 1024, etag: '"abc"' };
    }),
  };
}

describe('logs routes', () => {
  let app: FastifyInstance;
  let state: FakeState;
  let r2: ReturnType<typeof makeR2Mock>;

  beforeEach(async () => {
    state = {
      members: [{ groupId: GROUP_ID, userId: USER_A, role: 'admin' }],
      habits: [{ id: HABIT_ID, groupId: GROUP_ID, isActive: true, name: 'Run' }],
      pending: [],
      habitLogs: [],
      feedEvents: [],
      users: [
        { id: USER_A, timezone: 'UTC' },
        { id: USER_B, timezone: 'UTC' },
      ],
    };
    r2 = makeR2Mock();
    app = Fastify();
    await app.register(sensible);
    await app.register(errorsPlugin);
    await app.register(authPlugin, { jwtSecret: TEST_SECRET });
    await app.register(logsRoutes, { db: makeFakeDb(state) as never, r2 });
    await app.ready();
  });

  // afterEach via beforeAll/afterAll pattern: the per-test app needs closing
  // but vitest allows top-level afterEach too — keeping it minimal here.
  beforeAll(() => void 0);
  afterAll(() => void 0);

  it('POST /logs/upload-url returns logId + presigned URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/logs/upload-url',
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
      payload: { groupId: GROUP_ID, habitId: HABIT_ID },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.uploadUrl).toMatch(/X-Amz-Expires=3600/);
    expect(body.objectKey).toMatch(/^proofs\//);
    expect(state.pending.length).toBe(1);
    expect(r2._calls.put).toBe(1);
    await app.close();
  });

  it('POST /logs/upload-url 404 when habit not in group', async () => {
    state.habits = [{ id: HABIT_ID, groupId: 'other', isActive: true, name: 'X' }];
    const res = await app.inject({
      method: 'POST',
      url: '/logs/upload-url',
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
      payload: { groupId: GROUP_ID, habitId: HABIT_ID },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('HABIT_NOT_FOUND');
    await app.close();
  });

  it('POST /logs rejects 6-min clock skew', async () => {
    state.pending.push({
      id: PENDING_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      objectKey: 'proofs/p.jpg',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const skewed = new Date(Date.now() - 6 * 60_000).toISOString();
    const res = await app.inject({
      method: 'POST',
      url: '/logs',
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
      payload: { logId: PENDING_ID, clientTimestamp: skewed },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('CLOCK_SKEW');
    await app.close();
  });

  it('POST /logs accepts 4-min skew', async () => {
    state.pending.push({
      id: PENDING_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      objectKey: 'proofs/p.jpg',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const ts = new Date(Date.now() - 4 * 60_000).toISOString();
    const res = await app.inject({
      method: 'POST',
      url: '/logs',
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
      payload: { logId: PENDING_ID, clientTimestamp: ts },
    });
    expect(res.statusCode).toBe(200);
    expect(state.habitLogs.length).toBe(1);
    expect(state.feedEvents.length).toBe(1);
    expect(state.pending.length).toBe(0);
    await app.close();
  });

  it('POST /logs returns 422 when R2 object missing', async () => {
    state.pending.push({
      id: PENDING_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      objectKey: 'proofs/missing.jpg',
      expiresAt: new Date(Date.now() + 60_000),
    });
    r2._calls.headReturn = 'null';
    const res = await app.inject({
      method: 'POST',
      url: '/logs',
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
      payload: { logId: PENDING_ID, clientTimestamp: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('UPLOAD_NOT_FOUND');
    await app.close();
  });

  it('POST /logs returns 410 when pending row expired', async () => {
    state.pending.push({
      id: PENDING_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      objectKey: 'proofs/p.jpg',
      expiresAt: new Date(Date.now() - 60_000),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/logs',
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
      payload: { logId: PENDING_ID, clientTimestamp: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(410);
    expect(res.json().code).toBe('UPLOAD_EXPIRED');
    await app.close();
  });

  it('POST /logs returns 404 when pending row belongs to another user', async () => {
    state.pending.push({
      id: PENDING_ID,
      userId: USER_B,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      objectKey: 'proofs/p.jpg',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/logs',
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
      payload: { logId: PENDING_ID, clientTimestamp: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('LOG_NOT_FOUND');
    await app.close();
  });

  it('POST /logs same-day resubmit soft-deletes prior row', async () => {
    state.pending.push({
      id: PENDING_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      habitId: HABIT_ID,
      objectKey: 'proofs/new.jpg',
      expiresAt: new Date(Date.now() + 60_000),
    });
    state.habitLogs.push({
      id: 'old',
      habitId: HABIT_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      logDate: new Date().toISOString().slice(0, 10),
      photoUrl: 'proofs/old.jpg',
      deletedAt: null,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/logs',
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
      payload: { logId: PENDING_ID, clientTimestamp: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(200);
    const old = state.habitLogs.find((l) => l.id === 'old');
    expect(old?.deletedAt).not.toBeNull();
    await app.close();
  });

  it('DELETE /logs/:id today succeeds', async () => {
    const today = new Date().toISOString().slice(0, 10);
    state.habitLogs.push({
      id: LOG_ID,
      habitId: HABIT_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      logDate: today,
      photoUrl: 'proofs/x.jpg',
      deletedAt: null,
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/logs/${LOG_ID}`,
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('DELETE /logs/:id prior day returns 409 LOG_LOCKED', async () => {
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    state.habitLogs.push({
      id: LOG_ID,
      habitId: HABIT_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      logDate: yesterday,
      photoUrl: 'proofs/x.jpg',
      deletedAt: null,
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/logs/${LOG_ID}`,
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('LOG_LOCKED');
    await app.close();
  });

  it('GET /logs/:id/photo-url returns presigned URL for member', async () => {
    state.habitLogs.push({
      id: LOG_ID,
      habitId: HABIT_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      logDate: new Date().toISOString().slice(0, 10),
      photoUrl: 'proofs/x.jpg',
      deletedAt: null,
    });
    const res = await app.inject({
      method: 'GET',
      url: `/logs/${LOG_ID}/photo-url`,
      headers: { authorization: `Bearer ${tokenFor(USER_A)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().url).toMatch(/signed=get/);
    expect(r2._calls.get).toBe(1);
    await app.close();
  });

  it('GET /logs/:id/photo-url returns 404 for non-member', async () => {
    state.members = []; // remove memberships entirely
    state.habitLogs.push({
      id: LOG_ID,
      habitId: HABIT_ID,
      userId: USER_A,
      groupId: GROUP_ID,
      logDate: new Date().toISOString().slice(0, 10),
      photoUrl: 'proofs/x.jpg',
      deletedAt: null,
    });
    const res = await app.inject({
      method: 'GET',
      url: `/logs/${LOG_ID}/photo-url`,
      headers: { authorization: `Bearer ${tokenFor(USER_B)}` },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
