# Gates: Hey Nomads repair loop (demo/auth, matching, profile layout)

OWNS: frontend-react/api/**, frontend-react/src/**, frontend-react/scripts/**, frontend-react/netlify.toml, netlify.toml, GATES.md

Scope: Make the real application work — safe predictable demo/auth, an explainable and correct matching algorithm with honest reason strings, and a corrected profile header — verified against the live app on the approved isolated test database.

Status legend: PASS = ran and emitted its token. BLOCKED = command could not run.
No gate is marked PASS without output from the command named in CHECK.

- [x] G1: Production source lints clean with zero warnings — PASS
  CHECK: node scripts/gates.mjs lint
  EXPECT: GATE_LINT_OK
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a55c5eee41c8305c9edd9d3aafe108afecb0fa3c68ad4562cdc0863d6cd7e1a2; exit=0; EXPECT=matched; output-sha256=676a2a92ce2935b1af6258826cf219128f924cfbff879336a9dd0cc23dd6525d; output-bytes=278; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G2: Production build completes and emits a bundle — PASS
  CHECK: node scripts/gates.mjs build
  EXPECT: GATE_BUILD_OK
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=0b5f23fc7eea6c0e671a911a9a5a0916ed3dfcc9d6b20887be9a124d3194f9e9; exit=0; EXPECT=matched; output-sha256=dd6103607dcaae3d4a65e62c373fb78fa85602a95e6956e38db886dc43143af9; output-bytes=1325; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [ ] G3: Matching regression — placeholder answers can no longer outscore real ones — BLOCKED
  CHECK: node --import ./scripts/dns-shim.mjs scripts/verify-matching.mjs
  EXPECT: matching regression passed
  CWD: frontend-react
  EVIDENCE: BLOCKED on missing isolated-DB credentials. TCP to the isolated
  host ep-icy-shape-axnlevy7.c-4.us-east-2.aws.neon.tech now accepts on 5432
  (reachable, 314ms) and 443, so the earlier wire-port block has cleared. But
  no connection URL or credential for that host exists anywhere in the
  environment: the only DATABASE_URL present points at the deployed host
  ep-curly-dream-axurjezu, which require-test-db correctly refuses (exit 3).
  No override was used and the guard was not bypassed. Supply the isolated
  DATABASE_URL (e.g. CONFIRM_TEST_DATABASE_HOST + real URL) and re-run.

- [x] G4: Demo mode is a public, session-free tour of the real screens — PASS
  CHECK: node scripts/gates.mjs demo
  EXPECT: GATE_DEMO_OK
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=96b22b882eb78218ec3819844108fd3d6a50944e96153a86221b746945f5b6d1; exit=0; EXPECT=matched; output-sha256=7d83d11b3c367c5da532d9f90fc054ceac8d648a8f19f1584ac1526d4b5a1d54; output-bytes=13; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [ ] G5: API authorisation, matching, chat and agreement flows still pass — BLOCKED
  CHECK: node --import ./scripts/dns-shim.mjs scripts/verify-api-flows.mjs
  EXPECT: /all \d+ checks passed/
  CWD: frontend-react
  EVIDENCE: BLOCKED on missing isolated-DB credentials (same cause as G3).
  The isolated host is reachable on 5432, but no connection URL for it exists
  in the environment; the only DATABASE_URL points at the deployed host, which
  require-test-db correctly refuses (exit 3). No override was used. Supply the
  isolated DATABASE_URL and re-run.

- [ ] G6: Real-browser QA — landing, login, demo, discover, matches, chat — BLOCKED
  CHECK: node --import ./scripts/dns-shim.mjs scripts/browser-qa.mjs http://127.0.0.1:5199
  EXPECT: browser qa passed
  CWD: frontend-react
  EVIDENCE: BLOCKED on two counts. The CHECK targets a Vite server on
  :5199; starting that server requires booting the API against the isolated
  test DB, which is blocked on missing credentials (G3). Running the CHECK
  directly fails with fetch failed (no server on :5199). Earlier same-HEAD
  run via `node scripts/qa-local.mjs --suite browser` passed 22/22. Supply
  the isolated DATABASE_URL and re-run.

- [ ] G7: Profile layout QA — header does not clip or overflow — BLOCKED
  CHECK: node scripts/profile-layout-qa.mjs http://127.0.0.1:5199
  EXPECT: profile layout qa passed
  CWD: frontend-react
  EVIDENCE: BLOCKED on the same two counts as G6 (needs :5199, which needs
  the API, which needs the isolated DATABASE_URL that is not present). Earlier
  same-HEAD run via `node scripts/qa-local.mjs --suite profile` passed 35/35
  after the ProfilePage label fixes. Supply the isolated DATABASE_URL and
  re-run.

- [x] G8: Account classification still fails closed — PASS
  CHECK: node scripts/check-account-kind.mjs
  EXPECT: account classification self-check: all assertions passed
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=cf238d4872f7d96d2ce46b8fdc79607528dfde562d593061c7702516bc411f51; exit=0; EXPECT=matched; output-sha256=8aca4e33c1ece4027dbaa0df90da3b1aa0f9b82a81e0adc393604655703421b7; output-bytes=57; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G9: Profile header reads as intentional at 1440px and 390px, avatar not clipped — PASS
  EVIDENCE: Visual inspection of screenshots/qa/profile-1440-profile.png and
  screenshots/qa/profile-390-profile.png (captured 2026-10-15 00:12, after the
  ProfilePage label fixes at 00:07). At 1440 the avatar sits fully inside the
  gradient header with the name, role, location and bio below it; at 390 the
  same layout reflows to a single column with the avatar still fully visible
  and no clipping or overflow. Lifestyle labels render as prose (Early Bird,
  Non-smoker, Vegetarian, No pets, 2BHK).

- [x] G10: A signed-out visitor reaches demo mode and never sees another identity — PASS
  CHECK: node scripts/demo-tour-qa.mjs
  EXPECT: /demo tour qa passed - all \d+ checks/
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a7eb8ef4345c75dfb92ab81ebd5e36479eb45bb22ea151db0932454a5bf7c49d; exit=0; EXPECT=matched; output-sha256=c5b39ba5e35952c0a679c76ec6ed10ecccce2dd57247f297babb749336b829f3; output-bytes=1411; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G11: Matching criteria and the exact scoring formula are documented from the implementation — PASS
  EVIDENCE: docs/matching-formula.md, written from api/index.js (getMatchWeights,
  MATCH_CATEGORIES, ANSWERED_FIELDS, scoreCompatibility) at commit e5857c6. Covers
  the six weighted categories and their ceilings (lifestyle 25, budget 20,
  location 20, movein 15, interests 10, habits 10), the unknown-answer gate
  (onboarding_complete), the cost-normalised budget formula, the re-normalised
  total, and the feed comparator.

- [x] G12: Demo Mode tours the real Feed / Matches / Messages screens — PASS
  CHECK: node scripts/demo-tour-qa.mjs
  EXPECT: /demo tour qa passed - all \d+ checks/
  CWD: frontend-react
  EVIDENCE: automatic-evidence=v1; definition-sha256=a7eb8ef4345c75dfb92ab81ebd5e36479eb45bb22ea151db0932454a5bf7c49d; exit=0; EXPECT=matched; output-sha256=c5b39ba5e35952c0a679c76ec6ed10ecccce2dd57247f297babb749336b829f3; output-bytes=1411; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Hey_Nomads\frontend-react; path=8c2f10424b45/58 entries

- [x] G13: Publishing /presentation to production does not write uncontrolled synthetic records into the real user database — PASS (gate live in production)
  STATUS 2026-10-24: SUPERSEDED by removal. The entire /presentation surface
  (PresentationPage.jsx, src/lib/presentation.js, src/lib/presentation-cohort.js,
  api/presentation.mjs and the /presentation route) was deleted; the residual
  defense-in-depth is the scope guard in api/index.js rejecting any
  still-issued presentation token on ordinary endpoints. The record below is
  retained as history; no /api/presentation/* check is meaningful any more.
  CHECK: node -e "fetch('https://hey-nomads.vercel.app/api/presentation/session',{method:'POST'}).then(r=>r.text()).then(console.log)"
  EXPECT: 404 {"error":"Not found"} (JSON, i.e. the gate handler — an ungated
  Express default would be HTML `Cannot POST /api/presentation/session`)
  CWD: repo root (no database required; read-only)
  RESOLUTION: Closed by a fail-closed server-side gate, not by weakening any
  boundary. `mountPresentation()` (frontend-react/api/presentation.mjs) now
  refuses to mount any `/api/presentation/*` route unless
  `PRESENTATION_ENABLED=1`; without it every route answers a JSON
  404 `{"error":"Not found"}`. Because the page calls
  `POST /presentation/session` FIRST and `provision()` only runs when that
  call succeeds with `ready:false` (frontend-react/src/lib/presentation.js:
  115-128), the gate makes provision() unreachable — zero synthetic
  `qa.present.*` rows can be created through /presentation. The flag is read
  only from the process env; it is NOT set in the repository (the value lives
  in the gitignored frontend-react/.env for local QA), so Vercel ships the
  route disabled by default.
  EVIDENCE (commands that actually ran, all exit 0):
  - Gate unit/harness, DB-free, both directions: `gate-test.mjs disabled` ->
    session 404 JSON {"error":"Not found"}, discover 404, ordinary
    /api/auth/me still 401 (no collateral); `gate-test.mjs enabled` ->
    session 500 (mounted, DB unreachable) and discover 401, i.e. never 404.
    GATE_DISABLED_OK / GATE_ENABLED_OK.
  - Deployed to production: Vercel backend project `hey-nomads`
    (https://hey-nomads.vercel.app) redeployed with merge 6207677.
  - Differential proof the 404 is THIS gate and not a global handler:
    GET /api/definitely-not-a-route -> 404 HTML (Express default);
    POST /api/presentation/session and GET /api/presentation/discover
    -> 404 JSON {"error":"Not found"}. Only mountPresentation emits JSON.
  - Live end-to-end via the Netlify /api proxy: POST
    https://heynomads.netlify.app/api/presentation/session -> 404
    {"error":"Not found"} (gated, no provisioning); /api/presentation/discover
    -> 404; /api/health -> 200 ok=true neondb; POST /api/auth/login with an
    unknown account -> 401 {"error":"Invalid credentials"} (read-only negative
    test, no row written).
  - 11/11 read-only live smoke checks SMOKE_ALL_OK; deployed bundle
    assets/index-CbXyHalC.js is byte-identical to the local build of the
    merged tree.
  - `npm run lint` exit 0, `npm run build` exit 0 at the gate commit db04af0.

  --- original finding (retained as the reason the gate exists) ---
  EVIDENCE: Verified the live path end to end. Netlify site `heynomads` (id
  0b0a0cdc-79e2-4a9d-9978-d6c36b7b68f9) serves only the static bundle (repo
  Adithya-ux-2006/Hey-Nomads, production branch `main` @ 42c324d, build
  `npm run build`, publish `dist`, base null via netlify.toml). `/api/*` is
  force-proxied (netlify.toml, status 200, force=true) to a separate Vercel
  backend https://hey-nomads.vercel.app. That backend's /api/health reports it
  is backed by the production Neon database (ep-curly-dream-axurjezu-pooler,
  neondb). Opening /presentation calls beginPresentation() -> provision()
  (frontend-react/src/lib/presentation.js:115-128, 79-110), which registers,
  onboards and profiles four `qa.present.*` accounts through the REAL public
  endpoints /auth/register, /onboarding and /profile. Therefore publishing the
  presentation experience to the live site writes synthetic user rows into the
  production database. Real-user isolation DOES hold on the live schema
  (read-only information_schema check: users has no account_kind column, so the
  pre-migration heuristic applies and `qa.present.*` matches the
  `email NOT LIKE 'qa.%'` exclusion in account-kind.mjs NOT_REAL_EMAIL_SQL;
  the scope guard at index.js:154-156 and presentationAuth double-check further
  contain the token). But isolation from real users is not the same as "no
  uncontrolled synthetic records in the real user database", which the release
  directive forbids. No Netlify env override (VITE_API_URL) exists to point the
  presentation page at an isolated backend (account env vars empty). RELEASE
  STOPPED at step 4 per directive: do not publish /presentation until it is
  provisioned against an isolated database, or the cohort is made non-writing
  (e.g. pre-seeded fixtures or a read-only presentation path). Do not silently
  disable the security boundary to get the site live.
  RESOLVED 2026-10-15: both listed remedies were satisfied by the fail-closed
  route gate above — the presentation path is now non-writing against
  production (every /api/presentation/* route is unmounted unless
  PRESENTATION_ENABLED=1), and no security boundary was weakened. Verified
  live; see RESOLUTION/EVIDENCE above. The "RELEASE STOPPED" wording is the
  original stop condition, now lifted.
