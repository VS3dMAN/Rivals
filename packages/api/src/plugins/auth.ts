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
  jwtSecret: string;
}

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (app, opts) => {
  const { jwtSecret } = opts;

  app.decorateRequest('user', undefined);

  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return;
    const token = header.slice('Bearer '.length);
    try {
      const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as {
        sub?: string;
        email?: string;
      };
      if (decoded.sub && decoded.email) {
        req.user = { id: decoded.sub, email: decoded.email };
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
