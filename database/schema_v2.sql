-- ============================================================
-- Hey Nomads v2 — Full Schema Migration
-- Extends existing INT-based schema with new tables
-- Run against Neon PostgreSQL
-- ============================================================

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

INSERT INTO cities (name, country, state, description, cost_level, student_friendly, expat_friendly) VALUES
    ('Mumbai', 'India', 'Maharashtra', 'The city of dreams. Fast-paced, diverse, and full of opportunity.', 5, TRUE, TRUE),
    ('Bangalore', 'India', 'Karnataka', 'India''s tech capital. Great weather, vibrant startup culture.', 4, TRUE, TRUE),
    ('Delhi', 'India', 'Delhi', 'The national capital. Rich history, incredible food, bustling markets.', 4, TRUE, TRUE),
    ('Pune', 'India', 'Maharashtra', 'Oxford of the East. Student-friendly, growing IT hub.', 3, TRUE, TRUE),
    ('Hyderabad', 'India', 'Telangana', 'City of Pearls. Booming tech scene, amazing biryani.', 3, TRUE, TRUE),
    ('Melbourne', 'Australia', 'Victoria', 'Liveable city, multicultural, great universities.', 4, TRUE, TRUE),
    ('London', 'United Kingdom', 'England', 'Global city, diverse, world-class universities.', 5, TRUE, TRUE),
    ('Toronto', 'Canada', 'Ontario', 'Multicultural hub, excellent quality of life.', 4, TRUE, TRUE),
    ('New York', 'United States', 'New York', 'The city that never sleeps. Endless opportunities.', 5, TRUE, TRUE),
    ('Singapore', 'Singapore', NULL, 'Business hub, clean, safe, multicultural.', 5, FALSE, TRUE)
ON CONFLICT (LOWER(name), LOWER(country)) DO NOTHING;

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
    created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_city ON events (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_time);
CREATE INDEX IF NOT EXISTS idx_events_community ON events (community_id);

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

-- ── 10. SETTLEMENT CHECKLIST ─────────────────────────────────

CREATE TABLE IF NOT EXISTS settlement_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    "order" INT DEFAULT 0
);

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

-- ── 12. SEED SETTLEMENT TASKS ────────────────────────────────

INSERT INTO settlement_tasks (title, description, category, "order") VALUES
    ('Complete your profile', 'Fill in your profile details so others can find you.', 'general', 1),
    ('Set your preferences', 'Tell us what you''re looking for in a roommate or community.', 'general', 2),
    ('Find a roommate', 'Browse compatible roommates and start a conversation.', 'housing', 3),
    ('Find your home', 'Search for housing options in your target city.', 'housing', 4),
    ('Join a community', 'Find people with shared interests in your new city.', 'general', 5),
    ('Attend an event', 'Meet people in person at local events.', 'general', 6),
    ('Set up banking', 'Open a local bank account or set up digital payments.', 'banking', 7),
    ('Get a SIM card', 'Get a local SIM for calls and data.', 'sim', 8),
    ('Learn about transport', 'Figure out public transport, metro routes, and commute options.', 'transport', 9),
    ('Explore your neighbourhood', 'Discover nearby groceries, pharmacies, and essential services.', 'neighbourhoods', 10),
    ('Verify your identity', 'Verify your profile for increased trust.', 'general', 11),
    ('Know local safety tips', 'Learn about safety norms and emergency contacts.', 'safety', 12)
ON CONFLICT DO NOTHING;

-- ── 13. SEED COMMUNITIES ─────────────────────────────────────

-- We'll seed via the API rather than SQL to use proper user references

-- ── 14. SEED RESOURCES ───────────────────────────────────────

INSERT INTO resources (title, description, category, city, country, url) VALUES
    ('Mumbai Metro Guide', 'Complete guide to Mumbai Metro lines, stations, and fares.', 'transport', 'Mumbai', 'India', NULL),
    ('How to Find an Apartment in Mumbai', 'Tips on finding flats, dealing with brokers, and what to expect.', 'housing', 'Mumbai', 'India', NULL),
    ('Best Neighbourhoods in Bangalore for Young Professionals', 'A curated list of areas with good connectivity and nightlife.', 'neighbourhoods', 'Bangalore', 'India', NULL),
    ('Opening a Bank Account in India as a Foreigner', 'Step-by-step guide to opening an NRE/NRO or savings account.', 'banking', NULL, 'India', NULL),
    ('Best SIM Cards for International Students in India', 'Compare Jio, Airtel, and Vi for data and calling plans.', 'sim', NULL, 'India', NULL),
    ('Melbourne Public Transport Guide', 'Myki cards, tram networks, and train lines explained.', 'transport', 'Melbourne', 'Australia', NULL),
    ('Finding Housing in London', 'Rightmove, SpareRoom, and the rental process in the UK.', 'housing', 'London', 'United Kingdom', NULL),
    ('Toronto Essentials for Newcomers', 'Healthcare, SIN number, banking, and transit in Toronto.', 'general', 'Toronto', 'Canada', NULL),
    ('New York City Subway Guide', 'OMNY, MetroCards, and navigating the 5 boroughs.', 'transport', 'New York', 'United States', NULL),
    ('Healthcare System in Australia for Students', 'Medicare, OSHC, and finding a GP in Melbourne.', 'healthcare', 'Melbourne', 'Australia', NULL)
ON CONFLICT DO NOTHING;

-- ── 15. TRIGGER: auto-update timestamps ──────────────────────

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
