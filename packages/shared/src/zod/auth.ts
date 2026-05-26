import { z } from 'zod';

export const usernameRegex = /^[a-z0-9_]{3,24}$/;

// Disallow names that are all digits/underscores (no letters) or that have leading/trailing
// underscores — these read as bots / placeholder accounts.
const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'system', 'support', 'help', 'rivals', 'api',
  'me', 'null', 'undefined', 'anonymous', 'user', 'test',
]);

function isAsciiOnly(s: string): boolean {
  // The regex above already restricts to ascii lower-case, but we double-check
  // here to reject any mixed-script / homoglyph attempt that might slip past
  // future regex changes.
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code > 127) return false;
  }
  return true;
}

export const usernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(usernameRegex, 'username must be 3-24 chars, lowercase letters/digits/underscore')
  .refine(isAsciiOnly, 'username must contain only ASCII characters')
  .refine((s) => /[a-z]/.test(s), 'username must contain at least one letter')
  .refine((s) => !s.startsWith('_') && !s.endsWith('_'), 'username cannot start or end with underscore')
  .refine((s) => !RESERVED_USERNAMES.has(s), 'username is reserved');

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: usernameSchema,
  displayName: z.string().min(1).max(60),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const usernameAvailableSchema = z.object({
  u: usernameSchema,
});

export const authSuccessSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    username: z.string(),
    displayName: z.string(),
  }),
});
export type AuthSuccess = z.infer<typeof authSuccessSchema>;
