import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { QueryClient } from '@tanstack/react-query';
import { runLogCompletion, type LogCompletionInput } from '../hooks/useLogCompletion';

const QUEUE_KEY = 'rivals-log-queue';

export interface QueuedLog extends LogCompletionInput {
  enqueuedAt: string;
}

async function readQueue(): Promise<QueuedLog[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedLog[];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedLog[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueue(input: LogCompletionInput): Promise<void> {
  const items = await readQueue();
  items.push({ ...input, enqueuedAt: new Date().toISOString() });
  await writeQueue(items);
}

export async function flush(qc: QueryClient): Promise<void> {
  const items = await readQueue();
  if (items.length === 0) return;

  const remaining: QueuedLog[] = [];
  for (const item of items) {
    try {
      await runLogCompletion(item, qc);
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
}

let unsubscribe: (() => void) | null = null;

export function subscribeLogQueueToNetwork(qc: QueryClient): () => void {
  if (unsubscribe) return unsubscribe;
  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void flush(qc);
    }
  });
  return unsubscribe;
}
