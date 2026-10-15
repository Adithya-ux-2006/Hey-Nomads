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
(newest first), then `id` ascending — the same comparator the presentation
discovery feed uses.

## Where it runs

- `loadScoreContext` batches the reads once per feed (requester profile, all
  candidate profiles, languages, city cost table) and scores in memory.
- `calcCompatibility` is the single-candidate path used by swipe, candidate
  detail, agreements and the presentation.
- The presentation discovery feed (`/api/presentation/discover`) calls the same
  `scoreCompatibility` with the same weights; only the candidate set differs.
