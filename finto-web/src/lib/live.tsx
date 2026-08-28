import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode
} from 'react';
import type { RealtimeEvent } from '@finto/api-client';
import { api } from './api';
import { useAuth } from './auth';

type Listener = (event: RealtimeEvent) => void;

interface LiveValue {
  /** Subscribe to server events. Returns an unsubscribe function. */
  subscribe: (listener: Listener) => () => void;
  /** Bumped whenever anything money-related changes, to retrigger fetches. */
  revision: number;
  unread: number;
  setUnread: (n: number) => void;
  connected: boolean;
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

  useEffect(() => {
    if (!user) {
      setConnected(false);
      return;
    }

    const socket = api.realtime({
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onEvent: (event) => {
        // Anything that changes money or its presentation invalidates the
        // screens; they refetch rather than trying to patch local state.
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

        if (event.type === 'notification.created') {
          setUnread((n) => n + 1);
        }

        for (const listener of listeners.current) listener(event);
      }
    });

    return () => socket.close();
  }, [user]);

  const value = useMemo(
    () => ({ subscribe, revision, unread, setUnread, connected }),
    [subscribe, revision, unread, connected]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error('useLive must be used inside LiveProvider');
  return value;
}
