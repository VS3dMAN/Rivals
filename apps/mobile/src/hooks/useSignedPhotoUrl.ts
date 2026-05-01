import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface PhotoUrlResponse {
  url: string;
  expiresAt: string;
}

// Signed GET URLs from R2 expire after 60 minutes; cache for 50 minutes to
// give ourselves a 10-minute safety margin before re-issuing.
export function useSignedPhotoUrl(logId: string | null | undefined) {
  return useQuery({
    queryKey: ['photo-url', logId],
    queryFn: () => api<PhotoUrlResponse>(`/logs/${logId}/photo-url`),
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    enabled: Boolean(logId),
  });
}
