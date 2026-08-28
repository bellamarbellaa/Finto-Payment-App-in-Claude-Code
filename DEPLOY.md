# Deploying Finto

Getting Finto onto the internet so anyone can use it from a link.

Three pieces, three homes:

| Piece | Goes to | Cost |
|---|---|---|
| Database | **Supabase** — already there | Free tier |
| API (`finto-backend`) | **Render** or Railway | Free tier |
| Web app (`finto-web`) | **Vercel** | Free |

The mobile app is a separate track — see [the last section](#the-mobile-app).

Budget about an hour the first time.

---

## Before you start: the IPv4 problem

Your Supabase database has **only an IPv6 address**. Plenty of cloud hosts are
IPv4-only, so a deployed API may not reach it — the same failure you already hit
on your phone's hotspot.

Fix it once, up front, by switching to Supabase's pooler, which has an IPv4
address.

1. Open your Supabase project
2. Click **Connect** at the top
3. Choose **Session pooler** — *not* Transaction pooler
4. Copy that connection string

It looks like:

```
postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

Keep it somewhere safe; you will paste it in Step 2 with your real password.

> **Not the Transaction pooler.** It gives out a different connection per
> statement, which breaks the row locks the ledger uses to stop two payments
> overdrawing one balance. Session pooler, port 5432.

---

## Step 1 — Generate production secrets

New secrets for production. Never reuse the development ones.

```bash
cd finto-backend
echo "JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
echo "JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
echo "COOKIE_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
```

Copy the three lines it prints. You will paste them in the next step.

---

## Step 2 — Deploy the API to Render

1. Go to **https://render.com** and sign up with GitHub
2. **New** → **Web Service**
3. Connect your `Finto-Payment-App-in-Claude-Code` repository
4. Fill in:

| Field | Value |
|---|---|
| Name | `finto-api` |
| Root Directory | `finto-backend` |
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free |

5. Click **Advanced** → **Add Environment Variable**, and add:

```
NODE_ENV=production
DATABASE_URL=          ← the session pooler string, with your real password
JWT_ACCESS_SECRET=     ← from Step 1
JWT_REFRESH_SECRET=    ← from Step 1
COOKIE_SECRET=         ← from Step 1
COOKIE_SECURE=true
COOKIE_SAMESITE=none
CORS_ORIGINS=https://placeholder.vercel.app
PUBLIC_BASE_URL=https://finto-api.onrender.com
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
APP_LINK_SCHEME=finto
```

`CORS_ORIGINS` is a placeholder for now — you do not know the web address yet.
You will correct it in Step 4.

6. **Create Web Service**. First build takes a few minutes.

When it finishes, check it:

```
https://finto-api.onrender.com/health
```

You want `{"status":"ok",...}`.

> **Free tier sleeps.** After 15 minutes idle the service stops, and the next
> request takes ~50 seconds to wake it. Fine for a portfolio; mention it in your
> README so nobody thinks it is broken.

---

## Step 3 — Set up the database

The tables are already there from your local run, so there is nothing to do —
the deployed API points at the same Supabase project.

If you ever need to rebuild them, run this locally with `DATABASE_URL` set to
the pooler string:

```bash
cd finto-backend && npm run db:migrate && npm run db:seed
```

---

## Step 4 — Deploy the web app to Vercel

1. Go to **https://vercel.com** and sign up with GitHub
2. **Add New** → **Project**, import the same repository
3. Configure:

| Field | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | `finto-web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

4. Expand **Environment Variables** and add:

```
VITE_API_URL=https://finto-api.onrender.com
```

**This is read at build time, not run time.** Changing it later means
redeploying.

5. **Deploy**

You will get an address like `https://finto-payment-app.vercel.app`.

### Now fix CORS

Back in Render → your service → **Environment**, change:

```
CORS_ORIGINS=https://finto-payment-app.vercel.app
```

Use your real Vercel address. Save — Render restarts automatically.

Without this the browser blocks every request and the app appears dead.

---

## Step 5 — Check it works

Open your Vercel address and sign in as `sofia@marengo.studio` /
`sofia2026-finto`.

If something fails:

| Symptom | Cause |
|---|---|
| "Blocked by CORS policy" | `CORS_ORIGINS` does not exactly match your Vercel address — check `https://`, no trailing slash |
| Signed out after every reload | `COOKIE_SAMESITE` is not `none`, or `COOKIE_SECURE` is not `true` |
| First request hangs ~50s | Free tier waking up. Normal. |
| 500 on login | API cannot reach the database — you are probably on the direct connection instead of the pooler |

Render logs are under **Logs** in the dashboard, and they say exactly what
failed.

---

## Step 6 — Put the link in your README

At the top:

```markdown
**[Try it live](https://finto-payment-app.vercel.app)** — sign in as
`sofia@marengo.studio` / `sofia2026-finto`

> Hosted on a free tier — the first load may take ~50 seconds while the
> API wakes up.
```

That line is the difference between a repo people read and one they use.

---

## The mobile app

Expo apps are not deployed like a website. Two routes:

**Expo Go with a published bundle** — free, no Apple account:

```bash
cd finto-mobile && npx eas update --branch production
```

Anyone with Expo Go can open it from a link. Needs a free Expo account and
`npm install -g eas-cli`.

**A real installable app** — `eas build` produces an `.ipa`/`.apk`. TestFlight
distribution needs an Apple Developer account ($99/yr). Android is free through
Google Play internal testing.

For a portfolio, the published bundle plus a screen recording is usually enough.

Whichever route, set the API address first — `finto-mobile/app.json`, under
`extra.apiUrl`, must point at your Render URL rather than localhost.

---

## What this costs

Nothing, on free tiers:

- **Supabase** — free up to 500 MB, pauses after a week of no activity
- **Render** — free, sleeps after 15 minutes idle
- **Vercel** — free, generous limits, no sleeping

The two sleep behaviours are the only real drawback, and only affect the first
request after a quiet period.

---

## Before this holds real money

Deploying is not the same as being production-ready:

- **Verify the database certificate.** Download Supabase's CA and set
  `DATABASE_CA_CERT`. Without it traffic is encrypted but the certificate is
  unverified.
- **Add error tracking** — Sentry or similar. Right now a production error is
  logged and lost.
- **Rotate secrets** on any suspicion of exposure.
- The regulatory work in the README's *not finished* section still applies.
