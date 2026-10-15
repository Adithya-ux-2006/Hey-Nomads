// Matching regression.
//
// Reproduces the defect this file exists to prevent: the profiles table fills
// every lifestyle column with a default the moment a user is created (smoking
// 'no', drinking 'no', diet 'veg', cleanliness 3, budget 15000). The scorer
// awards points for answers MATCHING, so two accounts that had never answered
// anything scored a perfect 25/25 on lifestyle, a full 20/20 on budget, and were
// handed reason strings such as "Same sleep schedule" and "Both veg eaters" for
// questions they had never been asked. They outranked people who had actually
// answered.
//
// Run: node --import ./scripts/dns-shim.mjs scripts/verify-matching.mjs
// Needs DATABASE_URL pointing at the approved isolated test database and a free
// port on 127.0.0.1:3100. This script starts and stops its own API.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';
import './require-test-db.mjs';

const BASE = process.env.API_BASE || 'http://127.0.0.1:3100';
const NS = `mt${Date.now()}`;
const emails = [];

let passed = 0, failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`); }
};

const apiOut = [];
const api = spawn(process.execPath, ['--import', './scripts/dns-shim.mjs', 'scripts/local-api.mjs'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, LOCAL_API_PORT: String(new URL(BASE).port || 3100) },
});
api.stdout.on('data', d => apiOut.push(String(d)));
api.stderr.on('data', d => apiOut.push(String(d)));
const stopApi = () => { try { api.kill(); } catch { /* already gone */ } };
process.on('exit', stopApi);

const wait = ms => new Promise(r => setTimeout(r, ms));
let up = false;
for (let i = 0; i < 60; i++) {
  if (api.exitCode !== null) break;
  try { await fetch(`${BASE}/api/health`); up = true; break; } catch { await wait(1000); }
}
if (!up) {
  console.error('API did not come up on ' + BASE);
  console.error(apiOut.join('').slice(0, 2000));
  stopApi();
  process.exit(1);
}

const H = t => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });
async function reg(key) {
  const email = `${NS}.${key}@gmail.com`;
  emails.push(email);
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Verify12345!', name: `Mt ${key}` }),
  });
  assert.ok(r.status === 200 || r.status === 201, `register ${key} -> ${r.status}`);
  const j = await r.json();
  return { token: j.token, id: j.user.id, email: j.user.email };
}

const saveProfile = async (tok, body) => {
  const r = await fetch(`${BASE}/api/profile`, { method: 'POST', headers: H(tok), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  assert.ok(r.status === 200 || r.status === 201, `save profile -> ${r.status} ${j.error || ''}`);
};
// Reads a wide page by default. The feed now scores a pool wider than one page
// and returns the best of it, so a zero-scoring account falls out of the top 20.
// The scorer assertions below need to see those rows, so they ask for them.
async function feed(tok, opts = {}) {
  const qs = new URLSearchParams({ limit: '60', ...opts }).toString();
  const r = await fetch(`${BASE}/api/roommates/recommended?${qs}`, { headers: H(tok) });
  assert.equal(r.status, 200, `feed -> ${r.status}`);
  const rows = await r.json();
  const byId = new Map(rows.map(x => [String(x.id), x]));
  return { rows, byId };
}

async function discover(tok) {
  const r = await fetch(`${BASE}/api/discover`, { headers: H(tok) });
  assert.equal(r.status, 200, `discover -> ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.roommates) ? j.roommates : [];
}

// Shared, fully-answered, deliberately compatible lifestyle.
const compatible = {
  sleep_time: 'late', cleanliness: 4, smoking: 'no', drinking: 'no',
  social_level: 'moderate', diet: 'vegan', noise_tolerance: 'moderate',
  flat_type: 'shared', pets: 'no', work_schedule: 'regular',
  budget: 1200, move_in_date: '2026-11-01', city: 'Lisbon',
  neighbourhood: 'Alfama', preferred_neighbourhood: 'Alfama',
  interests: ['running', 'cooking'],
};
const conflicting = {
  sleep_time: 'early', cleanliness: 1, smoking: 'yes', drinking: 'yes',
  social_level: 'extrovert', diet: 'nonveg', noise_tolerance: 'loud',
  flat_type: 'studio', pets: 'yes', work_schedule: 'nights',
  budget: 4000, move_in_date: '2028-01-01', city: 'Oslo',
  neighbourhood: 'Grünerløkka', preferred_neighbourhood: 'Grøndalen',
  interests: ['skydiving'],
};

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

try {
  console.log('matching regression\n');

  // 1. Never-answered accounts. They keep the schema defaults.
  const blankA = await reg('blankA');
  const blankB = await reg('blankB');
  // 2. Fully answered, deliberately compatible.
  const okA = await reg('okA');
  const okB = await reg('okB');
  // 3. Fully answered, deliberately conflicting.
  const badA = await reg('badA');
  const badB = await reg('badB');

  await saveProfile(okA.token, compatible);
  await saveProfile(okB.token, compatible);
  await saveProfile(badA.token, conflicting);
  await saveProfile(badB.token, conflicting);

  const reasonsOf = (row, id) => (row.byId.get(String(id))?.reasons || []).map(r => r.text);
  const scoreOf = (row, id) => row.byId.get(String(id))?.score ?? null;

  const fBlank = await feed(blankA.token);
  const fOk = await feed(okA.token);
  const fBad = await feed(badA.token);

  // Self and duplicates.
  check('requester is never recommended to themselves',
    fBlank.rows.every(r => String(r.id) !== String(blankA.id)));
  check('no candidate appears twice',
    new Set(fOk.rows.map(r => String(r.id))).size === fOk.rows.length);

  // The defect: placeholders earning points.
  const blankScore = scoreOf(fBlank, blankB.id);
  const okScore = scoreOf(fOk, okB.id);
  const badScore = scoreOf(fBad, badB.id);
  check('never-answered account scores no lifestyle points', blankScore !== null && fBlank.byId.get(String(blankB.id)).breakdown.lifestyle === 0,
    `lifestyle=${fBlank.byId.get(String(blankB.id))?.breakdown?.lifestyle}`);
  check('never-answered account earns no habits points', fBlank.byId.get(String(blankB.id)).breakdown.habits === 0);
  check('never-answered pair gets no fabricated reasons', reasonsOf(fBlank, blankB.id).length === 0,
    reasonsOf(fBlank, blankB.id).join(' | '));
  check('compatible pair outranks the never-answered pair',
    okScore !== null && blankScore !== null && okScore > blankScore,
    `compatible=${okScore} blank=${blankScore}`);
  check('compatible pair outranks the conflicting pair',
    okScore !== null && badScore !== null && okScore > badScore,
    `compatible=${okScore} conflicting=${badScore}`);
  check('compatible pair is explained by real reasons',
    reasonsOf(fOk, okB.id).length > 0, reasonsOf(fOk, okB.id).join(' | '));

  // A missing optional answer must not silently make a user incompatible, and
  // must not be reported as though the person had answered it.
  await saveProfile(blankB.token, { city: 'Lisbon' });
  const fPartial = await feed(blankA.token);
  const partialRow = fPartial.byId.get(String(blankB.id));
  check('a profile with one answer is still recommended', partialRow !== undefined);

  // A partial save must not erase the answers already stored. Every omitted
  // field used to fall back to its schema default, so editing a bio reset
  // smoking, diet and budget to "unanswered".
  await saveProfile(okB.token, { city: 'Lisbon' });
  const fKept = await feed(okA.token);
  const keptRow = fKept.byId.get(String(okB.id));
  check('a partial save keeps the earlier answers',
    keptRow?.score === okScore, `before=${okScore} after partial=${keptRow?.score}`);
  check('a partial save keeps the earlier reasons',
    reasonsOf(fKept, okB.id).length === reasonsOf(fOk, okB.id).length,
    reasonsOf(fKept, okB.id).join(' | '));

  // A value that IS sent must change the next search.
  await saveProfile(okB.token, { ...compatible, budget: 9000 });
  const fChanged = await feed(okA.token);
  const changedRow = fChanged.byId.get(String(okB.id));
  check('changing a saved answer changes the next score',
    changedRow?.score !== okScore, `unchanged=${okScore} changed=${changedRow?.score}`);

  // Restore, then confirm the feed is stable across a repeat request.
  await saveProfile(okB.token, compatible);
  const fRestored = await feed(okA.token);
  check('restoring the answers restores the score',
    scoreOf(fRestored, okB.id) === okScore, `restored=${scoreOf(fRestored, okB.id)}`);

  // Discover and Roommates used to keep separate copies of the candidate
  // query, and the copies drifted: Discover re-showed people you had already
  // liked and sampled only the newest twenty accounts before scoring, so the
  // two screens disagreed about the same person. They share one selection now.
  const dOk = await discover(okA.token);
  const feedTop = fRestored.rows.slice(0, 5).map(r => String(r.id)).join(',');
  const discTop = dOk.map(r => String(r.id)).join(',');
  check('Discover and Roommates rank the same people',
    discTop === feedTop, `discover=[${discTop}] roommates=[${feedTop}]`);

  // An already-liked person must leave BOTH feeds. On Discover this used to
  // survive, because the old query filtered only passes.
  const target = fRestored.rows[0];
  const swipe = await fetch(`${BASE}/api/swipe`, {
    method: 'POST', headers: H(okA.token),
    body: JSON.stringify({ targetId: target.id, action: 'like' }),
  });
  check('the like was accepted', swipe.status === 200, `swipe -> ${swipe.status}`);
  const afterFeed = await feed(okA.token);
  const afterDisc = await discover(okA.token);
  check('an already-liked person leaves the Roommates feed',
    !afterFeed.byId.has(String(target.id)));
  check('an already-liked person leaves Discover too',
    !afterDisc.some(r => String(r.id) === String(target.id)),
    afterDisc.map(r => r.id).join(','));
} catch (err) {
  failed++;
  console.log(`  FAIL  unexpected error: ${err.message}`);
} finally {
  await db.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);
  const residue = await db.query('SELECT count(*)::int n FROM users WHERE email = ANY($1::text[])', [emails]);
  await db.end();
  stopApi();
  console.log(`\ncleanup: ${residue.rows[0].n} residue`);
  console.log(`${passed} passed, ${failed} failed`);
  if (!failed) console.log('matching regression passed');
  process.exit(failed ? 1 : 0);
}
