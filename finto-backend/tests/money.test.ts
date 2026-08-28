import { describe, it, expect } from 'vitest';
import {
  parseAmount,
  toDecimalString,
  formatMoney,
  convertMinor,
  exponentOf
} from '../src/lib/money.js';

describe('parseAmount', () => {
  it('reads plain decimals into minor units', () => {
    expect(parseAmount('240', 'USD')).toBe(24000n);
    expect(parseAmount('240.5', 'USD')).toBe(24050n);
    expect(parseAmount('2450.80', 'USD')).toBe(245080n);
    expect(parseAmount('0.01', 'USD')).toBe(1n);
    expect(parseAmount('0', 'USD')).toBe(0n);
  });

  it('tolerates the separators a keypad or paste produces', () => {
    expect(parseAmount('1,240.50', 'USD')).toBe(124050n);
    expect(parseAmount(' 240 ', 'USD')).toBe(24000n);
  });

  it('respects per-currency exponents', () => {
    expect(exponentOf('JPY')).toBe(0);
    expect(parseAmount('1500', 'JPY')).toBe(1500n);
    expect(parseAmount('1.500', 'BHD')).toBe(1500n);
  });

  it('rejects more precision than the currency has', () => {
    expect(() => parseAmount('1.005', 'USD')).toThrow(/at most 2 decimal places/);
    expect(() => parseAmount('1.5', 'JPY')).toThrow();
  });

  it('rejects junk rather than coercing it to zero', () => {
    for (const bad of ['', '.', '-', 'abc', '1.2.3', '1e5', 'NaN']) {
      expect(() => parseAmount(bad, 'USD')).toThrow();
    }
  });

  it('survives amounts far beyond Number.MAX_SAFE_INTEGER', () => {
    const huge = '99999999999999999999.99';
    expect(toDecimalString(parseAmount(huge, 'USD'), 'USD')).toBe(huge);
  });
});

describe('float safety', () => {
  it('does not reproduce the 0.1 + 0.2 problem', () => {
    const sum = parseAmount('0.1', 'USD') + parseAmount('0.2', 'USD');
    expect(toDecimalString(sum, 'USD')).toBe('0.30');
    // The equivalent float arithmetic is the thing this design avoids.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('stays exact over a thousand additions', () => {
    let total = 0n;
    for (let i = 0; i < 1000; i++) total += parseAmount('0.07', 'USD');
    expect(toDecimalString(total, 'USD')).toBe('70.00');
  });
});

describe('formatMoney', () => {
  it('matches the strings the design renders', () => {
    expect(formatMoney(245080n, 'USD')).toBe('$2,450.80');
    expect(formatMoney(61240n, 'EUR')).toBe('€612.40');
    expect(formatMoney(0n, 'GBP')).toBe('£0.00');
    expect(formatMoney(182000n, 'USD', { signed: true })).toBe('+$1,820.00');
    expect(formatMoney(-4500n, 'USD')).toBe('−$45.00');
  });

  it('uses a real minus sign so columns align in tabular numerals', () => {
    expect(formatMoney(-100n, 'USD').startsWith('−')).toBe(true);
  });
});

describe('convertMinor', () => {
  it('converts between same-exponent currencies', () => {
    // $100.00 at 0.9210 -> €92.10
    expect(convertMinor(10000n, 'USD', 'EUR', '0.9210')).toBe(9210n);
  });

  it('crosses differing exponents', () => {
    // $100.00 at 151.20 -> ¥15,120 (JPY has no minor unit)
    expect(convertMinor(10000n, 'USD', 'JPY', '151.2000')).toBe(15120n);
  });

  it('rounds half-up on the absolute value, so sign does not change the result', () => {
    const positive = convertMinor(1n, 'USD', 'EUR', '0.5');
    const negative = convertMinor(-1n, 'USD', 'EUR', '0.5');
    expect(positive).toBe(1n);
    expect(negative).toBe(-1n);
  });

  it('is a no-op for the same currency', () => {
    expect(convertMinor(12345n, 'USD', 'USD', '0.9')).toBe(12345n);
  });
});
