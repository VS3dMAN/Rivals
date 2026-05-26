/**
 * Web push notification registration via FCM.
 *
 * Requires these env vars at build time (read via expo-constants or process.env):
 *   EXPO_PUBLIC_FIREBASE_API_KEY
 *   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   EXPO_PUBLIC_FIREBASE_PROJECT_ID
 *   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   EXPO_PUBLIC_FIREBASE_APP_ID
 *   EXPO_PUBLIC_FIREBASE_VAPID_KEY
 *
 * The matching service worker reads its config from /firebase-config.js — a
 * file the build pipeline writes from the same env at deploy time.
 */
import Constants from 'expo-constants';
import { api } from './api';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readFirebaseConfig(): { config: FirebaseConfig; vapidKey: string } | null {
  const extra =
    (Constants.expoConfig?.extra ?? (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra ?? {}) as Record<
      string,
      string | undefined
    >;
  const cfg: FirebaseConfig = {
    apiKey: extra.firebaseApiKey ?? '',
    authDomain: extra.firebaseAuthDomain ?? '',
    projectId: extra.firebaseProjectId ?? '',
    storageBucket: extra.firebaseStorageBucket ?? '',
    messagingSenderId: extra.firebaseMessagingSenderId ?? '',
    appId: extra.firebaseAppId ?? '',
  };
  const vapidKey = extra.firebaseVapidKey ?? '';
  if (!cfg.apiKey || !cfg.projectId || !vapidKey) return null;
  return { config: cfg, vapidKey };
}

export async function registerForPushNotifications(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (!('serviceWorker' in navigator)) return;
  if (Notification.permission === 'denied') return;

  const fc = readFirebaseConfig();
  if (!fc) {
    console.log('[push-web] Firebase env vars missing — skipping web push registration');
    return;
  }

  try {
    // Dynamic import to avoid bundling firebase on native
    // @ts-expect-error firebase is an optional peer dep — install with `pnpm add firebase` for web push.
    const { initializeApp } = await import('firebase/app');
    // @ts-expect-error see above
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    const app = initializeApp(fc.config);
    const messaging = getMessaging(app);

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const token = await getToken(messaging, {
      vapidKey: fc.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return;

    await api('/push/register', {
      method: 'POST',
      body: JSON.stringify({ platform: 'web', token }),
    });

    onMessage(messaging, (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => {
      // Foreground toast handling lives in components — log only here.
      console.log('[push-web] foreground message', payload?.notification?.title);
    });

    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      const { track } = await import('./analytics');
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.type === 'notification-click') {
          track('notification_opened', event.data.payload ?? {});
        }
      });
    }
  } catch (err) {
    console.error('[push-web] registration failed:', err);
  }
}
