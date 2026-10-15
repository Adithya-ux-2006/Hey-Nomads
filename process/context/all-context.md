---
name: context:all-context
description: "Root context entrypoint and router for Hey Nomads — architecture, stack, patterns, environment, and routing to context groups"
keywords: context, architecture, stack, patterns, routing, repository, conventions, environment, structure
related: []
date: 13-10-26
---
# Hey Nomads - All Context

Last updated: 2026-10-13

This file is the root context entrypoint for the repo.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**How agents use it:**

1. Agent reads `all-context.md` first (this file)
2. Finds the relevant context group from the routing tables below
3. Reads that group's `all-{group}.md` entrypoint
4. Only then loads the specific deep doc needed

This layered routing keeps context windows small. Never load the whole `process/context/` tree.

**What each `all-{group}.md` must contain:**

- Scope (what the group covers and does NOT cover)
- Read-when rules (when an agent should load this group)
- Quick procedures or decision rules
- Source paths (list of deeper docs in the group)
- Update triggers (when to refresh this group's content)
- Routing to deeper docs within the group

---

## Quick Start

For most substantial tasks:

1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

Before any implementation work also read the project's permanent rules in
[AGENTS.md](../../AGENTS.md) — database safety, account classification, and the
mandatory frontend design reference override kit defaults.

---

## Current Root Entry Points

<!-- The two tables below (Root Entry Points + Context Groups) are GENERATED from each
     context doc's frontmatter by `discover-context.mjs --emit-routing`. Do NOT hand-edit
     between the GENERATED markers — your edits will be overwritten on the next rebuild.
     To change a row, edit the owning doc's frontmatter (description / keywords) and re-emit.
     `--check-routing` fails lint if this block drifts from the frontmatter on disk. -->

<!-- GENERATED:routing -->
| File | Read when |
|---|---|
| `process/context/all-context.md` | any substantial planning, research, review, or implementation task |
| `process/context/planning/all-planning.md` | Planning group entrypoint/router - plan shapes, SIMPLE vs COMPLEX calibration, and planning references |
| `process/context/tests/all-tests.md` | Testing group entrypoint/router — runner selection, verification commands, gates, and debugging procedures |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `planning/` | `process/context/planning/all-planning.md` | Planning group entrypoint/router - plan shapes, SIMPLE vs COMPLEX calibration, and planning references |
| `tests/` | `process/context/tests/all-tests.md` | Testing group entrypoint/router — runner selection, verification commands, gates, and debugging procedures |
<!-- /GENERATED:routing -->

## Task Routing Table

<!-- The "Load first" column always starts with all-context.md. -->
<!-- The "Then load" column points to the group entrypoint, then optionally a deep doc. -->

| Task type | Load first | Then load |
|---|---|---|
| general repo research | `all-context.md` | the domain file named by the task |
| implementation planning | `all-context.md`, `planning/all-planning.md` | the active plan in `process/general-plans/active/` |
| test planning or verification | `all-context.md`, `tests/all-tests.md` | the specific test runner / gate doc |
| debugging | `all-context.md`, `tests/all-tests.md` when tests or runtime are involved | the smallest domain doc explaining the failure |
| UI/UX work | `all-context.md` | `DESIGN.md`, then the apple-design skills (see AGENTS.md §1) |
| database or schema work | `all-context.md` | `database/schema_v2.sql`, then `database/migrations/` |
| auth or matching work | `all-context.md` | `frontend-react/api/index.js` plus the relevant `GATES.*.md` |
| infra / deployment | `all-context.md` | `README.md` "Deploying", `vercel.json`, `netlify.toml` |
| context maintenance | `all-context.md` | run `audit-context` after edits |

| If the task involves... | Start with |
|---|---|
| architecture or stack questions | this file |
| testing or verification | `process/context/tests/all-tests.md` |
| creating a new plan | `process/context/planning/all-planning.md` |

## Context Group Lifecycle

Context groups are durable knowledge domains, not feature folders.

Create a group when:

- a topic has 3+ durable docs
- a single doc exceeds roughly 800 lines with separable subtopics
- multiple agents repeatedly need only one slice of a large context file
- the topic maps to a stable operational domain (tests, infra, database, auth, UI, workflows, etc.)

Do not create a group when:

- the content is a temporary report
- the content is a plan or execution artifact
- the topic is feature-specific and belongs in `process/features/...`

Move or split one group at a time. Use `all-{group}.md` entrypoints. Run the `audit-context` skill after every context organization change.

## Naming Convention

There are no `README.md` files inside `process/context/`.

Canonical entrypoints use `all-*.md`:

- root: `process/context/all-context.md`
- group: `process/context/{group}/all-{group}.md`

Each `all-{group}.md` file should act as the attachable quick router for that domain:

- tell the agent what the group covers
- give quick procedures and decision rules
- route to smaller deeper files

## Context Update Protocol

When durable project knowledge changes:

1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `audit-context`

---

## Repository Structure

```
Hey Nomads/
  frontend-react/
    api/
      index.js           -- the whole Express API; default-exports for Vercel serverless
      account-kind.mjs    -- account classification (REAL / TEST / DEMO), fail-closed
    src/
      pages/              -- 22 route components, one file per route
      components/         -- Layout, Navbar, UI primitives, UserAvatar
      lib/                -- api (fetch client), demoMode, demoProfiles, useAsync
      assets/
    scripts/              -- 38 seeders, verifiers, QA harnesses, gate runners
    dist/                 -- vite build output (generated)
    vite.config.js, tailwind.config.js, postcss.config.js, eslint.config.js, vercel.json
  database/
    schema_v2.sql         -- live Postgres schema (structure only, no seed data)
    migrations/           -- dated idempotent migrations (NOT auto-applied)
  docs/                   -- project documentation
  process/                -- agent context system (this tree)
    context/              -- all-context.md + context groups
    general-plans/        -- active / completed / backlog plans
    features/             -- feature-scoped plan storage
    development-protocols/-- RIPER-5 methodology docs (kit-managed)
  DESIGN.md               -- product design system
  README.md               -- setup, verification, deployment
  TEST_ACCOUNTS.md        -- seeded account inventory
  GATES.md, GATES.*.md    -- acceptance ledgers (CHECK:/EXPECT:)
  AGENTS.md, CLAUDE.md    -- agent harness instructions
  opencode.json           -- opencode config (plugin + skills path)
  netlify.toml, vercel.json
```

## Technology Stack

- **Language:** JavaScript (ESM). React components are `.jsx`; no TypeScript at runtime
  (`@types/react` is present only for editor hints).
- **Frontend:** React 18.2, React Router 6.22, Vite 5.2, Tailwind CSS 3.4,
  Framer Motion 11.0, lucide-react 0.363.
- **Backend:** Express 4.21, `pg` 8.13, `jsonwebtoken` 9.0, `bcryptjs` 2.4.
- **Database:** PostgreSQL on Neon. SSL required; connections go through
  `pg` from `frontend-react/api/index.js`.
- **Auth:** JWT bearer tokens, `JWT_SECRET` signed, `bcryptjs` password hashing.
- **Observability / media:** `@sentry/node` + `@sentry/react` 11.4 (inert when
  `SENTRY_DSN` / `VITE_SENSE_DSN` unset), `@vercel/blob` 2.8.
- **Testing / QA:** Playwright 1.64 (browser QA), ESLint 8.57 (`--max-warnings=0`),
  plus a large set of standalone `scripts/*.mjs` verifiers.
- **Deploy:** Vercel serves `frontend-react/` as a Vite app with `api/index.js` as a
  serverless function (`vercel.json`). `netlify.toml` also exists at the repo root.
- **Package manager:** npm (`package-lock.json`), Node 20+.

## Key Patterns and Conventions

**Single-file API.** All 56 route registrations live in `frontend-react/api/index.js`,
which ends with `export default (req, res) => app(req, res);` for the Vercel handler shape.
Routes are registered as `app.<verb>("/api/...", ...)`.

**Pages map to routes.** One component per route under `src/pages/` (22 files). Shared
chrome is `src/components/Layout.jsx` + `Navbar.jsx`; primitives live in `src/components/UI.jsx`.

**Matching is server-side and explainable.** `calcCompatibility()` in `api/index.js`
scores six categories (lifestyle, budget, location, move-in, interests, habits), each
against its own ceiling, blended by weights from the `match_weights` table. Category
ceilings sum to 100, so totals are always 0-100, and both `/api/roommates/recommended`
and `/api/discover` return a per-category `breakdown`.

**Demo mode is a transport, not a fork.** `src/lib/demoMode.js` holds a session-scoped
flag and canned responses; `src/lib/api.js` intercepts *before* any auth token is read.
The tour drives the real Feed / Matches / Messages screens. `setToken`/`clearAuth`
both exit demo, and `src/App.jsx` bypasses `PrivateRoute` while demo is active.

**Account classification fails closed.** `api/account-kind.mjs` derives REAL / TEST / DEMO
from email prefixes and domains (`QA_LOCAL_PREFIXES`, `DEMO_DOMAIN`). Unknown
classification is treated as ineligible for discovery, matching, and authorization.

**Database safety is non-negotiable.** `scripts/require-test-db.mjs` is a fail-closed
guard that refuses the deployed database; `scripts/audit-write-paths.mjs` must report
zero unguarded writers. See AGENTS.md §3 before touching any DB script.

**Network-blocked environments.** Several scripts need `node --import ./scripts/dns-shim.mjs`
because that network blocks DNS for the database host; the shim resolves via DNS-over-HTTPS.

**Frontend design.** Every UI change must follow AGENTS.md §1: load the relevant
`apple-design*` skills from disk (they are not in the tool registry), and preserve the
coral/teal one-accent identity defined in `DESIGN.md`.

## Environment and Configuration

**Config files:** `frontend-react/vite.config.js`, `tailwind.config.js`,
`postcss.config.js`, `eslint.config.js`, `vercel.json`, root `netlify.toml`,
root `opencode.json`. Local env lives in `frontend-react/.env` and repo-root `.env.local`
(git-ignored).

**Env var groups (names only, never values):**

- Database: `DATABASE_URL`, `HEALTH_TOKEN`
- Auth: `JWT_SECRET`
- API / runtime: `VITE_API_URL`, `API_BASE`, `BASE_URL`, `LOCAL_API_PORT`, `TOUR_PORT`, `API_PORT`
- Observability: `SENTRY_DSN`, `VITE_SENTRY_DSN`, `VERCEL_ENV`
- Credentials for smoke runs: `SMOKE_EMAIL`, `SMOKE_PASSWORD`
- Safety overrides (deliberate, documented use only — see AGENTS.md §3):
  `ALLOW_DEPLOYED_DB_TESTS`, `ALLOW_DEPLOYED_SMOKE`, `ALLOW_PRODUCTION_WALKTHROUGH`,
  `CONFIRM_TEST_DATABASE_HOST`
- QA targeting: `EXPECT_ENDPOINT_SUBSTRING`

## Verification and Gates

Acceptance state lives in `GATES.md` plus the focused ledgers `GATES.authz.md`,
`GATES.feed.md`, `GATES.like.md`, `GATES.safety.md`, and `GATES.ctx-setup.md`.
Gates are `CHECK:` / `EXPECT:` pairs; never mark PASS without output from the named
command.

- `npm run verify` — lint + security + fixtures + api + deploy contract
- `npm run lint` — eslint with `--max-warnings=0`
- `npm run build` — vite production build
- `scripts/demo-tour-qa.mjs`, `scripts/gates.mjs demo` — run without a database
- Everything database-backed is BLOCKED while the isolated test DB is unreachable

## Open Questions and Outstanding Work

Tracked in the ledgers rather than here, so this stays short:

- `GATES.md` G3/G5/G6/G7/G9 are **BLOCKED** on the isolated test database being
  reachable; the matching regression, API flows, and browser/layout QA have not run.
- `GATES.md` G11 (matching criteria and exact scoring formula documented from the
  implementation) is **PENDING**.
- `database/migrations/2026-10-10_add_account_kind.sql` is **not applied**; account
  classification is email-derived until it is.
- Roughly 110 leftover test-account rows may be classified REAL in the feed. Cleanup
  is inventory-only until explicit approval — see AGENTS.md §3/§4.
- Profile header changes at 1440px/390px remain visually unconfirmed (needs G7).

## Scan Metadata

- Generated: 2026-10-13
- Repo HEAD: 42c324d3fcd1ab9df42635b605d6ea39eec67596
- Mode: Flow A (fresh setup; `process/` contained only kit-installed files)
- Package manager: npm (`frontend-react/package-lock.json`)
