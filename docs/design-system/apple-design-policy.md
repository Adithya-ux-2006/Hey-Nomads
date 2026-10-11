# Frontend design policy — Apple design skills

**Status:** active. **Applies to:** every change in `frontend-react/`.

This policy exists so the rule survives without anyone remembering to restate it. It points at
`AGENTS.md` for the mandatory per-task workflow and at the upstream repository for the actual
design guidance. It does not replace either.

## 1. Source of truth

- Upstream: `https://github.com/s1gmamale1/apple-design-skills`
- Local checkout: `%USERPROFILE%\.config\opencode\vendor\apple-design-skills`
- Installed as junctions into `~/.claude/skills`, `~/.agents/skills`, and this repo's
  `.opencode/skills/`

Update with `git pull` in the checkout; the junctions propagate. The installer skips existing
names, so it never clobbers.

**When the upstream skills change, follow the new instructions.** Do not trust a paraphrase in this
file over the skill itself.

## 2. The two-axis decision

From `apple-design` — pick both axes before reaching for any effect.

| Axis | Question | Rule here |
|---|---|---|
| Restraint | Am I adding decoration or meaning? | Remove decoration. Type and space carry hierarchy. Glass is chrome only, never a content card. |
| Surface | Utility screen or flagship marketing page? | Hey Nomads app screens are **utility**: motion near-invisible, springs ≤300ms, no scroll-jacking, state transitions only. The landing page may carry richer treatment; it does not license that everywhere. |

Same restraint discipline, opposite motion budget — the surface sets the budget.

## 3. What this product already gets right

Keep these. They are the restraint exemplar in practice.

- Light-first warm palette: `surface.bg #FAF8F4`, `surface.card #FFFFFF`.
- A real type hierarchy: Poppins display, Inter body, with a semantic `text-*` scale.
- Restrained radii: `card 16px`, `pill`, `xl2 20px`, `xl3 24px`.
- Shadows are subtle by default (`soft`, `card`).

## 4. Known drift to fix deliberately, not gradually

These are inherited, not endorsed. Each needs a decision, not a quiet extra effect.

- **Coloured glow shadows** (`shadow-coral`, `shadow-teal`) — the upstream
  `restraint-and-antislop.md` calls over-saturation and glow a real failure mode. Prefer
  `shadow-card` / `shadow-soft`.
- **Three brand hues** (coral, amber, teal) — upstream says one accent does the pointing. Do not
  add a fourth; when choosing between existing accents, prefer coral as the primary and teal as
  functional/success.
- **Hardcoded hex in components** — the hub requires semantic tokens. Use `brand-*`, `surface-*`,
  `text-*`, `status-*`; never a literal colour in a page.

## 5. Anti-slop checklist

Run before declaring a UI change done.

- [ ] Light by default; dark only where purposeful.
- [ ] Exactly one accent is doing the pointing in this view.
- [ ] Could a plain solid card replace this effect with no loss of meaning? If yes, replace it.
- [ ] Gradient text appears 0–1 times, not on every heading.
- [ ] Hierarchy comes from type scale and whitespace, not boxes/borders/glow.
- [ ] At least one effect was **removed** since the first draft.
- [ ] Utility screen: motion is restrained and state-driven; nothing ambient.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] Touch targets are at least 44pt.
- [ ] Every icon has an accessible name; no emoji substituting for an icon.
- [ ] No hover-only interaction; everything reachable by keyboard with a visible focus ring.
- [ ] No invented metrics, fake users, or placeholder content.

## 6. Repeatable frontend-fix template

Copy into the PR description or the task notes for each UI change.

```
Problem / affected route:
Skill files actually read:
Root cause:
Design decisions (restraint axis, surface axis, tokens reused):
Accessibility decisions:
Components and styles changed:
Responsive checked at: 360 / 390 / 768 / 1440
Interaction states verified (loading / empty / error / success / disabled):
Checks run (lint / build / browser / profile qa) and their real results:
Visual regressions or checks I could NOT perform:
```

## 7. Anti-shortcut rules

- Do not claim a skill was used unless it was read this session.
- Do not claim a viewport was checked unless the page was loaded at it.
- Do not redesign a screen to fix a one-line problem.
- Do not add a component when an existing one in `src/components/UI.jsx` fits.
- Do not introduce a competing design system. These skills guide this product's design; they are
  not a replacement palette to install.

## 8. Validation commands

Run from `frontend-react/`. Anything that touches the database must point at an isolated test
database; see `AGENTS.md` §3.

```
npm run lint
npm run build
npm run qa:profile -- http://127.0.0.1:5199     # 360/390/768/1440 layout
npm run qa:browser -- http://127.0.0.1:5199     # rendered interaction flows
```

Browser and profile QA create accounts. They must not run against production.
