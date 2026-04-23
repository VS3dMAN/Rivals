import { buildServer } from './server';
import { getEnv } from './env';

async function main() {
  const env = getEnv();
  const app = await buildServer();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  app.log.info(`rivals api listening on :${env.API_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
