import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, ledgerEntries } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { isSupported, money, SUPPORTED_CURRENCIES, symbolOf } from '../../lib/money.js';
import { getRate } from '../fx/service.js';
import type { Account } from '../../db/schema.js';

export function toPublicAccount(account: Account) {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    symbol: symbolOf(account.currency),
    kind: account.kind,
    ibanMasked: account.ibanMasked,
    isPrimary: account.isPrimary,
    status: account.status,
    balance: money(account.balanceMinor, account.currency),
    available: money(account.availableMinor, account.currency),
    createdAt: account.createdAt
  };
}

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', (req) => app.requireAuth(req));

  /**
   * The Accounts screen, plus the Home header's "Total balance". The total is
   * converted into the user's base currency on the server so phone and web can
   * never show two different numbers.
   */
  app.get('/', async (req) => {
    const { userId } = requireUser(req);

    const rows = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
      orderBy: (a, { desc: d }) => [d(a.isPrimary), a.createdAt]
    });

    const user = await db.query.users.findFirst({
      where: (u, { eq: e }) => e(u.id, userId),
      columns: { baseCurrency: true }
    });
    const base = user?.baseCurrency ?? 'USD';

    let totalMinor = 0n;
    for (const account of rows) {
      const { convertedMinor } = await convertToBase(account, base);
      totalMinor += convertedMinor;
    }

    return {
      accounts: rows.map(toPublicAccount),
      total: money(totalMinor, base),
      baseCurrency: base
    };
  });

  app.get('/:id', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const account = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, id), eq(accounts.userId, userId))
    });

    if (!account) throw ApiError.notFound('Account');
    return { account: toPublicAccount(account) };
  });

  /** "Open a balance" — the card on the Accounts screen. */
  app.post('/', async (req, reply) => {
    const { userId } = requireUser(req);
    const body = z
      .object({
        currency: z.string().length(3).transform((c) => c.toUpperCase()),
        name: z.string().min(1).max(60).optional()
      })
      .parse(req.body);

    if (!isSupported(body.currency)) {
      throw ApiError.unprocessable(
        'currency_unsupported',
        `We do not support ${body.currency} yet.`,
        { supported: SUPPORTED_CURRENCIES }
      );
    }

    const existing = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, userId), eq(accounts.currency, body.currency))
    });

    if (existing) throw ApiError.conflict(`You already hold a ${body.currency} balance.`);

    const [created] = await db
      .insert(accounts)
      .values({
        userId,
        currency: body.currency,
        name: body.name ?? `${body.currency} balance`,
        kind: 'balance',
        ibanMasked: maskedIban(body.currency)
      })
      .returning();

    reply.code(201);
    return { account: toPublicAccount(created!) };
  });

  /**
   * Statement: the raw ledger for one account, with a running balance. This is
   * what an auditor or a dispute needs — `/transactions` is the friendly view.
   */
  app.get('/:id/statement', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);

    const account = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, id), eq(accounts.userId, userId))
    });
    if (!account) throw ApiError.notFound('Account');

    const entries = await db.query.ledgerEntries.findMany({
      where: eq(ledgerEntries.accountId, id),
      orderBy: [desc(ledgerEntries.createdAt)],
      limit: query.limit,
      with: {
        transaction: {
          columns: { id: true, reference: true, counterpartyName: true, type: true, occurredAt: true }
        }
      }
    });

    return {
      account: toPublicAccount(account),
      entries: entries.map((e) => ({
        id: e.id,
        direction: e.direction,
        amount: money(e.direction === 'debit' ? -e.amountMinor : e.amountMinor, e.currency, true),
        balanceAfter: money(e.balanceAfterMinor, e.currency),
        createdAt: e.createdAt,
        transaction: e.transaction
      }))
    };
  });
};

async function convertToBase(account: Account, base: string) {
  if (account.currency === base) {
    return { convertedMinor: account.balanceMinor, rate: '1' };
  }
  const { rate, convert } = await getRate(account.currency, base);
  return { convertedMinor: convert(account.balanceMinor), rate };
}

function maskedIban(currency: string): string {
  const country = { USD: 'US', EUR: 'DE', GBP: 'GB', CHF: 'CH', SEK: 'SE', PLN: 'PL' }[currency] ?? 'XX';
  const tail = Math.floor(1000 + Math.random() * 9000);
  return `${country}** **** ${tail}`;
}

export default routes;
