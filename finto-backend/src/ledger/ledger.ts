/**
 * Double-entry posting engine.
 *
 * Every money movement is a set of balanced entries. Debits and credits within
 * a posting must sum to zero per currency, and the whole posting is written in
 * one database transaction with the affected accounts locked FOR UPDATE. If
 * anything throws, nothing is written — there is no partial payment.
 */
import { eq, sql, and, inArray } from 'drizzle-orm';
import { accounts, ledgerEntries, transactions } from '../db/schema.js';
import type { DbExecutor } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import { transactionReference } from '../lib/crypto.js';

export interface PostingLine {
  accountId: string;
  /** Positive = money into the account, negative = money out. Minor units. */
  amountMinor: bigint;
  currency: string;
}

export interface PostingInput {
  lines: PostingLine[];
  transaction: {
    userId: string;
    accountId: string;
    type: typeof transactions.$inferInsert.type;
    status?: typeof transactions.$inferInsert.status;
    amountMinor: bigint;
    currency: string;
    counterpartyName: string;
    counterpartyHandle?: string | null;
    category?: string;
    tint?: string;
    note?: string | null;
    cardId?: string | null;
    reference?: string;
    occurredAt?: Date;
    metadata?: Record<string, unknown>;
  };
  /** Refuse the posting if it would take an account below zero. */
  allowNegative?: boolean;
}

export interface LockedAccount {
  id: string;
  userId: string;
  currency: string;
  balanceMinor: bigint;
  availableMinor: bigint;
  status: 'active' | 'frozen' | 'closed';
}

/**
 * Lock the given accounts FOR UPDATE, always in a deterministic order.
 * Sorting by id is what stops two simultaneous transfers between the same pair
 * of accounts from deadlocking against each other.
 */
export async function lockAccounts(
  tx: DbExecutor,
  accountIds: string[]
): Promise<Map<string, LockedAccount>> {
  const unique = [...new Set(accountIds)].sort();
  if (unique.length === 0) return new Map();

  const rows = await tx
    .select({
      id: accounts.id,
      userId: accounts.userId,
      currency: accounts.currency,
      balanceMinor: accounts.balanceMinor,
      availableMinor: accounts.availableMinor,
      status: accounts.status
    })
    .from(accounts)
    .where(inArray(accounts.id, unique))
    .orderBy(accounts.id)
    .for('update');

  if (rows.length !== unique.length) throw ApiError.notFound('Account');

  return new Map(rows.map((r) => [r.id, r as LockedAccount]));
}

function assertBalanced(lines: PostingLine[]): void {
  if (lines.length < 2) throw new Error('A posting needs at least two lines');

  const byCurrency = new Map<string, bigint>();
  for (const line of lines) {
    const key = line.currency.toUpperCase();
    byCurrency.set(key, (byCurrency.get(key) ?? 0n) + line.amountMinor);
  }

  for (const [currency, total] of byCurrency) {
    // Cross-currency movements balance through an FX suspense account, so an
    // unbalanced posting is always a bug rather than a valid business case.
    if (total !== 0n) throw new Error(`Unbalanced posting in ${currency}: net ${total} minor units`);
  }
}

export interface PostResult {
  transactionId: string;
  reference: string;
  balances: Map<string, bigint>;
}

/** Write one balanced posting. Must be called inside db.transaction(). */
export async function post(tx: DbExecutor, input: PostingInput): Promise<PostResult> {
  assertBalanced(input.lines);

  const locked = await lockAccounts(
    tx,
    input.lines.map((l) => l.accountId)
  );

  // Validate every line before writing anything.
  for (const line of input.lines) {
    const account = locked.get(line.accountId)!;

    if (account.currency.toUpperCase() !== line.currency.toUpperCase()) {
      throw ApiError.badRequest(`Account ${account.id} holds ${account.currency}, not ${line.currency}`);
    }

    if (account.status !== 'active') {
      throw ApiError.unprocessable('account_frozen', `This ${account.currency} account is ${account.status}.`);
    }

    if (account.balanceMinor + line.amountMinor < 0n && !input.allowNegative) {
      throw ApiError.unprocessable('insufficient_funds', 'That is above your available balance.', {
        accountId: account.id,
        currency: account.currency
      });
    }
  }

  const reference = input.transaction.reference ?? transactionReference();

  const [created] = await tx
    .insert(transactions)
    .values({
      userId: input.transaction.userId,
      accountId: input.transaction.accountId,
      type: input.transaction.type,
      status: input.transaction.status ?? 'completed',
      amountMinor: input.transaction.amountMinor,
      currency: input.transaction.currency,
      reference,
      counterpartyName: input.transaction.counterpartyName,
      counterpartyHandle: input.transaction.counterpartyHandle ?? null,
      category: input.transaction.category ?? 'General',
      tint: input.transaction.tint ?? 'stone',
      note: input.transaction.note ?? null,
      cardId: input.transaction.cardId ?? null,
      occurredAt: input.transaction.occurredAt ?? new Date(),
      settledAt: (input.transaction.status ?? 'completed') === 'completed' ? new Date() : null,
      metadata: input.transaction.metadata ?? {}
    })
    .returning({ id: transactions.id, reference: transactions.reference });

  if (!created) throw ApiError.internal('Failed to record transaction');

  const balances = new Map<string, bigint>();

  for (const line of input.lines) {
    const account = locked.get(line.accountId)!;
    const balanceAfter = account.balanceMinor + line.amountMinor;

    await tx.insert(ledgerEntries).values({
      transactionId: created.id,
      accountId: line.accountId,
      direction: line.amountMinor >= 0n ? 'credit' : 'debit',
      amountMinor: line.amountMinor < 0n ? -line.amountMinor : line.amountMinor,
      currency: line.currency.toUpperCase(),
      balanceAfterMinor: balanceAfter
    });

    await tx
      .update(accounts)
      .set({
        balanceMinor: balanceAfter,
        availableMinor: sql`${accounts.availableMinor} + ${line.amountMinor}`,
        updatedAt: new Date()
      })
      .where(eq(accounts.id, line.accountId));

    // Keep the in-memory copy current in case one posting touches an account twice.
    account.balanceMinor = balanceAfter;
    balances.set(line.accountId, balanceAfter);
  }

  return { transactionId: created.id, reference: created.reference, balances };
}

/**
 * Recompute an account's balance from its entries. If this ever disagrees with
 * `accounts.balance_minor`, the cache is wrong and the ledger wins.
 */
export async function recomputeBalance(tx: DbExecutor, accountId: string): Promise<bigint> {
  const [row] = await tx
    .select({
      total: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.direction} = 'credit'
                                           THEN ${ledgerEntries.amountMinor}
                                           ELSE -${ledgerEntries.amountMinor} END), 0)::text`
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountId));

  return BigInt(row?.total ?? '0');
}

/** Reverse a completed transaction by posting its mirror image. */
export async function reverse(
  tx: DbExecutor,
  transactionId: string,
  reason: string
): Promise<PostResult> {
  const original = await tx.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    with: { entries: true }
  });

  if (!original) throw ApiError.notFound('Transaction');
  if (original.status === 'reversed') throw ApiError.conflict('This transaction is already reversed.');

  const lines: PostingLine[] = original.entries.map((entry) => ({
    accountId: entry.accountId,
    amountMinor: entry.direction === 'credit' ? -entry.amountMinor : entry.amountMinor,
    currency: entry.currency
  }));

  const result = await post(tx, {
    lines,
    allowNegative: true, // A reversal must always succeed, even into overdraft.
    transaction: {
      userId: original.userId,
      accountId: original.accountId,
      type: original.type,
      status: 'completed',
      amountMinor: -original.amountMinor,
      currency: original.currency,
      counterpartyName: original.counterpartyName,
      counterpartyHandle: original.counterpartyHandle,
      category: original.category,
      tint: original.tint,
      note: `Reversal of ${original.reference}: ${reason}`,
      metadata: { reversalOf: original.id, reason }
    }
  });

  await tx
    .update(transactions)
    .set({ status: 'reversed', counterTransactionId: result.transactionId })
    .where(and(eq(transactions.id, transactionId), eq(transactions.status, 'completed')));

  return result;
}
