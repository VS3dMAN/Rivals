import { Platform } from 'react-native';
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '../lib/api';

export interface LogCompletionInput {
  groupId: string;
  habitId: string;
  // Either a Blob (web) or a file URI (native).
  body: Blob | { uri: string };
  // Defaults to now() at mutation time.
  clientTimestamp?: string;
}

interface UploadUrlResponse {
  logId: string;
  uploadUrl: string;
  headers: Record<string, string>;
  objectKey: string;
  expiresAt: string;
}

async function bodyToBlob(body: Blob | { uri: string }): Promise<Blob> {
  if (body instanceof Blob) return body;
  const res = await fetch(body.uri);
  return res.blob();
}

// Pure function form: same logic as the mutation, callable from the offline
// queue without going through React Query's mutation machinery.
export async function runLogCompletion(
  input: LogCompletionInput,
  qc: QueryClient,
): Promise<{ logId: string }> {
  const { groupId, habitId, body, clientTimestamp = new Date().toISOString() } = input;

  const presigned = await api<UploadUrlResponse>('/logs/upload-url', {
    method: 'POST',
    body: JSON.stringify({ groupId, habitId }),
  });

  const blob = await bodyToBlob(body);
  const putRes = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: presigned.headers,
  });
  if (!putRes.ok) {
    throw new Error(`R2 upload failed: ${putRes.status}`);
  }

  await api('/logs', {
    method: 'POST',
    body: JSON.stringify({ logId: presigned.logId, clientTimestamp }),
  });

  qc.invalidateQueries({ queryKey: ['habits-today', groupId] });
  qc.invalidateQueries({ queryKey: ['leaderboard', groupId] });
  qc.invalidateQueries({ queryKey: ['group', groupId] });

  return { logId: presigned.logId };
}

function isLikelyNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const msg = (e as Error)?.message ?? '';
  return /network|fetch failed|timeout|offline/i.test(msg);
}

export function useLogCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogCompletionInput) => runLogCompletion(input, qc),
    retry: 0,
    onError: async (error, input) => {
      // Only enqueue on native and only for network-shaped errors. Validation
      // errors (CLOCK_SKEW, UPLOAD_NOT_FOUND) shouldn't be retried.
      if (Platform.OS === 'web') return;
      if (!isLikelyNetworkError(error)) return;
      // Lazy-import to avoid a static cycle: useLogCompletion -> logQueue -> useLogCompletion.
      const { enqueue } = await import('../lib/logQueue');
      await enqueue(input);
    },
  });
}
