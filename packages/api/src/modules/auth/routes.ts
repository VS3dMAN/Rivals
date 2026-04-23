import type { FastifyPluginAsync } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';
import {
  signupSchema,
  loginSchema,
  usernameAvailableSchema,
  usernameSchema,
} from '@rivals/shared/zod/auth';

interface AuthRouteOptions {
  db: Db;
  supabase: SupabaseClient;
}

function httpError(statusCode: number, code: string, message: string) {
  const err = new Error(message) as Error & { statusCode?: number; code?: string };
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

const routes: FastifyPluginAsync<AuthRouteOptions> = async (app, opts) => {
  const { db, supabase } = opts;

  // GET /auth/username-available?u=name
  app.get('/auth/username-available', async (req) => {
    const { u } = usernameAvailableSchema.parse(req.query);
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, u))
      .limit(1);
    return { available: !existing };
  });

  // POST /auth/signup
  app.post('/auth/signup', async (req, reply) => {
    const body = signupSchema.parse(req.body);

    // Pre-check username
    const [existingByUsername] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, body.username))
      .limit(1);
    if (existingByUsername) {
      throw httpError(409, 'USERNAME_TAKEN', 'Username is already taken');
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false,
      user_metadata: { username: body.username, display_name: body.displayName },
    });
    if (error || !data.user) {
      throw httpError(400, 'SIGNUP_FAILED', error?.message ?? 'Signup failed');
    }

    try {
      await db.insert(schema.users).values({
        id: data.user.id,
        email: body.email,
        username: body.username,
        displayName: body.displayName,
      });
    } catch (e) {
      // roll back supabase user if our row insert failed
      await supabase.auth.admin.deleteUser(data.user.id).catch(() => void 0);
      if ((e as { code?: string }).code === '23505') {
        throw httpError(409, 'USERNAME_TAKEN', 'Username is already taken');
      }
      throw e;
    }

    // Issue a session by signing the user in
    const { data: sessionData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (signInErr || !sessionData.session) {
      throw httpError(500, 'SESSION_FAILED', 'Created user but could not create session');
    }

    return reply.status(201).send({
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      user: {
        id: data.user.id,
        email: body.email,
        username: body.username,
        displayName: body.displayName,
      },
    });
  });

  // POST /auth/login
  app.post('/auth/login', async (req) => {
    const body = loginSchema.parse(req.body);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error || !data.session || !data.user) {
      throw httpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const [profile] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.id, data.user.id))
      .limit(1);

    if (!profile) {
      throw httpError(500, 'MISSING_PROFILE', 'User profile row missing');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: profile,
    };
  });

  // POST /auth/oauth/callback — exchanges Supabase OAuth code for session,
  // then upserts the `users` row. Used by the mobile/web Google flow.
  app.post('/auth/oauth/callback', async (req) => {
    const body = (req.body ?? {}) as { code?: string; username?: string };
    if (!body.code) throw httpError(400, 'MISSING_CODE', 'code is required');

    const { data, error } = await supabase.auth.exchangeCodeForSession(body.code);
    if (error || !data.session || !data.user) {
      throw httpError(401, 'OAUTH_FAILED', error?.message ?? 'OAuth exchange failed');
    }

    const email = data.user.email ?? '';
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, data.user.id))
      .limit(1);

    if (!existing) {
      // First-time Google user needs a username. The client should collect one
      // and pass it on the next call; reject until then.
      if (!body.username) {
        throw httpError(409, 'USERNAME_REQUIRED', 'Pick a username to finish signup');
      }
      const parsed = usernameSchema.safeParse(body.username);
      if (!parsed.success) {
        throw httpError(400, 'INVALID_USERNAME', parsed.error.issues[0]?.message ?? 'bad username');
      }
      await db.insert(schema.users).values({
        id: data.user.id,
        email,
        username: parsed.data,
        displayName: (data.user.user_metadata?.full_name as string | undefined) ?? parsed.data,
        avatarUrl: (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
      });
    }

    const [profile] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.id, data.user.id))
      .limit(1);

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: profile,
    };
  });

  // POST /auth/logout-all
  app.post('/auth/logout-all', async (req) => {
    const auth = await app.requireAuth(req);
    const { error } = await supabase.auth.admin.signOut(auth.id, 'global');
    if (error) {
      throw httpError(500, 'LOGOUT_FAILED', error.message);
    }
    return { ok: true };
  });
};

export default routes;
