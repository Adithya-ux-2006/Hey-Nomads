# Gates: Hey Nomads repair loop (demo/auth, matching, profile layout)

OWNS: frontend-react/api/**, frontend-react/src/**, frontend-react/scripts/**, frontend-react/netlify.toml, netlify.toml, GATES.md

Scope: Make the real application work — safe predictable demo/auth, an explainable and correct matching algorithm with honest reason strings, and a corrected profile header — verified against the live app on the approved isolated test database.

Status legend: PASS = ran and emitted its token. BLOCKED = command could not run.
No gate is marked PASS without output from the command named in CHECK.

- [x] G1: Production source lints clean with zero warnings — PASS
  CHECK: node scripts/gates.mjs lint
  EXPECT: GATE_LINT_OK
  CWD: frontend-react
  EVIDENCE: GATE_LINT_OK (eslint --max-warnings=0)

- [x] G2: Production build completes and emits a bundle — PASS
  CHECK: node scripts/gates.mjs build
  EXPECT: GATE_BUILD_OK
  CWD: frontend-react
  EVIDENCE: GATE_BUILD_OK (vite build)

- [ ] G3: Matching regression — placeholder answers can no longer outscore real ones — BLOCKED
  CHECK: node --import ./scripts/dns-shim.mjs scripts/verify-matching.mjs
  EXPECT: matching regression passed
  CWD: frontend-react
  EVIDENCE: none. Isolated test database unreachable (connection timeout); the
  script refuses to run against anything else, so it was not executed.

- [x] G4: Demo mode is a public, session-free tour of the real screens — PASS
  CHECK: node scripts/gates.mjs demo
  EXPECT: GATE_DEMO_OK
  CWD: frontend-react
  EVIDENCE: GATE_DEMO_OK (source assertions on the demo transport wiring)

- [ ] G5: API authorisation, matching, chat and agreement flows still pass — BLOCKED
  CHECK: node --import ./scripts/dns-shim.mjs scripts/verify-api-flows.mjs
  EXPECT: all \d+ checks passed
  CWD: frontend-react
  EVIDENCE: none. Isolated test database unreachable.

- [ ] G6: Real-browser QA — landing, login, demo, discover, matches, chat — BLOCKED
  CHECK: node --import ./scripts/dns-shim.mjs scripts/browser-qa.mjs http://127.0.0.1:5199
  EXPECT: browser qa passed
  CWD: frontend-react
  EVIDENCE: none. Registers accounts, so it needs the isolated test database.

- [ ] G7: Profile layout QA — header does not clip or overflow — BLOCKED
  CHECK: node scripts/profile-layout-qa.mjs http://127.0.0.1:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
  EVIDENCE: none. Signs in to render the profile, so it needs the isolated test
  database. The header changes have therefore NOT been visually confirmed.

- [x] G8: Account classification still fails closed — PASS
  CHECK: node scripts/check-account-kind.mjs
  EXPECT: account classification self-check: all assertions passed
  CWD: frontend-react
  EVIDENCE: account classification self-check: all assertions passed

- [ ] G9: Profile header reads as intentional at 1440px and 390px, avatar not clipped — BLOCKED
  EVIDENCE: none. Needs a signed-in session (G7), which needs the database.

- [x] G10: A signed-out visitor reaches demo mode and never sees another identity — PASS
  CHECK: node scripts/demo-tour-qa.mjs
  EXPECT: demo tour qa passed - all \d+ checks
  CWD: frontend-react
  EVIDENCE: demo tour qa passed - all 12 checks. Runs without the database
  because the tour falls back to bundled samples when the API is unreachable.

- [ ] G11: Matching criteria and the exact scoring formula are documented from the implementation — PENDING
  EVIDENCE: none yet.

- [x] G12: Demo Mode tours the real Feed / Matches / Messages screens — PASS
  CHECK: node scripts/demo-tour-qa.mjs
  EXPECT: demo tour qa passed - all \d+ checks
  CWD: frontend-react
  EVIDENCE: demo tour qa passed - all 12 checks (hub renders signed out, real
  routes reached, persistent demo marker, cards and reason chips rendered,
  like produces the match payoff, private routes guarded again on exit).
