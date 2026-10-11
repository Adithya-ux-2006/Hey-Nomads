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
--
-- KNOWN LIMITATION while the heuristic is live
-- --------------------------------------------
-- The heuristic only recognises the reserved prefixes qa.*, verify* and
-- walkthrough.*. Accounts created by one-off manual QA runs (feed.*, layout.*,
-- actorprobe.*, agr.*) carry no reserved prefix, so they classify as 'real' and
-- still appear in real users' recommendation feeds. On the current database that
-- is roughly 110 rows, the overwhelming majority of them test leftovers rather
-- than people.
--
-- Those rows have deliberately NOT been deleted or reclassified, because doing
-- so changes who can see whom and needs explicit approval. Until that review
-- happens, treat feed isolation as correct for demo/walkthrough accounts only.
-- See scripts/review-account-classification.mjs, which reports candidates and
-- writes nothing.
--
-- Deliberately NOT done here: extending the prefix list to cover those extra
-- test accounts. It would shrink today's symptom while widening the very
-- substring matching this migration exists to remove, and could hide a genuine
-- user whose address happens to start with one of them.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_kind TEXT;

-- Guard: a nullable classification must never be treated as "real" by a
-- consumer that forgets the fallback, so default new rows to unknown.
ALTER TABLE users
  ALTER COLUMN account_kind SET DEFAULT 'unknown';

-- An unrecognised value is a bug, not a new account kind. This is additive and
-- safe on an empty column: it rejects only values the application never writes.
-- Reversal:
--   ALTER TABLE users DROP CONSTRAINT users_account_kind_check;
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_kind_check;
ALTER TABLE users
  ADD CONSTRAINT users_account_kind_check
  CHECK (account_kind IS NULL OR account_kind IN ('real','demo','qa','walkthrough','unknown'));

CREATE INDEX IF NOT EXISTS idx_users_account_kind ON users (account_kind);

-- Backfill proposal, NOT executed. Review each row class before running.
--
--   UPDATE users SET account_kind = 'demo'        WHERE email LIKE '%@heynomads.app';
--   UPDATE users SET account_kind = 'qa'          WHERE email LIKE 'qa.%';
--   UPDATE users SET account_kind = 'walkthrough' WHERE email LIKE 'walkthrough.%';
--   UPDATE users SET account_kind = 'real'        WHERE account_kind IS NULL;
--
-- The last statement is the dangerous one. It marks every unlisted row real,
-- including accounts created by one-off manual QA runs whose address does not
-- use a reserved prefix. Do not run it until scripts/review-account-classification.mjs
-- output has been reviewed by a human.