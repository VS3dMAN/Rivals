/**
 * Push notification dispatcher.
 *
 * Sends push notifications via the Expo Push API for iOS/Android tokens.
 * Web tokens require FCM (handled separately or via Expo if using Expo Go on web).
 */
import { createSign } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { schema, type Db } from '../../db/client';
import { getEnv } from '../../env';
interface SendPushParams {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Optional: notification kind for pref filtering */
  notifKind?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
}

/**
 * Send push notifications to a set of users.
 * Queries their registered push tokens and fans out via Expo Push API.
 */
/** Map notification kind to user pref key */
const kindToPrefKey: Record<string, string> = {
  group_activity: 'logSubmissions',
  streak_at_risk: 'streakAtRisk',
  milestone: 'streakMilestones',
  challenge_start: 'challengeEvents',
  challenge_end: 'challengeEvents',
  challenge_window_ending_soon: 'challengeEvents',
  member_join: 'groupInvites',
  admin_transfer: 'adminTransfers',
};

export async function sendPush(db: Db, params: SendPushParams): Promise<void> {
  const { userIds, title, body, data, notifKind } = params;

  if (userIds.length === 0) return;

  // Filter out users who have disabled this notification type or muted the group
  let filteredUserIds = userIds;
  if (notifKind) {
    const prefKey = kindToPrefKey[notifKind];
    if (prefKey) {
      const users = await db
        .select({ id: schema.users.id, notificationPrefs: schema.users.notificationPrefs })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds));

      const groupId = data?.groupId as string | undefined;
      filteredUserIds = users
        .filter((u) => {
          const prefs = (u.notificationPrefs ?? {}) as Record<string, unknown>;
          if (prefs[prefKey] === false) return false;
          if (groupId && Array.isArray(prefs.mutedGroupIds) && prefs.mutedGroupIds.includes(groupId)) return false;
          return true;
        })
        .map((u) => u.id);

      if (filteredUserIds.length === 0) return;
    }
  }

  const tokens = await db
    .select({ token: schema.pushTokens.token, platform: schema.pushTokens.platform })
    .from(schema.pushTokens)
    .where(inArray(schema.pushTokens.userId, filteredUserIds));

  if (tokens.length === 0) return;

  // Build Expo push messages for native tokens (ExponentPushToken[...])
  const expoMessages: ExpoPushMessage[] = [];
  // Web tokens would need FCM — collect separately
  const webTokens: string[] = [];

  for (const t of tokens) {
    if (t.platform === 'web') {
      webTokens.push(t.token);
    } else {
      expoMessages.push({
        to: t.token,
        title,
        body,
        data,
        sound: 'default',
      });
    }
  }

  // Send to Expo Push API in chunks of 100
  if (expoMessages.length > 0) {
    const chunks = chunkArray(expoMessages, 100);
    for (const chunk of chunks) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });
      } catch (err) {
        // Log but don't throw — push is best-effort
        console.error('[push] Expo push failed:', err);
      }
    }
  }

  // Web push via FCM HTTP v1
  if (webTokens.length > 0) {
    await sendFcmV1Batch(webTokens, { title, body, data });
  }
}

interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Cache the access token between calls within a process.
let _fcmAccessToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  if (_fcmAccessToken && Date.now() < _fcmAccessToken.expiresAt - 60_000) {
    return _fcmAccessToken.token;
  }
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
  };
  const b64 = (s: string) =>
    Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const toSign = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(toSign);
  const signature = signer
    .sign(privateKey.replace(/\\n/g, '\n'))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const jwt = `${toSign}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    console.error('[push] FCM oauth exchange failed', res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  _fcmAccessToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

async function sendFcmV1Batch(tokens: string[], payload: FcmPayload): Promise<void> {
  const env = getEnv();
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    console.warn(`[push] ${tokens.length} web token(s) skipped — FCM HTTP v1 env not configured`);
    return;
  }
  const access = await getFcmAccessToken(env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);
  if (!access) return;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`;
  await Promise.all(
    tokens.map(async (token) => {
      const message = {
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data
            ? Object.fromEntries(
                Object.entries(payload.data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
              )
            : undefined,
        },
      };
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });
        if (!res.ok) {
          console.error('[push] FCM send failed', res.status, await res.text());
        }
      } catch (err) {
        console.error('[push] FCM fetch failed', err);
      }
    }),
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
