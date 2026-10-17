# Hey Nomads — Technical Parameter & Algorithm Inventory (Research Paper Source)

*Compiled read-only at commit `929cec9` (2026-10-16) and updated through `f7e5960` (2026-10-17). All file paths relative to repo root. Line numbers in §1–§8 refer to the working tree at `929cec9`; `api/index.js` has since grown by ~240 lines, so §9.1 lists current anchors for every key symbol. Sections added after compilation: §9 (gender-preference filter, age/DOB derivation, notification engine, Living DNA comparison/consent algorithm and failure modes, migration status), §7.8 (change history since `929cec9`), and the §8 master-register additions at the end of that table.*

---

## 1. Matching & Scoring Engine

**Location:** `frontend-react/api/index.js` — matching engine section, lines 755–986. Canonical prose documentation: `docs/matching-formula.md` (added in `8cd9aa1`, documented "as of commit `e5857c6`"). A second consumer of the same engine is `frontend-react/api/presentation.mjs` (lines 182–184, 210–211, 268–269), which imports `getMatchWeights`, `loadScoreContext`, `scoreCompatibility`, `calcCompatibility` from `index.js` (injected at mount, line 47–48; exported at `index.js:2605`).

### 1.1 Weights (`match_weights` table + code defaults)

Defined identically in three places:

| Weight | Value | Locations |
|---|---|---|
| `lifestyle_weight` | **0.25** | `index.js:432` (GET /api/match-weights defaults), `index.js:761` (getMatchWeights fallback), `database/schema_v2.sql:363` (column DEFAULT), `schema_v2.sql:373–375` (seed INSERT) |
| `budget_weight` | **0.20** | same sites: `index.js:432,761`; `schema_v2.sql:364,373–375` |
| `location_weight` | **0.20** | `index.js:432,761`; `schema_v2.sql:365,373–375` |
| `movein_weight` | **0.15** | `index.js:433,761`; `schema_v2.sql:366,373–375` |
| `interests_weight` | **0.10** | `index.js:433,761`; `schema_v2.sql:367,373–375` |
| `habits_weight` | **0.10** | `index.js:433,761`; `schema_v2.sql:368,373–375` |

Storage: single row table `match_weights` (`schema_v2.sql:361–370`), columns typed `DECIMAL(3,2)`. Read via `SELECT * FROM match_weights ORDER BY id LIMIT 1` (`index.js:435,760`). POST `/api/match-weights` (`index.js:444–497`) upserts id 1; validation: each value coerced with `Number.isFinite(n) && n >= 0 ? n : 0` (line 450); reject `400 'At least one factor must have a weight above zero'` when sum ≤ 0 (lines 453–455). Weights are **re-normalised at score time** (see §1.8), so stored values need not sum to 1.

Category→column key map (`WEIGHT_KEYS`, `index.js:777–780`): `lifestyle→lifestyle_weight, budget→budget_weight, location→location_weight, movein→movein_weight, interests→interests_weight, habits→habits_weight`.

### 1.2 Category ceilings (`MATCH_CATEGORIES`)

`index.js:766`:
```js
const MATCH_CATEGORIES = { lifestyle: 25, budget: 20, location: 20, movein: 15, interests: 10, habits: 10 };
```
Ceilings sum to 100. Mirrored client-side in `frontend-react/src/pages/RoommateDetailPage.jsx:258` (`max = key === 'lifestyle' ? 25 : key === 'budget' ? 20 : key === 'location' ? 20 : key === 'movein' ? 15 : key === 'interests' ? 10 : 10`) and in `docs/matching-formula.md:37–44`.

### 1.3 Answered-gate (`ANSWERED_FIELDS` + `answered()`)

`index.js:772–776`:
```js
const ANSWERED_FIELDS = [
  'sleep_time', 'cleanliness', 'smoking', 'drinking', 'social_level', 'diet',
  'noise_tolerance', 'flat_type', 'pets', 'work_schedule', 'move_in_date',
  'city', 'neighbourhood', 'preferred_neighbourhood',
];
```
`answered(row)` (`index.js:847–854`): if `row.onboarding_complete` is truthy, the row scores as-is; otherwise every field in `ANSWERED_FIELDS` **plus `budget`** is nulled (lines 851–852) — column defaults (smoking 'no', drinking 'no', diet 'veg', cleanliness 3, budget 15000) are placeholders, not answers. If either side is missing entirely (`!me || !them`) the whole result is `{score: 0, breakdown: {}, reasons: []}` (line 827). Unknown earns no points and no reason strings.

### 1.4 Data sources (`loadScoreContext`, `index.js:790–814`)

Four parallel queries per feed:
1. Requester: `SELECT u.interests, u.country, u.moving_to, u.onboarding_complete, p.* FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = $1`
2. Candidates: same shape with `WHERE u.id = ANY($1::int[])`, `u.id AS cand_id`
3. Languages: `SELECT ul.user_id, l.name FROM languages l JOIN user_languages ul ON l.id = ul.language_id WHERE ul.user_id = ANY($1::int[])`
4. City costs: `SELECT LOWER(name) AS name, cost_level FROM cities`

Tables/columns read by the scorer: `users.interests` (TEXT[]), `users.country`, `users.moving_to`, `users.onboarding_complete`; `profiles.sleep_time, cleanliness, smoking, drinking, social_level, diet, noise_tolerance, budget, city, moving? (via users), neighbourhood, preferred_neighbourhood, move_in_date, flat_type, pets, work_schedule`; `user_languages`+`languages.name`; `cities.cost_level` (1–5, `schema_v2.sql:126`, `CHECK (cost_level BETWEEN 1 AND 5)`, default 3).

Cost lookup (`index.js:859–862`): `costOf(row) = costByCity.get(lower(moving_to || city)) || 3` — missing city ⇒ level 3 midpoint.

### 1.5 Sub-score formulas (current, `scoreCompatibility`, `index.js:824–986`)

**Lifestyle (ceiling 25)** — `index.js:867–896`:
- sleep_time equal: **+4** (reason "Same sleep schedule"); either `'flexible'`: **+2** (871–874)
- cleanliness: **+round(4 × (1 − diff/4))** where `diff = |a−b|` on 1–5; `diff ≤ 1` also adds reason "Similar cleanliness preference" (875–879)
- smoking equal (both present): **+3**; both `'no'` adds "Both non-smokers" (880)
- drinking equal (both present): **+3**; both `'no'` adds "Same drinking habits" (881)
- social_level: map introvert=1, moderate=2, extrovert=3; **+round(3 × (1 − sdiff/2))**; sdiff 0 adds "Similar social energy" (882–887)
- diet equal: **+4** (reason `Both ${diet} eaters`); veg↔eggetarian: **+3** (888–891)
- noise_tolerance equal: **+4** ("Same noise tolerance"); unequal: **+1** (892–895)
- `breakdown.lifestyle = Math.min(25, lifestyleScore)` (896)

**Budget (ceiling 20)** — `index.js:898–912`:
- Default `budgetScore = 10` (neutral) when either budget missing/zero (903)
- Cost indices: `idxA = bA / (meCost || 1)`, `idxB = bB / (themCost || 1)` (905)
- `closeness = 1 − |idxA − idxB| / max(idxA, idxB)`; `budgetScore = round(20 × closeness)` (906–909)
- `closeness > 0.8` adds "Comfortable in the same price bracket" (910)
- `breakdown.budget = max(0, min(20, budgetScore))` (912)

**Location (ceiling 20)** — `index.js:914–928`:
- same current city (lowercased): **+12** ("Same city"); else both `moving_to` equal: **+10**; else current↔destination cross-match either direction: **+8** (918–921)
- neighbourhood alignment (mine-preferred = theirs-current, theirs-preferred = mine-current, or both preferred equal): **+8** ("Preferred neighbourhoods align") (923–927)
- `breakdown.location = Math.min(20, locationScore)` (928)

**Move-in (ceiling 15)** — `index.js:930–939`:
- `diffDays = |date(me.move_in_date) − date(them.move_in_date)| / 86400000`
- ≤14 days: **15** ("Moving in around the same time"); ≤30: **10**; ≤60: **5**; else: **2**
- either date missing: **7** (neutral midpoint) (938)

**Interests (ceiling 10)** — `index.js:941–951`:
- both lists non-empty: `shared = |intersection|`; `interestsScore = min(10, shared × 2)` (947)
- shared ≥3: reason "N shared interests"; 1–2: "N shared interest" (948–949); 0 shared: 0 points

**Habits (ceiling 10)** — `index.js:953–967`:
- flat_type equal: **+3** ("Same housing preference") (955)
- pets equal: **+2**; either side `'okay'`: **+2** (956–959)
- work_schedule equal: **+3** ("Same work schedule") (960)
- any shared language: **+2** ("Share {langs}") (961–966)
- `breakdown.habits = Math.min(10, habitsScore)` (967)

### 1.6 Total formula

`index.js:969–985`:
```
totalWeight = Σ weights[k] for k in WEIGHT_KEYS values
w_cat      = weights[WEIGHT_KEYS[cat]] / (totalWeight || 1)          # re-normalised to Σ=1
total      = min(100, round( Σ_cat (breakdown[cat] / ceiling[cat]) × w_cat × 100 ))
```
Also stated in `docs/matching-formula.md:116–118`. Feed ordering (`index.js:1153–1154`): score descending, then `created_at` descending, then `id` ascending (stable sort over `ORDER BY u.created_at DESC` SQL, line 1137).

### 1.7 Single-candidate path

`calcCompatibility(userId, candidateId, weights)` (`index.js:818–821`) = `loadScoreContext(userId, [candidateId])` + `scoreCompatibility`. Used by: swipe→match creation (`index.js:1276–1277`, writes `matches.compatibility_score` and `status='matched'`, lines 1284–1286), candidate detail (`index.js:1209`), presentation swipe (`presentation.mjs:268–269`), presentation profile (`presentation.mjs:210–211`).

### 1.8 Candidate selection (`getRecommendedRoommates`, `index.js:1080–1160`)

- Defaults: `page = 1`, `limit = 20` → `pageSize = parseInt(limit) || 20` (1082–1083); `pool` default **60** → `poolSize = Math.max(parseInt(pool) || 60, pageSize + offset)` (1089)
- Exclusions: self (`u.id != $1`), real-account filter via `realOnlySql('u')` (1103, see §2), blocked pairs both directions (1093–1110), optional `city LIKE %city%` (1112), `budget_min`/`budget_max` (1113–1114), **all** swiped users (`SELECT swiped_id FROM swipes WHERE swiper_id = $1`, excluded in SQL via `NOT IN`, 1120–1125)
- SQL: `ORDER BY u.created_at DESC LIMIT poolSize` (1137–1139) — fetches a wider pool than one page, scores in memory, sorts, slices `offset..offset+pageSize` (1155)
- Discover dashboard calls it with `{ limit: 5 }` (`index.js` discover section, introduced `e8c23a2`)

### 1.9 Tables

`users`, `profiles`, `preferences`, `languages`, `user_languages`, `cities` (cost_level), `swipes`, `blocks`, `matches`, `match_weights`. Schema: `database/schema_v2.sql`.

---

## 2. Account Classification (anti-fraud / eligibility)

**File:** `frontend-react/api/account-kind.mjs` (123 lines, created in `a092a09`, evolved through `3230fca`, `27788b9`, `425d29b`).

### 2.1 KIND enum (lines 14–21)

| Key | Value |
|---|---|
| `REAL` | `'real'` |
| `DEMO` | `'demo'` |
| `QA` | `'qa'` |
| `WALKTHROUGH` | `'walkthrough'` |
| `UNKNOWN` | `'unknown'` (added `3230fca`; absent in the original `a092a09` version) |

### 2.2 Literal patterns

- `DEMO_DOMAIN = 'heynomads.app'` (line 24) — owned by `seed-test-data.mjs` (`EMAIL_DOMAIN = '@heynomads.app'`, `scripts/seed-test-data.mjs:105`)
- `QA_LOCAL_PREFIXES = ['qa.', 'verify', 'walkthrough']` (line 26)
- `WALKTHROUGH_PREFIX = 'walkthrough.'` (line 28)
- `DEMO_EMAIL_PATTERN = '%@heynomads.app'` (line 84)
- `NOT_REAL_EMAIL_SQL` (lines 91–95):
  ```sql
  email NOT LIKE '%@heynomads.app'
  AND email NOT LIKE 'qa.%'
  AND email NOT LIKE 'verify%'
  AND email NOT LIKE 'walkthrough.%'
  ```

### 2.3 `classifyEmail(email)` (lines 30–46)

1. non-string → `UNKNOWN`
2. `trim().toLowerCase()`; empty, no `@`, starts/ends with `@` → `UNKNOWN` (fail-closed; added `3230fca` — previously returned `REAL`)
3. empty local or domain after split → `UNKNOWN`
4. `domain === 'heynomads.app'` → `DEMO`
5. `local.startsWith('walkthrough.')` → `WALKTHROUGH`
6. local starts with any of `'qa.'`, `'verify'`, `'walkthrough'` → `QA`
7. else → `REAL`

Note ordering: `walkthrough.` is checked before the QA prefix list, so `walkthrough.x@…` classifies WALKTHROUGH, not QA.

### 2.4 `classifyAccount(row)` (lines 66–73) — three-state stored-column logic (added `27788b9`)

- `row.account_kind === undefined` → fall back to `classifyEmail(row.email)` (pre-migration heuristic, byte-identical behaviour)
- column present, non-string → `UNKNOWN`; empty or `'unknown'` → `UNKNOWN`
- column present, string → lowercased; if in `Object.values(KIND)` return it verbatim, else `UNKNOWN` (fail closed)

### 2.5 Predicates & SQL fragments

- `hasStoredKind(row)` = `row?.account_kind !== undefined` (line 76)
- `isDemo(email)` = classifyEmail === DEMO (line 78)
- `isRealFeedCandidate(email)` = classifyEmail === REAL (line 81) — **heuristic only**, feed candidate gate
- `isInteractingAsRealUser(email)` = classifyEmail === REAL (line 98) — swipe/shortlist gate
- `realAccountSql(alias, stored)` (lines 111–114): `stored` true → `` `${alias}.account_kind = 'real'` ``; false → `NOT_REAL_EMAIL_SQL` with `email` replaced by aliased email
- `humanLabel(kind)` (116–123): DEMO→'Demo', QA→'Test account', WALKTHROUGH→'Test account', else null

### 2.6 Runtime wiring in `index.js`

- `hasStoredAccountKind()` (`index.js:1003–1019`): probes `information_schema.columns` for `public.users.account_kind` once, caches; probe failure ⇒ assume pre-migration (`false`) — "fail toward visibility"
- `kindOf(row)` (1022–1025), `isRealRow(row)` (1028–1030), `realOnlySql(alias)` (1033–1035)
- `actorIsRealUser(userId)` (1040–1044): indexed lookup, requires actor REAL (`3230fca`)
- Registration writes `account_kind = classifyEmail(normalizedEmail)` with fallback INSERT without the column (`index.js:260–268`, added `884d20a`)
- Feed: `WHERE u.id != $1 AND ${await realOnlySql('u')}` (`index.js:1103`)
- Swipe: actor must be real (1243–1245, error `'Sample and test accounts cannot like or pass anyone'`); target must be real (1253–1256, error `` `${kind || 'This'} profile cannot be liked or passed` ``)
- Likes lists: `sentLikesQuery`/`receivedLikesQuery` receive the same `realOnlySql('u')` fragment (`index.js:1351,1362`; builders in `frontend-react/api/likes-queries.mjs:29–82`, added `d86f9db`)
- Agreements: `assertRealMatchedPair(a, b)` requires matched REAL pair both sides (`3230fca`, `02e0176`)

### 2.7 Migration (not applied)

`database/migrations/2026-10-10_add_account_kind.sql` (added `a092a09`): `ADD COLUMN IF NOT EXISTS account_kind TEXT`; `SET DEFAULT 'unknown'`; `CHECK (account_kind IS NULL OR account_kind IN ('real','demo','qa','walkthrough','unknown'))`; index `idx_users_account_kind`. Backfill statements are present but commented "NOT executed" (lines 56–66). Known-limitation note: ~110–191 legacy QA rows (`feed.*`, `layout.*`, `actorprobe.*`, `agr.*`) have no reserved prefix and classify as REAL (lines 16–27).

### 2.8 Presentation namespace

`qa.present.` + role ∈ {`host`,`ada`,`noor`,`sam`} → emails `qa.present.host@gmail.com` etc. (`presentation.mjs:19–22`; `src/lib/presentation-cohort.js:13–14`). These classify QA via the `qa.` local prefix. Session token: `jwt.sign({ userId, scope: 'presentation' }, JWT_SECRET, { expiresIn: '30d' })` (`presentation.mjs:52`); global guard refuses presentation tokens on non-presentation endpoints (`index.js:147–159`); feature flag `PRESENTATION_ENABLED !== '1'` ⇒ routes 404 (`presentation.mjs:40–45`, added `db04af0`).

---

## 3. Upload / Photo Validation

### 3.1 Server: `frontend-react/api/upload-guards.mjs` (added `d86f9db`, 2026-10-16)

- `MAX_UPLOAD_BYTES = 4 * 1024 * 1024` (4,194,304 bytes = 4 MB) — line 11. Comment: Vercel caps bodies at ~4.5 MB.
- `ALLOWED_IMAGE_TYPES` (lines 13–18): `image/jpeg→jpg`, `image/jpg→jpg`, `image/png→png`, `image/webp→webp`
- Magic-byte signatures (`sniffImageType`, lines 21–37):
  - JPEG: `FF D8 FF` (bytes 0–2)
  - PNG: `89 50 4E 47 0D 0A 1A 0A` (bytes 0–7)
  - WEBP: ASCII `RIFF` at 0–3 + ASCII `WEBP` at 8–11
- `validateUpload({contentType, buffer})` verdicts (lines 47–82), in order:
  1. declared type (MIME before `;`, trimmed, lowercased) not in allowlist → `{ok:false, status:415, error:'Unsupported image type. Use a JPG, PNG or WebP.'}`
  2. empty/missing buffer → `{ok:false, status:400, error:'The upload body was empty.'}`
  3. `buffer.length > MAX_UPLOAD_BYTES` → `{ok:false, status:413, error:'Image is too large. The maximum size is 4 MB.'}`
  4. sniffed type null or ≠ declared → `{ok:false, status:400, error:'The file content does not match its declared image type.'}` (alias exception: declared `image/jpg` + sniffed `image/jpeg` accepted, line 73)
  5. success: `{ok:true, contentType: declared==='image/jpg' ? 'image/jpeg' : declared, ext}`

Route `POST /api/upload` (`index.js:703–753`): streaming size cap aborts accumulation past `MAX_UPLOAD_BYTES` → `413` same error string (723–725); missing `BLOB_READ_WRITE_TOKEN` → `503 { error:'Image storage is not configured on this deployment.', code:'storage-not-configured' }` (737–742); filename pattern `${req.userId}-${Date.now()}.${verdict.ext}` (743); generic failure → `500 'Upload failed'` (751). Auth failures: `401 'No token provided'` / `'Invalid token'` (`index.js:42,49`).

### 3.2 Client: `frontend-react/src/lib/photoUpload.js` (added `d86f9db`)

- `MAX_PHOTO_BYTES = 4 * 1024 * 1024` (line 8)
- `PHOTO_TYPES` (lines 10–15): `image/jpeg`, `image/jpg`, `image/png`, `image/webp` (all `true`)
- `validatePhotoFile` errors (17–29): `'Choose a JPG, PNG or WebP image.'`; `'That file is empty.'`; `'That image is over 4 MB. Choose a smaller photo.'`
- Upload state machine `uploadPhoto({file, uploadedUrl, upload, timeoutMs = 15000})` (47–74):
  - states returned: `{status:'uploaded', url}` (only with a server URL; reuses already-confirmed `uploadedUrl` so retry never double-uploads, line 48); `{status:'failed', error}` for: no file (`'No photo has been chosen yet.'`), timeout (`'The upload timed out. Check your connection and retry.'`), missing URL (`'The server did not confirm the upload.'`), or thrown error (message or `'Upload failed. Your photo is kept on this device.'`)
  - timeout default **15000 ms** (line 47), raced via `Promise.race` (53–61)
- Retention: `classifyStorageError` → `'quota'` iff `err.name === 'QuotaExceededError'` else `'error'` (84–86); `makeRetention(kv)` returns reasons `'quota'|'error'|'unsupported'` (88–124)
- IndexedDB (126–128): `DB_NAME = 'hey_nomads_photo'`, `STORE_NAME = 'pending'`, `KEY = 'current'`; DB version **1** (`factory.open(DB_NAME, 1)`, line 146)

UI states in `EditProfilePage.jsx` (`photoStatus` state: `'idle'` at line 56 plus uploading/failed/uploaded variants used through the page).

---

## 4. Product Defaults & Preference Values

### 4.1 Schema column defaults — `database/schema_v2.sql`

| Column | Default | CHECK / note | Line |
|---|---|---|---|
| `profiles.sleep_time` | `'flexible'` | IN ('early','late','flexible') | 33 |
| `profiles.cleanliness` | `3` | BETWEEN 1 AND 5 | 34 |
| `profiles.diet` | `'veg'` | IN ('veg','nonveg','eggetarian','vegan') | 35 |
| `profiles.noise_tolerance` | `'moderate'` | IN ('quiet','moderate','loud') | 36 |
| `profiles.noise_level` | `3` | — | 37 |
| `profiles.budget` | `15000` | — | 38 |
| `profiles.tax_bracket` | `'medium'` | IN ('low','medium','high') | 39 |
| `profiles.deposit` | `5000` | — | 40 |
| `profiles.flat_type` | `'shared'` | IN ('1BHK','2BHK','3BHK','shared','studio','other') | 41 |
| `profiles.occupants` | `1` | — | 42 |
| `profiles.smoking` | `'no'` | IN ('yes','no') | 43 |
| `profiles.drinking` | `'no'` | IN ('yes','no') | 44 |
| `profiles.partying` | `'low'` | IN ('low','medium','high') | 45 |
| `profiles.social_level` | `'moderate'` | IN ('introvert','moderate','extrovert') | 110 |
| `profiles.pets` | `'no'` | IN ('yes','no','okay') | 111 |
| `profiles.work_schedule` | `'regular'` | IN ('regular','remote','flexible','night') | 112 |
| `preferences.preferred_location_radius` | `10` | — | 56 |
| `preferences.prefers_smoking` | `'no_preference'` | IN ('yes','no','no_preference') | 57 |
| `preferences.prefers_drinking` | `'no_preference'` | IN ('yes','no','no_preference') | 58 |
| `preferences.prefers_cleanliness_min` | `1` | — | 59 |
| `preferences.prefers_sleep_schedule` | `'no_preference'` | IN ('early','late','flexible','no_preference') | 60 |
| `preferences.prefers_same_diet` | `FALSE` | — | 61 |
| `preferences.prefers_same_sleep` | `FALSE` | — | 62 |
| `users.interests` | `'{}'` | — | 104 |
| `users.verification_status` | `'none'` | IN ('none','email','identity','university','work') | 105 |
| `users.onboarding_complete` | `FALSE` | — | 106 |
| `users.looking_for` | `'both'` | IN ('roommate','community','both') | 107 |
| `cities.cost_level` | `3` | BETWEEN 1 AND 5 | 126 |
| `cities.student_friendly` / `expat_friendly` | `TRUE` | — | 127–128 |
| `matches.compatibility_score` | `0` | — | 145 |
| `matches.status` | `'pending'` | IN ('pending','matched','unmatched','blocked') | 146 |
| `swipes.action` | — (NOT NULL) | IN ('like','pass') | 165 |
| `agreements.status` | `'draft'` | — | 91 |
| `reports.status` | `'pending'` | IN ('pending','reviewed','resolved','dismissed') | 229 |
| `communities.member_count` | `1` | — | 246 |
| `community_members.role` | `'member'` | IN ('member','admin','creator') | 258 |
| `events.attendee_count` | `0` | — | 278 |
| `event_rsvps.status` | `'going'` | IN ('going','maybe','cancelled') | 299 |
| `settlement_tasks.order` | `0` | — | 338 |
| `users.is_verified`, `profiles.is_verified` | `FALSE` | — | 20, 46 |

### 4.2 API-layer insert defaults — `index.js:631–639` (POST /api/profile, first-row INSERT branch)

Same values as schema: `sleepTime||'flexible'`, `safeInt(cleanliness,3)`, `diet||'veg'`, `noiseTolerance||'moderate'`, `safeInt(noiseLevel,3)`, `safeInt(budget,15000)`, `safeInt(deposit,5000)`, `flatType||'shared'`, `safeInt(occupants,1)`, `smoking||'no'`, `drinking||'no'`, `partying||'low'`, `profileImage||''`, `socialLevel||'moderate'`, `pets||'no'`, `workSchedule||'regular'` (632–638). Preferences update defaults (`index.js:661–666`): radius `||10`, `prefers_smoking||'no_preference'`, `prefers_drinking||'no_preference'`, `prefers_cleanliness_min||1`, `prefers_sleep_schedule||'no_preference'`, same-diet/same-sleep boolean-coerced.

Update branch uses `COALESCE($n::type, col)` so omitted fields keep stored values (`index.js:596–623`; comment 587–595 explains the pre-fix reset bug).

### 4.3 Onboarding clamps — `index.js:396–398` (POST /api/onboarding)

- budget: `Math.max(0, Math.min(10000000, parseInt(budget,10) || 0))` (line 396)
- cleanliness: `Math.max(1, Math.min(5, parseInt(cleanliness,10) || 3))` (line 398)

### 4.4 Client form defaults

- `src/pages/OnboardingPage.jsx:35–48`: `looking_for:'both'`, `budget: 15000`, `flat_type:'shared'`, `cleanliness:3`, `sleep_time:'flexible'`, `social_level:'moderate'`, `smoking:'no'`, `drinking:'no'`, `diet:'veg'`, `interests:[]`; budget input `step={50}` (line 143)
- `src/pages/EditProfilePage.jsx:64–75`: `sleepTime:'flexible'`, `cleanliness:3`, `diet:'veg'`, `noiseTolerance:'moderate'`, `noiseLevel:3`, `smoking:'no'`, `drinking:'no'`, `partying:'low'`, `socialLevel:'moderate'`, `budget:15000`, `deposit:5000`, `flatType:'shared'`, `occupants:1`; load-time fallbacks repeat these at lines 106–120

### 4.5 Presentation cohort fixtures — `src/lib/presentation-cohort.js` (added `e8c23a2`)

`MOVE_DATE = '2026-11-15'`; city `'London'`; `looking_for:'roommate'`; `social_level:'moderate'`; `noiseTolerance:'moderate'`, `noiseLevel:3` for all four. Per-person: host budget 1450/cleanliness 4/sleep flexible/diet eggetarian/smoking no/drinking no/pets no/work remote; ada 1250/4/flexible/veg/no/no/pets okay/remote; noor 1400/3/late/nonveg/no/drinking yes/pets no/night; sam 1550/5/flexible/veg/no/drinking yes/pets no/flexible. All flatType `'2BHK'`.

### 4.6 Demo-mode client fixtures — `src/lib/demoProfiles.js` (added `0144bb3`, hardened `d86f9db`)

IDs 9101–9104; budgets 28000/24000/21000/19000; all `is_demo: true`. `demoMode.js:74` fixed score **84**; `demoMode.js:199–200` fallback breakdown `{lifestyle:22, budget:16, location:18, movein:12, interests:8, habits:9}`.

### 4.7 Seed fixture parameters — `scripts/seed-test-data.mjs`

Demo domain `@heynomads.app` (line 105). Indian-city cohort budgets 18000–32000, deposits 36000–60000; London-cohort budgets 850–1600; radius values 8/10/12/15; deposits = 2× budget pattern; all profiles answer every field (bypass the answered-gate by being seeded with onboarding presumably complete — seeded via direct SQL, lines 472–490).

### 4.8 Agreement template constants — `index.js:2218`

Quiet hours hardcoded **10 PM–7 AM**; guest policy **24h notice**; cleanliness priority **High if ≥4 else Moderate**.

### 4.9 Living DNA — `database/migrations/2026-10-11_add_living_dna.sql` (added `c60f453`; NOT APPLIED)

15 questions (slugs `cleaning_chores`, `quiet_hours`, `guests`, `rent_bills`, `late_payments`, `food_kitchen`, `diet_vegetarian`, `power_ac`, `domestic_help`, `privacy_borrowing`, `work_noise`, `family_visits`, `conflict`, `groceries`, `house_rules`), options JSONB `CHECK (jsonb_array_length(options) >= 3)` (line 40); constitution rule `status` IN ('proposed','agreed','declined') default `'proposed'` (79–80); sharing flags default FALSE (65–66). API caps: ≤**50** answers per request (`index.js:2345`, `'too many answers in one request'`); rule text `slice(0, 500)` (`index.js:2536`).

---

## 5. API / Infra Constants

All in `frontend-react/api/index.js` unless noted.

| Parameter | Value | Line | Notes / commit |
|---|---|---|---|
| `JWT_SECRET` | env-only; process refuses to start if unset | 30–33 | throw `'JWT_SECRET is not set. Refusing to start: tokens would be forgeable.'` |
| JWT expiry (`signToken`) | `'30d'` | 36 | since `2fca172` (2026-09-15) |
| Presentation JWT expiry | `'30d'`, claim `scope:'presentation'` | presentation.mjs:52 | `e8c23a2` |
| Auth header scheme | `Bearer <token>` | 41,148 | 401 `'No token provided'` / `'Invalid token'` |
| bcrypt rounds | **10** | 251 | `bcrypt.hash(password, 10)`; since `2fca172` |
| Password length | 8–72 chars | 240–241 | `'Password must be 8 to 72 characters'`; login rejects >72 with 401 (288–289) |
| Email max length | 254 | 236 | regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| Name max length | 100 | 243–244, 264 | `'Name must be under 100 characters'`; `slice(0,100)` |
| PG pool `max` | **10** | 61 | since `8483f32` |
| `connectionTimeoutMillis` | **10000** | 62 | added `92d22e6` |
| `idleTimeoutMillis` | **30000** | 63 | added `92d22e6` |
| pool SSL | `{ rejectUnauthorized: false }` | 60 | since `babdf34` |
| Login rate limit | max **10** / window **15 min** (900 000 ms) | 107–111 | message `'Too many sign-in attempts. Try again in a few minutes.'`; added `8483f32` |
| Register rate limit | max **5** / window **60 min** (3 600 000 ms) | 113–117 | message `'Too many accounts created from this device. Try again later.'`; `8483f32` |
| Presentation start limit | max **15** / window **60 s** | presentation.mjs:90–94 | message `'The presentation is starting too quickly. Try again in a minute.'`; `e8c23a2` |
| Rate-limiter map GC bound | **5000** keys | 98 | prune keys with no recent hits |
| Rate-limit key | lowercased `req.body.email` (deliberately not IP) | 88 | 429 + `Retry-After: ceil(windowMs/1000)` |
| JSON body limit | **none explicit** (express.json() default ~100kb) | 140 | was `'10mb'` (`2fca172`–`41844ea`), removed `c527384` ("the 10mb JSON limit was fiction… Vercel caps request bodies at 4.5MB") |
| Vercel body cap (external) | ~4.5 MB | comments 139, 707 | cited in upload design |
| Upload size cap | **4 MB** (see §3) | upload-guards.mjs:11 | `d86f9db` |
| Feed default page size | **20** | 1082–1083 | since `41844ea` era (`limit = 20`) |
| Feed score pool | **60** | 1089 | added `e8c23a2` |
| Discover top-N | **5** | discover route (`limit: 5`) | `e8c23a2`; pre-6028750 used `ORDER BY RANDOM() LIMIT 5` |
| Community/event list LIMITs | **5** (top by city), **10** (cities) | 1623, 1843–1844, 2047–2054 | |
| Pagination LIMIT/OFFSET | `LIMIT $ OFFSET $` with `limit=20` default | 1591, 1711 | |
| Message content length | CHECK `length(trim)>0 AND length<=5000` | schema_v2.sql:200 | |
| Community title slice | 300 | index.js:1732 | |
| Event/community category slice | 50 | index.js:1735 | |
| Living DNA answers/request | ≤ 50 | index.js:2345 | |
| Living constitution rule text | slice(0, 500) | index.js:2536 | |
| Sentry `tracesSampleRate` | **0** | 23 | env `SENTRY_DSN` inert if unset |
| Health cron | `0 9 * * *` (daily 09:00 UTC) | frontend-react/vercel.json:5 | "Hobby plan rejects sub-daily schedules" (`8e2a3bd`) |
| Health token | header `x-health-token` === `HEALTH_TOKEN` env | 182 | gates verbose host/db detail |
| Required boot tables | `['users','profiles','communities','events','cities','settlement_tasks']` | 164 | |
| Default DB port fallback | **5432** | 171 | in `dbTarget()` |
| CORS | dev-only (`VERCEL_ENV !== 'production'`), `origin:true, credentials:true` | 135–137 | CORS always-on until `c527384` |
| Netlify→Vercel API proxy | `https://hey-nomads.vercel.app/api/:splat`, status 200, force | netlify.toml:13–17 | `38bea21` |
| Cookie/session values | **none** — pure Bearer-JWT, no cookies | — | |

---

## 6. Database Schema Values

Source: `database/schema_v2.sql` (402 lines) + 2 migrations. Key enums/CHECKs already tabulated in §4.1. Additional structural values:

- `matches`: `CHECK (user_a_id <> user_b_id)`, `UNIQUE (user_a_id, user_b_id)` (149–150); status transitions in code: swipe match inserts `'matched'` (`index.js:1285`); unmatch sets `'unmatched'` (`index.js:1334`); block sets `'blocked'` (block route); matches list filters `status = 'matched'` (`index.js:1320`)
- `swipes`: `CHECK (swiper_id <> swiped_id)`, `UNIQUE (swiper_id, swiped_id)` (167–168); upsert `ON CONFLICT DO UPDATE SET action=$3, created_at=CURRENT_TIMESTAMP` (`index.js:1260–1261`); action values used: `'like'`, `'pass'` (validated `['like','pass'].includes(action)`, `index.js:1237`)
- `agreements`: `UNIQUE (user_a_id, user_b_id)` (93); status `'draft'` default
- `messages`: content CHECK ≤ 5000 chars (200)
- `living_dna_*` and `living_constitution_*` (migration 2026-10-11): see §4.9; acceptance PK `(match_id, user_id)` (93)
- `account_kind` CHECK list: `('real','demo','qa','walkthrough','unknown')` (migration 2026-10-10:52); default `'unknown'` (42)
- Unique indexes: `idx_cities_name_country` on `(LOWER(name), LOWER(country))` (132); `idx_settlement_tasks_title` on `LOWER(title)` (346); `idx_resources_title` on `LOWER(title)` (323)
- Triggers: `update_updated_at()` on `matches`, `conversations` (379–393)

---

## 7. Change History (git archaeology)

Commit dates from `git log --format='%h|%ad|%s' --date=short`. Repository spans `c6158c8` (initial) → `929cec9` (2026-10-16).

### 7.1 Matching engine evolution

| # | Parameter / behaviour | Old value | New value | Commit | Date | Message | File:loc |
|---|---|---|---|---|---|---|---|
| 1 | Weights (all six) | — | 0.25/0.20/0.20/0.15/0.10/0.10 | `2fca172` | 2026-09-15 | feat: full platform redesign — roommate matching + community + settlement | api/index.js getMatchWeights + schema_v2.sql §11. **Never changed since.** |
| 2 | Total formula | `Σ breakdown_cat × (w_cat/ceiling_ref) × ceiling_ref` (double-weighted; perfect match = **18.5**, rendered as %) | `min(100, round(Σ (breakdown/ceiling) × (w/Σw) × 100))` (renormalised, 0–100) | `6028750` | 2026-10-08 | Fix data layer: real health check, scored discovery, no silent failures | index.js total block (old lines ~692+; new totalWeight at 976–983) |
| 3 | Budget sub-score | `round(20 × (1 − |bA−bB|/max(bA,bB)))` raw-currency closeness; neutral default 10; reason "Similar budget range" if `|bA−bB| < maxB×0.2` | cost-index normalised: `idx=b/cost_level`; `closeness = 1 − |idxA−idxB|/maxIdx`; reason "Comfortable in the same price bracket" if closeness > 0.8 | `8483f32` | 2026-10-09 | Prepare MVP data flows and verification | index.js budget block (was ~671–690 in 2fca172) |
| 4 | `MATCH_CATEGORIES` constant | absent (ceilings implicit in formula) | `{lifestyle:25,budget:20,location:20,movein:15,interests:10,habits:10}` | `6028750` | 2026-10-08 | (same as #2) | index.js:766 |
| 5 | Smoking/drinking equality checks | `if (me.smoking === them.smoking)` with unreachable `else if both 'no'` duplicate (undefined===undefined awarded +3) | null-guarded: `me.smoking && them.smoking && me.smoking === them.smoking` | `e8c23a2` | 2026-10-15 | feat(presentation): guided competition walkthrough on a scoped session | index.js:880–881 |
| 6 | Answered-gate | none — column defaults scored as answers (unfilled accounts got perfect lifestyle 25/25 + budget 20/20) | `ANSWERED_FIELDS` + `answered()`; `onboarding_complete` gate; budget nulled pre-onboarding | `e8c23a2` | 2026-10-15 | (same) | index.js:772–776, 847–854 |
| 7 | Scoring I/O | 6 sequential queries per candidate (~170 RTs / ~10 s feed) | `loadScoreContext` batches 4 parallel queries once per feed; in-memory scoring | `92d22e6` | 2026-10-12 | perf(api): load the scoring context once so the feed is not O(N) round-trips | index.js:790–814 |
| 8 | Feed candidate window | SQL `LIMIT` = page size (Discover's "top 5" = 5 newest); Discover excluded only passes; swipes filtered post-query | unified `getRecommendedRoommates`; `poolSize` default 60; all swipes excluded in SQL; deterministic sort score↓ created_at↓ id↑ | `e8c23a2` | 2026-10-15 | (same) | index.js:1080–1160 |
| 9 | Pass-only swipe exclusion | `NOT EXISTS (… s.action='pass')` + blocks NOT EXISTS | replaced by all-swipes `NOT IN` + blocks union query | `6028750` → superseded `e8c23a2` | 2026-10-08 → 2026-10-15 | | index.js:1116–1125 |
| 10 | Discover ranking | `ORDER BY RANDOM() LIMIT 5` | scored ranking (real weighted engine) | `6028750` | 2026-10-08 | Fix data layer… | index.js discover route |
| 11 | Formula documentation | none | `docs/matching-formula.md` (133 lines) | `8cd9aa1` | 2026-10-15 | docs(release): finalize matching formula and presentation security checks | docs/matching-formula.md |
| 12 | Discover raw breakdown UI | raw breakdown shown | dropped; chips capped | `0e1462e` | 2026-10-12 | fix(discover): contain the avatar, drop the raw breakdown, cap the chips | src/pages/DiscoverPage.jsx |

### 7.2 Account classification evolution

| # | Parameter / behaviour | Old | New | Commit | Date | Message | File:loc |
|---|---|---|---|---|---|---|---|
| 13 | Demo exclusion | none (demo accounts ranked in real feeds) | `const DEMO_EMAIL_SUFFIX = '%@heynomads.app'`; feed `WHERE … AND u.email NOT LIKE suffix` | `a038c2e` | 2026-10-10 | Fix double-encoded like, surface match outcome, add agreements feature and labelled demo mode | index.js |
| 14 | Demo boundary on writes | page-level only | API guards: swipe/shortlist target `email.endsWith('@heynomads.app')` → 403 `'Demo profiles cannot be liked or passed'` / `'…cannot be shortlisted'` | `f23d4f4` | 2026-10-10 | Enforce demo-account boundary in the API, not only in the page | index.js |
| 15 | Classification module | inline `NOT LIKE` strings (4 copies) | `account-kind.mjs` created: KIND {REAL,DEMO,QA,WALKTHROUGH} (no UNKNOWN); `NOT_REAL_EMAIL_SQL` adds `qa.%`, `verify%`, `walkthrough.%`; classifyEmail **fail-open** (bad input → REAL); feed + swipe + shortlist + demo-profiles use it | `a092a09` | 2026-10-10 | fix: correct profile layout, honest empty states, and exclude all automated accounts from the real feed | api/account-kind.mjs (new, 88 lines); migration 2026-10-10 added here |
| 16 | classifyEmail malformed input | `return KIND.REAL` | `return KIND.UNKNOWN`; added empty/`@`-position checks; KIND gains UNKNOWN; `actorIsRealUser` added; agreements require matched REAL pair | `3230fca` | 2026-10-10 | security: make demo isolation bidirectional and require a matched real pair for agreements | account-kind.mjs:30–45; index.js |
| 17 | Stored-column classification | heuristic only | `classifyAccount()` three-state (absent→heuristic, set→verbatim, NULL→UNKNOWN); `hasStoredKind`; `realAccountSql(alias, stored)` | `27788b9` | 2026-10-11 | feat(account): prefer explicit stored classification, fail closed when unreviewed | account-kind.mjs:48–76, 100–114 |
| 18 | Eligibility wiring | partial | `hasStoredAccountKind` info-schema probe + cache; `kindOf`/`isRealRow`/`realOnlySql`; all eligibility surfaces routed through them | `425d29b` | 2026-10-12 | feat(account): wire explicit classification into every eligibility check | index.js:994–1044 |
| 19 | Registration classification | no kind written | INSERT includes `account_kind = classifyEmail(email)` with schema-fallback INSERT | `884d20a` | 2026-10-12 | feat(account): classify at registration so a new person is never born unknown | index.js:252–268 |

### 7.3 Upload / offline-photo-likes (`d86f9db`, 2026-10-16)

`feat(offline): honest photo upload states and likes lists with offline gates` — **all of the following added in this single commit** (no prior values to change; the previous upload route had no size/type validation: `d86f9db^` version buffered whole body, guessed ext via `ct.includes('png')?'png':ct.includes('webp')?'webp':'jpg'`, single `500 'Upload failed'`):

| Parameter | Old | New |
|---|---|---|
| `MAX_UPLOAD_BYTES` | none (unbounded buffer, external 4.5 MB Vercel cap) | `4 * 1024 * 1024` (upload-guards.mjs:11) |
| `ALLOWED_IMAGE_TYPES` | implicit string-guess | 4-entry MIME map (13–18) |
| Magic-byte sniffing | none | JPEG/PNG/WEBP signatures (21–37) |
| Status codes | 500 only | 400/413/415/503 with distinct copy (51–81; route 703–753) |
| `MAX_PHOTO_BYTES` (client) | n/a | `4 * 1024 * 1024` (photoUpload.js:8) |
| Upload timeout | n/a | 15000 ms (photoUpload.js:47) |
| IndexedDB names | n/a | `hey_nomads_photo` / `pending` / `current` (126–128) |
| Likes endpoints | none | `GET /api/likes/sent`, `/api/likes/received` + `likes-queries.mjs` (index.js:1349–1363) |

### 7.4 Walkthrough / demo / presentation

| # | Parameter | Old | New | Commit | Date |
|---|---|---|---|---|---|
| 20 | Demo surface | token-required `/api/demo/profiles` reading real `users` table | client-only fixtures (`demoProfiles.js`, score 84, ids 9101–9104) | `0144bb3` | 2026-10-15 |
| 21 | Presentation routes | always mounted (when code shipped) | fail-closed 404 unless `PRESENTATION_ENABLED=1` | `db04af0` | 2026-10-15 |
| 22 | Presentation cohort | ad-hoc QA copies drifted | single `presentation-cohort.js`; `qa.present.*` namespace; start rate limit 15/min; token scope claim | `e8c23a2` | 2026-10-15 |
| 23 | Demo menu | 3-door menu page | 3-step coach-mark tour (`TOUR_STEPS` in src/lib/tour.js:12–37: /roommates→/matches→/messages) | `375416e` | 2026-10-16 |
| 24 | Merge of matching-feed-and-demo-guide | — | branch merge (db04af0, e8c23a2, 0144bb3, 8cd9aa1, …) | `6207677` | 2026-10-15 |
| 25 | G13 gate | open | marked PASS (presentation live in production) | `01b54ac` | 2026-10-15 |

### 7.5 Infra constants over time

| Parameter | Old | New | Commit | Date |
|---|---|---|---|---|
| JSON body limit | `'10mb'` (`2fca172`, present through `41844ea`) | no explicit limit | `c527384` | 2026-10-08 |
| CORS | always-on | dev-only (`VERCEL_ENV !== 'production'`) | `c527384` | 2026-10-08 |
| Pool bounds | `{connectionString, ssl}` only (`babdf34`) | `max:10` | `8483f32` | 2026-10-09 |
| Pool timeouts | none | `connectionTimeoutMillis:10000`, `idleTimeoutMillis:30000` | `92d22e6` | 2026-10-12 |
| Rate limits | none | login 10/15min; register 5/60min | `8483f32` | 2026-10-09 |
| JWT expiry `'30d'` | `'30d'` from the start | unchanged | `2fca172` | 2026-09-15 |
| bcrypt rounds 10 | 10 from the start | unchanged (`c527384` re-touched the line) | `2fca172` | 2026-09-15 |
| Health cron | sub-daily (rejected by Hobby) | `0 9 * * *` daily | `8e2a3bd` | (pre-Oct) |
| MySQL → PostgreSQL | mysql pool | pg Pool | `babdf34` | 2026-09-20 |

### 7.6 Security-surface commits (behavioural, non-numeric)

- `02e0176` (2026-10-11) security: close direct-id profile read and mixed-pair agreement access
- `2086a80` fix(chat): refuse conversation reads to anyone who is not a match
- `b808f4a` gate messaging on match state; reject cross-user agreement reads/writes
- `3230fca` bidirectional demo isolation; matched-real-pair agreements
- `fbff16b` / `c60f453` (2026-10-11) DB-guard hardening: test suites cannot target deployed DB (`frontend-react/scripts/require-test-db.mjs`, `ALLOW_DEPLOYED_DB_TESTS`, `CONFIRM_TEST_DATABASE_HOST` overrides — see AGENTS.md §3)

### 7.7 Values searched that never changed

`git log -S` confirms these were introduced once and never modified: `lifestyle_weight` (`2fca172`, `c527384` touch = file move only), weight values 0.25/0.20/… (`2fca172`), `MATCH_CATEGORIES` contents (`6028750`), budget default 15000 (`2fca172`), deposit 5000, diet 'veg', smoking/drinking 'no', partying 'low', cleanliness 3, radius 10, bcrypt 10, JWT '30d', pool max 10 (since `8483f32`), upload cap 4 MB (since `d86f9db`).

### 7.8 Commits after `929cec9` (2026-10-16/17)

| Commit | Date | What changed for the paper |
|---|---|---|
| `fca5cb5` | 2026-10-16 | Two-sided gender-preference filter: `api/gender-prefs.mjs` (pure module), feed SQL clause, profile selector + validation, `docs/matching-formula.md` gender section, offline gates (§9.2) |
| `a87fd12` | 2026-10-17 | `api/age.mjs` (calendar age derivation, MIN_AGE 18), `api/notifications.mjs` (dedup engine), migration `2026-10-16_add_dob_and_notifications.sql` (prepared; applied later in `38bc4ef`), `NotificationBell` (30 s poll), onboarding "About you" step, 4 notification routes, `recordNotification` emit sites (§9.3, §9.4) |
| `242ad5e` | 2026-10-17 | All 7 Living DNA handlers map SQLSTATE 42P01 (missing table) to `503 'Living DNA is not available here yet.'` instead of generic 500; shared `isMissingLivingDnaTable` helper (§9.5) |
| `941129f` | 2026-10-17 | Removed an accidentally committed scratch file; no behaviour |
| `ffc82b3` | 2026-10-17 | Offline auth gate (401-before-DB proof) for the 16 communities/events/cities/settlement routes + structural asserts on weights/scorer/filter (test-only) |
| `5a2fa55` | 2026-10-17 | `GATES.phase15.md` ledger (docs-only) |
| `4a9e61c` | 2026-10-17 | `.gitignore` gains `.netlify` (chore-only) |
| `38bc4ef` | 2026-10-17 | **Applied** migration `2026-10-16_add_dob_and_notifications.sql` to production with explicit human approval; `require-test-db.mjs` override no longer `process.exit(0)`s when imported (it used to silently skip the importer's work while exiting 0) |
| `f7e5960` | 2026-10-17 | Onboarding bugfix: dropped `updated_at = CURRENT_TIMESTAMP` from the `UPDATE preferences` statement — `preferences` has only `created_at`, so every onboarding save carrying a preferred gender 500ed |

---

## 8. Summary Table — Master Parameter Register

| Parameter | Current Value | Original/Launch Value | Changed in Commit | One-line description |
|---|---|---|---|---|
| **Matching weights** | | | | |
| lifestyle_weight | 0.25 | 0.25 | never changed (`2fca172`) | Weight of lifestyle sub-score in total |
| budget_weight | 0.20 | 0.20 | never changed (`2fca172`) | Weight of budget sub-score |
| location_weight | 0.20 | 0.20 | never changed (`2fca172`) | Weight of location sub-score |
| movein_weight | 0.15 | 0.15 | never changed (`2fca172`) | Weight of move-in proximity sub-score |
| interests_weight | 0.10 | 0.10 | never changed (`2fca172`) | Weight of shared-interests sub-score |
| habits_weight | 0.10 | 0.10 | never changed (`2fca172`) | Weight of habits sub-score |
| **Category ceilings** | | | | |
| lifestyle ceiling | 25 | 25 | `6028750` (constant formalised) | Max attainable lifestyle points |
| budget ceiling | 20 | 20 | `6028750` | Max budget points |
| location ceiling | 20 | 20 | `6028750` | Max location points |
| movein ceiling | 15 | 15 | `6028750` | Max move-in points |
| interests ceiling | 10 | 10 | `6028750` | Max interests points |
| habits ceiling | 10 | 10 | `6028750` | Max habits points |
| **Sub-score constants** | | | | |
| sleep equal / flexible | +4 / +2 | same | never | Lifestyle sleep points |
| cleanliness formula | round(4×(1−diff/4)) | same | never | Linear cleanliness proximity, 1–5 scale |
| smoking / drinking equal | +3 / +3 | +3 / +3 | guard added `e8c23a2` | Substance-habit match points |
| social formula | round(3×(1−sdiff/2)) | same | never | Social-energy proximity (1–3 scale) |
| diet equal / veg↔eggetarian | +4 / +3 | same | never | Diet compatibility |
| noise equal / unequal | +4 / +1 | same | never | Noise-tolerance match |
| budget neutral default | 10 | 10 | never | Budget score when a side unanswered |
| budget reason threshold | closeness > 0.8 | \|Δ\| < maxB×0.2 | `8483f32` | Triggers price-bracket reason string |
| budget formula | cost-index closeness | raw-currency closeness | `8483f32` | Cross-currency normalisation |
| city cost fallback | 3 | 3 | `8483f32` | Missing city ⇒ midpoint cost level |
| location points | 12/10/8 +8 nbhd | same | never | City/destination/neighbourhood ladder |
| movein bands | ≤14→15, ≤30→10, ≤60→5, else 2; missing→7 | same | never | Date-difference buckets (days) |
| interests | min(10, shared×2) | same | never | 2 pts per shared interest |
| habits constants | 3 (flat) +2 (pets) +3 (work) +2 (langs) | same | never | Habit-equality points |
| total formula | renormalised weighted mean ×100 | double-weighted sum (cap 18.5) | `6028750` | Overall 0–100 compatibility |
| answered gate | onboarding_complete | none (defaults scored) | `e8c23a2` | Unanswered fields never earn points |
| feed pool size | 60 | 20 (page-limited) | `e8c23a2` | Candidates fetched before scoring |
| feed page size | 20 | 20 | never (`41844ea`) | Rows per feed page |
| Discover top-N | 5 | 5 (random) | `6028750` (random→scored) | Dashboard recommendation count |
| feed sort | score↓, created_at↓, id↑ | score↓ only | `e8c23a2` | Deterministic ranking tie-break |
| **Account classification** | | | | |
| DEMO_DOMAIN | 'heynomads.app' | same | never | Seeded demo email domain |
| QA prefixes | ['qa.','verify','walkthrough'] | same (since a092a09) | never | Local-part test prefixes |
| WALKTHROUGH_PREFIX | 'walkthrough.' | same | never | Legacy manual-QA prefix |
| NOT_REAL_EMAIL_SQL | 4 NOT LIKE clauses | `%@heynomads.app` only | `a092a09` (expanded) | Feed eligibility SQL fragment |
| malformed email → | UNKNOWN | REAL | `3230fca` | Fail-closed classification |
| stored column logic | 3-state (absent/set/NULL) | heuristic only | `27788b9` | account_kind precedence |
| registration write | classifyEmail → column | none | `884d20a` | Kind fixed at account creation |
| account_kind default | 'unknown' | (n/a) | migration `a092a09` | Column DEFAULT |
| **Upload / photos** | | | | |
| MAX_UPLOAD_BYTES | 4,194,304 (4 MB) | unbounded | `d86f9db` | Server streaming size cap |
| MAX_PHOTO_BYTES | 4,194,304 | n/a | `d86f9db` | Client size check |
| Allowed types | jpeg/jpg/png/webp | ext-guess 3-way | `d86f9db` | MIME allowlist |
| Magic bytes | FF D8 FF / 89 50 4E 47 0D 0A 1A 0A / RIFF….WEBP | none | `d86f9db` | Content-vs-header honesty |
| Upload statuses | 400/413/415/503 (+500) | 500 only | `d86f9db` | Distinct rejection reasons |
| Upload timeout | 15,000 ms | n/a | `d86f9db` | Client race against hung network |
| IndexedDB | hey_nomads_photo / pending / current (v1) | n/a | `d86f9db` | Local pending-photo retention |
| **Product defaults** | | | | |
| budget | 15000 | 15000 | never | profiles.budget default & form default |
| deposit | 5000 | 5000 | never | profiles.deposit default |
| cleanliness | 3 | 3 | never | 1–5 default & form default |
| diet | 'veg' | 'veg' | never | Column + form default |
| smoking / drinking | 'no' / 'no' | same | never | Column defaults |
| partying | 'low' | 'low' | never | Column default |
| noise_tolerance | 'moderate' | 'moderate' | never | Column default |
| noise_level | 3 | 3 | never | Column default |
| sleep_time | 'flexible' | 'flexible' | never | Column default |
| flat_type | 'shared' | 'shared' | never | Column default |
| occupants | 1 | 1 | never | Column default |
| social_level | 'moderate' | 'moderate' | never | Column default |
| pets | 'no' | 'no' | never | Column default |
| work_schedule | 'regular' | 'regular' | never | Column default |
| preferred_location_radius | 10 | 10 | never | Preferences default |
| prefers_cleanliness_min | 1 | 1 | never | Preferences default |
| prefers_smoking/drinking | 'no_preference' | same | never | Preferences defaults |
| prefers_same_diet/sleep | FALSE | FALSE | never | Preferences defaults |
| looking_for | 'both' | 'both' | never | users column default |
| budget clamp | 0–10,000,000 | same | `2fca172` | Onboarding validation |
| cleanliness clamp | 1–5 | same | `2fca172` | Onboarding validation |
| **API / infra** | | | | |
| JWT expiry | 30 days | 30 days | never | Session token lifetime |
| bcrypt rounds | 10 | 10 | never | Password hashing cost |
| password length | 8–72 | 8–72 | never (`c527384` tightened login guard) | Registration validation |
| login rate limit | 10 / 15 min | none | `8483f32` | Per-email brute-force throttle |
| register rate limit | 5 / 60 min | none | `8483f32` | Per-email signup throttle |
| presentation start limit | 15 / 60 s | none | `e8c23a2` | Token-minting throttle |
| PG pool max | 10 | 10 (pg default) / unbounded wait | `8483f32` | Connection ceiling |
| connectionTimeoutMillis | 10,000 | ∞ | `92d22e6` | Finite connect wait |
| idleTimeoutMillis | 30,000 | pg default 10,000 | `92d22e6` | Idle client reap |
| JSON body limit | ~100 kb (default) | 10 mb | `c527384` | Removed fictional 10 mb cap |
| external body cap | ~4.5 MB (Vercel) | same | n/a | Platform constraint |
| health cron | `0 9 * * *` | sub-daily | `8e2a3bd` | Daily ping; Hobby-plan limit |
| message length | ≤ 5000 | 5000 | `schema_v2.sql` | messages.content CHECK |
| Living DNA answers/req | ≤ 50 | n/a | `af45362` | Batch guard |
| constitution rule text | ≤ 500 chars | n/a | `af45362` | Text cap |
| agreement quiet hours | 10 PM–7 AM | same | `2fca172` | Template constant |
| agreement guest notice | 24 h | 24 h | `2fca172` | Template constant |
| presentation cohort budgets | 1250/1400/1450/1550 | same | `e8c23a2` | Synthetic London fixtures |
| presentation move date | 2026-11-15 | same | `e8c23a2` | Shared cohort MOVE_DATE |
| demo fixture score | 84 | 84 | `0144bb3` | Client-only demo compatibility |
| **Gender preferences (added `fca5cb5`)** | | | | |
| preferred_gender stored values | `female`, `male`, `all`, `unspecified` | none (feature new) | `fca5cb5` | Legacy `no_preference`, NULL and any unknown string read as `unspecified`; never coerced to `all` |
| gender filter position | hard SQL clause, pre-scoring, pre-LIMIT | n/a | `fca5cb5` | Eligibility, not a score input; applied in `getRecommendedRoommates` (`index.js:1258`) |
| unknown gender vs stated preference | fails closed | n/a | `fca5cb5` | A specific preference requires an exactly matching known gender |
| **Age / DOB (added `a87fd12`; column applied `38bc4ef`)** | | | | |
| MIN_AGE | 18 | n/a | `a87fd12` | Enforced in both directions by `validateDob` |
| MAX_REASONABLE_AGE | 120 | n/a | `a87fd12` | Rejects absurd dates ("That date of birth looks incorrect.") |
| leap-day birthday rule | 29 Feb ages on 28 Feb in common years | n/a | `a87fd12` | UK/EU convention, documented in `age.mjs` |
| age storage | derived at write time from `date_of_birth` | free-typed integer | `a87fd12` | Onboarding writes `date_of_birth` + derived age together (`index.js:396–399`); a client-supplied age is never stored |
| onboarding step-0 gate | blocks until gender + valid DOB present | n/a | `a87fd12` | Client `stepBlocked`; server re-validates DOB (400) |
| **Notifications (added `a87fd12`; tables applied `38bc4ef`)** | | | | |
| notification types | `message`, `like`, `match` | n/a | `a87fd12` | Closed DB CHECK list |
| dedup keys | `conversation:<id>`, `actor:<id>`, `pair:<lo>-<hi>` | n/a | `a87fd12` | One unread row per (recipient, type, key); partial unique index `uq_notifications_unread_dedup` |
| bell poll interval | 30,000 ms | n/a | `a87fd12` | No WebSocket; serverless polling of `/notifications/unread-count` |
| notification failure policy | never fails the user's action | n/a | `a87fd12` | `recordNotification` (`index.js:1139`) swallows its own errors |
| **Living DNA failure modes (`242ad5e`)** | | | | |
| missing-table status | 503 `Living DNA is not available here yet.` | generic 500 | `242ad5e` | All 8 living-dna handlers, SQLSTATE 42P01 (`isMissingLivingDnaTable`) |
| constitution rule categories | 6 fixed categories | n/a | `af45362` | `RULE_CATEGORIES`, `index.js:2757` |

---

## 9. Algorithms added after `929cec9`

*All file:line anchors in this section were read from the working tree at `f7e5960` (2026-10-17). Sections 1–8 keep their `929cec9` anchors for provenance; `api/index.js` line numbers below differ from those sections by the post-`929cec9` insertions.*

### 9.1 Current key anchors (`api/index.js` at `f7e5960`, 2845 lines)

| Symbol / route | Line |
|---|---|
| registration `INSERT INTO preferences` | 274 |
| `app.post('/api/onboarding')` | 359 |
| `UPDATE preferences SET preferred_gender` (onboarding) | 448 |
| profile-editor `UPDATE preferences SET preferred_gender=COALESCE(...)` | 738 |
| `app.post('/api/upload')` | 789 |
| `getMatchWeights` | 845 |
| `MATCH_CATEGORIES` | 852 |
| `ANSWERED_FIELDS` | 858 |
| `loadScoreContext` | 876 |
| `calcCompatibility` | 904 |
| `scoreCompatibility` | 910 |
| `totalWeight` computation | 1062 |
| `recordNotification` | 1139 |
| `getRecommendedRoommates` | 1198 |
| `feedGenderFilterSql(...)` call site | 1258 |
| match notifications (both directions) | 1434–1435 |
| like notification | 1439 |
| `GET /api/notifications` | 1614 |
| `GET /api/notifications/unread-count` | 1641 |
| `POST /api/notifications/:id/read` | 1655 |
| `POST /api/notifications/read-all` | 1668 |
| message notification emit | 1722 |
| `matchedPairWith` | 2503 |
| `LIVING_DNA_NOT_READY` | 2525 |
| answers-per-request cap (>50 → 400) | 2576 |
| sharing upsert (booleans only) | 2620–2633 |
| compare: consent checked before answers read | 2654 |
| compare: pair build loop | 2673–2696 |
| compare: response, no percentage | 2698–2714 |
| `GET /api/living-dna/constitution/:userId` | 2724 |
| `RULE_CATEGORIES` (6 entries) | 2757 |
| propose rule + acceptance reset | 2760–2796 |
| accept constitution | 2803–2835 |
| `export default` serverless handler | 2845 |

Frontend: `POLL_MS = 30000` at `frontend-react/src/components/NotificationBell.jsx:14`.

### 9.2 Two-sided gender-preference filter (`fca5cb5`, `api/gender-prefs.mjs`)

Pure module (no express/pg/env) so the offline gate suite can import and assert the pair rule directly.

- **Stored values** (`preferences.preferred_gender`): `female`, `male`, `all`, `unspecified` (`GENDER_PREF_VALUES`, line 16).
- **Read-time normalization** (`normalizeGenderPref`, line 22): trim + lowercase; only `female`/`male`/`all` pass through; everything else — NULL, legacy `no_preference`, unknown strings — becomes `unspecified`. `unspecified` is **never coerced to `all`** in storage; the two only share filtering behaviour because neither side may invent a restriction the user never stated.
- **Gender-value aliases** (`normalizeGenderValue`, line 32): `woman`/`women` → `female`, `man`/`men` → `male`; anything else (`other`, `prefer_not_to_say`, NULL, `''`) passes through lowercased (`''` → `null`) so a specific preference can never falsely match it.
- **Single-side admission** (`genderPrefAllows`, line 43): `all`/`unspecified` admit everyone; a specific preference admits only an exactly matching, **known** gender — unknown gender fails closed against a stated preference.
- **Pair rule** (`pairGenderCompatible`, line 51): `A's pref admits B's gender AND B's pref admits A's gender` — symmetric by construction.
- **SQL fragment** (`feedGenderFilterSql(myGender, myPrefRaw, startIdx)`, line 60) appended to the shared candidate WHERE clause, parameterized from `startIdx`:
  1. *My side*: if my pref is exactly `female` or `male` → `AND LOWER(COALESCE(p.gender,'')) = $n` with the pref as the parameter.
  2. *Their side* (always emitted): `AND (LOWER(COALESCE(pref2.preferred_gender,'')) NOT IN ('female','male') OR LOWER(COALESCE($n::text,'')) = LOWER(pref2.preferred_gender))` — a candidate whose pref is NULL/`all`/`unspecified`/legacy/unknown imposes no restriction; a specific candidate pref must equal my normalized gender. My unknown gender (`''`) then matches no specific pref, so it fails closed there too.
- **Position**: injected into the one shared candidate query inside `getRecommendedRoommates` at `index.js:1258` (`pref2` is the candidate's preferences join), i.e. **hard eligibility before scoring and before LIMIT** — it never appears in `scoreCompatibility` or any weight.
- **Write paths**: onboarding (`index.js:448`) and the profile editor (`index.js:738`) both run the same `normalizeGenderPref`, so the two writers store one canonical vocabulary. Design doc: `docs/matching-formula.md` §Gender preference filter.
- **Gate**: `GATES.gender-prefs.md`; structural assert in `ffc82b3` tests that the filter is a WHERE-clause fragment, not a score term.

### 9.3 Date-of-birth → age derivation (`a87fd12`, `api/age.mjs`; column applied `38bc4ef`)

Pure module; the offline gate asserts calendar edge cases directly.

- **Constants**: `MIN_AGE = 18` (exported), `MAX_REASONABLE_AGE = 120` (module-local).
- **`parseDob`** accepts `YYYY-MM-DD` (strict then lenient single-digit month/day, so `2000-5-5` normalizes for `<input type="date">`), a real `Date` (UTC fields; Invalid Date → `null`), or `{year, month, day}`. Month 1–12 / day 1–31 checked, then a `Date.UTC` round-trip rejects non-existent dates (Feb 30, Apr 31).
- **Why calendar math, not timestamp diff** (header comment): DOB is a calendar date; `(now − dob)` drifts by a day around birthdays and shifts with server timezone.
- **`ageFromDob`**: `age = today.year − dob.year`, minus 1 when the birthday has not been reached this year, comparing month/day only. **Leap-day rule**: a 29 Feb birthday has its effective day set to 28 Feb in common years, so a 29 Feb 2004 baby is 18 on 28 Feb 2022 (UK/EU convention, documented in-file).
- **`validateDob` order** (each step returns `{ok:false, age, error}`): parse failure → *"Enter a valid date of birth (YYYY-MM-DD)."*; future date → *"Date of birth cannot be in the future."*; null age → parse message again; `age < 18` → *"You must be at least 18 to use Hey Nomads."*; `age > 120` → *"That date of birth looks incorrect."*; else `{ok:true, age}`.
- **Server integration** (`POST /api/onboarding`, `index.js:371–375, 396–399`): DOB validated **when present** (400 carries the `validateDob` message); `date_of_birth` and the **derived** `age` are written together — a client-sent age is never read into storage. Presence of the field itself is enforced by the client's step-0 `stepBlocked` gate (needs gender + valid DOB to advance); the server does not reject an empty DOB.
- **Schema**: `users.date_of_birth` (DATE, nullable) added by `database/migrations/2026-10-16_add_dob_and_notifications.sql`, applied to production in `38bc4ef` (5 statements, 0 failed).
- **Gate**: `GATES.age-notifications.md` (`GATE_AGE_UNIT_OK`, `GATE_AGE_API_OK`).

### 9.4 Notification engine (`a87fd12`, `api/notifications.mjs`; tables applied `38bc4ef`)

- **Tables** (from the applied migration): `notifications` and `notification_preferences`. One row per **(recipient, type, dedup_key)** while unread, enforced by partial unique index `uq_notifications_unread_dedup` on `(recipient_id, type, dedup_key) WHERE read_at IS NULL`.
- **Types** (`NOTIFICATION_TYPES`): `message`, `like`, `match` — closed DB CHECK list.
- **Dedup keys** (`dedupKeyFor`, line 13): `message` → `conversation:<id>` (a chatty thread is one row that bumps), `like` → `actor:<actorId>` (re-liking cannot stack), `match` → `pair:<min(lo,hi)>-<max(lo,hi)>` (fires once per pair); missing ids → `null`.
- **`buildNotification`** (line 37) returns the row or `null` and never throws: rejects missing recipient, unknown type, **self-notification** (`recipientId === actorId`), or a missing key. Rationale: a caller that already committed the message/swipe must not fail because notification metadata was malformed.
- **`recordNotification`** (`index.js:1139`): wraps build + insert; failures are swallowed — the bell must never break the user's action (asserted by the notification gates).
- **Emit sites**: match — both directions, `index.js:1434–1435`; like — `1439`; message — `1722` (after the message row commits).
- **Routes** (4): `GET /api/notifications` (1614), `GET /api/notifications/unread-count` (1641), `POST /api/notifications/:id/read` (1655), `POST /api/notifications/read-all` (1668) — all `authMiddleware`.
- **Tap destinations** (`destinationFor`): `match` → `/matches` regardless of actor (a match may carry a null actor), `message` → `/messages/:actorId`, `like` → `/roommates/:actorId`, null actor → `null`.
- **Labels** (`labelFor`): `"<name> sent you a message"`, `"<name> liked you"`, `"<name> is now a match"`, fallback name `Someone`, default copy `"New activity"`.
- **Client**: no WebSocket anywhere (serverless Express on Vercel) — the bell polls `unread-count` every `POLL_MS = 30000` ms (`NotificationBell.jsx:14`).
- **Gate**: `GATES.age-notifications.md` (`GATE_NOTIF_UNIT_OK`, `GATE_NOTIF_API_OK`).

### 9.5 Living DNA — consent, comparison, constitution, failure modes

- **Availability by design (`242ad5e`)**: migration `2026-10-11_add_living_dna.sql` is **not applied** (needs explicit human approval), so all **8** living-dna handlers catch SQLSTATE `42P01` via `isMissingLivingDnaTable` and return `503 { error: 'Living DNA is not available here yet.' }` (`LIVING_DNA_NOT_READY`, `index.js:2525`; guard at 2537, 2564, 2611, 2635, 2716, 2752, 2798, 2832). Before `242ad5e` this surfaced as a generic 500 — the 503 is the documented behaviour, not a defect.
- **Match gate**: `matchedPairWith(req, otherUserId)` (`index.js:2503`) resolves a real match between the pair; otherwise 403 `"Living DNA comparison is available to matched accounts only"` (constitution variants say `"A Living Constitution is available to matched accounts only"`).
- **Consent model**: two independent booleans per user — `share_preferences`, `share_boundaries` (default `false`, `ON CONFLICT` upsert, `index.js:2620–2633`, both must be booleans or 400). In the compare handler the partner's consent is checked **before any answers are read** (`index.js:2654–2656`) → 403 `"They have not chosen to share their Living DNA yet"`.
- **Compare algorithm** (`index.js:2658–2714`): fetch both users' answers joined to questions ordered by `position`; build pairs over **my** answers —
  - no counterpart → `status: 'not_answered_by_them'` (their option never revealed);
  - otherwise `shown = their answer.is_boundary ? theirs.share_boundaries : theirs.share_preferences` — sharing preferences must **not** imply sharing boundaries (`index.js:2685`);
  - `shown` → `aligned` (same option) or `different`; not shown → `not_shared` with `their_option: null`, `their_boundary: null` unless the boundary flag itself is shared.
  - Response: `compared / aligned / different` counts, `notAnsweredByThem = (answeredByThem === 0)`, and an explicit **no-percentage** note (`index.js:2711–2713`): a number would imply a validated prediction that does not exist.
  - Answer writes: `PUT .../answers` caps at **50 per request** (`index.js:2576`); each answer carries `is_boundary`.
- **Living Constitution** (rules hang off the match; shared document between exactly the two people):
  - `RULE_CATEGORIES` — 6 fixed strings: `Rent & expenses`, `Cleaning & chores`, `Guests & quiet hours`, `Food & shared supplies`, `Privacy & belongings`, `Conflict resolution` (`index.js:2757`).
  - Propose rule (`2760–2796`): unknown category → 400; `rule_text` trimmed and `slice(0, 500)`; case-insensitive/trimmed duplicate → 409 `"That rule has already been proposed"`; new rule starts `status='proposed'`. Because there is no version column, proposing **resets the whole document**: all acceptance rows are deleted and every `agreed`/`declined` rule returns to `proposed` (`2791–2795`), so nothing displays as settled until both re-agree.
  - Accept (`2803–2835`): 409 `"There is nothing to accept yet"` with no rules; 409 `"Resolve the declined rules before accepting"` if any rule is `declined`; otherwise insert acceptance (`ON CONFLICT DO NOTHING`) and promote all `proposed` → `agreed`.
  - `mutuallyAccepted` = both acceptance rows exist (`2748`, `2829`) — never inferred from rule count.

### 9.6 Onboarding save path — validation order (`POST /api/onboarding`, `index.js:359–460`)

1. `authMiddleware`.
2. DOB validated when present → `derivedAge` (400 carries the `validateDob` message) — `371–375`.
3. `preferred_gender` passed through `normalizeGenderPref` when present — `381–384`. (The branch also has a 400 for a falsy result, but `normalizeGenderPref` always returns one of the four canonical values, so it is defensive only.)
4. **users** UPDATE: `looking_for`; `moving_to` trimmed to 100 chars; `moving_date` — the string `'null'` becomes SQL `NULL`; `interests` array; `date_of_birth` **plus derived** `age` written together; `gender`; `country` looked up from the `cities` table by case-insensitive name so it can never disagree with `moving_to` — `392–411`.
5. **profiles** UPDATE: `city`; `budget` clamped `0–10,000,000`; `cleanliness` clamped `1–5` (default 3); flat/sleep/social/smoking/drinking/diet — `422–430`; `INSERT ... ON CONFLICT (user_id) DO NOTHING` first (`435`) for rows created before registration guaranteed one.
6. **preferences** UPDATE: `preferred_gender` only when provided, no other columns, and **no `updated_at`** — `preferences` has only `created_at`; setting one 500ed every onboarding submit carrying a preference until `f7e5960` — `444–451`. The preferences row itself is created at registration (`index.js:274`).
7. `onboarding_complete = TRUE` unconditionally once the path above passes — `453`.
8. Any throw → 500 `"Failed to save onboarding"`.

---

### Verification notes

- Every current-value claim in §1–§8 was read from the working tree at `929cec9` with cited file:line; every claim in §9 was re-read from the working tree at `f7e5960` (2026-10-17) with cited file:line.
- Every old→new transition was confirmed by `git show <commit>` / `git log -S` / `git log -L` against `frontend-react/api/index.js`, `account-kind.mjs`, `upload-guards.mjs`, and `database/` paths.
- **Live production database, verified read-only on 2026-10-17**: migration `2026-10-16_add_dob_and_notifications.sql` is **APPLIED** (`applied 5, failed 0`, explicit human approval); `users.date_of_birth`, `notifications` and `notification_preferences` exist, and the partial unread-dedup index is present. The onboarding statement sequence (§9.6) was replayed against the live schema inside a transaction that was then **rolled back** — all statements OK.
- Still **NOT APPLIED** (both additive, reversible, require explicit human approval): `2026-10-10_add_account_kind.sql`, `2026-10-11_add_living_dna.sql`. Living DNA endpoints return the documented 503 until the latter is approved and applied. Migration headers state their status; runtime probes `information_schema` per process.
- Items explicitly **not verified against a live database**: whether `match_weights` row 1 in production still holds launch defaults (weights are user-editable via `POST /api/match-weights`).
- Not performed: browser-rendered checks of the notification bell and onboarding flow (verification was lint/build/unit/HTTP-gate plus statement replay).
