import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getRate } from './service.js';
import { money, parseAmount, SUPPORTED_CURRENCIES } from '../../lib/money.js';
import { ApiError } from '../../lib/errors.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', (req) => app.requireAuth(req));

  app.get('/currencies', async () => ({
    currencies: SUPPORTED_CURRENCIES.map((code) => ({ code }))
  }));

  app.get('/rate', async (req) => {
    const query = z
      .object({ from: z.string().length(3), to: z.string().length(3) })
      .parse(req.query);

    const result = await getRate(query.from, query.to);
    return { base: result.base, quote: result.quote, rate: result.rate, asOf: result.asOf };
  });

  /** Quote a conversion before committing to it — the design's Convert flow. */
  app.get('/quote', async (req) => {
    const query = z
      .object({ from: z.string().length(3), to: z.string().length(3), amount: z.string() })
      .parse(req.query);

    let amountMinor: bigint;
    try {
      amountMinor = parseAmount(query.amount, query.from);
    } catch (err) {
      throw ApiError.badRequest((err as Error).message);
    }

    if (amountMinor <= 0n) throw ApiError.badRequest('Enter an amount above zero');

    const rate = await getRate(query.from, query.to);
    const converted = rate.convert(amountMinor);

    return {
      from: money(amountMinor, rate.base),
      to: money(converted, rate.quote),
      rate: rate.rate,
      asOf: rate.asOf,
      // Finto charges nothing on the mid-market rate for the first tier.
      feeMinor: '0'
    };
  });
};

export default routes;
