-- Adds an explicit account classification so "is this a real person?" stops
-- being inferred from an email substring.
--
-- Status: NOT APPLIED. This file is additive and reversible; it has not been
-- run against production. Applying it requires separate approval, and any
-- backfill of existing rows needs approval per row-class, because reclassifying
-- an existing account changes who can see whom.
--
-- Reversal:
--   ALTER TABLE users DROP COLUMN account_kind;
--
-- The application does not depend on this column yet. api/account-kind.mjs
-- derives the same classification from the address domain and will keep doing
-- so until this migration is applied and backfilled.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_kind TEXT;

-- New accounts get a kind at creation time from api/account-kind.mjs, so the
-- column fills in going forward even before a backfill is approved.
CREATE INDEX IF NOT EXISTS idx_users_account_kind ON users (account_kind);

-- Backfill proposal, NOT executed. Review each row class before running.
--
--   UPDATE users SET account_kind = 'demo'        WHERE email LIKE '%@heynomads.app';
--   UPDATE users SET account_kind = 'qa'          WHERE email LIKE 'qa.%';
--   UPDATE users SET account_kind = 'walkthrough' WHERE email LIKE 'walkthrough.%';
--   UPDATE users SET account_kind = 'real'        WHERE account_kind IS NULL;

-- Guard: a nullable classification must never be treated as "real" by a
-- consumer that forgets the fallback, so default new rows to unknown.
ALTER TABLE users
  ALTER COLUMN account_kind SET DEFAULT 'unknown';