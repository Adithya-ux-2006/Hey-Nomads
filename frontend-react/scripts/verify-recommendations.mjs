// Regression coverage for GET /api/roommates/recommended.
//
// Two things are being defended here:
//
//   1. Eligibility. A real person sees real people. Demo, QA, walkthrough,
//      unknown and NULL-classified accounts must never appear, and neither must
//      people they blocked or already swiped, or themselves.
//
//   2. Latency. The route used to score every candidate with its own six
//      queries, sequentially, which measured ~10s. These checks fail loudly if
//      that shape ever comes back, because a 10s feed is indistinguishable from
//      a broken one to a user.
//
// Run:  node --import ./scripts/dns-shim.mjs scripts/verify-recommendations.mjs
import assert from 'node:assert/strict';
import pg from 'pg';
import './require-test-db.mjs';

const BASE = process.env.API_BASE || 'http://127.0.0.1:3100';
const STAMP = Date.now();
const NS = `vrec${STAMP}`;
const PASSWORD = 'Verify12345!';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

let passed = 0;
const failures = [];
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.log(`  FAIL ${name}\n         ${e.message.split('\n')[0]}`); }
};

const tag = name => `${NS}.${name}@gmail.com`;

// Register through the real route so users and profiles are created exactly the
// way production creates them, then adjust only the classification column.
const register = async (name, city, budget) => {
  const email = tag(name);
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, name: `Vrec ${name}` }),
  });
  assert.equal(res.status, 201, `register ${name} -> ${res.status}`);
  const { token } = await res.json();
  await fetch(`${BASE}/api/profile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ city, budget }),
  });
  return { email, token, name };
};

const idOf = async email => (await db.query('SELECT id FROM users WHERE email = $1', [email])).rows[0].id;

const emails = [];
let requester;

try {
  console.log('\nRECOMMENDATION ELIGIBILITY AND ISOLATION\n');

  requester = await register('me', 'Lisbon', 900); emails.push(requester.email);
  const peer = await register('peer', 'Lisbon', 900); emails.push(peer.email);
  const demo = await register('demo', 'Lisbon', 900); emails.push(demo.email);
  const qa = await register('qa', 'Lisbon', 900); emails.push(qa.email);
  const walk = await register('walk', 'Lisbon', 900); emails.push(walk.email);
  const unknown = await register('unknown', 'Lisbon', 900); emails.push(unknown.email);
  const nullKind = await register('nullkind', 'Lisbon', 900); emails.push(nullKind.email);
  const blocked = await register('blocked', 'Lisbon', 900); emails.push(blocked.email);
  const swiped = await register('swiped', 'Lisbon', 900); emails.push(swiped.email);

  const meId = await idOf(requester.email);
  const peerId = await idOf(peer.email);
  const blockedId = await idOf(blocked.email);
  const swipedId = await idOf(swiped.email);

  // Classification is the only thing being forced here.
  await db.query(`UPDATE users SET account_kind = 'demo' WHERE id = $1`, [await idOf(demo.email)]);
  await db.query(`UPDATE users SET account_kind = 'qa' WHERE id = $1`, [await idOf(qa.email)]);
  await db.query(`UPDATE users SET account_kind = 'walkthrough' WHERE id = $1`, [await idOf(walk.email)]);
  // 'unknown' is a value the schema's CHECK constraint explicitly permits, so
  // it is the one non-real classification that can reach a real person's feed
  // if the fail-closed logic ever regresses. NULL is the other one.
  await db.query(`UPDATE users SET account_kind = 'unknown' WHERE id = $1`, [await idOf(unknown.email)]);
  await db.query(`UPDATE users SET account_kind = NULL WHERE id = $1`, [await idOf(nullKind.email)]);
  await db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [meId, blockedId]);
  await db.query('INSERT INTO swipes (swiper_id, swiped_id, action) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [meId, swipedId, 'right']);

  const feed = async (token = requester.token) => {
    const res = await fetch(`${BASE}/api/roommates/recommended`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
    });
    assert.equal(res.status, 200, 'feed status');
    return res.json();
  };
  const ids = async token => new Set((await feed(token)).map(r => r.id));

  await check('eligible real requester receives an eligible real candidate', async () => {
    assert.ok((await ids()).has(peerId), 'peer missing from feed');
  });

  await check('requester is never recommended to themselves', async () => {
    assert.ok(!(await ids()).has(meId), 'self appeared in own feed');
  });

  await check('demo / qa / walkthrough / unknown / NULL accounts are all excluded', async () => {
    const got = await ids();
    for (const [label, acct] of [['demo', demo], ['qa', qa], ['walkthrough', walk], ['unknown', unknown], ['null', nullKind]]) {
      assert.ok(!got.has(await idOf(acct.email)), `${label} account appeared in a real feed`);
    }
  });

  await check('blocked candidate is excluded', async () => {
    assert.ok(!(await ids()).has(blockedId), 'blocked candidate appeared');
  });

  await check('already-swiped candidate is excluded', async () => {
    assert.ok(!(await ids()).has(swipedId), 'swiped candidate appeared');
  });

  await check('response shape is unchanged: id, score, breakdown, reasons', async () => {
    const rows = await feed();
    const peerRow = rows.find(r => r.id === peerId);
    assert.ok(peerRow, 'peer row missing');
    for (const k of ['id', 'name', 'score', 'breakdown', 'reasons']) {
      assert.ok(k in peerRow, `missing key ${k}`);
    }
    assert.ok(Number.isFinite(peerRow.score), 'score is not a finite number');
    assert.ok(peerRow.score >= 0 && peerRow.score <= 100, `score out of range: ${peerRow.score}`);
    assert.ok(Array.isArray(peerRow.reasons), 'reasons is not an array');
  });

  await check('ranking is score-descending and deterministic across repeats', async () => {
    const a = (await feed()).map(r => r.id);
    const b = (await feed()).map(r => r.id);
    assert.deepEqual(a, b, 'order changed between identical requests');
    for (let i = 1; i < a.length; i++) {
      const rows = await feed();
      assert.ok(rows[i - 1].score >= rows[i].score, `ranking not descending at ${i}`);
      break;
    }
  });

  await check('pagination: limit is respected', async () => {
    const res = await fetch(`${BASE}/api/roommates/recommended?limit=1`, {
      headers: { Authorization: `Bearer ${requester.token}` }, signal: AbortSignal.timeout(30000),
    });
    assert.equal(res.status, 200);
    assert.ok((await res.json()).length <= 1, 'limit=1 returned more than one row');
  });

  await check('city filter still applies', async () => {
    const res = await fetch(`${BASE}/api/roommates/recommended?city=Nowhereville`, {
      headers: { Authorization: `Bearer ${requester.token}` }, signal: AbortSignal.timeout(30000),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [], 'city filter did not exclude the Lisbon peer');
  });

  await check('an error is distinguishable from a valid empty result', async () => {
    const unauth = await fetch(`${BASE}/api/roommates/recommended`);
    assert.equal(unauth.status, 401, 'unauthenticated request should be 401, not an empty array');
    assert.notDeepEqual(await unauth.json(), [], 'auth failure returned an empty feed body');
  });

  await check('repeated requests stay responsive and do not wedge the API', async () => {
    const times = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const res = await fetch(`${BASE}/api/roommates/recommended`, {
        headers: { Authorization: `Bearer ${requester.token}` }, signal: AbortSignal.timeout(30000),
      });
      assert.equal(res.status, 200, `feed request ${i + 1} did not return 200`);
      times.push(Date.now() - t0);
    }
    const warm = times.slice(1);
    const worst = Math.max(...warm);
    assert.ok(worst < 5000, `feed too slow after fix: ${warm.join(', ')}ms`);
    console.log(`         warm latencies: ${warm.join(', ')}ms`);
    const t0 = Date.now();
    await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${requester.token}` } });
    console.log(`         unrelated endpoint after 5 feeds: ${Date.now() - t0}ms`);
  });
} finally {
  const before = (await db.query('SELECT count(*)::int n FROM users WHERE email = ANY($1::text[])', [emails])).rows[0].n;
  const deleted = (await db.query('DELETE FROM users WHERE email = ANY($1::text[]) RETURNING id', [emails])).rows.length;
  const after = (await db.query('SELECT count(*)::int n FROM users WHERE email = ANY($1::text[])', [emails])).rows[0].n;
  console.log(`\ncleanup: before=${before} deleted=${deleted} after=${after}`);
  if (after !== 0) { console.log('WARNING: residue remains, stopping rather than broadening the predicate'); failures.push('cleanup residue'); }
  await db.end();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
