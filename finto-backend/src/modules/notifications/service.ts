import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { devices, notifications } from '../../db/schema.js';
import { publish } from '../../realtime/hub.js';

export interface NotifyInput {
  kind: string;
  title: string;
  body: string;
  glyph?: string;
  tint?: string;
  data?: Record<string, unknown>;
}

/**
 * Record a notification, push it down every open socket, and hand it to the
 * push provider for devices that are not connected. The socket covers the app
 * being open; push covers everything else.
 */
export async function notify(userId: string, input: NotifyInput) {
  const [created] = await db
    .insert(notifications)
    .values({
      userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      glyph: input.glyph ?? '•',
      tint: input.tint ?? 'stone',
      data: input.data ?? {}
    })
    .returning();

  publish(userId, { type: 'notification.created', data: toPublicNotification(created!) });
  void sendPush(userId, input).catch(() => {
    // A push failure must never fail the payment that triggered it.
  });

  return created!;
}

export function toPublicNotification(row: typeof notifications.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    glyph: row.glyph,
    tint: row.tint,
    data: row.data,
    read: row.readAt != null,
    createdAt: row.createdAt,
    /** "1h", "2d" — the relative stamp the design's rows show. */
    timeAgo: relativeTime(row.createdAt)
  };
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

  return Number(row?.count ?? 0);
}

/**
 * Hand off to APNs / FCM / Web Push. Left as a single seam on purpose: the
 * provider changes, the call sites do not.
 */
async function sendPush(userId: string, input: NotifyInput): Promise<void> {
  const targets = await db.query.devices.findMany({
    where: and(eq(devices.userId, userId), sql`${devices.pushToken} IS NOT NULL`),
    columns: { id: true, platform: true, pushToken: true }
  });

  if (targets.length === 0) return;

  // Wire your provider here, e.g.:
  //   await apns.send(iosTokens, { title: input.title, body: input.body });
  //   await fcm.sendEachForMulticast({ tokens: androidTokens, notification: {...} });
  //   await webpush.sendNotification(subscription, JSON.stringify({...}));
}

export function relativeTime(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}
