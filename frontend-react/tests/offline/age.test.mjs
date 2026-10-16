// MOCKED / OFFLINE unit tests — pure DOB/age logic, no database, no network.
// These are the calendar edge cases the gate suite re-runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDob,
  isLeapYear,
  ageFromDob,
  validateDob,
  dobInputValue,
  MIN_AGE,
} from '../../api/age.mjs';

// A fixed "today" so every assertion is deterministic regardless of when CI
// runs. 2026-07-04 is a common year, deliberately, so the leap-day cases below
// exercise the "not a leap year" branch.
const TODAY = new Date(Date.UTC(2026, 6, 4)); // 4 Jul 2026

// ── parseDob ───────────────────────────────────────────────────

test('parseDob: valid YYYY-MM-DD parses to calendar fields', () => {
  assert.deepEqual(parseDob('2000-05-15'), { year: 2000, month: 5, day: 15 });
  assert.deepEqual(parseDob('2004-02-29'), { year: 2004, month: 2, day: 29 });
});

test('parseDob: invalid shapes and impossible dates return null', () => {
  for (const bad of [null, undefined, '', 'not-a-date', '2000/05/15', '15-05-2000',
    '2000-13-01', '2000-00-10', '2000-02-30', '2001-02-29', '2000-04-31', '20000515']) {
    assert.equal(parseDob(bad), null, `raw=${bad}`);
  }
});

test('parseDob: a Date instance is accepted; an Invalid Date is not', () => {
  assert.deepEqual(parseDob(new Date(Date.UTC(1999, 11, 31))), { year: 1999, month: 12, day: 31 });
  assert.equal(parseDob(new Date('garbage')), null);
});

// ── isLeapYear ─────────────────────────────────────────────────

test('isLeapYear: Gregorian rules', () => {
  assert.equal(isLeapYear(2000), true, 'divisible by 400');
  assert.equal(isLeapYear(1900), false, 'divisible by 100 but not 400');
  assert.equal(isLeapYear(2024), true, 'divisible by 4');
  assert.equal(isLeapYear(2023), false);
  assert.equal(isLeapYear(2026), false);
});

// ── ageFromDob ─────────────────────────────────────────────────

test('ageFromDob: birthday already passed this year', () => {
  // DOB 15 May 2000; today 4 Jul 2026 -> birthday passed -> 26.
  assert.equal(ageFromDob('2000-05-15', TODAY), 26);
});

test('ageFromDob: birthday still upcoming this year', () => {
  // DOB 20 Dec 2000; today 4 Jul 2026 -> birthday not yet -> 25.
  assert.equal(ageFromDob('2000-12-20', TODAY), 25);
});

test('ageFromDob: birthday is today', () => {
  // DOB 4 Jul 2000; today 4 Jul 2026 -> turns 26 today.
  assert.equal(ageFromDob('2000-07-04', TODAY), 26);
});

test('ageFromDob: birthday is tomorrow (not yet aged up)', () => {
  // DOB 5 Jul 2000; today 4 Jul 2026 -> still 25.
  assert.equal(ageFromDob('2000-07-05', TODAY), 25);
});

test('ageFromDob: leap-day birthday in a common year ages up on 28 Feb', () => {
  // DOB 29 Feb 2004 (leap year). Today 4 Jul 2026 (common year).
  // 2026-02-28 counts as the birthday, so on 4 Jul they are already 22.
  assert.equal(ageFromDob('2004-02-29', TODAY), 22);
  // Before 28 Feb 2026 they were still 21.
  assert.equal(ageFromDob('2004-02-29', new Date(Date.UTC(2026, 1, 27))), 21);
  // On 28 Feb 2026 itself they turn 22.
  assert.equal(ageFromDob('2004-02-29', new Date(Date.UTC(2026, 1, 28))), 22);
});

test('ageFromDob: leap-day birthday in a leap year uses 29 Feb', () => {
  // In 2028 (leap year) the real 29 Feb birthday applies.
  assert.equal(ageFromDob('2004-02-29', new Date(Date.UTC(2028, 1, 28))), 23);
  assert.equal(ageFromDob('2004-02-29', new Date(Date.UTC(2028, 1, 29))), 24);
});

test('ageFromDob: invalid DOB returns null, never NaN', () => {
  assert.equal(ageFromDob('garbage', TODAY), null);
  assert.equal(ageFromDob('', TODAY), null);
  assert.equal(ageFromDob(null, TODAY), null);
});

test('ageFromDob: positive control — a wrong-age assertion fails', () => {
  // The birthday-passed case above must be 26, not 25; this proves the
  // calculator is not returning a constant.
  assert.notEqual(ageFromDob('2000-05-15', TODAY), 25);
});

// ── validateDob ────────────────────────────────────────────────

test('validateDob: a valid, old-enough DOB passes with the derived age', () => {
  const r = validateDob('2000-05-15', TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.age, 26);
  assert.equal(r.error, null);
});

test('validateDob: an under-age DOB is rejected with a clear reason', () => {
  const r = validateDob('2015-01-01', TODAY); // 11 years old
  assert.equal(r.ok, false);
  assert.equal(r.age, 11);
  assert.ok(r.error.includes(String(MIN_AGE)), 'error must name the minimum age');
});

test('validateDob: exactly MIN_AGE is accepted (boundary is inclusive)', () => {
  // Turned 18 on 4 Jul 2026 (today): DOB 4 Jul 2008.
  const r = validateDob('2008-07-04', TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.age, 18);
});

test('validateDob: one day short of MIN_AGE is rejected', () => {
  // Turns 18 tomorrow: DOB 5 Jul 2008 -> still 17 today.
  const r = validateDob('2008-07-05', TODAY);
  assert.equal(r.ok, false);
  assert.equal(r.age, 17);
});

test('validateDob: a future DOB is rejected', () => {
  const r = validateDob('2030-01-01', TODAY);
  assert.equal(r.ok, false);
  assert.equal(r.age, null);
  assert.ok(r.error.includes('future'));
});

test('validateDob: an invalid / impossible date is rejected', () => {
  for (const bad of ['garbage', '2000-02-30', '2001-02-29', '15-05-2000']) {
    const r = validateDob(bad, TODAY);
    assert.equal(r.ok, false, `raw=${bad}`);
    assert.equal(r.age, null, `raw=${bad}`);
  }
});

test('validateDob: an absurdly old DOB is rejected', () => {
  const r = validateDob('1800-01-01', TODAY); // 226 years old
  assert.equal(r.ok, false);
  assert.equal(r.age, 226);
});

// ── dobInputValue ──────────────────────────────────────────────

test('dobInputValue: round-trips to the YYYY-MM-DD shape a date input wants', () => {
  assert.equal(dobInputValue('2000-5-5'), '2000-05-05');
  assert.equal(dobInputValue('2004-02-29'), '2004-02-29');
  assert.equal(dobInputValue('garbage'), '');
  assert.equal(dobInputValue(null), '');
});
