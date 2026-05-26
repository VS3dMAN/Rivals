import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    inArray: (_col: unknown, values: unknown[]) => ({ __ids: values }),
  };
});

import { sendPush } from './dispatcher';

interface MockUser {
  id: string;
  notificationPrefs: Record<string, unknown>;
}

interface MockToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
}

function makeDb(users: MockUser[], tokens: MockToken[]) {
  function selectChain<T extends { userId?: string; id?: string }>(rows: T[]) {
    return {
      from() {
        return this;
      },
      where(filter: { __ids?: unknown[] } | undefined) {
        if (filter && Array.isArray(filter.__ids)) {
          const allowed = new Set(filter.__ids as string[]);
          return rows.filter((r) => allowed.has(r.userId ?? r.id ?? ''));
        }
        return rows;
      },
    };
  }
  return {
    select(_cols: Record<string, unknown>) {
      if ('notificationPrefs' in _cols) {
        return selectChain(
          users.map((u) => ({ id: u.id, notificationPrefs: u.notificationPrefs })),
        );
      }
      return selectChain(
        tokens.map((t) => ({ userId: t.userId, token: t.token, platform: t.platform })),
      );
    },
  } as never;
}

describe('sendPush — preference filtering', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  it('skips users who have muted the notification type', async () => {
    const db = makeDb(
      [
        { id: 'u1', notificationPrefs: { logSubmissions: false } },
        { id: 'u2', notificationPrefs: { logSubmissions: true } },
      ],
      [
        { userId: 'u1', token: 'ExponentPushToken[u1]', platform: 'ios' },
        { userId: 'u2', token: 'ExponentPushToken[u2]', platform: 'ios' },
      ],
    );

    await sendPush(db, {
      userIds: ['u1', 'u2'],
      title: 't',
      body: 'b',
      notifKind: 'group_activity',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error('expected fetch call');
    const sent = JSON.parse((call[1] as { body: string }).body);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ExponentPushToken[u2]');
  });

  it('skips users who have muted the specific group', async () => {
    const db = makeDb(
      [
        { id: 'u1', notificationPrefs: { logSubmissions: true, mutedGroupIds: ['g-muted'] } },
        { id: 'u2', notificationPrefs: { logSubmissions: true } },
      ],
      [
        { userId: 'u1', token: 'ExponentPushToken[u1]', platform: 'ios' },
        { userId: 'u2', token: 'ExponentPushToken[u2]', platform: 'ios' },
      ],
    );

    await sendPush(db, {
      userIds: ['u1', 'u2'],
      title: 't',
      body: 'b',
      data: { groupId: 'g-muted' },
      notifKind: 'group_activity',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error('expected fetch call');
    const sent = JSON.parse((call[1] as { body: string }).body);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ExponentPushToken[u2]');
  });

  it('does not call expo when all users are filtered out', async () => {
    const db = makeDb(
      [{ id: 'u1', notificationPrefs: { logSubmissions: false } }],
      [{ userId: 'u1', token: 'ExponentPushToken[u1]', platform: 'ios' }],
    );

    await sendPush(db, {
      userIds: ['u1'],
      title: 't',
      body: 'b',
      notifKind: 'group_activity',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not filter when notifKind is omitted', async () => {
    const db = makeDb(
      [{ id: 'u1', notificationPrefs: { logSubmissions: false } }],
      [{ userId: 'u1', token: 'ExponentPushToken[u1]', platform: 'ios' }],
    );

    await sendPush(db, {
      userIds: ['u1'],
      title: 't',
      body: 'b',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
