---
name: context:all-tests
description: "Testing group entrypoint/router — runner selection, verification commands, gates, and debugging procedures"
keywords: tests, testing, verification, gates, lint, playwright, qa, runners, debugging, coverage, eslint, build
related: []
date: 13-10-26
---

# Hey Nomads - All Tests

Last updated: 2026-10-13

Attach this file first when the task involves testing, verification, or test debugging.

This is the fast operator guide for the testing surface:

- which runner to use
- what command to start with
- how to quickly debug common failures
- which deeper file to read next

Do not load the whole `process/context/tests/` folder by default. Start here, then drill down.

---

## How This File Works

This is the `all-tests.md` entrypoint for the `tests/` context group. It follows the `all-*.md` routing convention:

1. Agents read `all-context.md` first and get routed here for testing tasks
2. This file gives quick decision rules and commands
3. For deeper details, agents follow the routing table below to specific docs

---

## What This Covers

- runner selection (there is no unit-test framework — read the decision guide)
- quick commands by concern
- fast debugging procedures
- current testing gaps worth remembering

## Read This When

Use this file when you need to:

- run verification after an implementation
- decide which verifier proves a claim
- debug a failing gate

## Quick Routing

| If you need... | Read next |
|---|---|
| the acceptance ledger and current PASS/BLOCKED state | `GATES.md`, then the focused `GATES.*.md` files at the repo root |
| the full script inventory (38 verifiers) | `README.md` "Verifying it works" |
| database safety rules before running anything | `AGENTS.md` §3 |

(No deeper test docs in this group yet. Add routing entries here as they are created.)

## Quick Decision Guide

There is **no unit-test framework** in this project. There is no Vitest, Jest, or
`@playwright/test` runner. Verification is done by standalone Node scripts that assert
and print a success token. Choose by what the claim actually needs:

### Use ESLint when

- the change must not introduce warnings or type-level mistakes
- `npm run lint` is wired to `eslint --max-warnings=0` and fails the build gate on any warning

### Use a `scripts/*.mjs` verifier when

- the claim is about API behaviour, matching scoring, fixtures, security boundaries, or the deploy contract
- these are the project's real tests; each prints a decisive success token

### Use Playwright directly when

- the claim needs a real rendered browser (layout, navigation, screenshots)
- `scripts/browser-qa.mjs` and `scripts/profile-layout-qa.mjs` drive it against a local Vite server

### Use the source-assertion gate when

- the claim is about wiring that cannot fail without a database
- `scripts/gates.mjs` checks source properties and prints `GATE_LINT_OK` / `GATE_BUILD_OK` / `GATE_DEMO_OK`

## Default Verification Order

Unless the task clearly needs a different path:

1. `npm run lint` — fastest, catches the most common breakage
2. `npm run build` — proves the bundle still builds
3. a narrow verifier for the specific behaviour
4. browser QA only when the real UI is the thing being verified

## Commands

| Concern | Runner | Command (cwd: `frontend-react`) |
|---|---|---|
| lint | ESLint | `npm run lint` |
| build | Vite | `npm run build` |
| full no-DB suite | shell | `npm run verify` |
| security / auth boundaries | script | `npm run verify:security` |
| deploy contract | script | `npm run verify:deploy` |
| checklist + resource fixtures | script | `npm run verify:fixtures` |
| API flows in-process | script | `npm run verify:api` |
| matching regression | script | `node --import ./scripts/dns-shim.mjs scripts/verify-matching.mjs` |
| demo tour (no DB needed) | script | `node scripts/demo-tour-qa.mjs` |
| demo wiring gate (no DB needed) | script | `node scripts/gates.mjs demo` |
| account classification self-check | script | `node scripts/check-account-kind.mjs` |
| browser QA | Playwright | `node --import ./scripts/dns-shim.mjs scripts/browser-qa.mjs <base-url>` |
| profile header layout | Playwright | `node scripts/profile-layout-qa.mjs <base-url>` |
| API against a live server | script | `node scripts/smoke-test-api.mjs` |

Database-backed scripts need `DATABASE_URL` pointing at the isolated test database.
Never run them without it — see Debugging Quick Reference.

## Debugging Quick Reference

- **DNS blocked network:** scripts that talk to the database must be launched with
  `node --import ./scripts/dns-shim.mjs ...` (resolves via DNS-over-HTTPS). Omitting it
  produces a connection timeout that looks like a dead database.
- **Wrong database target:** `scripts/require-test-db.mjs` refuses the deployed database.
  Do not weaken it. A missing `DATABASE_URL` is not a safe default.
- **Servers are reaped between tool invocations:** start the API and Vite, run the check,
  and stop them in one command, or the next call finds dead ports.
- **Wrong base URL:** `browser-qa.mjs`, `profile-layout-qa.mjs`, and `capture-discover.mjs`
  default their `BASE` to production. Always pass a local URL explicitly.
- **Port collisions:** clear 3100 (API) and 5199 (Vite) before starting.
- **Playwright:** the project depends on `playwright`, not `@playwright/test`; scripts
  import it directly rather than using a test runner.

## Known Gaps

- No unit-test framework: pure functions (notably `calcCompatibility()` matching scoring)
  are covered only by `scripts/verify-matching.mjs`, which requires the database.
- No CI workflow runs the suite automatically (`.github/` exists but no test job was found
  during this scan).
- Browser QA requires a signed-in session, so it needs the database and is BLOCKED
  whenever the isolated test DB is unreachable.
- Nothing currently covers visual regression; profile header changes at 1440px/390px are
  verified by eye unless `profile-layout-qa.mjs` can run.
