import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface BadgeItem {
  id: string;
  code: string;
  title: string;
  description: string;
  earned: boolean;
  awardedAt: string | null;
}

export function useBadgesQuery(groupId?: string) {
  return useQuery({
    queryKey: ['badges', groupId],
    queryFn: () => {
      const params = groupId ? `?groupId=${groupId}` : '';
      return api<{ badges: BadgeItem[] }>(`/me/badges${params}`);
    },
  });
}

export type { BadgeItem };
