import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { createFintoClient, type TokenStore } from '@finto/api-client';
import { Platform } from 'react-native';

const ACCESS_KEY = 'finto.access';
const REFRESH_KEY = 'finto.refresh';

/**
 * Tokens go in the device keychain, encrypted by iOS/Android. The access token
 * is also mirrored in memory so the common read does not hit the keychain on
 * every request.
 */
function secureTokenStore(): TokenStore {
  let cachedAccess: string | null = null;

  return {
    getAccess: async () => {
      if (cachedAccess) return cachedAccess;
      cachedAccess = await SecureStore.getItemAsync(ACCESS_KEY);
      return cachedAccess;
    },
    getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
    set: async (tokens) => {
      cachedAccess = tokens.accessToken;
      await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
      if (tokens.refreshToken) {
        await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
      }
    },
    clear: async () => {
      cachedAccess = null;
      await SecureStore.deleteItemAsync(ACCESS_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
  };
}

/**
 * A simulator or device cannot reach the host's "localhost". Expo reports the
 * development machine's LAN address, so the configured host is swapped for it
 * when running in development.
 */
function resolveBaseUrl(): string {
  const configured = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:4000';

  if (!__DEV__) return configured;

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];

  if (host && /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const port = configured.split(':').pop() ?? '4000';
    return `http://${host}:${port}`;
  }

  return configured;
}

let onExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onExpired = handler;
}

export const API_BASE_URL = resolveBaseUrl();

export const api = createFintoClient({
  baseUrl: API_BASE_URL,
  tokens: secureTokenStore(),
  // No cookies on native — the refresh token travels in the request body.
  device: {
    name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} · Finto`,
    platform: Platform.OS === 'ios' ? 'ios' : 'android'
  },
  onSessionExpired: () => onExpired?.(),
  // The API's Vercel deployment is serverless and cannot hold a WebSocket
  // open — see finto-backend/api/index.ts. Render/local dev keep the socket.
  realtimeTransport: Constants.expoConfig?.extra?.realtimeMode === 'poll' ? 'poll' : 'websocket'
});
