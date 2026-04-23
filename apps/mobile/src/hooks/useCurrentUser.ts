import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { useSessionStore, type SessionUser } from '../stores/session';

export interface CurrentUser extends SessionUser {
  avatarUrl: string | null;
  timezone: string;
  createdAt: string;
}

export function useCurrentUser() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const setUser = useSessionStore((s) => s.setUser);

  const query = useQuery({
    queryKey: ['me'],
    queryFn: () => api<CurrentUser>('/me'),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}
