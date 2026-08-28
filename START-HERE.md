# Finto — How to run it

Everything you need to open Finto on your Mac and your phone.
Nothing here needs to be memorised; just come back to this page.

---

## The 30-second version

Open **Terminal**. Two tabs, one command each (⌘T makes a new tab).

**Tab 1 — the API.** Nothing works without this.

```bash
cd "/Users/marbellaelpantja/Documents/Finto Mobile App Designs Clickable/finto-backend" && npm run dev
```

**Tab 2 — pick one:**

Phone:

```bash
cd "/Users/marbellaelpantja/Documents/Finto Mobile App Designs Clickable/finto-mobile" && npx expo start
```

Computer:

```bash
cd "/Users/marbellaelpantja/Documents/Finto Mobile App Designs Clickable/finto-web" && npm run dev
```

Leave both tabs open. Then open the app:

- **Phone** — open Expo Go, tap **Finto**
- **Computer** — go to **http://localhost:5173**

Sign in: `sofia@marengo.studio` / `sofia2026-finto` (already filled in — just tap Sign in).

---

## Things that are easy to get wrong

**Run each command once.** Every extra `npx expo start` makes another process that
can't get the port and just sits there doing nothing. One tab, one command.

**Leave the tabs running.** They fill with text and never "finish". That is them
working. Closing the tab stops the server.

**Your phone must be on Wi-Fi, not 5G.** Same network as the Mac. On cellular,
Expo Go cannot see your Mac at all and the app will not load.

**Stop a server with Ctrl + C** in its tab. Not ⌘C — that copies.

---

## What each piece does

| Piece | Where it runs | Needed for |
|---|---|---|
| **API** (`finto-backend`) | Your Mac, port 4000 | Everything. Balances, payments, cards. |
| **Metro** (`finto-mobile`) | Your Mac, port 8081 | The phone app only |
| **Web** (`finto-web`) | Your Mac, port 5173 | The browser app only |
| **Database** | Supabase, in the cloud | Always on. Nothing to start. |

Only the database lives outside your Mac. Everything else stops when you close
the tab or shut the lid.

### The app is not installed on your phone

Tapping **Finto** in Expo Go does not open something stored on your phone — it
streams the app live from your Mac each time. So it only works when the Mac is
awake, both tabs are running, and the phone is on the same Wi-Fi.

To have Finto work anywhere with no Mac, it needs a real build. See
[Going further](#going-further).

---

## When something goes wrong

### "Could not connect to development server"

The usual one. Check, in order:

1. Is **Tab 2** (`npx expo start`) still running?
2. Is your phone on **Wi-Fi**, not 5G?
3. Same network as the Mac? On the phone: Settings → Wi-Fi → ⓘ next to the
   network. The IP should start with **192.168.1.**

### The app opens but every screen shows an error

**Tab 1 is not running.** The app loaded from Metro, but there is no API to get
data from. Start Tab 1.

### `EADDRINUSE: address already in use`

An old server is still holding the port. Kill it by port — not by name, which
often misses:

```bash
lsof -ti:4000 | xargs kill -9
```

Change `4000` to `8081` for Metro, `5173` for web.

### Nuclear option — stop everything

```bash
lsof -ti:4000 | xargs kill -9; lsof -ti:8081 | xargs kill -9; lsof -ti:5173 | xargs kill -9
```

Then start again from the top.

### The QR code stopped working

Your Mac's address changed — routers hand out new ones after a reboot. Scan the
QR again from Tab 2; it always shows the current address.

Check the current address with:

```bash
ipconfig getifaddr en0
```

### A red error screen on the phone

Tap **Copy**, then paste it to Claude. That text says exactly what broke.
*Dismiss* only hides it; *Reload JS* helps only after the cause is fixed.

### "Project is incompatible with this version of Expo Go"

Expo Go on iOS only ever runs the newest SDK. If Expo Go updates and the project
falls behind, it needs upgrading — ask Claude to do it.

---

## Checking things by hand

Is the API alive?

```bash
curl http://localhost:4000/health
```

Expect `{"status":"ok",...}`.

What is actually running?

```bash
lsof -ti:4000 | wc -l   # API — expect 1
lsof -ti:8081 | wc -l   # Metro — expect 1 or 2
```

Look in the database directly:

```bash
cd "/Users/marbellaelpantja/Documents/Finto Mobile App Designs Clickable/finto-backend" && npm test
```

53 tests. All should pass.

---

## Accounts

| Who | Email | Password |
|---|---|---|
| Sofia (main) | `sofia@marengo.studio` | `sofia2026-finto` |
| Alessia | `alessia@moretti.co` | `alessia2026-finto` |

Sofia's PIN is `4829`.

Sign in as both — on the phone and in the browser — and send money between them
to watch it arrive live on the other screen.

### Starting the data over

If the balances get messy:

```bash
cd "/Users/marbellaelpantja/Documents/Finto Mobile App Designs Clickable/finto-backend" && npm run db:seed
```

Back to $2,450.80 and the original eight transactions. **This wipes everything
you did** — every payment, every card change.

---

## What's in the folder

```
Finto Mobile App Designs Clickable/
├── START-HERE.md          ← this page
├── Finto Mobile App.dc.html   your original design
├── finto-backend/         the API, the ledger, the database
├── finto-web/             the browser app
└── finto-mobile/          the iPhone/Android app
```

Each folder has its own README with the detail.

---

## Going further

Things worth doing when you want them, all of which need a hand:

- **Install Xcode** so Claude can test the phone app itself, instead of relying
  on you to look. Free, but ~50 GB and a couple of hours.
- **Deploy it** so the app works without your Mac running — the API needs a host,
  and the phone app needs a real build (`eas build`) to become a normal app you
  tap on your home screen.
- **Add the missing pieces** — push notifications, live exchange rates, a real
  card processor. All three have a clearly marked spot in the code.

---

## One thing to know before this is real

This is a working app, not a working bank. Before it touches real money it needs
identity checks (KYC), sanctions screening, transaction monitoring, and a licence
or a banking partner. That is a legal and operational programme, not code.

The money handling underneath is built properly — integer arithmetic so nothing
is lost to rounding, double-entry bookkeeping, and locks that stop two payments
overdrawing the same balance. That part is real.
