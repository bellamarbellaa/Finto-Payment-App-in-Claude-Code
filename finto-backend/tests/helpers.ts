import { sql } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import {
  accounts,
  cardControls,
  cards,
  contacts,
  idempotencyKeys,
  ledgerEntries,
  notifications,
  paymentRequests,
  sessions,
  transactions,
  users
} from '../src/db/schema.js';
import { hashSecret } from '../src/lib/crypto.js';
import { parseAmount } from '../src/lib/money.js';

export async function resetDatabase() {
  await db.execute(sql`
    TRUNCATE ${idempotencyKeys}, ${ledgerEntries}, ${transactions}, ${paymentRequests},
             ${cardControls}, ${cards}, ${contacts}, ${notifications}, ${sessions},
             ${accounts}, ${users}
    RESTART IDENTITY CASCADE
  `);
}

let counter = 0;

/** Create a user with a funded account, bypassing the API. */
export async function makeUser(opts: { balance?: string; currency?: string; handle?: string } = {}) {
  const n = ++counter;
  const currency = opts.currency ?? 'USD';

  const [user] = await db
    .insert(users)
    .values({
      email: `test${n}-${Date.now()}@finto.test`,
      fullName: `Test User ${n}`,
      displayName: `Test${n}`,
      handle: opts.handle ?? `@test${n}-${Date.now()}`,
      passwordHash: await hashSecret('test-password-1234'),
      baseCurrency: currency
    })
    .returning();

  const [account] = await db
    .insert(accounts)
    .values({
      userId: user!.id,
      name: `Main · ${currency}`,
      currency,
      kind: 'main',
      ibanMasked: 'XX** **** 0001',
      isPrimary: true
    })
    .returning();

  if (opts.balance) {
    const minor = parseAmount(opts.balance, currency);
    await db
      .update(accounts)
      .set({ balanceMinor: minor, availableMinor: minor })
      .where(sql`${accounts.id} = ${account!.id}`);
    return { user: user!, account: { ...account!, balanceMinor: minor, availableMinor: minor } };
  }

  return { user: user!, account: account! };
}

/** Sum of every ledger entry in a currency. Must always be zero. */
export async function ledgerNet(currency: string): Promise<bigint> {
  const [row] = await db
    .select({
      net: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.direction} = 'credit'
                                         THEN ${ledgerEntries.amountMinor}
                                         ELSE -${ledgerEntries.amountMinor} END), 0)::text`
    })
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.currency} = ${currency}`);

  return BigInt(row?.net ?? '0');
}

export async function balanceOf(accountId: string): Promise<bigint> {
  const row = await db.query.accounts.findFirst({
    where: sql`${accounts.id} = ${accountId}`,
    columns: { balanceMinor: true }
  });
  return row?.balanceMinor ?? 0n;
}
