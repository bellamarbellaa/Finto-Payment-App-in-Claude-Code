import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { devices } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', (req) => app.requireAuth(req));

  app.get('/', async (req) => {
    const { userId } = requireUser(req);
    const rows = await db.query.devices.findMany({
      where: eq(devices.userId, userId),
      columns: { id: true, name: true, platform: true, lastSeenAt: true, createdAt: true },
      orderBy: [desc(devices.lastSeenAt)]
    });
    return { devices: rows };
  });

  /** Register or refresh a push token. Called on every app launch. */
  app.put('/push-token', async (req) => {
    const { userId } = requireUser(req);
    const body = z
      .object({
        deviceId: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        platform: z.enum(['ios', 'android', 'web']),
        pushToken: z.string().min(8).max(400)
      })
      .parse(req.body);

    if (body.deviceId) {
      const [updated] = await db
        .update(devices)
        .set({ pushToken: body.pushToken, name: body.name, lastSeenAt: new Date(), lastIp: req.ip })
        .where(and(eq(devices.id, body.deviceId), eq(devices.userId, userId)))
        .returning({ id: devices.id });

      if (updated) return { device: updated };
    }

    const [created] = await db
      .insert(devices)
      .values({
        userId,
        name: body.name,
        platform: body.platform,
        pushToken: body.pushToken,
        lastIp: req.ip
      })
      .returning({ id: devices.id });

    return { device: created };
  });

  app.delete('/:id', async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const [deleted] = await db
      .delete(devices)
      .where(and(eq(devices.id, id), eq(devices.userId, userId)))
      .returning({ id: devices.id });

    if (!deleted) throw ApiError.notFound('Device');
    reply.code(204);
  });
};

export default routes;
