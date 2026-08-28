import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { AppState } from 'react-native';
import type { RealtimeEvent } from '@finto/api-client';
import { api } from './api';
import { useAuth } from './auth';

type Listener = (event: RealtimeEvent) => void;

interface LiveValue {
  subscribe: (listener: Listener) => () => void;
  revision: number;
  unread: number;
  setUnread: (n: number) => void;
  connected: boolean;
  refresh: () => void;
}

const LiveContext = createContext<LiveValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<Listener>());

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      return;
    }

    const socket = api.realtime({
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onEvent: (event) => {
        if (
          event.type === 'transaction.created' ||
          event.type === 'transaction.updated' ||
          event.type === 'account.balance_changed' ||
          event.type === 'card.updated' ||
          event.type === 'payment_request.updated'
        ) {
          setRevision((r) => r + 1);
        }

        if (event.type === 'connected') {
          const data = event.data as { unread?: number };
          if (typeof data?.unread === 'number') setUnread(data.unread);
        }

        if (event.type === 'notification.created') setUnread((n) => n + 1);

        for (const listener of listeners.current) listener(event);
      }
    });

    /*
     * iOS suspends sockets when the app goes to the background, and anything
     * that happened while away was missed. Coming back to the foreground forces
     * a refetch rather than trusting stale balances.
     */
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRevision((r) => r + 1);
    });

    return () => {
      socket.close();
      subscription.remove();
    };
  }, [user]);

  const value = useMemo(
    () => ({ subscribe, revision, unread, setUnread, connected, refresh }),
    [subscribe, revision, unread, connected, refresh]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error('useLive must be used inside LiveProvider');
  return value;
}
