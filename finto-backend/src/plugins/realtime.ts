import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { verifyAccessToken } from '../lib/tokens.js';
import { subscribe, connectionCount } from '../realtime/hub.js';
import { unreadCount } from '../modules/notifications/service.js';

/**
 * Live updates for both clients: `wss://api/v1/realtime?token=<accessToken>`.
 *
 * Browsers cannot set an Authorization header on a WebSocket handshake, so the
 * short-lived access token travels as a query parameter. That is acceptable
 * precisely because it is short-lived — the refresh token never goes near a URL.
 */
const realtimePlugin: FastifyPluginAsync = async (app) => {
  app.get('/realtime', { websocket: true, config: { rateLimit: false } }, (socket, req) => {
    const query = z.object({ token: z.string().min(10) }).safeParse(req.query);

    if (!query.success) {
      socket.close(4401, 'Missing token');
      return;
    }

    let userId: string;
    try {
      userId = verifyAccessToken(query.data.token).sub;
    } catch {
      socket.close(4401, 'Invalid token');
      return;
    }

    const unsubscribe = subscribe(userId, socket);

    void unreadCount(userId).then((unread) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({ type: 'connected', data: { unread }, at: new Date().toISOString() }));
      }
    });

    // A silent connection is indistinguishable from a dead one behind a proxy,
    // so answer the client's pings and drop anything else.
    socket.on('message', (raw: Buffer) => {
      if (raw.toString() === 'ping' && socket.readyState === 1) socket.send('pong');
    });

    socket.on('close', unsubscribe);
    socket.on('error', unsubscribe);

    req.log.debug({ userId, connections: connectionCount(userId) }, 'realtime connected');
  });
};

export default realtimePlugin;
