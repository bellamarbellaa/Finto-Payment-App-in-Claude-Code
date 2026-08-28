# Finto Backend — User Guide

This is the server behind your Finto app designs. It holds the real accounts,
balances, payments, cards and notifications, and serves them to both your mobile
app and your desktop web app from one place.

This guide walks you through it from nothing to a working API you can call.

**Contents**

1. [What you're getting](#1-what-youre-getting)
2. [Before you start](#2-before-you-start)
3. [Setup, step by step](#3-setup-step-by-step)
4. [Check that it works](#4-check-that-it-works)
5. [Take it for a drive](#5-take-it-for-a-drive)
6. [Calling it from your app](#6-calling-it-from-your-app)
7. [Connecting your Finto design](#7-connecting-your-finto-design)
8. [Everyday commands](#8-everyday-commands)
9. [When something goes wrong](#9-when-something-goes-wrong)
10. [Full API reference](#10-full-api-reference)
11. [Before you go live](#11-before-you-go-live)

---

## 1. What you're getting

A complete banking API. Every screen in your design has endpoints behind it:

| Your screen | What the API gives it |
|---|---|
| Login / PIN unlock | Password login, PIN unlock, biometric flag, session management |
| Home ("Total balance") | All balances, plus a total converted to one currency |
| Accounts | Multi-currency balances, opening new ones, statements |
| Pay → pick person → amount | Contact search, affordability quote, sending money |
| Request / QR scan | Payment requests with a shareable link and QR payload |
| Activity | Filtered, searchable, day-grouped transaction feed |
| Transaction detail | Full record with reference, status and category |
| Cards | Freeze, spending limits, online/abroad/contactless toggles |
| Notifications | Feed, unread count, live push |
| Profile / Security | Face ID and "confirm payments" toggles, password change |
| Help | FAQ and support tickets |

It is **one API for both platforms**. The mobile app and the desktop web app
call the same endpoints and get the same data — there is no separate web
backend to keep in sync.

### The important part

This handles real money, so three things work differently from a normal CRUD app:

**Amounts are never floating-point numbers.** In JavaScript, `0.1 + 0.2` is
`0.30000000000000004`. On a balance, that is a bug that compounds. Every amount
here is stored as a whole number of cents and sent as a *string*, so nothing is
ever lost to rounding.

**Money moves through a double-entry ledger.** Every payment writes matched
debit and credit records that must sum to zero. If any part fails, the whole
thing is rolled back — there is no such thing as a half-completed payment. The
account balance you see is a cache; the ledger is the truth, and you can always
recompute one from the other.

**Retrying a payment is safe.** Phones lose signal mid-request all the time. If
your app retries a payment, the server recognises it and returns the original
result instead of charging twice.

---

## 2. Before you start

You need two things installed.

### Node.js 20 or newer

Check what you have:

```bash
node --version
```

If it prints `v20.x` or higher, you're set. If not, install it from
[nodejs.org](https://nodejs.org) or with Homebrew:

```bash
brew install node
```

### PostgreSQL 14 or newer

This is the database. Check for it:

```bash
psql --version
```

If it's missing, install and start it:

```bash
brew install postgresql@15
brew services start postgresql@15
```

`brew services start` makes it run in the background and start again when you
reboot, so this is a one-time step.

Confirm it's accepting connections:

```bash
pg_isready
```

You want to see `accepting connections`. If you see `no response`, the service
isn't running — run the `brew services start` line above.

> **On this machine, both are already installed and PostgreSQL is running.** You
> can skip straight to the next section.

---

## 3. Setup, step by step

Everything in this section is typed into the **Terminal** app — none of it goes
inside a file. Open Terminal and move into the project folder first:

```bash
cd "/Users/marbellaelpantja/Documents/Finto Mobile App Designs Clickable/finto-backend"
```

Every command below runs from there.

> ### Steps 1–6 are already done on this machine
>
> Dependencies are installed, `.env` exists with real generated secrets, the
> `finto` database is created, the tables are built and Sofia's data is loaded.
> **Jump straight to [step 7](#step-7--start-the-server).** The steps are written
> out anyway so you can set this up again on another machine.

### Step 1 — Install the dependencies

```bash
npm install
```

Takes a minute or two. It creates a `node_modules` folder you never need to
touch.

### Step 2 — Create your settings file

The server reads its configuration — database address, secret keys — from a file
called `.env`. This command copies the supplied template into a new file of that
name:

```bash
cp .env.example .env
```

**Note that `.env` is a hidden file.** Anything starting with a dot is hidden by
macOS, so it will not appear in Finder. To see it, open the folder in Finder and
press `⌘ + Shift + .` — press it again to re-hide. To read it in Terminal:

```bash
cat .env
```

### Step 3 — Generate your secret keys

The `.env` file needs three long random secrets. These sign your login tokens;
anyone who knows them could forge a login, so they must be random and private.

Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Run it three times and paste each result into `.env`, replacing the
`replace-me-…` placeholders for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and
`COOKIE_SECRET`. Use a **different** value for each.

While you're in there, check `DATABASE_URL` matches your setup. On a Mac with
Homebrew PostgreSQL, your database username is your Mac username:

```
DATABASE_URL=postgres://YOUR_MAC_USERNAME@localhost:5432/finto
```

Find your username with `whoami`.

### Step 4 — Create the database

```bash
createdb finto
```

Silence means success. If it says the database already exists, that's fine too.

### Step 5 — Build the tables

```bash
npm run db:migrate
```

You should see:

```
Running migrations…
Migrations complete.
```

This creates all 16 tables — users, accounts, transactions, ledger entries,
cards and the rest.

### Step 6 — Load the sample data

```bash
npm run db:seed
```

This recreates exactly what your design shows — Sofia, her three balances, her
Visa ending 4429, her eight transactions and her notifications:

```
Seed complete.

  Sign in as Sofia     sofia@marengo.studio    sofia2026-finto   (PIN 4829)
  Sign in as Alessia   alessia@moretti.co      alessia2026-finto

  Sofia holds $2,450.80 · €612.40 · £0.00 across three accounts,
  with one Visa ending 4429 and eight transactions in her activity.
```

A second user, Alessia, exists so you can test money actually moving between
two real people.

<a id="step-7--start-the-server"></a>

### Step 7 — Start the server

```bash
npm run dev
```

Leave this running. It reloads automatically whenever you edit a file. To stop
it, press `Ctrl+C`.

You'll see:

```
Finto API listening on http://0.0.0.0:4000
```

---

## 3b. Using Supabase instead of local Postgres

The backend runs against Supabase with no code changes — only settings.

### Set the connection

Never paste a database password into a chat, a command argument, or anything
that keeps history. This script asks for it at a hidden prompt and writes it
straight into `.env`:

```bash
./scripts/use-supabase.sh
```

It backs up your `.env` first, percent-encodes the password so special
characters cannot corrupt the URL, and replaces only the `DATABASE_URL` line.

Your password is in the Supabase dashboard under **Settings → Database →
Database password**. If you have forgotten it, reset it there — it is not
recoverable.

Then build the tables and load the data:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

### Which connection string to use

Supabase offers three, and they are not interchangeable here.

| Connection | Port | Use it? |
|---|---|---|
| **Direct** — `db.PROJECT.supabase.co` | 5432 | **Yes** — this is what the script sets. IPv6 only. |
| **Session pooler** — `aws-0-REGION.pooler.supabase.com` | 5432 | Yes, when deploying somewhere without IPv6. |
| **Transaction pooler** — same host | 6543 | **No.** |

Avoid the transaction pooler. It hands out a different backend connection per
statement, which breaks the `SELECT … FOR UPDATE` row locks the ledger uses to
stop two simultaneous payments overdrawing one balance. That is the single
mechanism keeping the books correct, so it is not negotiable.

The direct host resolves over **IPv6 only**. This Mac has IPv6, so it connects
fine. Many cloud hosts do not — if a deployment cannot reach it, switch to the
session pooler on port 5432, which has an IPv4 address.

### TLS

`DATABASE_SSL=auto` turns TLS on for every host except localhost, so Supabase
is encrypted by default.

By default the certificate is **not verified against a trust chain** — traffic
is encrypted, but an active man-in-the-middle is not ruled out. Fine for
development. Before real money, download Supabase's CA from **Settings →
Database → SSL Configuration** and point at it:

```
DATABASE_CA_CERT=./supabase-ca.crt
```

### What lands in your Supabase project

Sixteen tables in the `public` schema, plus the enums they use. Supabase's own
schemas (`auth`, `storage`, `realtime`) are untouched.

`npm run db:reset` drops **only Finto's tables**, by name. It deliberately does
not run `DROP SCHEMA public CASCADE` — on Supabase that would take extensions
and provider objects with it.

Two things worth knowing:

- **Finto has its own users table and its own auth.** It does not use Supabase
  Auth. Sofia is a row in `public.users` with a scrypt password hash.
- **Row Level Security is not enabled**, because every query goes through this
  backend using the `postgres` role, and authorisation is enforced in the API.
  If you ever point a Supabase client library straight at these tables from a
  browser or phone, you must add RLS policies first — without them, anyone with
  the anon key could read every balance.

---

## 4. Check that it works

Open a **second** terminal window (leave the server running in the first) and
ask the API if it's alive:

```bash
curl http://localhost:4000/health
```

```json
{"status":"ok","version":"1.0.0","time":"2026-08-26T08:25:14.723Z"}
```

That's your backend running. Now log in as Sofia:

```bash
curl -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"sofia@marengo.studio","password":"sofia2026-finto"}'
```

You get back Sofia's profile and two tokens:

```json
{
  "user": { "displayName": "Sofia", "handle": "@sofia", "initials": "SM", … },
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",
  "refreshToken": "L_KoMc_bgoSXRBKPcSPYI8kHiK…",
  "expiresIn": 900
}
```

**What the two tokens are for.** The `accessToken` proves who you are on every
request, and expires after 15 minutes. The `refreshToken` lasts 30 days and is
used to get a fresh access token without asking for the password again. Your app
handles this automatically — you only need to think about it when testing by
hand.

### Make testing easier

Save the access token to a shell variable so you don't have to paste it every
time:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/v1/auth/login -H 'content-type: application/json' -d '{"identifier":"sofia@marengo.studio","password":"sofia2026-finto"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")
```

Now every example below can use `$TOKEN`. It stops working after 15 minutes —
just run that line again.

---

## 5. Take it for a drive

Everything here is real. The balances change, the ledger records it, and it
persists after a restart.

### See the balances

```bash
curl -s http://localhost:4000/v1/accounts -H "authorization: Bearer $TOKEN"
```

Each account comes back with the amount in several forms, so your UI never has
to format money itself:

```json
{
  "name": "Main · USD",
  "symbol": "$",
  "ibanMasked": "US** **** 4429",
  "balance": {
    "amount": "2450.80",        // for calculations
    "amountMinor": "245080",    // exact cents, for anything precise
    "formatted": "$2,450.80",   // ready to display
    "currency": "USD"
  }
}
```

The response also includes a `total` — every balance converted into Sofia's base
currency, which is what the Home screen header shows.

### Check whether a payment is affordable

This is what powers the red "Above your available balance" chip on your amount
screen. It doesn't move any money:

```bash
curl -s -X POST http://localhost:4000/v1/payments/quote \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"amount":"240"}'
```

```json
{ "sufficient": true, "warning": null, "remainingAfter": { "formatted": "$2,210.80" } }
```

Now try an amount she can't afford:

```bash
curl -s -X POST http://localhost:4000/v1/payments/quote \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"amount":"99999"}'
```

```json
{ "sufficient": false, "warning": "Above your available balance" }
```

The warning text is exactly the copy in your design, so your screen can show it
directly.

### Send money for real

```bash
curl -s -X POST http://localhost:4000/v1/payments/send \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -H 'idempotency-key: my-first-payment' \
  -d '{"handle":"@alessia","amount":"240","note":"Design work","password":"sofia2026-finto"}'
```

```json
{
  "transaction": {
    "reference": "FT-7604-0596",
    "status": "completed",
    "display": { "amount": "−$240.00", "amountColor": "#0B0C0B" }
  },
  "balanceAfter": { "formatted": "$2,210.80" }
}
```

Sofia's balance dropped by $240 and Alessia's went up by the same amount, in one
indivisible operation.

> **Why `password` is in there:** Sofia has "confirm every payment" switched on
> in her security settings. If you turn that off, the field isn't needed.

> **Why `idempotency-key` is in there:** it's how the server recognises a retry.
> Run that exact command again and you'll get the *same* transaction reference
> back and the balance will stay at $2,210.80 — it won't send another $240. Your
> app should generate a fresh random key for each new payment (the included
> client does this for you).

### Read the activity feed

```bash
curl -s "http://localhost:4000/v1/transactions?limit=5" -H "authorization: Bearer $TOKEN"
```

The response has both a flat `transactions` list and a `groups` list — the day
sections with running totals your Activity screen renders:

```json
{
  "groups": [
    {
      "label": "Mar 12",
      "total": "+$1,580.00",
      "items": [
        {
          "counterparty": { "name": "Stripe", "initial": "S", "tint": "lime" },
          "display": {
            "amount": "+$1,820.00",
            "amountColor": "#2E7D46",
            "meta": "Income · Mar 12 09:14",
            "showStatus": false
          }
        }
      ]
    }
  ]
}
```

Filter it the way your chips do:

```bash
curl -s "http://localhost:4000/v1/transactions?filter=income"   -H "authorization: Bearer $TOKEN"
curl -s "http://localhost:4000/v1/transactions?filter=spending" -H "authorization: Bearer $TOKEN"
curl -s "http://localhost:4000/v1/transactions?filter=pending"  -H "authorization: Bearer $TOKEN"
curl -s "http://localhost:4000/v1/transactions?q=stripe"        -H "authorization: Bearer $TOKEN"
```

### Request money and pay it by QR

Sofia creates a request:

```bash
curl -s -X POST http://localhost:4000/v1/payments/requests \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"amount":"85","note":"Dinner"}'
```

```json
{
  "request": {
    "amount": { "formatted": "$85.00" },
    "status": "pending",
    "linkToken": "IsJDxShTfeF-Yswi3D3jsmyxVWt-HAj7",
    "shareUrl": "http://localhost:4000/pay/IsJDxShTfeF-…",
    "deepLink": "finto://pay/IsJDxShTfeF-…"
  }
}
```

Put `shareUrl` into a QR code and you have the QR screen from your design. When
someone scans it, send whatever the camera read straight to the API — it accepts
the full URL, the deep link, or the bare token, so your scanner doesn't need to
parse anything:

```bash
curl -s -X POST http://localhost:4000/v1/payments/scan \
  -H "authorization: Bearer $ALESSIA_TOKEN" -H 'content-type: application/json' \
  -d '{"payload":"finto://pay/PASTE_THE_LINK_TOKEN_HERE"}'
```

It comes back with the amount, the note and who's asking — everything the
confirmation sheet needs. Then pay it:

```bash
curl -s -X POST http://localhost:4000/v1/payments/requests/by-token/LINK_TOKEN/pay \
  -H "authorization: Bearer $ALESSIA_TOKEN" \
  -H 'content-type: application/json' -H 'idempotency-key: pay-1' -d '{}'
```

### Freeze a card and set a limit

```bash
CARD=$(curl -s http://localhost:4000/v1/cards -H "authorization: Bearer $TOKEN" | node -pe "JSON.parse(require('fs').readFileSync(0)).cards[0].id")

# Freeze
curl -s -X POST "http://localhost:4000/v1/cards/$CARD/freeze" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"frozen":true}'

# Set a monthly limit and turn off online payments
curl -s -X PATCH "http://localhost:4000/v1/cards/$CARD/controls" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"monthlyLimit":"1500","onlinePayments":false,"paymentsAbroad":true}'
```

The card response tells you what's been spent this month and what percentage of
the limit that is — the meter on your card controls screen.

Card numbers are **never** returned. You get `•••• •••• •••• 4429` and nothing
more. See [section 11](#11-before-you-go-live) for why, and how the real number
reaches the screen.

### Watch updates arrive live

This is what keeps a phone and a laptop in sync. There is a small `watch.mjs`
in `finto-backend` for exactly this — it is four lines:

```js
import { WebSocket } from 'ws';

const token = process.argv[2];
const ws = new WebSocket(`ws://localhost:4000/v1/realtime?token=${token}`);

ws.on('open', () => console.log('listening…'));
ws.on('message', (m) => console.log(m.toString()));
```

Run it with Sofia's token:

```bash
node watch.mjs "$TOKEN"
```

Now, in another terminal, have Alessia send Sofia money. Sofia's listener prints
the notification, the new transaction and the balance change the instant they
happen — no refresh, no polling.

---

## 6. Calling it from your app

You don't have to write any of the above by hand. `packages/api-client` is a
ready-made typed client that both your apps can import.

The only thing that differs between mobile and web is where login tokens are
stored, so that's the only thing you configure.

### Desktop web

```ts
import { createFintoClient, memoryTokenStore } from '@finto/api-client';

export const api = createFintoClient({
  baseUrl: 'http://localhost:4000',
  tokens: memoryTokenStore(),
  credentials: 'include',            // lets the secure refresh cookie through
  device: { name: 'Chrome on Mac', platform: 'web' },
  onSessionExpired: () => location.assign('/login')
});
```

On web the refresh token lives in an `httpOnly` cookie, which page scripts can't
read. That's deliberate: it means a cross-site scripting bug can't steal a
30-day login.

### Mobile (React Native / Expo)

```ts
import * as SecureStore from 'expo-secure-store';
import { createFintoClient } from '@finto/api-client';

export const api = createFintoClient({
  baseUrl: 'https://api.finto.app',
  device: { name: 'iPhone 15', platform: 'ios' },
  tokens: {
    getAccess:  () => SecureStore.getItemAsync('finto.access'),
    getRefresh: () => SecureStore.getItemAsync('finto.refresh'),
    set: async (t) => {
      await SecureStore.setItemAsync('finto.access', t.accessToken);
      if (t.refreshToken) await SecureStore.setItemAsync('finto.refresh', t.refreshToken);
    },
    clear: async () => {
      await SecureStore.deleteItemAsync('finto.access');
      await SecureStore.deleteItemAsync('finto.refresh');
    }
  }
});
```

On mobile the tokens go in the device keychain, encrypted by the operating
system.

### From there, both are identical

```ts
// Login
await api.auth.login('sofia@marengo.studio', 'sofia2026-finto');

// Home screen
const { accounts, total } = await api.accounts.list();

// Activity screen, with a filter chip active
const { groups } = await api.transactions.list({ filter: 'spending' });

// Amount screen — check before committing
const quote = await api.payments.quote({ amount: '240' });
if (!quote.sufficient) showWarning(quote.warning);

// Send
await api.payments.send({ handle: '@alessia', amount: '240', note: 'Design work' });

// Cards
await api.cards.freeze(cardId, true);
await api.cards.updateControls(cardId, { monthlyLimit: '1500' });

// Live updates
const live = api.realtime({
  onEvent: (event) => {
    if (event.type === 'account.balance_changed') refetchBalances();
    if (event.type === 'notification.created')    showToast(event.data);
  }
});
```

The client refreshes expired tokens on its own and retries the request, so no
screen ever has to think about token expiry. It also generates idempotency keys
for you, so payments are retry-safe by default.

### Letting your web app through

Browsers block requests to a different origin unless the server allows it. Add
each web address to `CORS_ORIGINS` in `.env`:

```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://app.finto.com
```

Restart the server after changing it. Mobile apps don't need this — native
requests aren't subject to browser origin rules.

---

## 7. Connecting your Finto design

Your `Finto Mobile App.dc.html` is a prototype: the balances, transactions and
contacts are hard-coded arrays inside the file, and tapping around changes local
state. Nothing persists.

Turning it into the real thing means replacing those arrays with API calls. The
shape of the data was designed to match, so it's mostly a swap rather than a
rewrite.

**What maps to what:**

| In the prototype | Replace with |
|---|---|
| `const TX = [...]` | `api.transactions.list()` → use `groups` |
| `const PEOPLE = [...]` | `api.contacts.list()` |
| `balanceDisplay: '$2,450.80'` | `accounts[0].balance.formatted` |
| `state.frozen` | `api.cards.freeze(id, true)` |
| `state.limit` | `api.cards.updateControls(id, { monthlyLimit })` |
| `doLogin()` | `api.auth.login(email, password)` |
| `confirmPay()` | `api.payments.send({ … })` |
| Notification array | `api.notifications.list()` |

The presentation fields are already there so you don't have to reformat
anything. Each transaction arrives with `display.amount` (`"−$240.00"`),
`display.amountColor`, `display.meta` (`"Software · Mar 09 11:48"`) and the
status chip colours — the same strings the prototype builds by hand.

**A realistic route:** rather than editing the design file, build the real app
(React, or React Native) using the design as the visual reference, and wire each
screen to the client calls above as you go. The prototype stays as the
specification; the API supplies everything it was faking.

---

## 8. Everyday commands

Run all of these from `finto-backend`.

| Command | What it does |
|---|---|
| `npm run dev` | Start the server, reloading on file changes |
| `./scripts/use-supabase.sh` | Point `.env` at Supabase (hidden password prompt) |
| `npm test` | Run all 53 tests |
| `npm run typecheck` | Check for type errors without running |
| `npm run db:seed` | Wipe and reload the sample data |
| `npm run db:migrate` | Apply new database changes |
| `npm run build` | Compile for production into `dist/` |
| `npm start` | Run the compiled build |

### Starting fresh

If the data gets into a mess:

```bash
npm run db:reset
npm run db:migrate
npm run db:seed
```

`db:reset` refuses to run if `NODE_ENV=production`, so it can't wipe real
customer data by accident.

### Running the tests

The tests use their own separate database so they can't touch your development
data. One-time setup:

```bash
createdb finto_test
cp .env .env.test
```

Then edit `.env.test` and change the database name at the end of `DATABASE_URL`
from `finto` to `finto_test`, and add `NODE_ENV=test`. Create the tables:

```bash
DATABASE_URL=postgres://$(whoami)@localhost:5432/finto_test npm run db:migrate
```

Now:

```bash
npm test
```

```
Test Files  4 passed (4)
     Tests  53 passed (53)
```

> Already set up on this machine — `npm test` works right now.

### Changing the database schema

If you add a column or table in `src/db/schema.ts`:

```bash
npm run db:generate    # writes a migration file
npm run db:migrate     # applies it
```

### Looking at the data directly

```bash
psql -d finto
```

Then:

```sql
SELECT name, currency, balance_minor FROM accounts;
SELECT counterparty_name, amount_minor, status FROM transactions ORDER BY occurred_at DESC LIMIT 10;
\q
```

Remember `balance_minor` is in cents: `245080` means $2,450.80.

### Checking the books balance

A useful sanity check — every currency should total exactly zero across the
ledger, because every debit has a matching credit:

```bash
psql -d finto -c "SELECT currency, SUM(CASE WHEN direction='credit' THEN amount_minor ELSE -amount_minor END) AS net FROM ledger_entries GROUP BY currency;"
```

```
 currency | net
----------+-----
 EUR      |   0
 USD      |   0
```

Anything other than zero means money was created or destroyed, which should be
impossible. If you ever see it, something is wrong.

---

## 9. When something goes wrong

### `Could not reach the database. Is DATABASE_URL correct?`

PostgreSQL isn't running, or the address in `.env` is wrong.

```bash
pg_isready                          # should say "accepting connections"
brew services start postgresql@15   # if it isn't
whoami                              # your database username on a Mac
```

Make sure `DATABASE_URL` in `.env` uses that username and ends with `/finto`.

### `database "finto" does not exist`

```bash
createdb finto
npm run db:migrate
npm run db:seed
```

### `Invalid environment configuration`

The server checks its settings at startup and tells you exactly which one is
wrong. Usually it's a secret you haven't replaced:

```
- JWT_ACCESS_SECRET: JWT_ACCESS_SECRET must be at least 32 characters
```

Generate a proper one and paste it in:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### `EADDRINUSE: address already in use :::4000`

A server is already running on port 4000 — probably one you forgot to stop.

```bash
lsof -ti:4000 | xargs kill
```

Or change `PORT` in `.env`.

### `relation "users" does not exist`

The tables were never created:

```bash
npm run db:migrate
```

### Every request returns 401

Your access token expired — they only last 15 minutes. Log in again to get a
fresh one. In a real app the client does this automatically.

### The browser says "blocked by CORS policy"

Your web app's address isn't in the allowed list. Add it to `CORS_ORIGINS` in
`.env` and restart the server. Include the port: `http://localhost:5173`, not
`http://localhost`.

### A payment returns `insufficient_funds`

Working as intended — the balance won't cover it. Check what's available:

```bash
curl -s http://localhost:4000/v1/accounts -H "authorization: Bearer $TOKEN"
```

Or reload the sample data with `npm run db:seed`.

### Reading error responses

Every error has the same shape. Your app should branch on `code`, never on the
message text — messages are written for people and may be reworded.

```json
{
  "error": {
    "code": "insufficient_funds",
    "message": "That is above your available balance.",
    "details": { "available": { "formatted": "$2,210.80" } }
  }
}
```

| Code | Meaning |
|---|---|
| `validation_error` | Something in the request was malformed; `details` lists the fields |
| `invalid_credentials` | Wrong email, password or PIN |
| `account_locked` | Too many failed logins; locked for 15 minutes |
| `token_expired` | Access token aged out — refresh it |
| `token_reused` | An old refresh token was replayed; all sessions were revoked |
| `unauthorized` | No token, or the session was ended |
| `forbidden` | Signed in, but not allowed to do this |
| `not_found` | No such record, or it isn't yours |
| `insufficient_funds` | Balance won't cover it |
| `account_frozen` | The account isn't active |
| `idempotency_conflict` | Same key reused with a different request |
| `request_expired` | The payment request is past its expiry |
| `rate_limited` | Too many requests; slow down |

---

## 10. Full API reference

Every path starts with `/v1`. Everything except `/health`, `/auth/*`,
`/support/faq` and `/webhooks/*` needs the header:

```
Authorization: Bearer <accessToken>
```

### Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create an account and its first balance |
| POST | `/auth/login` | Sign in with email, phone or `@handle` |
| POST | `/auth/refresh` | Exchange a refresh token for a new pair |
| POST | `/auth/logout` | End this session |
| POST | `/auth/pin/unlock` | Unlock with a PIN on a known device |
| PUT | `/auth/pin` | Set or change the PIN |
| GET | `/auth/sessions` | List signed-in devices |
| POST | `/auth/sessions/revoke-all` | Sign out everywhere |

### Users

| Method | Path | Purpose |
|---|---|---|
| GET | `/users/me` | Profile — powers the header and Profile screen |
| PATCH | `/users/me` | Update name, phone or avatar tint |
| PATCH | `/users/me/security` | Face ID and "confirm every payment" toggles |
| PUT | `/users/me/password` | Change password (signs out other devices) |

### Accounts

| Method | Path | Purpose |
|---|---|---|
| GET | `/accounts` | All balances plus the converted total |
| GET | `/accounts/:id` | One account |
| POST | `/accounts` | "Open a balance" in a new currency |
| GET | `/accounts/:id/statement` | Ledger entries with running balance |

### Transactions

| Method | Path | Purpose |
|---|---|---|
| GET | `/transactions` | The Activity feed |
| GET | `/transactions/:id` | Transaction detail |
| GET | `/transactions/summary` | Spend by category |

`GET /transactions` accepts: `filter` (`all`, `income`, `spending`, `pending`),
`q` (free text), `accountId`, `cardId`, `from`, `to`, `limit`, `cursor`, and
`grouped` (default `true`, adds the day sections).

Paging uses `cursor`, not page numbers — the feed shifts as new payments land,
and page numbers would duplicate or skip rows. Pass the `nextCursor` from the
previous response to get the next batch.

### Payments

| Method | Path | Purpose |
|---|---|---|
| POST | `/payments/quote` | Affordability check, no money moved |
| POST | `/payments/send` | Send money |
| POST | `/payments/requests` | Create a request with QR / share link |
| GET | `/payments/requests` | Your requests |
| DELETE | `/payments/requests/:id` | Cancel one |
| POST | `/payments/scan` | Resolve a scanned code |
| POST | `/payments/requests/by-token/:token/pay` | Pay a scanned request |

Send `Idempotency-Key: <unique string>` on `send` and `pay`.

### Cards

| Method | Path | Purpose |
|---|---|---|
| GET | `/cards` | All cards with controls and month-to-date spend |
| GET | `/cards/:id` | One card |
| POST | `/cards` | Issue a new virtual or physical card |
| POST | `/cards/:id/freeze` | Freeze or unfreeze |
| PATCH | `/cards/:id/controls` | Online, abroad, contactless, ATM, limit |
| POST | `/cards/:id/reveal` | Short-lived token to show the real number |
| POST | `/cards/:id/terminate` | Permanently kill the card |

### Everything else

| Method | Path | Purpose |
|---|---|---|
| GET | `/contacts` | List and search people to pay |
| POST | `/contacts` | Add a contact |
| GET | `/contacts/lookup?handle=` | Find a Finto user before saving them |
| GET | `/notifications` | Feed and unread count |
| POST | `/notifications/:id/read` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |
| PUT | `/devices/push-token` | Register for push notifications |
| GET | `/fx/rate?from=&to=` | Exchange rate |
| GET | `/fx/quote?from=&to=&amount=` | Conversion quote |
| GET | `/support/faq` | Help screen content |
| POST | `/support/tickets` | Open a support ticket |
| GET | `/health` | Is the server up |

### Live updates

```
ws://localhost:4000/v1/realtime?token=<accessToken>
```

Events pushed: `transaction.created`, `transaction.updated`,
`account.balance_changed`, `notification.created`, `card.updated`,
`payment_request.updated`, `session.revoked`.

---

## 11. Before you go live

This code is production-shaped, but a real bank needs more than code. Here is
what's genuinely finished and what isn't, so nothing surprises you later.

### Do this first

- **New secrets.** Generate fresh `JWT_*` and `COOKIE_SECRET` values for
  production. Never reuse the development ones.
- **`NODE_ENV=production` and `COOKIE_SECURE=true`.** The second one requires
  HTTPS, which you need anyway.
- **HTTPS everywhere.** Tokens over plain HTTP are readable in transit.
- **Real `CORS_ORIGINS`.** Only your actual web addresses.
- **Database backups.** Point-in-time recovery, not a nightly dump. This is
  people's money.
- **Build and run compiled code:** `npm run build` then `npm start` — not
  `npm run dev`.

### What's stubbed, and where to plug the real thing in

**Card numbers are never stored.** Only the last four digits and a processor
token. That's deliberate: storing full card numbers puts you inside PCI-DSS
audit scope, which is a serious, expensive obligation. `POST /cards/:id/reveal`
returns a 60-second token your app hands to a card processor's own secure
component, which displays the number without it ever touching your servers.
The seam is `issueCardWithProcessor()` in `src/modules/cards/routes.ts`.

**Payment rails are stubbed.** Payments between two Finto users are fully real
and settle instantly. Payments *out* to another bank debit the sender and sit
`pending` against a settlement account until confirmed. The confirmation webhook
and its signature verification are implemented at
`POST /v1/webhooks/payment-rail` — you connect it to whichever provider you sign
with.

**Push notifications** are recorded and delivered live over WebSocket, which
covers the app being open. For notifications when it's closed, fill in
`sendPush()` in `src/modules/notifications/service.ts` with APNs and Firebase.

**Exchange rates** are served from a database table with a 60-second cache. You
need a job to refresh them from a rate provider.

**Regulatory requirements are not here, and are not optional.** Handling real
customer money means identity verification (KYC), sanctions screening,
transaction monitoring, and a licence or a sponsoring partner in each market.
That's a legal and operational programme, not something a codebase provides.

**One server only.** Live updates are held in the server's memory, so with more
than one instance a user connected to server A won't hear about events from
server B. Fix by replacing the body of `publish()` in `src/realtime/hub.ts` with
a Redis broadcast — the rest of the code doesn't change.

---

## Where things live

```
finto-backend/
├── src/
│   ├── server.ts            Starts everything up
│   ├── app.ts               Security, CORS, rate limits, error handling
│   ├── env.ts               Settings, validated at startup
│   ├── db/
│   │   ├── schema.ts        Every table and index
│   │   └── seed.ts          The sample data from your design
│   ├── ledger/ledger.ts     The double-entry engine — read this one
│   ├── lib/                 Money maths, passwords, tokens, errors
│   ├── modules/             One folder per feature: auth, payments, cards…
│   └── realtime/hub.ts      Live updates
├── packages/api-client/     The client your apps import
├── tests/                   53 tests
└── .env                     Your settings (never commit this)
```

If you read one file, make it `src/ledger/ledger.ts`. Everything about how money
moves is in there.
