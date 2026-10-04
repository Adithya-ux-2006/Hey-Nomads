// ─────────────────────────────────────────────────────────────────
// Hey Nomads — Test data seeder
//
// Usage:  node scripts/seed-test-data.mjs   (from frontend-react/)
//
// Creates 12 demo accounts (password for all: HeyNomads2026!)
// with full profiles, preferences, languages, swipes, mutual matches,
// conversations with messages, communities, events, RSVPs and some
// completed settlement tasks.
//
// Idempotent: re-running wipes previous @heynomads.app accounts
// (cascades to their swipes/matches/messages/communities/events)
// and reseeds everything fresh.
// ─────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// ── Load DATABASE_URL from .env (same file the serverless API uses)
function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('✗ .env not found and DATABASE_URL not set. Run from frontend-react/ folder.');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  console.error('✗ DATABASE_URL not found in .env');
  process.exit(1);
}

const DATABASE_URL = loadEnv();

// ── DNS fallback: system resolver may be blocked in sandboxes.
// Resolve via public DNS (8.8.8.8), then DoH (1.1.1.1), and connect
// to the IP directly with the hostname as TLS servername.
async function resolveHost(hostname) {
  try {
    const r = new dns.Resolver({ timeout: 4000, tries: 2 });
    r.setServers(['8.8.8.8', '1.1.1.1']);
    return await new Promise((res, rej) => r.resolve4(hostname, (e, a) => e ? rej(e) : res(a[0])));
  } catch { /* try DoH next */ }
  const res = await fetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
    headers: { accept: 'application/dns-json' },
  });
  const data = await res.json();
  const answer = (data.Answer || []).find(x => x.type === 1);
  if (!answer) throw new Error(`Could not resolve ${hostname} via DoH`);
  return answer.data;
}

let pool;

async function connectDb() {
  const url = new URL(DATABASE_URL);
  const hostname = url.hostname;
  const base = {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: url.port || 5432,
    database: url.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false },
  };

  // Attempt 1: normal connection via hostname
  pool = new pg.Pool({ ...base, host: hostname });
  try {
    await pool.query('SELECT 1');
    return;
  } catch (err) {
    if (!/ENOTFOUND|EAI_AGAIN/.test(err.code || err.message)) throw err;
    console.log(`⚠ System DNS could not resolve ${hostname} — falling back to public DNS...`);
    await pool.end().catch(() => {});
  }

  // Attempt 2: resolve hostname manually, connect to IP with TLS servername
  const ip = await resolveHost(hostname);
  console.log(`→ Resolved ${hostname} → ${ip}`);
  pool = new pg.Pool({
    ...base,
    host: ip,
    ssl: { rejectUnauthorized: false, servername: hostname },
  });
  await pool.query('SELECT 1');
}

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

const PASSWORD = 'HeyNomads2026!';
const EMAIL_DOMAIN = '@heynomads.app';

// daysFromNow(n) → 'YYYY-MM-DD' for DATE columns
const d = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
// ts(n, hour) → ISO timestamp for TIMESTAMP columns
const ts = (n, hour = 18, min = 0) => {
  const dt = new Date(Date.now() + n * 86400000);
  dt.setHours(hour, min, 0, 0);
  return dt.toISOString();
};

// ─────────────────────────────────────────────────────────────────
// 1. TEST USERS
// ─────────────────────────────────────────────────────────────────
const USERS = [
  {
    key: 'aarav', name: 'Aarav Mehta', email: 'aarav.mehta', age: 26,
    city: 'Mumbai', moving_to: 'Mumbai', country: 'India', university: '',
    moving_date: d(30), verification: 'identity', looking_for: 'roommate',
    occupation: 'Software Engineer', bio: 'Backend dev who loves late-night coding and early morning runs. Looking for a calm, tidy flat in Bandra or Andheri West.',
    budget: 28000, deposit: 50000, flat_type: '2BHK', occupants: 2,
    sleep_time: 'late', cleanliness: 4, diet: 'nonveg', noise_tolerance: 'moderate', noise_level: 3,
    smoking: 'no', drinking: 'yes', partying: 'medium', social_level: 'moderate',
    pets: 'no', work_schedule: 'remote', neighbourhood: 'Andheri West', preferred_neighbourhood: 'Bandra',
    gender: 'male', move_in_date: d(30),
    prefs: { preferred_gender: 'no_preference', min: 20000, max: 35000, radius: 10, smoking: 'no', drinking: 'no_preference', cleanliness: 3, sleep: 'no_preference', same_diet: false, same_sleep: false },
    languages: ['English', 'Hindi', 'Marathi'], interests: ['technology', 'fitness', 'food', 'music'],
  },
  {
    key: 'sara', name: "Sara D'Souza", email: 'sara.dsouza', age: 27,
    city: 'Mumbai', moving_to: 'Mumbai', country: 'India', university: '',
    moving_date: d(21), verification: 'email', looking_for: 'roommate',
    occupation: 'HR Manager', bio: 'Mumbai born and raised. Weekend baker, weekday corporate. Looking for a female roommate near Lower Parel.',
    budget: 32000, deposit: 60000, flat_type: '2BHK', occupants: 2,
    sleep_time: 'early', cleanliness: 5, diet: 'veg', noise_tolerance: 'quiet', noise_level: 2,
    smoking: 'no', drinking: 'yes', partying: 'low', social_level: 'moderate',
    pets: 'okay', work_schedule: 'regular', neighbourhood: 'Lower Parel', preferred_neighbourhood: 'Worli',
    gender: 'female', move_in_date: d(21),
    prefs: { preferred_gender: 'female', min: 25000, max: 40000, radius: 8, smoking: 'no', drinking: 'no_preference', cleanliness: 4, sleep: 'no_preference', same_diet: false, same_sleep: true },
    languages: ['English', 'Hindi', 'Konkani'], interests: ['cooking', 'reading', 'yoga', 'movies'],
  },
  {
    key: 'priya', name: 'Priya Sharma', email: 'priya.sharma', age: 24,
    city: 'Bangalore', moving_to: 'Bangalore', country: 'India', university: 'Christ University',
    moving_date: d(14), verification: 'university', looking_for: 'both',
    occupation: 'UX Designer', bio: 'Designer at a fintech startup. Cat person, plant mom, weekend cafe hopper. Koramangala or HSR preferred!',
    budget: 22000, deposit: 40000, flat_type: 'shared', occupants: 3,
    sleep_time: 'flexible', cleanliness: 4, diet: 'veg', noise_tolerance: 'moderate', noise_level: 3,
    smoking: 'no', drinking: 'no', partying: 'low', social_level: 'extrovert',
    pets: 'okay', work_schedule: 'hybrid', neighbourhood: 'Koramangala', preferred_neighbourhood: 'HSR Layout',
    gender: 'female', move_in_date: d(14),
    prefs: { preferred_gender: 'female', min: 15000, max: 30000, radius: 10, smoking: 'no', drinking: 'no', cleanliness: 4, sleep: 'no_preference', same_diet: false, same_sleep: false },
    languages: ['English', 'Hindi', 'Kannada'], interests: ['arts', 'photography', 'music', 'food', 'travel'],
  },
  {
    key: 'ananya', name: 'Ananya Iyer', email: 'ananya.iyer', age: 25,
    city: 'Delhi', moving_to: 'Bangalore', country: 'India', university: '',
    moving_date: d(20), verification: 'email', looking_for: 'roommate',
    occupation: 'Data Analyst', bio: 'Relocating from Delhi to Bangalore next month. Analytics nerd, true-crime podcast addict, beginner tennis player.',
    budget: 24000, deposit: 45000, flat_type: 'shared', occupants: 2,
    sleep_time: 'early', cleanliness: 4, diet: 'veg', noise_tolerance: 'moderate', noise_level: 2,
    smoking: 'no', drinking: 'yes', partying: 'low', social_level: 'introvert',
    pets: 'no', work_schedule: 'remote', neighbourhood: '', preferred_neighbourhood: 'Indiranagar',
    gender: 'female', move_in_date: d(20),
    prefs: { preferred_gender: 'female', min: 18000, max: 30000, radius: 12, smoking: 'no', drinking: 'yes', cleanliness: 4, sleep: 'early', same_diet: true, same_sleep: true },
    languages: ['English', 'Hindi', 'Tamil'], interests: ['reading', 'podcasts', 'fitness', 'technology'],
  },
  {
    key: 'arjun', name: 'Arjun Nair', email: 'arjun.nair', age: 24,
    city: 'Bangalore', moving_to: 'Bangalore', country: 'India', university: '',
    moving_date: d(25), verification: 'identity', looking_for: 'roommate',
    occupation: 'DevOps Engineer', bio: 'Kerala boy in Bangalore. Football on Sundays, filter coffee every day. Have a 2BHK in BTM, one room free.',
    budget: 18000, deposit: 36000, flat_type: '2BHK', occupants: 2,
    sleep_time: 'late', cleanliness: 3, diet: 'nonveg', noise_tolerance: 'loud', noise_level: 3,
    smoking: 'yes', drinking: 'yes', partying: 'medium', social_level: 'extrovert',
    pets: 'yes', work_schedule: 'remote', neighbourhood: 'BTM Layout', preferred_neighbourhood: 'Bellandur',
    gender: 'male', move_in_date: d(25),
    prefs: { preferred_gender: 'male', min: 12000, max: 25000, radius: 10, smoking: 'no_preference', drinking: 'no_preference', cleanliness: 3, sleep: 'no_preference', same_diet: false, same_sleep: false },
    languages: ['English', 'Hindi', 'Malayalam'], interests: ['sports', 'gaming', 'technology', 'movies'],
  },
  {
    key: 'rohan', name: 'Rohan Verma', email: 'rohan.verma', age: 21,
    city: 'Pune', moving_to: 'Melbourne', country: 'India', university: 'University of Melbourne',
    moving_date: d(45), verification: 'university', looking_for: 'both',
    occupation: 'Student', bio: 'Starting my Masters in Melbourne this year. Looking for a flatmate near campus who does not mind my guitar.',
    budget: 850, deposit: 1700, flat_type: 'shared', occupants: 2,
    sleep_time: 'late', cleanliness: 3, diet: 'eggetarian', noise_tolerance: 'moderate', noise_level: 3,
    smoking: 'no', drinking: 'no', partying: 'medium', social_level: 'extrovert',
    pets: 'no', work_schedule: 'flexible', neighbourhood: '', preferred_neighbourhood: 'Carlton',
    gender: 'male', move_in_date: d(45),
    prefs: { preferred_gender: 'no_preference', min: 600, max: 1100, radius: 15, smoking: 'no', drinking: 'no_preference', cleanliness: 3, sleep: 'no_preference', same_diet: false, same_sleep: false },
    languages: ['English', 'Hindi'], interests: ['music', 'gaming', 'travel', 'sports'],
  },
  {
    key: 'emily', name: 'Emily Watson', email: 'emily.watson', age: 27,
    city: 'Melbourne', moving_to: 'Melbourne', country: 'Australia', university: '',
    moving_date: d(15), verification: 'identity', looking_for: 'roommate',
    occupation: 'Nurse', bio: 'Nurse on rotating shifts, so I need a patient flatmate! Love the beach, brunch and my golden retriever Max.',
    budget: 950, deposit: 1900, flat_type: '2BHK', occupants: 2,
    sleep_time: 'flexible', cleanliness: 5, diet: 'nonveg', noise_tolerance: 'loud', noise_level: 2,
    smoking: 'no', drinking: 'yes', partying: 'low', social_level: 'moderate',
    pets: 'yes', work_schedule: 'night', neighbourhood: 'St Kilda', preferred_neighbourhood: 'Prahran',
    gender: 'female', move_in_date: d(15),
    prefs: { preferred_gender: 'female', min: 700, max: 1200, radius: 10, smoking: 'no', drinking: 'yes', cleanliness: 4, sleep: 'no_preference', same_diet: false, same_sleep: false },
    languages: ['English'], interests: ['fitness', 'food', 'travel', 'movies'],
  },
  {
    key: 'james', name: 'James Carter', email: 'james.carter', age: 29,
    city: 'London', moving_to: 'London', country: 'United Kingdom', university: '',
    moving_date: d(18), verification: 'work', looking_for: 'roommate',
    occupation: 'Financial Analyst', bio: 'Londoner working in Canary Wharf. Gym at 6am, football on weekends. Seeking a tidy flatmate for a Zone 2 flat.',
    budget: 1100, deposit: 2200, flat_type: '2BHK', occupants: 2,
    sleep_time: 'early', cleanliness: 5, diet: 'nonveg', noise_tolerance: 'quiet', noise_level: 2,
    smoking: 'no', drinking: 'yes', partying: 'low', social_level: 'introvert',
    pets: 'no', work_schedule: 'regular', neighbourhood: 'Canary Wharf', preferred_neighbourhood: 'Shoreditch',
    gender: 'male', move_in_date: d(18),
    prefs: { preferred_gender: 'no_preference', min: 800, max: 1400, radius: 8, smoking: 'no', drinking: 'no_preference', cleanliness: 4, sleep: 'early', same_diet: false, same_sleep: true },
    languages: ['English'], interests: ['fitness', 'sports', 'reading', 'podcasts'],
  },
  {
    key: 'maya', name: 'Maya Patel', email: 'maya.patel', age: 25,
    city: 'New York', moving_to: 'London', country: 'United States', university: '',
    moving_date: d(18), verification: 'email', looking_for: 'both',
    occupation: 'Product Designer', bio: 'NYC designer relocating to London for a new role. Museum weekends, rooftop cinemas, and too many houseplants.',
    budget: 1200, deposit: 2400, flat_type: 'shared', occupants: 2,
    sleep_time: 'flexible', cleanliness: 4, diet: 'veg', noise_tolerance: 'moderate', noise_level: 3,
    smoking: 'no', drinking: 'yes', partying: 'medium', social_level: 'extrovert',
    pets: 'okay', work_schedule: 'hybrid', neighbourhood: '', preferred_neighbourhood: 'Hackney',
    gender: 'female', move_in_date: d(18),
    prefs: { preferred_gender: 'female', min: 900, max: 1500, radius: 10, smoking: 'no', drinking: 'yes', cleanliness: 4, sleep: 'no_preference', same_diet: false, same_sleep: false },
    languages: ['English', 'Hindi', 'Gujarati'], interests: ['arts', 'photography', 'travel', 'food', 'music'],
  },
  {
    key: 'chloe', name: 'Chloe Tremblay', email: 'chloe.tremblay', age: 23,
    city: 'Toronto', moving_to: 'Toronto', country: 'Canada', university: 'University of Toronto',
    moving_date: d(10), verification: 'university', looking_for: 'both',
    occupation: 'Grad Student', bio: 'Montreal girl doing my Masters at UofT. Hockey fan, slow-coffee enthusiast, looking for a roommate downtown.',
    budget: 1000, deposit: 2000, flat_type: 'shared', occupants: 2,
    sleep_time: 'early', cleanliness: 4, diet: 'nonveg', noise_tolerance: 'moderate', noise_level: 3,
    smoking: 'no', drinking: 'yes', partying: 'medium', social_level: 'extrovert',
    pets: 'no', work_schedule: 'flexible', neighbourhood: 'The Annex', preferred_neighbourhood: 'Kensington Market',
    gender: 'female', move_in_date: d(10),
    prefs: { preferred_gender: 'no_preference', min: 700, max: 1300, radius: 10, smoking: 'no', drinking: 'no_preference', cleanliness: 3, sleep: 'no_preference', same_diet: false, same_sleep: false },
    languages: ['English', 'French'], interests: ['sports', 'food', 'reading', 'volunteering'],
  },
  {
    key: 'kabir', name: 'Kabir Singh', email: 'kabir.singh', age: 27,
    city: 'Delhi', moving_to: 'Toronto', country: 'India', university: '',
    moving_date: d(12), verification: 'email', looking_for: 'roommate',
    occupation: 'Marketing Manager', bio: 'Moving to Toronto for work in a couple of weeks. Delhi guy who loves dhaba food and long drives. Canada, here I come!',
    budget: 1100, deposit: 2200, flat_type: 'shared', occupants: 2,
    sleep_time: 'late', cleanliness: 3, diet: 'nonveg', noise_tolerance: 'loud', noise_level: 4,
    smoking: 'no', drinking: 'yes', partying: 'medium', social_level: 'extrovert',
    pets: 'no', work_schedule: 'regular', neighbourhood: '', preferred_neighbourhood: 'North York',
    gender: 'male', move_in_date: d(12),
    prefs: { preferred_gender: 'male', min: 800, max: 1400, radius: 15, smoking: 'no_preference', drinking: 'no_preference', cleanliness: 3, sleep: 'no_preference', same_diet: false, same_sleep: false },
    languages: ['English', 'Hindi', 'Punjabi'], interests: ['food', 'travel', 'music', 'sports'],
  },
  {
    key: 'daniel', name: 'Daniel Kim', email: 'daniel.kim', age: 26,
    city: 'Singapore', moving_to: 'Singapore', country: 'Singapore', university: '',
    moving_date: d(28), verification: 'work', looking_for: 'roommate',
    occupation: 'Cloud Engineer', bio: 'Korean-American engineer in SG. Weekend hiker, weekday grinder. Looking for a flatmate near one-north or CBD.',
    budget: 1600, deposit: 3200, flat_type: 'studio', occupants: 2,
    sleep_time: 'early', cleanliness: 5, diet: 'nonveg', noise_tolerance: 'quiet', noise_level: 2,
    smoking: 'no', drinking: 'no', partying: 'low', social_level: 'introvert',
    pets: 'no', work_schedule: 'regular', neighbourhood: 'Tiong Bahru', preferred_neighbourhood: 'one-north',
    gender: 'male', move_in_date: d(28),
    prefs: { preferred_gender: 'no_preference', min: 1200, max: 2000, radius: 8, smoking: 'no', drinking: 'no', cleanliness: 5, sleep: 'early', same_diet: false, same_sleep: true },
    languages: ['English', 'Korean'], interests: ['technology', 'hiking', 'food', 'podcasts'],
  },
];

// ─────────────────────────────────────────────────────────────────
// 2. RELATIONSHIPS
// ─────────────────────────────────────────────────────────────────
// Mutual likes → matches + conversations + messages
const MATCHES = [
  {
    pair: ['aarav', 'sara'], score: 87,
    messages: [
      ['sara', 'Hey Aarav! Saw we both live in Mumbai — 87% match is a great start 😄', 72],
      ['aarav', 'Hey Sara! Yes, Andheri West here. Your place sounds great — 2BHK in Lower Parel?', 70],
      ['sara', 'Yep, moving into a 2BHK near Lower Parel next month. One room is free. You okay with a female roommate?', 68],
      ['aarav', 'Totally fine by me. I work remote so I keep odd hours but I am quiet — headphones always on 😅', 50],
      ['sara', 'Perfect. Rent split would be 16k each, deposit 30k. Want to video call this weekend?', 30],
      ['aarav', 'Sounds great, Saturday 11am? Also I bake sometimes, fair warning 🍞', 24],
    ],
  },
  {
    pair: ['priya', 'ananya'], score: 91,
    messages: [
      ['ananya', 'Hi Priya! I am moving to Bangalore from Delhi next month — your profile popped up as 91% match!', 60],
      ['priya', 'Ooh hi Ananya! I am in Koramangala right now, thinking of moving to HSR. When are you arriving?', 58],
      ['ananya', 'Around the 20th. I work remote so mostly quiet days, but I do love a good weekend cafe run ☕', 55],
      ['priya', 'Okay we are going to get along. There is this third-wave place in Indiranagar you NEED to try', 40],
      ['ananya', 'Sold. Should we look at 2BHKs in HSR together? Split would be around 12k each', 26],
      ['priya', "Let's do it! I will shortlist a few places today", 20],
    ],
  },
  {
    pair: ['priya', 'arjun'], score: 74,
    messages: [
      ['arjun', 'Hey Priya! I have a 2BHK in BTM with one room free. Saw you are looking around Koramangala?', 48],
      ['priya', 'Hey! BTM is super close to Koramangala actually. Is it pet friendly? Asking for the future cat 😹', 44],
      ['arjun', 'I have a dog named Vim, he is extremely friendly. Landlord is chill about pets', 30],
      ['priya', 'A dog named Vim is the best thing I have heard all week. Can I visit this Sunday?', 22],
    ],
  },
  {
    pair: ['james', 'maya'], score: 82,
    messages: [
      ['maya', 'Hi James! I am relocating from New York to London next month — we both had Hackney/Shoreditch on our lists!', 64],
      ['james', 'Hey Maya! Nice. I live near Canary Wharf now but looking to move Zone 2. Are you familiar with London at all?', 62],
      ['maya', 'Barely! I visited once for a week. Any areas I should avoid?', 60],
      ['james', 'Honestly most of Zone 1-2 is safe. Hackney is great for creatives, and the Overground makes commutes easy', 58],
      ['maya', 'Perfect. I am vegetarian-ish, work hybrid from home 2 days a week. Dealbreaker check: are you tidy?', 55],
      ['james', 'Cleanliness 5/5, I basically Marie Kondo my flat monthly. Gym at 6am means early nights though', 52],
      ['maya', 'Early nights are fine, I do hybrid days too. Let us find a 2BHK in Hackney, split around £1100 each?', 34],
      ['james', 'Works for me. I will send you some Rightmove links tonight', 30],
    ],
  },
  {
    pair: ['chloe', 'kabir'], score: 78,
    messages: [
      ['kabir', 'Hey Chloe! Kabir here — moving to Toronto from Delhi in about 2 weeks for a marketing role', 40],
      ['chloe', 'Hey! Welcome (almost)! I am doing my Masters at UofT, living in The Annex right now', 38],
      ['kabir', 'Nice! Any tips for a newcomer? Banking, SIM, all of it feels overwhelming from here 😅', 36],
      ['chloe', 'There is a settlement checklist in this app actually — bank + SIM first. I can send you my list!', 34],
      ['kabir', 'You are a lifesaver. Also, is it too early for snow talk? 🥶', 20],
      ['chloe', 'Never. You will need a real winter jacket, not that Delhi "winter" stuff lol', 12],
    ],
  },
  {
    pair: ['emily', 'rohan'], score: 80,
    messages: [
      ['rohan', 'Hi Emily! I am starting my Masters at UniMelb this year — saw we are an 80% match!', 32],
      ['emily', 'Hey Rohan! Carlton is super close to campus. Fair warning: I do 12-hour nursing shifts so some nights are silent, some are chaotic', 30],
      ['rohan', 'That is fine, I play guitar so we can trade noise lessons 😄 Also, is Max up for a roommate?', 28],
      ['emily', 'Max would love you. He judges people by treat quality though. Saturday flat viewing?', 14],
      ['rohan', "I'll bring the good treats. See you Saturday!", 8],
    ],
  },
];

// One-way likes / passes (no match)
const ONE_WAY = [
  ['ananya', 'arjun', 'like'],
  ['daniel', 'maya', 'like'],
  ['kabir', 'maya', 'like'],
  ['sara', 'priya', 'like'],
  ['james', 'chloe', 'like'],
  ['rohan', 'priya', 'like'],
  ['aarav', 'kabir', 'pass'],
  ['emily', 'james', 'pass'],
];

// ─────────────────────────────────────────────────────────────────
// 3. COMMUNITIES & EVENTS
// ─────────────────────────────────────────────────────────────────
const COMMUNITIES = [
  { name: 'Mumbai Flatmates & Newcomers', city: 'Mumbai', country: 'India', category: 'housing', creator: 'aarav', members: ['sara', 'priya', 'kabir'], description: 'Finding flats and flatmates in Mumbai. Broker horror stories welcome, SoBo vs suburbs debates encouraged.' },
  { name: 'Bangalore Tech & Startups', city: 'Bangalore', country: 'India', category: 'professional', creator: 'priya', members: ['arjun', 'ananya', 'aarav'], description: 'Founders, engineers, designers. Monthly meetup, weekly coffee connections, zero pitch-decks allowed.' },
  { name: 'Melbourne Expats & Students', city: 'Melbourne', country: 'Australia', category: 'social', creator: 'emily', members: ['rohan'], description: 'New to Melbourne? So are half of us. Weekly coffee catchups, city walks and footy nights.' },
  { name: 'London Newcomers Club', city: 'London', country: 'United Kingdom', category: 'social', creator: 'james', members: ['maya'], description: 'Just landed in London? Join us for pub quizzes, Thames walks and figuring out the Tube together.' },
  { name: 'Toronto Sports League', city: 'Toronto', country: 'Canada', category: 'sports', creator: 'chloe', members: ['kabir'], description: 'Casual football, hockey and badminton games every week. All skill levels, zero bench warming.' },
  { name: 'Delhi Hiking Club', city: 'Delhi', country: 'India', category: 'outdoor', creator: 'kabir', members: ['ananya', 'aarav'], description: 'Weekend treks around Delhi NCR — Nag Tibba, Kheerganga, and everything in between.' },
  { name: 'Singapore Digital Nomads', city: 'Singapore', country: 'Singapore', category: 'professional', creator: 'daniel', members: [], description: 'Remote workers and nomads in SG. Coworking days, island trips and the great hawker debate.' },
  { name: 'Foodies of New York', city: 'New York', country: 'United States', category: 'food', creator: 'maya', members: ['daniel'], description: 'One dollar pizza or twelve dollar toast? Both. Monthly food crawls across the boroughs.' },
];

const EVENTS = [
  { title: 'Weekend Trek to Lonavala', city: 'Mumbai', location: 'Lonavala Railway Station', creator: 'aarav', community: 'Mumbai Flatmates & Newcomers', day: 7, start: 6, end: 18, capacity: 20, going: ['sara', 'priya'], description: 'Day trek to Tiger Point and Bhushi Dam. Carry water, snacks and good shoes. Train leaves CST at 6:40am.' },
  { title: 'Startup Networking Night', city: 'Bangalore', location: 'WeWork Koramangala', creator: 'priya', community: 'Bangalore Tech & Startups', day: 10, start: 19, end: 22, capacity: 60, going: ['ananya', 'arjun', 'aarav'], description: 'Meet founders, engineers and designers over filter coffee and pizza. No pitch decks, just conversations.' },
  { title: 'Sunset Cricket at the Oval', city: 'Melbourne', location: 'Junction Oval, St Kilda', creator: 'emily', community: 'Melbourne Expats & Students', day: 14, start: 16, end: 19, capacity: 24, going: ['rohan'], description: 'Casual cricket match followed by fish and chips. Bring a friend, equipment provided.' },
  { title: 'Thames Riverside Walk & Coffee', city: 'London', location: 'Tower Hill Station', creator: 'james', community: 'London Newcomers Club', day: 5, start: 10, end: 13, capacity: 15, going: ['maya'], description: 'Easy 5km walk from Tower Bridge to Westminster, ending at a riverside cafe. Perfect first-weekend plan.' },
  { title: 'Newcomers Potluck Dinner', city: 'Toronto', location: 'Kensington Market Community Kitchen', creator: 'chloe', community: 'Toronto Sports League', day: 12, start: 18, end: 21, capacity: 30, going: ['kabir'], description: 'Bring a dish from home and meet people from everywhere. Kitchen and cutlery provided.' },
  { title: 'Museum Day Meetup', city: 'New York', location: 'The Met, 5th Ave Entrance', creator: 'maya', community: 'Foodies of New York', day: 18, start: 11, end: 15, capacity: 20, going: ['daniel'], description: 'Pay-what-you-wish entry for NY residents. We will do the Egyptian wing and end with dollar slices.' },
  { title: 'Marina Bay Run Club', city: 'Singapore', location: 'Marina Bay Sands Boardwalk', creator: 'daniel', community: 'Singapore Digital Nomads', day: 9, start: 7, end: 9, capacity: 40, going: [], description: '5k and 10k loops at sunrise. All paces welcome, kaya toast after for those who survive.' },
  { title: 'Board Games Evening', city: 'Delhi', location: 'Cafe Deck, Hauz Khas Village', creator: 'kabir', community: 'Delhi Hiking Club', day: 6, start: 19, end: 22, capacity: 16, going: ['ananya', 'aarav'], description: 'Catan, Codenames and Uno for the brave. Order your own coffee, snacks on the house.' },
];

const SETTLEMENT_DONE = {
  aarav: [1, 2, 3],      // profile, preferences, find roommate
  sara: [1, 2, 3, 5],    // + join community
  priya: [1, 2, 5],
  james: [1, 2],
  maya: [1, 2],
  chloe: [1, 2, 8],
};

// ─────────────────────────────────────────────────────────────────
// SEED EXECUTION
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding Hey Nomads test data...\n');
  await connectDb();
  console.log('✅ Connected to database\n');

  // ── Schema repair: deployed DB may still have the legacy messages table
  // (sender_id/receiver_id/message) instead of the v2 conversation-based shape.
  const msgCols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'messages' AND table_schema = 'public'`
  );
  if (!msgCols.rows.some(r => r.column_name === 'conversation_id')) {
    console.log('🔧 Migrating legacy messages table to v2 (conversation-based) shape...');
    await query('DROP TABLE IF EXISTS messages');
    await query(`
      CREATE TABLE messages (
        id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 5000),
        read_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await query('CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (conversation_id, created_at DESC) WHERE read_at IS NULL');
    console.log('✅ messages table migrated to v2');
  }

  // ── Clean previous test data (FK cascades handle the rest)
  const prev = await query(
    `SELECT id FROM conversations c WHERE
       (SELECT COUNT(DISTINCT cm.user_id) FROM conversation_members cm
        WHERE cm.conversation_id = c.id
          AND cm.user_id NOT IN (SELECT id FROM users WHERE email LIKE $1)) < 2
       AND EXISTS (SELECT 1 FROM conversation_members cm2
                   JOIN users u ON u.id = cm2.user_id
                   WHERE cm2.conversation_id = c.id AND u.email LIKE $1)`,
    [`%${EMAIL_DOMAIN}`]
  );
  if (prev.rows.length > 0) {
    await query(`DELETE FROM messages WHERE conversation_id = ANY($1)`, [prev.rows.map(r => r.id)]);
    await query(`DELETE FROM conversations WHERE id = ANY($1)`, [prev.rows.map(r => r.id)]);
  }
  const del = await query('DELETE FROM users WHERE email LIKE $1 RETURNING id', [`%${EMAIL_DOMAIN}`]);
  console.log(`🧹 Removed ${del.rows.length} previous test users (cascaded swipes/matches/messages)`);

  // ── Languages (ensure present)
  const LANGS = ['English', 'Hindi', 'Marathi', 'Konkani', 'Kannada', 'Tamil', 'Malayalam', 'Punjabi', 'Gujarati', 'Bengali', 'Telugu', 'French', 'Korean', 'Spanish', 'Mandarin', 'Arabic'];
  const existing = await query('SELECT name FROM languages');
  const have = new Set(existing.rows.map(r => r.name));
  for (const name of LANGS) {
    if (!have.has(name)) await query('INSERT INTO languages (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
  }
  const langRows = await query('SELECT id, name FROM languages');
  const langId = Object.fromEntries(langRows.rows.map(r => [r.name, r.id]));

  // ── Users + profiles + preferences + languages
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids = {};

  for (const u of USERS) {
    const res = await query(
      `INSERT INTO users (name, email, password, age, moving_to, moving_date, university, country,
                          interests, verification_status, onboarding_complete, looking_for)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11) RETURNING id`,
      [u.name, u.email + EMAIL_DOMAIN, passwordHash, u.age, u.moving_to, u.moving_date,
       u.university || null, u.country, u.interests, u.verification, u.looking_for]
    );
    const uid = res.rows[0].id;
    ids[u.key] = uid;

    await query(
      `INSERT INTO profiles (user_id, bio, occupation, city, move_in_date, sleep_time, cleanliness,
         diet, noise_tolerance, noise_level, budget, deposit, flat_type, occupants, smoking, drinking,
         partying, social_level, pets, work_schedule, neighbourhood, preferred_neighbourhood, gender, profile_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'')`,
      [uid, u.bio, u.occupation, u.city, u.move_in_date, u.sleep_time, u.cleanliness, u.diet,
       u.noise_tolerance, u.noise_level, u.budget, u.deposit, u.flat_type, u.occupants,
       u.smoking, u.drinking, u.partying, u.social_level, u.pets, u.work_schedule,
       u.neighbourhood || null, u.preferred_neighbourhood || null, u.gender]
    );

    await query('DELETE FROM preferences WHERE user_id = $1', [uid]);
    await query(
      `INSERT INTO preferences (user_id, preferred_gender, preferred_budget_min, preferred_budget_max,
         preferred_location_radius, prefers_smoking, prefers_drinking, prefers_cleanliness_min,
         prefers_sleep_schedule, prefers_same_diet, prefers_same_sleep)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uid, u.prefs.preferred_gender, u.prefs.min, u.prefs.max, u.prefs.radius,
       u.prefs.smoking, u.prefs.drinking, u.prefs.cleanliness, u.prefs.sleep,
       u.prefs.same_diet, u.prefs.same_sleep]
    );

    for (const l of u.languages) {
      if (langId[l]) {
        await query('INSERT INTO user_languages (user_id, language_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, langId[l]]);
      }
    }
  }
  console.log(`👤 Created ${USERS.length} test users (password: ${PASSWORD})`);

  // ── Swipes
  for (const [a, b, action] of ONE_WAY) {
    await query(
      `INSERT INTO swipes (swiper_id, swiped_id, action) VALUES ($1,$2,$3)
       ON CONFLICT (swiper_id, swiped_id) DO NOTHING`,
      [ids[a], ids[b], action]
    );
  }

  // ── Matches + conversations + messages
  for (const m of MATCHES) {
    const [ka, kb] = m.pair;
    const [ua, ub] = [ids[ka], ids[kb]].sort((x, y) => x - y);
    for (const [swiper, target] of [[ka, kb], [kb, ka]]) {
      await query(
        `INSERT INTO swipes (swiper_id, swiped_id, action) VALUES ($1,$2,'like')
         ON CONFLICT (swiper_id, swiped_id) DO NOTHING`,
        [ids[swiper], ids[target]]
      );
    }
    const match = await query(
      `INSERT INTO matches (user_a_id, user_b_id, compatibility_score, status)
       VALUES ($1,$2,$3,'matched') ON CONFLICT (user_a_id, user_b_id) DO NOTHING RETURNING id`,
      [ua, ub, m.score]
    );

    const conv = await query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
    const convId = conv.rows[0].id;
    await query('INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2),($1,$3)', [convId, ua, ub]);

    const now = Date.now();
    for (const [senderKey, content, minsAgo] of m.messages) {
      await query(
        `INSERT INTO messages (conversation_id, sender_id, content, read_at, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [convId, ids[senderKey], content, minsAgo > 60 ? new Date(now - minsAgo * 60000) : null, new Date(now - minsAgo * 60000)]
      );
    }
    await query('UPDATE conversations SET updated_at = $1 WHERE id = $2',
      [new Date(now - m.messages[0][2] * 60000), convId]);
  }
  console.log(`❤️  Created ${MATCHES.length} mutual matches with ${MATCHES.reduce((n, m) => n + m.messages.length, 0)} messages, plus ${ONE_WAY.length} one-way swipes`);

  // ── Communities
  const communityIds = {};
  for (const c of COMMUNITIES) {
    const res = await query(
      `INSERT INTO communities (name, description, city, country, category, creator_id, member_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [c.name, c.description, c.city, c.country, c.category, ids[c.creator], 1 + c.members.length]
    );
    const cid = res.rows[0].id;
    communityIds[c.name] = cid;
    await query('INSERT INTO community_members (community_id, user_id, role) VALUES ($1,$2,$3)', [cid, ids[c.creator], 'creator']);
    for (const m of c.members) {
      await query('INSERT INTO community_members (community_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [cid, ids[m]]);
    }
  }
  console.log(`👥 Created ${COMMUNITIES.length} communities with members`);

  // ── Events + RSVPs
  for (const e of EVENTS) {
    const res = await query(
      `INSERT INTO events (title, description, community_id, location, city, start_time, end_time, capacity, attendee_count, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [e.title, e.description, communityIds[e.community] || null, e.location, e.city,
       ts(e.day, e.start), ts(e.day, e.end), e.capacity, e.going.length, ids[e.creator]]
    );
    for (const g of e.going) {
      await query(
        `INSERT INTO event_rsvps (event_id, user_id, status) VALUES ($1,$2,'going') ON CONFLICT DO NOTHING`,
        [res.rows[0].id, ids[g]]
      );
    }
  }
  console.log(`📅 Created ${EVENTS.length} upcoming events with RSVPs`);

  // ── Settlement progress
  let done = 0;
  for (const [userKey, taskIds] of Object.entries(SETTLEMENT_DONE)) {
    for (const taskId of taskIds) {
      await query(
        `INSERT INTO user_settlement_tasks (user_id, task_id, completed, completed_at)
         VALUES ($1,$2,TRUE,NOW()) ON CONFLICT (user_id, task_id) DO NOTHING`,
        [ids[userKey], taskId]
      );
      done++;
    }
  }
  console.log(`✅ Marked ${done} settlement tasks complete`);

  // ── Summary
  const counts = await query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE email LIKE $1) AS users,
      (SELECT COUNT(*) FROM matches WHERE status = 'matched') AS matches,
      (SELECT COUNT(DISTINCT m.id) FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
         JOIN users u ON u.id = cm.user_id WHERE u.email LIKE $1) AS messages,
      (SELECT COUNT(*) FROM communities c WHERE EXISTS (SELECT 1 FROM users u WHERE u.email LIKE $1 AND u.id = c.creator_id)) AS communities,
      (SELECT COUNT(*) FROM events e WHERE EXISTS (SELECT 1 FROM users u WHERE u.email LIKE $1 AND u.id = e.created_by)) AS events
  `, [`%${EMAIL_DOMAIN}`]);
  const c = counts.rows[0];
  console.log(`\n📊 Seeded: ${c.users} users, ${c.matches} matches, ${c.messages} messages, ${c.communities} communities, ${c.events} events`);
  console.log(`\n🔑 Login with any account, e.g.  priya.sharma${EMAIL_DOMAIN}  /  ${PASSWORD}\n`);
}

main()
  .then(() => pool?.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('\n✗ Seed failed:', err.message);
    if (err.detail) console.error(err.detail);
    await pool.end().catch(() => {});
    process.exit(1);
  });
