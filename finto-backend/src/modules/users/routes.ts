import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { toPublicUser } from './serializer.js';
import { hashSecret, verifySecret } from '../../lib/crypto.js';
import { revokeAllSessions } from '../auth/service.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', (req) => app.requireAuth(req));

  /** Powers the Profile screen and the "Welcome back, Sofia" header. */
  app.get('/me', async (req) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, requireUser(req).userId) });
    if (!user) throw ApiError.notFound('User');
    return { user: toPublicUser(user) };
  });

  app.patch('/me', async (req) => {
    const body = z
      .object({
        fullName: z.string().min(2).max(120).optional(),
        displayName: z.string().min(1).max(60).optional(),
        phone: z.string().max(32).nullable().optional(),
        tint: z.enum(['lime', 'forest', 'sand', 'sky', 'stone']).optional()
      })
      .parse(req.body);

    const [updated] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, requireUser(req).userId))
      .returning();

    if (!updated) throw ApiError.notFound('User');
    return { user: toPublicUser(updated) };
  });

  /** The Security screen's toggles: Face ID and "confirm every payment". */
  app.patch('/me/security', { preHandler: (req) => app.requireFullAuth(req) }, async (req) => {
    const body = z
      .object({
        biometricEnabled: z.boolean().optional(),
        confirmPayments: z.boolean().optional()
      })
      .parse(req.body);

    const [updated] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, requireUser(req).userId))
      .returning();

    if (!updated) throw ApiError.notFound('User');
    return { user: toPublicUser(updated) };
  });

  app.put('/me/password', { preHandler: (req) => app.requireFullAuth(req) }, async (req) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(10).max(200)
      })
      .parse(req.body);

    const { userId, sessionId } = requireUser(req);
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw ApiError.notFound('User');

    if (!(await verifySecret(body.currentPassword, user.passwordHash))) {
      throw ApiError.unauthorized('That current password is not right.', 'invalid_credentials');
    }

    await db
      .update(users)
      .set({ passwordHash: await hashSecret(body.newPassword), updatedAt: new Date() })
      .where(eq(users.id, userId));

    // A password change signs out every other device — that is the point of it.
    const revoked = await revokeAllSessions(userId, sessionId);
    return { ok: true, otherSessionsRevoked: revoked };
  });
};

export default routes;
