import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';
import type {
  CreateGroupInput,
  UpdateGroupInput,
} from '@rivals/shared/zod/groups';

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return out;
}

export class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

export async function createGroup(
  db: Db,
  adminUserId: string,
  input: CreateGroupInput,
) {
  return db.transaction(async (tx) => {
    let inviteCode = generateInviteCode();
    // Retry on collision; the unique constraint will throw otherwise.
    for (let attempt = 0; attempt < 5; attempt++) {
      const [existing] = await tx
        .select({ id: schema.groups.id })
        .from(schema.groups)
        .where(eq(schema.groups.inviteCode, inviteCode))
        .limit(1);
      if (!existing) break;
      inviteCode = generateInviteCode();
    }

    const [group] = await tx
      .insert(schema.groups)
      .values({
        name: input.name,
        description: input.description ?? null,
        avatarUrl: input.avatarUrl ?? null,
        adminUserId,
        referenceTz: input.referenceTz,
        inviteCode,
      })
      .returning();

    if (!group) {
      throw new HttpError(500, 'INSERT_FAILED', 'Failed to create group');
    }

    await tx.insert(schema.groupMemberships).values({
      groupId: group.id,
      userId: adminUserId,
      role: 'admin',
    });

    return group;
  });
}

export async function listGroupsForUser(db: Db, userId: string) {
  const rows = await db
    .select({
      group: schema.groups,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${schema.groupMemberships}
        WHERE ${schema.groupMemberships.groupId} = ${schema.groups.id}
          AND ${schema.groupMemberships.leftAt} IS NULL
      )`,
    })
    .from(schema.groups)
    .innerJoin(
      schema.groupMemberships,
      and(
        eq(schema.groupMemberships.groupId, schema.groups.id),
        eq(schema.groupMemberships.userId, userId),
        isNull(schema.groupMemberships.leftAt),
      ),
    )
    .where(isNull(schema.groups.deletedAt))
    .orderBy(desc(schema.groups.createdAt));

  return rows.map((r) => ({
    ...r.group,
    memberCount: Number(r.memberCount),
    isAdmin: r.group.adminUserId === userId,
  }));
}

export async function getGroupForMember(
  db: Db,
  groupId: string,
  userId: string,
) {
  const [membership] = await db
    .select({ id: schema.groupMemberships.id })
    .from(schema.groupMemberships)
    .where(
      and(
        eq(schema.groupMemberships.groupId, groupId),
        eq(schema.groupMemberships.userId, userId),
        isNull(schema.groupMemberships.leftAt),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');
  }

  const [group] = await db
    .select()
    .from(schema.groups)
    .where(and(eq(schema.groups.id, groupId), isNull(schema.groups.deletedAt)))
    .limit(1);

  if (!group) throw new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');

  const members = await db
    .select({
      userId: schema.groupMemberships.userId,
      role: schema.groupMemberships.role,
      joinedAt: schema.groupMemberships.joinedAt,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.groupMemberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.groupMemberships.userId))
    .where(
      and(
        eq(schema.groupMemberships.groupId, groupId),
        isNull(schema.groupMemberships.leftAt),
      ),
    );

  return {
    ...group,
    isAdmin: group.adminUserId === userId,
    members,
  };
}

export async function requireAdmin(db: Db, groupId: string, userId: string) {
  const [group] = await db
    .select({ adminUserId: schema.groups.adminUserId })
    .from(schema.groups)
    .where(and(eq(schema.groups.id, groupId), isNull(schema.groups.deletedAt)))
    .limit(1);
  if (!group) throw new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');
  if (group.adminUserId !== userId) {
    throw new HttpError(403, 'NOT_ADMIN', 'Admin only');
  }
  return group;
}

export async function requireMember(db: Db, groupId: string, userId: string) {
  const [m] = await db
    .select({ role: schema.groupMemberships.role })
    .from(schema.groupMemberships)
    .where(
      and(
        eq(schema.groupMemberships.groupId, groupId),
        eq(schema.groupMemberships.userId, userId),
        isNull(schema.groupMemberships.leftAt),
      ),
    )
    .limit(1);
  if (!m) throw new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');
  return m;
}

export async function updateGroup(
  db: Db,
  groupId: string,
  adminUserId: string,
  patch: UpdateGroupInput,
) {
  await requireAdmin(db, groupId, adminUserId);

  if (Object.keys(patch).length === 0) {
    const [row] = await db
      .select()
      .from(schema.groups)
      .where(eq(schema.groups.id, groupId))
      .limit(1);
    return row;
  }

  const [updated] = await db
    .update(schema.groups)
    .set(patch)
    .where(eq(schema.groups.id, groupId))
    .returning();
  return updated;
}

export async function deleteGroup(db: Db, groupId: string, adminUserId: string) {
  await requireAdmin(db, groupId, adminUserId);
  await db
    .update(schema.groups)
    .set({ deletedAt: new Date() })
    .where(eq(schema.groups.id, groupId));
  return { ok: true };
}
