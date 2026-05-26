// Lightweight analytics shim around PostHog. Works on native + web. Reads the
// project key from app.config.ts extra (EXPO_PUBLIC_POSTHOG_API_KEY); when
// unset, all calls are no-ops so devs/PR previews don't accidentally produce
// noise in production analytics.

import Constants from 'expo-constants';

type PostHogLike = {
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify?: (id: string, props?: Record<string, unknown>) => void;
  screen?: (name: string, props?: Record<string, unknown>) => void;
};

let _ph: PostHogLike | null = null;
let _initialized = false;

function getConfig(): { apiKey?: string; host?: string } {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return { apiKey: extra.posthogApiKey, host: extra.posthogHost };
}

export function initAnalytics(): void {
  if (_initialized) return;
  _initialized = true;
  const { apiKey, host } = getConfig();
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[analytics] EXPO_PUBLIC_POSTHOG_API_KEY missing — running as no-op');
    }
    return;
  }
  // Dynamic import so apps that don't depend on PostHog can omit the package.
  // posthog-react-native is an optional peer dep — install with `pnpm add posthog-react-native`.
  (import('posthog-react-native' as string) as unknown as Promise<{
    default?: new (key: string, opts: { host?: string }) => PostHogLike;
    PostHog?: new (key: string, opts: { host?: string }) => PostHogLike;
  }>)
    .then((mod) => {
      const PostHog = mod.default ?? mod.PostHog;
      if (!PostHog) return;
      _ph = new PostHog(apiKey, { host });
    })
    .catch((err) => {
      console.warn('[analytics] posthog-react-native not installed', err);
    });
}

export function track(event: string, props?: Record<string, unknown>): void {
  _ph?.capture(event, props);
}

export function identify(userId: string, props?: Record<string, unknown>): void {
  _ph?.identify?.(userId, props);
}

export function trackScreen(name: string, props?: Record<string, unknown>): void {
  _ph?.screen?.(name, props);
}
