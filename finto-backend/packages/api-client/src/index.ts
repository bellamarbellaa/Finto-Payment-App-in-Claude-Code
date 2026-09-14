/**
 * Finto API client — one implementation for the mobile app and the desktop web
 * app.
 *
 * The only thing that differs between platforms is where tokens are kept, so
 * that is the only thing you inject: a `TokenStore`. On web, pass the built-in
 * `memoryTokenStore` and let the httpOnly refresh cookie do the rest. On React
 * Native, pass a store backed by expo-secure-store or react-native-keychain.
 *
 *   const api = createFintoClient({
 *     baseUrl: 'https://api.finto.app',
 *     tokens: memoryTokenStore(),
 *     credentials: 'include'   // web only, sends the refresh cookie
 *   });
 */
import type {
  Account,
  Card,
  Contact,
  ErrorCode,
  Money,
  Notification,
  PaymentRequest,
  PublicUser,
  RealtimeEvent,
  TokenPair,
  Transaction,
  TransactionGroup
} from './types.js';

export * from './types.js';

export interface TokenStore {
  getAccess(): string | null | Promise<string | null>;
  getRefresh(): string | null | Promise<string | null>;
  set(tokens: { accessToken: string; refreshToken?: string }): void | Promise<void>;
  clear(): void | Promise<void>;
}

/** Fine for web, where the refresh token lives in an httpOnly cookie instead. */
export function memoryTokenStore(): TokenStore {
  let access: string | null = null;
  let refresh: string | null = null;
  return {
    getAccess: () => access,
    getRefresh: () => refresh,
    set: (t) => {
      access = t.accessToken;
      if (t.refreshToken) refresh = t.refreshToken;
    },
    clear: () => {
      access = null;
      refresh = null;
    }
  };
}

export class FintoApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'FintoApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  /** 'include' on web so the refresh cookie travels; omit on React Native. */
  credentials?: RequestCredentials;
  /** Describes this device to the API on login. */
  device?: { name: string; platform: 'ios' | 'android' | 'web'; pushToken?: string };
  onSessionExpired?: () => void;
  fetch?: typeof fetch;
  /**
   * 'websocket' (the default) pushes events instantly over a persistent
   * connection — what every long-running deployment (Render, local dev)
   * should use. 'poll' is for a stateless host that cannot hold a socket
   * open (a Vercel serverless function): it asks `GET /v1/realtime/poll`
   * every few seconds instead, behind the exact same handler interface.
   */
  realtimeTransport?: 'websocket' | 'poll';
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
  /** Internal: prevents an infinite refresh loop. */
  retrying?: boolean;
}

export function createFintoClient(options: ClientOptions) {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = options.baseUrl.replace(/\/$/, '');

  // Concurrent 401s must trigger one refresh, not five.
  let refreshing: Promise<boolean> | null = null;

  async function refreshTokens(): Promise<boolean> {
    if (refreshing) return refreshing;

    refreshing = (async () => {
      try {
        const stored = await options.tokens.getRefresh();
        const res = await doFetch(`${base}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: options.credentials,
          body: JSON.stringify(stored ? { refreshToken: stored } : {})
        });

        if (!res.ok) {
          await options.tokens.clear();
          options.onSessionExpired?.();
          return false;
        }

        const pair = (await res.json()) as TokenPair;
        await options.tokens.set(pair);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();

    return refreshing;
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(`${base}${path}`);

    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;

    const access = await options.tokens.getAccess();
    if (access) headers.authorization = `Bearer ${access}`;

    const res = await doFetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      credentials: options.credentials,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });

    // A 401 on a short-lived access token is routine: refresh once and retry.
    if (res.status === 401 && !opts.retrying) {
      if (await refreshTokens()) {
        return request<T>(path, { ...opts, retrying: true });
      }
    }

    if (res.status === 204) return undefined as T;

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const error = (payload as { error?: { code: ErrorCode; message: string; details?: unknown } })?.error;
      throw new FintoApiError(
        res.status,
        error?.code ?? 'internal_error',
        error?.message ?? `Request failed with ${res.status}`,
        error?.details
      );
    }

    return payload as T;
  }

  /** Idempotency keys are generated here so no call site can forget one. */
  const newKey = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    request,

    auth: {
      async login(identifier: string, password: string) {
        const result = await request<{ user: PublicUser } & TokenPair>('/v1/auth/login', {
          method: 'POST',
          body: { identifier, password, device: options.device }
        });
        await options.tokens.set(result);
        return result;
      },

      async register(input: {
        email: string;
        password: string;
        fullName: string;
        handle?: string;
        phone?: string;
        baseCurrency?: string;
      }) {
        const result = await request<{ user: PublicUser } & TokenPair>('/v1/auth/register', {
          method: 'POST',
          body: { ...input, device: options.device }
        });
        await options.tokens.set(result);
        return result;
      },

      /**
       * Re-establish a session on page load, before any screen fetches.
       *
       * Without this the first request of every load 401s, refreshes and
       * retries — correct, but a wasted round trip and a console full of red.
       * Asking for the refresh up front turns that into one clean call.
       * Resolves false when there is no valid session to restore.
       */
      async restore(): Promise<boolean> {
        return refreshTokens();
      },

      async unlockWithPin(pin: string) {
        const refreshToken = await options.tokens.getRefresh();
        const result = await request<TokenPair>('/v1/auth/pin/unlock', {
          method: 'POST',
          body: refreshToken ? { pin, refreshToken } : { pin }
        });
        await options.tokens.set(result);
        return result;
      },

      setPin: (pin: string) => request<{ ok: true }>('/v1/auth/pin', { method: 'PUT', body: { pin } }),

      async logout() {
        try {
          await request<{ ok: true }>('/v1/auth/logout', { method: 'POST' });
        } finally {
          await options.tokens.clear();
        }
      },

      sessions: () =>
        request<{ sessions: { id: string; ip: string | null; userAgent: string | null; current: boolean }[] }>(
          '/v1/auth/sessions'
        ),

      revokeAllSessions: (keepCurrent = true) =>
        request<{ revoked: number }>('/v1/auth/sessions/revoke-all', {
          method: 'POST',
          body: { keepCurrent }
        })
    },

    users: {
      me: () => request<{ user: PublicUser }>('/v1/users/me'),
      update: (patch: Partial<Pick<PublicUser, 'fullName' | 'displayName' | 'phone' | 'tint'>>) =>
        request<{ user: PublicUser }>('/v1/users/me', { method: 'PATCH', body: patch }),
      updateSecurity: (patch: { biometricEnabled?: boolean; confirmPayments?: boolean }) =>
        request<{ user: PublicUser }>('/v1/users/me/security', { method: 'PATCH', body: patch }),
      changePassword: (currentPassword: string, newPassword: string) =>
        request<{ ok: true; otherSessionsRevoked: number }>('/v1/users/me/password', {
          method: 'PUT',
          body: { currentPassword, newPassword }
        })
    },

    accounts: {
      list: () =>
        request<{ accounts: Account[]; total: Money; baseCurrency: string }>('/v1/accounts'),
      get: (id: string) => request<{ account: Account }>(`/v1/accounts/${id}`),
      open: (currency: string, name?: string) =>
        request<{ account: Account }>('/v1/accounts', { method: 'POST', body: { currency, name } }),
      statement: (id: string, limit = 100) =>
        request<{ account: Account; entries: unknown[] }>(`/v1/accounts/${id}/statement`, {
          query: { limit }
        })
    },

    transactions: {
      list: (params: {
        filter?: 'all' | 'income' | 'spending' | 'pending';
        q?: string;
        accountId?: string;
        cardId?: string;
        cursor?: string;
        limit?: number;
        grouped?: boolean;
      } = {}) =>
        request<{
          transactions: Transaction[];
          groups?: TransactionGroup[];
          nextCursor: string | null;
          hasMore: boolean;
        }>('/v1/transactions', { query: { ...params, grouped: params.grouped ?? true } }),

      get: (id: string) => request<{ transaction: Transaction }>(`/v1/transactions/${id}`),

      summary: (params: { from?: string; to?: string; currency?: string } = {}) =>
        request<{
          currency: string;
          spent: Money;
          received: Money;
          net: Money;
          categories: { category: string; count: number; total: Money }[];
        }>('/v1/transactions/summary', { query: params })
    },

    payments: {
      quote: (input: { amount: string; fromAccountId?: string; currency?: string }) =>
        request<{
          amount: Money;
          available: Money;
          remainingAfter: Money;
          fee: Money;
          sufficient: boolean;
          warning: string | null;
        }>('/v1/payments/quote', { method: 'POST', body: input }),

      send: (
        input: {
          amount: string;
          contactId?: string;
          handle?: string;
          fromAccountId?: string;
          currency?: string;
          note?: string;
          password?: string;
        },
        idempotencyKey = newKey()
      ) =>
        request<{ transaction: Transaction; balanceAfter: Money }>('/v1/payments/send', {
          method: 'POST',
          body: input,
          idempotencyKey
        }),

      createRequest: (input: {
        amount: string;
        currency?: string;
        accountId?: string;
        contactId?: string;
        note?: string;
        expiresInHours?: number;
      }) => request<{ request: PaymentRequest }>('/v1/payments/requests', { method: 'POST', body: input }),

      listRequests: () => request<{ requests: PaymentRequest[] }>('/v1/payments/requests'),

      cancelRequest: (id: string) =>
        request<{ request: PaymentRequest }>(`/v1/payments/requests/${id}`, { method: 'DELETE' }),

      /** Hand this whatever the camera decoded — URL, deep link or bare token. */
      scan: (payload: string) =>
        request<{ request: PaymentRequest & { requester: { fullName: string; handle: string; tint: string } | null } }>(
          '/v1/payments/scan',
          { method: 'POST', body: { payload } }
        ),

      payRequest: (linkToken: string, fromAccountId?: string, idempotencyKey = newKey()) =>
        request<{ transaction: Transaction; balanceAfter: Money }>(
          `/v1/payments/requests/by-token/${linkToken}/pay`,
          { method: 'POST', body: { fromAccountId }, idempotencyKey }
        )
    },

    contacts: {
      list: (q?: string) => request<{ contacts: Contact[] }>('/v1/contacts', { query: { q } }),
      create: (input: { name: string; handle: string; tint?: string }) =>
        request<{ contact: Contact }>('/v1/contacts', { method: 'POST', body: input }),
      update: (id: string, patch: { name?: string; isFavourite?: boolean; tint?: string }) =>
        request<{ contact: Contact }>(`/v1/contacts/${id}`, { method: 'PATCH', body: patch }),
      remove: (id: string) => request<void>(`/v1/contacts/${id}`, { method: 'DELETE' }),
      lookup: (handle: string) =>
        request<{ found: boolean; user: { fullName: string; handle: string; tint: string; initials: string } | null }>(
          '/v1/contacts/lookup',
          { query: { handle } }
        )
    },

    cards: {
      list: () => request<{ cards: Card[] }>('/v1/cards'),
      get: (id: string) => request<{ card: Card }>(`/v1/cards/${id}`),
      create: (input: { holderName: string; kind?: 'virtual' | 'physical'; accountId?: string }) =>
        request<{ card: Card }>('/v1/cards', { method: 'POST', body: input }),
      freeze: (id: string, frozen: boolean) =>
        request<{ card: Card }>(`/v1/cards/${id}/freeze`, { method: 'POST', body: { frozen } }),
      updateControls: (
        id: string,
        controls: {
          onlinePayments?: boolean;
          paymentsAbroad?: boolean;
          contactless?: boolean;
          atmWithdrawals?: boolean;
          monthlyLimit?: string | null;
        }
      ) => request<{ card: Card }>(`/v1/cards/${id}/controls`, { method: 'PATCH', body: controls }),
      reveal: (id: string) =>
        request<{ revealToken: string; processorCardId: string; expiresIn: number }>(
          `/v1/cards/${id}/reveal`,
          { method: 'POST' }
        ),
      terminate: (id: string) => request<{ card: Card }>(`/v1/cards/${id}/terminate`, { method: 'POST' })
    },

    notifications: {
      list: (params: { limit?: number; unreadOnly?: boolean } = {}) =>
        request<{ notifications: Notification[]; unread: number }>('/v1/notifications', { query: params }),
      markRead: (id: string) =>
        request<{ notification: Notification; unread: number }>(`/v1/notifications/${id}/read`, {
          method: 'POST'
        }),
      markAllRead: () =>
        request<{ marked: number; unread: number }>('/v1/notifications/read-all', { method: 'POST' })
    },

    devices: {
      list: () => request<{ devices: unknown[] }>('/v1/devices'),
      registerPushToken: (input: {
        deviceId?: string;
        name: string;
        platform: 'ios' | 'android' | 'web';
        pushToken: string;
      }) => request<{ device: { id: string } }>('/v1/devices/push-token', { method: 'PUT', body: input })
    },

    fx: {
      currencies: () => request<{ currencies: { code: string }[] }>('/v1/fx/currencies'),
      rate: (from: string, to: string) =>
        request<{ base: string; quote: string; rate: string; asOf: string }>('/v1/fx/rate', {
          query: { from, to }
        }),
      quote: (from: string, to: string, amount: string) =>
        request<{ from: Money; to: Money; rate: string; asOf: string }>('/v1/fx/quote', {
          query: { from, to, amount }
        })
    },

    support: {
      faq: (q?: string) =>
        request<{ faq: { id: string; question: string; answer: string; category: string }[] }>(
          '/v1/support/faq',
          { query: { q } }
        ),
      tickets: () => request<{ tickets: unknown[] }>('/v1/support/tickets'),
      createTicket: (input: { subject: string; message: string; transactionId?: string }) =>
        request<{ ticket: unknown }>('/v1/support/tickets', { method: 'POST', body: input })
    },

    /**
     * Live updates. Works with the browser's WebSocket and with React Native's,
     * which is why nothing here reaches for a Node-only API.
     */
    realtime(handlers: {
      onEvent: (event: RealtimeEvent) => void;
      onOpen?: () => void;
      onClose?: () => void;
    }) {
      if (options.realtimeTransport === 'poll') {
        const POLL_INTERVAL_MS = 4000;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let lastRevision: number | null = null;
        let open = false;

        const tick = async () => {
          if (stopped) return;

          try {
            const result = await request<{ revision: number; unread: number }>('/v1/realtime/poll');

            if (!open) {
              open = true;
              handlers.onOpen?.();
            }

            handlers.onEvent({ type: 'connected', data: { unread: result.unread }, at: new Date().toISOString() });

            if (lastRevision !== null && result.revision !== lastRevision) {
              handlers.onEvent({ type: 'account.balance_changed', data: {}, at: new Date().toISOString() });
            }
            lastRevision = result.revision;
          } catch {
            if (open) {
              open = false;
              handlers.onClose?.();
            }
          } finally {
            if (!stopped) timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
          }
        };

        void tick();

        return {
          close() {
            stopped = true;
            if (timer) clearTimeout(timer);
          }
        };
      }

      let socket: WebSocket | null = null;
      let closedByUs = false;
      let attempt = 0;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const connect = async () => {
        const access = await options.tokens.getAccess();
        if (!access) return;

        const wsUrl = base.replace(/^http/, 'ws') + `/v1/realtime?token=${encodeURIComponent(access)}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          attempt = 0;
          handlers.onOpen?.();
          // Proxies drop idle sockets; a ping every 30s keeps the line warm.
          heartbeat = setInterval(() => socket?.readyState === 1 && socket.send('ping'), 30_000);
        };

        socket.onmessage = (event) => {
          if (event.data === 'pong') return;
          try {
            handlers.onEvent(JSON.parse(event.data as string) as RealtimeEvent);
          } catch {
            // A malformed frame is not worth tearing the connection down for.
          }
        };

        socket.onclose = () => {
          if (heartbeat) clearInterval(heartbeat);
          handlers.onClose?.();
          if (closedByUs) return;

          // Back off, but never wait more than half a minute to reconnect.
          const delay = Math.min(30_000, 1000 * 2 ** attempt++);
          setTimeout(() => void connect(), delay);
        };

        socket.onerror = () => socket?.close();
      };

      void connect();

      return {
        close() {
          closedByUs = true;
          if (heartbeat) clearInterval(heartbeat);
          socket?.close();
        }
      };
    }
  };
}

export type FintoClient = ReturnType<typeof createFintoClient>;
