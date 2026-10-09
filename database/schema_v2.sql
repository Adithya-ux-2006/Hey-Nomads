-- ============================================================
-- Hey Nomads — Postgres schema
-- Run against an empty Neon database, or re-run on an existing one
-- (every statement is IF NOT EXISTS, so it is safe to re-apply).
--
-- Reference data (cities, settlement_tasks, resources) is NOT seeded here.
-- Run scripts/seed-reference-data.mjs for that. Content in two places is how
-- the checklist ended up with 24 tasks instead of 12.
-- ============================================================

-- ── 0. BASE TABLES ───────────────────────────────────────────
-- These predate schema_v2.sql and had no DDL anywhere in the repo, so a fresh
-- database could not be built from the repository alone.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    gender VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    occupation VARCHAR(200),
    city VARCHAR(100),
    profile_image VARCHAR(500),
    move_in_date DATE,
    sleep_time VARCHAR(20) NOT NULL DEFAULT 'flexible' CHECK (sleep_time IN ('early','late','flexible')),
    cleanliness INT NOT NULL DEFAULT 3 CHECK (cleanliness BETWEEN 1 AND 5),
    diet VARCHAR(20) NOT NULL DEFAULT 'veg' CHECK (diet IN ('veg','nonveg','eggetarian','vegan')),
    noise_tolerance VARCHAR(20) NOT NULL DEFAULT 'moderate' CHECK (noise_tolerance IN ('quiet','moderate','loud')),
    noise_level INT DEFAULT 3,
    budget INT NOT NULL DEFAULT 15000,
    tax_bracket VARCHAR(20) DEFAULT 'medium' CHECK (tax_bracket IN ('low','medium','high')),
    deposit INT DEFAULT 5000,
    flat_type VARCHAR(20) DEFAULT 'shared' CHECK (flat_type IN ('1BHK','2BHK','3BHK','shared','studio','other')),
    occupants INT DEFAULT 1,
    smoking VARCHAR(20) DEFAULT 'no' CHECK (smoking IN ('yes','no')),
    drinking VARCHAR(20) DEFAULT 'no' CHECK (drinking IN ('yes','no')),
    partying VARCHAR(20) DEFAULT 'low' CHECK (partying IN ('low','medium','high')),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preferences (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    preferred_gender VARCHAR(20),
    preferred_budget_min INT,
    preferred_budget_max INT,
    preferred_location_radius INT DEFAULT 10,
    prefers_smoking VARCHAR(20) DEFAULT 'no_preference' CHECK (prefers_smoking IN ('yes','no','no_preference')),
    prefers_drinking VARCHAR(20) DEFAULT 'no_preference' CHECK (prefers_drinking IN ('yes','no','no_preference')),
    prefers_cleanliness_min INT DEFAULT 1,
    prefers_sleep_schedule VARCHAR(20) DEFAULT 'no_preference' CHECK (prefers_sleep_schedule IN ('early','late','flexible','no_preference')),
    prefers_same_diet BOOLEAN DEFAULT FALSE,
    prefers_same_sleep BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS languages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_languages (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language_id INT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    UNIQUE (user_id, language_id)
);

CREATE TABLE IF NOT EXISTS shortlists (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, target_id)
);

CREATE TABLE IF NOT EXISTS agreements (
    id SERIAL PRIMARY KEY,
    user_a_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_a_id, user_b_id)
);

-- ── 1. ALTER EXISTING TABLES ─────────────────────────────────

-- Extend users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS moving_to VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS moving_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS university VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'none' CHECK (verification_status IN ('none', 'email', 'identity', 'university', 'work'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS looking_for VARCHAR(20) DEFAULT 'both' CHECK (looking_for IN ('roommate', 'community', 'both'));

-- Extend profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_level VARCHAR(20) DEFAULT 'moderate' CHECK (social_level IN ('introvert', 'moderate', 'extrovert'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pets VARCHAR(20) DEFAULT 'no' CHECK (pets IN ('yes', 'no', 'okay'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_schedule VARCHAR(20) DEFAULT 'regular' CHECK (work_schedule IN ('regular', 'remote', 'flexible', 'night'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neighbourhood VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_neighbourhood VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- ── 2. CITIES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    image TEXT,
    description TEXT,
    cost_level INT DEFAULT 3 CHECK (cost_level BETWEEN 1 AND 5),
    student_friendly BOOLEAN DEFAULT TRUE,
    expat_friendly BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_name_country ON cities (LOWER(name), LOWER(country));
CREATE INDEX IF NOT EXISTS idx_cities_country ON cities (LOWER(country));

-- Cities, settlement tasks and resources are seeded by
-- scripts/seed-reference-data.mjs, not here. Seeding content in two places is
-- how the checklist ended up with 24 tasks instead of 12.

-- ── 3. MATCHES (replaces shortlists with proper matching) ────

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    user_a_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    compatibility_score INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'unmatched', 'blocked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (user_a_id <> user_b_id),
    UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_user_a ON matches (user_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON matches (user_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_user_a_status ON matches (user_a_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_user_b_status ON matches (user_b_id, status);

-- ── 4. SWIPES (like/pass actions) ────────────────────────────

CREATE TABLE IF NOT EXISTS swipes (
    id SERIAL PRIMARY KEY,
    swiper_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiped_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(10) NOT NULL CHECK (action IN ('like', 'pass')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (swiper_id <> swiped_id),
    UNIQUE (swiper_id, swiped_id)
);

CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes (swiper_id);
CREATE INDEX IF NOT EXISTS idx_swipes_swiped ON swipes (swiped_id);

-- ── 5. CONVERSATIONS & MESSAGES (proper system) ──────────────

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_members (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members (user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members (conversation_id);

-- Drop old messages table and recreate with conversation support
DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 5000),
    read_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (conversation_id, created_at DESC) WHERE read_at IS NULL;

-- ── 6. BLOCKS & REPORTS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (blocker_id <> blocked_id),
    UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    reported_community_id INT,
    reported_message_id INT,
    type VARCHAR(30) NOT NULL CHECK (type IN ('user', 'community', 'message')),
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

-- ── 7. COMMUNITIES ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS communities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communities_city ON communities (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities (LOWER(category));
CREATE INDEX IF NOT EXISTS idx_communities_country ON communities (LOWER(country));

CREATE TABLE IF NOT EXISTS community_members (
    id SERIAL PRIMARY KEY,
    community_id INT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'admin', 'creator')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_members_user ON community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_comm_members_community ON community_members (community_id);

-- ── 8. EVENTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    community_id INT REFERENCES communities(id) ON DELETE SET NULL,
    location VARCHAR(300),
    city VARCHAR(100),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    capacity INT,
    attendee_count INT DEFAULT 0,
    -- Free-form on purpose: the community/event taxonomy is content, not
    -- schema. A CHECK list here is what made the UI's category filter match
    -- nothing.
    category VARCHAR(50),
    created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Also applied by ALTER for databases created before this column existed.
ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_events_city ON events (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_time);
CREATE INDEX IF NOT EXISTS idx_events_community ON events (community_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON events (LOWER(category));

CREATE TABLE IF NOT EXISTS event_rsvps (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(10) DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event ON event_rsvps (event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user ON event_rsvps (user_id);

-- ── 9. RESOURCES (Settle In) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('housing', 'transport', 'banking', 'sim', 'healthcare', 'groceries', 'government', 'university', 'work', 'safety', 'neighbourhoods', 'general')),
    city VARCHAR(100),
    country VARCHAR(100),
    url TEXT,
    image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources (LOWER(category));
CREATE INDEX IF NOT EXISTS idx_resources_city ON resources (LOWER(city));
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_title ON resources (LOWER(title));

-- ── 10. SETTLEMENT CHECKLIST ─────────────────────────────────

CREATE TABLE IF NOT EXISTS settlement_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    -- Where the user actually goes to do this ("apply for NRE account").
    -- Without it a task like "open a bank account" is a to-do with nowhere to
    -- go, which is the whole point of the checklist.
    url TEXT,
    "order" INT DEFAULT 0
);

-- Also applied by ALTER for databases created before the url column existed.
ALTER TABLE settlement_tasks ADD COLUMN IF NOT EXISTS url TEXT;

-- Tasks and resources are keyed on their natural title so re-running the
-- seeder updates in place instead of appending a second copy of everything.
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_tasks_title ON settlement_tasks (LOWER(title));

CREATE TABLE IF NOT EXISTS user_settlement_tasks (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INT NOT NULL REFERENCES settlement_tasks(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP DEFAULT NULL,
    UNIQUE (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settlement_user ON user_settlement_tasks (user_id);

-- ── 11. MATCH PREFERENCES (configurable weights) ─────────────

CREATE TABLE IF NOT EXISTS match_weights (
    id SERIAL PRIMARY KEY,
    lifestyle_weight DECIMAL(3,2) DEFAULT 0.25,
    budget_weight DECIMAL(3,2) DEFAULT 0.20,
    location_weight DECIMAL(3,2) DEFAULT 0.20,
    movein_weight DECIMAL(3,2) DEFAULT 0.15,
    interests_weight DECIMAL(3,2) DEFAULT 0.10,
    habits_weight DECIMAL(3,2) DEFAULT 0.10,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default weights
INSERT INTO match_weights (lifestyle_weight, budget_weight, location_weight, movein_weight, interests_weight, habits_weight)
SELECT 0.25, 0.20, 0.20, 0.15, 0.10, 0.10
WHERE NOT EXISTS (SELECT 1 FROM match_weights);

-- ── 12. TRIGGER: auto-update timestamps ──────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 16. INDEXES for common queries ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_moving_to ON users (LOWER(moving_to));
CREATE INDEX IF NOT EXISTS idx_users_country ON users (LOWER(country));
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_profiles_budget ON profiles (budget);
CREATE INDEX IF NOT EXISTS idx_profiles_move_in ON profiles (move_in_date);
CREATE INDEX IF NOT EXISTS idx_profiles_neighbourhood ON profiles (LOWER(neighbourhood));
