/**
 * Seeds the exact data the clickable design shows, so the app looks the same
 * running against the real API as it did as a prototype.
 *
 * Sign in with:  sofia@marengo.studio  /  sofia2026-finto
 */
import { sql } from 'drizzle-orm';
import { db, closeDb } from './client.js';
import {
  accounts,
  cardControls,
  cards,
  contacts,
  fxRates,
  ledgerEntries,
  notifications,
  transactions,
  users
} from './schema.js';
import { hashSecret, transactionReference } from '../lib/crypto.js';
import { parseAmount } from '../lib/money.js';

const RATES: [string, string, string][] = [
  ['USD', 'EUR', '0.9210'],
  ['USD', 'GBP', '0.7880'],
  ['EUR', 'USD', '1.0858'],
  ['EUR', 'GBP', '0.8556'],
  ['GBP', 'USD', '1.2690'],
  ['GBP', 'EUR', '1.1688'],
  ['USD', 'CHF', '0.8830'],
  ['USD', 'SEK', '10.4200'],
  ['USD', 'PLN', '4.0100'],
  ['USD', 'CAD', '1.3620'],
  ['USD', 'AUD', '1.5150'],
  ['USD', 'JPY', '151.2000'],
  ['USD', 'SGD', '1.3450'],
  ['USD', 'NZD', '1.6400'],
  ['USD', 'NOK', '10.7300'],
  ['USD', 'DKK', '6.8700'],
  ['USD', 'RON', '4.5800']
];

/** Straight from the design's TX array. */
const SEED_TX = [
  { merchant: 'Stripe', cat: 'Income', amount: '1820.00', dir: 1, day: 'Mar 12', time: '09:14', status: 'completed', tint: 'lime' },
  { merchant: 'Northwind Studio', cat: 'Transfer', amount: '240.00', dir: -1, day: 'Mar 12', time: '08:02', status: 'completed', tint: 'sand' },
  { merchant: 'Blue Bottle', cat: 'Food & drink', amount: '6.40', dir: -1, day: 'Mar 11', time: '17:22', status: 'completed', tint: 'forest' },
  { merchant: 'Apple', cat: 'Software', amount: '129.00', dir: -1, day: 'Mar 11', time: '13:05', status: 'pending', tint: 'stone' },
  { merchant: 'Alessia Moretti', cat: 'Transfer', amount: '75.00', dir: 1, day: 'Mar 10', time: '19:40', status: 'completed', tint: 'lime' },
  { merchant: 'Whole Foods', cat: 'Groceries', amount: '84.20', dir: -1, day: 'Mar 10', time: '12:15', status: 'completed', tint: 'sand' },
  { merchant: 'Figma', cat: 'Software', amount: '45.00', dir: -1, day: 'Mar 09', time: '11:48', status: 'failed', tint: 'sky' },
  { merchant: 'Uber', cat: 'Transport', amount: '18.75', dir: -1, day: 'Mar 09', time: '08:31', status: 'completed', tint: 'stone' }
] as const;

const SEED_CONTACTS = [
  { name: 'Alessia Moretti', handle: '@alessia', tint: 'lime' },
  { name: 'Marcus Lee', handle: '@mlee', tint: 'stone' },
  { name: 'Northwind Studio', handle: 'northwind.co', tint: 'sand' },
  { name: 'Priya Raman', handle: '@priya', tint: 'sky' },
  { name: 'Tomás Ruiz', handle: '@truiz', tint: 'forest' }
];

/** "Mar 12" + "09:14" in the current year, as UTC. */
function dateOf(day: string, time: string): Date {
  const year = new Date().getUTCFullYear();
  return new Date(`${day} ${year} ${time}:00 UTC`);
}

async function seed() {
  console.log('Seeding Finto…');

  await db.execute(sql`
    TRUNCATE ${ledgerEntries}, ${transactions}, ${cardControls}, ${cards},
             ${contacts}, ${notifications}, ${accounts}, ${users}, ${fxRates}
    RESTART IDENTITY CASCADE
  `);

  await db.insert(fxRates).values(RATES.map(([base, quote, rate]) => ({ base, quote, rate })));

  /* The house account every external payment settles through. */
  const [house] = await db
    .insert(users)
    .values({
      email: 'settlement@finto.internal',
      fullName: 'Finto Settlement',
      displayName: 'Finto',
      handle: '@finto.settlement',
      passwordHash: await hashSecret('this-account-never-signs-in-' + Date.now()),
      status: 'suspended' // it holds float; it must never authenticate
    })
    .returning();

  await db.insert(accounts).values(
    ['USD', 'EUR', 'GBP'].map((currency) => ({
      userId: house!.id,
      name: `Settlement · ${currency}`,
      currency,
      kind: 'main' as const,
      ibanMasked: `XX** **** 0000`
    }))
  );

  /* ------------------------------------------------------------- Sofia */

  const [sofia] = await db
    .insert(users)
    .values({
      email: 'sofia@marengo.studio',
      phone: '+14155550142',
      fullName: 'Sofia Marengo',
      displayName: 'Sofia',
      handle: '@sofia',
      passwordHash: await hashSecret('sofia2026-finto'),
      pinHash: await hashSecret('4829'),
      biometricEnabled: true,
      confirmPayments: true,
      tint: 'lime',
      baseCurrency: 'USD',
      emailVerifiedAt: new Date()
    })
    .returning();

  const [usd, eur, gbp] = await db
    .insert(accounts)
    .values([
      { userId: sofia!.id, name: 'Main · USD', currency: 'USD', kind: 'main' as const, ibanMasked: 'US** **** 4429', isPrimary: true },
      { userId: sofia!.id, name: 'Euro balance', currency: 'EUR', kind: 'balance' as const, ibanMasked: 'DE** **** 8102' },
      { userId: sofia!.id, name: 'Pound balance', currency: 'GBP', kind: 'balance' as const, ibanMasked: 'GB** **** 5530' }
    ])
    .returning();

  /*
   * Opening balances are posted as real ledger entries against the settlement
   * account, not written straight onto accounts.balance_minor. Seed data that
   * bypasses the ledger would leave the books unbalanced from day one.
   */
  const houseAccounts = await db.query.accounts.findMany({
    where: (a, { eq }) => eq(a.userId, house!.id)
  });
  const houseBy = new Map(houseAccounts.map((a) => [a.currency, a]));

  const openings: [typeof usd, string][] = [
    [usd!, '2450.80'],
    [eur!, '612.40'],
    [gbp!, '0.00']
  ];

  for (const [account, amount] of openings) {
    const minor = parseAmount(amount, account!.currency);
    if (minor === 0n) continue;

    const houseAccount = houseBy.get(account!.currency)!;

    await db.transaction(async (tx) => {
      const [txRow] = await tx
        .insert(transactions)
        .values({
          userId: sofia!.id,
          accountId: account!.id,
          type: 'top_up',
          status: 'completed',
          amountMinor: minor,
          currency: account!.currency,
          reference: transactionReference(),
          counterpartyName: 'Opening balance',
          category: 'Top-up',
          tint: 'forest',
          occurredAt: new Date(Date.now() - 45 * 86_400_000),
          settledAt: new Date(Date.now() - 45 * 86_400_000)
        })
        .returning();

      await tx.insert(ledgerEntries).values([
        {
          transactionId: txRow!.id,
          accountId: account!.id,
          direction: 'credit',
          amountMinor: minor,
          currency: account!.currency,
          balanceAfterMinor: minor
        },
        {
          transactionId: txRow!.id,
          accountId: houseAccount.id,
          direction: 'debit',
          amountMinor: minor,
          currency: account!.currency,
          balanceAfterMinor: -minor
        }
      ]);

      await tx
        .update(accounts)
        .set({ balanceMinor: minor, availableMinor: minor })
        .where(sql`${accounts.id} = ${account!.id}`);

      await tx
        .update(accounts)
        .set({
          balanceMinor: sql`${accounts.balanceMinor} - ${minor}`,
          availableMinor: sql`${accounts.availableMinor} - ${minor}`
        })
        .where(sql`${accounts.id} = ${houseAccount.id}`);
    });
  }

  /* ---------------------------------------------------------- contacts */

  await db.insert(contacts).values(
    SEED_CONTACTS.map((c) => ({
      userId: sofia!.id,
      name: c.name,
      handle: c.handle,
      tint: c.tint
    }))
  );

  /* -------------------------------------------------------------- card */

  const [card] = await db
    .insert(cards)
    .values({
      userId: sofia!.id,
      accountId: usd!.id,
      processorCardId: 'proc_seed_4429',
      brand: 'visa',
      kind: 'virtual',
      last4: '4429',
      expMonth: 11,
      expYear: new Date().getUTCFullYear() + 3,
      holderName: 'SOFIA MARENGO'
    })
    .returning();

  await db.insert(cardControls).values({
    cardId: card!.id,
    onlinePayments: true,
    paymentsAbroad: false,
    contactless: true,
    monthlyLimitMinor: parseAmount('2000', 'USD')
  });

  /* ------------------------------------------------------ the activity */

  /*
   * These are the historical rows the design shows. They are written directly
   * rather than through post(), because they describe events that already
   * happened — the opening balances above already account for their net effect.
   */
  for (const item of SEED_TX) {
    const minor = parseAmount(item.amount, 'USD') * BigInt(item.dir);
    const occurred = dateOf(item.day, item.time);

    await db.insert(transactions).values({
      userId: sofia!.id,
      accountId: usd!.id,
      type: item.dir > 0 ? 'payment_in' : item.cat === 'Transfer' ? 'payment_out' : 'card_purchase',
      status: item.status,
      amountMinor: minor,
      currency: 'USD',
      reference: transactionReference(),
      counterpartyName: item.merchant,
      category: item.cat,
      tint: item.tint,
      cardId: item.cat === 'Transfer' || item.cat === 'Income' ? null : card!.id,
      occurredAt: occurred,
      settledAt: item.status === 'completed' ? occurred : null,
      failureReason: item.status === 'failed' ? 'The card was declined by the merchant' : null
    });
  }

  /* --------------------------------------------------- notifications */

  await db.insert(notifications).values([
    {
      userId: sofia!.id,
      kind: 'payment_received',
      title: 'Stripe payout received',
      body: '$1,820.00 was added to your Main · USD balance.',
      glyph: '↓',
      tint: 'forest',
      createdAt: new Date(Date.now() - 3_600_000)
    },
    {
      userId: sofia!.id,
      kind: 'card_pending',
      title: 'Apple payment is pending',
      body: '$129.00 will settle within one working day.',
      glyph: '◷',
      tint: 'sand',
      createdAt: new Date(Date.now() - 8 * 3_600_000)
    },
    {
      userId: sofia!.id,
      kind: 'announcement',
      title: 'Euro balances are live',
      body: 'Hold and spend EUR at the real exchange rate.',
      glyph: '★',
      tint: 'stone',
      createdAt: new Date(Date.now() - 2 * 86_400_000)
    }
  ]);

  /* ------------------------------- a second user, so transfers are real */

  const [alessia] = await db
    .insert(users)
    .values({
      email: 'alessia@moretti.co',
      fullName: 'Alessia Moretti',
      displayName: 'Alessia',
      handle: '@alessia',
      passwordHash: await hashSecret('alessia2026-finto'),
      tint: 'lime',
      baseCurrency: 'EUR',
      emailVerifiedAt: new Date()
    })
    .returning();

  await db.insert(accounts).values({
    userId: alessia!.id,
    name: 'Main · EUR',
    currency: 'EUR',
    kind: 'main',
    ibanMasked: 'IT** **** 7741',
    isPrimary: true
  });

  // Link Sofia's contact to the real account so paying @alessia settles instantly.
  await db
    .update(contacts)
    .set({ contactUserId: alessia!.id })
    .where(sql`${contacts.userId} = ${sofia!.id} AND ${contacts.handle} = '@alessia'`);

  console.log(`
Seed complete.

  Sign in as Sofia     sofia@marengo.studio    sofia2026-finto   (PIN 4829)
  Sign in as Alessia   alessia@moretti.co      alessia2026-finto

  Sofia holds $2,450.80 · €612.40 · £0.00 across three accounts,
  with one Visa ending 4429 and eight transactions in her activity.
`);
}

seed()
  .then(closeDb)
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await closeDb();
    process.exit(1);
  });
