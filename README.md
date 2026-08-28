# Finto

A multi-currency banking app — design, API and two front ends.

Started as a clickable prototype, then built out into a working product: a
Node/TypeScript backend with a double-entry ledger, a React web app, and a React
Native app for iOS and Android. All three share one API and one set of types.

<br>

| | |
|---|---|
| **Design** | Original UI design, 15 screens |
| **Backend** | TypeScript · Fastify · PostgreSQL · Drizzle ORM |
| **Web** | React 19 · Vite · React Router |
| **Mobile** | React Native · Expo SDK 54 · expo-router |
| **Database** | Supabase (PostgreSQL 17) |
| **Tests** | 53, covering money arithmetic, ledger integrity and the API |

<br>

---

## What it does

Sign in · hold balances in 14 currencies · send money to a contact or a
`@handle` · request money with a shareable QR code · scan a code to pay it ·
browse a filterable, searchable activity feed · freeze a card, set a monthly
limit, toggle online and abroad payments · receive live notifications.

Payments between two Finto users settle instantly. Everything updates across
every open device the moment it happens.

---

## Three decisions worth explaining

### Money is never a floating-point number

`0.1 + 0.2` is `0.30000000000000004` in binary floating point. On a balance,
that error compounds silently.

Every amount is a `BIGINT` of minor units — cents — with an explicit ISO-4217
currency. Amounts cross the API as decimal *strings*, so nothing is lost at the
boundary either. There is a test asserting a thousand additions of `0.07` come
to exactly `70.00`.

```ts
parseAmount('240.50', 'USD')   // 24050n
formatMoney(24050n, 'USD')     // "$240.50"
```

### The ledger is the source of truth, not the balance column

Every movement writes balanced double-entry records that must sum to zero per
currency. If any part fails, the whole transaction rolls back — there is no such
thing as a half-completed payment.

`accounts.balance_minor` is a cache, written only inside the same database
transaction as the entries, with the affected rows locked `FOR UPDATE` in a
deterministic order. That ordering is what stops two simultaneous transfers
between the same pair of accounts from deadlocking.

The test that matters: **ten concurrent payments of $100 against a $500 balance —
exactly five succeed**, and the books still balance to zero.

### Retrying a payment is safe

Phones lose signal mid-request constantly. Every money-moving endpoint accepts an
`Idempotency-Key`; a repeat returns the original response with
`Idempotent-Replay: true` rather than charging twice. A key reused with a
*different* body is rejected outright, because that is a bug rather than a retry.

---

## How the pieces fit

```
                    ┌──────────────┐
                    │   Supabase   │   PostgreSQL 17
                    └──────▲───────┘
                           │
                    ┌──────┴───────┐
                    │     API      │   Fastify · double-entry ledger
                    │  REST + WS   │   JWT auth · rate limiting
                    └──▲────────▲──┘
            REST + WS  │        │  REST + WS
                ┌──────┘        └──────┐
         ┌──────┴──────┐        ┌──────┴──────┐
         │   Web app   │        │ Mobile app  │
         │  React 19   │        │ React Native│
         └─────────────┘        └─────────────┘
                └──── @finto/api-client ────┘
                     shared types + client
```

One typed client serves both front ends, so a change to an endpoint surfaces as
a type error in both apps immediately.

**Money is formatted on the server**, not in either client. Each transaction
arrives with its display string (`"−$240.00"`), colour and meta line already
resolved. Two clients cannot drift apart when neither is doing the formatting.

---

## Security

- **scrypt password hashing** via Node's own crypto — no native module to fail at
  install time. Unknown emails and wrong passwords take the same time to answer,
  so the endpoint does not reveal who banks here.
- **Rotating refresh tokens.** Presenting an already-consumed token means it
  leaked, so every session for that user is revoked rather than quietly issuing a
  new pair.
- **Tokens are stored per platform.** Web uses an `httpOnly` cookie a page script
  cannot read; mobile uses the device keychain.
- **PIN unlock issues a reduced-scope token** — enough to browse balances, not
  enough to move money or change security settings.
- **Card numbers are never stored.** Only the last four digits and a processor
  token. Revealing a number hands the client a 60-second token it exchanges
  directly with the card processor, so a PAN never touches this server or its
  logs — which is what keeps the service outside PCI-DSS scope.

---

## Running it

Needs Node 20+ and PostgreSQL (or a Supabase connection string).

```bash
# API
cd finto-backend
npm install
cp .env.example .env      # fill in the secrets — the file explains each one
npm run db:migrate
npm run db:seed
npm run dev               # → localhost:4000

# Web
cd finto-web && npm install && npm run dev        # → localhost:5173

# Mobile
cd finto-mobile && npm install && npx expo start  # scan with Expo Go
```

Seeded accounts: `sofia@marengo.studio` / `sofia2026-finto`, and
`alessia@moretti.co` / `alessia2026-finto` — so transfers between two real
accounts can be tested.

[START-HERE.md](START-HERE.md) has the day-to-day version and troubleshooting.

---

## Tests

```bash
cd finto-backend && npm test
```

53 tests: money parsing and precision at the boundaries, formatting,
cross-currency conversion, password hashing, ledger integrity under concurrency,
auth and token rotation, idempotent replay, the QR request-and-pay loop, activity
filtering and pagination, and card controls.

---

## What is deliberately not finished

Stated plainly, because a portfolio piece that overclaims is worse than one that
doesn't:

- **Payment rails are stubbed.** Finto-to-Finto transfers are real and settle
  instantly. Outbound transfers debit the sender and sit `pending` against a
  settlement account until a webhook confirms — the webhook and its HMAC
  verification are implemented; the rail itself is not connected.
- **Card issuing is a stand-in.** The seam where a real processor plugs in is
  marked in the code.
- **Push notifications** are stored and delivered over WebSocket, which covers
  the app being open. APNs/FCM is a single unimplemented function.
- **Exchange rates** are served from a table with a short cache; the job that
  refreshes them from a provider is not written.
- **Regulatory work is absent and not optional** — KYC, sanctions screening,
  transaction monitoring, and a licence or banking partner. That is a legal and
  operational programme, not code.

The money handling underneath is built properly. The bank around it is not a
thing a repository can contain.

---

## Layout

```
finto-backend/     API, ledger, database schema, tests
  src/ledger/      the double-entry posting engine
  src/modules/     one folder per domain: auth, payments, cards, …
  packages/api-client/   typed client shared by both front ends
finto-web/         React web app
finto-mobile/      React Native app (iOS + Android)
```

The one file worth reading is
[`finto-backend/src/ledger/ledger.ts`](finto-backend/src/ledger/ledger.ts) —
everything about how money moves is in there.
