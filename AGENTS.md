# AGENTS.md

Permanent instructions for coding agents working in this repository.

## 1. Frontend design — mandatory

**The upstream repository `https://github.com/s1gmamale1/apple-design-skills` is the mandatory
design reference for every frontend change.** This is not a one-time redesign brief.

It applies to *every* task that touches the UI: fixing a frontend bug, changing a Tailwind class,
adding or redesigning a component, making something responsive, adding animation, improving
loading/error/empty/success states, refactoring a component, adding a feature with an interface,
or reviewing the frontend.

**Never skip it because a task looks small.** A one-line CSS change still has to preserve the
design system and its standards.

### Required workflow

**A. Identify the interface and the actual problem.** Inspect the route, component, styles, shared
tokens and current behaviour before editing. Do not edit first and diagnose afterwards.

**B. Load the relevant skills.** Read the skill files; do not work from memory of them.

| Situation | Read |
|---|---|
| Any UI task (start here) | `apple-design`, `apple-design-foundations`, `apple-design-interaction`, `apple-design-tactics` |
| Animation, springs, timing | `apple-design-motion` |
| Translucency / vibrancy / glass | `apple-design-materials` — only when genuinely appropriate |
| Landing / marketing / storytelling pages | `apple-design-web` |
| Platform-specific (iOS/macOS) surfaces | `apple-design-os` |
| Media delivery, CDN, video | `apple-design-backend` |
| Accessibility, inclusive design, brand | `apple-design-tactics` |

Use the applicable skills, not all of them. Adding Liquid Glass to every card because the skill
exists is a failure, not compliance.

**C. Establish design intent before editing.** Screen purpose, the single primary action,
information hierarchy, existing token constraints, accessibility requirements, and the smallest
coherent change.

**D. Implement** using existing components and tokens. No one-off hex values, no arbitrary
spacing, no new shadow or radius values inline.

**E. Validate the rendered interface.** Build and lint. Inspect the affected routes at 360 / 390 /
768 / 1440px. Use browser automation where available. Verify loading, error, empty, success and
disabled states, plus keyboard navigation, visible focus and accessible names.

**F. Report what actually changed** — components, decisions, skills read, checks run, and any
visual check you could *not* perform.

### Honesty rule

**Do not claim a skill was used unless you actually read or loaded it.** Do not describe a visual
check you did not run. "Verified at 360px" must mean you loaded the page at 360px.

When the upstream skills are updated, **follow the new instructions** rather than relying on
paraphrases copied into this file. This file points at the source of truth; it does not replace it.

## 2. Design direction

Hey Nomads is a roommate-matching product, not an Apple clone and not a generic SaaS dashboard.
Take the *principles* from the skills and keep this product's own warm, human identity.

Utility screens (feed, profile, matches, chat, agreements, settings) are **utility surfaces**:
motion restrained and near-invisible, springs ≤300ms, no cinematic effects, state transitions only.
A selected landing or storytelling surface may carry richer treatment, but not every screen does.

**One accent does the pointing.** This product currently uses coral and teal; do not add a third
hue or scatter accent colours to new UI without a stated reason.

Prefer: type and space carrying hierarchy, one effect per moment, calm colours, precise alignment,
real loading/empty/error states.

Avoid: glass on content cards, gradient text on every heading, coloured glow shadows, nested
rounded containers, hover-only interactions, emoji as an icon system, decorative animation with no
function, placeholder or invented metrics, and whole-page redesigns where a targeted fix works.

## 3. Database safety — non-negotiable

A verification script once deleted production records. These rules exist because of that.

- **Never run tests, QA suites, seeders, migrations or cleanup against production.**
- **Never run any test whose database target is uncertain.** A missing environment variable does
  *not* mean a safe test environment — it usually means the deployed database.
- `frontend-react/scripts/require-test-db.mjs` is the fail-closed guard. It refuses the deployed
  database, including via the non-pooler endpoint for the same database, unparseable URLs, and an
  unset `DATABASE_URL`. **Do not weaken or bypass it.** Overrides (`ALLOW_DEPLOYED_DB_TESTS`,
  `CONFIRM_TEST_DATABASE_HOST`) exist for deliberate, documented use only.
- `scripts/audit-write-paths.mjs` must report **zero unguarded writers**. Any new script that
  writes must import the guard before its first write.
- Test only against an isolated database, identified positively before running.
- **All production mutations require explicit human approval.** Including restores, resets,
  migrations, reclassification, deletions and deploys.
- Do not expose database URLs, passwords, tokens or connection strings in code, logs, commits or
  reports.
- Read-only inspection is allowed and expected during incidents. Open a read-only transaction and
  prove it by attempting a write the server must reject.

## 4. Account classification

- Genuine users must never see demo, QA, walkthrough or test identities as ordinary recommendations.
- **Unknown classification fails closed** wherever eligibility, discovery, matching or
  authorization depends on it.
- The same eligibility rules apply to feed, direct-id profile lookup, likes, shortlists, matches,
  chat and agreements. A UI badge is not a substitute for server-side enforcement.
- Never bulk-delete or reclassify accounts without a verified inventory and explicit approval.
- Migrations are prepared for review and **never applied automatically**.

## 5. Git

- Work on a dedicated branch. Do not commit to `main`, merge, force-push or deploy automatically.
- Preserve unrelated local changes; do not overwrite existing work.
- Focused, reviewable commits. Never commit credentials.
- Report honestly if write access is missing rather than claiming a commit happened.

## 6. Verification honesty

Unlazy gates live in `GATES*.md`. **Never mark a gate PASS without evidence from a command that
actually ran.** If a check could not be run, it is BLOCKED, not PASS.

## 7. Before finishing

Re-read the original request. Re-run the checks. Report what was completed separately from what is
proposed, and name anything you did not manage to verify.