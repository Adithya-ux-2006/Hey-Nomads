-- Date of birth + persistent notifications.
--
-- Status: APPLIED to the production database on 2026-10-17 with explicit
-- human approval, via scripts/apply-migration.mjs
-- (ALLOW_DEPLOYED_DB_TESTS=1). Additive and reversible; it only adds a column
-- and new tables with their own indexes; it never touches users' other columns,
-- matches, messages, agreements or living-DNA tables, so it cannot alter who
-- can see whom.
--
-- Reversal (order matters, children first):
--   DROP TABLE IF EXISTS notifications;
--   ALTER TABLE users DROP COLUMN IF EXISTS date_of_birth;

-- ── Date of birth ─────────────────────────────────────────────────────────
-- Age used to be a free-text integer on users, with no way to validate it and
-- no way to recalculate it as time passes. date_of_birth is the source of
-- truth; users.age is now a derived cache that the API recalculates on every
-- read and write. The column is nullable so existing rows keep working until
-- each user supplies a DOB through the profile editor.
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- ── Notifications ─────────────────────────────────────────────────────────
-- One row per event a user should see. read_at NULL means unread. The
-- uniqueness constraint below is what makes event handling idempotent: the
-- same (recipient, type, dedup_key) can only ever be unread once, so a
-- retried webhook or a double-tapped swipe cannot produce two bells.
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id INT REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('message', 'like', 'match')),
    dedup_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON notifications (recipient_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_unread_dedup
    ON notifications (recipient_id, type, dedup_key)
    WHERE read_at IS NULL;

-- ── Notification preferences ──────────────────────────────────────────────
-- Per-user opt-out for the three in-app categories we actually emit today.
-- Defaults are all TRUE so the migration is non-breaking: nobody loses their
-- notifications by having the table appear. Browser / mobile push is NOT
-- covered here — there is no service worker, permission prompt or delivery
-- pipeline, so nothing in this table claims to deliver off-app.
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    messages BOOLEAN NOT NULL DEFAULT TRUE,
    likes BOOLEAN NOT NULL DEFAULT TRUE,
    matches BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
