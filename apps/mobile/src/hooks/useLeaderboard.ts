import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// -------- Types --------

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  currentStreak: number;
  longestStreak: number;
  joinedAt: string;
  rank: number;
}

export interface ChallengeWindowSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface LeaderboardResponse {
  mode: 'streak' | 'total' | 'window';
  memberCount: number;
  challengeWindow: ChallengeWindowSummary | null;
  entries: LeaderboardEntry[];
}

export interface ChallengeWindow {
  id: string;
  groupId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed';
  winnerUserId: string | null;
}

// -------- Hooks --------

export function useLeaderboardQuery(groupId: string | null) {
  return useQuery({
    queryKey: ['leaderboard', groupId],
    queryFn: () => api<LeaderboardResponse>(`/groups/${groupId}/leaderboard`),
    enabled: Boolean(groupId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useChallengesQuery(groupId: string | null, status?: string) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['challenges', groupId, status],
    queryFn: () =>
      api<{ challenges: ChallengeWindow[] }>(`/groups/${groupId}/challenges${qs}`),
    enabled: Boolean(groupId),
  });
}

export function useCreateChallenge(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; startDate: string; endDate: string }) =>
      api<ChallengeWindow>(`/groups/${groupId}/challenges`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges', groupId] });
      qc.invalidateQueries({ queryKey: ['leaderboard', groupId] });
    },
  });
}

export function useUpdateGroupMode(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leaderboardMode: 'streak' | 'total' | 'window') =>
      api(`/groups/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify({ leaderboardMode }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaderboard', groupId] });
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}
