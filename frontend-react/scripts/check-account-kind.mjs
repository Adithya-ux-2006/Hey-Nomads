// Self-check for account classification. Pure logic, no database and no network,
// so it is safe to run anywhere including in CI with production config present.
//
//   node scripts/check-account-kind.mjs
import assert from 'node:assert/strict';
import {
  KIND, classifyEmail, classifyAccount, hasStoredKind,
  isInteractingAsRealUser, isRealFeedCandidate, NOT_REAL_EMAIL_SQL, realAccountSql,
} from '../api/account-kind.mjs';

// ── heuristic (pre-migration) ────────────────────────────────────────────────
assert.equal(classifyEmail('ada@gmail.com'), KIND.REAL);
assert.equal(classifyEmail('priya.sharma@heynomads.app'), KIND.DEMO);
assert.equal(classifyEmail('qa.1700000000000@gmail.com'), KIND.QA);
assert.equal(classifyEmail('walkthrough.abc@gmail.com'), KIND.WALKTHROUGH);
for (const bad of [null, undefined, '', '   ', 'no-at-sign', 42, {}, '@gmail.com', 'x@']) {
  assert.equal(classifyEmail(bad), KIND.UNKNOWN, `bad=${JSON.stringify(bad)}`);
}

// ── column absent -> heuristic, behaviour unchanged ──────────────────────────
assert.equal(hasStoredKind({ email: 'ada@gmail.com' }), false);
assert.equal(classifyAccount({ email: 'ada@gmail.com' }), KIND.REAL);
assert.equal(classifyAccount({ email: 'priya.sharma@heynomads.app' }), KIND.DEMO);

// ── column present and populated -> authoritative, heuristic NOT consulted ────
// This is the case that addresses the restored test residue: a 'feed.' address
// the heuristic would call real, but that a human has explicitly marked.
assert.equal(hasStoredKind({ email: 'feed.1700000@gmail.com', account_kind: 'qa' }), true);
assert.equal(classifyAccount({ email: 'feed.1700000@gmail.com', account_kind: 'qa' }), KIND.QA);
// ...and the reverse: an address that LOOKS like a test account but is a person.
assert.equal(classifyAccount({ email: 'qa.smith@gmail.com', account_kind: 'real' }), KIND.REAL);
// The stored value wins even where the heuristic would disagree the other way.
assert.equal(classifyAccount({ email: 'x@heynomads.app', account_kind: 'real' }), KIND.REAL);

// ── column present but unreviewed -> FAIL CLOSED ─────────────────────────────
// A migrated row with no decision must never be served as a person.
for (const v of [null, '', 'unknown', '   ', 'nonsense', 7, {}]) {
  assert.equal(classifyAccount({ email: 'feed.1700000@gmail.com', account_kind: v }), KIND.UNKNOWN,
    `account_kind=${JSON.stringify(v)} must fail closed`);
}

// Case and whitespace in the stored value are tolerated.
assert.equal(classifyAccount({ email: 'a@gmail.com', account_kind: '  REAL  ' }), KIND.REAL);
assert.equal(classifyAccount({ email: 'a@gmail.com', account_kind: 'Walkthrough' }), KIND.WALKTHROUGH);

// ── the security predicates follow the same answer ──────────────────────────
const isRealRow = r => classifyAccount(r) === KIND.REAL;
assert.equal(isRealRow({ email: 'feed.1@gmail.com', account_kind: 'qa' }), false);
assert.equal(isRealRow({ email: 'feed.1@gmail.com' }), true, 'pre-migration, heuristic decides');
assert.equal(isRealRow({ email: 'ada@gmail.com', account_kind: null }), false,
  'an unreviewed migrated account must not be a feed candidate');

// ── the SQL fragment stays parameterless and covers every non-real kind ───────
assert.ok(!/\$\d/.test(NOT_REAL_EMAIL_SQL), 'fragment must be parameterless');
for (const frag of ['%@heynomads.app', "'qa.%'", "'verify%'", "'walkthrough.%'"]) {
  assert.ok(NOT_REAL_EMAIL_SQL.includes(frag), `missing exclusion: ${frag}`);
}
const aliased = NOT_REAL_EMAIL_SQL.replace(/email/g, 'ua.email');
assert.ok(aliased.includes('ua.email NOT LIKE'));
assert.ok(!aliased.includes('ua.ua.email'));

// ── realAccountSql: the two schema states must not be confusable ──────────────
// stored=false has to reproduce today's behaviour exactly, or enabling the
// column would silently change who sees whom.
assert.equal(realAccountSql('u', false), NOT_REAL_EMAIL_SQL.replace(/email/g, 'u.email'));
assert.ok(realAccountSql('u', false).includes("email NOT LIKE 'qa.%'"));
assert.equal(realAccountSql('u', true), "u.account_kind = 'real'");
// The whole point: NULL or unreviewed rows simply fail this predicate.
assert.ok(!/IS NOT NULL/.test(realAccountSql('u', true)), 'must not admit NULL kinds');
// Both forms stay parameterless and single-table.
for (const f of [realAccountSql('u', true), realAccountSql('u', false)]) {
  assert.ok(!/\$\d/.test(f), 'fragment must be parameterless');
  assert.ok(!/\bJOIN\b/i.test(f), 'fragment must be a single-table predicate');
}
assert.equal(realAccountSql('ua', true), "ua.account_kind = 'real'");
assert.equal(realAccountSql('', true), "account_kind = 'real'");

console.log('account classification self-check: all assertions passed');