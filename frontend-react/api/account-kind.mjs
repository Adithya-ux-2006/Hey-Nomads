// One place that decides what kind of account an address belongs to.
//
// This used to be a bare `NOT LIKE '%@heynomads.app'` string repeated in four
// places in api/index.js. That covered seeded demo accounts only, so automated
// QA and walkthrough accounts still ranked in the real feed and showed up to
// real users with names like "QAa 1791629723227". Every consumer now asks here
// instead.
//
// Durable upgrade path: add an `account_kind` column (see
// database/migrations/2026-10-10_add_account_kind.sql) and backfill it. Until
// that migration is approved and applied, classification is derived from the
// address domain, which is stable because seeded fixtures own their domains.

export const KIND = {
  REAL: 'real',
  DEMO: 'demo',
  QA: 'qa',
  WALKTHROUGH: 'walkthrough',
  // Not classifiable. Never treated as a person.
  UNKNOWN: 'unknown',
};

// Seeded sample profiles. seed-test-data.mjs owns this domain.
const DEMO_DOMAIN = 'heynomads.app';
// Automated accounts created by scripts/browser-qa.mjs.
const QA_LOCAL_PREFIXES = ['qa.', 'verify', 'walkthrough'];
// Legacy one-off manual test accounts.
const WALKTHROUGH_PREFIX = 'walkthrough.';

export function classifyEmail(email) {
  // Fail closed. A missing or malformed address is not evidence that the account
  // is a person, and the feed must never surface an unclassifiable account to a
  // real user. `users.email` is NOT NULL today, so this is defence in depth for
  // a future column default or a partially-migrated row.
  if (typeof email !== 'string') return KIND.UNKNOWN;
  const e = email.trim().toLowerCase();
  if (!e || !e.includes('@') || e.startsWith('@') || e.endsWith('@')) return KIND.UNKNOWN;

  const [local, domain] = e.split('@');
  if (!local || !domain) return KIND.UNKNOWN;

  if (domain === DEMO_DOMAIN) return KIND.DEMO;
  if (local.startsWith(WALKTHROUGH_PREFIX)) return KIND.WALKTHROUGH;
  if (QA_LOCAL_PREFIXES.some(p => local.startsWith(p))) return KIND.QA;
  return KIND.REAL;
}

/**
 * Prefers the explicit stored classification over the address heuristic.
 *
 * `users.account_kind` is the durable answer (see
 * database/migrations/2026-10-10_add_account_kind.sql). Once that column exists,
 * it is authoritative and the substring heuristic is NOT consulted, because the
 * heuristic cannot tell a genuine `qa.smith@gmail.com` from a test account and
 * that false positive hides a real person.
 *
 * Three states, deliberately distinct:
 *   - column absent      (`account_kind === undefined`) -> heuristic, the pre-migration state
 *   - column present and populated -> that value, verbatim
 *   - column present but NULL/unrecognised -> UNKNOWN, i.e. fail closed. A row that
 *     has been migrated but not yet reviewed must not be served as a person just
 *     because its address happens to look ordinary.
 *
 * Never silently reclassifies: it reads what is stored, it does not write.
 */
export function classifyAccount(row) {
  const stored = row?.account_kind;
  if (stored === undefined) return classifyEmail(row?.email);
  if (typeof stored !== 'string') return KIND.UNKNOWN;
  const k = stored.trim().toLowerCase();
  if (!k || k === KIND.UNKNOWN) return KIND.UNKNOWN;
  return Object.values(KIND).includes(k) ? k : KIND.UNKNOWN;
}

/** True when the stored column exists on the row shape we were handed. */
export const hasStoredKind = row => row?.account_kind !== undefined;

export const isDemo = email => classifyEmail(email) === KIND.DEMO;

/** Only these may appear in another person's real recommendation feed. */
export const isRealFeedCandidate = email => classifyEmail(email) === KIND.REAL;

/** Addresses that may be used as a demo counterpart. */
export const DEMO_EMAIL_PATTERN = `%@${DEMO_DOMAIN}`;

/**
 * SQL fragment for `users.email` excluding every non-real kind. Parameterless
 * so it can be dropped straight into a WHERE clause; the values are constants
 * above, never caller input.
 */
export const NOT_REAL_EMAIL_SQL =
  `email NOT LIKE '${DEMO_EMAIL_PATTERN}'` +
  ` AND email NOT LIKE 'qa.%'` +
  ` AND email NOT LIKE 'verify%'` +
  ` AND email NOT LIKE '${WALKTHROUGH_PREFIX}%'`;

/** True when the account may be swiped/shortlisted as a real person. */
export const isInteractingAsRealUser = email => classifyEmail(email) === KIND.REAL;

export const humanLabel = kind => {
  switch (kind) {
    case KIND.DEMO: return 'Demo';
    case KIND.QA: return 'Test account';
    case KIND.WALKTHROUGH: return 'Test account';
    default: return null;
  }
};