import 'dotenv/config';
import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/finto';
const host = new URL(url).hostname;
const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    // Managed Postgres (Supabase, Neon, RDS) refuses plaintext connections.
    // Mirrors the rule in src/db/client.ts so migrations and the app agree.
    ssl: isLocal ? false : { rejectUnauthorized: false }
  },
  strict: true,
  verbose: true
} satisfies Config;
