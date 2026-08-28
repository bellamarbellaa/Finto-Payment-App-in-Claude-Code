import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { PublicUser } from '@finto/api-client';
import { api, setSessionExpiredHandler } from './api';

interface AuthValue {
  user: PublicUser | null;
  /** null while the initial session check is still running. */
  ready: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * On a fresh page load there is no access token in memory, but the refresh
   * cookie may still be valid. Redeem it first, then load the profile — doing
   * it in that order means no screen ever fires a request that is guaranteed
   * to 401.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const restored = await api.auth.restore();
        if (!restored) {
          if (!cancelled) setUser(null);
          return;
        }

        const { user: me } = await api.users.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const result = await api.auth.login(identifier, password);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: me } = await api.users.me();
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, refreshUser }),
    [user, ready, signIn, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
