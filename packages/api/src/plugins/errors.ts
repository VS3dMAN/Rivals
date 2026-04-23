import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import * as Sentry from '@sentry/node';
import { ZodError } from 'zod';

const plugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        issues: err.issues,
      });
    }
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      req.log.error({ err }, 'unhandled error');
      if (Sentry.getClient()) Sentry.captureException(err);
    }
    return reply.status(status).send({
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    });
  });
};

export default fp(plugin, { name: 'errors' });
