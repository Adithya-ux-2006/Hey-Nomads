import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { put } from '@vercel/blob';

const { Pool } = pg;
const JWT_SECRET = process.env.JWT_SECRET || 'hey-nomads-jwt-change-me';

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function query(sql, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ── Health ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name.trim().slice(0, 100), normalizedEmail, hashed]
    );
    const user = result.rows[0];
    await query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    await query('INSERT INTO preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    const token = signToken(user.id);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await query('SELECT id, name, email, password FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, age, moving_to, moving_date, university, country,
              verification_status, onboarding_complete, looking_for, created_at
       FROM users WHERE id = $1`, [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ══════════════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════════════

app.post('/api/onboarding', authMiddleware, async (req, res) => {
  try {
    const { looking_for, moving_to, moving_date, country, city, interests } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (looking_for) { updates.push(`looking_for = $${idx++}`); params.push(looking_for); }
    if (moving_to) { updates.push(`moving_to = $${idx++}`); params.push(moving_to); }
    if (moving_date) { updates.push(`moving_date = $${idx++}`); params.push(moving_date); }
    if (country) { updates.push(`country = $${idx++}`); params.push(country); }
    if (interests && Array.isArray(interests)) {
      updates.push(`interests = $${idx++}`); params.push(interests);
    }

    if (updates.length > 0) {
      params.push(req.userId);
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    }

    // Update profile with city
    if (city) {
      await query('UPDATE profiles SET city = $1 WHERE user_id = $2', [city, req.userId]);
    }

    // Mark onboarding complete
    await query('UPDATE users SET onboarding_complete = TRUE WHERE id = $1', [req.userId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Failed to save onboarding' });
  }
});

// ══════════════════════════════════════════════════════════════
// PROFILES
// ══════════════════════════════════════════════════════════════

app.get('/api/profile/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await query(
      `SELECT u.id, u.name, u.email, u.age, u.moving_to, u.moving_date,
              u.university, u.country, u.interests, u.verification_status,
              u.looking_for, u.created_at,
              p.bio, p.occupation, p.city, p.profile_image, p.move_in_date,
              p.sleep_time, p.cleanliness, p.diet, p.noise_tolerance, p.noise_level,
              p.budget, p.deposit, p.flat_type, p.occupants,
              p.smoking, p.drinking, p.partying, p.social_level, p.pets,
              p.work_schedule, p.neighbourhood, p.preferred_neighbourhood, p.gender,
              pref.preferred_gender, pref.preferred_budget_min, pref.preferred_budget_max,
              pref.preferred_location_radius, pref.prefers_smoking, pref.prefers_drinking,
              pref.prefers_cleanliness_min, pref.prefers_sleep_schedule,
              pref.prefers_same_diet, pref.prefers_same_sleep
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       LEFT JOIN preferences pref ON u.id = pref.user_id
       WHERE u.id = $1`, [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const profile = result.rows[0];
    const langs = await query(
      `SELECT l.id, l.name FROM languages l
       JOIN user_languages ul ON l.id = ul.language_id
       WHERE ul.user_id = $1`, [userId]
    );
    profile.languages = langs.rows;
    res.json(profile);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.post('/api/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      bio, occupation, city, moveInDate,
      sleepTime, cleanliness, diet, noiseTolerance, noiseLevel,
      budget, deposit, flatType, occupants,
      smoking, drinking, partying,
      profileImage, languages,
      preferredGender, preferredBudgetMin, preferredBudgetMax,
      preferredLocationRadius, prefersSmoking, prefersDrinking,
      prefersCleanlinessMin, prefersSleepSchedule,
      prefersSameDiet, prefersSameSleep,
      socialLevel, pets, workSchedule,
      neighbourhood, preferredNeighbourhood, gender,
      age, movingTo, movingDate, university, country, interests
    } = req.body;

    const safeStr = v => v == null ? '' : String(v).trim();
    const safeInt = (v, d) => { const n = parseInt(v); return isNaN(n) ? d : n; };
    const safeDate = v => (!v || v === 'null') ? null : v;

    // Update user-level fields
    const userUpdates = [];
    const userParams = [];
    let idx = 1;
    if (age !== undefined) { userUpdates.push(`age = $${idx++}`); userParams.push(safeInt(age, null)); }
    if (movingTo !== undefined) { userUpdates.push(`moving_to = $${idx++}`); userParams.push(safeStr(movingTo)); }
    if (movingDate !== undefined) { userUpdates.push(`moving_date = $${idx++}`); userParams.push(safeDate(movingDate)); }
    if (university !== undefined) { userUpdates.push(`university = $${idx++}`); userParams.push(safeStr(university)); }
    if (country !== undefined) { userUpdates.push(`country = $${idx++}`); userParams.push(safeStr(country)); }
    if (interests && Array.isArray(interests)) { userUpdates.push(`interests = $${idx++}`); userParams.push(interests); }
    if (userUpdates.length > 0) {
      userParams.push(userId);
      await query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${idx}`, userParams);
    }

    const existing = await query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) {
      await query(
        `UPDATE profiles SET bio=$1, occupation=$2, city=$3, move_in_date=$4,
         sleep_time=$5, cleanliness=$6, diet=$7, noise_tolerance=$8, noise_level=$9,
         budget=$10, deposit=$11, flat_type=$12, occupants=$13,
         smoking=$14, drinking=$15, partying=$16, profile_image=COALESCE($17, profile_image),
         social_level=$18, pets=$19, work_schedule=$20, neighbourhood=$21,
         preferred_neighbourhood=$22, gender=$23
         WHERE user_id=$24`,
        [safeStr(bio), safeStr(occupation), safeStr(city), safeDate(moveInDate),
         safeStr(sleepTime)||'flexible', safeInt(cleanliness,3), safeStr(diet)||'veg',
         safeStr(noiseTolerance)||'moderate', safeInt(noiseLevel,3),
         safeInt(budget,15000), safeInt(deposit,5000), safeStr(flatType)||'shared',
         safeInt(occupants,1), safeStr(smoking)||'no', safeStr(drinking)||'no',
         safeStr(partying)||'low', profileImage||null,
         safeStr(socialLevel)||'moderate', safeStr(pets)||'no',
         safeStr(workSchedule)||'regular', safeStr(neighbourhood),
         safeStr(preferredNeighbourhood), safeStr(gender), userId]
      );
    } else {
      await query(
        `INSERT INTO profiles (user_id, bio, occupation, city, move_in_date,
         sleep_time, cleanliness, diet, noise_tolerance, noise_level,
         budget, deposit, flat_type, occupants, smoking, drinking, partying, profile_image,
         social_level, pets, work_schedule, neighbourhood, preferred_neighbourhood, gender)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
        [userId, safeStr(bio), safeStr(occupation), safeStr(city), safeDate(moveInDate),
         safeStr(sleepTime)||'flexible', safeInt(cleanliness,3), safeStr(diet)||'veg',
         safeStr(noiseTolerance)||'moderate', safeInt(noiseLevel,3),
         safeInt(budget,15000), safeInt(deposit,5000), safeStr(flatType)||'shared',
         safeInt(occupants,1), safeStr(smoking)||'no', safeStr(drinking)||'no',
         safeStr(partying)||'low', profileImage||'',
         safeStr(socialLevel)||'moderate', safeStr(pets)||'no',
         safeStr(workSchedule)||'regular', safeStr(neighbourhood),
         safeStr(preferredNeighbourhood), safeStr(gender)]
      );
    }

    // Preferences
    await query(
      `UPDATE preferences SET preferred_gender=$1, preferred_budget_min=$2, preferred_budget_max=$3,
       preferred_location_radius=$4, prefers_smoking=$5, prefers_drinking=$6,
       prefers_cleanliness_min=$7, prefers_sleep_schedule=$8,
       prefers_same_diet=$9, prefers_same_sleep=$10
       WHERE user_id=$11`,
      [safeStr(preferredGender)||null, parseInt(preferredBudgetMin)||null, parseInt(preferredBudgetMax)||null,
       parseInt(preferredLocationRadius)||10, safeStr(prefersSmoking)||'no_preference',
       safeStr(prefersDrinking)||'no_preference', parseInt(prefersCleanlinessMin)||1,
       safeStr(prefersSleepSchedule)||'no_preference',
       prefersSameDiet === true || prefersSameDiet === 'true',
       prefersSameSleep === true || prefersSameSleep === 'true', userId]
    );

    // Languages
    await query('DELETE FROM user_languages WHERE user_id = $1', [userId]);
    if (Array.isArray(languages)) {
      for (const langId of languages) {
        if (langId) {
          await query('INSERT INTO user_languages (user_id, language_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, parseInt(langId)]);
        }
      }
    }

    res.json({ message: 'Profile saved' });
  } catch (err) {
    console.error('Save profile error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// ══════════════════════════════════════════════════════════════
// LANGUAGES
// ══════════════════════════════════════════════════════════════

app.get('/api/languages', authMiddleware, async (_req, res) => {
  try {
    const result = await query('SELECT id, name FROM languages ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get languages' });
  }
});

// ══════════════════════════════════════════════════════════════
// IMAGE UPLOAD
// ══════════════════════════════════════════════════════════════

app.post('/api/upload', authMiddleware, async (req, res) => {
  try {
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const buffer = Buffer.concat(chunks);
    const ct = req.headers['content-type'] || '';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const filename = `${req.userId}-${Date.now()}.${ext}`;
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: ct.split(';')[0] || 'image/jpeg',
    });
    res.json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ══════════════════════════════════════════════════════════════
// MATCHING ENGINE
// ══════════════════════════════════════════════════════════════

async function getMatchWeights() {
  const result = await query('SELECT * FROM match_weights ORDER BY id LIMIT 1');
  return result.rows[0] || { lifestyle_weight: 0.25, budget_weight: 0.20, location_weight: 0.20, movein_weight: 0.15, interests_weight: 0.10, habits_weight: 0.10 };
}

async function calcCompatibility(userId, candidateId, weights) {
  // Fetch both profiles
  const [meResult, themResult, meLangs, themLangs] = await Promise.all([
    query(`SELECT u.interests, p.* FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = $1`, [userId]),
    query(`SELECT u.interests, p.* FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = $1`, [candidateId]),
    query(`SELECT l.name FROM languages l JOIN user_languages ul ON l.id = ul.language_id WHERE ul.user_id = $1`, [userId]),
    query(`SELECT l.name FROM languages l JOIN user_languages ul ON l.id = ul.language_id WHERE ul.user_id = $1`, [candidateId]),
  ]);

  const me = meResult.rows[0];
  const them = themResult.rows[0];
  if (!me || !them) return { score: 0, breakdown: {}, reasons: [] };

  const reasons = [];
  const breakdown = {};

  // Lifestyle (sleep, cleanliness, smoking, drinking, social, diet, noise)
  let lifestyleScore = 0;
  const lifestyleMax = 25;

  if (me.sleep_time && them.sleep_time) {
    if (me.sleep_time === them.sleep_time) { lifestyleScore += 4; reasons.push({ text: 'Same sleep schedule', type: 'positive' }); }
    else if (me.sleep_time === 'flexible' || them.sleep_time === 'flexible') { lifestyleScore += 2; }
  }
  if (me.cleanliness && them.cleanliness) {
    const cdiff = Math.abs(me.cleanliness - them.cleanliness);
    lifestyleScore += Math.round(4 * (1 - cdiff / 4));
    if (cdiff <= 1) reasons.push({ text: 'Similar cleanliness preference', type: 'positive' });
  }
  if (me.smoking === them.smoking) { lifestyleScore += 3; if (me.smoking === 'no') reasons.push({ text: 'Both non-smokers', type: 'positive' }); }
  else if (me.smoking === 'no' && them.smoking === 'no') { lifestyleScore += 3; }
  if (me.drinking === them.drinking) { lifestyleScore += 3; if (me.drinking === 'no') reasons.push({ text: 'Same drinking habits', type: 'positive' }); }
  else if (me.drinking === 'no' && them.drinking === 'no') { lifestyleScore += 3; }
  if (me.social_level && them.social_level) {
    const socialMap = { introvert: 1, moderate: 2, extrovert: 3 };
    const sdiff = Math.abs((socialMap[me.social_level]||2) - (socialMap[them.social_level]||2));
    lifestyleScore += Math.round(3 * (1 - sdiff / 2));
    if (sdiff === 0) reasons.push({ text: 'Similar social energy', type: 'positive' });
  }
  if (me.diet && them.diet) {
    if (me.diet === them.diet) { lifestyleScore += 4; reasons.push({ text: `Both ${me.diet} eaters`, type: 'positive' }); }
    else if ((me.diet === 'veg' && them.diet === 'eggetarian') || (me.diet === 'eggetarian' && them.diet === 'veg')) { lifestyleScore += 3; }
  }
  if (me.noise_tolerance && them.noise_tolerance) {
    if (me.noise_tolerance === them.noise_tolerance) { lifestyleScore += 4; reasons.push({ text: 'Same noise tolerance', type: 'positive' }); }
    else { lifestyleScore += 1; }
  }
  breakdown.lifestyle = Math.min(lifestyleMax, lifestyleScore);

  // Budget
  let budgetScore = 0;
  const bA = parseInt(me.budget) || 0, bB = parseInt(them.budget) || 0;
  const maxB = Math.max(bA, bB);
  if (maxB > 0) {
    budgetScore = Math.round(20 * (1 - Math.abs(bA - bB) / maxB));
    if (Math.abs(bA - bB) < maxB * 0.2) reasons.push({ text: 'Similar budget range', type: 'positive' });
  } else { budgetScore = 10; }
  breakdown.budget = budgetScore;

  // Location (city + neighbourhood)
  let locationScore = 0;
  const cityA = (me.city||'').toLowerCase(), cityB = (them.city||'').toLowerCase();
  const movingA = (me.moving_to||'').toLowerCase(), movingB = (them.moving_to||'').toLowerCase();
  if (cityA && cityB && cityA === cityB) { locationScore += 12; reasons.push({ text: 'Same city', type: 'positive' }); }
  else if (movingA && movingB && movingA === movingB) { locationScore += 10; reasons.push({ text: 'Both moving to the same city', type: 'positive' }); }
  else if (cityA && movingB && cityA === movingB) { locationScore += 8; }
  else if (movingA && cityB && movingA === cityB) { locationScore += 8; }

  const nA = (me.preferred_neighbourhood||'').toLowerCase(), nB = (them.neighbourhood||'').toLowerCase();
  const nC = (them.preferred_neighbourhood||'').toLowerCase(), nD = (me.neighbourhood||'').toLowerCase();
  if ((nA && nB && nA === nB) || (nC && nD && nC === nD) || (nA && nC && nA === nC)) {
    locationScore += 8; reasons.push({ text: 'Preferred neighbourhoods align', type: 'positive' });
  }
  breakdown.location = Math.min(20, locationScore);

  // Move-in date
  let moveinScore = 0;
  if (me.move_in_date && them.move_in_date) {
    const diffDays = Math.abs(new Date(me.move_in_date) - new Date(them.move_in_date)) / (1000 * 60 * 60 * 24);
    if (diffDays <= 14) { moveinScore = 15; reasons.push({ text: 'Moving in around the same time', type: 'positive' }); }
    else if (diffDays <= 30) { moveinScore = 10; }
    else if (diffDays <= 60) { moveinScore = 5; }
    else { moveinScore = 2; }
  } else { moveinScore = 7; }
  breakdown.movein = moveinScore;

  // Interests
  let interestsScore = 0;
  const myInterests = me.interests || [];
  const theirInterests = them.interests || [];
  if (myInterests.length > 0 && theirInterests.length > 0) {
    const shared = myInterests.filter(i => theirInterests.includes(i));
    interestsScore = Math.min(10, shared.length * 2);
    if (shared.length >= 3) reasons.push({ text: `${shared.length} shared interests`, type: 'positive' });
    else if (shared.length >= 1) reasons.push({ text: `${shared.length} shared interest`, type: 'positive' });
  }
  breakdown.interests = interestsScore;

  // Habits (flat_type, occupants, pets, work_schedule)
  let habitsScore = 0;
  if (me.flat_type && them.flat_type && me.flat_type === them.flat_type) { habitsScore += 3; reasons.push({ text: 'Same housing preference', type: 'positive' }); }
  if (me.pets && them.pets) {
    if (me.pets === them.pets) habitsScore += 2;
    else if (them.pets === 'okay' || me.pets === 'okay') habitsScore += 2;
  }
  if (me.work_schedule && them.work_schedule && me.work_schedule === them.work_schedule) { habitsScore += 3; reasons.push({ text: 'Same work schedule', type: 'positive' }); }
  if (me.languages && them.languages) {
    const myLangs = (meLangs.rows||[]).map(l => l.name);
    const theirLangs = (themLangs.rows||[]).map(l => l.name);
    const sharedLangs = myLangs.filter(l => theirLangs.includes(l));
    if (sharedLangs.length > 0) { habitsScore += 2; reasons.push({ text: `Share ${sharedLangs.join(', ')}`, type: 'positive' }); }
  }
  breakdown.habits = Math.min(10, habitsScore);

  // Total
  const total = Math.min(100, Math.round(
    breakdown.lifestyle * (weights.lifestyle_weight / 0.25) * 0.25 +
    breakdown.budget * (weights.budget_weight / 0.20) * 0.20 +
    breakdown.location * (weights.location_weight / 0.20) * 0.20 +
    breakdown.movein * (weights.movein_weight / 0.15) * 0.15 +
    breakdown.interests * (weights.interests_weight / 0.10) * 0.10 +
    breakdown.habits * (weights.habits_weight / 0.10) * 0.10
  ));

  return { score: total, breakdown, reasons };
}

// ── Roommates / Discovery ──────────────────────────────────────

app.get('/api/roommates/recommended', authMiddleware, async (req, res) => {
  try {
    const { city, budget_min, budget_max, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const weights = await getMatchWeights();

    // Get blocked users
    const blocked = await query(
      `SELECT blocked_id FROM blocks WHERE blocker_id = $1
       UNION
       SELECT blocker_id FROM blocks WHERE blocked_id = $1`, [req.userId]
    );
    const blockedIds = blocked.rows.map(r => r.blocked_id);

    let where = 'WHERE u.id != $1';
    const params = [req.userId];
    let idx = 2;

    if (blockedIds.length > 0) {
      where += ` AND u.id NOT IN (${blockedIds.map(() => `$${idx++}`).join(',')})`;
      params.push(...blockedIds);
    }

    if (city) { where += ` AND LOWER(p.city) LIKE LOWER($${idx++})`; params.push(`%${city}%`); }
    if (budget_min) { where += ` AND p.budget >= $${idx++}`; params.push(parseInt(budget_min)); }
    if (budget_max) { where += ` AND p.budget <= $${idx++}`; params.push(parseInt(budget_max)); }

    // Check which users this person already swiped on
    const swipedIds = await query('SELECT swiped_id FROM swipes WHERE swiper_id = $1', [req.userId]);
    const swipedSet = new Set(swipedIds.rows.map(r => r.swiped_id));

    const candidates = await query(
      `SELECT u.id, u.name, u.age, u.interests, u.moving_to, u.country,
              p.bio, p.occupation, p.city, p.profile_image, p.budget, p.deposit,
              p.flat_type, p.sleep_time, p.cleanliness, p.diet, p.smoking, p.drinking,
              p.noise_tolerance, p.social_level, p.pets, p.work_schedule,
              p.neighbourhood, p.preferred_neighbourhood, p.gender,
              p.move_in_date, p.occupants, p.partying
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    // Score candidates
    const results = [];
    for (const c of candidates.rows) {
      if (swipedSet.has(c.id)) continue;
      const { score, breakdown, reasons } = await calcCompatibility(req.userId, c.id, weights);
      results.push({ ...c, score, breakdown, reasons });
    }

    results.sort((a, b) => b.score - a.score);
    res.json(results.slice(0, parseInt(limit)));
  } catch (err) {
    console.error('Get roommates error:', err);
    res.status(500).json({ error: 'Failed to get roommates' });
  }
});

app.get('/api/roommates/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const weights = await getMatchWeights();
    const result = await query(
      `SELECT u.id, u.name, u.age, u.interests, u.moving_to, u.country, u.university,
              u.verification_status, u.created_at,
              p.bio, p.occupation, p.city, p.profile_image, p.budget, p.deposit,
              p.flat_type, p.sleep_time, p.cleanliness, p.diet, p.smoking, p.drinking,
              p.noise_tolerance, p.social_level, p.pets, p.work_schedule,
              p.neighbourhood, p.preferred_neighbourhood, p.gender,
              p.move_in_date, p.occupants, p.partying, p.noise_level
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`, [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const profile = result.rows[0];
    const langs = await query(
      `SELECT l.id, l.name FROM languages l JOIN user_languages ul ON l.id = ul.language_id WHERE ul.user_id = $1`, [userId]
    );
    profile.languages = langs.rows;

    const { score, breakdown, reasons } = await calcCompatibility(req.userId, userId, weights);
    profile.score = score;
    profile.breakdown = breakdown;
    profile.reasons = reasons;

    res.json(profile);
  } catch (err) {
    console.error('Get roommate profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ── Swipe (like / pass) ───────────────────────────────────────

app.post('/api/swipe', authMiddleware, async (req, res) => {
  try {
    const { targetId, action } = req.body;
    if (!targetId || !['like', 'pass'].includes(action)) {
      return res.status(400).json({ error: 'targetId and valid action required' });
    }
    if (targetId === req.userId) {
      return res.status(400).json({ error: 'Cannot swipe on yourself' });
    }

    // Check target exists
    const target = await query('SELECT id FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Upsert swipe
    await query(
      `INSERT INTO swipes (swiper_id, swiped_id, action) VALUES ($1, $2, $3)
       ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET action = $3, created_at = CURRENT_TIMESTAMP`,
      [req.userId, targetId, action]
    );

    // Check for mutual like
    let matchCreated = false;
    if (action === 'like') {
      const mutual = await query(
        `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'`,
        [targetId, req.userId]
      );
      if (mutual.rows.length > 0) {
        // Create match
        const ua = Math.min(req.userId, targetId);
        const ub = Math.max(req.userId, targetId);
        const weights = await getMatchWeights();
        const { score } = await calcCompatibility(req.userId, targetId, weights);

        const existingMatch = await query(
          'SELECT id FROM matches WHERE user_a_id = $1 AND user_b_id = $2', [ua, ub]
        );
        if (existingMatch.rows.length === 0) {
          await query(
            'INSERT INTO matches (user_a_id, user_b_id, compatibility_score, status) VALUES ($1, $2, $3, $4)',
            [ua, ub, score, 'matched']
          );

          // Create conversation
          const conv = await query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
          const convId = conv.rows[0].id;
          await query('INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)', [convId, ua, ub]);

          matchCreated = true;
        }
      }
    }

    res.json({ ok: true, matchCreated });
  } catch (err) {
    console.error('Swipe error:', err);
    res.status(500).json({ error: 'Failed to process swipe' });
  }
});

// ── Matches ────────────────────────────────────────────────────

app.get('/api/matches', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*,
              CASE WHEN m.user_a_id = $1 THEN m.user_b_id ELSE m.user_a_id END AS partner_id,
              u.name AS partner_name,
              p.profile_image AS partner_image,
              p.city AS partner_city,
              p.occupation AS partner_occupation,
              p.bio AS partner_bio
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.user_a_id = $1 THEN m.user_b_id ELSE m.user_a_id END
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE (m.user_a_id = $1 OR m.user_b_id = $1) AND m.status = 'matched'
       ORDER BY m.updated_at DESC`, [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

app.delete('/api/matches/:matchId', authMiddleware, async (req, res) => {
  try {
    const { matchId } = req.params;
    await query(
      `UPDATE matches SET status = 'unmatched' WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
      [matchId, req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unmatch' });
  }
});

// ══════════════════════════════════════════════════════════════
// MESSAGING
// ══════════════════════════════════════════════════════════════

app.get('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id AS conversation_id, c.updated_at AS last_message_time,
              cm2.user_id AS partner_id,
              u.name AS partner_name,
              p.profile_image AS partner_image,
              p.city AS partner_city,
              m.content AS last_message,
              m.sender_id = $1 AS last_message_from_me,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND read_at IS NULL) AS unread_count
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id != $1
       JOIN users u ON u.id = cm2.user_id
       LEFT JOIN profiles p ON p.user_id = cm2.user_id
       LEFT JOIN messages m ON m.conversation_id = c.id AND m.created_at = c.updated_at
       ORDER BY c.updated_at DESC`, [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

app.get('/api/conversations/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const convResult = await query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2`,
      [req.userId, otherUserId]
    );
    if (convResult.rows.length === 0) return res.json([]);

    const messages = await query(
      `SELECT m.id, m.sender_id, m.content, m.read_at, m.created_at,
              u.name AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [convResult.rows[0].id]
    );
    res.json(messages.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

app.post('/api/conversations/:otherUserId/read', authMiddleware, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const convResult = await query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2`,
      [req.userId, otherUserId]
    );
    if (convResult.rows.length === 0) return res.json({ ok: true });

    await query(
      `UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE conversation_id = $1 AND sender_id = $2 AND read_at IS NULL`,
      [convResult.rows[0].id, otherUserId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

app.post('/api/messages', authMiddleware, async (req, res) => {
  try {
    const { receiver_id, message } = req.body;
    if (!receiver_id || !message?.trim()) {
      return res.status(400).json({ error: 'receiver_id and message required' });
    }

    // Check or create conversation
    let convResult = await query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2`,
      [req.userId, receiver_id]
    );

    let convId;
    if (convResult.rows.length === 0) {
      // Check they are matched
      const match = await query(
        `SELECT id FROM matches WHERE status = 'matched' AND
         ((user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1))`,
        [req.userId, receiver_id]
      );
      if (match.rows.length === 0) {
        return res.status(403).json({ error: 'You can only message matched users' });
      }
      const conv = await query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
      convId = conv.rows[0].id;
      await query('INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)', [convId, req.userId, receiver_id]);
    } else {
      convId = convResult.rows[0].id;
    }

    const result = await query(
      'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, content, created_at',
      [convId, req.userId, message.trim()]
    );

    await query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [convId]);

    res.status(201).json({ id: result.rows[0].id, content: result.rows[0].content, created_at: result.rows[0].created_at });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ══════════════════════════════════════════════════════════════
// SHORTLIST (kept for backwards compat)
// ══════════════════════════════════════════════════════════════

app.get('/api/shortlist', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.age, p.profile_image, p.city, p.budget, p.move_in_date, p.occupation
       FROM users u
       JOIN shortlists s ON u.id = s.target_id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`, [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get shortlist' });
  }
});

app.post('/api/shortlist', authMiddleware, async (req, res) => {
  try {
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'targetId required' });
    await query('INSERT INTO shortlists (user_id, target_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.userId, targetId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to shortlist' });
  }
});

app.delete('/api/shortlist', authMiddleware, async (req, res) => {
  try {
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'targetId required' });
    await query('DELETE FROM shortlists WHERE user_id = $1 AND target_id = $2', [req.userId, targetId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from shortlist' });
  }
});

// ══════════════════════════════════════════════════════════════
// COMMUNITIES
// ══════════════════════════════════════════════════════════════

app.get('/api/communities', authMiddleware, async (req, res) => {
  try {
    const { city, category, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (city) { where += ` AND LOWER(c.city) LIKE LOWER($${idx++})`; params.push(`%${city}%`); }
    if (category) { where += ` AND LOWER(c.category) = LOWER($${idx++})`; params.push(category); }

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT c.*, u.name AS creator_name,
              EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $${idx}) AS is_member
       FROM communities c
       JOIN users u ON u.id = c.creator_id
       ${where}
       ORDER BY c.member_count DESC, c.created_at DESC
       LIMIT $${idx+1} OFFSET $${idx+2}`,
      [...params, req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get communities error:', err);
    res.status(500).json({ error: 'Failed to get communities' });
  }
});

app.get('/api/communities/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT c.*, u.name AS creator_name,
              EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $2) AS is_member
       FROM communities c
       JOIN users u ON u.id = c.creator_id
       WHERE c.id = $1`, [id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Community not found' });

    const members = await query(
      `SELECT u.id, u.name, p.profile_image, cm.role, cm.joined_at
       FROM community_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE cm.community_id = $1
       ORDER BY cm.joined_at ASC`, [id]
    );

    const events = await query(
      `SELECT * FROM events WHERE community_id = $1 ORDER BY start_time ASC LIMIT 5`, [id]
    );

    res.json({ ...result.rows[0], members: members.rows, events: events.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get community' });
  }
});

app.post('/api/communities', authMiddleware, async (req, res) => {
  try {
    const { name, description, image, city, country, category } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const result = await query(
      `INSERT INTO communities (name, description, image, city, country, category, creator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name.trim(), description || '', image || null, city || null, country || null, category || 'general', req.userId]
    );
    const community = result.rows[0];

    await query(
      'INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, $3)',
      [community.id, req.userId, 'creator']
    );

    res.status(201).json(community);
  } catch (err) {
    console.error('Create community error:', err);
    res.status(500).json({ error: 'Failed to create community' });
  }
});

app.post('/api/communities/:id/join', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, req.userId]
    );
    await query('UPDATE communities SET member_count = member_count + 1 WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join community' });
  }
});

app.post('/api/communities/:id/leave', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      'DELETE FROM community_members WHERE community_id = $1 AND user_id = $2 AND role != $3',
      [id, req.userId, 'creator']
    );
    await query('UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave community' });
  }
});

// ══════════════════════════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════════════════════════

app.get('/api/events', authMiddleware, async (req, res) => {
  try {
    const { city, community_id, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    let where = 'WHERE e.start_time > CURRENT_TIMESTAMP';
    const params = [];
    let idx = 1;

    if (city) { where += ` AND LOWER(e.city) LIKE LOWER($${idx++})`; params.push(`%${city}%`); }
    if (community_id) { where += ` AND e.community_id = $${idx++}`; params.push(parseInt(community_id)); }

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT e.*, u.name AS creator_name, c.name AS community_name,
              EXISTS(SELECT 1 FROM event_rsvps WHERE event_id = e.id AND user_id = $${idx}) AS is_rsvped,
              (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND status = 'going') AS going_count
       FROM events e
       JOIN users u ON u.id = e.created_by
       LEFT JOIN communities c ON c.id = e.community_id
       ${where}
       ORDER BY e.start_time ASC
       LIMIT $${idx+1} OFFSET $${idx+2}`,
      [...params, req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

app.post('/api/events', authMiddleware, async (req, res) => {
  try {
    const { title, description, community_id, location, city, start_time, end_time, capacity } = req.body;
    if (!title || !start_time) return res.status(400).json({ error: 'Title and start time required' });

    const result = await query(
      `INSERT INTO events (title, description, community_id, location, city, start_time, end_time, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title.trim(), description || '', community_id || null, location || '', city || null, start_time, end_time || null, capacity || null, req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.post('/api/events/:id/rsvp', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await query(
      `INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET status = $3`,
      [id, req.userId, status || 'going']
    );
    await query(
      `UPDATE events SET attendee_count = (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND status = 'going') WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

app.delete('/api/events/:id/rsvp', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2', [id, req.userId]);
    await query(
      `UPDATE events SET attendee_count = (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND status = 'going') WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel RSVP' });
  }
});

app.get('/api/events/:id/attendees', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT u.id, u.name, p.profile_image, er.status, er.created_at AS rsvped_at
       FROM event_rsvps er
       JOIN users u ON u.id = er.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE er.event_id = $1 AND er.status = 'going'
       ORDER BY er.created_at ASC`, [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get attendees' });
  }
});

// ══════════════════════════════════════════════════════════════
// CITIES
// ══════════════════════════════════════════════════════════════

app.get('/api/cities', authMiddleware, async (req, res) => {
  try {
    const { country, search } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (country) { where += ` AND LOWER(country) = LOWER($${idx++})`; params.push(country); }
    if (search) { where += ` AND LOWER(name) LIKE LOWER($${idx++})`; params.push(`%${search}%`); }

    const result = await query(
      `SELECT c.*, (SELECT COUNT(*) FROM users WHERE LOWER(moving_to) = LOWER(c.name) OR LOWER(city) = LOWER(c.name)) AS people_count
       FROM cities c ${where} ORDER BY c.name`, params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get cities' });
  }
});

app.get('/api/cities/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM cities WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'City not found' });

    const city = result.rows[0];
    const [people, communities, events] = await Promise.all([
      query(`SELECT COUNT(*) FROM users WHERE LOWER(moving_to) = LOWER($1) OR LOWER(city) = LOWER($1)`, [city.name]),
      query(`SELECT * FROM communities WHERE LOWER(city) = LOWER($1) ORDER BY member_count DESC LIMIT 5`, [city.name]),
      query(`SELECT * FROM events WHERE LOWER(city) = LOWER($1) AND start_time > CURRENT_TIMESTAMP ORDER BY start_time ASC LIMIT 5`, [city.name]),
    ]);

    res.json({
      ...city,
      people_count: parseInt(people.rows[0].count),
      communities: communities.rows,
      upcoming_events: events.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get city' });
  }
});

// ══════════════════════════════════════════════════════════════
// RESOURCES (Settle In)
// ══════════════════════════════════════════════════════════════

app.get('/api/resources', authMiddleware, async (req, res) => {
  try {
    const { category, city, country } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (category) { where += ` AND LOWER(category) = LOWER($${idx++})`; params.push(category); }
    if (city) { where += ` AND (LOWER(city) = LOWER($${idx++}) OR city IS NULL)`; params.push(city); idx++; }
    if (country) { where += ` AND (LOWER(country) = LOWER($${idx++}) OR country IS NULL)`; params.push(country); }

    const result = await query(`SELECT * FROM resources ${where} ORDER BY category, title`, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get resources' });
  }
});

// ══════════════════════════════════════════════════════════════
// SETTLEMENT CHECKLIST
// ══════════════════════════════════════════════════════════════

app.get('/api/settlement', authMiddleware, async (req, res) => {
  try {
    // Ensure user has entries for all tasks
    await query(
      `INSERT INTO user_settlement_tasks (user_id, task_id, completed)
       SELECT $1, st.id, FALSE FROM settlement_tasks st
       ON CONFLICT (user_id, task_id) DO NOTHING`, [req.userId]
    );

    const result = await query(
      `SELECT st.id, st.title, st.description, st.category, st."order",
              COALESCE(ust.completed, FALSE) AS completed, ust.completed_at
       FROM settlement_tasks st
       LEFT JOIN user_settlement_tasks ust ON ust.task_id = st.id AND ust.user_id = $1
       ORDER BY st."order" ASC`, [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get settlement error:', err);
    res.status(500).json({ error: 'Failed to get settlement tasks' });
  }
});

app.post('/api/settlement/:taskId/complete', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    await query(
      `INSERT INTO user_settlement_tasks (user_id, task_id, completed, completed_at)
       VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, task_id) DO UPDATE SET completed = TRUE, completed_at = CURRENT_TIMESTAMP`,
      [req.userId, taskId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.post('/api/settlement/:taskId/uncomplete', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    await query(
      `UPDATE user_settlement_tasks SET completed = FALSE, completed_at = NULL WHERE user_id = $1 AND task_id = $2`,
      [req.userId, taskId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ══════════════════════════════════════════════════════════════
// BLOCKS & REPORTS
// ══════════════════════════════════════════════════════════════

app.post('/api/block', authMiddleware, async (req, res) => {
  try {
    const { targetId } = req.body;
    if (!targetId || targetId === req.userId) return res.status(400).json({ error: 'Invalid target' });
    await query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.userId, targetId]);
    // Remove any match
    await query(
      `UPDATE matches SET status = 'blocked' WHERE status = 'matched' AND
       ((user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1))`,
      [req.userId, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

app.post('/api/report', authMiddleware, async (req, res) => {
  try {
    const { reported_user_id, reported_community_id, reported_message_id, type, reason, description } = req.body;
    if (!type || !reason) return res.status(400).json({ error: 'Type and reason required' });
    await query(
      `INSERT INTO reports (reporter_id, reported_user_id, reported_community_id, reported_message_id, type, reason, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.userId, reported_user_id || null, reported_community_id || null, reported_message_id || null, type, reason, description || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ══════════════════════════════════════════════════════════════
// DISCOVER (composite endpoint)
// ══════════════════════════════════════════════════════════════

app.get('/api/discover', authMiddleware, async (req, res) => {
  try {
    const user = await query(
      `SELECT id, name, moving_to, city, onboarding_complete FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = $1`, [req.userId]
    );
    const targetCity = user.rows[0]?.moving_to || user.rows[0]?.city;

    const [roommates, communities, events, cities, settlement] = await Promise.all([
      // Top 5 recommended roommates
      query(
        `SELECT u.id, u.name, u.age, p.profile_image, p.city, p.budget, p.occupation, p.bio
         FROM users u LEFT JOIN profiles p ON u.id = p.user_id
         WHERE u.id != $1 ORDER BY RANDOM() LIMIT 5`, [req.userId]
      ),
      // Top communities (optionally filtered by city)
      targetCity
        ? query(`SELECT * FROM communities WHERE LOWER(city) LIKE LOWER($1) ORDER BY member_count DESC LIMIT 5`, [`%${targetCity}%`])
        : query(`SELECT * FROM communities ORDER BY member_count DESC LIMIT 5`),
      // Upcoming events
      targetCity
        ? query(`SELECT * FROM events WHERE LOWER(city) LIKE LOWER($1) AND start_time > CURRENT_TIMESTAMP ORDER BY start_time ASC LIMIT 5`, [`%${targetCity}%`])
        : query(`SELECT * FROM events WHERE start_time > CURRENT_TIMESTAMP ORDER BY start_time ASC LIMIT 5`),
      // Cities
      query(`SELECT * FROM cities ORDER BY name LIMIT 10`),
      // Settlement progress
      query(
        `SELECT st.id, st.title, st."order",
                COALESCE(ust.completed, FALSE) AS completed
         FROM settlement_tasks st
         LEFT JOIN user_settlement_tasks ust ON ust.task_id = st.id AND ust.user_id = $1
         ORDER BY st."order" ASC`, [req.userId]
      ),
    ]);

    const settlementProgress = settlement.rows;
    const completedCount = settlementProgress.filter(t => t.completed).length;

    res.json({
      user: user.rows[0],
      roommates: roommates.rows,
      communities: communities.rows,
      events: events.rows,
      cities: cities.rows,
      settlement: { tasks: settlementProgress, completed: completedCount, total: settlementProgress.length },
    });
  } catch (err) {
    console.error('Discover error:', err);
    res.status(500).json({ error: 'Failed to load discover' });
  }
});

// ══════════════════════════════════════════════════════════════
// AGREEMENTS
// ══════════════════════════════════════════════════════════════

app.get('/api/agreement/:u1/:u2', authMiddleware, async (req, res) => {
  try {
    const { u1, u2 } = req.params;
    const existing = await query(
      `SELECT * FROM agreements WHERE (userA_id=$1 AND userB_id=$2) OR (userA_id=$2 AND userB_id=$1)`, [u1, u2]
    );
    if (existing.rows.length > 0) return res.json(existing.rows[0]);

    const profiles = await query(
      `SELECT u.id, u.name, p.budget, p.deposit, p.cleanliness, p.noise_tolerance
       FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.id IN ($1, $2)`, [u1, u2]
    );
    const p1 = profiles.rows.find(p => p.id == u1);
    const p2 = profiles.rows.find(p => p.id == u2);
    if (!p1 || !p2) return res.status(404).json({ error: 'Profiles not found' });

    const template = `ROOMMATE AGREEMENT\n\nThis agreement is entered into by ${p1.name} and ${p2.name}.\n\n1. RENT & DEPOSIT\n- Total Rent: Rs${p1.budget + p2.budget} (Split: ${p1.name} Rs${p1.budget}, ${p2.name} Rs${p2.budget})\n- Security Deposit: Rs${p1.deposit + p2.deposit}\n\n2. CLEANING SCHEDULE\n- Shared spaces cleaned weekly.\n- Cleanliness Priority: ${p1.cleanliness >= 4 ? 'High' : 'Moderate'}\n\n3. QUIET HOURS\n- Quiet hours: 10 PM to 7 AM.\n- Noise Tolerance: ${p1.noise_tolerance}\n\n4. GUEST POLICY\n- Guests allowed with 24h notice.\n\nSIGNED:\n____________________ (${p1.name})\n____________________ (${p2.name})`;
    res.json({ content: template, status: 'template' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get agreement' });
  }
});

app.post('/api/agreement', authMiddleware, async (req, res) => {
  try {
    const { userA_id, userB_id, content } = req.body;
    await query(
      `INSERT INTO agreements (userA_id, userB_id, content, status)
       VALUES ($1, $2, $3, 'draft')
       ON CONFLICT (userA_id, userB_id) DO UPDATE SET content = $3, status = 'draft'`,
      [userA_id, userB_id, content]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save agreement' });
  }
});

// ── Vercel Serverless Export ──────────────────────────────────
export default (req, res) => app(req, res);
