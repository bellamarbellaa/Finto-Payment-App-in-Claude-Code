import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { idempotencyKeys } from '../db/schema.js';
import { sha256 } from './crypto.js';
import { ApiError } from './errors.js';
import { jsonSafe } from './serialize.js';

/**
 * Wrap a money-moving handler so a retried request never charges twice.
 *
 * Flow: claim the key with state 'in_flight'. If the insert conflicts, either
 * the original response is already stored (replay it) or the first attempt is
 * still running (tell the client to wait). On success the response is recorded
 * against the key; on failure the claim is released so the client can retry.
 *
 * Mobile clients on a flaky connection retry constantly. This is the normal
 * path, not an edge case.
 */
export async function withIdempotency<T>(
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  endpoint: string,
  handler: () => Promise<T>
): Promise<T | unknown> {
  const key = req.headers['idempotency-key'];

  if (typeof key !== 'string' || key.length === 0) {
    // Not required, but strongly recommended — the clients always send one.
    return handler();
  }

  if (key.length > 120) {
    throw ApiError.badRequest('Idempotency-Key must be 120 characters or fewer');
  }

  const requestHash = sha256(JSON.stringify(req.body ?? {}));

  const claimed = await db
    .insert(idempotencyKeys)
    .values({ key, userId, endpoint, requestHash, state: 'in_flight' })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (claimed.length === 0) {
    const existing = await db.query.idempotencyKeys.findFirst({
      where: and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key))
    });

    if (!existing) throw ApiError.internal('Idempotency check failed, please retry');

    if (existing.requestHash !== requestHash) {
      throw ApiError.conflict(
        'This Idempotency-Key was already used with a different request body.',
        'idempotency_conflict'
      );
    }

    if (existing.state === 'in_flight') {
      reply.header('retry-after', '1');
      throw ApiError.conflict(
        'An identical request is still being processed.',
        'idempotency_conflict'
      );
    }

    reply.header('idempotent-replay', 'true');
    reply.code(existing.statusCode ?? 200);
    return existing.responseBody;
  }

  try {
    const result = await handler();
    await db
      .update(idempotencyKeys)
      .set({
        state: 'completed',
        statusCode: reply.statusCode || 200,
        responseBody: jsonSafe(result) as never
      })
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
    return result;
  } catch (err) {
    // Release the claim so the client can legitimately retry the same key.
    await db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
    throw err;
  }
}
