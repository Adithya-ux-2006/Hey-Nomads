const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  const client = await pool.connect();
  try {
    console.log('✅ Database connected successfully');
  } finally {
    client.release();
  }
}

async function ensureDatabaseSchema() {
  const client = await pool.connect();
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        supabase_user_id VARCHAR(255) DEFAULT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        gender VARCHAR(20) DEFAULT NULL,
        age INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bio TEXT DEFAULT NULL,
        occupation VARCHAR(100) DEFAULT NULL,
        city VARCHAR(100) DEFAULT NULL,
        profile_image VARCHAR(255) DEFAULT NULL,
        move_in_date DATE DEFAULT NULL,
        sleep_time VARCHAR(10) NOT NULL DEFAULT 'flexible' CHECK (sleep_time IN ('early', 'late', 'flexible')),
        cleanliness INT NOT NULL DEFAULT 3,
        diet VARCHAR(10) NOT NULL DEFAULT 'veg' CHECK (diet IN ('veg', 'nonveg', 'eggetarian', 'vegan')),
        noise_tolerance VARCHAR(10) NOT NULL DEFAULT 'moderate' CHECK (noise_tolerance IN ('quiet', 'moderate', 'loud')),
        noise_level INT DEFAULT 3,
        budget INT NOT NULL DEFAULT 15000,
        tax_bracket VARCHAR(10) DEFAULT 'medium' CHECK (tax_bracket IN ('low', 'medium', 'high')),
        deposit INT DEFAULT 5000,
        flat_type VARCHAR(20) DEFAULT 'shared' CHECK (flat_type IN ('1BHK', '2BHK', '3BHK', 'shared', 'studio', 'other')),
        occupants INT DEFAULT 1,
        smoking VARCHAR(5) DEFAULT 'no' CHECK (smoking IN ('yes', 'no')),
        drinking VARCHAR(5) DEFAULT 'no' CHECK (drinking IN ('yes', 'no')),
        partying VARCHAR(10) DEFAULT 'low' CHECK (partying IN ('low', 'medium', 'high')),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_profiles_user UNIQUE (user_id)
      )`,

      `CREATE TABLE IF NOT EXISTS languages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE
      )`,

      `CREATE TABLE IF NOT EXISTS user_languages (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        language_id INT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
        CONSTRAINT uq_user_language UNIQUE (user_id, language_id)
      )`,

      `CREATE TABLE IF NOT EXISTS preferences (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        preferred_gender VARCHAR(20) DEFAULT NULL,
        preferred_budget_min INT DEFAULT NULL,
        preferred_budget_max INT DEFAULT NULL,
        preferred_location_radius INT DEFAULT 10,
        prefers_smoking VARCHAR(10) DEFAULT 'no_preference' CHECK (prefers_smoking IN ('yes', 'no', 'no_preference')),
        prefers_drinking VARCHAR(10) DEFAULT 'no_preference' CHECK (prefers_drinking IN ('yes', 'no', 'no_preference')),
        prefers_cleanliness_min INT DEFAULT 1,
        prefers_sleep_schedule VARCHAR(10) DEFAULT 'no_preference' CHECK (prefers_sleep_schedule IN ('early', 'late', 'flexible', 'no_preference')),
        prefers_same_diet BOOLEAN DEFAULT FALSE,
        prefers_same_sleep BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_preferences_user UNIQUE (user_id)
      )`,

      `CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_sender_receiver (sender_id, receiver_id),
        INDEX idx_created_at (created_at)
      )`,

      `CREATE TABLE IF NOT EXISTS shortlists (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_shortlists_pair UNIQUE (user_id, target_id)
      )`,

      `CREATE TABLE IF NOT EXISTS agreements (
        id SERIAL PRIMARY KEY,
        userA_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        userB_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_agreements_pair UNIQUE (userA_id, userB_id)
      )`,

      `INSERT INTO languages (id, name) VALUES
        (1, 'English'),
        (2, 'Hindi'),
        (3, 'Tamil'),
        (4, 'Telugu'),
        (5, 'Kannada'),
        (6, 'Malayalam'),
        (7, 'Marathi'),
        (8, 'Gujarati'),
        (9, 'Bengali'),
        (10, 'Punjabi'),
        (11, 'Urdu'),
        (12, 'Spanish'),
        (13, 'French'),
        (14, 'German'),
        (15, 'Other')
      ON CONFLICT (id) DO NOTHING`
    ];

    for (const statement of statements) {
      await client.query(statement);
    }
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  testConnection,
  ensureDatabaseSchema
};