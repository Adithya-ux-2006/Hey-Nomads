# Gates: Phase 15 regression

Scope: offline proof that the communities, events, cities and settlement
routes reject unauthenticated calls before any database access, that the
scoring engine still has one canonical implementation with the six documented
weights, and that the Living DNA routes answer honestly when their migration
has not been applied. No production database write; no migration applied.

Run all gates from `frontend-react/`. Every PASS below was produced by a
command that actually ran in this session.

## G0 — Lint
`node scripts/gates.mjs lint` → `GATE_LINT_OK`

- [x] PASS. `eslint . --max-warnings=0` exits 0.

## G1 — Build
`node scripts/gates.mjs build` → `GATE_BUILD_OK`

- [x] PASS. `vite build` completes; `dist/` emitted.

## G2 — Living DNA honest failure modes
`node scripts/gates.mjs livingdna` → `GATE_LIVINGDNA_API_OK`

- [x] PASS. All seven Living DNA routes (questions, me, answers, sharing,
  compare, constitution GET, constitution rules POST, constitution accept)
  401 without a token.
- [x] PASS. A PUT with a non-array `answers` body and a PUT with a non-boolean
  `share_preferences` each 400 before any database access.
- [x] PASS. Every handler maps a missing-table error (`SQLSTATE 42P01`) to
  `503 { error: 'Living DNA is not available here yet.' }` instead of a
  generic 500. The helper `isMissingLivingDnaTable` is shared.
- [x] PASS. Compare refuses with 403 before reading any answer row when the
  other participant has not shared.

## G3 — Communities / events / cities / settlement auth gate
`node scripts/gates.mjs phase15` → `GATE_PHASE15_API_OK`

- [x] PASS. Every GET, POST and DELETE route in those four surfaces 401s
  without a token. The database in the offline process is unreachable, so a
  401 (not a 500) proves auth runs before any query.
- [x] PASS. Structural: one canonical `scoreCompatibility` function, the six
  documented weights, the gender filter applied before scoring, and the
  shared `getRecommendedRoommates` used by Discover and Roommates.
- [x] PASS. `docs/matching-formula.md` still exists.

## G4 — Demo isolation
`node scripts/gates.mjs demo` → `GATE_DEMO_OK`

- [x] PASS. Layout still shows the persistent demo marker; the notification
  bell returns null in demo mode and when signed out.

## G5 — Full offline unit suite
`node --test "tests/offline/*.test.mjs"` → 101 pass / 0 fail

- [x] PASS. Age (20), notifications (18), gender-prefs, uploads, likes
  queries and photo upload all green together.

## Not verified here
- Live database behaviour: every authenticated database call in this
  environment fails with `ECONNREFUSED` by design. Query correctness for
  communities, events, cities and settlement is asserted structurally (auth
  order, route existence), not by a live round trip.
- Communities, events, cities and settlement have no unit tests for their
  query builders; that is out of scope for this phase and would require
  either a live database or a new pure-module extraction.
- The notification bell's polling loop: exercised by lint and build only,
  not by a rendered browser session.
