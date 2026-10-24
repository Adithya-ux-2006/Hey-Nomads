// MOCKED / OFFLINE unit tests — pure gender-preference predicates and the
// feed SQL fragment, no database. These are the rules gate G3 re-runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGenderPref,
  normalizeGenderValue,
  genderPrefAllows,
  pairGenderCompatible,
  feedGenderFilterSql,
  GENDER_PREF_VALUES,
} from '../../api/gender-prefs.mjs';

// ── normalisation ──────────────────────────────────────────────

test('normalizeGenderPref: the four canonical values pass through', () => {
  for (const v of GENDER_PREF_VALUES) {
    assert.equal(normalizeGenderPref(v), v);
  }
});

test('normalizeGenderPref: legacy, empty, unknown all become unspecified (fail-open)', () => {
  for (const raw of ['no_preference', '', null, undefined, '  ', 'robot', 'FEMALE ']) {
    const got = normalizeGenderPref(raw);
    // 'FEMALE ' with case+space still normalises to female, not unspecified
    if (raw === 'FEMALE ') {
      assert.equal(got, 'female');
    } else {
      assert.equal(got, 'unspecified', `raw=${raw}`);
    }
  }
});

test('normalizeGenderPref: case-insensitive for the real values', () => {
  assert.equal(normalizeGenderPref('Female'), 'female');
  assert.equal(normalizeGenderPref('MALE'), 'male');
  assert.equal(normalizeGenderPref(' All '), 'all');
});

test('normalizeGenderValue: aliases and empty handling', () => {
  assert.equal(normalizeGenderValue('Woman'), 'female');
  assert.equal(normalizeGenderValue('man'), 'male');
  assert.equal(normalizeGenderValue('female'), 'female');
  assert.equal(normalizeGenderValue('other'), 'other');
  assert.equal(normalizeGenderValue('prefer_not_to_say'), 'prefer_not_to_say');
  assert.equal(normalizeGenderValue(''), null);
  assert.equal(normalizeGenderValue(null), null);
});

// ── single-side predicate ──────────────────────────────────────

test('genderPrefAllows: all and unspecified admit every gender (no invented restriction)', () => {
  for (const pref of ['all', 'unspecified', 'no_preference', null, '']) {
    for (const gender of ['female', 'male', 'other', 'prefer_not_to_say', null]) {
      assert.equal(genderPrefAllows(pref, gender), true, `pref=${pref} gender=${gender}`);
    }
  }
});

test('genderPrefAllows: a specific preference admits only the matching, known gender', () => {
  assert.equal(genderPrefAllows('female', 'female'), true);
  assert.equal(genderPrefAllows('female', 'Woman'), true, 'alias still matches');
  assert.equal(genderPrefAllows('female', 'male'), false);
  assert.equal(genderPrefAllows('female', 'other'), false);
  assert.equal(genderPrefAllows('female', 'prefer_not_to_say'), false);
  assert.equal(genderPrefAllows('female', null), false, 'unknown gender fails closed against a stated pref');
  assert.equal(genderPrefAllows('male', 'male'), true);
  assert.equal(genderPrefAllows('male', 'female'), false);
  assert.equal(genderPrefAllows('male', null), false);
});

test('genderPrefAllows: positive control — the predicate is not vacuously true', () => {
  assert.equal(genderPrefAllows('female', 'male'), false);
});

// ── two-sided rule ─────────────────────────────────────────────

test('pairGenderCompatible: both sides must admit the other (scenarios 1–5)', () => {
  // 1. I want women, they are a woman who wants everyone → compatible
  assert.equal(pairGenderCompatible('female', 'female', 'female', 'all'), true);
  // 2. I want women, they are a woman who wants men → not compatible
  assert.equal(pairGenderCompatible('female', 'female', 'female', 'male'), false);
  // 3. I am unspecified, they want men and I am a man → compatible
  assert.equal(pairGenderCompatible('male', 'unspecified', 'female', 'male'), true);
  // 4. I am unspecified, they want men and I am not a man → not compatible
  assert.equal(pairGenderCompatible('female', 'unspecified', 'male', 'male'), false);
  // 5. both unspecified → compatible (no invented restriction)
  assert.equal(pairGenderCompatible(null, null, 'other', 'no_preference'), true);
});

test('pairGenderCompatible: symmetric by construction (scenario 7)', () => {
  assert.equal(
    pairGenderCompatible('female', 'male', 'male', 'female'),
    pairGenderCompatible('male', 'female', 'female', 'male'),
  );
  // I am female wanting men; they are male wanting women — a perfect match.
  assert.equal(pairGenderCompatible('female', 'male', 'male', 'female'), true);
  // Same genders, same crossed prefs: I want men, they are a woman wanting
  // men — their pref admits me only if I am male, so this conflicts.
  assert.equal(pairGenderCompatible('female', 'male', 'female', 'male'), false);
  assert.equal(pairGenderCompatible('female', 'all', 'male', 'all'), true);
});

test('pairGenderCompatible: specific pref vs unknown gender fails closed', () => {
  assert.equal(pairGenderCompatible(null, 'unspecified', 'female', 'female'), false);
});

// ── SQL fragment ───────────────────────────────────────────────

test('feedGenderFilterSql: open preference produces no my-side gender clause', () => {
  for (const pref of ['all', 'unspecified', null, 'no_preference', 'robot']) {
    const f = feedGenderFilterSql('female', pref, 2);
    assert.ok(!f.sql.includes(`p.gender`), `pref=${pref} must not filter candidate gender`);
    assert.equal(f.sql, '', `pref=${pref} must add no gender clause at all`);
    assert.deepEqual(f.params, [], 'open pref must not bind any gender param');
  }
});

test('feedGenderFilterSql: specific preference adds the my-side gender clause with its param', () => {
  const f = feedGenderFilterSql('male', 'female', 2);
  assert.ok(f.sql.includes(`LOWER(COALESCE(p.gender, '')) = $2`));
  assert.deepEqual(f.params, ['female', 'male']);
  assert.equal(f.nextIdx, 4, 'two params consumed, LIMIT starts at $4');
});

test('feedGenderFilterSql: their-side clause passes open prefs and matches my gender otherwise', () => {
  // With an open preference the fragment is empty: no clause is added at all.
  const open = feedGenderFilterSql(null, 'all', 5);
  assert.equal(open.sql, '', 'open pref adds no clause');
  assert.deepEqual(open.params, [], 'open pref binds no params');
  assert.equal(open.nextIdx, 5, 'start idx is unchanged');

  // With a specific preference the their-side clause is present and my gender
  // is a bound param, not interpolated.
  const specific = feedGenderFilterSql('female', 'female', 5);
  assert.ok(specific.sql.includes(`NOT IN ('female', 'male')`), 'their pref not specific → pass');
  assert.ok(specific.sql.includes('$5'), 'my gender is a bound param, not interpolated');
  assert.deepEqual(specific.params, ['female', 'female']);
  assert.equal(specific.nextIdx, 7);
});

test('feedGenderFilterSql: positive control — no-clause fragment fails the my-side predicate', () => {
  const open = feedGenderFilterSql('female', 'all', 2).sql;
  assert.ok(!open.includes(`= $2`), 'open pref leaves no my-side equality');
  const specific = feedGenderFilterSql('female', 'male', 2).sql;
  assert.ok(specific.includes(`= $2`));
});

test('feedGenderFilterSql: fragment is SQL-only (no interpolated user values)', () => {
  const dirty = "female'; DROP TABLE users; --";
  const f = feedGenderFilterSql(dirty, dirty, 2);
  assert.ok(!f.sql.includes('DROP'), 'values must only travel as bound params');
  // The dirty input is normalised (pref → unspecified, gender lowered) and
  // lands in params for the caller to bind — never inlined into the SQL text.
  assert.ok(f.params.every(p => !String(p).includes('DROP')));
  // With an open preference the fragment is empty and carries no params at all.
  assert.deepEqual(f.params, []);
});
