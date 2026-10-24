---
name: plan:production-readiness-audit-phase-01-baseline-branch-consolidation
description: "Phase 1 — evidence-only local and remote branch/worktree inventory"
date: 24-10-26
metadata:
  type: plan
  feature: production-readiness-audit
  phase: phase-01
---

# Phase 1 — Baseline Branch Consolidation

**Date:** 24-10-26  
**Status:** ⏳ PLANNED  
**Complexity:** COMPLEX  
**Program:** production-readiness-audit  
**Umbrella plan:** `process/features/production-readiness-audit/active/production-readiness-audit_24-10-26/production-readiness-audit-umbrella_PLAN_24-10-26.md`  
**Report destination:** `process/features/production-readiness-audit/active/production-readiness-audit_24-10-26/phase-01-baseline-branch-consolidation_REPORT_24-10-26.md`

Date: 24-10-26
Status: ⏳ PLANNED
Complexity: COMPLEX

## Overview

Create a reproducible branch and worktree inventory. This phase is intentionally read-only: its success condition is an auditable no-merge-or-needed-merge conclusion, never consolidation by mutation.

## Purpose

Preserve every original tip while comparing each local and reachable remote branch to local `main`. Existing evidence indicates no divergent branches; RESEARCH must re-check that conclusion rather than assume it.

## Phase Completion Rules

A phase is complete only after integration evidence, manual review of the inventory, state/ancestry verification, failure handling, and user-visible report are recorded. `✅ VERIFIED` requires evidence and user confirmation; until then use `⏳ PLANNED`, `🧪 TESTING`, or `🚧 BLOCKED`.

## Acceptance Criteria

- C1. Every discoverable local and remote branch plus worktree is listed with tip SHA and ancestor/divergence status, **proven by:** `branch-inventory` **strategy:** Agent-Probe.
- C2. Any excluded/blocked branch has evidence and a recoverability note, **proven by:** `ancestor-comparison` **strategy:** Hybrid.
- C3. The report states whether no merge is needed without claiming a merge occurred, **proven by:** `no-mutation review` **strategy:** Agent-Probe.

## Entry Gate

- Umbrella plan exists and current loop step is RESEARCH.
- Working tree is inspected before any action; no Git mutation is allowed.

## Blast Radius

- Read-only `.git` ancestry/worktree metadata and remote refs.
- One phase report only after evidence collection.

## Implementation Checklist

- [ ] A1. RESEARCH: capture `git status --short`, current branch/HEAD, local branches, remote branches, and `git worktree list --porcelain` without changing refs.
- [ ] A2. Compare every branch tip with `main` using merge-base ancestry and count unique commits; record command output summaries and any inaccessible remote refs.
- [ ] A3. Inspect only relevant diffs for a non-ancestor branch; classify it as already incorporated, divergent, inaccessible, or protected by worktree.
- [ ] B1. INNOVATE: select evidence-reporting format; no merge, checkout, stash, branch creation, deletion, push, or commit is an option in this phase.
- [ ] B2. PLAN-SUPPLEMENT and PVL: validate that a potential later action is represented only as a backlog item, not an instruction.
- [ ] C1. EXECUTE/EVL only if PVL confirms the report artifact scope; write the report with final local `main` SHA and explicit “no mutation performed” evidence.

## Exit Gate

- Complete auditable inventory exists; every original branch tip remains recoverable.
- Any no-merge conclusion is backed by ancestry output.
- No Git write command, branch operation, push, or deployment occurred.

## Blockers That Would Justify BLOCKED Status

- Required remote references cannot be read.
- An apparently divergent branch needs a user decision on intended product behavior.
- Worktree state prevents safe inspection without user authority.

## Phase Loop Progress

- [ ] 1. RESEARCH — inventory and ancestry evidence; load `process/context/all-context.md` and `process/context/tests/all-tests.md`.
- [ ] 2. INNOVATE — choose no-mutation report structure.
- [ ] 3. PLAN-SUPPLEMENT — add newly discovered refs or protected worktrees only.
- [ ] 4. PVL — vc-validate-agent writes V1–V7 contract.
- [ ] 5. EXECUTE — create report only; no Git mutation.
- [ ] 6. EVL — independently verify report claims against current refs.
- [ ] 7. UPDATE PROCESS — record report and update umbrella state.

**Validate-contract required** before execute; a placeholder contract blocks report finalization.

## Touchpoints

- Read-only Git refs/worktrees; phase report path above.

## Public Contracts

- Branches, commits, worktrees, remote state, and `main` remain unchanged.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `branch-inventory` via read-only Git queries | Agent-Probe | C1 |
| ancestor comparison per branch | Hybrid | C2 |
| report diff limited to phase artifact | Fully-Automated | C3 |

## Test Infra Improvement Notes

(none identified yet; Git inventory is evidence collection, not an application test.)

## Resume and Execution Handoff

- Selected plan: this file.
- Primary execute anchor: this direct phase plan; supporting phase files: the umbrella plan and prior phase reports.
- Last completed step: not started.
- Validate-contract status: pending.
- Next step: spawn Phase 1 RESEARCH; do not commit directly to `main` or alter any ref.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE.)
