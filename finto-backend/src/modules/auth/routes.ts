import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as auth from './service.js';
import { REFRESH_COOKIE, refreshCookieOptions } from '../../lib/tokens.js';
import { ApiError } from '../../lib/errors.js';
import { requireUser } from '../../plugins/auth.js';
import { toPublicUser } from '../users/serializer.js';

const deviceSchema = z
  .object({
    name: z.string().min(1).max(80),
    platform: z.enum(['ios', 'android', 'web']),
    pushToken: z.string().max(400).optional()
  })
  .optional();

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10, 'Use at least 10 characters')
    .max(200)
    // Length beats character-class rules; this only blocks the obvious ones.
    .refine((p) => !/^(password|12345|qwerty)/i.test(p), 'Choose a less common password'),
  fullName: z.string().min(2).max(120),
  handle: z.string().min(2).max(40).optional(),
  phone: z.string().max(32).optional(),
  baseCurrency: z.string().length(3).optional(),
  device: deviceSchema
});

const loginSchema = z.object({
  /** Email, phone or @handle — the design's login screen accepts either. */
  identifier: z.string().min(3).max(320),
  password: z.string().min(1).max(200),
  device: deviceSchema
});

const routes: FastifyPluginAsync = async (app) => {
  const clientInfo = (req: Parameters<typeof requireUser>[0]) => ({
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  /** Tighter limit on the credential endpoints than on the rest of the API. */
  const authLimit = {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } }
  };

  app.post('/register', authLimit, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const { user, tokens } = await auth.register(body, { ...clientInfo(req), device: body.device });

    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
    reply.code(201);
    return { user: toPublicUser(user), ...tokens };
  });

  app.post('/login', authLimit, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const { user, tokens } = await auth.login(body.identifier, body.password, {
      ...clientInfo(req),
      device: body.device
    });

    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
    return { user: toPublicUser(user), ...tokens };
  });

  /**
   * Mobile sends the token in the body; desktop web relies on the httpOnly
   * cookie and sends nothing. Both land here.
   */
  app.post('/refresh', { config: { rateLimit: { max: 60, timeWindow: '5 minutes' } } }, async (req, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {});
    const token = body.refreshToken ?? req.cookies[REFRESH_COOKIE];

    if (!token) throw ApiError.unauthorized('No refresh token supplied');

    const tokens = await auth.refresh(token, clientInfo(req));
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
    return tokens;
  });

  app.post('/logout', { preHandler: (req) => app.requireAuth(req) }, async (req, reply) => {
    const { sessionId } = requireUser(req);
    await auth.logout(sessionId);
    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    return { ok: true };
  });

  app.post('/pin/unlock', authLimit, async (req) => {
    const body = z
      .object({ refreshToken: z.string().optional(), pin: z.string().min(4).max(8) })
      .parse(req.body);

    const token = body.refreshToken ?? req.cookies[REFRESH_COOKIE];
    if (!token) throw ApiError.unauthorized('No refresh token supplied');

    return auth.unlockWithPin(token, body.pin, clientInfo(req));
  });

  app.put('/pin', { preHandler: (req) => app.requireFullAuth(req) }, async (req) => {
    const body = z.object({ pin: z.string() }).parse(req.body);
    await auth.setPin(requireUser(req).userId, body.pin);
    return { ok: true };
  });

  app.get('/sessions', { preHandler: (req) => app.requireAuth(req) }, async (req) => {
    const { userId, sessionId } = requireUser(req);
    const rows = await auth.listSessions(userId);
    return {
      sessions: rows.map((s) => ({ ...s, current: s.id === sessionId }))
    };
  });

  /** "Log out of all devices" on the Security screen. */
  app.post('/sessions/revoke-all', { preHandler: (req) => app.requireFullAuth(req) }, async (req) => {
    const { userId, sessionId } = requireUser(req);
    const keepCurrent = z
      .object({ keepCurrent: z.boolean().default(true) })
      .parse(req.body ?? {}).keepCurrent;

    const revoked = await auth.revokeAllSessions(userId, keepCurrent ? sessionId : undefined);
    return { revoked };
  });
};

export default routes;
