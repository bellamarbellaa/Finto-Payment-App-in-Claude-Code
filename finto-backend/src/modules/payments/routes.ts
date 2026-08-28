import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, paymentRequests, users } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { withIdempotency } from '../../lib/idempotency.js';
import { money, parseAmount } from '../../lib/money.js';
import * as payments from './service.js';
import { publish } from '../../realtime/hub.js';
import { audit } from '../auth/service.js';
import { verifySecret } from '../../lib/crypto.js';

const amountField = z.string().min(1).max(24);

const sendSchema = z
  .object({
    fromAccountId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    handle: z.string().min(2).max(80).optional(),
    amount: amountField,
    currency: z.string().length(3).optional(),
    note: z.string().max(140).optional(),
    /** Required when the user has "confirm every payment" switched on. */
    password: z.string().max(200).optional()
  })
  .refine((v) => v.contactId || v.handle, {
    message: 'Choose a contact or a Finto handle to pay'
  });

const routes: FastifyPluginAsync = async (app) => {
  // Money movement always needs a full password-backed session, never a PIN one.
  app.addHook('preHandler', (req) => app.requireFullAuth(req));

  /**
   * Quote before paying: what the recipient gets, what it costs, whether the
   * balance covers it. Cheap, side-effect free, and lets the keypad screen show
   * "Above your available balance" before the user commits.
   */
  app.post('/quote', async (req) => {
    const { userId } = requireUser(req);
    const body = z
      .object({
        fromAccountId: z.string().uuid().optional(),
        amount: amountField,
        currency: z.string().length(3).optional()
      })
      .parse(req.body);

    const account = body.fromAccountId
      ? await db.query.accounts.findFirst({
          where: and(eq(accounts.id, body.fromAccountId), eq(accounts.userId, userId))
        })
      : await db.query.accounts.findFirst({
          where: and(eq(accounts.userId, userId), eq(accounts.isPrimary, true))
        });

    if (!account) throw ApiError.notFound('Account');

    const currency = (body.currency ?? account.currency).toUpperCase();

    let amountMinor: bigint;
    try {
      amountMinor = parseAmount(body.amount, currency);
    } catch (err) {
      throw ApiError.badRequest((err as Error).message);
    }

    const sufficient = amountMinor > 0n && account.availableMinor >= amountMinor;

    return {
      amount: money(amountMinor, currency),
      available: money(account.availableMinor, currency),
      remainingAfter: money(account.availableMinor - amountMinor, currency),
      fee: money(0n, currency),
      sufficient,
      // The exact copy the design shows in the red chip.
      warning: sufficient ? null : 'Above your available balance'
    };
  });

  app.post('/send', async (req, reply) => {
    const { userId } = requireUser(req);
    const body = sendSchema.parse(req.body);

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw ApiError.notFound('User');

    if (user.confirmPayments) {
      if (!body.password) {
        throw ApiError.unauthorized('Confirm this payment with your password.');
      }
      if (!(await verifySecret(body.password, user.passwordHash))) {
        throw ApiError.unauthorized('That password is not right.', 'invalid_credentials');
      }
    }

    return withIdempotency(req, reply, userId, 'payments.send', async () => {
      const result = await payments.send(userId, body);

      await audit(userId, 'payment.sent', { ip: req.ip, userAgent: req.headers['user-agent'] }, {
        transactionId: result.transaction.id,
        reference: result.transaction.reference
      });

      publish(userId, { type: 'transaction.created', data: result.transaction });
      publish(userId, { type: 'account.balance_changed', data: { balance: result.balanceAfter } });

      reply.code(201);
      return result;
    });
  });

  /* ---------------------------------------------------------- requests */

  app.post('/requests', async (req, reply) => {
    const { userId } = requireUser(req);
    const body = z
      .object({
        amount: amountField,
        currency: z.string().length(3).optional(),
        accountId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
        note: z.string().max(140).optional(),
        expiresInHours: z.number().int().min(1).max(720).optional()
      })
      .parse(req.body);

    const request = await payments.createRequest(userId, body);
    reply.code(201);
    return { request };
  });

  app.get('/requests', async (req) => {
    const { userId } = requireUser(req);
    const rows = await db.query.paymentRequests.findMany({
      where: eq(paymentRequests.requesterId, userId),
      orderBy: [desc(paymentRequests.createdAt)],
      limit: 50
    });
    return { requests: rows.map(payments.toPublicRequest) };
  });

  app.delete('/requests/:id', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const [updated] = await db
      .update(paymentRequests)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(paymentRequests.id, id),
          eq(paymentRequests.requesterId, userId),
          eq(paymentRequests.status, 'pending')
        )
      )
      .returning();

    if (!updated) throw ApiError.notFound('Pending payment request');
    return { request: payments.toPublicRequest(updated) };
  });

  /**
   * Scan screen: resolve whatever the camera decoded. Accepts the raw QR text,
   * a finto:// deep link, or a share URL — the client should not have to parse.
   */
  app.post('/scan', async (req) => {
    const body = z.object({ payload: z.string().min(1).max(500) }).parse(req.body);
    const token = extractToken(body.payload);
    if (!token) throw ApiError.badRequest('That code is not a Finto payment code');
    return { request: await payments.resolveRequestByToken(token) };
  });

  app.get('/requests/by-token/:token', async (req) => {
    const { token } = z.object({ token: z.string().min(8).max(64) }).parse(req.params);
    return { request: await payments.resolveRequestByToken(token) };
  });

  app.post('/requests/by-token/:token/pay', async (req, reply) => {
    const { userId } = requireUser(req);
    const { token } = z.object({ token: z.string().min(8).max(64) }).parse(req.params);
    const body = z.object({ fromAccountId: z.string().uuid().optional() }).parse(req.body ?? {});

    return withIdempotency(req, reply, userId, 'payments.payRequest', async () => {
      const result = await payments.payRequest(userId, token, body.fromAccountId);
      publish(userId, { type: 'transaction.created', data: result.transaction });
      reply.code(201);
      return result;
    });
  });
};

/** Pull the request token out of a QR payload in any of its shapes. */
function extractToken(payload: string): string | null {
  const trimmed = payload.trim();
  const match = trimmed.match(/(?:\/pay\/|pay\/)([A-Za-z0-9_-]{8,64})/);
  if (match?.[1]) return match[1];
  if (/^[A-Za-z0-9_-]{8,64}$/.test(trimmed)) return trimmed;
  return null;
}

export default routes;
