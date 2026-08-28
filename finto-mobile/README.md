# Finto — Mobile App

The iOS and Android app. It talks to `finto-backend` over the same API the web
app uses, sharing one typed client and one set of types.

Expo SDK 52 · React Native 0.76 · expo-router · TypeScript

---

## Run it on your phone — no Xcode needed

This is the quickest path, and it works today.

**1. Install Expo Go** on your iPhone or Android phone, from the App Store or
Play Store.

**2. Start the backend** (terminal 1):

```bash
cd ../finto-backend && npm run dev
```

**3. Start the app** (terminal 2):

```bash
npm install
npm start
```

**4. Scan the QR code** that appears in terminal 2 — with the Camera app on
iOS, or inside Expo Go on Android.

Your phone and this Mac must be on the same Wi-Fi. Sign in with
`sofia@marengo.studio` / `sofia2026-finto`, both pre-filled.

### Why localhost still works

Your phone cannot reach the Mac's `localhost`. On startup the app asks Expo for
the development machine's LAN address and points the API there automatically —
see `resolveBaseUrl()` in `src/lib/api.ts`. Nothing to configure.

---

## Run it in the iOS Simulator

This needs a **full Xcode install**, which is not present on this Mac — only the
Command Line Tools. To enable it:

1. Install Xcode from the Mac App Store (it is free, and large).
2. Point the tools at it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Then:

```bash
npm run ios
```

Until then, use Expo Go on a real phone as above.

---

## What's built

Every screen from the design, on real data:

| Route | Screen |
|---|---|
| `login` | Sign in |
| `(tabs)/index` | Home — balance, quick actions, recent activity |
| `(tabs)/pay` | Choose who to pay |
| `(tabs)/activity` | Feed with filters, search, day grouping |
| `(tabs)/cards` | Card face, freeze, spend against limit |
| `(tabs)/profile` | Profile and menu |
| `pay/amount` | Keypad, affordability check, Face ID or password |
| `activity/[id]` | Receipt |
| `cards/[id]` | Card controls |
| `request` | Create a request, share the QR |
| `scan` | Camera QR scanner |
| `notifications` | Feed with unread state |
| `security` | Face ID, confirm payments, devices |
| `help` | Searchable FAQ |

---

## What the phone does that the browser can't

**The camera really scans.** `expo-camera` reads the QR and hands the raw
payload to the same `/payments/scan` endpoint the web app posts pasted text to.
The scanner is guarded against re-entry, because the camera fires its callback
repeatedly while a code is in frame — without that, one QR would trigger a
dozen lookups.

**Face ID approves payments.** With biometrics on, confirming a payment is a
Face ID prompt instead of retyping a password. If the hardware is missing, not
enrolled, or the scan fails, it falls back to the password sheet — the fallback
is the point, not an afterthought.

**Tokens live in the keychain.** `expo-secure-store` keeps them encrypted by the
OS, so a session survives an app restart without ever sitting in plain
JavaScript storage. The access token is mirrored in memory so the common read
does not hit the keychain on every request.

**The share sheet is the real one.** Requesting money opens the OS share sheet —
Messages, Mail, AirDrop, whatever is installed.

**Coming back from the background refetches.** iOS suspends sockets when the app
is backgrounded, so anything that happened while away was missed. Returning to
the foreground forces a refetch rather than trusting a stale balance.

---

## Sharing code with the web app

`@finto/api-client` resolves to `../finto-backend/packages/api-client` — the
same file the web app imports. Request shapes, response types and error codes
have one definition.

Two pieces of `metro.config.js` make that work, and both are load-bearing:

- `watchFolders` — Metro only watches the project directory by default, so it
  would not even see the client, let alone reload on edits to it.
- `resolveRequest` — the client is written for Node's ESM resolution, where
  importing a TypeScript file must still be spelled `./types.js`. Metro looks
  for a literal `types.js` that never existed. The resolver maps the extension
  back to `.ts`, which keeps the client correct for Node, `tsc` and Vite rather
  than weakening it to suit one bundler.

**Money is never formatted here**, exactly as on web. Amounts arrive
pre-rendered (`"−$240.00"`) with their colour and meta line. No client does
arithmetic on money, which is what stops the two apps from drifting apart.

---

## Commands

| Command | What it does |
|---|---|
| `npm start` | Dev server and QR code for Expo Go |
| `npm run ios` | Open in the iOS Simulator (needs full Xcode) |
| `npm run android` | Open in an Android emulator |
| `npm run typecheck` | Type errors only |

---

## Notes and limits

- **`.npmrc` points at a local npm cache.** The global cache on this Mac has
  root-owned entries left by a past `sudo npm install`, which makes installs
  fail with `EACCES`. The permanent fix needs your password:
  `sudo chown -R $(whoami) ~/.npm` — after that, `.npmrc` can be deleted.
- **Expo Go covers everything here.** A custom development build is only needed
  if you add a native module Expo Go does not bundle.
- **Push notifications are not wired up.** In-app alerts arrive over the
  WebSocket. Delivering them when the app is closed needs a development build,
  an APNs key and the `sendPush()` seam in the backend filled in.
- **`react-native@0.76.6` vs Expo's expected `0.76.9`.** Harmless in
  development; run `npx expo install --fix` before shipping.
