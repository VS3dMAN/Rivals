import { z } from 'zod';

export const createPersonalHabitSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  graceDays: z.number().int().min(0).max(2).default(0),
});
export type CreatePersonalHabitInput = z.infer<typeof createPersonalHabitSchema>;

export const updatePersonalHabitSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(500).nullable().optional(),
  graceDays: z.number().int().min(0).max(2).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePersonalHabitInput = z.infer<typeof updatePersonalHabitSchema>;

export const personalHabitCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  graceDays: z.number().int(),
  isActive: z.boolean(),
  completedToday: z.boolean(),
  inGrace: z.boolean(),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
});
export type PersonalHabitCard = z.infer<typeof personalHabitCardSchema>;
