# Hey Nomads

Roommate matchmaking for people relocating to a city where they know nobody.
Matches are ranked on lifestyle fit, and the score is explainable rather than a
black box.

React 18 + Vite frontend, Express API on Vercel serverless, Postgres on Neon.

---

## Layout

```
frontend-react/
  api/index.js          # the whole API (44 routes)
  scripts/              # seeders, verifiers, local API harness
  src/pages/            # one file per route
  src/components/       # Layout, Navbar, UI primitives, UserAvatar
database/
    schema_v2.sql       # the live Postgres schema (structure only, no seed data)
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
npm run schema:apply      # applies the schema (idempotent)
npm run seed:reference    # cities, settlement checklist, resources
npm run seed:demo         # demo users, communities, events, chats
```

Both are idempotent. `scripts/seed-test-data.mjs` prints the accounts it creates.

`schema_v2.sql` creates tables; `seed-reference-data.mjs` is the only place
reference content is defined. Keeping them separate matters: when both seeded
the checklist, it ended up with two overlapping 12-row lists (24 rows) and two
resources with near-identical titles. The seeder upserts on the natural key and
prunes anything its lists no longer contain.

### The checklist and its links

Checklist tasks and resources both carry an external `url`. A task with no url
of its own inherits the best matching resource link for the reader's
destination, scoped to that task's category — so "Open a bank account" links to
the HDFC NRI page for someone moving to India and to the UK MoneyHelper guide
for someone moving to London. Adding a country means adding one row to
`RESOURCES` in the seeder.

Resources are scoped the same way: `/api/resources` without a destination
returns only the global guides rather than a wall of one city's content.

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
npm run verify            # everything below that needs no external service
npm run verify:security   # auth boundaries, rate limits, health — no database
npm run verify:fixtures   # checklist and resource fixtures — needs the database
npm run verify:api        # boots the API in-process, no server or port — needs the database

node scripts/smoke-test-api.mjs     # 20 checks against the running API
node scripts/verify-health-fails.mjs  # proves /api/health fails loudly
BASE_URL=https://your-deployment.vercel.app node scripts/production-walkthrough.mjs
```

`verify:fixtures` asserts the things that broke before: no duplicate titles, no
colliding order values, categories the UI can render, a banking link that
resolves for every destination country, and resources that do not leak one
city's guides into another's. `verify:api` boots `api/index.js` without binding
a port and walks register → onboarding → checklist → agreement, then deletes
the account it created. Both need `DATABASE_URL`; neither starts a server.

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