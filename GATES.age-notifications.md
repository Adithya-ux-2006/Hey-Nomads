# Gates: Age from DOB + in-app notifications

Scope: derive age from a stored date of birth everywhere it is displayed or
saved, and add a persistent, per-user notification feed for new messages, likes
and matches. No production database write; the migration is prepared, not
applied.

Run all gates from `frontend-react/`. Every PASS below was produced by a command
that actually ran in this session.

## G0 — Lint
`node scripts/gates.mjs lint` → `GATE_LINT_OK`

- [x] PASS. `eslint . --max-warnings=0` exits 0.

## G1 — Build
`node scripts/gates.mjs build` → `GATE_BUILD_OK`

- [x] PASS. `vite build` completes; `dist/` emitted.

## G2 — Age unit tests
`node scripts/gates.mjs age` → `GATE_AGE_UNIT_OK` + `GATE_AGE_API_OK`

- [x] PASS. 20/20 assertions in `tests/offline/age.test.mjs` green, including
  leap-day birthdays (29 Feb ages up on 28 Feb in a common year, on 29 Feb in a
  leap year), the 18th-birthday boundary in both directions, impossible dates
  (2000-02-30, 2001-02-29), future dates, and an absurdly old date.
- [x] PASS. `scripts/offline-api-gates.mjs age`: an impossible, an under-age and
  a future DOB each 400 with distinct copy before any database access; a valid
  DOB proceeds to the (unreachable) DB layer and 500s, which is the contrast
  that proves the 400s came from validation. Same gate on `/api/profile`.
- [x] PASS. Structural: the API imports `./age.mjs`, calls `validateDob`, and
  derives age with `setUser('age', derivedAge)` rather than trusting a typed
  number.

## G3 — Notifications unit tests
`node scripts/gates.mjs notifications` → `GATE_NOTIF_UNIT_OK` + `GATE_NOTIF_API_OK`

- [x] PASS. 18/18 assertions in `tests/offline/notifications.test.mjs` green,
  including dedup keys (message per conversation, like per actor, match
  order-independent per pair), self-notification suppression, a null input
  degrading to `null` instead of throwing, and the `/matches` destination
  surviving a null actor.
- [x] PASS. `scripts/offline-api-gates.mjs notifications`: all four routes 401
  without a token; structurally the message, like and match paths each call the
  recorder.
- [x] PASS. A failed or missing notifications table never fails the user's
  action: `recordNotification` swallows its own errors and the request keeps its
  own success response.

## G4 — Demo isolation
`node scripts/gates.mjs demo` → `GATE_DEMO_OK`

- [x] PASS. Layout still shows the persistent demo marker; the bell returns null
  in demo mode and when signed out.

## G5 — Full offline unit suite
`node --test "tests/offline/*.test.mjs"` → 101 pass / 0 fail

- [x] PASS. Age (20), notifications (18) and every pre-existing offline test
  (uploads, likes queries, gender-prefs) green together.

## G6 — Migration status
- [x] PASS (documented, not applied). `database/migrations/2026-10-16_add_dob_and_notifications.sql`
  adds `users.date_of_birth`, the `notifications` table, its two indexes and the
  per-user `notification_preferences` table. It is additive and reversible; it
  has **not** been run against production and must be approved and applied
  separately. Reversal order is documented in the file header.

## Not verified here
- Live database behaviour: every authenticated database call in this environment
  fails with `ECONNREFUSED` by design. Query correctness for the new columns and
  tables is asserted structurally and by the pure-module tests, not by a live
  round trip.
- The bell's polling loop and the dropdown panel: exercised by lint and build
  only, not by a rendered browser session.
- Scoring formula, Living DNA, communities, events and city guides: out of
  scope for this change and untouched.
