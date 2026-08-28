import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { ApiError } from '../lib/errors.js';

export interface AuthContext {
  userId: string;
  sessionId: string;
  scope: 'full' | 'pin';
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
  interface FastifyInstance {
    /** Route-level guard: `preHandler: app.requireAuth`. */
    requireAuth: (req: FastifyRequest) => Promise<void>;
    /** Stricter guard for money movement and security settings. */
    requireFullAuth: (req: FastifyRequest) => Promise<void>;
  }
}

function bearerFrom(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('auth', undefined);

  app.decorate('requireAuth', async (req: FastifyRequest) => {
    const token = bearerFrom(req);
    if (!token) throw ApiError.unauthorized();

    const claims = verifyAccessToken(token);

    // The access token is short-lived, but a logged-out or revoked session must
    // stop working immediately, so the session row is still checked.
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.id, claims.sid),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      ),
      columns: { id: true, userId: true }
    });

    if (!session || session.userId !== claims.sub) {
      throw ApiError.unauthorized('This session is no longer valid. Please sign in again.');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, claims.sub),
      columns: { id: true, status: true }
    });

    if (!user) throw ApiError.unauthorized();
    if (user.status !== 'active') {
      throw ApiError.forbidden('This account is not active. Contact support.');
    }

    req.auth = { userId: claims.sub, sessionId: claims.sid, scope: claims.scope };
  });

  app.decorate('requireFullAuth', async (req: FastifyRequest) => {
    await app.requireAuth(req);
    if (req.auth?.scope !== 'full') {
      throw ApiError.unauthorized('Confirm your password to continue.', 'unauthorized');
    }
  });
};

export default fp(authPlugin, { name: 'auth' });

/** Convenience accessor for handlers that already ran the guard. */
export function requireUser(req: FastifyRequest): AuthContext {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth;
}
