import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { notifications } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { toPublicNotification, unreadCount } from './service.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', (req) => app.requireAuth(req));

  app.get('/', async (req) => {
    const { userId } = requireUser(req);
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
        before: z.coerce.date().optional(),
        unreadOnly: z
          .enum(['true', 'false'])
          .default('false')
          .transform((v) => v === 'true')
      })
      .parse(req.query);

    const filters = [eq(notifications.userId, userId)];
    if (query.unreadOnly) filters.push(isNull(notifications.readAt));
    if (query.before) filters.push(lt(notifications.createdAt, query.before));

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...filters))
      .orderBy(desc(notifications.createdAt))
      .limit(query.limit);

    return {
      notifications: rows.map(toPublicNotification),
      unread: await unreadCount(userId)
    };
  });

  app.post('/:id/read', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!updated) throw ApiError.notFound('Notification');
    return { notification: toPublicNotification(updated), unread: await unreadCount(userId) };
  });

  app.post('/read-all', async (req) => {
    const { userId } = requireUser(req);
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });

    return { marked: updated.length, unread: 0 };
  });
};

export default routes;
