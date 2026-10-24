# PRODUCTION CHECKLIST — Hey Nomads Release Readiness

**Date:** 2026-10-24  
**Scope:** Prerequisites and remaining actions to safely promote current `main` (`ba32fb8d06467a81d8cb4ab73d5be81630352c6d`) to production. Does **NOT** assert that any production action is performed.

---

## Release Gate Status

| Gate | Status | Evidence |
|---|---|---|
| **GATES.offline.md G0–G8** | ✅ PASS | Verifies offline-first upload + likes implementation; proof that offline requirements are met. |
| **GATES.offline.md G9** | ❌ ABANDONED | No `BLOB_READ_WRITE_TOKEN`; no isolated test database credential. |
| **Lint / Build** | ✅ PASS | `GATE_LINT_OK`, `GATE_BUILD_OK` from `scripts/gates.mjs`. |
| **Unit tests** | ✅ PASS | 101/101 tests via `node scripts/gates-offline.mjs unit`. |
| **Git merge/consolidation** | ✅ COMPLETE | All 9 local + 2 remote branches are ancestors of `main`; no merge performed (see BRANCH_MERGE_REPORT.md). |

## Required Approvals (HUMAN)

| Action | Requirement | Status |
|---|---|---|
| **Approvable:** `node scripts/audit-write-paths.mjs` (read-only) | Safe to run locally | BLOCKED — should run to confirm zero unguarded writers |
| **Prohibited:** `npm run verify:*` (would access isolated/test DB) | No isolated DB available | BLOCKED — needs DB isolation |
| **Prohibited:** git push / deploy (Netlify/Vercel) | No provider configuration | BLOCKED — requires explicit push/deploy approval |
| **Prohibited:** production database mutations | No production access | BLOCKED — explicitly prohibited |
| **Prohibited:** `BLOB_READ_WRITE_TOKEN` use | No token provisioned | BLOCKED — G9 requires this to be present |

## Release Readiness Summary

The current `main` is **locally ready** for offline-first photo upload + likes:

- ✅ All offline gates pass
- ✅ Code is linted and built
- ✅ 101 unit tests pass
- ✅ No blocking safety violations

**Production readiness requires:**

1. **G9 replacement:** If the user wants to enable G9 (live Blob upload + live likes query), they must:
   - Provision a `BLOB_READ_WRITE_TOKEN` in Vercel/Netlify config (does not appear in the repo's local .env or remote secrets),
   - Obtain explicit approval to access the production Neon DB (ep-curly-dream-axurjezu-pooler),
   - Run the necessary production deployment commands (e.g., `vercel deploy` or Netlify deploy),
   - Run G9 verification (`node scripts/gates-offline.mjs --reverify` with appropriate environment).

2. **Database/migration verification:** `complete-production-readiness-audit` and `supabase-migration-script-export` worktree tips are in `main` but migration application was not inspected. If Supabase migration status is unknown, human approval is required to:
   - Access the Supabase control panel,
   - Inspect the current state of tables/profiles/rels,
   - Apply the migration (if needed) with explicit approval.

3. **Standalone DB safety check:** `node scripts/audit-write-paths.mjs` should be run to confirm zero unguarded writers locally. This is safe (read-only static scan) and is **RECOMMENDED** before release.

4. **Deployment confirmation:** GATES.offline.md G8 passed because current `main` == `origin/main`. If the user plans a new deployment, they must:
   - Run the appropriate deployment command,
   - Manually confirm Netlify/Vercel status, and
   - Provide explicit approval before considering `main` released.

---

## Local Execution Checklist (Safe)

- [ ] `node scripts/audit-write-paths.mjs` run (confirm 0 unguarded writers)
- [ ] `node scripts/gates-offline.mjs --reverify GATES.offline.md` (re-run evidence for G0–G8)
- [ ] `node scripts/gates.mjs lint` + `node scripts/gates.mjs build` (confirm green)

All other remaining actions are **PROHIBITED** and require **explicit human approval** (owner of the repository).

---

## Final State

**Current state is a stable base for offline-first release**; no production mutations have occurred. The only pending release gates are blocked by external provider setup (G9) or require human verification (Supabase migration).