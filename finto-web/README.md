# Finto — Web App

The desktop web app for Finto. It talks to `finto-backend` over the same API
the mobile app uses, so both stay in step without a second backend.

React 19 · TypeScript · Vite · React Router

---

## Run it

The backend must be running first. In one terminal:

```bash
cd ../finto-backend && npm run dev
```

Then, in a second terminal:

```bash
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:5173** and sign in with the seeded account:

| | |
|---|---|
| Email | `sofia@marengo.studio` |
| Password | `sofia2026-finto` |

Those are pre-filled on the login screen, so you can just press **Sign in**.

---

## What's built

Every screen from the design, wired to real data:

| Route | Screen |
|---|---|
| `/login` | Sign in |
| `/` | Home — total balance, quick actions, recent activity |
| `/accounts` | Multi-currency balances, opening a new one |
| `/activity` | Feed with filter chips, search and day grouping |
| `/activity/:id` | Receipt |
| `/pay` | Choose who to pay |
| `/pay/amount` | Keypad, affordability check, password confirmation |
| `/request` | Create a request with a scannable QR code |
| `/scan` | Pay a code or link |
| `/cards` | Card face, freeze, spend against limit |
| `/cards/:id/controls` | Online, abroad, contactless, ATM, monthly limit |
| `/notifications` | Feed with unread state |
| `/profile` | Profile and menu |
| `/security` | Face ID, confirm payments, password, signed-in devices |
| `/help` | Searchable FAQ |

---

## One layout, two shapes

There is no separate mobile build. The same components serve both widths:

- **Below 900px** it is the phone design — one column, bottom tab bar.
- **At 900px and above** the tab bar becomes a left rail and the content gets a
  wider column.

Resize the browser to see it switch.

---

## How it talks to the backend

### The shared client

`@finto/api-client` is aliased to `../finto-backend/packages/api-client`, so the
request and response types come from one source. Change an endpoint in the
backend and TypeScript flags it here immediately.

The alias is declared twice, and both must agree: `resolve.alias` in
`vite.config.ts` for the bundler, and `paths` in `tsconfig.json` for the editor
and `tsc`.

### Tokens

The refresh token lives in an `httpOnly` cookie that page scripts cannot read —
so an XSS bug cannot walk off with a 30-day login. Only the short-lived access
token is held, in a module-level variable, never in `localStorage`.

On load, `AuthProvider` redeems the cookie once before any screen fetches
anything. Doing it in that order means no request is ever fired that is
guaranteed to fail. If the cookie is dead, the visitor sees the login screen.

### Live updates

`LiveProvider` opens a WebSocket and bumps a revision counter whenever the
server reports a change. `useApi` watches that counter and refetches. The
practical effect: pay someone on your phone and this tab updates on its own.

The dot above your name in the rail shows the connection — green for live, grey
while reconnecting.

### Money is never formatted here

Amounts arrive pre-formatted from the server (`"−$240.00"`), along with their
colour and meta line. Nothing in this app does arithmetic on money or decides
how it should look. That is what keeps web and mobile from slowly drifting
apart, and it keeps float arithmetic away from balances.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm run typecheck` | Type errors only, no build |

---

## Deploying

```bash
npm run build
```

`dist/` is static files — put them on any static host. Two things must be true
in production:

1. `VITE_API_URL` points at your deployed API. It is baked in at build time, so
   set it before building.
2. The API's `CORS_ORIGINS` includes your web address, and `COOKIE_SECURE=true`
   with HTTPS on both — the refresh cookie will not be sent otherwise.

---

## Notes and limits

- **The scan screen takes pasted text, not camera input.** A browser tab is the
  wrong place to ask for camera access for payments; the mobile app scans with
  the camera and sends the same payload to the same endpoint.
- **QR codes are real.** `qrcode` encodes an actual scannable code, so a phone
  can pay a request generated here.
- **No offline support.** Every screen needs the API. A service worker and a
  cache layer would be the next step.
