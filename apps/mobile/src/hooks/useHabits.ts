import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface TodayHabit {
  id: string;
  name: string;
  description: string | null;
  graceDays: number;
  completedToday: boolean;
  inGrace: boolean;
}

export function useTodayHabitsQuery(groupId: string | null) {
  return useQuery({
    queryKey: ['habits-today', groupId],
    queryFn: () => api<{ habits: TodayHabit[]; today: string }>(`/groups/${groupId}/habits/today`),
    enabled: Boolean(groupId),
    refetchInterval: 60_000,
  });
}

export function useCreateHabit(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; graceDays: number }) =>
      api(`/groups/${groupId}/habits`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits-today', groupId] }),
  });
}
