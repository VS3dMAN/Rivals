import { create } from 'zustand';
import { Platform } from 'react-native';

const STORAGE_KEY = 'rivals_onboarding';

function getStorage() {
  if (Platform.OS === 'web') {
    return {
      get: (key: string) => localStorage.getItem(key),
      set: (key: string, val: string) => localStorage.setItem(key, val),
    };
  }
  // On native, use a simple in-memory cache + lazy AsyncStorage
  let cache: Record<string, string> = {};
  return {
    get: (key: string) => cache[key] ?? null,
    set: (key: string, val: string) => {
      cache[key] = val;
      // Lazy persist
      import('@react-native-async-storage/async-storage').then((m) =>
        m.default.setItem(key, val),
      );
    },
  };
}

const storage = getStorage();

interface OnboardingState {
  hasSeenOnboarding: boolean;
  dismissedTooltips: Set<string>;
  markOnboardingComplete: () => void;
  dismissTooltip: (id: string) => void;
  hasSeenTooltip: (id: string) => boolean;
  hydrate: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  hasSeenOnboarding: false,
  dismissedTooltips: new Set(),

  markOnboardingComplete: () => {
    set({ hasSeenOnboarding: true });
    storage.set(STORAGE_KEY, JSON.stringify({ seen: true, tooltips: [...get().dismissedTooltips] }));
  },

  dismissTooltip: (id: string) => {
    const updated = new Set(get().dismissedTooltips);
    updated.add(id);
    set({ dismissedTooltips: updated });
    storage.set(STORAGE_KEY, JSON.stringify({ seen: get().hasSeenOnboarding, tooltips: [...updated] }));
  },

  hasSeenTooltip: (id: string) => get().dismissedTooltips.has(id),

  hydrate: async () => {
    try {
      const raw = storage.get(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          hasSeenOnboarding: data.seen ?? false,
          dismissedTooltips: new Set(data.tooltips ?? []),
        });
      }
    } catch {
      // ignore
    }
  },
}));
