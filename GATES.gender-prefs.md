# Gates: roommate gender preferences

OWNS: frontend-react/api/gender-prefs.mjs, frontend-react/api/index.js,
  frontend-react/src/pages/EditProfilePage.jsx, frontend-react/tests/offline/gender-prefs.test.mjs,
  frontend-react/scripts/offline-api-gates.mjs, frontend-react/scripts/gates-gender-prefs.mjs,
  frontend-react/scripts/qa-offline-ui.mjs, frontend-react/scripts/seed-test-data.mjs,
  docs/matching-formula.md, GATES.gender-prefs.md

Scope: users state whom they want to live with (women / men / all genders /
prefer not to specify) through a profile-editor selector distinct from "My
gender"; the shared recommendation query backing Discover and Roommates applies
the two-sided preference rule as a hard pre-scoring filter; the profile API
validates the value and preserves it across partial saves; unspecified is
communicated honestly and never silently coerced; every claim is proven by
offline unit tests, an offline API gate and a route-mocked responsive UI pass.

- [x] G0: this ledger's oracles pass the unlazy ledger lint
  CHECK: node .opencode/skills/unlazy/scripts/gate-lint.mjs GATES.gender-prefs.md
  EXPECT: LINT OK

- [x] G1: the frontend linter reports no errors and no warnings
  CHECK: node scripts/gates.mjs lint
  EXPECT: GATE_LINT_OK
  CWD: frontend-react

- [x] G2: the production frontend build completes
  CHECK: node scripts/gates.mjs build
  EXPECT: GATE_BUILD_OK
  CWD: frontend-react

- [x] G3: offline unit tests pass with no database and no network, covering
      gender-preference normalization (including legacy no_preference, NULL and
      unknown values), the two-sided pairing predicate across all preference
      combinations, the SQL eligibility clause builder with a positive control,
      and every pre-existing offline test file still passing
  CHECK: node scripts/gates-gender-prefs.mjs unit
  EXPECT: GATE_GENDER_UNIT_OK
  CWD: frontend-react

- [x] G4: the real recommendation and profile routes answer offline with 401
      without a token; an authenticated profile save with an invalid
      preferredGender is rejected 400 before any database access; the shared
      recommendation query carries the gender eligibility clause and the
      preferences join; the schema already provides preferred_gender so no
      migration is required
  CHECK: node scripts/gates-gender-prefs.mjs api
  EXPECT: GATE_GENDER_API_OK
  CWD: frontend-react

- [x] G5: the route-mocked responsive UI suite passes at 360, 390 and 1440 px:
      the edit-profile Basic Info step shows "My gender" and "Who would you
      prefer to live with?" as distinct controls, the preference select offers
      Women / Men / All genders / Prefer not to specify, defaults to Prefer not
      to specify when no preference is stored, reflects a stored preference,
      and all pre-existing Likes and photo passes still succeed
  CHECK: node scripts/gates-gender-prefs.mjs ui
  EXPECT: GATE_GENDER_UI_OK
  CWD: frontend-react

- [x] G6: the matching documentation states the two-sided gender-preference
      rule, the unspecified behaviour, and the legacy-value handling
  CHECK: node scripts/gates-gender-prefs.mjs docs
  EXPECT: GATE_GENDER_DOCS_OK
  CWD: frontend-react
