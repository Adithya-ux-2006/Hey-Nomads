// Pure gender-preference logic for the recommendation feed.
//
// Kept free of express, pg and env so the offline gate suite can import it and
// assert the two-sided rule that decides who appears in whose Discover feed.
//
// Values stored in preferences.preferred_gender:
//   'female' | 'male'      — a specific stated preference
//   'all'                  — an affirmative "everyone" choice
//   'unspecified'          — the user declined to say (also the read-time
//                            result of NULL, legacy 'no_preference', and any
//                            unknown string). Unspecified is NOT coerced to
//                            'all' in storage; the two only share filtering
//                            behaviour because neither side may invent a
//                            restriction the user never stated.

export const GENDER_PREF_VALUES = ['female', 'male', 'all', 'unspecified'];

// Map stored/entered preference text to one of the four canonical values.
// Fail-open to 'unspecified': an unreadable value must never silently hide
// people, because preferred_gender was nullable with a 'no_preference' seed
// long before this filter existed.
export function normalizeGenderPref(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'female' || v === 'male' || v === 'all') return v;
  return 'unspecified';
}

// Map a profile gender to a comparable value. Aliases cover legacy spellings
// ('Woman' in the presentation cohort); anything else ('other',
// 'prefer_not_to_say', NULL) passes through lowercased so a specific
// preference can never falsely match it.
const GENDER_ALIASES = { woman: 'female', women: 'female', man: 'male', men: 'male' };
export function normalizeGenderValue(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '') return null;
  return GENDER_ALIASES[v] || v;
}

// Does this side's stated preference admit a target of the given gender?
// 'all' and 'unspecified' admit everyone; a specific preference admits only
// an exactly matching, known gender — unknown gender fails closed against a
// stated preference.
export function genderPrefAllows(prefRaw, genderRaw) {
  const pref = normalizeGenderPref(prefRaw);
  if (pref === 'all' || pref === 'unspecified') return true;
  return normalizeGenderValue(genderRaw) === pref;
}

// Two-sided compatibility: A's preference must admit B's gender AND B's
// preference must admit A's gender. Symmetric by construction.
export function pairGenderCompatible(genderA, prefA, genderB, prefB) {
  return genderPrefAllows(prefA, genderB) && genderPrefAllows(prefB, genderA);
}

// SQL fragment appended to the shared candidate query's WHERE clause. Handles
// both sides: my preference filters candidate gender; each candidate's
// preference (preferences pref2, joined by the caller) filters my gender.
// Values that are not exactly 'female' or 'male' — including NULL, 'all',
// 'unspecified and legacy 'no_preference' — impose no restriction.
export function feedGenderFilterSql(myGender, myPrefRaw, startIdx) {
  const myPref = normalizeGenderPref(myPrefRaw);
  const myGenderNorm = normalizeGenderValue(myGender);
  const clauses = [];
  const params = [];
  let idx = startIdx;

  if (myPref === 'female' || myPref === 'male') {
    clauses.push(`AND LOWER(COALESCE(p.gender, '')) = $${idx++}`);
    params.push(myPref);
  }

  clauses.push(`AND (
         LOWER(COALESCE(pref2.preferred_gender, '')) NOT IN ('female', 'male')
         OR LOWER(COALESCE($${idx++}::text, '')) = LOWER(pref2.preferred_gender)
       )`);
  params.push(myGenderNorm);

  return { sql: clauses.join('\n       '), params, nextIdx: idx };
}
