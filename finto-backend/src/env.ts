import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  /**
   * 'auto' (the default) turns TLS on for every host except localhost.
   * Managed Postgres — Supabase, Neon, RDS — always requires it.
   */
  DATABASE_SSL: z.enum(['auto', 'require', 'disable']).default('auto'),
  /**
   * Path to a CA certificate in PEM form. With one set, the server's
   * certificate is fully verified. Without it, the connection is still
   * encrypted but the certificate is not checked against a trust chain —
   * which protects the data in transit but not against an active
   * man-in-the-middle. Supabase publishes its CA in the dashboard under
   * Settings → Database → SSL Configuration; download it and point here
   * before going anywhere near real money.
   */
  DATABASE_CA_CERT: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGINS: z.string().default(''),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  APP_LINK_SCHEME: z.string().default('finto'),

  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true')
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test'
};

export type Env = typeof env;
