import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'rivals.accessToken';
const REFRESH_KEY = 'rivals.refreshToken';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

function isWeb() {
  return Platform.OS === 'web';
}

async function setItem(key: string, value: string) {
  if (isWeb()) {
    if (typeof document !== 'undefined') {
      document.cookie = `${key}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`;
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb()) {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.split('; ').find((c) => c.startsWith(`${key}=`));
    return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string) {
  if (isWeb()) {
    if (typeof document !== 'undefined') {
      document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveSession(session: StoredSession) {
  await setItem(ACCESS_KEY, session.accessToken);
  await setItem(REFRESH_KEY, session.refreshToken);
}

export async function loadSession(): Promise<StoredSession | null> {
  const accessToken = await getItem(ACCESS_KEY);
  const refreshToken = await getItem(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearSession() {
  await removeItem(ACCESS_KEY);
  await removeItem(REFRESH_KEY);
}
