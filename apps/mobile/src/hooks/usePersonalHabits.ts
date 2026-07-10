import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PersonalHabit {
  id: string;
  name: string;
  description: string | null;
  graceDays: number;
  isActive: boolean;
  completedToday: boolean;
  inGrace: boolean;
  currentStreak: number;
  longestStreak: number;
}

export interface PersonalHabitStats {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  totalLogs: number;
  completionRate30d: number;
  calendar: { date: string; completed: boolean }[];
}

export function usePersonalHabitsQuery() {
  return useQuery({
    queryKey: ['personal-habits'],
    queryFn: () => api<{ habits: PersonalHabit[]; today: string }>('/me/habits'),
  });
}

export function usePersonalHabitStats(habitId: string | null) {
  return useQuery({
    queryKey: ['personal-habit-stats', habitId],
    queryFn: () => api<PersonalHabitStats>(`/me/habits/${habitId}/stats`),
    enabled: Boolean(habitId),
  });
}

function useInvalidatePersonal() {
  const qc = useQueryClient();
  return (habitId?: string) => {
    void qc.invalidateQueries({ queryKey: ['personal-habits'] });
    if (habitId) {
      void qc.invalidateQueries({ queryKey: ['personal-habit-stats', habitId] });
    }
  };
}

export function useCreatePersonalHabit() {
  const invalidate = useInvalidatePersonal();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; graceDays: number }) =>
      api<PersonalHabit>('/me/habits', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePersonalHabit() {
  const invalidate = useInvalidatePersonal();
  return useMutation({
    mutationFn: ({
      habitId,
      ...patch
    }: {
      habitId: string;
      name?: string;
      description?: string | null;
      graceDays?: number;
      isActive?: boolean;
    }) =>
      api<PersonalHabit>(`/me/habits/${habitId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: (_data, vars) => invalidate(vars.habitId),
  });
}

export function useDeletePersonalHabit() {
  const invalidate = useInvalidatePersonal();
  return useMutation({
    mutationFn: (habitId: string) =>
      api(`/me/habits/${habitId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}

export function useCompletePersonalHabit() {
  const invalidate = useInvalidatePersonal();
  return useMutation({
    mutationFn: (habitId: string) =>
      api<{ completedToday: boolean; currentStreak: number; longestStreak: number }>(
        `/me/habits/${habitId}/complete`,
        { method: 'POST' },
      ),
    onSuccess: (_data, habitId) => invalidate(habitId),
  });
}

export function useUncompletePersonalHabit() {
  const invalidate = useInvalidatePersonal();
  return useMutation({
    mutationFn: (habitId: string) =>
      api<{ completedToday: boolean; currentStreak: number; longestStreak: number }>(
        `/me/habits/${habitId}/complete`,
        { method: 'DELETE' },
      ),
    onSuccess: (_data, habitId) => invalidate(habitId),
  });
}
