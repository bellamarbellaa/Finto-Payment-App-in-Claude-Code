import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { fxRates } from '../../db/schema.js';
import { convertMinor } from '../../lib/money.js';
import { ApiError } from '../../lib/errors.js';

/**
 * FX rates come from the `fx_rates` table, refreshed by a provider job. Rates
 * are cached in memory for a minute — a payment quote must not depend on a
 * database round-trip, but it must also not use a stale rate from an hour ago.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { rate: string; asOf: Date; cachedAt: number }>();

export interface RateResult {
  base: string;
  quote: string;
  rate: string;
  asOf: Date;
  /** Convert minor units of `base` into minor units of `quote`. */
  convert: (amountMinor: bigint) => bigint;
}

export async function getRate(base: string, quote: string): Promise<RateResult> {
  const from = base.toUpperCase();
  const to = quote.toUpperCase();

  if (from === to) {
    return {
      base: from,
      quote: to,
      rate: '1',
      asOf: new Date(),
      convert: (amountMinor) => convertMinor(amountMinor, from, to, '1')
    };
  }

  const key = `${from}:${to}`;
  const hit = cache.get(key);

  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) {
    return {
      base: from,
      quote: to,
      rate: hit.rate,
      asOf: hit.asOf,
      convert: (amountMinor) => convertMinor(amountMinor, from, to, hit.rate)
    };
  }

  const direct = await db.query.fxRates.findFirst({
    where: and(eq(fxRates.base, from), eq(fxRates.quote, to))
  });

  if (direct) {
    cache.set(key, { rate: direct.rate, asOf: direct.asOf, cachedAt: Date.now() });
    return {
      base: from,
      quote: to,
      rate: direct.rate,
      asOf: direct.asOf,
      convert: (amountMinor) => convertMinor(amountMinor, from, to, direct.rate)
    };
  }

  // Fall back to the inverse of the stored pair before giving up.
  const inverse = await db.query.fxRates.findFirst({
    where: and(eq(fxRates.base, to), eq(fxRates.quote, from))
  });

  if (inverse) {
    const inverted = (1 / Number(inverse.rate)).toFixed(10);
    cache.set(key, { rate: inverted, asOf: inverse.asOf, cachedAt: Date.now() });
    return {
      base: from,
      quote: to,
      rate: inverted,
      asOf: inverse.asOf,
      convert: (amountMinor) => convertMinor(amountMinor, from, to, inverted)
    };
  }

  throw ApiError.unprocessable('currency_unsupported', `No exchange rate for ${from} to ${to}.`);
}

export function clearRateCache(): void {
  cache.clear();
}
