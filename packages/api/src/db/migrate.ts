import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, '../../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required to run migrations');
  process.exit(1);
}

const migrationsFolder = path.resolve(__dirname, 'migrations');

async function main() {
  const client = postgres(url!, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  console.info(`migrations applied from ${migrationsFolder}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
