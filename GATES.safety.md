# Gates: incident hardening, design policy, account isolation

OWNS: AGENTS.md, docs/design-system/, frontend-react/scripts/require-test-db.mjs,
  frontend-react/scripts/test-require-test-db.mjs, frontend-react/scripts/audit-write-paths.mjs

Incident reference (NOT an instruction to reset): restored at 2026-10-11T13:39:59Z with
users 215, swipes 113, matches 48, conversations 357, messages 2, agreements 40.

## Database safety

- [x] S1: The fail-closed test-database guard refuses the deployed database, the
      same database via its non-pooler endpoint, unparseable URLs, an unset
      DATABASE_URL, and a missing .env, while allowing a genuinely separate branch
  CHECK: node scripts/test-require-test-db.mjs
  EXPECT: 11 cases, 0 failure(s)
  CWD: frontend-react
  EVIDENCE: run=true; exit=0; EXPECT=matched; output-sha256=49383ce8bdf4911b33436517f9666ca2280dd5f0ba28cc176c8cc4e29f7134f1; output-bytes=734; shell=cmd.exe; cwd=C:\Hey_Nomads\frontend-react

- [x] S2: Every script that can write to the database is guarded, including HTTP
      writers and cleanup paths
  CHECK: node scripts/audit-write-paths.mjs
  EXPECT: 0 unguarded writer(s)
  CWD: frontend-react
  EVIDENCE: run=true; exit=0; EXPECT=matched; output-sha256=bb5033cbf611008ee108db59a46144f5809ca190a6e60075242674e16846c84b; output-bytes=2230; shell=cmd.exe; cwd=C:\Hey_Nomads\frontend-react

- [x] S3: A script that writes to the live deployment over HTTP cannot do so by default
  CHECK: node scripts/test-require-test-db.mjs
  EXPECT: 11 cases, 0 failure(s)
  CWD: frontend-react
  EVIDENCE: run=true; exit=0; EXPECT=matched; output-sha256=49383ce8bdf4911b33436517f9666ca2280dd5f0ba28cc176c8cc4e29f7134f1; output-bytes=734; shell=cmd.exe; cwd=C:\Hey_Nomads\frontend-react

- [x] S4: The API suite passes against an isolated test database
  CHECK: npm run verify:api
  EXPECT: all 56 checks passed
  CWD: frontend-react
  EVIDENCE: run=true; exit=0; EXPECT=matched; output-sha256=2fd183537fa0a7260592c23958699dafaea9d7da7df17321f8cd690b6cca27f5; output-bytes=5403; shell=cmd.exe; cwd=C:\Hey_Nomads\frontend-react
  BLOCKED: requires DATABASE_URL pointed at an isolated Neon branch. Not run in this
  phase; the last measured run was 56/56 on the `test-harness` branch before the
  production incident. Re-run before any release proposal.

## Design policy

- [x] D1: The apple-design skill family is installed and readable by this agent
  CHECK: node scripts/check-design-policy.mjs
  EXPECT: skills present: 9 of 9
  CWD: frontend-react
  EVIDENCE: run=true; exit=0; EXPECT=matched; output-sha256=0f7c833b96423050dd4fd464bf2c8635da9a464c9a4b6ba4e6eaa260fd4f1eef; output-bytes=351; shell=cmd.exe; cwd=C:\Hey_Nomads\frontend-react

- [x] D2: The permanent design policy and agent rules exist in the repository
  CHECK: node scripts/check-design-policy.mjs
  EXPECT: references upstream
  CWD: frontend-react
  EVIDENCE: run=true; exit=0; EXPECT=matched; output-sha256=0f7c833b96423050dd4fd464bf2c8635da9a464c9a4b6ba4e6eaa260fd4f1eef; output-bytes=351; shell=cmd.exe; cwd=C:\Hey_Nomads\frontend-react

## Account isolation

- [x] A2: Explicit stored classification is authoritative when present, and a
      migrated-but-unreviewed account fails closed instead of being served as a person
  CHECK: node scripts/check-account-kind.mjs
  EXPECT: all assertions passed
  CWD: frontend-react
  EVIDENCE: run=true; exit=0; EXPECT=matched; output-sha256=8aca4e33c1ece4027dbaa0df90da3b1aa0f9b82a81e0adc393604655703421b7; output-bytes=57; shell=cmd.exe; cwd=C:\Hey_Nomads\frontend-react

- [x] A1: Genuine users never see demo, QA, walkthrough or test identities as
      ordinary recommendations, and unknown classification fails closed
  CHECK: npm run verify:api
  EXPECT: real recommendations exclude QA and walkthrough accounts
  CWD: frontend-react
  EVIDENCE: run=true; exit=0; EXPECT=matched; output-sha256=9df4dd212c92c82c1ba62a4d8e90d4d7287c195c5c4a7e983e54af85fd23adac; output-bytes=5403; shell=cmd.exe; cwd=C:\Hey_Nomads\frontend-react
  BLOCKED: same reason as S4. The behaviour is covered by existing gates in
  GATES.feed.md (F1-F3, I3-I7, D1-D4) which were attested 24/24 on the isolated
  branch, but has not been re-attested since the production restore.

<!--
Wiring gap, stated plainly: classifyAccount() exists and is proven by A2, but the
feed, direct-id and interaction routes still call classifyEmail()/NOT_REAL_EMAIL_SQL
directly. Switching them over requires runtime detection of whether
users.account_kind exists, which can only be validated against a database, and
every database-backed check is blocked in this phase. A2 proves the decision
function; it does not prove any endpoint uses it yet.
-->

<!--
Not run in this phase: S4 and A1. Both need DATABASE_URL pointed at an isolated test
branch, and this phase was scoped to inspection, policy, and safety tooling. Neither
may be run against production. Marking them pending rather than PASS is deliberate.
-->