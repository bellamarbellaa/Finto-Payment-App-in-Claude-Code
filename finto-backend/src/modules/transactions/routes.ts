import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, gt, lt, or, sql, desc, inArray, type SQL } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { transactions } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { decodeCursor, encodeCursor, paginationSchema } from '../../lib/pagination.js';
import { formatMoney, money } from '../../lib/money.js';
import { dayKey, formatDay, toPublicTransaction } from './serializer.js';

const listQuery = paginationSchema.extend({
  /** Matches the Activity screen's filter chips. */
  filter: z.enum(['all', 'income', 'spending', 'pending']).default('all'),
  q: z.string().max(120).optional(),
  accountId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** Group rows by day, with a per-day net total, like the design. */
  grouped: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true')
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', (req) => app.requireAuth(req));

  app.get('/', async (req) => {
    const { userId } = requireUser(req);
    const query = listQuery.parse(req.query);

    const filters: (SQL | undefined)[] = [eq(transactions.userId, userId)];

    if (query.filter === 'income') filters.push(gt(transactions.amountMinor, 0n));
    if (query.filter === 'spending') filters.push(lt(transactions.amountMinor, 0n));
    if (query.filter === 'pending') {
      filters.push(inArray(transactions.status, ['pending', 'failed']));
    }

    if (query.accountId) filters.push(eq(transactions.accountId, query.accountId));
    if (query.cardId) filters.push(eq(transactions.cardId, query.cardId));
    if (query.from) filters.push(sql`${transactions.occurredAt} >= ${query.from}`);
    if (query.to) filters.push(sql`${transactions.occurredAt} <= ${query.to}`);

    if (query.q) {
      const pattern = `%${query.q.trim().toLowerCase()}%`;
      filters.push(
        or(
          sql`lower(${transactions.counterpartyName}) LIKE ${pattern}`,
          sql`lower(${transactions.category}) LIKE ${pattern}`,
          sql`lower(${transactions.reference}) LIKE ${pattern}`
        )
      );
    }

    // Keyset pagination on (occurredAt, id): a stable order even as new rows land.
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      filters.push(
        sql`(${transactions.occurredAt}, ${transactions.id}) < (${new Date(cursor.occurredAt)}, ${cursor.id})`
      );
    }

    const rows = await db
      .select()
      .from(transactions)
      .where(and(...filters))
      .orderBy(desc(transactions.occurredAt), desc(transactions.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];

    const nextCursor =
      hasMore && last
        ? encodeCursor({ occurredAt: last.occurredAt.toISOString(), id: last.id })
        : null;

    const serialised = items.map(toPublicTransaction);

    return {
      transactions: serialised,
      groups: query.grouped ? groupByDay(items) : undefined,
      nextCursor,
      hasMore
    };
  });

  /** The transaction detail sheet. */
  app.get('/:id', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const tx = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, userId))
    });

    if (!tx) throw ApiError.notFound('Transaction');
    return { transaction: toPublicTransaction(tx) };
  });

  /** Spend by category — the data behind any insights view. */
  app.get('/summary', async (req) => {
    const { userId } = requireUser(req);
    const query = z
      .object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        currency: z.string().length(3).default('USD')
      })
      .parse(req.query);

    const filters: (SQL | undefined)[] = [
      eq(transactions.userId, userId),
      eq(transactions.currency, query.currency.toUpperCase()),
      eq(transactions.status, 'completed')
    ];
    if (query.from) filters.push(sql`${transactions.occurredAt} >= ${query.from}`);
    if (query.to) filters.push(sql`${transactions.occurredAt} <= ${query.to}`);

    const rows = await db
      .select({
        category: transactions.category,
        totalMinor: sql<string>`SUM(${transactions.amountMinor})::text`,
        count: sql<string>`COUNT(*)::text`
      })
      .from(transactions)
      .where(and(...filters))
      .groupBy(transactions.category)
      .orderBy(sql`SUM(${transactions.amountMinor}) ASC`);

    const currency = query.currency.toUpperCase();
    let spentMinor = 0n;
    let receivedMinor = 0n;

    const categories = rows.map((r) => {
      const total = BigInt(r.totalMinor ?? '0');
      if (total < 0n) spentMinor += -total;
      else receivedMinor += total;
      return {
        category: r.category,
        count: Number(r.count),
        total: money(total, currency, true)
      };
    });

    return {
      currency,
      spent: money(spentMinor, currency),
      received: money(receivedMinor, currency),
      net: money(receivedMinor - spentMinor, currency, true),
      categories
    };
  });
};

/**
 * Group into the "Mar 09  −$63.75" day sections the Activity screen renders.
 *
 * The key is day *and* currency, not day alone: a header total that summed
 * dollars and euros into one figure would be a lie, and this is the one screen
 * where a wrong number is worse than an extra section. Single-currency days —
 * almost all of them — look exactly as designed.
 */
function groupByDay(rows: (typeof transactions.$inferSelect)[]) {
  const order: string[] = [];
  const byKey = new Map<
    string,
    { day: string; currency: string; netMinor: bigint; items: ReturnType<typeof toPublicTransaction>[] }
  >();

  for (const row of rows) {
    const day = dayKey(row.occurredAt);
    const key = `${day}:${row.currency}`;

    let group = byKey.get(key);
    if (!group) {
      group = { day, currency: row.currency, netMinor: 0n, items: [] };
      byKey.set(key, group);
      order.push(key);
    }

    group.netMinor += row.amountMinor;
    group.items.push(toPublicTransaction(row));
  }

  return order.map((key) => {
    const g = byKey.get(key)!;
    return {
      key,
      label: formatDay(g.items[0]!.occurredAt),
      total: formatMoney(g.netMinor, g.currency, { signed: true }),
      currency: g.currency,
      items: g.items
    };
  });
}

export default routes;
