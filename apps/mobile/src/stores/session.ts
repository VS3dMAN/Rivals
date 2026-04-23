import { create } from 'zustand';

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface SessionState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (s: { user: SessionUser; accessToken: string; refreshToken: string }) => void;
  setUser: (user: SessionUser | null) => void;
  clear: () => void;
  setHydrated: (v: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  setSession: ({ user, accessToken, refreshToken }) =>
    set({ user, accessToken, refreshToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ user: null, accessToken: null, refreshToken: null }),
  setHydrated: (v) => set({ hydrated: v }),
}));
