# Offline-first photo upload and Likes — backend handoff checklist

This workstream verified everything that can be verified without a database,
a storage token, or production access. This file names every verification that
remains blocked, the exact command or environment variable it needs, and the
reproduction steps for whoever holds the credentials. Gate G9 of
`GATES.offline.md` is ABANDONED for this session and handed off here.

## What shipped (offline-verified)

- `POST /api/upload` answers every request problem with its own status:
  401 (no token), 415 (unsupported type), 413 (over 4 MB, streaming cap),
  400 (empty body or magic-byte mismatch), 503
  (`code: 'storage-not-configured'` when the deployment has no storage token),
  and keeps the generic `Upload failed` message only for a real storage
  failure. Logic lives in `api/upload-guards.mjs` (pure, unit-tested).
- `GET /api/likes/sent` and `GET /api/likes/received` (auth required) serve
  only real-account rows, exclude blocked pairs in both directions, and drop
  incoming likes the caller has already answered. Builders live in
  `api/likes-queries.mjs` (pure, unit-tested).
- The client never claims "uploaded" without a server-returned URL, keeps a
  pending photo on the device via IndexedDB (`src/lib/photoUpload.js`), and
  the Likes screen (Sent/Received/Matches) renders only rows the API returns.
- Demo Mode answers `/likes/sent` and `/likes/received` from the same fixture
  set as its Matches tab; the demo banner labels the whole screen as
  simulated data.

Offline proof (all runnable with no network and no database):

| Gate | Command |
|---|---|
| lint | `node scripts/gates.mjs lint` |
| build | `node scripts/gates.mjs build` |
| unit tests | `node scripts/gates-offline.mjs unit` |
| upload route (real app, offline) | `node scripts/gates-offline.mjs upload` |
| likes route (real app, offline) | `node scripts/gates-offline.mjs likes` |
| UI suite (real browser, mocked routes) | `node scripts/gates-offline.mjs ui` |
| this checklist | `node scripts/gates-offline.mjs docs` |

## Blocked verifications

| Verification | Exact command / variable | Why blocked | What it proves |
|---|---|---|---|
| Live blob upload | Deployed `POST /api/upload` with a real image and a signed-in user; `BLOB_READ_WRITE_TOKEN` must exist in the deployment environment | No `BLOB_READ_WRITE_TOKEN` is available to this session; writing to production storage needs explicit human approval | The happy path returns `{ url }` and the image is publicly fetchable |
| Storage configuration inventory | `vercel env ls` (names only — never print values; Vercel token is in the Netlify/`cfg` config file, in-process use only) | Needs deployment credentials | Whether `BLOB_READ_WRITE_TOKEN` is present at all; if absent, every upload correctly answers 503 `storage-not-configured` |
| Live likes rows | `GET /api/likes/sent` and `GET /api/likes/received` against a database seeded with two real users, one blocked pair, and one demo-domain (`@heynomads.app`) account | No isolated test database credential is available; the production database is off limits for testing | Rows include the real target, exclude the blocked pair and the demo account |
| DB-backed API flows | `npm run verify:api` | Requires a database URL; a missing env var means the deployed database, which tests must never touch | End-to-end API contract against a real database |
| DB-backed fixtures | `npm run verify:fixtures` | Same | Seeded fixture consistency |
| Security verification | `npm run verify:security` | Same | Auth/authz surface |
| Deploy contract | `npm run verify:deploy` | Needs deployment access | Deployed contract matches local |
| Walkthrough / journey | `npm run qa:walkthrough`, `npm run verify:journey` | Both need a live database-backed server | Full user journeys |

Safety rules honoured by this workstream: no test, seed, or cleanup command
was run against any database; `ALLOW_DEPLOYED_DB_TESTS` was never set; the
`frontend-react/scripts/require-test-db.mjs` guard was not weakened;
`scripts/audit-write-paths.mjs` still reports zero unguarded writers (this
work added no database writer); the `account_kind` migration
(`database/migrations/2026-10-10_add_account_kind.sql`) remains prepared and
never auto-applied; no production mutation was performed.

## Reproduction steps

### Live E2E upload (handoff)

1. Confirm storage is configured: run `vercel env ls` and check that
   `BLOB_READ_WRITE_TOKEN` is listed (name only; do not print the value). If
   it is missing, stop — every upload will correctly answer 503
   `storage-not-configured` until it is added.
2. Deploy the branch or wait for the production deploy that contains this
   work.
3. Sign in as a genuine test user on the deployed app (creating or mutating
   production accounts requires explicit human approval — use an approved
   test account, never a real user's).
4. Open Profile → Complete profile → step 7 (Photo), pick a real JPG under
   4 MB.
5. Expected: the chip moves `Saved on this device` → `Uploading…` →
   `Uploaded to your profile`, and only the last state ever shows a URL.
6. Verify the returned URL is publicly fetchable (open it in a fresh
   browser session).
7. Negative checks on the same deployment: a text file must answer 415 in
   the network tab; a >4 MB image must answer 413; and with the token
   temporarily absent from a preview deployment, a valid image must answer
   503 `storage-not-configured`, never a bare 500.

### Live likes queries (handoff)

1. Provision an **isolated test database** (a throwaway Postgres or a
   Neon/Supabase branch). Never point these steps at the production
   database.
2. Apply the schema (`npm run schema:apply` with that isolated
   `DATABASE_URL`) and seed at minimum: user A (real domain), user B (real
   domain), user C with email `demo.something@heynomads.app`, and a `blocks`
   row between A and B.
3. As user A, like B and C through the app or SQL inserts into `swipes`.
4. Call `GET /api/likes/sent` with a JWT for A. Expected: B appears, C does
   not (non-real account), and the blocked-pair exclusion holds when B has
   blocked A.
5. Call `GET /api/likes/received` with a JWT for B. Expected: A appears only
   while B has not swiped A; after B likes or passes on A, the row drops out.
6. Run the same assertions offline first via
   `node scripts/gates-offline.mjs likes` so any failure isolates the
   database, not the code.

## Positive control

The docs gate (`node scripts/gates-offline.mjs docs`) fails if this file
omits any required item. Its built-in mutation check removes the string
`BLOB_READ_WRITE_TOKEN` from a temp copy of this document and asserts the
same predicate rejects that copy — so a checklist that merely mentions
"the token" without naming it cannot pass. Deleting the token name from this
file makes the gate print `checklist is missing: BLOB_READ_WRITE_TOKEN` and
exit 1.
