import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { closeDb, db } from '../src/db/client.js';
import { accounts, contacts, users } from '../src/db/schema.js';
import { hashSecret } from '../src/lib/crypto.js';
import { resetDatabase, ledgerNet } from './helpers.js';
import { sql } from 'drizzle-orm';
import { parseAmount } from '../src/lib/money.js';

let app: FastifyInstance;
let sofiaToken: string;
let sofiaId: string;
let alessiaId: string;

const PASSWORD = 'test-password-1234';

async function seedTwoUsers() {
  const [settlement] = await db
    .insert(users)
    .values({
      email: 'settlement@finto.internal',
      fullName: 'Finto Settlement',
      displayName: 'Finto',
      handle: '@finto.settlement',
      passwordHash: await hashSecret('never-used-' + Date.now()),
      status: 'suspended'
    })
    .returning();

  await db.insert(accounts).values({
    userId: settlement!.id,
    name: 'Settlement · USD',
    currency: 'USD',
    kind: 'main',
    ibanMasked: 'XX** **** 0000'
  });

  const [sofia] = await db
    .insert(users)
    .values({
      email: 'sofia@test.finto',
      fullName: 'Sofia Marengo',
      displayName: 'Sofia',
      handle: '@sofia',
      passwordHash: await hashSecret(PASSWORD),
      confirmPayments: false // keep the payment tests focused on the money path
    })
    .returning();

  const [sofiaAccount] = await db
    .insert(accounts)
    .values({
      userId: sofia!.id,
      name: 'Main · USD',
      currency: 'USD',
      kind: 'main',
      ibanMasked: 'US** **** 4429',
      isPrimary: true
    })
    .returning();

  await db
    .update(accounts)
    .set({ balanceMinor: parseAmount('2450.80', 'USD'), availableMinor: parseAmount('2450.80', 'USD') })
    .where(sql`${accounts.id} = ${sofiaAccount!.id}`);

  const [alessia] = await db
    .insert(users)
    .values({
      email: 'alessia@test.finto',
      fullName: 'Alessia Moretti',
      displayName: 'Alessia',
      handle: '@alessia',
      passwordHash: await hashSecret(PASSWORD)
    })
    .returning();

  await db.insert(accounts).values({
    userId: alessia!.id,
    name: 'Main · USD',
    currency: 'USD',
    kind: 'main',
    ibanMasked: 'IT** **** 7741',
    isPrimary: true
  });

  await db.insert(contacts).values({
    userId: sofia!.id,
    contactUserId: alessia!.id,
    name: 'Alessia Moretti',
    handle: '@alessia',
    tint: 'lime'
  });

  return { sofiaId: sofia!.id, alessiaId: alessia!.id };
}

beforeAll(async () => {
  await resetDatabase();
  const ids = await seedTwoUsers();
  sofiaId = ids.sofiaId;
  alessiaId = ids.alessiaId;

  app = await buildApp();
  await app.ready();

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { identifier: 'sofia@test.finto', password: PASSWORD }
  });

  sofiaToken = res.json().accessToken;
});

afterAll(async () => {
  await app.close();
  await closeDb();
});

const authed = (token = sofiaToken) => ({ authorization: `Bearer ${token}` });

describe('auth', () => {
  it('signs in and returns a usable token pair', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'sofia@test.finto', password: PASSWORD }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.handle).toBe('@sofia');
    // The hash must never leave the server.
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('sets an httpOnly refresh cookie for browser clients', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'sofia@test.finto', password: PASSWORD }
    });

    const cookie = res.cookies.find((c) => c.name === 'finto_refresh');
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
  });

  it('rejects a wrong password without revealing which part was wrong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'sofia@test.finto', password: 'not-the-password' }
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('invalid_credentials');
    expect(res.json().error.message).toBe('That email or password is not right.');
  });

  it('gives an unknown email the same answer as a wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'nobody@test.finto', password: 'whatever-1234' }
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('That email or password is not right.');
  });

  it('rotates the refresh token and kills every session if an old one is replayed', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'alessia@test.finto', password: PASSWORD }
    });
    const original = login.json().refreshToken;

    const first = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: original }
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().refreshToken).not.toBe(original);

    // Replaying the consumed token is treated as a leak, not a retry.
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: original }
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe('token_reused');
  });

  it('refuses every protected route without a token', async () => {
    for (const url of ['/v1/accounts', '/v1/transactions', '/v1/cards', '/v1/users/me']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(401);
    }
  });
});

describe('accounts', () => {
  it('returns balances as strings, never as floats', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/accounts', headers: authed() });
    expect(res.statusCode).toBe(200);

    const account = res.json().accounts[0];
    expect(account.balance.formatted).toBe('$2,450.80');
    expect(account.balance.amountMinor).toBe('245080');
    expect(typeof account.balance.amountMinor).toBe('string');
  });

  it("will not show another user's account", async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'alessia@test.finto', password: PASSWORD }
    });

    const sofiaAccounts = await app.inject({ method: 'GET', url: '/v1/accounts', headers: authed() });
    const sofiaAccountId = sofiaAccounts.json().accounts[0].id;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/accounts/${sofiaAccountId}`,
      headers: { authorization: `Bearer ${login.json().accessToken}` }
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('payments', () => {
  it('quotes an affordable amount and flags one that is not', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/v1/payments/quote',
      headers: authed(),
      payload: { amount: '240' }
    });
    expect(ok.json().sufficient).toBe(true);
    expect(ok.json().warning).toBeNull();

    const over = await app.inject({
      method: 'POST',
      url: '/v1/payments/quote',
      headers: authed(),
      payload: { amount: '99999' }
    });
    expect(over.json().sufficient).toBe(false);
    expect(over.json().warning).toBe('Above your available balance');
  });

  it('sends money and credits the recipient in the same movement', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/payments/send',
      headers: { ...authed(), 'idempotency-key': 'test-send-1' },
      payload: { handle: '@alessia', amount: '240', note: 'Design work' }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.transaction.display.amount).toBe('−$240.00');
    expect(body.transaction.status).toBe('completed');
    expect(body.balanceAfter.formatted).toBe('$2,210.80');
    expect(await ledgerNet('USD')).toBe(0n);
  });

  it('replays an identical request instead of charging twice', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/v1/payments/send',
      headers: { ...authed(), 'idempotency-key': 'test-idem-2' },
      payload: { handle: '@alessia', amount: '10' }
    });

    const second = await app.inject({
      method: 'POST',
      url: '/v1/payments/send',
      headers: { ...authed(), 'idempotency-key': 'test-idem-2' },
      payload: { handle: '@alessia', amount: '10' }
    });

    expect(first.json().transaction.reference).toBe(second.json().transaction.reference);
    expect(second.headers['idempotent-replay']).toBe('true');

    const balances = await app.inject({ method: 'GET', url: '/v1/accounts', headers: authed() });
    expect(balances.json().accounts[0].balance.formatted).toBe('$2,200.80');
  });

  it('rejects a reused key carrying a different body', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/payments/send',
      headers: { ...authed(), 'idempotency-key': 'test-idem-3' },
      payload: { handle: '@alessia', amount: '1' }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/payments/send',
      headers: { ...authed(), 'idempotency-key': 'test-idem-3' },
      payload: { handle: '@alessia', amount: '500' }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('idempotency_conflict');
  });

  it('refuses to send more than the balance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/payments/send',
      headers: { ...authed(), 'idempotency-key': 'test-over-1' },
      payload: { handle: '@alessia', amount: '999999' }
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('insufficient_funds');
  });

  it('refuses a negative or zero amount', async () => {
    for (const amount of ['0', '-50']) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/payments/send',
        headers: { ...authed(), 'idempotency-key': `test-neg-${amount}` },
        payload: { handle: '@alessia', amount }
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it('will not let a user pay themselves', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/payments/send',
      headers: { ...authed(), 'idempotency-key': 'test-self-1' },
      payload: { handle: '@sofia', amount: '10' }
    });

    expect(res.statusCode).toBe(400);
  });

  it('runs the request → QR → pay loop', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/payments/requests',
      headers: authed(),
      payload: { amount: '85', note: 'Dinner' }
    });

    expect(created.statusCode).toBe(201);
    const request = created.json().request;
    expect(request.shareUrl).toContain('/pay/');
    expect(request.deepLink).toMatch(/^finto:\/\/pay\//);

    const alessiaLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: 'alessia@test.finto', password: PASSWORD }
    });
    const alessiaToken = alessiaLogin.json().accessToken;

    // The scanner hands over whatever the camera read.
    const scanned = await app.inject({
      method: 'POST',
      url: '/v1/payments/scan',
      headers: authed(alessiaToken),
      payload: { payload: request.deepLink }
    });

    expect(scanned.statusCode).toBe(200);
    expect(scanned.json().request.amount.formatted).toBe('$85.00');
    expect(scanned.json().request.requester.handle).toBe('@sofia');

    const paid = await app.inject({
      method: 'POST',
      url: `/v1/payments/requests/by-token/${request.linkToken}/pay`,
      headers: { ...authed(alessiaToken), 'idempotency-key': 'test-payreq-1' },
      payload: {}
    });

    expect(paid.statusCode).toBe(201);
    expect(await ledgerNet('USD')).toBe(0n);

    // Paying it twice must not work.
    const again = await app.inject({
      method: 'POST',
      url: `/v1/payments/requests/by-token/${request.linkToken}/pay`,
      headers: { ...authed(alessiaToken), 'idempotency-key': 'test-payreq-2' },
      payload: {}
    });
    expect(again.statusCode).toBe(409);
  });
});

describe('transactions', () => {
  it('groups the feed by day the way the Activity screen renders it', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/transactions?limit=20',
      headers: authed()
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.groups)).toBe(true);

    for (const group of body.groups) {
      expect(group.label).toMatch(/^[A-Z][a-z]{2} \d{2}$/);
      expect(group.total).toMatch(/^[+−]/);
      // A group's total must be in one currency, never a mixed sum.
      for (const item of group.items) {
        expect(item.amount.currency).toBe(group.currency);
      }
    }
  });

  it('filters to income and to spending', async () => {
    const income = await app.inject({
      method: 'GET',
      url: '/v1/transactions?filter=income&grouped=false',
      headers: authed()
    });

    for (const t of income.json().transactions) {
      expect(t.direction).toBe('in');
    }

    const spending = await app.inject({
      method: 'GET',
      url: '/v1/transactions?filter=spending&grouped=false',
      headers: authed()
    });

    for (const t of spending.json().transactions) {
      expect(t.direction).toBe('out');
    }
  });

  it('paginates without repeating a row', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/v1/transactions?limit=2&grouped=false',
      headers: authed()
    });

    const body = first.json();
    if (!body.nextCursor) return; // too few rows to page

    const second = await app.inject({
      method: 'GET',
      url: `/v1/transactions?limit=2&grouped=false&cursor=${encodeURIComponent(body.nextCursor)}`,
      headers: authed()
    });

    const firstIds = body.transactions.map((t: { id: string }) => t.id);
    const secondIds = second.json().transactions.map((t: { id: string }) => t.id);

    expect(firstIds.filter((id: string) => secondIds.includes(id))).toHaveLength(0);
  });

  it('searches by counterparty name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/transactions?q=alessia&grouped=false',
      headers: authed()
    });

    expect(res.statusCode).toBe(200);
    for (const t of res.json().transactions) {
      expect(t.counterparty.name.toLowerCase()).toContain('alessia');
    }
  });
});

describe('cards', () => {
  it('never returns a full card number', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/cards',
      headers: authed(),
      payload: { holderName: 'SOFIA MARENGO', kind: 'virtual' }
    });

    expect(created.statusCode).toBe(201);
    const card = created.json().card;

    expect(card.maskedNumber).toMatch(/^•••• •••• •••• \d{4}$/);
    expect(card.last4).toHaveLength(4);
    // Nothing resembling a PAN anywhere in the payload.
    expect(JSON.stringify(card)).not.toMatch(/\d{13,19}/);
    expect(JSON.stringify(card)).not.toContain('processorCardId');
  });

  it('freezes and unfreezes', async () => {
    const list = await app.inject({ method: 'GET', url: '/v1/cards', headers: authed() });
    const cardId = list.json().cards[0].id;

    const frozen = await app.inject({
      method: 'POST',
      url: `/v1/cards/${cardId}/freeze`,
      headers: authed(),
      payload: { frozen: true }
    });
    expect(frozen.json().card.state).toBe('frozen');

    const thawed = await app.inject({
      method: 'POST',
      url: `/v1/cards/${cardId}/freeze`,
      headers: authed(),
      payload: { frozen: false }
    });
    expect(thawed.json().card.state).toBe('active');
  });

  it('stores a spending limit exactly', async () => {
    const list = await app.inject({ method: 'GET', url: '/v1/cards', headers: authed() });
    const cardId = list.json().cards[0].id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/cards/${cardId}/controls`,
      headers: authed(),
      payload: { monthlyLimit: '1500.50', paymentsAbroad: true }
    });

    expect(res.json().card.controls.monthlyLimit.formatted).toBe('$1,500.50');
    expect(res.json().card.controls.paymentsAbroad).toBe(true);
  });
});

describe('error handling', () => {
  it('answers an unknown route with a structured error', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/nothing-here', headers: authed() });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });

  it('reports validation problems field by field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'not-an-email', password: 'short', fullName: 'X' }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_error');
    expect(res.json().error.details.length).toBeGreaterThan(0);
  });
});
