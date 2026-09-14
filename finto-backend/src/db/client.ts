import pg from 'pg';
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { env } from '../env.js';

/**
 * node-postgres parses BIGINT (oid 20) as a string by default to avoid silent
 * precision loss. We want real bigints all the way through, so parse them here
 * once instead of sprinkling BigInt() through the query layer.
 */
pg.types.setTypeParser(20, (value) => BigInt(value));

/**
 * Managed Postgres requires TLS; a local socket does not. Rather than making
 * every developer remember a flag, the default is decided by the host.
 */
function sslConfig(): pg.ConnectionConfig['ssl'] {
  const host = new URL(env.DATABASE_URL).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  const mode =
    env.DATABASE_SSL === 'auto' ? (isLocal ? 'disable' : 'require') : env.DATABASE_SSL;

  if (mode === 'disable') return false;

  if (env.DATABASE_CA_CERT) {
    return {
      ca: readFileSync(env.DATABASE_CA_CERT, 'utf8'),
      rejectUnauthorized: true
    };
  }

  // Encrypted, but the certificate is not verified against a trust chain.
  // Fine for development; see DATABASE_CA_CERT before production.
  return { rejectUnauthorized: false };
}

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslConfig(),
  // A hosted database is further away and caps connections far lower than a
  // local one, so the pool stays small and waits longer to connect.
  max: env.isTest ? 5 : env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 20_000,
  application_name: 'finto-api'
});

pool.on('error', (err) => {
  // A dead idle client must not take the process down.
  console.error('[db] idle client error', err);
});

export const db = drizzle(pool, { schema, casing: 'snake_case' });

export type Database = typeof db;
/** The type of `tx` inside db.transaction(...) — services accept either. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export async function closeDb(): Promise<void> {
  await pool.end();
}
