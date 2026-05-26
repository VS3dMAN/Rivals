import { Platform } from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { FeedResponse, AggregatedReaction } from '@rivals/shared/zod/feed';

export function useFeedQuery(groupId: string) {
  return useInfiniteQuery<FeedResponse>({
    queryKey: ['feed', groupId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam as string);
      return api<FeedResponse>(`/groups/${groupId}/feed?${params}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 60_000,
  });
}

export function useReactMutation(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, emoji }: { eventId: string; emoji: string }) => {
      if (Platform.OS !== 'web') {
        import('expo-haptics')
          .then((H) => H.impactAsync(H.ImpactFeedbackStyle.Light))
          .catch(() => void 0);
      }
      return api<{ reactions: AggregatedReaction[] }>(`/feed/${eventId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed', groupId] });
    },
  });
}
