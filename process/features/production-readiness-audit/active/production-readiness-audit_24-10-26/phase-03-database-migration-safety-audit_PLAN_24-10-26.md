---
name: plan:production-readiness-audit-phase-03-database-migration-safety-audit
description: "Phase 3 — static database, migration, and write-path safety audit"
date: 24-10-26
metadata:
  type: plan
  feature: production-readiness-audit
  phase: phase-03
---

# Phase 3 — Database Migration Safety Audit

**Date:** 24-10-26  
**Status:** ⏳ PLANNED  
**Complexity:** COMPLEX  
**Program:** production-readiness-audit  
**Umbrella plan:** `process/features/production-readiness-audit/active/production-readiness-audit_24-10-26/production-readiness-audit-umbrella_PLAN_24-10-26.md`  
**Report destination:** `process/features/production-readiness-audit/active/production-readiness-audit_24-10-26/phase-03-database-migration-safety-audit_REPORT_24-10-26.md`

Date: 24-10-26
Status: ⏳ PLANNED
Complexity: COMPLEX

## Overview

Audit schema, migration ordering, application-query assumptions, and safety guards using read-only source analysis plus safe guard tests only. It cannot apply, seed, reset, or inspect a production database.

## Purpose

Expose missing/ambiguous migration dependencies and unsafe write paths without conflating existence of a migration file with deployment application.

## Phase Completion Rules

Completion requires schema/query comparison, migration ordering findings, guard evidence, and explicit isolated-DB/live-status classification. VERIFIED requires evidence and user confirmation.

## Acceptance Criteria

- C1. Schema/migration/query dependencies are mapped with source evidence, **proven by:** `schema-query matrix` **strategy:** Agent-Probe.
- C2. Write-capable scripts are guarded or registered as defects, **proven by:** `audit-write-paths` **strategy:** Fully-Automated.
- C3. No production migration status is inferred without reliable evidence, **proven by:** `deployment-evidence review` **strategy:** Hybrid.

## Entry Gate

- Phase 1 complete; `AGENTS.md` database safety rules read.

## Blast Radius

- Read-only `database/schema_v2.sql`, `database/migrations/**`, `frontend-react/api/**`, `frontend-react/scripts/**`, docs/ledgers; phase report.

## Implementation Checklist

- [ ] A1. RESEARCH: inventory tables/columns/migrations and application query references; identify order/idempotency assumptions.
- [ ] A2. Inspect seeders, test scripts, guards, and migration helpers before running anything.
- [ ] A3. Establish whether a positively isolated disposable DB is available; if not, record BLOCKED and do not run DB-mutating commands.
- [ ] B1. INNOVATE: classify discrepancies as static defect, deployment-evidence gap, or isolation backlog.
- [ ] B2. PLAN-SUPPLEMENT/PVL: define a dedicated-branch Phase 5 candidate only for confirmed safe source/guard defects.
- [ ] C1. EXECUTE/EVL: run only safe guard/audit commands approved by PVL; write source-evidence report.

## Exit Gate

- Query/schema/migration matrix and safety finding register are written.
- No migration, seed, cleanup, restore, or production access occurs.
- Isolated DB availability is PASS only after positive identification; otherwise BLOCKED.

## Blockers That Would Justify BLOCKED Status

- No isolated database can be positively identified.
- Migration application state requires provider or production evidence.
- A needed test would write to an uncertain target.

## Phase Loop Progress

- [ ] 1. RESEARCH — load safety context and source inventory.
- [ ] 2. INNOVATE — classify findings/gaps.
- [ ] 3. PLAN-SUPPLEMENT — tighten only confirmed remediation candidates.
- [ ] 4. PVL — validate safe command target and proof limits.
- [ ] 5. EXECUTE — report and allowed non-mutating guard checks only.
- [ ] 6. EVL — independently verify command target/safety claims.
- [ ] 7. UPDATE PROCESS — write report and update umbrella.

**Validate-contract required** before execute; a placeholder contract blocks completion.

## Touchpoints

- `database/schema_v2.sql`, `database/migrations/**`, `frontend-react/scripts/{require-test-db,audit-write-paths}.mjs` and query source (read-only); report path.

## Public Contracts

- Database schema, migrations, data, and production state remain unchanged.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| schema-query migration matrix | Agent-Probe | C1 |
| `node scripts/audit-write-paths.mjs` on safe local source | Fully-Automated | C2 |
| isolated-target check with no credentials emitted | Hybrid | C3 |

## Test Infra Improvement Notes

The required isolated DB is unavailable unless Phase research positively establishes one; that limits integration verification and is a backlog item.

## Resume and Execution Handoff

- Selected plan: this file; last completed step: not started; validate-contract: pending.
- Primary execute anchor: this direct phase plan; supporting phase files: umbrella plan, Phase 1 report, and relevant active plans.
- Context required: `process/context/all-context.md` and `process/context/tests/all-tests.md`.
- Next step: Phase 3 RESEARCH; do not run a DB-writing script until isolation is proven.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE.)
