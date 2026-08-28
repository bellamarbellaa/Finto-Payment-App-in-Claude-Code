import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db, closeDb } from '../src/db/client.js';
import { post, recomputeBalance, reverse } from '../src/ledger/ledger.js';
import { ApiError } from '../src/lib/errors.js';
import { balanceOf, ledgerNet, makeUser, resetDatabase } from './helpers.js';

describe('double-entry ledger', () => {
  beforeAll(resetDatabase);
  afterAll(closeDb);
  beforeEach(resetDatabase);

  it('moves money between two accounts and leaves the books balanced', async () => {
    const alice = await makeUser({ balance: '1000.00' });
    const bob = await makeUser({ balance: '0.00' });

    await db.transaction(async (tx) =>
      post(tx, {
        lines: [
          { accountId: alice.account.id, amountMinor: -25000n, currency: 'USD' },
          { accountId: bob.account.id, amountMinor: 25000n, currency: 'USD' }
        ],
        transaction: {
          userId: alice.user.id,
          accountId: alice.account.id,
          type: 'payment_out',
          amountMinor: -25000n,
          currency: 'USD',
          counterpartyName: 'Bob'
        }
      })
    );

    expect(await balanceOf(alice.account.id)).toBe(75000n);
    expect(await balanceOf(bob.account.id)).toBe(25000n);
    expect(await ledgerNet('USD')).toBe(0n);
  });

  it('refuses a posting that would overdraw the account', async () => {
    const alice = await makeUser({ balance: '10.00' });
    const bob = await makeUser({ balance: '0.00' });

    await expect(
      db.transaction(async (tx) =>
        post(tx, {
          lines: [
            { accountId: alice.account.id, amountMinor: -100000n, currency: 'USD' },
            { accountId: bob.account.id, amountMinor: 100000n, currency: 'USD' }
          ],
          transaction: {
            userId: alice.user.id,
            accountId: alice.account.id,
            type: 'payment_out',
            amountMinor: -100000n,
            currency: 'USD',
            counterpartyName: 'Bob'
          }
        })
      )
    ).rejects.toMatchObject({ code: 'insufficient_funds' });

    // Nothing at all should have been written.
    expect(await balanceOf(alice.account.id)).toBe(1000n);
    expect(await balanceOf(bob.account.id)).toBe(0n);
    expect(await ledgerNet('USD')).toBe(0n);
  });

  it('rejects an unbalanced posting outright', async () => {
    const alice = await makeUser({ balance: '100.00' });
    const bob = await makeUser({ balance: '0.00' });

    await expect(
      db.transaction(async (tx) =>
        post(tx, {
          lines: [
            { accountId: alice.account.id, amountMinor: -5000n, currency: 'USD' },
            { accountId: bob.account.id, amountMinor: 4000n, currency: 'USD' } // 10.00 vanishes
          ],
          transaction: {
            userId: alice.user.id,
            accountId: alice.account.id,
            type: 'payment_out',
            amountMinor: -5000n,
            currency: 'USD',
            counterpartyName: 'Bob'
          }
        })
      )
    ).rejects.toThrow(/Unbalanced posting/);
  });

  it('keeps the cached balance equal to the recomputed ledger balance', async () => {
    const alice = await makeUser({ balance: '500.00' });
    const bob = await makeUser({ balance: '0.00' });

    for (let i = 0; i < 10; i++) {
      await db.transaction(async (tx) =>
        post(tx, {
          lines: [
            { accountId: alice.account.id, amountMinor: -1111n, currency: 'USD' },
            { accountId: bob.account.id, amountMinor: 1111n, currency: 'USD' }
          ],
          transaction: {
            userId: alice.user.id,
            accountId: alice.account.id,
            type: 'payment_out',
            amountMinor: -1111n,
            currency: 'USD',
            counterpartyName: 'Bob'
          }
        })
      );
    }

    // The seeded opening balance is not a ledger entry, so compare the delta.
    const recomputed = await recomputeBalance(db, bob.account.id);
    expect(recomputed).toBe(11110n);
    expect(await balanceOf(bob.account.id)).toBe(11110n);
  });

  it('survives concurrent payments from one account without overdrawing', async () => {
    // The real test of the FOR UPDATE lock: ten simultaneous payments of 100.00
    // against a 500.00 balance. Exactly five must succeed.
    const alice = await makeUser({ balance: '500.00' });
    const bob = await makeUser({ balance: '0.00' });

    const attempts = Array.from({ length: 10 }, () =>
      db
        .transaction(async (tx) =>
          post(tx, {
            lines: [
              { accountId: alice.account.id, amountMinor: -10000n, currency: 'USD' },
              { accountId: bob.account.id, amountMinor: 10000n, currency: 'USD' }
            ],
            transaction: {
              userId: alice.user.id,
              accountId: alice.account.id,
              type: 'payment_out',
              amountMinor: -10000n,
              currency: 'USD',
              counterpartyName: 'Bob'
            }
          })
        )
        .then(() => 'ok' as const)
        .catch(() => 'rejected' as const)
    );

    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => r === 'ok').length;

    expect(succeeded).toBe(5);
    expect(await balanceOf(alice.account.id)).toBe(0n);
    expect(await balanceOf(bob.account.id)).toBe(50000n);
    expect(await ledgerNet('USD')).toBe(0n);
  });

  it('reverses a transaction into a mirrored posting', async () => {
    const alice = await makeUser({ balance: '300.00' });
    const bob = await makeUser({ balance: '0.00' });

    const result = await db.transaction(async (tx) =>
      post(tx, {
        lines: [
          { accountId: alice.account.id, amountMinor: -12500n, currency: 'USD' },
          { accountId: bob.account.id, amountMinor: 12500n, currency: 'USD' }
        ],
        transaction: {
          userId: alice.user.id,
          accountId: alice.account.id,
          type: 'payment_out',
          amountMinor: -12500n,
          currency: 'USD',
          counterpartyName: 'Bob'
        }
      })
    );

    await db.transaction(async (tx) => reverse(tx, result.transactionId, 'Disputed by sender'));

    expect(await balanceOf(alice.account.id)).toBe(30000n);
    expect(await balanceOf(bob.account.id)).toBe(0n);
    expect(await ledgerNet('USD')).toBe(0n);
  });

  it('will not post into an account of the wrong currency', async () => {
    const alice = await makeUser({ balance: '100.00', currency: 'USD' });
    const bob = await makeUser({ balance: '0.00', currency: 'EUR' });

    await expect(
      db.transaction(async (tx) =>
        post(tx, {
          lines: [
            { accountId: alice.account.id, amountMinor: -1000n, currency: 'USD' },
            { accountId: bob.account.id, amountMinor: 1000n, currency: 'USD' }
          ],
          transaction: {
            userId: alice.user.id,
            accountId: alice.account.id,
            type: 'payment_out',
            amountMinor: -1000n,
            currency: 'USD',
            counterpartyName: 'Bob'
          }
        })
      )
    ).rejects.toBeInstanceOf(ApiError);
  });
});
