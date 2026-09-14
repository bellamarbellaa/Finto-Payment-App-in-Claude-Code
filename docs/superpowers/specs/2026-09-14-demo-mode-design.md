# Finto web: demo/mock mode

## Purpose

`finto-web` is deployed to Vercel as a portfolio piece — there is no requirement for it to be a working bank, only a convincing, clickable product demo. The real backend (`finto-backend`) needs a paid-tier-avoiding host (Render free tier) plus a live Postgres connection (Supabase), both of which add cost, cold-start latency (~50s after 15 min idle), and operational surface for something that only needs to look real. This spec adds a mock data layer so the deployed site works standalone, with no live backend required, while leaving the door open to point it at the real API later without code changes.

## Non-goals

- Does not touch `finto-backend` or `finto-mobile`.
- Does not simulate multi-user realtime sync (e.g. two browser tabs seeing each other's payments) — single-session realism only.
- Does not add a settings UI to switch modes at runtime; mode is decided by build-time env var.

## Architecture

`finto-web` already funnels every network call through one object: `api`, exported from [`src/lib/api.ts`](../../../finto-web/src/lib/api.ts), built by `createFintoClient()` from `@finto/api-client`. Every screen, `useApi`, `AuthProvider`, and `LiveProvider` consumes only `api.*` — confirmed via grep, there is no other `fetch()` or `VITE_API_URL` usage in `src/`. This means a second implementation of the same `FintoClient` shape is a drop-in swap with no changes required outside `lib/api.ts` and one small addition to `Shell.tsx`.

### New files

- **`finto-web/src/lib/mock/data.ts`** — seed data typed against the real API's types (`Account`, `Transaction`, `Card`, `Contact`, `Notification`, `PublicUser`, etc., from `@finto/api-client`). Seeds:
  - User: Sofia Marengo (`sofia@marengo.studio` / `sofia2026-finto`), matching `START-HERE.md` so the pre-filled login screen works unchanged.
  - 2–3 accounts across different currencies with realistic balances.
  - ~12 transactions spanning several days, mixed income/spending/pending, grouped like the real API groups them.
  - 2 cards (one virtual, one physical) with distinct control states.
  - A handful of contacts, a few read/unread notifications.

- **`finto-web/src/lib/mock/store.ts`** — module-level mutable store, hydrated once from `localStorage` (key `finto-demo:v1`) or from the seed if absent/corrupt. Persists after every mutation. Exposes `resetToSeed()`. All money math reuses the same integer-minor-units approach as the real backend (no floats), so mock balances behave identically to real ones.

- **`finto-web/src/lib/mock/client.ts`** — `createMockFintoClient(): FintoClient`. One function per real endpoint used by the app today (auth, users, accounts, transactions, payments, contacts, cards, notifications, fx, support — `devices` can be a thin no-op since no screen exercises push tokens in the browser). Mutations:
  - `auth.login` validates against the seeded credentials; wrong password/identifier throws `FintoApiError(401, 'invalid_credentials', …)`, matching real error handling already in `Login.tsx`.
  - `payments.send` deducts from the chosen account, appends a transaction, and throws `FintoApiError(422, 'insufficient_funds', …)` when the balance can't cover it — reuses the same error code the real API uses, so `SendAmount.tsx`'s existing error UI needs no changes.
  - `cards.freeze` / `updateControls`, `notifications.markRead`, `contacts.*` etc. mutate the store directly and return the updated resource, matching real response shapes.
  - `realtime(handlers)` is a stub: calls `handlers.onOpen()` on the next tick (so `LiveProvider` shows "connected" immediately, no real socket), and subscribes to a tiny internal event emitter that every mutation above publishes to — this is what keeps `LiveProvider`'s `revision` counter incrementing the same way a real push would, so screens that stay mounted still refresh after an action, not just ones reached by navigation.

- **`finto-web/src/lib/api.ts`** — change the single `export const api = createFintoClient(...)` into a small picker:
  ```ts
  export const api = import.meta.env.VITE_API_URL
    ? createFintoClient({ baseUrl: import.meta.env.VITE_API_URL, ... })
    : createMockFintoClient();
  ```
  No other file changes. Local dev (`finto-web/.env` has `VITE_API_URL=http://localhost:4000`) is unaffected — mock mode only activates when that variable is absent, which today is true only on the Vercel deployment (no env var configured there yet).

### UI: "Demo data" indicator

`Shell.tsx` already has a small connection-status idiom in the desktop rail — a 7px dot + sentence-case label (`● Live` / `● Reconnecting…`, using `--income` / `--hairline-2` and `--faint` text). Rather than bolt on a separate banner (the generic "yellow dev strip" pattern), reuse that exact idiom for a third state: dot colored `var(--lime)` (the app's own primary-action brand color, signaling "this is deliberate" rather than "something's wrong"), label reads `Demo data`. Same position, same typography, same 11.5px/600-weight sentence-case treatment already used for the other two states — it reads as a designed part of the product, not an addition.

## Data flow (unchanged)

Screens call `useApi(() => api.accounts.list())` etc. exactly as today. A mutation (e.g. `api.payments.send(...)`) updates the mock store, publishes on the internal event bus, `LiveProvider` increments `revision`, `useApi`'s effect (which depends on `revision`) refetches. Navigating to a new screen also naturally refetches on mount regardless of `revision`, matching current behavior.

## Testing / verification

- `cd finto-web && npm run dev` with `VITE_API_URL` unset (temporarily blank the local `.env` or use a separate `.env.demo`) — confirm it boots straight to the login screen with Sofia's credentials pre-filled, and that sign-in, Home, Accounts, Activity, Pay → Send, Cards → freeze, Notifications, and Profile all render real-looking data with no console errors.
- Send money, then reload the page — balance/transaction should persist (localStorage).
- Trigger `insufficient_funds` (send more than available) — confirm the existing error UI in `SendAmount.tsx` displays it correctly.
- `npm run build && npm run typecheck` — confirm the mock client satisfies `FintoClient` exactly (TypeScript will catch any shape drift) and the build succeeds.
- Confirm real mode still works unchanged: run against local `finto-backend` with `VITE_API_URL=http://localhost:4000` set, sign in for real.
