import crypto from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest) => Promise<AuthUser>;
  }
}

interface AuthPluginOptions {
  /** Legacy shared secret. Verifies HS256 tokens (and the ones tests mint). */
  jwtSecret: string;
  /**
   * Supabase JWKS endpoint. Supabase signs access tokens with rotating
   * asymmetric keys (ES256) and identifies them by `kid`, so the shared secret
   * alone cannot verify a real user token.
   */
  jwksUrl?: string;
}

const JWKS_REFRESH_MS = 60_000;

const keyCache = new Map<string, crypto.KeyObject>();
let lastFetchedAt = 0;

/** Resolve a signing key by `kid`, refetching the key set when one is unknown. */
async function resolveKey(kid: string, jwksUrl: string): Promise<crypto.KeyObject | undefined> {
  const cached = keyCache.get(kid);
  if (cached) return cached;

  // Unknown kid means the keys may have rotated - refetch, but rate-limit so a
  // stream of bogus tokens cannot turn into a stream of outbound requests.
  if (Date.now() - lastFetchedAt < JWKS_REFRESH_MS) return undefined;
  lastFetchedAt = Date.now();

  const res = await fetch(jwksUrl);
  if (!res.ok) return undefined;
  const { keys } = (await res.json()) as { keys?: crypto.JsonWebKey[] };
  for (const jwk of keys ?? []) {
    const id = (jwk as { kid?: string }).kid;
    if (!id) continue;
    try {
      keyCache.set(id, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    } catch {
      // skip malformed entries rather than failing the whole key set
    }
  }
  return keyCache.get(kid);
}

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (app, opts) => {
  const { jwtSecret, jwksUrl } = opts;

  app.decorateRequest('user', undefined);

  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return;
    const token = header.slice('Bearer '.length);

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded) return;
      const { alg, kid } = decoded.header;

      let payload: { sub?: string; email?: string };
      if (alg === 'HS256') {
        payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as typeof payload;
      } else if (jwksUrl && kid) {
        const key = await resolveKey(kid, jwksUrl);
        if (!key) return;
        payload = jwt.verify(token, key, { algorithms: ['ES256', 'RS256'] }) as typeof payload;
      } else {
        return;
      }

      if (payload.sub && payload.email) {
        req.user = { id: payload.sub, email: payload.email };
      }
    } catch {
      // leave req.user undefined; requireAuth will 401
    }
  });

  app.decorate('requireAuth', async (req: FastifyRequest): Promise<AuthUser> => {
    if (!req.user) {
      const err = new Error('Unauthorized');
      (err as Error & { statusCode?: number; code?: string }).statusCode = 401;
      (err as Error & { code?: string }).code = 'UNAUTHORIZED';
      throw err;
    }
    return req.user;
  });
};

export default fp(plugin, { name: 'auth' });
