import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

/**
 * Vercel entrypoint. A serverless function is stateless per invocation, but
 * warm instances are reused between requests, so the built app (and its DB
 * pool) is created once and cached across those — not rebuilt per request.
 *
 * `/v1/realtime` (the WebSocket route) cannot work here: a function
 * invocation ends when it returns, so there is nothing to hold a socket
 * open. Clients pointed at this deployment use the polling fallback
 * (`GET /v1/realtime/poll`) instead — see packages/api-client.
 */
let appPromise: Promise<FastifyInstance> | null = null;

function getApp(): Promise<FastifyInstance> {
  appPromise ??= buildApp().then(async (app) => {
    await app.ready();
    return app;
  });
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
