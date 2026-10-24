---
name: plan:demo-mode-rebuild
description: "Rebuild Demo Mode to use real application logic, 8-12 varied profiles, persistent demo state, working accept/dismiss, and real matching scores"
date: 24-10-26
metadata:
  type: plan
  feature: demo-mode-rebuild
  phase: execution
---

# Demo Mode Rebuild — Plan

**Date:** 2026-10-24  
**Status:** COMPLETED
**Date completed:** 2026-10-24  
**Complexity:** COMPLEX  
**Target:** `main` @ `ba32fb8`  
**Scope:** `frontend-react/src/lib/demoMode.js`, `frontend-react/src/lib/demoProfiles.js`

---

## Overview

Current Demo Mode uses static 4 client-side fixtures, no persisted state, hardcoded scores (84), and incomplete API surface. The rebuild makes it behave like the real application: 8-12 varied profiles, sessionStorage-persisted likes/matches/messages, real-looking matching scores with reason chips, working accept/dismiss that creates persistent matches, and proper API shapes.

---

## Blast Radius

- `frontend-react/src/lib/demoProfiles.js` — replace 4 profiles with 10 varied synthetic profiles
- `frontend-react/src/lib/demoMode.js` — rewrite state, scoring, persistence, API handlers

No API, database, migration, deployment, or production changes.

---

## Implementation Checklist

### 1. Demo Profiles (demoProfiles.js)

- [x] Replace 4 profiles with 10 varied profiles covering:
  - Cities: Mumbai, Bangalore, Delhi, Pune, Hyderabad
  - Budgets: 15000–35000 range
  - Occupations: varied (Engineer, Designer, Analyst, PM, Doctor, Teacher, etc.)
  - Ages: 23–30
  - Lifestyle fields: cleanliness (1–5), sleep_time, diet, flat_type
  - Interests: 3–5 tags per profile
  - Bio: realistic 1-2 sentence roommate blurb
  - IDs: 9101–9110 (outside real user ranges)

### 2. Demo Mode State & Persistence (demoMode.js)

- [x] SessionStorage keys: `hey_nomads_demo_received`, `hey_nomads_demo_sent`, `hey_nomads_demo_matches`, `hey_nomads_demo_messages`, `hey_nomads_demo_dismissed`
- [x] On `enterDemo()`: load persisted state or seed initial incoming likes (4–6 from varied profiles)
- [x] On `exitDemo()`: clear demo flag only; do NOT clear persisted state so refresh preserves it
- [x] `demoLikes()` derives sent/received from persisted state, not static slices

### 3. Accept/Dismiss Logic

- [x] `acceptLike(profileId)`: move from `received` → `matches` (create match object with compatibility_score, status='matched'), persist
- [x] `dismissLike(profileId)`: move from `received` → `dismissed`, persist
- [x] `likeProfile(profileId)`: add to `sent`, check reciprocal like → auto-match
- [x] All actions return updated state so UI re-renders correctly

### 4. Realistic Matching Scores

- [x] Replace `scored()` hardcoded 84 with per-profile varied scores (50–95)
- [x] Generate reason chips and breakdown per profile (use same shape as real scorer: `lifestyle`, `budget`, `location`, `movein`, `interests`, `habits`)
- [x] Make reasons coherent with profile data (city match, budget proximity, shared interests, etc.)

### 5. API Shape Alignment (demoResponse)

- [x] `/likes/sent` returns persisted sent with `matched` boolean
- [x] `/likes/received` returns persisted received
- [x] `/matches` returns persisted matches with `partner_*` fields (as MatchesPage expects)
- [x] `/conversations` returns persisted conversations
- [x] `/conversations/:id` returns thread with demo messages
- [x] `/messages` POST appends to persisted messages
- [x] `/swipe` responds with `{ ok: true, matchCreated: boolean }`
- [x] `/roommates/:id` and `/profile/:id` return full detail with score/breakdown/reasons

### 6. Demo Profiles Endpoint

- [x] Keep `/api/demo/profiles` fetch but ensure client falls back gracefully
- [x] Profiles returned by server already include `is_demo: true` — client accepts this

---

## Acceptance Criteria

1. **Demo Mode entry**: Visitor clicks "Try Demo", lands in app with `isDemo=true`, no auth token
2. **Incoming likes**: Likes Received tab shows 4–6 realistic profiles with names, cities, occupations, scores
3. **Accept like**: Click "Accept" on a received like → match appears in Matches tab + MatchesPage with correct score/partner fields
4. **Persist across refresh**: F5 keeps accepted match, dismissed likes gone, new messages visible
5. **Discovery**: Discover/Roommates pages show profiles with varied scores, reasons, breakdown
6. **Messaging**: Can send message in ChatPage, persists, appears in conversation list
6. **No console errors**: Clean network tab on demo journey
7. **All existing offline gates pass**: G0–G8 unchanged

---

## Verification Evidence

| Check | Command | Expected |
|---|---|---|
| Lint | `node scripts/gates.mjs lint` | GATE_LINT_OK |
| Build | `node scripts/gates.mjs build` | GATE_BUILD_OK |
| Unit tests | `node scripts/gates-offline.mjs unit` | 101+ tests pass |
| UI gates | `node scripts/gates-offline.mjs ui` | GATE_OFFLINE_UI_OK |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Breaking existing demo tests | Update demo-likes.test.mjs assertions to match new shapes |
| SessionStorage collisions | Prefix all keys with `hey_nomads_demo_` |
| ID collision with real users | Use 9xxx range, server classifies @heynomads.app as DEMO |
| G9 impact | No live DB/storage changes; demo is purely client-side |

---

## Rollback

`git checkout HEAD -- frontend-react/src/lib/demoProfiles.js frontend-react/src/lib/demoMode.js`

---

## Definition of Done

Visitor opens app → enters Demo Mode → sees 4–6 incoming likes → clicks Accept on one → match appears in Matches tab → opens match → sends message → refreshes → match and message still there. All using real components, real shapes, no hardcoded fallbacks.
