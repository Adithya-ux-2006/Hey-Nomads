# Hey Nomads

Roommate matchmaking for people relocating to a city where they know nobody.
Matches are ranked on lifestyle fit, and the score is explainable rather than a
black box.

React 18 + Vite frontend, Express API on Vercel serverless, Postgres on Neon.

---

## Layout

```
frontend-react/
  api/index.js          # the whole API (43 routes)
  scripts/              # seeders, smoke test, local API harness
  src/pages/            # one file per route
  src/components/       # Layout, Navbar, UI primitives, UserAvatar
  database/
    schema_v2.sql       # the live Postgres schema
```

The API is a single file on purpose. `GET /api/health` is the entry point for
verifying the database actually answers.

---

## Setup

Requires Node 20+ and a Neon Postgres connection string.

```bash
cd frontend-react
npm ci
```

Create `frontend-react/.env`:

```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=<any long random string>
```

Apply `database/schema_v2.sql`, then seed:

```bash
node scripts/seed-reference-data.mjs   # cities, settlement tasks, resources
node scripts/seed-test-data.mjs        # demo users, communities, events, chats
```

Both are idempotent. `scripts/seed-test-data.mjs` prints the accounts it creates.

---

## Running locally

```bash
# terminal 1 — the real Vercel handler, on :3100
node --import ./scripts/dns-shim.mjs scripts/local-api.mjs

# terminal 2 — Vite on :5173, proxying /api to :3100
npm run dev
```

`dns-shim.mjs` is only needed where your network blocks DNS for the database
host; it resolves via DNS-over-HTTPS. Harmless to include elsewhere.

---

## Verifying it works

```bash
node scripts/smoke-test-api.mjs     # 20 checks against the running API
node scripts/verify-health-fails.mjs  # proves /api/health fails loudly
BASE_URL=https://your-deployment.vercel.app node scripts/production-walkthrough.mjs
```

---

## Deploying

Push to `main`. Vercel builds `frontend-react/` as a Vite app plus a serverless
function at `api/index.js`. Set `DATABASE_URL` and `JWT_SECRET` as project env
vars. `SENTRY_DSN` and `VITE_SENTRY_DSN` are optional and stay inert if unset.

---

## Matching

`calcCompatibility()` in `api/index.js` scores six categories — lifestyle, budget,
location, move-in, interests, habits — each against its own ceiling, blended by
weights stored in the `match_weights` table. The category ceilings sum to 100, so
the total is always 0-100. `/api/roommates/recommended` and `/api/discover` both
use it and both return the per-category `breakdown` alongside the score.

---

## Technologies

- **Frontend**: React 18, Vite, Tailwind, Framer Motion
- **Backend**: Express, pg, JWT auth
- **Database**: Postgres (Neon)