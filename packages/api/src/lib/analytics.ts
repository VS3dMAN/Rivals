// Server-side analytics. Sends events to PostHog when POSTHOG_API_KEY is set;
// no-op otherwise. Uses the capture HTTP endpoint directly to avoid pulling in
// a heavy SDK in a Fastify hot path.
//
// Required env: POSTHOG_API_KEY (project API key), optional POSTHOG_HOST.

import { getEnv } from '../env';

type CaptureBody = {
  api_key: string;
  event: string;
  distinct_id: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
};

let _warned = false;

export async function track(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const env = getEnv();
  if (!env.POSTHOG_API_KEY) {
    if (!_warned) {
      _warned = true;
      console.info('[analytics] POSTHOG_API_KEY missing — analytics disabled');
    }
    return;
  }
  const host = env.POSTHOG_HOST ?? 'https://us.i.posthog.com';
  const body: CaptureBody = {
    api_key: env.POSTHOG_API_KEY,
    event,
    distinct_id: distinctId,
    properties,
    timestamp: new Date().toISOString(),
  };
  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[analytics] capture failed', err);
  }
}
