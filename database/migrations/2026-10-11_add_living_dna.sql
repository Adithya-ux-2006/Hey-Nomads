-- Living DNA: a private household questionnaire, consent-gated comparison between
-- mutual matches, and a collaboratively written Living Constitution.
--
-- Status: NOT APPLIED. Additive and reversible; has not been run against
-- production. Applying it requires separate approval. It creates new tables
-- only and never touches users, matches, messages or agreements, so it cannot
-- alter who can see whom.
--
-- Reversal (order matters, children first):
--   DROP TABLE IF EXISTS living_constitution_acceptances;
--   DROP TABLE IF EXISTS living_constitution_rules;
--   DROP TABLE IF EXISTS living_dna_sharing;
--   DROP TABLE IF EXISTS living_dna_answers;
--   DROP TABLE IF EXISTS living_dna_questions;
--
-- Privacy model
-- -------------
-- A response row belongs to exactly one user and is never readable by anyone
-- else. living_dna_sharing is the ONLY thing that opens an answer to a matched
-- partner, and it is opt-in per user, defaulting to sharing nothing. Comparison
-- refuses unless BOTH participants have consented.
--
-- Deliberately NOT stored here: any profile field derived from these answers.
-- Nothing in the feed, matching or compatibility score may read this table, or
-- "complete your Living DNA" would quietly become a matching criterion, which
-- is both a privacy problem and a stereotyping one.

-- ── Questions ──────────────────────────────────────────────────────────────
-- The 15 scenarios from the product brief. Static content, so it ships with the
-- migration and needs no seeding step. Options are JSONB rather than a child
-- table: they are only ever read as a list with the question, never queried
-- independently or joined.
CREATE TABLE IF NOT EXISTS living_dna_questions (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(60) NOT NULL UNIQUE,
  category VARCHAR(40) NOT NULL,
  prompt TEXT NOT NULL,
  -- Balanced choices with a neutral escape hatch. "Depends on the situation" is
  -- present on every question so nobody is forced into a position they do not hold.
  options JSONB NOT NULL CHECK (jsonb_array_length(options) >= 3),
  position INT NOT NULL
);

-- ── Responses ──────────────────────────────────────────────────────────────
-- One row per user per question. is_boundary is the user's own distinction
-- between "I would prefer" and "I need"; the comparison only surfaces boundaries
-- separately when the owner has consented to share them.
CREATE TABLE IF NOT EXISTS living_dna_answers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES living_dna_questions(id) ON DELETE CASCADE,
  option VARCHAR(120) NOT NULL,
  is_boundary BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_living_dna_answers_user ON living_dna_answers (user_id);

-- ── Sharing consent ────────────────────────────────────────────────────────
-- One row per user. Absent row means "has shared nothing", which is the safe
-- default, so a user who never visits the sharing screen is never exposed.
CREATE TABLE IF NOT EXISTS living_dna_sharing (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_preferences BOOLEAN NOT NULL DEFAULT FALSE,
  share_boundaries BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Living Constitution ────────────────────────────────────────────────────
-- Rules hang off the match, not off a user, because a constitution is a shared
-- document between exactly the two matched people.
CREATE TABLE IF NOT EXISTS living_constitution_rules (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(40) NOT NULL,
  rule_text TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'agreed', 'declined')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_living_constitution_rules_match ON living_constitution_rules (match_id);

-- Dual acceptance. The constitution is only settled once BOTH participants have
-- a row here. One row per user per match, so re-accepting is idempotent.
CREATE TABLE IF NOT EXISTS living_constitution_acceptances (
  match_id INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, user_id)
);

-- ── Seed the 15 scenarios ──────────────────────────────────────────────────
INSERT INTO living_dna_questions (slug, category, prompt, options, position) VALUES
  ('cleaning_chores', 'Cleaning & chores',
   'How do you want shared cleaning and chores handled?',
   '["I keep my own areas clean and shared areas as they come", "We split chores evenly and rotate", "I do most of the shared cleaning", "It depends on the situation"]', 1),

  ('quiet_hours', 'Quiet & sleep',
   'What are your quiet hours and sleep schedule like?',
   '["Early to bed, quiet from 9pm", "Normal hours, quiet from 11pm", "I am a night owl and often work late", "It depends on the situation"]', 2),

  ('guests', 'Guests & visitors',
   'What are your expectations around guests and overnight visitors?',
   '["Guests rarely, and always arranged in advance", "Guests fine with a few hours notice", "Guests are welcome most days", "It depends on the situation"]', 3),

  ('rent_bills', 'Rent & expenses',
   'How should rent, bills and shared expenses be arranged?',
   '["Pay my share on time, prefer one person tracking totals", "Pay my share on time, split each bill directly", "I like a shared spreadsheet", "It depends on the situation"]', 4),

  ('late_payments', 'Money communication',
   'How do you want to handle a late or missed payment?',
   '["Tell me straight away and we sort it immediately", "Give a short heads-up and settle within a few days", "It should not happen, and I want it raised if it does", "It depends on the situation"]', 5),

  ('food_kitchen', 'Food & kitchen',
   'How do you want to share the kitchen and food arrangements?',
   '["Mostly cook separately, minimal sharing", "Share basics like oil, spices and salt", "Cook together most evenings", "It depends on the situation"]', 6),

  ('diet_vegetarian', 'Food & kitchen',
   'How should vegetarian and non-vegetarian food be handled in a shared kitchen?',
   '["Separate areas and utensils, no cross-contamination", "Fine to share surfaces, just keep food separate", "I am vegetarian and would rather cook separately", "I am non-vegetarian and flexible either way", "It depends on the situation"]', 7),

  ('power_ac', 'Utilities & comfort',
   'How do you feel about air conditioning and electricity use?',
   '["Keep AC off, open windows and fans instead", "AC is fine when it is hot", "AC on whenever it is needed, even if the bill goes up", "It depends on the situation"]', 8),

  ('domestic_help', 'Household responsibilities',
   'How do you feel about domestic help or cleaners?',
   '["Happy to share a cleaner and split the cost", "Happy to share, but I would rather do our own rooms", "I would rather we manage without outside help", "It depends on the situation"]', 9),

  ('privacy_borrowing', 'Privacy & belongings',
   'What are your expectations around borrowing things and personal space?',
   '["Ask every time, no exceptions", "Ask for everyday items, fine with small exceptions", "Generally fine within reason", "It depends on the situation"]', 10),

  ('work_noise', 'Study, work & noise',
   'How do you handle work, study, gaming and noise during the day?',
   '["Quiet during the day, I work or study from home", "Normal daytime noise is fine", "Gaming or calls during the day are fine", "It depends on the situation"]', 11),

  ('family_visits', 'Family & boundaries',
   'How do you feel about family visiting the home?',
   '["Occasional visits with notice are fine", "Frequent family visits are fine", "I prefer the home to be visitors-free", "It depends on the situation"]', 12),

  ('conflict', 'Conflict resolution',
   'How do you want disagreements handled?',
   '["Talk it through straight away", "Take a day to cool off, then talk", "Write it down first so we both respond calmly", "It depends on the situation"]', 13),

  ('groceries', 'Shared supplies',
   'How should groceries and household supplies be bought and tracked?',
   '["We shop together once a week", "Each buys their own, we replace a shared item when it runs out", "Whoever notices it just gets it", "It depends on the situation"]', 14),

  ('house_rules', 'House rules',
   'How do you want house rules to be set and changed?',
   '["Agree them once at the start and stick to them", "Agree them once, but we can revise with both agreeing", "Discuss them as they come up", "It depends on the situation"]', 15)
ON CONFLICT (slug) DO NOTHING;