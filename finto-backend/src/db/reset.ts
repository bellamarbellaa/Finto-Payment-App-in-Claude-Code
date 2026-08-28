/**
 * Drops Finto's own tables so migrations can rebuild them from scratch.
 *
 * Deliberately NOT `DROP SCHEMA public CASCADE`: on a managed provider such as
 * Supabase the public schema also holds extensions and the provider's own
 * objects, and dropping it would take those with it. Only the tables this
 * application declares are removed.
 *
 * Development only — it refuses to run against a production DATABASE_URL.
 */
import { sql } from 'drizzle-orm';
import { db, closeDb } from './client.js';
import { env } from '../env.js';

const TABLES = [
  'idempotency_keys',
  'ledger_entries',
  'transactions',
  'payment_requests',
  'card_controls',
  'cards',
  'contacts',
  'notifications',
  'support_messages',
  'support_tickets',
  'audit_log',
  'sessions',
  'devices',
  'accounts',
  'users',
  'fx_rates',
  '__drizzle_migrations'
];

const ENUMS = [
  'user_status',
  'account_kind',
  'account_status',
  'entry_direction',
  'tx_type',
  'tx_status',
  'card_kind',
  'card_state',
  'request_status',
  'device_platform',
  'ticket_status'
];

const run = async () => {
  if (env.isProd) {
    console.error('Refusing to reset a production database.');
    process.exit(1);
  }

  const host = new URL(env.DATABASE_URL).hostname;
  console.log(`Dropping Finto tables on ${host}…`);

  // One statement, so a failure part-way through leaves nothing half-dropped.
  await db.execute(sql.raw(`DROP TABLE IF EXISTS ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE;`));

  for (const name of ENUMS) {
    await db.execute(sql.raw(`DROP TYPE IF EXISTS "${name}" CASCADE;`));
  }

  // Drizzle records applied migrations here; without it, a re-migrate is a no-op.
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

  console.log('Done. Now run: npm run db:migrate && npm run db:seed');
  await closeDb();
};

run().catch(async (err) => {
  console.error('Reset failed:', err);
  await closeDb();
  process.exit(1);
});
