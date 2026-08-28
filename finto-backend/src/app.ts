import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { ZodError } from 'zod';
import { env } from './env.js';
import { ApiError } from './lib/errors.js';
import { bigintReplacer } from './lib/serialize.js';
import authPlugin from './plugins/auth.js';
import realtimePlugin from './plugins/realtime.js';

import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/users/routes.js';
import accountRoutes from './modules/accounts/routes.js';
import transactionRoutes from './modules/transactions/routes.js';
import paymentRoutes from './modules/payments/routes.js';
import contactRoutes from './modules/contacts/routes.js';
import cardRoutes from './modules/cards/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import deviceRoutes from './modules/devices/routes.js';
import supportRoutes from './modules/support/routes.js';
import fxRoutes from './modules/fx/routes.js';
import webhookRoutes from './modules/webhooks/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.isTest
      ? false
      : {
          level: env.isProd ? 'info' : 'debug',
          transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
          // Never let a password, token or card detail reach the logs.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.pin',
              'req.body.refreshToken',
              'res.headers["set-cookie"]'
            ],
            censor: '[redacted]'
          }
        },
    trustProxy: true,
    bodyLimit: 1_048_576, // 1 MB — no endpoint here takes a file
    genReqId: () => crypto.randomUUID()
  });

  // BigInt has no JSON representation; emit balances as decimal strings.
  app.setSerializerCompiler(() => (data) => JSON.stringify(data, bigintReplacer));

  await app.register(helmet, {
    // The API serves JSON to native and browser clients, not HTML.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  });

  /**
   * Desktop web sends an Origin and needs credentials for the refresh cookie.
   * Native mobile sends no Origin at all — allowing those through is what lets
   * one API serve both without a second gateway.
   */
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key', 'x-finto-device'],
    exposedHeaders: ['idempotent-replay', 'retry-after']
  });

  await app.register(cookie, { secret: env.COOKIE_SECRET });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Rate limit per authenticated user where possible, so a shared office IP
    // does not throttle everyone at once.
    keyGenerator: (req) => req.auth?.userId ?? req.ip,
    errorResponseBuilder: () => ({
      error: { code: 'rate_limited', message: 'Too many requests. Please slow down.' }
    })
  });

  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });
  await app.register(authPlugin);

  /* --------------------------------------------------- error handling */

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: 'Some of those details are not right.',
          details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
        }
      });
    }

    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details }
      });
    }

    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({
        error: { code: 'rate_limited', message: 'Too many requests. Please slow down.' }
      });
    }

    // Anything unrecognised is logged in full and reported blandly. Stack traces
    // and driver messages have no business reaching a client.
    req.log.error({ err: error, reqId: req.id }, 'unhandled error');

    return reply.code(500).send({
      error: {
        code: 'internal_error',
        message: 'Something went wrong on our side. Please try again.',
        requestId: req.id
      }
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: 'not_found', message: `No route for ${req.method} ${req.url}` }
    });
  });

  /* --------------------------------------------------------- routes */

  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    version: '1.0.0',
    time: new Date().toISOString()
  }));

  await app.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(userRoutes, { prefix: '/users' });
      await v1.register(accountRoutes, { prefix: '/accounts' });
      await v1.register(transactionRoutes, { prefix: '/transactions' });
      await v1.register(paymentRoutes, { prefix: '/payments' });
      await v1.register(contactRoutes, { prefix: '/contacts' });
      await v1.register(cardRoutes, { prefix: '/cards' });
      await v1.register(notificationRoutes, { prefix: '/notifications' });
      await v1.register(deviceRoutes, { prefix: '/devices' });
      await v1.register(supportRoutes, { prefix: '/support' });
      await v1.register(fxRoutes, { prefix: '/fx' });
      await v1.register(webhookRoutes, { prefix: '/webhooks' });
      await v1.register(realtimePlugin);
    },
    { prefix: '/v1' }
  );

  return app;
}
