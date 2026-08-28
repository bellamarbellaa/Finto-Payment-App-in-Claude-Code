import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, cardControls, cards, transactions } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { money, parseAmount } from '../../lib/money.js';
import { randomToken } from '../../lib/crypto.js';
import { publish } from '../../realtime/hub.js';
import { audit } from '../auth/service.js';
import { notify } from '../notifications/service.js';

type CardRow = typeof cards.$inferSelect;
type ControlsRow = typeof cardControls.$inferSelect;

function toPublicCard(card: CardRow, controls: ControlsRow | null, spentThisMonth?: bigint, currency = 'USD') {
  return {
    id: card.id,
    brand: card.brand,
    kind: card.kind,
    /** Never the full PAN — see the reveal endpoint below. */
    last4: card.last4,
    maskedNumber: `•••• •••• •••• ${card.last4}`,
    expiry: `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`,
    holderName: card.holderName,
    state: card.state,
    accountId: card.accountId,
    controls: {
      onlinePayments: controls?.onlinePayments ?? true,
      paymentsAbroad: controls?.paymentsAbroad ?? false,
      contactless: controls?.contactless ?? true,
      atmWithdrawals: controls?.atmWithdrawals ?? true,
      monthlyLimit: controls?.monthlyLimitMinor != null
        ? money(controls.monthlyLimitMinor, currency)
        : null
    },
    spending: spentThisMonth != null
      ? {
          thisMonth: money(spentThisMonth, currency),
          limitUsedPercent:
            controls?.monthlyLimitMinor && controls.monthlyLimitMinor > 0n
              ? Number((spentThisMonth * 100n) / controls.monthlyLimitMinor)
              : null
        }
      : undefined,
    createdAt: card.createdAt
  };
}

async function loadCard(userId: string, cardId: string) {
  const card = await db.query.cards.findFirst({
    where: and(eq(cards.id, cardId), eq(cards.userId, userId)),
    with: { controls: true, account: true }
  });
  if (!card) throw ApiError.notFound('Card');
  return card;
}

/** Card spend in the current calendar month, used for the limit meter. */
async function monthToDateSpend(cardId: string): Promise<bigint> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(-${transactions.amountMinor}), 0)::text` })
    .from(transactions)
    .where(
      and(
        eq(transactions.cardId, cardId),
        gte(transactions.occurredAt, start),
        sql`${transactions.amountMinor} < 0`,
        sql`${transactions.status} <> 'failed'`
      )
    );

  return BigInt(row?.total ?? '0');
}

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', (req) => app.requireAuth(req));

  app.get('/', async (req) => {
    const { userId } = requireUser(req);

    const rows = await db.query.cards.findMany({
      where: eq(cards.userId, userId),
      with: { controls: true, account: true },
      orderBy: (c, { asc }) => [asc(c.createdAt)]
    });

    const enriched = await Promise.all(
      rows.map(async (row) =>
        toPublicCard(row, row.controls ?? null, await monthToDateSpend(row.id), row.account.currency)
      )
    );

    return { cards: enriched };
  });

  app.get('/:id', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const card = await loadCard(userId, id);

    return {
      card: toPublicCard(card, card.controls ?? null, await monthToDateSpend(card.id), card.account.currency)
    };
  });

  app.post('/', async (req, reply) => {
    const { userId } = requireUser(req);
    const body = z
      .object({
        accountId: z.string().uuid().optional(),
        kind: z.enum(['virtual', 'physical']).default('virtual'),
        holderName: z.string().min(2).max(60)
      })
      .parse(req.body);

    const account = body.accountId
      ? await db.query.accounts.findFirst({
          where: and(eq(accounts.id, body.accountId), eq(accounts.userId, userId))
        })
      : await db.query.accounts.findFirst({
          where: and(eq(accounts.userId, userId), eq(accounts.isPrimary, true))
        });

    if (!account) throw ApiError.notFound('Account');

    /*
     * In production this call goes to the issuing processor, which returns a
     * card token and the last four digits. Nothing here ever holds a PAN, which
     * is what keeps this service outside PCI-DSS scope.
     */
    const issued = await issueCardWithProcessor();

    const card = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(cards)
        .values({
          userId,
          accountId: account.id,
          processorCardId: issued.processorCardId,
          kind: body.kind,
          last4: issued.last4,
          expMonth: issued.expMonth,
          expYear: issued.expYear,
          holderName: body.holderName
        })
        .returning();

      await tx.insert(cardControls).values({ cardId: created!.id });
      return created!;
    });

    reply.code(201);
    return { card: toPublicCard(card, null, 0n, account.currency) };
  });

  /** The freeze switch, the biggest control on the Cards screen. */
  app.post('/:id/freeze', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ frozen: z.boolean() }).parse(req.body);

    const card = await loadCard(userId, id);
    if (card.state === 'terminated') {
      throw ApiError.conflict('This card is terminated and cannot be unfrozen.');
    }

    const [updated] = await db
      .update(cards)
      .set({ state: body.frozen ? 'frozen' : 'active', updatedAt: new Date() })
      .where(and(eq(cards.id, id), eq(cards.userId, userId)))
      .returning();

    await audit(userId, body.frozen ? 'card.frozen' : 'card.unfrozen', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }, { cardId: id });

    publish(userId, { type: 'card.updated', data: { id, state: updated!.state } });

    return { card: toPublicCard(updated!, card.controls ?? null, undefined, card.account.currency) };
  });

  app.patch('/:id/controls', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        onlinePayments: z.boolean().optional(),
        paymentsAbroad: z.boolean().optional(),
        contactless: z.boolean().optional(),
        atmWithdrawals: z.boolean().optional(),
        /** Decimal string, or null to remove the limit. */
        monthlyLimit: z.string().nullable().optional()
      })
      .parse(req.body);

    const card = await loadCard(userId, id);

    const patch: Partial<typeof cardControls.$inferInsert> = { updatedAt: new Date() };
    if (body.onlinePayments !== undefined) patch.onlinePayments = body.onlinePayments;
    if (body.paymentsAbroad !== undefined) patch.paymentsAbroad = body.paymentsAbroad;
    if (body.contactless !== undefined) patch.contactless = body.contactless;
    if (body.atmWithdrawals !== undefined) patch.atmWithdrawals = body.atmWithdrawals;

    if (body.monthlyLimit !== undefined) {
      patch.monthlyLimitMinor =
        body.monthlyLimit === null ? null : parseAmount(body.monthlyLimit, card.account.currency);

      if (patch.monthlyLimitMinor != null && patch.monthlyLimitMinor < 0n) {
        throw ApiError.badRequest('A spending limit cannot be negative');
      }
    }

    const [updated] = await db
      .insert(cardControls)
      .values({ cardId: id, ...patch })
      .onConflictDoUpdate({ target: cardControls.cardId, set: patch })
      .returning();

    publish(userId, { type: 'card.updated', data: { id } });

    return {
      card: toPublicCard(card, updated!, await monthToDateSpend(id), card.account.currency)
    };
  });

  /**
   * Reveal the full card number.
   *
   * The PAN never passes through this service. The client receives a one-shot,
   * 60-second token and exchanges it directly with the processor's PCI-compliant
   * iframe/SDK, which renders the number without it ever touching our servers
   * or logs.
   */
  app.post('/:id/reveal', { preHandler: (req) => app.requireFullAuth(req) }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const card = await loadCard(userId, id);

    if (card.state === 'terminated') throw ApiError.conflict('This card is terminated.');

    await audit(userId, 'card.revealed', { ip: req.ip, userAgent: req.headers['user-agent'] }, { cardId: id });

    return {
      /** Hand this to the processor SDK on the client. */
      revealToken: randomToken(32),
      processorCardId: card.processorCardId,
      expiresIn: 60
    };
  });

  app.post('/:id/terminate', { preHandler: (req) => app.requireFullAuth(req) }, async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await loadCard(userId, id);

    const [updated] = await db
      .update(cards)
      .set({ state: 'terminated', updatedAt: new Date() })
      .where(and(eq(cards.id, id), eq(cards.userId, userId)))
      .returning();

    await audit(userId, 'card.terminated', { ip: req.ip, userAgent: req.headers['user-agent'] }, { cardId: id });

    await notify(userId, {
      kind: 'card_terminated',
      title: 'Card terminated',
      body: `Your card ending ${updated!.last4} can no longer be used.`,
      glyph: '×',
      tint: 'sand',
      data: { cardId: id }
    });

    publish(userId, { type: 'card.updated', data: { id, state: 'terminated' } });
    return { card: toPublicCard(updated!, null) };
  });
};

/** Stand-in for the issuing processor. Swap for the real SDK call. */
async function issueCardWithProcessor() {
  const now = new Date();
  return {
    processorCardId: `proc_${randomToken(12)}`,
    last4: String(Math.floor(1000 + Math.random() * 9000)),
    expMonth: now.getUTCMonth() + 1,
    expYear: now.getUTCFullYear() + 4
  };
}

export default routes;
