import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv, type Env } from '@rivals/shared/env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) _env = parseEnv(process.env);
  return _env;
}
