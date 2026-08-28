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
   * The refresh token survives an app restart in the keychain, so a returning
   * user should land straight on Home. Redeem it before any screen fetches.
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
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
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
