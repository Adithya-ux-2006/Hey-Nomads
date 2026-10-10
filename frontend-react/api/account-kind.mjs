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
};

// Seeded sample profiles. seed-test-data.mjs owns this domain.
const DEMO_DOMAIN = 'heynomads.app';
// Automated accounts created by scripts/browser-qa.mjs.
const QA_LOCAL_PREFIXES = ['qa.', 'verify', 'walkthrough'];
// Legacy one-off manual test accounts.
const WALKTHROUGH_PREFIX = 'walkthrough.';

export function classifyEmail(email) {
  if (!email || typeof email !== 'string') return KIND.REAL;
  const e = email.trim().toLowerCase();
  const [local, domain] = e.split('@');

  if (domain === DEMO_DOMAIN) return KIND.DEMO;
  if (local.startsWith(WALKTHROUGH_PREFIX)) return KIND.WALKTHROUGH;
  if (QA_LOCAL_PREFIXES.some(p => local.startsWith(p))) return KIND.QA;
  return KIND.REAL;
}

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