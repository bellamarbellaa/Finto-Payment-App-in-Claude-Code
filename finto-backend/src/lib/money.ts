/**
 * Money is a bigint of minor units plus an ISO-4217 code. Nothing here returns
 * a Number, because 0.1 + 0.2 has no place near a balance.
 */

export interface Money {
  amountMinor: bigint;
  currency: string;
}

/** Minor units per major unit. Currencies not listed default to 2 decimals. */
const EXPONENTS: Record<string, number> = {
  BHD: 3, BIF: 0, CLP: 0, DJF: 0, GNF: 0, IQD: 3, ISK: 0, JOD: 3, JPY: 0,
  KMF: 0, KRW: 0, KWD: 3, LYD: 3, OMR: 3, PYG: 0, RWF: 0, TND: 3, UGX: 0,
  UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0
};

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CHF: 'CHF', AUD: 'A$', CAD: 'C$',
  SGD: 'S$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', RON: 'lei'
};

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'JPY',
  'SGD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'RON'
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function exponentOf(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

export function symbolOf(currency: string): string {
  return SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase() + ' ';
}

export function isSupported(currency: string): currency is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(currency.toUpperCase());
}

/**
 * Parse a decimal string ("240", "240.5", "1,240.50") into minor units.
 * Strings only — accepting a Number here would reintroduce float error at the
 * API boundary, which is exactly where it does the most damage.
 */
export function parseAmount(input: string, currency: string): bigint {
  const exp = exponentOf(currency);
  const cleaned = input.replace(/[\s,_]/g, '');

  if (!/^-?\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '-' || cleaned === '.') {
    throw new RangeError(`"${input}" is not a valid amount`);
  }

  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [whole = '0', fraction = ''] = unsigned.split('.');

  if (fraction.length > exp) {
    throw new RangeError(`${currency} supports at most ${exp} decimal places`);
  }

  const padded = fraction.padEnd(exp, '0');
  const minor = BigInt(whole || '0') * 10n ** BigInt(exp) + BigInt(padded || '0');
  return negative ? -minor : minor;
}

/** Minor units back to a plain decimal string: 245080n USD -> "2450.80". */
export function toDecimalString(amountMinor: bigint, currency: string): string {
  const exp = exponentOf(currency);
  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;
  const divisor = 10n ** BigInt(exp);
  const whole = abs / divisor;
  const fraction = abs % divisor;
  const body = exp === 0 ? `${whole}` : `${whole}.${fraction.toString().padStart(exp, '0')}`;
  return negative ? `-${body}` : body;
}

/**
 * Presentation string the clients render as-is: "$2,450.80", "−$45.00".
 * Formatting lives on the server so mobile and web never drift apart.
 */
export function formatMoney(
  amountMinor: bigint,
  currency: string,
  opts: { signed?: boolean; hideSymbol?: boolean } = {}
): string {
  const exp = exponentOf(currency);
  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;
  const divisor = 10n ** BigInt(exp);
  const whole = (abs / divisor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = exp === 0 ? '' : '.' + (abs % divisor).toString().padStart(exp, '0');
  const symbol = opts.hideSymbol ? '' : symbolOf(currency);

  // U+2212 minus, not a hyphen — it aligns with digits in tabular numerals.
  const sign = negative ? '−' : opts.signed ? '+' : '';
  return `${sign}${symbol}${whole}${fraction}`;
}

/** Serialised shape every money field takes in API responses. */
export interface MoneyDTO {
  amount: string;
  amountMinor: string;
  currency: string;
  formatted: string;
  symbol: string;
}

export function money(amountMinor: bigint, currency: string, signed = false): MoneyDTO {
  return {
    amount: toDecimalString(amountMinor, currency),
    amountMinor: amountMinor.toString(),
    currency,
    formatted: formatMoney(amountMinor, currency, { signed }),
    symbol: symbolOf(currency)
  };
}

/**
 * Convert between currencies. `rate` is a decimal string so it survives the
 * trip from NUMERIC without a float round-trip. Rounds half-up on the absolute
 * value, so rounding never depends on the sign.
 */
export function convertMinor(
  amountMinor: bigint,
  from: string,
  to: string,
  rate: string
): bigint {
  if (from.toUpperCase() === to.toUpperCase()) return amountMinor;

  const [rWhole = '0', rFraction = ''] = rate.split('.');
  const scale = BigInt(rFraction.length);
  const rateScaled = BigInt(rWhole + rFraction);

  const fromExp = BigInt(exponentOf(from));
  const toExp = BigInt(exponentOf(to));

  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;

  // abs * rate * 10^(toExp - fromExp), all in integer space.
  let numerator = abs * rateScaled;
  let denominator = 10n ** scale;

  if (toExp >= fromExp) numerator *= 10n ** (toExp - fromExp);
  else denominator *= 10n ** (fromExp - toExp);

  const rounded = (numerator + denominator / 2n) / denominator; // half-up
  return negative ? -rounded : rounded;
}

export function assertSameCurrency(a: string, b: string): void {
  if (a.toUpperCase() !== b.toUpperCase()) {
    throw new Error(`Currency mismatch: ${a} vs ${b}`);
  }
}
