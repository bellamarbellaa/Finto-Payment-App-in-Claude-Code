import type { WebSocket } from 'ws';

/**
 * Per-user fan-out for live updates. A user is usually connected from more
 * than one place at once — phone in a pocket, dashboard open on a laptop — and
 * a payment made on one should land on the other without a pull-to-refresh.
 *
 * This is an in-process hub. Behind more than one API instance, swap the
 * `publish` body for a Redis pub/sub broadcast; the call sites do not change.
 */
export type RealtimeEvent =
  | { type: 'transaction.created'; data: unknown }
  | { type: 'transaction.updated'; data: unknown }
  | { type: 'account.balance_changed'; data: unknown }
  | { type: 'notification.created'; data: unknown }
  | { type: 'card.updated'; data: unknown }
  | { type: 'payment_request.updated'; data: unknown }
  | { type: 'session.revoked'; data: unknown };

const connections = new Map<string, Set<WebSocket>>();

export function subscribe(userId: string, socket: WebSocket): () => void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(socket);

  return () => {
    const current = connections.get(userId);
    if (!current) return;
    current.delete(socket);
    if (current.size === 0) connections.delete(userId);
  };
}

export function publish(userId: string, event: RealtimeEvent): void {
  const sockets = connections.get(userId);
  if (!sockets?.size) return;

  const payload = JSON.stringify(
    { ...event, at: new Date().toISOString() },
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v)
  );

  for (const socket of sockets) {
    // readyState 1 === OPEN. Sending to a closing socket throws.
    if (socket.readyState === 1) {
      try {
        socket.send(payload);
      } catch {
        sockets.delete(socket);
      }
    }
  }
}

export function connectionCount(userId?: string): number {
  if (userId) return connections.get(userId)?.size ?? 0;
  let total = 0;
  for (const set of connections.values()) total += set.size;
  return total;
}
