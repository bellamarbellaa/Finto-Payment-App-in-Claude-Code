import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { verifyAccessToken } from '../lib/tokens.js';
import { subscribe, connectionCount } from '../realtime/hub.js';
import { unreadCount } from '../modules/notifications/service.js';
import { requireUser } from './auth.js';
import { db } from '../db/client.js';
import { accounts, cards, notifications, transactions } from '../db/schema.js';

/**
 * A single number that changes whenever anything money-related changed for
 * this user — the poll fallback's substitute for a pushed event. Four small
 * indexed lookups (each table is indexed by user_id) rather than one
 * cross-table query, to stay easy to read and cheap either way.
 */
async function computeRevision(userId: string): Promise<number> {
  const [[acct], [tx], [card], [note]] = await Promise.all([
    db.select({ max: sql<string | null>`MAX(updated_at)` }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ max: sql<string | null>`MAX(created_at)` }).from(transactions).where(eq(transactions.userId, userId)),
    db.select({ max: sql<string | null>`MAX(updated_at)` }).from(cards).where(eq(cards.userId, userId)),
    db.select({ max: sql<string | null>`MAX(created_at)` }).from(notifications).where(eq(notifications.userId, userId))
  ]);

  const times = [acct?.max, tx?.max, card?.max, note?.max]
    .filter((t): t is string => Boolean(t))
    .map((t) => new Date(t).getTime());

  return times.length ? Math.max(...times) : 0;
}

/**
 * Live updates for both clients: `wss://api/v1/realtime?token=<accessToken>`.
 *
 * Browsers cannot set an Authorization header on a WebSocket handshake, so the
 * short-lived access token travels as a query parameter. That is acceptable
 * precisely because it is short-lived — the refresh token never goes near a URL.
 */
const realtimePlugin: FastifyPluginAsync = async (app) => {
  /**
   * Stand-in for clients that cannot hold a WebSocket open — namely the
   * Vercel-hosted deployment, where every request is a fresh, stateless
   * function invocation. Same information the socket's `connected`/event
   * push carries, polled instead of streamed.
   */
  app.get(
    '/realtime/poll',
    { preHandler: app.requireAuth, config: { rateLimit: false } },
    async (req) => {
      const { userId } = requireUser(req);
      const [revision, unread] = await Promise.all([computeRevision(userId), unreadCount(userId)]);
      return { revision, unread };
    }
  );

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
