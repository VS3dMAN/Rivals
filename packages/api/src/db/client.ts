import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(databaseUrl: string) {
  if (_db) return _db;
  const client = postgres(databaseUrl, { prepare: false, max: 10 });
  _db = drizzle(client, { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
