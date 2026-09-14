import { createFintoClient, type TokenStore } from '@finto/api-client';

/**
 * The refresh token lives in an httpOnly cookie the server sets, so it is
 * deliberately not reachable from here. Only the short-lived access token is
 * held, and only in memory — a page reload asks the cookie for a new one,
 * which is what keeps a stolen localStorage value from being a 30-day login.
 */
function browserTokenStore(): TokenStore {
  let access: string | null = null;
  return {
    getAccess: () => access,
    getRefresh: () => null,
    set: (t) => { access = t.accessToken; },
    clear: () => { access = null; }
  };
}

let onExpired: (() => void) | null = null;

/** Registered by the auth provider so a dead session bounces to /login once. */
export function setSessionExpiredHandler(handler: () => void) {
  onExpired = handler;
}

export const api = createFintoClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  tokens: browserTokenStore(),
  credentials: 'include',
  device: { name: deviceName(), platform: 'web' },
  onSessionExpired: () => onExpired?.(),
  // The API's Vercel deployment is serverless and cannot hold a WebSocket
  // open — see finto-backend/api/index.ts. Render/local dev keep the socket.
  realtimeTransport: import.meta.env.VITE_REALTIME_MODE === 'poll' ? 'poll' : 'websocket'
});

function deviceName(): string {
  const ua = navigator.userAgent;
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /Firefox\//.test(ua) ? 'Firefox' : 'Browser';

  const os =
    /Mac OS X/.test(ua) ? 'macOS' :
    /Windows/.test(ua) ? 'Windows' :
    /Linux/.test(ua) ? 'Linux' : '';

  return os ? `${browser} on ${os}` : browser;
}
