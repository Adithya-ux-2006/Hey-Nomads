# Matching: criteria and exact scoring formula

Source of truth: `frontend-react/api/index.js` — `getMatchWeights`, `MATCH_CATEGORIES`,
`ANSWERED_FIELDS`, `loadScoreContext`, `scoreCompatibility` (documented from the
implementation as of commit `e5857c6`).

## Criteria

Two accounts are scored only on what both people actually answered:

- **Lifestyle** — sleep schedule, cleanliness, smoking, drinking, social energy,
  diet, noise tolerance.
- **Budget** — monthly budget, normalised by the cost level of the city each
  person is moving to so cross-currency numbers are comparable.
- **Location** — current city, destination city, neighbourhoods (current and
  preferred).
- **Move-in** — how close the two move-in dates are.
- **Interests** — shared interests from `users.interests`.
- **Habits** — flat type, pets, work schedule, shared languages.

### Unknown answers are never scored

`profiles` fills every lifestyle column with a default at account creation
(smoking `no`, drinking `no`, diet `veg`, cleanliness 3, budget 15000). Nothing
in the table marks a default as "not answered", so the scorer uses
`users.onboarding_complete` as the gate: until onboarding is complete, every
field in `ANSWERED_FIELDS` plus `budget` is treated as unknown. Unknown earns
no points and produces no reason string; if either side is unanswered the whole
score is 0. Completing onboarding (or saving answers through the profile
editor) is what makes an account scoreable.

## Formula

Each category is scored against its own ceiling; the six ceilings sum to 100 so
a perfect match on every factor is exactly 100.

| Category  | Ceiling |
|-----------|---------|
| lifestyle | 25      |
| budget    | 20      |
| location  | 20      |
| movein    | 15      |
| interests | 10      |
| habits    | 10      |

### Lifestyle (0–25)

| Factor           | Points |
|------------------|--------|
| sleep_time equal | +4 (reason: "Same sleep schedule") |
| sleep_time, either `flexible` | +2 |
| cleanliness      | `+round(4 × (1 − diff/4))`, diff = \|a−b\| on the 1–5 scale; diff ≤ 1 also gives "Similar cleanliness preference" |
| smoking equal    | +3 (both `no` also gives "Both non-smokers") |
| drinking equal   | +3 (reason: "Same drinking habits") |
| social_level     | `+round(3 × (1 − sdiff/2))`, sdiff on introvert=1, moderate=2, extrovert=3; sdiff 0 also gives "Similar social energy" |
| diet equal       | +4 (reason: "Both {diet} eaters") |
| diet veg↔eggetarian | +3 |
| noise_tolerance equal | +4 (reason: "Same noise tolerance") |
| noise_tolerance unequal | +1 |

Capped at 25.

### Budget (0–20)

Each side's cost index is `budget / cost_level`, where `cost_level` (1–5) comes
from the `cities` table for the city they are moving to (falling back to their
current city; missing city → 3, the midpoint). With both budgets positive:

```
closeness = 1 − |idxA − idxB| / max(idxA, idxB)
score     = round(20 × closeness)          # clamped 0..20
```

`closeness > 0.8` also gives "Comfortable in the same price bracket".

### Location (0–20)

| Condition | Points |
|-----------|--------|
| same current city | +12 (reason: "Same city") |
| else both moving to the same city | +10 (reason: "Both moving to the same city") |
| else one's current city equals the other's destination | +8 (either direction) |
| neighbourhoods align (mine-preferred = theirs-current, theirs-preferred = mine-current, or both preferred equal) | +8 (reason: "Preferred neighbourhoods align") |

Capped at 20.

### Move-in (0–15)

Both dates present: `|days between|` ≤ 14 → 15 (reason: "Moving in around the
same time"); ≤ 30 → 10; ≤ 60 → 5; otherwise 2. Either date missing → 7 (neutral
midpoint).

### Interests (0–10)

`min(10, shared × 2)`. 1–2 shared gives "N shared interest"; 3+ shared gives
"N shared interests".

### Habits (0–10)

| Factor | Points |
|--------|--------|
| flat_type equal | +3 (reason: "Same housing preference") |
| pets equal, or either side `okay` | +2 |
| work_schedule equal | +3 (reason: "Same work schedule") |
| any shared language | +2 (reason: "Share {languages}") |

Capped at 10.

### Total (0–100)

Weights come from the `match_weights` table (defaults: lifestyle 0.25, budget
0.20, location 0.20, movein 0.15, interests 0.10, habits 0.10). They are
re-normalised to sum to 1 before use, so the total always lands on 0–100 even if
the stored weights do not add up:

```
total = min(100, round( Σ_categories (breakdown[cat] / ceiling[cat]) × w_cat × 100 ))
```

### Feed ordering

Recommendation feeds sort by `score` descending, then `created_at` descending
(newest first), then `id` ascending.

## Gender preference filter

Applied in `getRecommendedRoommates` (backs both `/api/discover` and
`/api/roommates/recommended`) as a hard pre-scoring SQL filter, before the
candidate pool `LIMIT`, so an empty page can never be caused by post-filtering.
Pure predicates live in `frontend-react/api/gender-prefs.mjs`.

### Stored values

`preferences.preferred_gender` stores one of: `female`, `male`, `all`,
`unspecified`. The write gate in `POST /api/profile` rejects anything else with
a 400 before any database access. The legacy seed value `no_preference` (and
`NULL`, and any unknown string) reads as `unspecified` — it is never silently
coerced to `all` in storage.

### Two-sided rule

A candidate appears in your feed only if **both** sides' stated preferences
admit the other's gender:

1. **Your preference filters their gender.** A specific preference (`female` /
   `male`) admits only a candidate whose normalised gender matches exactly.
   `all` and `unspecified` admit every gender — including `other`,
   `prefer_not_to_say` and unset — because neither may invent a restriction
   the user never stated.
2. **Their preference filters your gender.** Symmetrically: a candidate with a
   specific preference only sees you if your normalised gender matches theirs.

Unknown gender fails closed against a *specific* preference: if someone stated
they want women, a candidate whose gender is unset or `other` is not shown to
them, because the match cannot be confirmed. Unknown gender never fails closed
against `all` / `unspecified` — those admit everyone.

`unspecified` and `all` therefore share filtering behaviour (neither imposes a
restriction) but remain distinct values: `all` is an affirmative choice, while
`unspecified` is the absence of one. The profile editor labels them separately
("Prefer not to specify" vs "All genders") and defaults new and legacy
(`no_preference`) accounts to "Prefer not to specify".

### What it does not touch

Swipe handling, existing matches, likes lists, chat, direct profile views and
the presentation discovery feed are all unfiltered — the rule governs
discovery recommendations only. A profile opened by direct link can still be
liked regardless of preference; mutual human intent is allowed to override a
stated preference, and existing matches are never retroactively broken.

### Positive control

`tests/offline/gender-prefs.test.mjs` carries positive controls: the
normalisation, predicate, and SQL-fragment checks are each paired with a
deliberately broken input that must fail the same assertion, proving the
checker is not vacuously true.

## Where it runs

- `loadScoreContext` batches the reads once per feed (requester profile, all
  candidate profiles, languages, city cost table) and scores in memory.
- `calcCompatibility` is the single-candidate path used by swipe, candidate
  detail and agreements.
