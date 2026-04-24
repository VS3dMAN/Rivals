import type { FastifyPluginAsync } from 'fastify';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '../../db/client';
import {
  createGroupSchema,
  updateGroupSchema,
  inviteBodySchema,
  joinBodySchema,
  transferBodySchema,
} from '@rivals/shared/zod/groups';
import {
  HttpError,
  createGroup,
  deleteGroup,
  generateInviteCode,
  getGroupForMember,
  listGroupsForUser,
  requireAdmin,
  requireMember,
  updateGroup,
} from './service';

interface GroupsRouteOptions {
  db: Db;
}

const idParam = z.object({ id: z.string().uuid() });
const memberParams = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

const routes: FastifyPluginAsync<GroupsRouteOptions> = async (app, opts) => {
  const { db } = opts;

  // POST /groups
  app.post('/groups', async (req, reply) => {
    const auth = await app.requireAuth(req);
    const body = createGroupSchema.parse(req.body);
    const group = await createGroup(db, auth.id, body);
    return reply.status(201).send({
      ...group,
      isAdmin: true,
      memberCount: 1,
    });
  });

  // GET /groups
  app.get('/groups', async (req) => {
    const auth = await app.requireAuth(req);
    const groups = await listGroupsForUser(db, auth.id);
    return { groups };
  });

  // GET /groups/:id
  app.get('/groups/:id', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = idParam.parse(req.params);
    return getGroupForMember(db, id, auth.id);
  });

  // PATCH /groups/:id (admin)
  app.patch('/groups/:id', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = idParam.parse(req.params);
    const patch = updateGroupSchema.parse(req.body);
    return updateGroup(db, id, auth.id, patch);
  });

  // DELETE /groups/:id (admin)
  app.delete('/groups/:id', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = idParam.parse(req.params);
    return deleteGroup(db, id, auth.id);
  });

  // ---------------------------------------------------------------- INVITES

  // POST /groups/:id/invite — admin invites by username OR regenerates invite code
  app.post('/groups/:id/invite', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = idParam.parse(req.params);
    const body = inviteBodySchema.parse(req.body ?? {});
    await requireAdmin(db, id, auth.id);

    if (body.targetUsername) {
      const [target] = await db
        .select({ id: schema.users.id, username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.username, body.targetUsername))
        .limit(1);
      if (!target) {
        throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
      }
      if (target.id === auth.id) {
        throw new HttpError(400, 'INVALID_INVITE', 'Cannot invite yourself');
      }

      const [existingMember] = await db
        .select({ id: schema.groupMemberships.id })
        .from(schema.groupMemberships)
        .where(
          and(
            eq(schema.groupMemberships.groupId, id),
            eq(schema.groupMemberships.userId, target.id),
            isNull(schema.groupMemberships.leftAt),
          ),
        )
        .limit(1);
      if (existingMember) {
        throw new HttpError(409, 'ALREADY_MEMBER', 'User is already a member');
      }

      await db.insert(schema.notifications).values({
        userId: target.id,
        kind: 'member_join',
        payloadJson: {
          kind: 'group_invite',
          groupId: id,
          inviterUserId: auth.id,
        },
      });

      return { invited: target.username };
    }

    // Regenerate invite code
    let newCode = generateInviteCode();
    for (let i = 0; i < 5; i++) {
      const [clash] = await db
        .select({ id: schema.groups.id })
        .from(schema.groups)
        .where(eq(schema.groups.inviteCode, newCode))
        .limit(1);
      if (!clash) break;
      newCode = generateInviteCode();
    }
    const [updated] = await db
      .update(schema.groups)
      .set({ inviteCode: newCode })
      .where(eq(schema.groups.id, id))
      .returning({ inviteCode: schema.groups.inviteCode });
    if (!updated) {
      throw new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');
    }
    return { inviteCode: updated.inviteCode };
  });

  // POST /groups/join — join by invite code
  app.post('/groups/join', async (req) => {
    const auth = await app.requireAuth(req);
    const { inviteCode } = joinBodySchema.parse(req.body);

    const [group] = await db
      .select()
      .from(schema.groups)
      .where(
        and(eq(schema.groups.inviteCode, inviteCode), isNull(schema.groups.deletedAt)),
      )
      .limit(1);
    if (!group) {
      throw new HttpError(404, 'INVITE_INVALID', 'Invite code not found');
    }

    const [existing] = await db
      .select({ id: schema.groupMemberships.id })
      .from(schema.groupMemberships)
      .where(
        and(
          eq(schema.groupMemberships.groupId, group.id),
          eq(schema.groupMemberships.userId, auth.id),
          isNull(schema.groupMemberships.leftAt),
        ),
      )
      .limit(1);
    if (existing) {
      throw new HttpError(409, 'ALREADY_MEMBER', 'You are already in this group');
    }

    await db.insert(schema.groupMemberships).values({
      groupId: group.id,
      userId: auth.id,
      role: 'member',
    });

    return { groupId: group.id, name: group.name };
  });

  // --------------------------------------------------------- ADMIN ACTIONS

  // DELETE /groups/:id/members/:userId — admin removes a member
  app.delete('/groups/:id/members/:userId', async (req) => {
    const auth = await app.requireAuth(req);
    const { id, userId } = memberParams.parse(req.params);
    await requireAdmin(db, id, auth.id);

    if (userId === auth.id) {
      throw new HttpError(
        409,
        'USE_LEAVE_ENDPOINT',
        'Admins cannot remove themselves; use transfer or leave',
      );
    }

    const [target] = await db
      .select({ id: schema.groupMemberships.id })
      .from(schema.groupMemberships)
      .where(
        and(
          eq(schema.groupMemberships.groupId, id),
          eq(schema.groupMemberships.userId, userId),
          isNull(schema.groupMemberships.leftAt),
        ),
      )
      .limit(1);
    if (!target) {
      throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found');
    }

    await db
      .update(schema.groupMemberships)
      .set({ leftAt: new Date() })
      .where(eq(schema.groupMemberships.id, target.id));

    return { ok: true };
  });

  // POST /groups/:id/transfer — admin transfers to another member
  app.post('/groups/:id/transfer', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = idParam.parse(req.params);
    const { targetUserId } = transferBodySchema.parse(req.body);
    await requireAdmin(db, id, auth.id);

    if (targetUserId === auth.id) {
      throw new HttpError(400, 'SAME_USER', 'Target must be a different user');
    }

    const [target] = await db
      .select({ id: schema.groupMemberships.id })
      .from(schema.groupMemberships)
      .where(
        and(
          eq(schema.groupMemberships.groupId, id),
          eq(schema.groupMemberships.userId, targetUserId),
          isNull(schema.groupMemberships.leftAt),
        ),
      )
      .limit(1);
    if (!target) {
      throw new HttpError(
        400,
        'TARGET_NOT_MEMBER',
        'Target user is not a member of this group',
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.groups)
        .set({ adminUserId: targetUserId })
        .where(eq(schema.groups.id, id));

      // Demote outgoing admin, promote incoming
      await tx
        .update(schema.groupMemberships)
        .set({ role: 'member' })
        .where(
          and(
            eq(schema.groupMemberships.groupId, id),
            eq(schema.groupMemberships.userId, auth.id),
            isNull(schema.groupMemberships.leftAt),
          ),
        );
      await tx
        .update(schema.groupMemberships)
        .set({ role: 'admin' })
        .where(
          and(
            eq(schema.groupMemberships.groupId, id),
            eq(schema.groupMemberships.userId, targetUserId),
            isNull(schema.groupMemberships.leftAt),
          ),
        );

      await tx.insert(schema.notifications).values({
        userId: targetUserId,
        kind: 'admin_transfer',
        payloadJson: { groupId: id, previousAdminId: auth.id },
      });
    });

    return { ok: true, adminUserId: targetUserId };
  });

  // POST /groups/:id/leave — leave the group (admins must transfer first)
  app.post('/groups/:id/leave', async (req) => {
    const auth = await app.requireAuth(req);
    const { id } = idParam.parse(req.params);
    await requireMember(db, id, auth.id);

    const [group] = await db
      .select({ adminUserId: schema.groups.adminUserId })
      .from(schema.groups)
      .where(eq(schema.groups.id, id))
      .limit(1);
    if (!group) throw new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');

    if (group.adminUserId === auth.id) {
      throw new HttpError(
        409,
        'ADMIN_MUST_TRANSFER',
        'Transfer admin before leaving',
      );
    }

    await db
      .update(schema.groupMemberships)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(schema.groupMemberships.groupId, id),
          eq(schema.groupMemberships.userId, auth.id),
          isNull(schema.groupMemberships.leftAt),
        ),
      );

    return { ok: true };
  });

  // Touch unused import warnings away
  void sql;
};

export default routes;
