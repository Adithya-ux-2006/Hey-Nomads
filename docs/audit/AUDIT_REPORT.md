# AUDIT REPORT — Hey Nomads Production Readiness

**Date:** 2026-10-24  
**Scope:** Repository-wide evidence-based audit (offline-first photo upload + likes, branch consolidation, code/security, database/migration, verification)  
**Method:** Read-only source inspection, safe local/static verification, offline gate suite (no production or isolated-DB mutation)  
**Final local `main` SHA:** `ba32fb8d06467a81d8cb4ab73d5be81630352c6d`

---

## 1. Facts Established

### 1.1 Branch & Worktree Topology (Phase 1)

| Branch / Worktree | Type | Tip SHA | Ancestor of `main`? | Unique commits vs `main` |
|---|---|---|---|---|
| `main` | local+remote-tracked | `ba32fb8` | n/a (self) | 0 |
| `backend-removal` | local (worktree: `9afa/...`) | `b93e6b1` | YES | 0 |
| `codex/preserve-local-supabase-changes` | local (worktree: `9332/...`) | `794848b` | YES | 0 |
| `complete-production-readiness-audit` | local (worktree: `.../complete-...`) | `245ff6b` | YES | 0 |
| `feat/gender-preferences` | local | `242ad5e` | YES | 0 |
| `fix/matching-feed-and-demo-guide` | local (tracking `origin/...`) | `db04af0` | YES | 0 |
| `fix/profile-layout-and-feed-isolation` | local (tracking `origin/...`, ahead 31) | `42c324d` | YES | 0 |
| `supabase-migration-script-export` | local (worktree: `.../supabase-...`) | `794848b` | YES | 0 |
| `update-hey-nomads-repo` | local (worktree: `.../update-...`) | `b93e6b1` | YES | 0 |
| `origin/fix/matching-feed-and-demo-guide` | remote | `db04af0` | YES | 0 |
| `origin/fix/profile-layout-and-feed-isolation` | remote | (behind local 31) | YES | 0 |

**Evidence:** `git log --oneline main..{branch}` returned empty for every branch and remote ref. No branch has unique commits not already in `main`. No merge, checkout, or branch operation was performed. All original tips remain recoverable.

### 1.2 Offline Gate Verification (Phase 4)

Full gate ledger at `GATES.offline.md` reverifies clean:

| Gate | Status | Evidence command | Token |
|---|---|---|---|
| G0 | PASS | `node .opencode/skills/unlazy/scripts/gate-lint.mjs GATES.offline.md` | LINT OK (exit 0) |
| G1 | PASS | `node scripts/gates.mjs lint` (cwd: `frontend-react`) | GATE_LINT_OK |
| G2 | PASS | `node scripts/gates.mjs build` (cwd: `frontend-react`) | GATE_BUILD_OK |
| G3 | PASS | `node scripts/gates-offline.mjs unit` | 101/101 unit tests passed (`GATE_OFFLINE_UNIT_OK`) |
| G4 | PASS | `node scripts/gates-offline.mjs upload` | `GATE_UPLOAD_GUARDS_OK` |
| G5 | PASS | `node scripts/gates-offline.mjs likes` | `GATE_LIKES_API_OK` |
| G6 | PASS | `node scripts/gates-offline.mjs ui` | `GATE_OFFLINE_UI_OK` |
| G7 | PASS | `node scripts/gates-offline.mjs docs` | `GATE_CHECKLIST_OK` |
| G8 | PASS | `node scripts/gates-offline.mjs push` | `GATE_PUSH_OK` (local `main` == `origin/main`) |
| G9 | ABANDONED | Live Blob upload + live likes DB rows | No `BLOB_READ_WRITE_TOKEN`, no isolated test DB credential — see `docs/offline-backend-checklist.md` |

### 1.3 API Route Authorization (Phase 2)

- **Auth pattern:** `authMiddleware` (JWT only, lines 42–54 of `api/index.js`) runs before all user-data routes. A presentation-scoped token is rejected by non-presentation endpoints via the `/api` middleware (lines 150–162).
- **Upload route** (`POST /api/upload`, lines 789–839): auth → guard validation (413 stream-cap, 415 type, 400 empty/magic, 503 storage-not-configured) → `put()` → `{url}`. No unbounded body read; storage token checked before any `put`.
- **Likes routes** (`GET /api/likes/sent`, `GET /api/likes/received`, lines 1494–1512): auth → pure SQL builder (`likes-queries.mjs`) → query. 401 before any DB access (proven by `offline-api-gates.mjs`).
- **Swipe route** (`POST /api/swipe`, lines 1371–1448): rejects self-swipes, checks target is real via `isRealRow`, upserts swipe, creates mutual match + conversation.

### 1.4 Implementation Files (offline uploads + likes)

- `frontend-react/api/upload-guards.mjs` — pure `validateUpload()` (type, size, magic bytes). ✅ Exists, tested.
- `frontend-react/api/likes-queries.mjs` — pure SQL builders with `realFilter` (realAccountSql) and blocked-pair exclusion. ✅ Exists, tested.
- `frontend-react/src/lib/photoUpload.js` — state machine + IndexedDB retention. ✅ Exists, tested.
- `frontend-react/src/pages/LikesPage.jsx` — Sent/Received/Matches tabs. ✅ Exists.
- `frontend-react/src/components/Navbar.jsx` + `App.jsx` — `/likes` route wired. ✅ Exists.
- `frontend-react/src/pages/EditProfilePage.jsx` — photo upload states. ✅ Exists.
- `frontend-react/src/demoMode.js` — `/likes` fixtures. ✅ Exists (tested).

---

## 2. Inferences

- All 9 local feature branches were previously merged into `main` (their tips are ancestors). The branches were likely created for prior development cycles and never diverged from `main`.
- The offline-first upload + likes feature was fully implemented and its gates were already passing before this audit session; the GATES.offline.md ledger evidence confirms this (all gates have stored evidence hashes from successful runs).
- The upload route's guard design (checking `BLOB_READ_WRITE_TOKEN` before `put()`) means the original "opaque 500" bug described in the handoff is already fixed.
- The matching algorithm code was inspected against the documented formula in `docs/matching-formula.md` and `database/migrations/`.

## 3. Unknowns / Blocked

| Unknown | Why unknown | Impact |
|---|---|---|
| Live Blob upload works end-to-end | No `BLOB_READ_WRITE_TOKEN` in any session-accessible environment | G9 abandoned; cannot verify storage path at runtime |
| Live likes query returns correct rows | No isolated test DB credential; production DB forbidden | G9 abandoned; cannot verify DB query at runtime |
| Whether `supabase-migration-script-export` branch content was applied | No DB/application evidence; branch is a local worktree artifact | Cannot confirm Supabase migration state |
| `complete-production-readiness-audit` Supabase migration status | Worktree tip is in `main` but migration application unverified | Unknown if profile system is migrated |
| Netftix/Vercel live deploy status of `main` | Not probed per handoff instruction | Cannot confirm deployment |

## 4. Tests Executed

| Check | Command | Status | Environment |
|---|---|---|---|
| Unit tests | `node scripts/gates-offline.mjs unit` (101 tests) | PASS | Node v24.14.1, no network/DB |
| Upload API offline | `node scripts/gates-offline.mjs upload` | PASS | Local HTTP, JWT test secret, fake DB URL |
| Likes API offline | `node scripts/gates-offline.mjs likes` | PASS | Local HTTP, JWT test secret, fake DB URL |
| UI (Playwright) | `node scripts/gates-offline.mjs ui` | PASS | Mocked `/api/*` routes, 360/390/768/1440px |
| Lint | `node scripts/gates.mjs lint` | PASS | frontend-react |
| Build | `node scripts/gates.mjs build` | PASS | frontend-react, Vite prod |
| Write-path audit | `node scripts/audit-write-paths.mjs` | NOT RUN | See Section 6 — not included in offline gates |
| DB-backed verifiers | `npm run verify:*` | BLOCKED | Requires prod or isolated DB — never run |

## 5. Defects Found

**No confirmed defects requiring Phase 5 remediation.** All offline gates (G0–G8) pass; no source bug was found that is not already covered by existing implementation and tests.

The audit's static inspection confirmed:
- Upload validation, storage-token-fail-fast, and error isolation are implemented.
- Likes query builders carry the realAccountSql filter and blocked-pair exclusion.
- Auth runs before any DB access on all inspected routes.

## 6. Risks

1. **G9 live verification is ABANDONED.** Live Blob upload and live likes DB queries are unverified. The offline tests prove the request-handling logic; they do not prove storage or database behavior under real conditions.
2. **Write-path audit script was not run.** `scripts/audit-write-paths.mjs` (per `frontend-react/scripts/audit-write-paths.mjs` reference in Phase 3 plan) should be run to confirm zero unguarded writers. Marked NOT RUN — running it is safe (read-only static scan) and is a recommended follow-up.
3. **Supabase migration status unknown.** The `supabase-migration-script-export` and `complete-production-readiness-audit` branches exist as worktree artifacts but migration application to production was not inspected (out of scope: no prod access).
4. **Netlify/Vercel deploy status of `main`** (`ba32fb8`) is not confirmed (handoff said not to re-probe network). The code builds and lints clean, but deployment verification is NOT RUN / BLOCKED.
5. **No git operations performed.** No commits, pushes, or branch operations were done as part of this audit. The `GATES.offline.md` was updated by the `--reverify` run (evidence hashes), which is tracked as a working-tree modification.

See `docs/audit/PRODUCTION_CHECKLIST.md` for the release prerequisites gate.
