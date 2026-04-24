import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  adminUserId: string;
  referenceTz: string;
  leaderboardMode: 'streak' | 'total' | 'window';
  inviteCode: string;
  memberCount: number;
  isAdmin: boolean;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
}

export function useGroupsQuery() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => api<{ groups: GroupSummary[] }>('/groups'),
    refetchInterval: 60_000,
  });
}

export function useGroupQuery(groupId: string | null) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: () => api<GroupDetail>(`/groups/${groupId}`),
    enabled: Boolean(groupId),
    refetchInterval: 60_000,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      referenceTz: string;
      avatarUrl?: string | null;
    }) =>
      api<GroupSummary>('/groups', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) =>
      api<{ groupId: string; name: string }>('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useInviteByUsername(groupId: string) {
  return useMutation({
    mutationFn: (targetUsername: string) =>
      api<{ invited: string }>(`/groups/${groupId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ targetUsername }),
      }),
  });
}

export function useRegenerateInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ inviteCode: string }>(`/groups/${groupId}/invite`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId] }),
  });
}

export function useRemoveMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ ok: true }>(`/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', groupId] }),
  });
}

export function useTransferAdmin(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) =>
      api<{ ok: true; adminUserId: string }>(`/groups/${groupId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useLeaveGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: true }>(`/groups/${groupId}/leave`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useUserSearch(prefix: string) {
  return useQuery({
    queryKey: ['userSearch', prefix],
    queryFn: () =>
      api<{ users: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }> }>(
        `/users/search?u=${encodeURIComponent(prefix)}`,
      ),
    enabled: prefix.trim().length >= 2,
  });
}
