import Constants from 'expo-constants';
import { useSessionStore } from '../stores/session';

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = useSessionStore.getState().accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const payload = body as { code?: string; message?: string } | undefined;
    throw new ApiError(
      res.status,
      payload?.code ?? 'HTTP_ERROR',
      payload?.message ?? res.statusText,
    );
  }
  return body as T;
}

export { API_URL };
