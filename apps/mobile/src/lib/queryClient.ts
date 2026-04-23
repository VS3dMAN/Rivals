import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function createPersister(): Persister {
  if (Platform.OS === 'web') {
    const webStorage = {
      getItem: async (key: string) => (typeof window !== 'undefined' ? window.localStorage.getItem(key) : null),
      setItem: async (key: string, value: string) => {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      },
    };
    return createAsyncStoragePersister({ storage: webStorage, key: 'rivals-query-cache' });
  }
  return createAsyncStoragePersister({ storage: AsyncStorage, key: 'rivals-query-cache' });
}
