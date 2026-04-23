import type { FastifyPluginAsync } from 'fastify';

const startedAt = Date.now();

const routes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.1.0',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }));
};

export default routes;
