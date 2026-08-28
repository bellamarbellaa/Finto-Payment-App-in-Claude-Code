import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { settleExternal } from '../payments/service.js';
import { ApiError } from '../../lib/errors.js';

/**
 * Inbound events from the payment rail and the card processor.
 *
 * These endpoints are unauthenticated in the JWT sense — they are authenticated
 * by an HMAC over the raw request body, which is why app.ts keeps the raw body
 * for this prefix.
 */
const routes: FastifyPluginAsync = async (app) => {
  const verifySignature = (raw: string, signature: string | undefined, secret: string): void => {
    if (!signature) throw ApiError.unauthorized('Missing signature');

    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw ApiError.unauthorized('Invalid signature');
    }
  };

  app.post('/payment-rail', async (req) => {
    const secret = process.env.PAYMENT_RAIL_WEBHOOK_SECRET;
    if (!secret) throw ApiError.internal('Webhook secret is not configured');

    verifySignature(
      (req as { rawBody?: string }).rawBody ?? JSON.stringify(req.body),
      req.headers['x-finto-signature'] as string | undefined,
      secret
    );

    const event = z
      .object({
        type: z.enum(['transfer.settled', 'transfer.failed']),
        reference: z.string().min(4).max(32),
        reason: z.string().max(200).optional()
      })
      .parse(req.body);

    const outcome = event.type === 'transfer.settled' ? 'completed' : 'failed';
    const result = await settleExternal(event.reference, outcome, event.reason);

    return { received: true, ...result };
  });
};

export default routes;
