/**
 * Finto database schema.
 *
 * Money rule: every monetary value is a BIGINT of *minor units* (cents) plus an
 * explicit ISO-4217 currency. Floats never touch a balance. See src/lib/money.ts.
 *
 * Truth rule: `ledger_entries` is the source of truth for balances. The
 * `accounts.balance_minor` column is a cache, only ever written inside the same
 * database transaction that writes the entries, under a row lock.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  bigint,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  primaryKey
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/* ------------------------------------------------------------------ enums */

export const userStatus = pgEnum('user_status', ['active', 'suspended', 'closed']);
export const accountKind = pgEnum('account_kind', ['main', 'balance', 'savings']);
export const accountStatus = pgEnum('account_status', ['active', 'frozen', 'closed']);
export const entryDirection = pgEnum('entry_direction', ['debit', 'credit']);
export const txType = pgEnum('tx_type', [
  'payment_out',
  'payment_in',
  'card_purchase',
  'card_refund',
  'transfer',
  'conversion',
  'fee',
  'top_up',
  'withdrawal'
]);
export const txStatus = pgEnum('tx_status', ['pending', 'completed', 'failed', 'reversed']);
export const cardKind = pgEnum('card_kind', ['virtual', 'physical']);
export const cardState = pgEnum('card_state', ['active', 'frozen', 'terminated']);
export const requestStatus = pgEnum('request_status', ['pending', 'paid', 'declined', 'cancelled', 'expired']);
export const devicePlatform = pgEnum('device_platform', ['ios', 'android', 'web']);
export const ticketStatus = pgEnum('ticket_status', ['open', 'pending', 'resolved']);

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    fullName: varchar('full_name', { length: 120 }).notNull(),
    /** Shown in the app header ("Sofia"). */
    displayName: varchar('display_name', { length: 60 }).notNull(),
    handle: varchar('handle', { length: 40 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Optional 6-digit app unlock PIN, hashed like a password. */
    pinHash: text('pin_hash'),
    biometricEnabled: boolean('biometric_enabled').notNull().default(false),
    /** "Confirm every payment" toggle on the Security screen. */
    confirmPayments: boolean('confirm_payments').notNull().default(true),
    /** Avatar/tint key used by the design system: lime | forest | sand | sky | stone. */
    tint: varchar('tint', { length: 16 }).notNull().default('lime'),
    baseCurrency: varchar('base_currency', { length: 3 }).notNull().default('USD'),
    status: userStatus('status').notNull().default('active'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`),
    handleIdx: uniqueIndex('users_handle_lower_idx').on(sql`lower(${t.handle})`)
  })
);

/* ---------------------------------------------------------------- devices */

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    platform: devicePlatform('platform').notNull(),
    /** APNs / FCM / Web Push token. */
    pushToken: text('push_token'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastIp: varchar('last_ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ userIdx: index('devices_user_idx').on(t.userId) })
);

/** One row per issued refresh token. Rotation revokes the old row. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    /** SHA-256 of the refresh token. The raw token is never stored. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userAgent: text('user_agent'),
    ip: varchar('ip', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Set when this token was rotated, so replay of an old token is detectable. */
    replacedBySessionId: uuid('replaced_by_session_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    tokenIdx: uniqueIndex('sessions_token_hash_idx').on(t.tokenHash),
    userIdx: index('sessions_user_idx').on(t.userId)
  })
);

/* --------------------------------------------------------------- accounts */

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    kind: accountKind('kind').notNull().default('balance'),
    /** Display-safe masked identifier, e.g. "US** **** 4429". */
    ibanMasked: varchar('iban_masked', { length: 40 }).notNull(),
    /** Settled balance, cache of SUM(ledger_entries). Minor units. */
    balanceMinor: bigint('balance_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    /** Balance minus authorisations still on hold. Minor units. */
    availableMinor: bigint('available_minor', { mode: 'bigint' }).notNull().default(sql`0`),
    isPrimary: boolean('is_primary').notNull().default(false),
    status: accountStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userIdx: index('accounts_user_idx').on(t.userId),
    oneCurrencyPerUser: uniqueIndex('accounts_user_currency_idx').on(t.userId, t.currency)
  })
);

/* ----------------------------------------------------------- transactions */

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    type: txType('type').notNull(),
    status: txStatus('status').notNull().default('pending'),
    /** Signed: negative is money out, positive is money in. Minor units. */
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    /** Human-facing reference, e.g. "FT-8838-2204". Unique, safe to show. */
    reference: varchar('reference', { length: 32 }).notNull(),
    counterpartyName: varchar('counterparty_name', { length: 120 }).notNull(),
    counterpartyHandle: varchar('counterparty_handle', { length: 80 }),
    category: varchar('category', { length: 40 }).notNull().default('General'),
    /** Design-system tint key for the avatar chip. */
    tint: varchar('tint', { length: 16 }).notNull().default('stone'),
    note: text('note'),
    failureReason: text('failure_reason'),
    cardId: uuid('card_id'),
    /** The other leg, for internal Finto-to-Finto transfers. */
    counterTransactionId: uuid('counter_transaction_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    referenceIdx: uniqueIndex('transactions_reference_idx').on(t.reference),
    /** Drives the Activity screen: newest first, per user. */
    feedIdx: index('transactions_user_occurred_idx').on(t.userId, t.occurredAt),
    accountIdx: index('transactions_account_idx').on(t.accountId, t.occurredAt),
    searchIdx: index('transactions_counterparty_idx').on(sql`lower(${t.counterpartyName})`)
  })
);

/** Immutable double-entry lines. Never updated, never deleted — reverse instead. */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    direction: entryDirection('direction').notNull(),
    /** Always positive. Direction carries the sign. Minor units. */
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    /** Running balance after this entry — makes statements auditable. */
    balanceAfterMinor: bigint('balance_after_minor', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    txIdx: index('ledger_transaction_idx').on(t.transactionId),
    accountIdx: index('ledger_account_idx').on(t.accountId, t.createdAt)
  })
);

/* --------------------------------------------------------------- contacts */

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Set when the contact is another Finto user — enables instant transfers. */
    contactUserId: uuid('contact_user_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 120 }).notNull(),
    handle: varchar('handle', { length: 80 }).notNull(),
    tint: varchar('tint', { length: 16 }).notNull().default('stone'),
    isFavourite: boolean('is_favourite').notNull().default(false),
    lastPaidAt: timestamp('last_paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userIdx: index('contacts_user_idx').on(t.userId),
    uniqueHandle: uniqueIndex('contacts_user_handle_idx').on(t.userId, t.handle)
  })
);

/* ------------------------------------------------------- payment requests */

export const paymentRequests = pgTable(
  'payment_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Where the money lands when paid. */
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    payerContactId: uuid('payer_contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    payerUserId: uuid('payer_user_id').references(() => users.id, { onDelete: 'set null' }),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    note: varchar('note', { length: 140 }),
    status: requestStatus('status').notNull().default('pending'),
    /** Opaque token embedded in the QR code / share link. */
    linkToken: varchar('link_token', { length: 48 }).notNull(),
    paidTransactionId: uuid('paid_transaction_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    tokenIdx: uniqueIndex('payment_requests_token_idx').on(t.linkToken),
    requesterIdx: index('payment_requests_requester_idx').on(t.requesterId, t.createdAt)
  })
);

/* ------------------------------------------------------------------ cards */

/**
 * Card PANs are deliberately NOT stored. Only the last four digits and an
 * opaque processor token live here; full card data stays with the PCI-DSS
 * certified issuing processor and is revealed to the client through a
 * short-lived, single-use token (see modules/cards).
 */
export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    /** Token issued by the card processor; the only handle to the real PAN. */
    processorCardId: varchar('processor_card_id', { length: 80 }).notNull(),
    brand: varchar('brand', { length: 20 }).notNull().default('visa'),
    kind: cardKind('kind').notNull().default('virtual'),
    last4: varchar('last4', { length: 4 }).notNull(),
    expMonth: integer('exp_month').notNull(),
    expYear: integer('exp_year').notNull(),
    holderName: varchar('holder_name', { length: 60 }).notNull(),
    state: cardState('state').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ userIdx: index('cards_user_idx').on(t.userId) })
);

/** The toggles on the Card controls screen. */
export const cardControls = pgTable('card_controls', {
  cardId: uuid('card_id')
    .primaryKey()
    .references(() => cards.id, { onDelete: 'cascade' }),
  onlinePayments: boolean('online_payments').notNull().default(true),
  paymentsAbroad: boolean('payments_abroad').notNull().default(false),
  contactless: boolean('contactless').notNull().default(true),
  atmWithdrawals: boolean('atm_withdrawals').notNull().default(true),
  /** Null means no limit. Minor units, in the card account's currency. */
  monthlyLimitMinor: bigint('monthly_limit_minor', { mode: 'bigint' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/* ---------------------------------------------------------- notifications */

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 40 }).notNull(),
    title: varchar('title', { length: 140 }).notNull(),
    body: text('body').notNull(),
    /** Glyph + tint keys so the client renders without a lookup table. */
    glyph: varchar('glyph', { length: 8 }).notNull().default('•'),
    tint: varchar('tint', { length: 16 }).notNull().default('stone'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ userIdx: index('notifications_user_created_idx').on(t.userId, t.createdAt) })
);

/* --------------------------------------------------------------- fx rates */

export const fxRates = pgTable(
  'fx_rates',
  {
    base: varchar('base', { length: 3 }).notNull(),
    quote: varchar('quote', { length: 3 }).notNull(),
    /** Mid-market rate. Numeric, not float — 12 significant digits is plenty. */
    rate: numeric('rate', { precision: 20, scale: 10 }).notNull(),
    asOf: timestamp('as_of', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ pk: primaryKey({ columns: [t.base, t.quote] }) })
);

/* ------------------------------------------------------- idempotency keys */

/**
 * Replays of a money-moving request return the original response instead of
 * charging twice. A flaky mobile connection retrying a payment is the normal
 * case, not the exception.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: varchar('key', { length: 120 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: varchar('endpoint', { length: 120 }).notNull(),
    /** SHA-256 of the request body — a reused key with a different body is a bug. */
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    statusCode: integer('status_code'),
    responseBody: jsonb('response_body').$type<unknown>(),
    /** 'in_flight' until the handler finishes; blocks concurrent duplicates. */
    state: varchar('state', { length: 16 }).notNull().default('in_flight'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.key] }) })
);

/* ---------------------------------------------------------------- support */

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subject: varchar('subject', { length: 140 }).notNull(),
    status: ticketStatus('status').notNull().default('open'),
    relatedTransactionId: uuid('related_transaction_id').references(() => transactions.id, {
      onDelete: 'set null'
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ userIdx: index('support_tickets_user_idx').on(t.userId, t.createdAt) })
);

export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    /** 'user' or 'agent'. */
    author: varchar('author', { length: 16 }).notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ ticketIdx: index('support_messages_ticket_idx').on(t.ticketId, t.createdAt) })
);

/* -------------------------------------------------------------- audit log */

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 60 }).notNull(),
    entity: varchar('entity', { length: 40 }),
    entityId: uuid('entity_id'),
    ip: varchar('ip', { length: 64 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ userIdx: index('audit_log_user_idx').on(t.userId, t.createdAt) })
);

/* -------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  cards: many(cards),
  contacts: many(contacts),
  transactions: many(transactions),
  notifications: many(notifications),
  devices: many(devices),
  sessions: many(sessions)
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  entries: many(ledgerEntries),
  transactions: many(transactions)
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  entries: many(ledgerEntries)
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  transaction: one(transactions, {
    fields: [ledgerEntries.transactionId],
    references: [transactions.id]
  }),
  account: one(accounts, { fields: [ledgerEntries.accountId], references: [accounts.id] })
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  user: one(users, { fields: [cards.userId], references: [users.id] }),
  account: one(accounts, { fields: [cards.accountId], references: [accounts.id] }),
  controls: one(cardControls, { fields: [cards.id], references: [cardControls.cardId] })
}));

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
