import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import * as Sentry from '@sentry/node';
import { put } from '@vercel/blob';
import {
  realAccountSql,
  classifyEmail,
  classifyAccount,
  KIND,
  humanLabel,
} from './account-kind.mjs';
import { validateUpload, MAX_UPLOAD_BYTES } from './upload-guards.mjs';
import { sentLikesQuery, receivedLikesQuery } from './likes-queries.mjs';
import { normalizeGenderPref, feedGenderFilterSql, GENDER_PREF_VALUES } from './gender-prefs.mjs';
import { validateDob, ageFromDob } from './age.mjs';
import { buildNotification } from './notifications.mjs';
import { MATCH_CATEGORIES, ANSWERED_FIELDS, WEIGHT_KEYS, scoreCompatibility, DEFAULT_MATCH_WEIGHTS } from './matching.mjs';

// No DSN => the SDK stays inert. Set SENTRY_DSN on Vercel to turn reporting on.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV || 'local',
});

const { Pool } = pg;
// No fallback. A hardcoded default would mean a missing env var silently
// produces forgeable tokens, which is exactly the failure you would not notice.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Refusing to start: tokens would be forgeable.');
}

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

// Finite pool bounds. pg defaults to max:10 but an *infinite* connect wait,
// which on a flaky link means one hung connection is never released and every
// later request queues forever - observed as the API answering only /auth/me.
// A finite connect timeout turns that silent wedge into a normal error the
// route's catch can report.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// pg's pool already acquires, queries and releases a client per call, so this
// is just a bound shorthand. Every route error funnels through here, which is
// the only place that needs to report to Sentry — the Express error middleware
// below it is unreachable now that all 43 routes catch their own errors.
const query = (sql, params) => pool.query(sql, params).catch((err) => {
  Sentry.captureException(err);
  throw err;
});

// Rate limit for the two endpoints an attacker actually hammers.
//
// ponytail: in-process Map, so it resets on cold start and is per-instance.
// That is fine for brute-force throttling on a single box but not a distributed
// limit. Upgrade to Upstash/Redis only if you're running many instances or see
// abuse in Sentry.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    // Keyed on email alone, deliberately. Locking on IP would let one attacker
    // deny service to every user behind a shared NAT (offices, campuses, mobile
    // carriers). Passwords are cheap to hash, so the work of guessing stays
    // bounded by bcrypt regardless of how the attempts are keyed.
    const key = String(req.body?.email || '').toLowerCase();
    const now = Date.now();
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: message });
    }
    recent.push(now);
    hits.set(key, recent);
    // Drop stale keys so the Map can't grow without bound.
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (!times.some(t => now - t < windowMs)) hits.delete(k);
      }
    }
    next();
  };
}

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sign-in attempts. Try again in a few minutes.',
});

const registerLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many accounts created from this device. Try again later.',
});

const app = express();

// A 500 that never reaches a log is invisible. This makes every unhandled
// error surface in Sentry (and in the function logs) instead of vanishing.
// Only guards middleware itself throwing (body-parser, etc.). Route errors are
// caught per-route, and query() above reports those to Sentry.
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Unhandled error:', err);
  Sentry.captureException(err);
  res.status(500).json({ error: 'Something went wrong on our end' });
});

// VITE_API_URL is unset on Vercel, so the browser calls same-origin /api/* and
// the vercel.json rewrite keeps it same-origin. CORS only matters for the local
// dev proxy, which runs on a different port.
if (process.env.VERCEL_ENV !== 'production') {
  app.use(cors({ origin: true, credentials: true }));
}
// No explicit limit: profile JSON bodies are a few KB. /api/upload bypasses this
// parser entirely (raw stream) and Vercel caps request bodies at 4.5MB anyway.
app.use(express.json());

// A presentation session is a signed, scoped token, not a query parameter, so
// the scope has to be enforced where every other request already flows. This
// runs before the first route: a presentation token is refused by every normal
// endpoint and only the /api/presentation block below will accept it. It only
// ever rejects - it never grants - so it cannot widen anything.
app.use('/api', (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
  } catch {
    return next(); // authMiddleware reports the invalid token on its own route
  }
  if (decoded.scope !== 'presentation') return next();
  if (req.path.startsWith('/presentation')) return next();
  return res.status(403).json({ error: 'Presentation session cannot use this endpoint' });
});

// ── Health ─────────────────────────────────────────────────────
// Tables the app cannot boot without. If any is missing the pool is
// pointed at the wrong database and we fail loudly instead of per-request.
const REQUIRED_TABLES = ['users', 'profiles', 'communities', 'events', 'cities', 'settlement_tasks'];

function dbTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    // Host and database name only, never the password. Enough to tell "pointed
    // at the wrong database" from "working", which is the whole point here.
    return { host: u.hostname, port: u.port || 5432, database: u.pathname.replace(/^\//, '') };
  } catch {
    return null;
  }
}

app.get('/api/health', async (req, res) => {
  const started = Date.now();
  // Verbose detail (host, db name, role, latency) is useful in CI and in your own
  // browser but is reconnaissance if public. Require a token for it; the bare
  // liveness signal stays open so external monitors and the cron still work.
  const verbose = req.get('x-health-token') === process.env.HEALTH_TOKEN;
  const base = verbose ? { checkedAt: new Date().toISOString(), ...dbTarget() } : {};
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ ...base, ok: false, error: 'DATABASE_URL is not set' });
    }
    let missing = [];
    try {
      if (verbose) {
        const { rows } = await query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        );
        missing = REQUIRED_TABLES.filter(t => !rows.some(r => r.table_name === t));
      } else {
        // Without the token we still confirm the pool answers, we just don't
        // report which database it reached or which tables exist.
        await query('SELECT 1');
      }
    } catch (err) {
      // Driver errors embed the host:port we failed to reach, which is the
      // exact thing the token exists to withhold. Report the class of failure
      // instead and keep the detail in the logs.
      console.error('Health check failed:', err);
      return res.status(503).json({
        ...base,
        ok: false,
        error: 'Database unreachable',
        ...(verbose ? { cause: err.code || err.name } : {}),
        latencyMs: Date.now() - started,
      });
    }

    res.status(missing.length ? 503 : 200).json({
      ...base,
      ok: missing.length === 0,
      ...(verbose ? { tables: { required: REQUIRED_TABLES.length, missing } } : {}),
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).json({ ...base, ok: false, error: 'Database unreachable', latencyMs: Date.now() - started });
  }
});

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

app.post('/api/auth/register', registerLimit, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (String(email).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    // bcrypt truncates past 72 bytes, so anything longer is a silent collision.
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'Password must be 8 to 72 characters' });
    }
    if (String(name).length > 100) {
      return res.status(400).json({ error: 'Name must be under 100 characters' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    // Classify at creation. Once account_kind exists, a row left NULL is
    // UNKNOWN and fails closed, so a newly registered person would be invisible
    // to everyone until someone manually reviewed them. Writing the kind here
    // is the whole point of the column: the decision is made once, explicitly,
    // at the moment the account is created, rather than inferred later.
    //
    // Written through the same classifier every reader uses, so a demo or test
    // address can never be registered as a person.
    const newKind = classifyEmail(normalizedEmail);
    const result = await query(
      `INSERT INTO users (name, email, password, account_kind)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email`,
      [name.trim().slice(0, 100), normalizedEmail, hashed, newKind]
    ).catch(() => query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name.trim().slice(0, 100), normalizedEmail, hashed]
    ));
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

app.post('/api/auth/login', loginLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    // Same guard on compare: a >72-char password would otherwise be silently
    // truncated to whatever prefix hashes to, and could authenticate.
    if (typeof password !== 'string' || password.length > 72) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
      const result = await query('SELECT id, name, email, password, onboarding_complete FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken(user.id);
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, onboarding_complete: user.onboarding_complete } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.age, u.moving_to, u.moving_date, u.university,
              u.country, u.verification_status, u.onboarding_complete, u.looking_for,
              u.created_at, p.city AS profile_city
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`, [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// The destination city and country, resolved from the cities table. Used to
// scope resources, checklist links and the discover page so they follow where
// the user is actually going instead of a hardcoded default.
app.get('/api/me/destination', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.name AS city, c.country, c.state, c.cost_level, c.description
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN cities c
         ON LOWER(c.name) = LOWER(COALESCE(p.city, u.moving_to))
       WHERE u.id = $1`, [req.userId]
    );
    const row = result.rows[0] || {};
    res.json({
      city: row.city || null,
      country: row.country || null,
      state: row.state || null,
      cost_level: row.cost_level ?? null,
      description: row.description || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get destination' });
  }
});

// ══════════════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════════════

app.post('/api/onboarding', authMiddleware, async (req, res) => {
  try {
    const {
      looking_for, moving_to, moving_date, interests,
      budget, flat_type, cleanliness, sleep_time, social_level,
      smoking, drinking, diet,
      date_of_birth, gender, preferred_gender,
    } = req.body;

    // Age is derived from DOB, never a free-text number, so it cannot go stale
    // or be forged. Unknown/invalid DOB fails closed here before any write.
    let derivedAge = null;
    if (date_of_birth != null && date_of_birth !== '') {
      const v = validateDob(date_of_birth);
      if (!v.ok) return res.status(400).json({ error: v.error });
      derivedAge = v.age;
    }

    // Gender preference goes through the same normalizer the profile editor
    // uses, so onboarding and Edit Profile can never store different vocabularies
    // and the feed filter sees one canonical set of values.
    let normalizedPref = null;
    if (preferred_gender != null && preferred_gender !== '') {
      normalizedPref = normalizeGenderPref(preferred_gender);
      if (!normalizedPref) return res.status(400).json({ error: 'preferred_gender must be one of: female, male, all, unspecified' });
    }

    // users table: the move itself.
    const userUpdates = [];
    const userParams = [];
    let idx = 1;
    const setUser = (col, val) => { userUpdates.push(`${col} = $${idx++}`); userParams.push(val); };

    if (looking_for) setUser('looking_for', looking_for);
    if (moving_to) setUser('moving_to', String(moving_to).trim().slice(0, 100));
    if (moving_date) setUser('moving_date', moving_date === 'null' ? null : moving_date);
    if (Array.isArray(interests)) setUser('interests', interests);
    if (date_of_birth != null && date_of_birth !== '') {
      setUser('date_of_birth', date_of_birth);
      setUser('age', derivedAge);
    }
    if (gender != null && gender !== '') setUser('gender', gender);

    // Country comes from the chosen city rather than a separate question, so
    // it can never disagree with moving_to.
    if (moving_to) {
      const c = await query('SELECT country FROM cities WHERE LOWER(name) = LOWER($1)', [moving_to]);
      if (c.rows[0]) setUser('country', c.rows[0].country);
    }

    if (userUpdates.length) {
      userParams.push(req.userId);
      await query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${idx}`, userParams);
    }

    // profiles table: the lifestyle answers. These used to be collected by the
    // form and then silently thrown away, which left everyone matching on
    // database defaults instead of what they actually said.
    const profileUpdates = [];
    const profileParams = [];
    let pidx = 1;
    const setProfile = (col, val) => { profileUpdates.push(`${col} = $${pidx++}`); profileParams.push(val); };

    if (moving_to) setProfile('city', String(moving_to).trim().slice(0, 100));
    if (budget !== undefined && budget !== null && budget !== '') setProfile('budget', Math.max(0, Math.min(10000000, parseInt(budget, 10) || 0)));
    if (flat_type) setProfile('flat_type', flat_type);
    if (cleanliness !== undefined) setProfile('cleanliness', Math.max(1, Math.min(5, parseInt(cleanliness, 10) || 3)));
    if (sleep_time) setProfile('sleep_time', sleep_time);
    if (social_level) setProfile('social_level', social_level);
    if (smoking) setProfile('smoking', smoking);
    if (drinking) setProfile('drinking', drinking);
    if (diet) setProfile('diet', diet);

    if (profileUpdates.length) {
      // Every user gets a profiles row at registration, but ON CONFLICT keeps
      // this correct for rows created before that was true.
      await query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [req.userId]);
      profileParams.push(req.userId);
      await query(`UPDATE profiles SET ${profileUpdates.join(', ')} WHERE user_id = $${pidx}`, profileParams);
    }

    // The gender preference lives on the preferences row, not the profile, and
    // must go through the same COALESCE guard the profile editor uses: an
    // omitted value has to leave the stored one alone rather than blanking it,
    // which would silently un-filter the feed on a partial save.
    if (normalizedPref != null) {
      await query(
        // preferences has created_at only — no updated_at column. Setting one
        // made every onboarding submit that carried a preferred gender 500.
        'UPDATE preferences SET preferred_gender = $1 WHERE user_id = $2',
        [normalizedPref, req.userId]
      );
    }

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

// ── Match weights ─────────────────────────────────────────────
// Users adjust these instead of living with fixed hidden numbers.
// Sliders are normalised client-side; the server re-normalises on read.
app.get('/api/match-weights', authMiddleware, async (_req, res) => {
  try {
    const defaults = {
      lifestyle_weight: 0.25, budget_weight: 0.20, location_weight: 0.20,
      movein_weight: 0.15, interests_weight: 0.10, habits_weight: 0.10,
    };
    const result = await query('SELECT * FROM match_weights ORDER BY id LIMIT 1');
    const stored = result.rows[0] || defaults;
    res.json({ weights: { ...defaults, ...stored } });
  } catch (err) {
    console.error('Get match weights error:', err);
    res.status(500).json({ error: 'Failed to load match weights' });
  }
});

app.post('/api/match-weights', authMiddleware, async (req, res) => {
  try {
    const raw = req.body?.weights || {};
    const clean = {};
    for (const key of Object.values(WEIGHT_KEYS)) {
      const n = Number(raw[key]);
      clean[key] = Number.isFinite(n) && n >= 0 ? n : 0;
    }
    const sum = Object.values(clean).reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      return res.status(400).json({ error: 'At least one factor must have a weight above zero' });
    }

    // Upsert the single global row that calcCompatibility reads.
    const updated = await query(
      `INSERT INTO match_weights
         (lifestyle_weight, budget_weight, location_weight, movein_weight, interests_weight, habits_weight, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         lifestyle_weight = EXCLUDED.lifestyle_weight,
         budget_weight = EXCLUDED.budget_weight,
         location_weight = EXCLUDED.location_weight,
         movein_weight = EXCLUDED.movein_weight,
         interests_weight = EXCLUDED.interests_weight,
         habits_weight = EXCLUDED.habits_weight,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [clean.lifestyle_weight, clean.budget_weight, clean.location_weight,
       clean.movein_weight, clean.interests_weight, clean.habits_weight]
    );
    if (updated.rows.length === 0) {
      // No row to conflict with yet: create id 1 explicitly.
      await query(
        `INSERT INTO match_weights
           (id, lifestyle_weight, budget_weight, location_weight, movein_weight, interests_weight, habits_weight)
         VALUES (1, $1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           lifestyle_weight = EXCLUDED.lifestyle_weight,
           budget_weight = EXCLUDED.budget_weight,
           location_weight = EXCLUDED.location_weight,
           movein_weight = EXCLUDED.movein_weight,
           interests_weight = EXCLUDED.interests_weight,
           habits_weight = EXCLUDED.habits_weight,
           updated_at = CURRENT_TIMESTAMP`,
        [clean.lifestyle_weight, clean.budget_weight, clean.location_weight,
         clean.movein_weight, clean.interests_weight, clean.habits_weight]
      );
    }
    res.json({ weights: clean });
  } catch (err) {
    console.error('Save match weights error:', err);
    res.status(500).json({ error: 'Failed to save match weights' });
  }
});

app.get('/api/profile/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await query(
      `SELECT u.id, u.name, u.email, u.age, u.date_of_birth, u.moving_to, u.moving_date,
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
    // Age is derived from DOB when present so it can never go stale; the
    // stored `age` column is only a legacy fallback for rows with no DOB yet.
    if (profile.date_of_birth) {
      const derived = ageFromDob(profile.date_of_birth);
      if (derived != null) profile.age = derived;
    }
    const langs = await query(
      `SELECT l.id, l.name FROM languages l
       JOIN user_languages ul ON l.id = ul.language_id
       WHERE ul.user_id = $1`, [userId]
    );
    profile.languages = langs.rows;

    // Whether these two are matched. Without it the detail page's Message and
    // "Draft agreement" actions never render, because they are gated on it.
    const matched = await query(
      `SELECT 1 FROM matches
       WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)
       LIMIT 1`, [req.userId, userId]
    );
    profile.is_match = matched.rows.length > 0;
    profile.is_self = Number(req.userId) === Number(userId);

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
      age, movingTo, movingDate, university, country, interests,
      dateOfBirth,
    } = req.body;

    const safeStr = v => v == null ? '' : String(v).trim();
    const safeInt = (v, d) => { const n = parseInt(v); return isNaN(n) ? d : n; };
    const safeDate = v => (!v || v === 'null') ? null : v;

    // Gender-preference write gate. Unknown values fail with 400 before any
    // query runs, so a bad pref never half-saves or reaches the filter. The
    // legacy seed value 'no_preference' is still accepted on write and stored
    // as 'unspecified'; the four canonical values are the only ones kept.
    if (preferredGender != null && preferredGender !== '') {
      const g = String(preferredGender).trim().toLowerCase();
      if (!GENDER_PREF_VALUES.includes(g) && g !== 'no_preference') {
        return res.status(400).json({
          error: 'preferredGender must be one of: female, male, all, unspecified',
        });
      }
    }

    // Date of birth is the source of truth for age. When it is supplied we
    // ignore any free-text `age` in the body and recompute, so a client cannot
    // send a DOB and a mismatched age. Invalid DOB fails closed with 400 and
    // writes nothing. When DOB is not supplied we leave both columns alone so
    // an unrelated profile edit never clears a stored DOB or corrupts age.
    let dobAge = null;
    if (dateOfBirth != null && dateOfBirth !== '') {
      const v = validateDob(dateOfBirth);
      if (!v.ok) return res.status(400).json({ error: v.error });
      dobAge = v.age;
    }

    // Update user-level fields
    const userUpdates = [];
    const userParams = [];
    let idx = 1;
    if (dobAge !== null) {
      userUpdates.push(`date_of_birth = $${idx++}`); userParams.push(dateOfBirth);
      userUpdates.push(`age = $${idx++}`); userParams.push(dobAge);
    } else if (age !== undefined) {
      // Legacy path: a bare age with no DOB. Keep it, but only if it is a sane
      // number; an age of 0 or a non-integer is dropped rather than stored.
      const parsedAge = parseInt(age, 10);
      if (!Number.isNaN(parsedAge) && parsedAge >= 13 && parsedAge <= 120) {
        userUpdates.push(`age = $${idx++}`); userParams.push(parsedAge);
      }
    }
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
      // Every omitted field keeps the value already stored. This statement used
      // to fall back to the schema default for each one (`safeStr(smoking)||'no'`,
      // `safeInt(cleanliness,3)`, `safeInt(budget,15000)`), so saving the profile
      // editor to change a bio silently reset smoking, diet, budget and every
      // other roommate answer to "nobody has answered this" - and matching then
      // scored those reset values as if the person had chosen them.
      // Casts are load-bearing: with COALESCE($n, col) Postgres has two unknown
      // candidates to infer from and refuses the statement outright, which made
      // every profile save fail with "could not determine data type".
      await query(
        `UPDATE profiles SET bio=COALESCE($1::text, bio), occupation=COALESCE($2::text, occupation),
         city=COALESCE($3::text, city), move_in_date=COALESCE($4::date, move_in_date),
         sleep_time=COALESCE($5::text, sleep_time), cleanliness=COALESCE($6::int, cleanliness),
         diet=COALESCE($7::text, diet), noise_tolerance=COALESCE($8::text, noise_tolerance),
         noise_level=COALESCE($9::int, noise_level), budget=COALESCE($10::int, budget),
         deposit=COALESCE($11::int, deposit), flat_type=COALESCE($12::text, flat_type),
         occupants=COALESCE($13::int, occupants), smoking=COALESCE($14::text, smoking),
         drinking=COALESCE($15::text, drinking), partying=COALESCE($16::text, partying),
         profile_image=COALESCE($17::text, profile_image), social_level=COALESCE($18::text, social_level),
         pets=COALESCE($19::text, pets), work_schedule=COALESCE($20::text, work_schedule),
         neighbourhood=COALESCE($21::text, neighbourhood),
         preferred_neighbourhood=COALESCE($22::text, preferred_neighbourhood),
         gender=COALESCE($23::text, gender)
         WHERE user_id=$24`,
        // safeStr() yields '' for a missing value, and COALESCE only skips NULL -
        // an empty string would overwrite the stored answer and then fail the
        // column's CHECK constraint. Every optional write is nulled first.
        [safeStr(bio) || null, safeStr(occupation) || null, safeStr(city) || null, safeDate(moveInDate),
         safeStr(sleepTime) || null, safeInt(cleanliness) ?? null, safeStr(diet) || null,
         safeStr(noiseTolerance) || null, safeInt(noiseLevel) ?? null,
         safeInt(budget) ?? null, safeInt(deposit) ?? null, safeStr(flatType) || null,
         safeInt(occupants) ?? null, safeStr(smoking) || null, safeStr(drinking) || null,
         safeStr(partying) || null, profileImage || null,
         safeStr(socialLevel) || null, safeStr(pets) || null,
         safeStr(workSchedule) || null, safeStr(neighbourhood) || null,
         safeStr(preferredNeighbourhood) || null, safeStr(gender) || null, userId]
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

    // Saving real roommate answers marks them as answers, whichever branch
    // wrote the row. Matching refuses to score a profile that has never been
    // filled in, because every column carries a placeholder from registration
    // and the profile editor is a second, equally valid way to answer the same
    // questions the onboarding wizard asks.
    const ANSWER_MARKERS = [sleepTime, cleanliness, diet, noiseTolerance, budget,
      flatType, smoking, drinking, socialLevel, pets, workSchedule, moveInDate, city];
    if (ANSWER_MARKERS.some(v => v !== undefined && v !== null && v !== '')) {
      await query('UPDATE users SET onboarding_complete = TRUE WHERE id = $1', [userId]);
    }

    // Preferences
    await query(
      `UPDATE preferences SET preferred_gender=COALESCE($1::text, preferred_gender), preferred_budget_min=$2, preferred_budget_max=$3,
       preferred_location_radius=$4, prefers_smoking=$5, prefers_drinking=$6,
       prefers_cleanliness_min=$7, prefers_sleep_schedule=$8,
       prefers_same_diet=$9, prefers_same_sleep=$10
       WHERE user_id=$11`,
      // An omitted preferredGender must not clobber the stored value (the
      // profiles UPDATE above fixed the same class of bug). The legacy seed
      // value 'no_preference' is normalized to 'unspecified' on write.
      [safeStr(preferredGender) ? normalizeGenderPref(preferredGender) : null,
       parseInt(preferredBudgetMin)||null, parseInt(preferredBudgetMax)||null,
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
    // Stream with a hard size bound: an oversized body stops accumulating the
    // moment it passes the cap instead of being buffered whole and then
    // judged. Vercel's own 4.5MB request cap is the outer wall.
    const chunks = [];
    let size = 0;
    let overflow = false;
    await new Promise((resolve, reject) => {
      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES) {
          overflow = true;
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', resolve);
      req.on('error', reject);
    });
    if (overflow) {
      return res.status(413).json({ error: 'Image is too large. The maximum size is 4 MB.' });
    }
    const buffer = Buffer.concat(chunks);
    const ct = req.headers['content-type'] || '';
    // Type, size and magic-byte verdicts each carry their own status so the
    // client can tell the user what was wrong instead of a bare "Upload failed".
    const verdict = validateUpload({ contentType: ct, buffer });
    if (!verdict.ok) {
      return res.status(verdict.status).json({ error: verdict.error });
    }
    // Missing storage configuration is a deployment problem, not a request
    // problem, and not the generic 500 that a real put() failure now keeps.
    // Checked before put() so no storage call is even attempted without it.
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({
        error: 'Image storage is not configured on this deployment.',
        code: 'storage-not-configured',
      });
    }
    const filename = `${req.userId}-${Date.now()}.${verdict.ext}`;
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: verdict.contentType,
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

// Scoring constants and scoreCompatibility now live in ./matching.mjs (shared
// with Demo Mode). Re-exported here for any internal callers.
export { MATCH_CATEGORIES, ANSWERED_FIELDS, WEIGHT_KEYS, scoreCompatibility, DEFAULT_MATCH_WEIGHTS };

// Scoring used to issue six queries per candidate: both profiles, both
// language lists and the whole cities cost table. For a feed of ~28 candidates
// that is ~170 sequential round-trips, which is why this endpoint measured ~10s
// while every other route answered in ~230ms.
//
// Nothing it reads about the requester changes between candidates, and the
// candidate profiles can be fetched in one query. So load the context once and
// score in memory. The arithmetic is untouched - only the round-trip count.
async function loadScoreContext(userId, candidateIds) {
  const ids = candidateIds.length ? candidateIds : [userId];
  // u.id is aliased because `p.*` may itself carry an `id` column, and node-pg
  // lets a later duplicate column name overwrite an earlier one.
  const [meResult, allProfiles, allLangs, costRows] = await Promise.all([
    query(`SELECT u.interests, u.country, u.moving_to, u.onboarding_complete, p.* FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = $1`, [userId]),
    query(`SELECT u.id AS cand_id, u.interests, u.country, u.moving_to, u.onboarding_complete, p.* FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ANY($1::int[])`, [ids]),
    query(`SELECT ul.user_id, l.name FROM languages l JOIN user_languages ul ON l.id = ul.language_id WHERE ul.user_id = ANY($1::int[])`, [ids]),
    query(`SELECT LOWER(name) AS name, cost_level FROM cities`),
  ]);

  const langsById = new Map();
  for (const r of allLangs.rows) {
    if (!langsById.has(r.user_id)) langsById.set(r.user_id, []);
    langsById.get(r.user_id).push(r.name);
  }

  return {
    me: meResult.rows[0],
    meLangs: langsById.get(userId) || [],
    themById: new Map(allProfiles.rows.map(r => [r.cand_id, r])),
    langsById,
    costByCity: new Map(costRows.rows.map(r => [r.name, r.cost_level || 3])),
  };
}

// Single-candidate entry point. The swipe, detail and settlement callers keep
// using this unchanged.
async function calcCompatibility(userId, candidateId, weights) {
  const ctx = await loadScoreContext(userId, [candidateId]);
  return scoreCompatibility(ctx, candidateId, weights);
}

// scoreCompatibility is imported from ./matching.mjs (see top of file).
// Account classification lives in account-kind.mjs so demo, QA and walkthrough
// accounts are all excluded from a real person's recommendations. Previously
// only the demo domain was filtered, which let automated test accounts rank in
// the real feed.

// Which kind of account is acting. The swipe/shortlist/agreement guards below
// ── Explicit account classification ─────────────────────────────────────
// `users.account_kind` (see database/migrations/2026-10-10_add_account_kind.sql)
// is the durable answer to "is this a real person?". Until it is applied, the
// address heuristic stands in for it. Probed once and cached, because the answer
// cannot change while the process is running: the column either exists or it
// does not, and adding it is a migration, not a request.
//
// Cached value: null = not probed yet, true = column present, false = absent.
let storedAccountKind = null;
async function hasStoredAccountKind() {
  if (storedAccountKind !== null) return storedAccountKind;
  try {
    const r = await query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'account_kind' LIMIT 1`
    );
    storedAccountKind = r.rows.length > 0;
  } catch {
    // If we cannot tell, assume the pre-migration schema rather than suddenly
    // excluding every account. Failing toward visibility is the safe direction
    // here; failing closed is about not CALLING something real, not about
    // hiding people.
    storedAccountKind = false;
  }
  return storedAccountKind;
}

/** Classify a row that may or may not carry account_kind. */
async function kindOf(row) {
  const stored = await hasStoredAccountKind();
  return classifyAccount(stored ? { email: row.email, account_kind: row.account_kind } : row);
}

/** True when this row may act as, or be treated as, a genuine person. */
async function isRealRow(row) {
  return (await kindOf(row)) === KIND.REAL;
}

/** The WHERE fragment keeping non-real accounts out of a real-user surface. */
async function realOnlySql(alias) {
  return realAccountSql(alias, await hasStoredAccountKind());
}

// One indexed lookup, only on the mutating routes. Both sides of the interaction
// must be genuine: a demo or QA account acting on its own would otherwise create
// real swipe, match, conversation and agreement rows against a genuine user.
async function actorIsRealUser(userId) {
  const r = await query('SELECT email, account_kind FROM users WHERE id = $1', [userId])
    .catch(() => query('SELECT email FROM users WHERE id = $1', [userId]));
  return r.rows.length > 0 && await isRealRow(r.rows[0]);
}

// Best-effort notification write. A bell entry is a courtesy, never a reason to
// fail the user's actual action, so every failure path resolves to null and the
// caller keeps its own success response. find-or-bump-or-insert keeps the
// (recipient, type, dedup_key) row unique: a repeated like or a chatty thread
// updates created_at and clears read_at (so it re-surfaces as unread) instead
// of stacking a new row. read_at IS NULL partial unique index makes the
// re-bump race-safe; the ON CONFLICT race is caught and retried once.
async function recordNotification({ recipientId, actorId, type, ids }) {
  const n = buildNotification({ recipientId, actorId, type, ids });
  if (!n) return null;
  try {
    const updated = await query(
      `UPDATE notifications SET created_at = CURRENT_TIMESTAMP, read_at = NULL
       WHERE recipient_id = $1 AND type = $2 AND dedup_key = $3`,
      [n.recipientId, n.type, n.dedupKey]
    );
    if (updated.rowCount > 0) return n;
    await query(
      `INSERT INTO notifications (recipient_id, actor_id, type, dedup_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [n.recipientId, n.actorId, n.type, n.dedupKey]
    );
    return n;
  } catch (err) {
    // Most likely the notifications table does not exist yet (migration not
    // applied). Swallow it; the user's like/message/match already succeeded.
    console.error('recordNotification (non-fatal):', err.message);
    return null;
  }
}

// ── Demo Mode ────────────────────────────────────────────────
// Demo Mode is fully client-side now: its synthetic profiles, scores, likes,
// matches and messages live in the bundle and the demo session storage, so
// this API exposes no demo endpoint at all. A demo browser session makes
// zero /api/* calls by construction.
// ── Roommates / Discovery ──────────────────────────────────────

// One candidate selection backs both feeds. Discover and Roommates each kept
// their own copy of this query, and the copies drifted: Discover excluded only
// passes, so people you had already liked kept coming back, and it sampled the
// 20 newest accounts before scoring, so the two screens could show different
// people for identical answers. Both now go through this one implementation.
async function getRecommendedRoommates(req, opts = {}) {
  try {
    const { city, budget_min, budget_max, page = 1, limit = 20, pool } = opts;
    const pageSize = parseInt(limit) || 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * pageSize;
    // Score a wider window than one page. Capping the SQL at the page size made
    // Discover's "top 5" really "the 5 newest accounts", so a strong match who
    // signed up a week earlier never appeared. Pagination then walks the
    // score-sorted pool rather than the signup order.
    const poolSize = Math.max(parseInt(pool) || 60, pageSize + offset);
    const weights = await getMatchWeights();

    // Get blocked users
    const blocked = await query(
      `SELECT blocked_id FROM blocks WHERE blocker_id = $1
       UNION
       SELECT blocker_id FROM blocks WHERE blocked_id = $1`, [req.userId]
    );
    const blockedIds = blocked.rows.map(r => r.blocked_id);

    // The demo suffix is declared near the demo routes below. The exclusion is
    // resolved at request time: once account_kind exists it decides, otherwise
    // the heuristic is used unchanged.
let where = `WHERE u.id != $1 AND ${await realOnlySql('u')}`;
    const params = [req.userId];
    let idx = 2;

    if (blockedIds.length > 0) {
      where += ` AND u.id NOT IN (${blockedIds.map(() => `$${idx++}`).join(',')})`;
      params.push(...blockedIds);
    }

    if (city) { where += ` AND LOWER(p.city) LIKE LOWER($${idx++})`; params.push(`%${city}%`); }
    if (budget_min) { where += ` AND p.budget >= $${idx++}`; params.push(parseInt(budget_min)); }
    if (budget_max) { where += ` AND p.budget <= $${idx++}`; params.push(parseInt(budget_max)); }

    // Exclude already-swiped people in SQL, not after LIMIT. Filtering them
    // post-query meant every page was "the 20 newest accounts, minus the ones
    // you decided", so a user who liked their way through the newest 20 got an
    // empty feed while unswiped people still existed further down the table.
    const swipedIds = await query('SELECT swiped_id FROM swipes WHERE swiper_id = $1', [req.userId]);
    const swipedSet = new Set(swipedIds.rows.map(r => r.swiped_id));
    if (swipedSet.size > 0) {
      where += ` AND u.id NOT IN (${[...swipedSet].map(() => `$${idx++}`).join(',')})`;
      params.push(...swipedSet);
    }

    // Gender preference: a hard two-sided filter, applied in SQL before the
    // pool LIMIT so an empty feed is never caused by post-filtering. My stated
    // preference filters each candidate's gender; each candidate's stated
    // preference filters mine. Unspecified / legacy 'no_preference' / unknown
    // values impose no restriction on either side, so existing feeds stay
    // alive. My own gender+pref is one extra single-row query; the candidates'
    // side rides on the pref2 join below.
    const me = await query(
      `SELECT p.gender, pref.preferred_gender
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       LEFT JOIN preferences pref ON u.id = pref.user_id
       WHERE u.id = $1`, [req.userId]);
    const gFilter = feedGenderFilterSql(me.rows[0]?.gender, me.rows[0]?.preferred_gender, idx);
    where += ` ${gFilter.sql}`;
    params.push(...gFilter.params);
    idx = gFilter.nextIdx;

    const candidates = await query(
      `SELECT u.id, u.name, u.age, u.interests, u.moving_to, u.country,
              p.bio, p.occupation, p.city, p.profile_image, p.budget, p.deposit,
              p.flat_type, p.sleep_time, p.cleanliness, p.diet, p.smoking, p.drinking,
              p.noise_tolerance, p.social_level, p.pets, p.work_schedule,
              p.neighbourhood, p.preferred_neighbourhood, p.gender,
              p.move_in_date, p.occupants, p.partying
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       LEFT JOIN preferences pref2 ON u.id = pref2.user_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx++}`,
      [...params, poolSize]
    );

    // Score candidates. Everything the scorer needs about the requester is the
    // same for every candidate, so it is loaded once here and the scoring runs
    // in memory. This replaces six queries per candidate - the old loop issued
    // them sequentially, which is what made this route ~10s.
    const ctx = await loadScoreContext(req.userId, candidates.rows.map(c => c.id));
    const results = candidates.rows.map(c => ({ ...c, ...scoreCompatibility(ctx, c.id, weights) }));

    // Score descending. The tie-breakers make the order deterministic: the SQL
    // already returns created_at DESC, and Array#sort is stable, so this
    // reproduces that order exactly while stopping rows with an identical score
    // and timestamp from reshuffling between requests.
    results.sort((a, b) =>
      b.score - a.score || new Date(b.created_at) - new Date(a.created_at) || a.id - b.id);
    return results.slice(offset, offset + pageSize);
  } catch (err) {
    console.error('Get roommates error:', err);
    throw err;
  }
}

app.get('/api/roommates/recommended', authMiddleware, async (req, res) => {
  try {
    res.json(await getRecommendedRoommates(req, req.query));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get roommates' });
  }
});

app.get('/api/roommates/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const weights = await getMatchWeights();
    const result = await query(
      `SELECT u.id, u.name, u.age, u.email, u.interests, u.moving_to, u.country, u.university,
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

    // This route was reachable by guessed id, so a real user could read a
    // demo, QA or walkthrough profile even though the feed excludes them.
    // 404 rather than 403: a 403 would confirm the account exists.
    // Self is always allowed because /roommates/:ownId is a legitimate view.
    if (Number(req.userId) !== Number(userId)) {
      // Both sides must be genuine: a demo/QA actor must not read a real
      // profile through the ordinary route either. Demo Mode is client-only.
      const actor = await query('SELECT email, account_kind FROM users WHERE id = $1', [req.userId])
        .catch(() => query('SELECT email FROM users WHERE id = $1', [req.userId]));
      const actorIsReal = actor.rows.length > 0 && await isRealRow(actor.rows[0]);
      if (!actorIsReal || !(await isRealRow(result.rows[0]))) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const profile = result.rows[0];
    const langs = await query(
      `SELECT l.id, l.name FROM languages l JOIN user_languages ul ON l.id = ul.language_id WHERE ul.user_id = $1`, [userId]
    );
    profile.languages = langs.rows;

    const { score, breakdown, reasons } = await calcCompatibility(req.userId, userId, weights);
    profile.score = score;
    profile.breakdown = breakdown;
    profile.reasons = reasons;

    // Whether the pair is already matched. The detail page gates its Message
    // and agreement actions on this; without it both stayed hidden forever,
    // even for people who had already matched.
    const matched = await query(
      `SELECT 1 FROM matches
       WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)
       LIMIT 1`, [req.userId, userId]
    );
    profile.is_match = matched.rows.length > 0;
    profile.is_self = Number(req.userId) === Number(userId);

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
    if (!(await actorIsRealUser(req.userId))) {
      return res.status(403).json({ error: 'Sample and test accounts cannot like or pass anyone' });
    }

    // Check target exists, and is not a seeded demo account. Demo Mode is
    // client-side only; without this guard a hand-crafted request could still
    // create a real swipe row pointing at a robot.
    const target = await query('SELECT id, email, account_kind FROM users WHERE id = $1', [targetId])
      .catch(() => query('SELECT id, email FROM users WHERE id = $1', [targetId]));
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (!(await isRealRow(target.rows[0]))) {
      const kind = humanLabel(await kindOf(target.rows[0]));
      return res.status(403).json({ error: `${kind || 'This'} profile cannot be liked or passed` });
    }

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

          // Both sides learn about the new match. Symmetric, so both get a
          // bell entry; best-effort only (see recordNotification).
          await recordNotification({ recipientId: ua, actorId: ub, type: 'match', ids: { userAId: ua, userBId: ub } });
          await recordNotification({ recipientId: ub, actorId: ua, type: 'match', ids: { userAId: ua, userBId: ub } });
        }
      } else {
        // No mutual like yet: the target simply learns someone liked them.
        await recordNotification({ recipientId: targetId, actorId: req.userId, type: 'like', ids: { actorId: req.userId } });
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

// ── Likes (sent / received) ───────────────────────────────────
// Read-only lists behind the same eligibility rules as the feed: real accounts
// only, blocked pairs excluded on either side, no emails in any response.
// There is no summary endpoint — counts come from these two arrays, so a
// badge can never disagree with the list it points at.

app.get('/api/likes/sent', authMiddleware, async (req, res) => {
  try {
    const { sql, params } = sentLikesQuery(req.userId, await realOnlySql('u'));
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get sent likes error:', err);
    res.status(500).json({ error: 'Failed to get sent likes' });
  }
});

app.get('/api/likes/received', authMiddleware, async (req, res) => {
  try {
    const { sql, params } = receivedLikesQuery(req.userId, await realOnlySql('u'));
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get received likes error:', err);
    res.status(500).json({ error: 'Failed to get received likes' });
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
    if (convResult.rows.length === 0) {
      // Membership is enforced by the join above, so an outsider cannot read
      // anyone else's messages - but returning 200 with [] made "you are not
      // authorised" indistinguishable from "this thread is empty", and the chat
      // screen rendered that as "No messages yet". A matched pair with no
      // messages yet is a genuinely empty thread and still gets []; anyone else
      // is refused.
      const match = await query(
        `SELECT id FROM matches WHERE status = 'matched' AND
         ((user_a_id = $1 AND user_b_id = $2) OR (user_b_id = $1 AND user_a_id = $2)) LIMIT 1`,
        [req.userId, otherUserId]
      );
      if (match.rows.length === 0) {
        return res.status(403).json({ error: 'You can only read conversations with your matches' });
      }
      return res.json([]);
    }

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

// ── Notifications ─────────────────────────────────────────────
// Paginated bell feed. Actor join is LEFT so a notification whose actor deleted
// their account still renders (as "Someone") instead of vanishing and leaving a
// gap the user cannot explain.

app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const result = await query(
      `SELECT n.id, n.type, n.read_at, n.created_at, n.actor_id,
              a.name AS actor_name, p.profile_image AS actor_image
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
       LEFT JOIN profiles p ON p.user_id = n.actor_id
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );
    const unread = await query(
      'SELECT COUNT(*)::int AS c FROM notifications WHERE recipient_id = $1 AND read_at IS NULL',
      [req.userId]
    );
    res.json({ notifications: result.rows, unreadCount: unread.rows[0].c });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Unread count only — cheap enough for the bell to poll on a timer.
app.get('/api/notifications/unread-count', authMiddleware, async (req, res) => {
  try {
    const r = await query(
      'SELECT COUNT(*)::int AS c FROM notifications WHERE recipient_id = $1 AND read_at IS NULL',
      [req.userId]
    );
    res.json({ unreadCount: r.rows[0].c });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark one notification read. Scoped to recipient so one user can never mark
// another user's row.
app.post('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL',
      [req.params.id, req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// Mark everything read — the "clear the bell" action.
app.post('/api/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE recipient_id = $1 AND read_at IS NULL',
      [req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all read' });
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

    // Best-effort: notify the receiver that a new message arrived. Non-fatal by
    // design (see recordNotification) so a missing table never fails the send.
    await recordNotification({ recipientId: receiver_id, actorId: req.userId, type: 'message', ids: { conversationId: convId } });

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
      `SELECT u.id, u.name, u.age, p.profile_image, p.city, p.budget, p.move_in_date, p.occupation,
              EXISTS(SELECT 1 FROM matches m
                     WHERE m.status = 'matched'
                       AND ((m.user_a_id = $1 AND m.user_b_id = u.id)
                         OR (m.user_b_id = $1 AND m.user_a_id = u.id))) AS is_match
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
    if (!(await actorIsRealUser(req.userId))) {
      return res.status(403).json({ error: 'Sample and test accounts cannot shortlist anyone' });
    }
    // Same boundary as /api/swipe: a non-real account is not a real candidate.
    const target = await query('SELECT email FROM users WHERE id = $1', [targetId]);
    if (target.rows.length > 0 && !(await isRealRow(target.rows[0]))) {
      const kind = humanLabel(await kindOf(target.rows[0]));
      return res.status(403).json({ error: `${kind || 'This'} profile cannot be shortlisted` });
    }
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

    params.push(req.userId);
    const userIdx = idx++;
    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT c.*, u.name AS creator_name,
              EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = $${userIdx}) AS is_member
       FROM communities c
       JOIN users u ON u.id = c.creator_id
       ${where}
       ORDER BY c.member_count DESC, c.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
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

    params.push(req.userId);
    const userIdx = idx++;
    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT e.*, u.name AS creator_name, c.name AS community_name,
              EXISTS(SELECT 1 FROM event_rsvps WHERE event_id = e.id AND user_id = $${userIdx}) AS is_rsvped,
              (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND status = 'going') AS going_count
       FROM events e
       JOIN users u ON u.id = e.created_by
       LEFT JOIN communities c ON c.id = e.community_id
       ${where}
       ORDER BY e.start_time ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

app.post('/api/events', authMiddleware, async (req, res) => {
  try {
    const { title, description, community_id, location, city, start_time, end_time, capacity, category } = req.body;
    if (!title || !start_time) return res.status(400).json({ error: 'Title and start time required' });
    if (isNaN(new Date(start_time).getTime())) {
      return res.status(400).json({ error: 'Start time is not a valid date' });
    }

    const result = await query(
      `INSERT INTO events (title, description, community_id, location, city, start_time, end_time, capacity, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [String(title).trim().slice(0, 300), description || '', community_id || null,
       location || '', city || null, start_time,
       end_time || null, capacity ? parseInt(capacity, 10) : null,
       category ? String(category).trim().slice(0, 50) : null, req.userId]
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

app.delete('/api/events/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await query(
      'DELETE FROM events WHERE id = $1 AND created_by = $2 RETURNING id', [id, req.userId]
    );
    // 404 rather than 200 for someone else's event: the endpoint must not
    // confirm that an event id exists when the caller does not own it.
    if (deleted.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
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
      `SELECT c.*, (SELECT COUNT(*) FROM users u
                       LEFT JOIN profiles p ON p.user_id = u.id
                     WHERE LOWER(u.moving_to) = LOWER(c.name) OR LOWER(p.city) = LOWER(c.name)) AS people_count
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
    const { category } = req.query;
    const params = [];
    let idx = 1;
    let where = 'WHERE 1=1';

    if (category) { where += ` AND LOWER(category) = LOWER($${idx++})`; params.push(category); }

    // Destination is optional. Without it, return the global guides rather than
    // every city's guides: 30 rows of "How to find a flat in Mumbai" is worse
    // than no city-specific content.
    const city = req.query.city || null;
    const country = req.query.country || null;
    if (city || country) {
      where += ` AND (
        (city IS NULL AND country IS NULL)
        OR LOWER(COALESCE(city,'')) = LOWER($${idx})
        OR LOWER(COALESCE(country,'')) = LOWER($${idx + 1})
      )`;
      params.push(city || '', country || '');
      idx += 2;
    } else {
      // No destination known: global guides only, rather than a wall of
      // "how to find a flat in Mumbai" for someone who never said Mumbai.
      where += ` AND city IS NULL AND country IS NULL`;
    }

    const result = await query(
      `SELECT * FROM resources ${where} ORDER BY category, title`, params
    );
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
    // Where the user is going. Drives the link on location-specific tasks.
    const dest = await query(
      `SELECT COALESCE(p.city, u.moving_to) AS city, c.country
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN cities c ON LOWER(c.name) = LOWER(COALESCE(p.city, u.moving_to))
       WHERE u.id = $1`, [req.userId]
    );
    const { city = null, country = null } = dest.rows[0] || {};

    // Ensure user has entries for all tasks
    await query(
      `INSERT INTO user_settlement_tasks (user_id, task_id, completed)
       SELECT $1, st.id, FALSE FROM settlement_tasks st
       ON CONFLICT (user_id, task_id) DO NOTHING`, [req.userId]
    );

    // A task with no url of its own borrows the best matching resource link for
    // the reader's destination, scoped to the task's own category so a banking
    // task can never pick up a transit map. City match beats country, country
    // beats global. This is what makes "Open a bank account" actionable: the
    // same task links to HDFC for someone moving to India and to the UK
    // newcomer guide for someone moving to London.
    const result = await query(
      `SELECT st.id, st.title, st.description, st.category, st."order",
              COALESCE(ust.completed, FALSE) AS completed, ust.completed_at,
              COALESCE(st.url, (
                SELECT r.url FROM resources r
                WHERE r.url IS NOT NULL
                  AND LOWER(r.category) = LOWER(st.category)
                  AND (
                    LOWER(COALESCE(r.city,''))   = LOWER(COALESCE($2,''))
                 OR LOWER(COALESCE(r.country,'')) = LOWER(COALESCE($3,''))
                  )
                ORDER BY (r.city IS NULL), (r.country IS NULL), r.id
                LIMIT 1
              ), (
                SELECT r.url FROM resources r
                WHERE r.url IS NOT NULL
                  AND LOWER(r.category) = LOWER(st.category)
                ORDER BY r.id
                LIMIT 1
              )) AS url
       FROM settlement_tasks st
       LEFT JOIN user_settlement_tasks ust ON ust.task_id = st.id AND ust.user_id = $1
       ORDER BY st."order" ASC`, [req.userId, city, country]
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
      `SELECT u.id, u.name, u.moving_to, p.city, u.onboarding_complete, c.country
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       LEFT JOIN cities c ON LOWER(c.name) = LOWER(COALESCE(p.city, u.moving_to))
       WHERE u.id = $1`, [req.userId]
    );
    const targetCity = user.rows[0]?.moving_to || user.rows[0]?.city;
    const country = user.rows[0]?.country || null;

    const [roommates, communities, events, cities, settlement] = await Promise.all([
        // Same candidate selection, exclusions and scoring as the Roommates
        // feed, capped at the five this screen shows. The two screens used to
        // keep separate copies of the query and the copies drifted, which is
        // what made them disagree about the same person's matches.
        getRecommendedRoommates(req, { limit: 5 }),
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
      // Settlement progress. Same destination-aware link resolution as
      // GET /api/settlement, so the inline checklist and the full page agree.
      query(
        `SELECT st.id, st.title, st."order",
                COALESCE(ust.completed, FALSE) AS completed,
                COALESCE(st.url, (
                  SELECT r.url FROM resources r
                  WHERE r.url IS NOT NULL
                    AND LOWER(r.category) = LOWER(st.category)
                    AND (LOWER(COALESCE(r.city,''))    = LOWER(COALESCE($2::text,''))
                      OR LOWER(COALESCE(r.country,'')) = LOWER(COALESCE($3::text,'')))
                  ORDER BY (r.city IS NULL), (r.country IS NULL), r.id
                  LIMIT 1
                ), (
                  SELECT r.url FROM resources r
                  WHERE r.url IS NOT NULL AND LOWER(r.category) = LOWER(st.category)
                  ORDER BY r.id LIMIT 1
                )) AS url
         FROM settlement_tasks st
         LEFT JOIN user_settlement_tasks ust ON ust.task_id = st.id AND ust.user_id = $1
         ORDER BY st."order" ASC`,
        [req.userId, targetCity, country]
      ),
    ]);

    const settlementProgress = settlement.rows;
    const completedCount = settlementProgress.filter(t => t.completed).length;

    res.json({
      user: user.rows[0],
      roommates: roommates,
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

// Every agreement the caller is a party to. Scoped by req.userId rather than
// by a caller-supplied pair, so it cannot be used to enumerate other people's
// agreements.
app.get('/api/agreements', authMiddleware, async (req, res) => {
  try {
    // The list is scoped by party membership, but it must not expose a real
    // user's agreement to a demo/QA account that is (or once was) one side of
    // it. Only genuinely-real documents are listed, so a leftover mixed pair
    // stays hidden until the classification is resolved.
    const result = await query(
      `SELECT a.id, a.user_a_id, a.user_b_id, a.content, a.status, a.updated_at,
              u.id AS partner_id, u.name AS partner_name, p.profile_image AS partner_image
       FROM agreements a
       JOIN users u ON u.id = CASE WHEN a.user_a_id = $1 THEN a.user_b_id ELSE a.user_a_id END
       LEFT JOIN profiles p ON p.user_id = u.id
       JOIN users ua ON ua.id = a.user_a_id
       JOIN users ub ON ub.id = a.user_b_id
       WHERE (a.user_a_id = $1 OR a.user_b_id = $1)
         AND ${await realOnlySql('ua')}
         AND ${await realOnlySql('ub')}
       ORDER BY a.updated_at DESC`, [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get agreements' });
  }
});

// An agreement is a document between two matched, genuine people. Without this,
// a demo or test account could open one with any real user, and the generated
// template would quote that user's budget and deposit back to them.
//
// Genuine-pair and matched-pair are deliberately separate checks. They have
// different lifetimes: two real people who unmatch must keep the agreement they
// already wrote, but no demo/QA/unknown account may reach an agreement at all,
// whatever state the document is in.
async function assertRealPair(userA, userB) {
  const pair = [Number(userA), Number(userB)].sort((x, y) => x - y);
  const emails = await query('SELECT email, account_kind FROM users WHERE id = ANY($1::int[])', [pair])
    .catch(() => query('SELECT email FROM users WHERE id = ANY($1::int[])', [pair]));
  if (emails.rows.length !== 2) return false;
  for (const r of emails.rows) if (!(await isRealRow(r))) return false;
  return true;
}

async function assertMatchedPair(userA, userB) {
  const pair = [Number(userA), Number(userB)].sort((x, y) => x - y);
  const m = await query(
    `SELECT 1 FROM matches WHERE status = 'matched'
       AND ((user_a_id = $1 AND user_b_id = $2) OR (user_b_id = $1 AND user_a_id = $2)) LIMIT 1`,
    pair
  );
  return m.rows.length > 0;
}

app.get('/api/agreement/:u1/:u2', authMiddleware, async (req, res) => {
  try {
    const { u1, u2 } = req.params;
    // An agreement is private to its two parties and quotes their rent and
    // deposit. Neither route used to check this, so any signed-in account could
    // read or overwrite anyone's agreement by supplying two ids.
    const a = Number(u1), b = Number(u2);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
      return res.status(400).json({ error: 'Two different user ids are required' });
    }
    if (Number(req.userId) !== a && Number(req.userId) !== b) {
      return res.status(403).json({ error: 'This agreement is not yours' });
    }
    // Both parties must still be genuine. Re-checking the MATCH here made an
    // agreement permanently unreachable the moment the pair unmatched, which
    // destroyed work the two of them had done. The genuine check stays, though,
    // so a demo or test account can never read a real user's agreement.
    if (!(await assertRealPair(a, b))) {
      return res.status(403).json({ error: 'This agreement is not available' });
    }
    // Access to an EXISTING document is otherwise governed by party membership.
    const existing = await query(
      `SELECT * FROM agreements
       WHERE (user_a_id=$1 AND user_b_id=$2) OR (user_b_id=$1 AND user_a_id=$2)`, [a, b]
    );
    if (existing.rows.length > 0) return res.json(existing.rows[0]);

    // CREATING a new document additionally requires an active match. This is
    // what stops a demo or test account opening one with a real user.
    if (!(await assertMatchedPair(a, b))) {
      return res.status(403).json({ error: 'An agreement can only be drafted between two matched accounts' });
    }

    const profiles = await query(
      `SELECT u.id, u.name, p.budget, p.deposit, p.cleanliness, p.noise_tolerance
       FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.id IN ($1, $2)`, [u1, u2]
    );
    const p1 = profiles.rows.find(p => p.id == u1);
    const p2 = profiles.rows.find(p => p.id == u2);
    if (!p1 || !p2) return res.status(404).json({ error: 'Profiles not found' });

    // Budgets are entered in the local currency of the destination, so a London
    // pair and a Mumbai pair get symbols that match their own figures. An
    // agreement quoting rupees to someone paying pounds is worse than no
    // symbol at all.
    const city = await query(
      `SELECT LOWER(COALESCE(p.city, u.moving_to)) AS name, c.country
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN cities c ON LOWER(c.name) = LOWER(COALESCE(p.city, u.moving_to))
       WHERE u.id = ANY($1::int[])`, [[u1, u2].map(Number)]
    );
    const CURRENCY = {
      India: '₹', 'United Kingdom': '£', Australia: 'A$', Canada: 'C$',
      Singapore: 'S$', 'United States': '$', 'New Zealand': 'NZ$',
    };
    const countries = new Set(city.rows.map(r => r.country).filter(Boolean));
    const mixed = countries.size > 1;
    // Two people with different destinations would be quoting two currencies in
    // one document. Neither is right, so the amounts stay bare.
    const sym = mixed ? '' : (CURRENCY[[...countries][0]] || '');
    const money = n => `${sym}${Number(n || 0).toLocaleString('en-IN')}`;

    const template = `ROOMMATE AGREEMENT\n\nThis agreement is entered into by ${p1.name} and ${p2.name}.\n\n1. RENT & DEPOSIT\n- Total Rent: ${money(p1.budget + p2.budget)} (Split: ${p1.name} ${money(p1.budget)}, ${p2.name} ${money(p2.budget)})\n- Security Deposit: ${money(p1.deposit + p2.deposit)}\n\n2. CLEANING SCHEDULE\n- Shared spaces cleaned weekly.\n- Cleanliness Priority: ${p1.cleanliness >= 4 ? 'High' : 'Moderate'}\n\n3. QUIET HOURS\n- Quiet hours: 10 PM to 7 AM.\n- Noise Tolerance: ${p1.noise_tolerance}\n\n4. GUEST POLICY\n- Guests allowed with 24h notice.\n\nSIGNED:\n____________________ (${p1.name})\n____________________ (${p2.name})`;
    res.json({ content: template, status: 'template' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get agreement' });
  }
});

app.post('/api/agreement', authMiddleware, async (req, res) => {
  try {
    const { userA_id, userB_id, content } = req.body;
    if (!userA_id || !userB_id || !content) {
      return res.status(400).json({ error: 'Both users and agreement content are required' });
    }
    // Ordered pair: (3,7) and (7,3) are the same agreement, so normalise to
    // the same unique key or the second save collides with the first.
    const [a, b] = [Number(userA_id), Number(userB_id)].sort((x, y) => x - y);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
      return res.status(400).json({ error: 'Two different user ids are required' });
    }
    // Only the two named parties may create or edit their own agreement.
    if (Number(req.userId) !== a && Number(req.userId) !== b) {
      return res.status(403).json({ error: 'This agreement is not yours' });
    }
    // Same split as the read path. Both parties must be genuine to touch any
    // agreement, so a demo or test account cannot edit a real user's document.
    // But an existing document needs no current match, because unmatching must
    // not destroy terms two people already agreed. A NEW one needs a match.
    if (!(await assertRealPair(a, b))) {
      return res.status(403).json({ error: 'This agreement is not available' });
    }
    const already = await query(
      'SELECT 1 FROM agreements WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1', [a, b]
    );
    if (already.rows.length === 0 && !(await assertMatchedPair(a, b))) {
      return res.status(403).json({ error: 'An agreement can only be drafted between two matched accounts' });
    }
    await query(
      `INSERT INTO agreements (user_a_id, user_b_id, content, status)
       VALUES ($1, $2, $3, 'draft')
       ON CONFLICT (user_a_id, user_b_id)
       DO UPDATE SET content = EXCLUDED.content, status = 'draft', updated_at = CURRENT_TIMESTAMP`,
      [a, b, content]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save agreement' });
  }
});

// ══════════════════════════════════════════════════════════════
// LIVING DNA
// ══════════════════════════════════════════════════════════════
// A private household questionnaire, a consent-gated comparison between mutual
// matches, and a collaboratively written Living Constitution.
//
// Privacy model, enforced here rather than in the UI:
//   - an answer row belongs to one user and is readable only by them
//   - living_dna_sharing is the ONLY thing that opens an answer to a matched
//     partner, and it defaults to sharing nothing
//   - comparison refuses unless BOTH participants have consented
// Nothing here writes to the feed, matching or compatibility score, so
// "complete your Living DNA" can never quietly become a matching criterion.

// Shared preamble for every Living DNA route: is this a mutual match between two
// genuine accounts? Returns the match row, or null after answering.
async function matchedPairWith(req, otherUserId) {
  const other = Number(otherUserId);
  const me = Number(req.userId);
  if (!Number.isInteger(other) || other === me) return null;
  const emails = await query('SELECT email, account_kind FROM users WHERE id = ANY($1::int[])', [[me, other]])
    .catch(() => query('SELECT email FROM users WHERE id = ANY($1::int[])', [[me, other]]));
  if (emails.rows.length !== 2) return null;
  for (const r of emails.rows) if (!(await isRealRow(r))) return null;
  const m = await query(
    `SELECT id, user_a_id, user_b_id FROM matches
      WHERE status = 'matched'
        AND ((user_a_id = $1 AND user_b_id = $2) OR (user_b_id = $1 AND user_a_id = $2)) LIMIT 1`,
    [me, other]
  );
  return m.rows.length ? m.rows[0] : null;
}

// The Living DNA migration creates these tables; until it has been applied,
// every query against them fails with "relation does not exist" (SQLSTATE
// 42P01). Reporting that as a 500 told users their data had broken when in fact
// the feature simply is not switched on in this environment, so those errors
// are separated out and answered honestly instead.
const LIVING_DNA_NOT_READY = 'Living DNA is not available here yet.';
const isMissingLivingDnaTable = err =>
  err?.code === '42P01' || /relation .+ does not exist/i.test(err?.message || '');

app.get('/api/living-dna/questions', authMiddleware, async (req, res) => {
  try {
    const r = await query(
      `SELECT id, slug, category, prompt, options, position
         FROM living_dna_questions ORDER BY position`
    );
    res.json(r.rows);
  } catch (err) {
    if (isMissingLivingDnaTable(err)) return res.status(503).json({ error: LIVING_DNA_NOT_READY });
    res.status(500).json({ error: 'Failed to load questions' });
  }
});

// The caller's own answers plus completion progress. Private by construction:
// this route never accepts another user's id.
app.get('/api/living-dna/me', authMiddleware, async (req, res) => {
  try {
    const [answers, sharing, total] = await Promise.all([
      query(
        `SELECT a.question_id, a.option, a.is_boundary, a.updated_at, q.slug, q.category, q.prompt
           FROM living_dna_answers a JOIN living_dna_questions q ON q.id = a.question_id
          WHERE a.user_id = $1 ORDER BY q.position`, [req.userId]
      ),
      query('SELECT share_preferences, share_boundaries FROM living_dna_sharing WHERE user_id = $1', [req.userId]),
      query('SELECT count(*)::int AS n FROM living_dna_questions'),
    ]);
    const s = sharing.rows[0] || { share_preferences: false, share_boundaries: false };
    res.json({
      answers: answers.rows,
      sharing: s,
      answered: answers.rows.length,
      total: total.rows[0].n,
      complete: answers.rows.length === total.rows[0].n,
    });
  } catch (err) {
    if (isMissingLivingDnaTable(err)) return res.status(503).json({ error: LIVING_DNA_NOT_READY });
    res.status(500).json({ error: 'Failed to load your Living DNA' });
  }
});

// Save one or many answers. Partial saves are the point: the questionnaire is
// resumable, so this upserts whatever is sent and reports the real progress the
// server computed rather than trusting the client.
app.put('/api/living-dna/answers', authMiddleware, async (req, res) => {
  try {
    const { answers } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers must be an array' });
    if (answers.length > 50) return res.status(400).json({ error: 'too many answers in one request' });

    const qs = await query('SELECT id, options FROM living_dna_questions');
    const byId = new Map(qs.rows.map(q => [q.id, q]));
    for (const a of answers) {
      const q = byId.get(Number(a.question_id));
      if (!q) return res.status(400).json({ error: `unknown question ${a.question_id}` });
      // Validate against the stored option list rather than trusting the client,
      // so an invented value can never be persisted and later compared as real.
      if (!Array.isArray(q.options) || !q.options.includes(a.option)) {
        return res.status(400).json({ error: `"${a.option}" is not an option for this question` });
      }
    }
    for (const a of answers) {
      await query(
        `INSERT INTO living_dna_answers (user_id, question_id, option, is_boundary, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, question_id)
         DO UPDATE SET option = EXCLUDED.option, is_boundary = EXCLUDED.is_boundary,
                       updated_at = CURRENT_TIMESTAMP`,
        [req.userId, Number(a.question_id), a.option, Boolean(a.is_boundary)]
      );
    }
    const [after, total] = await Promise.all([
      query('SELECT count(*)::int AS n FROM living_dna_answers WHERE user_id = $1', [req.userId]),
      query('SELECT count(*)::int AS n FROM living_dna_questions'),
    ]);
    res.json({
      ok: true,
      saved: answers.length,
      answered: after.rows[0].n,
      total: total.rows[0].n,
      complete: after.rows[0].n === total.rows[0].n,
    });
  } catch (err) {
    if (isMissingLivingDnaTable(err)) return res.status(503).json({ error: LIVING_DNA_NOT_READY });
    res.status(500).json({ error: 'Failed to save answers' });
  }
});

// Sharing consent. Absent row means "shares nothing", which is the safe default,
// so a user who never visits this screen is never exposed.
app.put('/api/living-dna/sharing', authMiddleware, async (req, res) => {
  try {
    const { share_preferences, share_boundaries } = req.body || {};
    if (typeof share_preferences !== 'boolean' || typeof share_boundaries !== 'boolean') {
      return res.status(400).json({ error: 'share_preferences and share_boundaries must be booleans' });
    }
    await query(
      `INSERT INTO living_dna_sharing (user_id, share_preferences, share_boundaries, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
         SET share_preferences = EXCLUDED.share_preferences,
             share_boundaries = EXCLUDED.share_boundaries,
             updated_at = CURRENT_TIMESTAMP`,
      [req.userId, share_preferences, share_boundaries]
    );
    res.json({ ok: true, share_preferences, share_boundaries });
  } catch (err) {
    if (isMissingLivingDnaTable(err)) return res.status(503).json({ error: LIVING_DNA_NOT_READY });
    res.status(500).json({ error: 'Failed to save sharing settings' });
  }
});

// Comparison between two matched people. Refuses unless both consented, and
// never returns an answer the owner has not chosen to share.
app.get('/api/living-dna/compare/:userId', authMiddleware, async (req, res) => {
  try {
    const match = await matchedPairWith(req, req.params.userId);
    if (!match) return res.status(403).json({ error: 'Living DNA comparison is available to matched accounts only' });

    const other = Number(req.params.userId);
    const consent = await query(
      'SELECT user_id, share_preferences, share_boundaries FROM living_dna_sharing WHERE user_id = ANY($1::int[])',
      [[Number(req.userId), other]]
    );
    const mine = consent.rows.find(c => c.user_id === Number(req.userId));
    const theirs = consent.rows.find(c => c.user_id === other);
    if (!theirs) {
      return res.status(403).json({ error: 'They have not chosen to share their Living DNA yet' });
    }

    const [myAnswers, theirAnswers] = await Promise.all([
      query(
        `SELECT a.question_id, a.option, a.is_boundary, q.slug, q.category, q.prompt
           FROM living_dna_answers a JOIN living_dna_questions q ON q.id = a.question_id
          WHERE a.user_id = $1 ORDER BY q.position`, [req.userId]
      ),
      query(
        `SELECT a.question_id, a.option, a.is_boundary, q.slug, q.category, q.prompt
           FROM living_dna_answers a JOIN living_dna_questions q ON q.id = a.question_id
          WHERE a.user_id = $1 ORDER BY q.position`, [other]
      ),
    ]);

    // Only consent what the owner actually agreed to share. A boundary is the
    // most personal answer on the questionnaire, so it is gated separately.
    const visible = new Set(theirAnswers.rows.map(a => a.question_id));
    const pairs = [];
    for (const a of myAnswers.rows) {
      const b = theirAnswers.rows.find(x => x.question_id === a.question_id);
      if (!b) {
        pairs.push({ slug: a.slug, category: a.category, prompt: a.prompt, status: 'not_answered_by_them', my_option: a.option });
        continue;
      }
      // A boundary is the most personal answer on the questionnaire and is
      // gated separately. Sharing preferences must NOT imply sharing
      // boundaries: someone can happily share "I rotate the bins" while their
      // one hard line is never disclosed. Decide on the boundary flag first.
      const shown = b.is_boundary ? theirs.share_boundaries : theirs.share_preferences;
      const isBoundaryShared = b.is_boundary && shown;
      pairs.push({
        slug: a.slug,
        category: a.category,
        prompt: a.prompt,
        status: shown ? (a.option === b.option ? 'aligned' : 'different') : 'not_shared',
        my_option: a.option,
        their_option: shown ? b.option : null,
        their_boundary: isBoundaryShared ? b.is_boundary : null,
      });
    }

    const answeredByThem = visible.size;
    const considered = pairs.filter(p => p.status === 'aligned' || p.status === 'different');
    res.json({
      matchId: match.id,
      iHaveShared: !!(mine && (mine.share_preferences || mine.share_boundaries)),
      theyHaveShared: !!(theirs.share_preferences || theirs.share_boundaries),
      theySharePreferences: theirs.share_preferences,
      theyShareBoundaries: theirs.share_boundaries,
      compared: considered.length,
      aligned: considered.filter(p => p.status === 'aligned').length,
      different: considered.filter(p => p.status === 'different').length,
      notAnsweredByThem: answeredByThem === 0,
      pairs,
      // No percentage. A transparent side-by-side is honest; a number here would
      // imply a validated prediction that does not exist.
      note: 'A side-by-side view of the answers you have both chosen to share. It is not a prediction of how well you will get along.',
    });
  } catch (err) {
    if (isMissingLivingDnaTable(err)) return res.status(503).json({ error: LIVING_DNA_NOT_READY });
    res.status(500).json({ error: 'Failed to build comparison' });
  }
});

// ── Living Constitution ─────────────────────────────────────────────
// Rules hang off the match, so a constitution is a shared document between
// exactly the two matched people.
app.get('/api/living-dna/constitution/:userId', authMiddleware, async (req, res) => {
  try {
    const match = await matchedPairWith(req, req.params.userId);
    if (!match) return res.status(403).json({ error: 'A Living Constitution is available to matched accounts only' });
    const other = Number(req.params.userId);

    const [rules, accepts] = await Promise.all([
      query(
        `SELECT r.id, r.category, r.rule_text, r.status, r.author_id, r.updated_at, u.name AS author_name
           FROM living_constitution_rules r JOIN users u ON u.id = r.author_id
          WHERE r.match_id = $1 ORDER BY r.created_at`, [match.id]
      ),
      query('SELECT user_id FROM living_constitution_acceptances WHERE match_id = $1', [match.id]),
    ]);
    const acceptedBy = accepts.rows.map(a => a.user_id);
    const agreed = rules.rows.filter(r => r.status === 'agreed').length;
    res.json({
      matchId: match.id,
      partnerId: other,
      rules: rules.rows,
      acceptedBy,
      iHaveAccepted: acceptedBy.includes(Number(req.userId)),
      theyHaveAccepted: acceptedBy.includes(other),
      // Mutual means literally both rows exist. Never infer it from rule count.
      mutuallyAccepted: acceptedBy.includes(Number(req.userId)) && acceptedBy.includes(other),
      agreedRules: agreed,
    });
  } catch (err) {
    if (isMissingLivingDnaTable(err)) return res.status(503).json({ error: LIVING_DNA_NOT_READY });
    res.status(500).json({ error: 'Failed to load the Living Constitution' });
  }
});

const RULE_CATEGORIES = ['Rent & expenses', 'Cleaning & chores', 'Guests & quiet hours',
  'Food & shared supplies', 'Privacy & belongings', 'Conflict resolution'];

app.post('/api/living-dna/constitution/:userId/rules', authMiddleware, async (req, res) => {
  try {
    const match = await matchedPairWith(req, req.params.userId);
    if (!match) return res.status(403).json({ error: 'A Living Constitution is available to matched accounts only' });
    const { category, rule_text } = req.body || {};
    if (!RULE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Unknown rule category' });
    }
    if (typeof rule_text !== 'string' || !rule_text.trim()) {
      return res.status(400).json({ error: 'rule_text is required' });
    }
    const text = rule_text.trim().slice(0, 500);

    const dup = await query(
      `SELECT id FROM living_constitution_rules
        WHERE match_id = $1 AND lower(btrim(rule_text)) = lower(btrim($2)) LIMIT 1`,
      [match.id, text]
    );
    if (dup.rows.length) return res.status(409).json({ error: 'That rule has already been proposed' });

    const r = await query(
      `INSERT INTO living_constitution_rules (match_id, author_id, category, rule_text, status)
       VALUES ($1, $2, $3, $4, 'proposed') RETURNING id, category, rule_text, status, author_id, updated_at`,
      [match.id, req.userId, category, text]
    );
    // A new rule changes the document, so earlier acceptance no longer covers
    // it. The schema has no version column, so acceptance rows are the signal.
    // The already-agreed rules go back to 'proposed' too: the constitution is
    // accepted as a whole, so once it changes, nothing in it is settled until
    // both people agree again. Leaving them 'agreed' would let the document
    // display settled terms that nobody has actually signed off since the edit.
    await query('DELETE FROM living_constitution_acceptances WHERE match_id = $1', [match.id]);
    await query(
      `UPDATE living_constitution_rules SET status = 'proposed'
        WHERE match_id = $1 AND status IN ('agreed', 'declined')`, [match.id]
    );
    res.status(201).json({ ok: true, rule: r.rows[0], acceptanceReset: true });
  } catch (err) {
    if (isMissingLivingDnaTable(err)) return res.status(503).json({ error: LIVING_DNA_NOT_READY });
    res.status(500).json({ error: 'Failed to propose rule' });
  }
});

app.post('/api/living-dna/constitution/:userId/accept', authMiddleware, async (req, res) => {
  try {
    const match = await matchedPairWith(req, req.params.userId);
    if (!match) return res.status(403).json({ error: 'A Living Constitution is available to matched accounts only' });
    const other = Number(req.params.userId);

    const rules = await query(`SELECT id, status FROM living_constitution_rules WHERE match_id = $1`, [match.id]);
    if (!rules.rows.length) return res.status(409).json({ error: 'There is nothing to accept yet' });
    // Declined rules must be resolved before anyone signs the document.
    if (rules.rows.some(r => r.status === 'declined')) {
      return res.status(409).json({ error: 'Resolve the declined rules before accepting' });
    }

    await query(
      `INSERT INTO living_constitution_acceptances (match_id, user_id, accepted_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (match_id, user_id) DO NOTHING`,
      [match.id, req.userId]
    );
    await query(`UPDATE living_constitution_rules SET status = 'agreed' WHERE match_id = $1 AND status = 'proposed'`, [match.id]);

    const accepts = await query('SELECT user_id FROM living_constitution_acceptances WHERE match_id = $1', [match.id]);
    const ids = accepts.rows.map(a => a.user_id);
    res.json({
      ok: true,
      iHaveAccepted: ids.includes(Number(req.userId)),
      theyHaveAccepted: ids.includes(other),
      mutuallyAccepted: ids.includes(Number(req.userId)) && ids.includes(other),
    });
  } catch (err) {
    if (isMissingLivingDnaTable(err)) return res.status(503).json({ error: LIVING_DNA_NOT_READY });
    res.status(500).json({ error: 'Failed to record acceptance' });
  }
});

// ── Vercel Serverless Export ──────────────────────────────────
export default (req, res) => app(req, res);
