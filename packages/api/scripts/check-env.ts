import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from '@rivals/shared/env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, '../../../.env') });

try {
  parseEnv(process.env);
  console.info('env ok');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
