import { z } from 'zod';

export const usernameRegex = /^[a-z0-9_]{3,24}$/;

export const usernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(usernameRegex, 'username must be 3-24 chars, lowercase letters/digits/underscore');

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
