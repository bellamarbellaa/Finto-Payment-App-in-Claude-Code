import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  accounts,
  contacts,
  paymentRequests,
  transactions,
  users
} from '../../db/schema.js';
import { post } from '../../ledger/ledger.js';
import { ApiError } from '../../lib/errors.js';
import { money, parseAmount } from '../../lib/money.js';
import { randomToken } from '../../lib/crypto.js';
import { getRate } from '../fx/service.js';
import { notify } from '../notifications/service.js';
import { publish } from '../../realtime/hub.js';
import { toPublicTransaction } from '../transactions/serializer.js';
import { env } from '../../env.js';

export interface SendInput {
  fromAccountId?: string;
  contactId?: string;
  /** Pay a Finto handle directly, without saving a contact first. */
  handle?: string;
  amount: string;
  currency?: string;
  note?: string;
}

/**
 * Send money.
 *
 * Internal (both sides are Finto users): one balanced posting moves the funds
 * and both sides settle instantly. External: the payer is debited, a pending
 * transaction is created, and settlement is confirmed later by the payment
 * rail's webhook.
 */
export async function send(userId: string, input: SendInput) {
  const payer = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!payer) throw ApiError.notFound('User');

  const fromAccount = await pickSourceAccount(userId, input.fromAccountId, input.currency);
  if (!fromAccount) throw ApiError.notFound('Account');
  if (fromAccount.status !== 'active') {
    throw ApiError.unprocessable('account_frozen', 'This account is not active.');
  }

  const currency = (input.currency ?? fromAccount.currency).toUpperCase();
  if (currency !== fromAccount.currency) {
    throw ApiError.badRequest(
      `That account holds ${fromAccount.currency}. Convert first, or pick another account.`
    );
  }

  let amountMinor: bigint;
  try {
    amountMinor = parseAmount(input.amount, currency);
  } catch (err) {
    throw ApiError.badRequest((err as Error).message);
  }

  if (amountMinor <= 0n) throw ApiError.badRequest('Enter an amount above zero');

  const recipient = await resolveRecipient(userId, input);

  return db.transaction(async (tx) => {
    // Re-read under the row lock inside post(); this is only for the friendly
    // pre-flight message the design shows under the keypad.
    if (fromAccount.availableMinor < amountMinor) {
      throw ApiError.unprocessable('insufficient_funds', 'That is above your available balance.', {
        available: money(fromAccount.availableMinor, currency)
      });
    }

    if (recipient.kind === 'internal') {
      const payeeAccount = await findOrOpenAccount(tx, recipient.userId, currency);

      const result = await post(tx, {
        lines: [
          { accountId: fromAccount.id, amountMinor: -amountMinor, currency },
          { accountId: payeeAccount.id, amountMinor, currency }
        ],
        transaction: {
          userId,
          accountId: fromAccount.id,
          type: 'payment_out',
          status: 'completed',
          amountMinor: -amountMinor,
          currency,
          counterpartyName: recipient.name,
          counterpartyHandle: recipient.handle,
          category: 'Transfer',
          tint: recipient.tint,
          note: input.note ?? null,
          metadata: { rail: 'internal', payeeUserId: recipient.userId }
        }
      });

      // The receiving side gets its own transaction row, sharing the reference
      // so both users quote the same number to support.
      const [incoming] = await tx
        .insert(transactions)
        .values({
          userId: recipient.userId,
          accountId: payeeAccount.id,
          type: 'payment_in',
          status: 'completed',
          amountMinor,
          currency,
          reference: result.reference + '-R',
          counterpartyName: payer.fullName,
          counterpartyHandle: payer.handle,
          category: 'Transfer',
          tint: payer.tint,
          note: input.note ?? null,
          settledAt: new Date(),
          counterTransactionId: result.transactionId,
          metadata: { rail: 'internal', payerUserId: userId }
        })
        .returning();

      await tx
        .update(transactions)
        .set({ counterTransactionId: incoming!.id })
        .where(eq(transactions.id, result.transactionId));

      const outgoing = await tx.query.transactions.findFirst({
        where: eq(transactions.id, result.transactionId)
      });

      // Tell the recipient — on every device they have open.
      await notify(recipient.userId, {
        kind: 'payment_received',
        title: `${payer.displayName} sent you money`,
        body: `${money(amountMinor, currency).formatted} landed in your ${payeeAccount.name}.`,
        glyph: '↓',
        tint: 'forest',
        data: { transactionId: incoming!.id }
      });

      publish(recipient.userId, {
        type: 'transaction.created',
        data: toPublicTransaction(incoming!)
      });
      publish(recipient.userId, {
        type: 'account.balance_changed',
        data: { accountId: payeeAccount.id }
      });

      await touchContact(tx, userId, recipient.contactId);

      return {
        transaction: toPublicTransaction(outgoing!),
        balanceAfter: money(result.balances.get(fromAccount.id) ?? 0n, currency)
      };
    }

    /*
     * External rail. The money leaves the user's balance now and sits in the
     * settlement account until the rail confirms — so the balance the user sees
     * is always what they can actually spend.
     */
    const settlement = await settlementAccount(tx, currency);

    const result = await post(tx, {
      lines: [
        { accountId: fromAccount.id, amountMinor: -amountMinor, currency },
        { accountId: settlement.id, amountMinor, currency }
      ],
      transaction: {
        userId,
        accountId: fromAccount.id,
        type: 'payment_out',
        status: 'pending',
        amountMinor: -amountMinor,
        currency,
        counterpartyName: recipient.name,
        counterpartyHandle: recipient.handle,
        category: 'Transfer',
        tint: recipient.tint,
        note: input.note ?? null,
        metadata: { rail: 'external' }
      }
    });

    await touchContact(tx, userId, recipient.contactId);

    const outgoing = await tx.query.transactions.findFirst({
      where: eq(transactions.id, result.transactionId)
    });

    return {
      transaction: toPublicTransaction(outgoing!),
      balanceAfter: money(result.balances.get(fromAccount.id) ?? 0n, currency)
    };
  });
}

/**
 * Choose which balance the money leaves from.
 *
 * An explicit account always wins. Otherwise, when the payment has a currency —
 * paying a USD request, say — prefer the account that already holds it, and
 * only fall back to the primary account. Someone whose primary balance is EUR
 * should still be able to settle a dollar request out of the dollars they hold.
 */
async function pickSourceAccount(userId: string, accountId?: string, currency?: string) {
  if (accountId) {
    return db.query.accounts.findFirst({
      where: and(eq(accounts.id, accountId), eq(accounts.userId, userId))
    });
  }

  if (currency) {
    const matching = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.currency, currency.toUpperCase()),
        eq(accounts.status, 'active')
      )
    });
    if (matching) return matching;
  }

  return db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.isPrimary, true))
  });
}

type Recipient =
  | { kind: 'internal'; userId: string; name: string; handle: string; tint: string; contactId?: string }
  | { kind: 'external'; name: string; handle: string; tint: string; contactId?: string };

async function resolveRecipient(userId: string, input: SendInput): Promise<Recipient> {
  if (input.contactId) {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, input.contactId), eq(contacts.userId, userId))
    });
    if (!contact) throw ApiError.notFound('Contact');

    if (contact.contactUserId) {
      return {
        kind: 'internal',
        userId: contact.contactUserId,
        name: contact.name,
        handle: contact.handle,
        tint: contact.tint,
        contactId: contact.id
      };
    }
    return {
      kind: 'external',
      name: contact.name,
      handle: contact.handle,
      tint: contact.tint,
      contactId: contact.id
    };
  }

  if (input.handle) {
    const handle = input.handle.trim().toLowerCase();
    const target = await db.query.users.findFirst({
      where: sql`lower(${users.handle}) = ${handle} OR lower(${users.email}) = ${handle}`
    });

    if (!target) throw ApiError.notFound('That Finto handle');
    if (target.id === userId) throw ApiError.badRequest('You cannot send money to yourself');

    return {
      kind: 'internal',
      userId: target.id,
      name: target.fullName,
      handle: target.handle,
      tint: target.tint
    };
  }

  throw ApiError.badRequest('Choose who you are paying');
}

async function findOrOpenAccount(tx: Parameters<typeof post>[0], userId: string, currency: string) {
  const existing = await tx.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.currency, currency))
  });
  if (existing) return existing;

  // The recipient does not hold this currency yet — open the balance for them
  // rather than bouncing the payment.
  const [created] = await tx
    .insert(accounts)
    .values({
      userId,
      currency,
      name: `${currency} balance`,
      kind: 'balance',
      ibanMasked: `XX** **** ${Math.floor(1000 + Math.random() * 9000)}`
    })
    .returning();

  return created!;
}

/**
 * The house account each currency's external payments pass through. Its
 * balance is the float owed to payment rails; it is deliberately allowed to be
 * a normal account so every movement stays double-entry.
 */
const SETTLEMENT_HANDLE = '@finto.settlement';

async function settlementAccount(tx: Parameters<typeof post>[0], currency: string) {
  const house = await tx.query.users.findFirst({
    where: sql`lower(${users.handle}) = ${SETTLEMENT_HANDLE}`
  });

  if (!house) {
    throw ApiError.internal('Settlement account is not configured — run `npm run db:seed`');
  }

  return findOrOpenAccount(tx, house.id, currency);
}

async function touchContact(
  tx: Parameters<typeof post>[0],
  userId: string,
  contactId?: string
): Promise<void> {
  if (!contactId) return;
  await tx
    .update(contacts)
    .set({ lastPaidAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));
}

/* ------------------------------------------------------- payment requests */

export interface RequestInput {
  amount: string;
  currency?: string;
  accountId?: string;
  contactId?: string;
  note?: string;
  expiresInHours?: number;
}

export async function createRequest(userId: string, input: RequestInput) {
  const account = input.accountId
    ? await db.query.accounts.findFirst({
        where: and(eq(accounts.id, input.accountId), eq(accounts.userId, userId))
      })
    : await db.query.accounts.findFirst({
        where: and(eq(accounts.userId, userId), eq(accounts.isPrimary, true))
      });

  if (!account) throw ApiError.notFound('Account');

  const currency = (input.currency ?? account.currency).toUpperCase();
  const amountMinor = parseAmount(input.amount, currency);
  if (amountMinor <= 0n) throw ApiError.badRequest('Enter an amount above zero');

  const linkToken = randomToken(24);
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 3_600_000);

  const [created] = await db
    .insert(paymentRequests)
    .values({
      requesterId: userId,
      accountId: account.id,
      payerContactId: input.contactId ?? null,
      amountMinor,
      currency,
      note: input.note ?? null,
      linkToken,
      expiresAt
    })
    .returning();

  // Notify the payer in-app when they are already a Finto user.
  if (input.contactId) {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, input.contactId), eq(contacts.userId, userId))
    });

    if (contact?.contactUserId) {
      const requester = await db.query.users.findFirst({ where: eq(users.id, userId) });
      await db
        .update(paymentRequests)
        .set({ payerUserId: contact.contactUserId })
        .where(eq(paymentRequests.id, created!.id));

      await notify(contact.contactUserId, {
        kind: 'payment_requested',
        title: `${requester?.displayName ?? 'Someone'} requested money`,
        body: `${money(amountMinor, currency).formatted}${input.note ? ` — ${input.note}` : ''}`,
        glyph: '↑',
        tint: 'sand',
        data: { paymentRequestId: created!.id }
      });
    }
  }

  return toPublicRequest(created!);
}

/** Resolve the QR payload the Scan screen reads. */
export async function resolveRequestByToken(linkToken: string) {
  const request = await db.query.paymentRequests.findFirst({
    where: eq(paymentRequests.linkToken, linkToken)
  });

  if (!request) throw ApiError.notFound('Payment request');

  if (request.status === 'pending' && request.expiresAt <= new Date()) {
    await db
      .update(paymentRequests)
      .set({ status: 'expired' })
      .where(eq(paymentRequests.id, request.id));
    throw ApiError.unprocessable('request_expired', 'This payment request has expired.');
  }

  const requester = await db.query.users.findFirst({ where: eq(users.id, request.requesterId) });

  return {
    ...toPublicRequest(request),
    requester: requester
      ? { displayName: requester.displayName, fullName: requester.fullName, handle: requester.handle, tint: requester.tint }
      : null
  };
}

/** Pay a request found by QR or link. */
export async function payRequest(userId: string, linkToken: string, fromAccountId?: string) {
  const request = await db.query.paymentRequests.findFirst({
    where: eq(paymentRequests.linkToken, linkToken)
  });

  if (!request) throw ApiError.notFound('Payment request');
  if (request.status !== 'pending') {
    throw ApiError.conflict(`This request is already ${request.status}.`);
  }
  if (request.expiresAt <= new Date()) {
    throw ApiError.unprocessable('request_expired', 'This payment request has expired.');
  }
  if (request.requesterId === userId) {
    throw ApiError.badRequest('You cannot pay your own request');
  }

  const requester = await db.query.users.findFirst({ where: eq(users.id, request.requesterId) });
  if (!requester) throw ApiError.notFound('Requester');

  const result = await send(userId, {
    fromAccountId,
    handle: requester.handle,
    amount: money(request.amountMinor, request.currency).amount,
    currency: request.currency,
    note: request.note ?? undefined
  });

  await db
    .update(paymentRequests)
    .set({ status: 'paid', payerUserId: userId, paidTransactionId: result.transaction.id })
    .where(and(eq(paymentRequests.id, request.id), eq(paymentRequests.status, 'pending')));

  publish(request.requesterId, {
    type: 'payment_request.updated',
    data: { id: request.id, status: 'paid' }
  });

  return result;
}

export function toPublicRequest(request: typeof paymentRequests.$inferSelect) {
  return {
    id: request.id,
    amount: money(request.amountMinor, request.currency),
    note: request.note,
    status: request.status,
    linkToken: request.linkToken,
    /** What the QR code encodes: a universal link that also opens the app. */
    shareUrl: `${env.PUBLIC_BASE_URL}/pay/${request.linkToken}`,
    deepLink: `${env.APP_LINK_SCHEME}://pay/${request.linkToken}`,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt
  };
}

/** Called by the payment rail's webhook once an external transfer settles. */
export async function settleExternal(
  reference: string,
  outcome: 'completed' | 'failed',
  failureReason?: string
) {
  return db.transaction(async (tx) => {
    const target = await tx.query.transactions.findFirst({
      where: and(eq(transactions.reference, reference), eq(transactions.status, 'pending'))
    });

    if (!target) throw ApiError.notFound('Pending transaction');

    if (outcome === 'completed') {
      await tx
        .update(transactions)
        .set({ status: 'completed', settledAt: new Date() })
        .where(eq(transactions.id, target.id));
    } else {
      // Return the money to the payer: reverse the original posting.
      const settlement = await settlementAccount(tx, target.currency);
      const amount = -target.amountMinor; // original was negative

      await post(tx, {
        lines: [
          { accountId: settlement.id, amountMinor: -amount, currency: target.currency },
          { accountId: target.accountId, amountMinor: amount, currency: target.currency }
        ],
        allowNegative: true,
        transaction: {
          userId: target.userId,
          accountId: target.accountId,
          type: 'payment_in',
          status: 'completed',
          amountMinor: amount,
          currency: target.currency,
          counterpartyName: target.counterpartyName,
          counterpartyHandle: target.counterpartyHandle,
          category: 'Refund',
          tint: target.tint,
          note: `Returned: ${failureReason ?? 'the payment could not be completed'}`,
          metadata: { refundOf: target.id }
        }
      });

      await tx
        .update(transactions)
        .set({ status: 'failed', failureReason: failureReason ?? 'Payment could not be completed' })
        .where(eq(transactions.id, target.id));

      await notify(target.userId, {
        kind: 'payment_failed',
        title: 'A payment did not go through',
        body: `${money(-target.amountMinor, target.currency).formatted} to ${target.counterpartyName} was returned to your balance.`,
        glyph: '!',
        tint: 'sand',
        data: { transactionId: target.id }
      });
    }

    publish(target.userId, {
      type: 'transaction.updated',
      data: { id: target.id, status: outcome }
    });

    return { id: target.id, status: outcome };
  });
}
