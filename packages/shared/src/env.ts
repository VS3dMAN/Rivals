import { z } from 'zod';

// Treat empty strings ("" from `.env`) as undefined for optional fields.
const optionalString = () =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const optionalUrl = () =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  DATABASE_URL: optionalUrl(),

  JWT_SECRET: z.string().min(16),
  API_PORT: z.coerce.number().int().positive().default(3000),

  R2_ACCESS_KEY_ID: optionalString(),
  R2_SECRET_ACCESS_KEY: optionalString(),
  R2_BUCKET: optionalString(),
  R2_PUBLIC_BASE_URL: optionalUrl(),

  SENTRY_DSN: optionalUrl(),

  FCM_SERVER_KEY: optionalString(),
  APNS_KEY_ID: optionalString(),
  APNS_TEAM_ID: optionalString(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
