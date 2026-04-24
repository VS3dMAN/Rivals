import { z } from 'zod';

export const createHabitSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  graceDays: z.number().int().min(0).max(2).default(0),
});
export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export const updateHabitSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(500).nullable().optional(),
  graceDays: z.number().int().min(0).max(2).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;

export const todayHabitSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  graceDays: z.number().int(),
  completedToday: z.boolean(),
  inGrace: z.boolean(),
});
export type TodayHabit = z.infer<typeof todayHabitSchema>;
