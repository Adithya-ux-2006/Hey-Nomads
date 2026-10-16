// Pure date-of-birth -> age calculation. No express, no pg, no network, so the
// offline gate suite can import it and assert the calendar edge cases directly.
//
// Why a calendar calculation, not a timestamp diff: DOB is a calendar date.
// Computing age as (now - dob) in years drifts by a day around birthdays and
// shifts by a timezone offset, so a user can be shown as a year older or
// younger than their real age depending on where the server sits. Every path
// below compares year/month/day only.

export const MIN_AGE = 18;
const MAX_REASONABLE_AGE = 120;

// Parse a YYYY-MM-DD string, Date, or {year, month, day} into { year, month,
// day } or null. A Date only counts if it is a real calendar date; a Date built
// from an invalid string is Invalid Date and must not be silently coerced.
// Accepting the object form matters: validateDob and dobInputValue already hold
// a parsed {year, month, day} and re-parsing it must not fall through to the
// strict YYYY-MM-DD string branch (which would reject every valid DOB).
export function parseDob(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return { year: raw.getUTCFullYear(), month: raw.getUTCMonth() + 1, day: raw.getUTCDate() };
  }
  if (typeof raw === 'object' && typeof raw.year === 'number'
      && typeof raw.month === 'number' && typeof raw.day === 'number') {
    return { year: raw.year, month: raw.month, day: raw.day };
  }
  const s = String(raw).trim();
  // Strict first, then lenient so single-digit month/day still parse. The
  // lenient path is what dobInputValue uses to normalize '2000-5-5' into the
  // zero-padded YYYY-MM-DD a <input type="date"> needs; a strict-only parser
  // would return '' and silently blank the field on load.
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const year = +m[1], month = +m[2], day = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject dates that do not exist on a real calendar (e.g. Feb 30, Apr 31).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

// True when the year is a leap year (Gregorian rules).
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// How many days are in a given month.
function daysInMonth(year, month) {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

// Full age in years from DOB to a reference date, comparing calendar fields.
// A leap-day birthday (29 Feb) has its "birthday" on 28 Feb in common years —
// the age increments on the last day of February so a 29 Feb 2004 baby is
// legally 18 on 28 Feb 2022 (the year before a leap year) rather than having
// to wait until 1 Mar. This is the UK/EU convention; pick one and stay with it.
export function ageFromDob(dobRaw, today = new Date()) {
  const dob = parseDob(dobRaw);
  if (!dob) return null;
  const t = parseDob(`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`);
  if (!t) return null;

  let age = t.year - dob.year;
  // Birthday not yet reached this year.
  const dobMonth = dob.month, dobDay = dob.day;
  // Treat 29 Feb as 28 Feb in common years (see above).
  const isLeapDay = dobMonth === 2 && dobDay === 29 && !isLeapYear(t.year);
  const effectiveDobDay = isLeapDay ? 28 : dobDay;
  if (t.month < dobMonth || (t.month === dobMonth && t.day < effectiveDobDay)) {
    age -= 1;
  }
  return age;
}

// Full validation for a submitted DOB. Returns { ok, age, error }.
// error is a user-facing string; ok is false whenever age is null or under
// MIN_AGE or the date is invalid / in the future / absurdly old.
export function validateDob(raw, today = new Date()) {
  const dob = parseDob(raw);
  if (!dob) {
    return { ok: false, age: null, error: 'Enter a valid date of birth (YYYY-MM-DD).' };
  }
  // Future / today-in-the-future check on calendar fields.
  const tYear = today.getUTCFullYear(), tMonth = today.getUTCMonth() + 1, tDay = today.getUTCDate();
  if (dob.year > tYear || (dob.year === tYear && (dob.month > tMonth || (dob.month === tMonth && dob.day > tDay)))) {
    return { ok: false, age: null, error: 'Date of birth cannot be in the future.' };
  }
  const age = ageFromDob(dob, today);
  if (age == null) {
    return { ok: false, age: null, error: 'Enter a valid date of birth (YYYY-MM-DD).' };
  }
  if (age < MIN_AGE) {
    return { ok: false, age, error: `You must be at least ${MIN_AGE} to use Hey Nomads.` };
  }
  if (age > MAX_REASONABLE_AGE) {
    return { ok: false, age, error: 'That date of birth looks incorrect.' };
  }
  return { ok: true, age, error: null };
}

// Format a DOB for a <input type="date"> value, or '' when unparseable.
export function dobInputValue(raw) {
  const dob = parseDob(raw);
  if (!dob) return '';
  return `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`;
}
