import { describe, it, expect } from 'vitest';
import { hashSecret, verifySecret, transactionReference, sha256 } from '../src/lib/crypto.js';

describe('password hashing', () => {
  it('verifies a correct secret and rejects a wrong one', async () => {
    const hash = await hashSecret('sofia2026-finto');
    expect(await verifySecret('sofia2026-finto', hash)).toBe(true);
    expect(await verifySecret('sofia2026-fintO', hash)).toBe(false);
    expect(await verifySecret('', hash)).toBe(false);
  });

  it('salts, so the same password never produces the same hash', async () => {
    const a = await hashSecret('same-password-twice');
    const b = await hashSecret('same-password-twice');
    expect(a).not.toBe(b);
    expect(await verifySecret('same-password-twice', b)).toBe(true);
  });

  it('never stores the password in the hash string', async () => {
    const hash = await hashSecret('correct-horse-battery');
    expect(hash).not.toContain('correct-horse-battery');
  });

  it('returns false rather than throwing on a malformed hash', async () => {
    for (const bad of ['', 'nonsense', 'scrypt$$$$', 'bcrypt$1$2$3$4$5']) {
      expect(await verifySecret('anything', bad)).toBe(false);
    }
  });
});

describe('transactionReference', () => {
  it('matches the FT-0000-0000 shape the app displays', () => {
    expect(transactionReference()).toMatch(/^FT-\d{4}-\d{4}$/);
  });

  it('does not collide across a realistic batch', () => {
    const refs = new Set(Array.from({ length: 5000 }, transactionReference));
    // Birthday collisions are possible in 10^8 space; a handful is fine, a pile is not.
    expect(refs.size).toBeGreaterThan(4990);
  });
});

describe('sha256', () => {
  it('is stable and hex encoded', () => {
    expect(sha256('finto')).toBe(sha256('finto'));
    expect(sha256('finto')).toMatch(/^[0-9a-f]{64}$/);
  });
});
