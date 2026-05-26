import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface StatsData {
  currentStreak: number;
  longestStreak: number;
  totalLogs: number;
  completionRate30d: number;
  calendar: { date: string; completed: boolean }[];
}

export function useStatsQuery(groupId: string) {
  return useQuery({
    queryKey: ['stats', groupId],
    queryFn: () => api<StatsData>(`/me/stats?groupId=${groupId}`),
    enabled: !!groupId,
  });
}

export type { StatsData };
