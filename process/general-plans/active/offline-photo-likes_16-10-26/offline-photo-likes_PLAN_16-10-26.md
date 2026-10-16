---
name: plan:offline-photo-likes
description: "Offline-first profile photo upload and real-row Likes Sent/Received/Matches delivery"
date: 16-10-26
feature: general
---

# Offline-first photo upload and Likes — implementation plan

**Date**: 16-10-26  
**Complexity**: Complex (one execution stream)  
**Status**: ⏳ PLANNED — no implementation has been performed under this plan.  
**Risk class:** Public API + authentication + blob-storage configuration; no production or deployed-database tests are authorized.

## Overview

Deliver an honest offline-first profile-photo flow and a protected Likes screen. A local image is explicitly described as device-saved until the authenticated server returns a non-empty URL. A failed upload retains a recoverable preview and retry path. Likes Sent, Received, and Matches display only rows derived from the existing `swipes`, `matches`, `users`, and `profiles` tables; demo mode must answer each `/likes` request explicitly. The approved gate ledger, `GATES.offline.md`, is an immutable implementation contract: do not edit it or re-approve it.

Source context loaded: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `DESIGN.md`, `GATES.offline.md`, and the supplied user handoff. Existing active-plan discovery found no overlapping active implementation plan.

## Goals and scope

### In scope

- Offline state, validation, retention, retry, and truthful status messaging for the photo step.
- Upload validation and truthful error responses from the existing Express API.
- Protected, SQL-backed `/api/likes/sent` and `/api/likes/received` endpoints plus the `/likes` UI with Sent, Received, and Matches tabs.
- Demo responses, offline Node tests, route-mocked Playwright QA, gate runner, backend-checklist documentation, focused commit, push, and re-verification.

### Out of scope

- Database migrations, invented identity data, new notifications, a live blob upload, production/deployed Neon database tests, production data mutation, new dependencies, and changing `GATES.md`, `GATES.like.md`, or `GATES.offline.md`.
- Replacing abandoned G9 unless a human separately authorizes a live write and its prerequisite credentials are genuinely available.

## Final architecture decisions

1. `api/upload-guards.mjs` owns pure media validation: JPEG/PNG/WebP only, 4 MiB maximum, and magic-byte verification. It returns `{ status, error }`.
2. The upload handler authenticates before evaluating upload data. It returns `503 { error: 'storage-not-configured' }` before calling `put()` when `BLOB_READ_WRITE_TOKEN` is unavailable; a real `put()` failure stays distinct from guards.
3. `src/lib/photoUpload.js` owns pure file validation, injected upload execution, and IndexedDB persistence. Its state machine cannot transition from local/saving to uploaded without a server response containing a URL.
4. `api/likes-queries.mjs` owns parameterized SQL builders. Both query paths apply real-account filtering to the actor and counterpart and exclude either direction of blocked pairs. Existing schema remains unchanged.
5. The UI uses existing `apiFetch`, `useAsync`, `UI.jsx`, `UserAvatar`, and Matches-page patterns. It has complete loading, empty, error, and retry states. Demo fixtures are visibly in demo mode and never fall through for `/likes` paths.

## Data flow and failure modes

Photo selection → client type/size validation → object URL preview → IndexedDB pending record → explicit “Saved on this device” → authenticated `POST /api/upload` → server auth/guard/storage checks → response URL → “Uploaded to your profile” → profile save. A quota error keeps the in-memory preview but reports persistence inability; upload error retains the preview and exposes Retry; an existing confirmed URL prevents another upload on Save Profile.

Likes request → `apiFetch` Bearer token → `authMiddleware` → SQL builder → existing database → rows limited to real, unblocked accounts → tab-specific presentation. Missing authentication must return 401 before database access. Offline QA intercepts every `/api/*` request and labels its results mocked; it does not establish live backend behavior.

## Phase Completion Rules

A phase is not ✅ VERIFIED until integration evidence, manual UI evidence, data/state evidence, failure handling, and explicit user confirmation exist. Statuses: ⏳ PLANNED, 🔨 CODE DONE, 🧪 TESTING, ✅ VERIFIED, and 🚧 BLOCKED. Because live blob and database checks are forbidden/unavailable, this plan can reach code and offline-gate completion but cannot claim G9 or end-to-end production verification.

## Touchpoints

| Surface | Planned responsibility |
|---|---|
| `frontend-react/api/upload-guards.mjs` | New pure content-type, size, magic-byte, token-ready guards. |
| `frontend-react/api/index.js` | Rewire upload and register two authenticated likes routes. |
| `frontend-react/api/likes-queries.mjs` | New real-row and blocked-pair SQL builders. |
| `frontend-react/src/lib/photoUpload.js` | New upload state machine and IndexedDB adapter. |
| `frontend-react/src/pages/EditProfilePage.jsx` | Truthful photo statuses, retry, cleanup, dedupe. |
| `frontend-react/src/pages/LikesPage.jsx` | New Sent/Received/Matches screen. |
| `frontend-react/src/components/Navbar.jsx`, `src/App.jsx`, `src/lib/demoMode.js` | Likes navigation, protected route, explicit demo transport. |
| `frontend-react/tests/offline/*.test.mjs`, `scripts/gates-offline.mjs`, `scripts/qa-offline-ui.mjs` | Offline deterministic proof and browser QA. |
| `docs/offline-backend-checklist.md` | Blocked backend operations and exact safe handoff commands. |

## Public Contracts

| Contract | Required behavior |
|---|---|
| `POST /api/upload` | 401 unauthenticated; 415 unsupported media type; 413 over 4 MiB; 400 magic mismatch; 503 storage configuration absent; `{ url }` only after storage success. Error strings remain distinct. |
| `GET /api/likes/sent`, `GET /api/likes/received` | Bearer-authenticated only; no database access for missing/invalid auth; results include only real and unblocked accounts. |
| Client photo state | “Uploaded to your profile” is prohibited until a valid server URL exists. “Saved on this device” means IndexedDB confirmation only. |
| `/likes` UI | Default Sent tab, Received and Matches tabs, tab counts, responsive empty/populated/loading/error states, and mocked label during QA. |

## Blast Radius

Eleven planned source/test/documentation surfaces under `frontend-react/` plus `docs/`; no schema migration and no ledger changes. Authentication, public REST behavior, local browser storage, and Vercel Blob configuration are high-risk. Rollback is a focused revert of the implementation commit; no stored-data migration must be reversed. Never stage or commit the pre-existing untracked `AppData/` directory. Work must start from branch `main` at the handoff baseline (`375416e`) and preserve a clean tracked worktree.

## Phased execution workflow

Each phase begins with a quick reread of its named existing patterns and ends with the stated gate. Do not mark later phases verified merely because lint/build succeeds.

### Phase 1 — server contracts (⏳ PLANNED)

Implement `upload-guards.mjs`, integrate it into the existing upload route, create query builders, and add both GET routes after `authMiddleware`. Reuse `realOnlySql`, `isRealRow`, `actorIsRealUser`, and the existing blocked-pair pattern; do not query data during unauthenticated tests.

- Test: `node scripts/gates-offline.mjs upload` and `node scripts/gates-offline.mjs likes` from `frontend-react`.
- Verify: G4/G5 tokens, distinct HTTP response bodies, and SQL-builder positive-control assertion.
- Done when: code and deterministic offline route tests pass; live database results remain unverified.

### Phase 2 — client offline upload (⏳ PLANNED)

Create the testable photo helper, then wire Edit Profile photo step states and object URL lifecycle. Retain confirmed server URL, persist recoverable pending selection, and never issue duplicate upload while saving a profile.

- Test: `node scripts/gates-offline.mjs unit` then `node scripts/gates-offline.mjs ui`.
- Verify: quota/remove cases, mocked 500 retains preview with retry, mocked 200 establishes success, IndexedDB reload restores preview, and zero duplicate upload requests.
- Done when: G3/G6 tokens pass at 360/390/768/1440; no live browser/backend claim is made.

### Phase 3 — Likes UI and demo transport (⏳ PLANNED)

Add the protected route, Heart navigation item, Likes page, and exact demo responses. Read `DESIGN.md` plus `apple-design`, `apple-design-foundations`, `apple-design-interaction`, and `apple-design-tactics` before JSX work; retain coral/teal identity, 44 px targets, restrained motion at or below 300 ms, and accessible stateful controls.

- Test: same G3 and G6 gates, including all tabs, no horizontal overflow, populated and empty cases.
- Verify: route mocks cover all `/api/*` calls and no fixture is presented as a live identity.
- Done when: UI is responsive and accessible under mocked QA; manual visual confirmation is still requested before VERIFIED.

### Phase 4 — evidence, checklist, release gate (⏳ PLANNED)

Write the backend checklist without secrets, run lint/build/offline gates, reverify the approved ledger, commit only intended files, push main, then reverify to make G8 eligible.

- Test: G0–G8 exact commands below; record outputs, but do not interpret expected G9 handoff exit as failure.
- Verify: remote `main` SHA equals local HEAD; `AppData/` is absent from staged files; docs checker positive-control fails on a mutated temporary copy.
- Done when: G0–G8 are met, G9 remains honestly ABANDONED, and final report states counts and blocked evidence.

## Implementation Checklist

1. In `frontend-react/api/upload-guards.mjs`, implement pure type/size/magic-byte and storage-token checks with unit-testable return values.
2. In `frontend-react/api/index.js`, preserve authentication order and rewire `POST /api/upload` to use the guards, bounded raw data handling, distinct errors, and storage only after all guards pass.
3. In `frontend-react/api/likes-queries.mjs`, implement sent/received query builders with parameter arrays, both `realOnlySql` filters, and bidirectional block exclusion.
4. In `frontend-react/api/index.js`, register authenticated `GET /api/likes/sent` and `GET /api/likes/received` routes that use the builders and make no database call before auth succeeds.
5. In `frontend-react/src/lib/photoUpload.js`, add `validatePhotoFile`, injected `runUpload`, and IndexedDB save/load/clear methods with quota and remove outcomes.
6. In `frontend-react/src/pages/EditProfilePage.jsx`, add auto-upload, retained-preview retry, status text, AbortSignal timeout, object-URL cleanup, and URL-based upload deduplication.
7. In `frontend-react/src/lib/demoMode.js`, add explicit ordered `/likes/sent` and `/likes/received` responses using clearly demo-derived fixtures.
8. In `frontend-react/src/pages/LikesPage.jsx`, implement Sent/Received/Matches tabs with existing UI primitives, error/retry/loading/empty states, responsive row layout, and optionally a local last-seen “New” match chip.
9. In `frontend-react/src/App.jsx` and `src/components/Navbar.jsx`, add protected `/likes` route and Heart navigation target with accessible 44 px interaction area.
10. Add `frontend-react/tests/offline/*.test.mjs` for pure photo behavior, mocked storage/fetch, selector filtering, and demo `/likes` paths.
11. Add `frontend-react/scripts/gates-offline.mjs` subcommands `unit`, `upload`, `likes`, `ui`, `docs`, and `push`, each printing its contract token only after assertions.
12. Add `frontend-react/scripts/qa-offline-ui.mjs` with route-mocked Playwright runs at 360/390/768/1440 and the required positive controls.
13. Write `docs/offline-backend-checklist.md` with `BLOB_READ_WRITE_TOKEN`, commands/variables, prohibited production database testing, and checker positive-control requirements.
14. Run the exact gates, commit intended files without `AppData/`, push only after safe checks, reverify, and provide an evidence-only report.

## G3–G9 execution contract

Run from the documented CWD; do not edit a gate definition or re-approve it. First run lint/build as G1/G2 regression proof, then G3–G7. Commit and push before final reverify so G8 can pass.

| Gate | Exact command / status | Expected proof |
|---|---|---|
| G3 | `cd frontend-react; node scripts/gates-offline.mjs unit` | `GATE_OFFLINE_UNIT_OK` |
| G4 | `cd frontend-react; node scripts/gates-offline.mjs upload` | `GATE_UPLOAD_GUARDS_OK` |
| G5 | `cd frontend-react; node scripts/gates-offline.mjs likes` | `GATE_LIKES_API_OK` |
| G6 | `cd frontend-react; node scripts/gates-offline.mjs ui` | `GATE_OFFLINE_UI_OK` |
| G7 | `cd frontend-react; node scripts/gates-offline.mjs docs` | `GATE_CHECKLIST_OK` |
| G8 | `cd frontend-react; node scripts/gates-offline.mjs push` after focused commit and `git push origin main` | `GATE_PUSH_OK` |
| G9 | **ABANDONED** — do not run a production/live write | Handoff in `docs/offline-backend-checklist.md`; requires `BLOB_READ_WRITE_TOKEN`, isolated DB credentials, and explicit human authorization. |

Final aggregate command: `node .opencode/skills/unlazy/scripts/gate-check.mjs --reverify GATES.offline.md`. Its expected terminal handoff for G9 is not a workflow failure. If G9 is ever changed from ABANDONED, that changed gate must receive fresh approval before use.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| G3 offline Node tests with mocked fetch/IndexedDB | Fully-Automated | AC-1 truthful state machine; AC-2 validation/retention; AC-5 demo no-fall-through. |
| G4 real Express handler offline assertions | Fully-Automated | AC-3 authenticated upload guards and distinct error contract. |
| G5 auth-first routes and SQL-builder positive control | Fully-Automated | AC-4 only real, unblocked Likes rows and no unauthenticated DB access. |
| G6 route-mocked Playwright at 360/390/768/1440 | Fully-Automated | AC-1, AC-2, AC-5 responsive honest UI behavior. |
| G7 docs checker with mutated-copy negative control | Fully-Automated | AC-6 durable blocked-backend handoff. |
| G8 SHA comparison after push | Hybrid | AC-7 commit/push evidence; requires network and authorized repository remote. |
| G9 real blob upload and live likes rows | Known-Gap (residual only; gate remains CONDITIONAL/ABANDONED) | Does not prove AC completion; backlog/handoff is mandatory pending credentials and explicit human authorization. |
| Human visual review of mocked UI | Agent-Probe | Layout clarity, labels, focus behavior, and 44 px affordances; does not prove live data/storage. |

## Acceptance Criteria

- **AC-1:** Photo flow reaches uploaded only after a server response containing a URL; failure never displays success and retains preview plus Retry. **proven by:** G3 state-machine scenario and G6 mocked-500/200 scenario; **strategy:** Fully-Automated.
- **AC-2:** JPEG/PNG/WebP up to 4 MiB are eligible; rejected types/sizes and IndexedDB quota/remove behavior are handled explicitly. **proven by:** G3 validation and storage scenario; **strategy:** Fully-Automated.
- **AC-3:** Upload route responds 401/415/413/400/503 as specified and never calls blob storage when unconfigured. **proven by:** G4 upload-guards scenario; **strategy:** Fully-Automated.
- **AC-4:** Likes API rejects missing auth before DB access and SQL contains real-account plus blocked-pair filters. **proven by:** G5 likes API scenario; **strategy:** Fully-Automated.
- **AC-5:** Protected Likes UI has Sent/Received/Matches, correct empty/populated/error states, no horizontal overflow at all four specified widths, and explicit demo transport. **proven by:** G6 mocked responsive UI scenario; **strategy:** Fully-Automated.
- **AC-6:** Backend limitations and commands/variables are documented without revealing secrets. **proven by:** G7 checklist scenario; **strategy:** Fully-Automated.
- **AC-7:** Intended committed main HEAD equals remote main after push, excluding `AppData/`. **proven by:** G8 push scenario; **strategy:** Hybrid.
- **AC-8:** No claim of live blob/database success is made without authorized live proof. **proven by:** final report plus G9 handoff review; **strategy:** Agent-Probe.

## Test plan, gaps, and risk controls

| Area | High-risk class | Minimum tier | Coverage / constraint |
|---|---|---|---|
| Upload endpoint | auth + public API + storage | Hybrid | G4 is deterministic offline; true blob integration is G9 handoff. |
| Likes endpoints | auth + public API | Hybrid | G5 proves auth/order and builder text offline; isolated DB integration unavailable. |
| Photo client state | local persistence | Fully-Automated | G3/G6 cover mocked storage and browser behavior. |
| Publish | external remote | Hybrid | G8 after focused commit/push. |

Known-gap resolution: (A) provision a non-production Blob token and isolated database with human authorization, then add a new approved live gate; (B) preserve G9 abandoned and the checklist; (C) never use the production Neon database or `ALLOW_DEPLOYED_DB_TESTS=1` to close the gap. The plan creates no test-infrastructure backlog artifact because the prescribed durable handoff is `docs/offline-backend-checklist.md`.

## Security, compatibility, and rollback

Bearer auth remains the gateway for upload/likes. Never log JWTs, blob token values, database URLs, or Netlify/Vercel tokens. Preserve existing `/matches` behavior; Likes matches tab may reuse it but cannot manufacture identities. Client storage contains only a recoverable pending file/metadata and must be removable. Roll back by reverting the focused commit; failed local uploads can be cleared via the new remove path. No migration or compatibility transform is required.

## Test Infra Improvement Notes

(none identified yet)

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)

## Resume and Execution Handoff

1. **Selected plan:** `process/general-plans/active/offline-photo-likes_16-10-26/offline-photo-likes_PLAN_16-10-26.md`.
2. **Last completed phase:** PLAN authored; no execution step completed.
3. **Validate-contract status:** pending; placeholder must be replaced by VALIDATE before EXECUTE.
4. **Supporting context:** `process/context/all-context.md`, `process/context/tests/all-tests.md`, `DESIGN.md`, `GATES.offline.md`, supplied handoff, and existing `frontend-react` patterns named in Touchpoints.
5. **Fresh-agent next step:** enter VALIDATE against this exact path; validate the G3–G9 contract, then EXECUTE only after a non-placeholder validate contract. Begin code work with Phase 1 and read the four Apple-design skills before JSX.

## Change management and final report

Any new endpoint/schema/dependency, altered ledger CHECK/EXPECT/CWD, production test, or live write is scope expansion: stop, update this plan/validate contract, and request human direction. At completion report files changed; command outputs; G0–G8 met/unmet count; G9 ABANDONED count and checklist handoff; Netlify deploy status for baseline `375416e` if safely observable without secret disclosure; and every unavailable proof.

## Next step

Plan complete. Review carefully. Say **ENTER VALIDATE MODE** to create the required executable contract; do not enter EXECUTE until this plan’s placeholder is replaced.
