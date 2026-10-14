// Competition presentation scenario.
//
// Proves a presentation slice can be shown end to end on isolated synthetic
// accounts while the real matching engine does the work, and that nothing it
// returns exposes a real user or private data. Run through qa-local so the
// test-database guard, the server lifecycle and the port checks are the same
// ones every other suite uses:
//
//   node scripts/qa-local.mjs --suite presentation
//
// The presenting account's feed is scoped to a destination no other account on
// this database uses. That keeps the slice isolated by construction instead of
// by deleting, reclassifying or blocking anyone else's rows.
import './require-test-db.mjs';
import pg from 'pg';

const API = process.env.API_BASE || 'http://127.0.0.1:3100';
const NS = `present${Date.now()}`;
const SLICE = 'Presentation Cohort';
const TAGS = ['host', 'peer1', 'peer2', 'peer3'];
const emails = TAGS.map(t => `${NS}.${t}@gmail.com`);

const accounts = [];
let passed = 0;
let failed = 0;

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const check = async (name, fn) => {
  try {
    const d = await fn();
    passed++;
    console.log(`  ok   ${name}${d ? ' - ' + d : ''}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${name}\n         ${String(err.message).split('\n')[0]}`);
  }
};

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const keySet = (node, out = new Set()) => {
  if (Array.isArray(node)) node.forEach(n => keySet(n, out));
  else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) { out.add(k); keySet(node[k], out); }
  }
  return out;
};

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();

console.log('\nCOMPETITION PRESENTATION\n');

try {
  await check('a synthetic cohort is created on the isolated test database', async () => {
    for (const tag of TAGS) {
      const email = `${NS}.${tag}@gmail.com`;
      const { status, data } = await call('/auth/register', {
        method: 'POST',
        body: { email, password: 'Verify12345!', name: `Present ${tag}` },
      });
      assert(status === 201 && data?.token,
        `register ${tag} failed: ${status} ${JSON.stringify(data)}`);
      accounts.push({ tag, email, token: data.token, id: data.user.id });
    }
    const rows = (await db.query(
      'SELECT id FROM users WHERE email = ANY($1::text[])', [emails])).rows;
    assert(rows.length === accounts.length,
      `expected ${accounts.length} rows, found ${rows.length}`);
    return `${accounts.length} accounts, host id=${accounts[0].id}`;
  });

  await check('every account finishes onboarding through the real endpoint', async () => {
    // Values come from the app's own enums: profiles_diet_check only accepts
    // veg/nonveg/eggetarian/vegan, and smoking/drinking only yes/no.
    const body = {
      moving_to: SLICE,
      budget: 980,
      cleanliness: 4,
      sleep_time: 'early',
      diet: 'veg',
      social_level: 'moderate',
      smoking: 'no',
      drinking: 'no',
      interests: ['hiking', 'cooking', 'music'],
    };
    for (const a of accounts) {
      const { status, data } = await call('/onboarding', {
        method: 'POST', token: a.token, body,
      });
      assert(status === 200 && data?.ok,
        `onboarding ${a.tag} failed: ${status} ${JSON.stringify(data)}`);
    }
    const done = (await db.query(
      'SELECT count(*)::int n FROM users WHERE email = ANY($1::text[]) AND onboarding_complete',
      [emails])).rows[0].n;
    assert(done === accounts.length, `only ${done}/${accounts.length} completed onboarding`);
    return `${done}/${accounts.length} complete`;
  });

  const feed = async () => (await call(
    `/roommates/recommended?city=${encodeURIComponent(SLICE)}`,
    { token: accounts[0].token }));

  await check('the real matching engine ranks the cohort instead of canned data', async () => {
    const { status, data } = await feed();
    assert(status === 200, `feed returned ${status}`);
    assert(Array.isArray(data) && data.length > 0, 'the presentation feed was empty');
    const cohort = new Set(accounts.map(a => a.id));
    for (const card of data) {
      assert(cohort.has(card.id),
        `feed surfaced an account outside the cohort: id=${card.id} name=${card.name}`);
      assert(Number(card.score) > 0, `${card.name} scored ${card.score}`);
      assert(Array.isArray(card.reasons) && card.reasons.length > 0,
        `${card.name} has no matching reason`);
      assert(String(card.reasons[0]?.text || '').length > 0,
        `${card.name} has an empty matching reason`);
    }
    return `${data.length} cards, top reason "${data[0].reasons[0].text}"`;
  });

  await check('the presentation payload exposes no real user or private data', async () => {
    const { data } = await feed();
    assert(Array.isArray(data) && data.length > 0,
      'nothing to inspect: the feed was empty, so this would pass vacuously');
    const keys = keySet(data);
    for (const forbidden of ['email', 'password', 'password_hash', 'token', 'DATABASE_URL']) {
      assert(!keys.has(forbidden), `payload exposes "${forbidden}"`);
    }
    const raw = JSON.stringify(data);
    assert(!raw.includes('@gmail.com'), 'an email address leaked into the feed');
    assert(!raw.includes(NS), 'the presentation namespace leaked into the feed');
    return `${keys.size} keys, none of them credentials`;
  });

  await check('a mutual like between cohort members produces a real match', async () => {
    const [host, peer] = accounts;
    await call('/swipe', {
      method: 'POST', token: host.token, body: { targetId: peer.id, action: 'like' },
    });
    const second = await call('/swipe', {
      method: 'POST', token: peer.token, body: { targetId: host.id, action: 'like' },
    });
    assert(second.status === 200, `second like returned ${second.status}`);
    const { data: matches } = await call('/matches', { token: host.token });
    assert(Array.isArray(matches), `matches returned ${JSON.stringify(matches).slice(0, 80)}`);
    const hit = matches.find(m => Number(m.partner_id) === peer.id);
    assert(hit, 'the mutual like did not produce a match');
    const matchKeys = keySet(matches);
    assert(!matchKeys.has('email') && !matchKeys.has('password'),
      'the matches payload exposes a credential field');
    return `matched with ${hit.partner_name}`;
  });

  await check('the labelled demo surface never returns credentials', async () => {
    const { status, data } = await call('/demo/profiles');
    assert(status === 200, `demo profiles returned ${status}`);
    assert(Array.isArray(data), 'demo profiles was not a list');
    for (const row of data) {
      assert(row.is_demo === true, `demo row without an is_demo label: ${row.name}`);
      assert(!('email' in row) && !('password' in row),
        `demo row exposes credentials for ${row.name}`);
    }
    return `${data.length} labelled demo rows, none with credentials`;
  });

  await check('no unauthenticated admin or seed control is reachable', async () => {
    for (const p of ['/seed', '/admin', '/admin/users', '/reset', '/wipe']) {
      const { status } = await call(p);
      assert([401, 403, 404].includes(status), `${p} answered ${status}`);
    }
    return 'no admin surface';
  });

  await check('every synthetic account is removed again', async () => {
    const before = (await db.query(
      'SELECT count(*)::int n FROM users WHERE email = ANY($1::text[])', [emails])).rows[0].n;
    await db.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);
    const after = (await db.query(
      'SELECT count(*)::int n FROM users WHERE email = ANY($1::text[])', [emails])).rows[0].n;
    assert(after === 0, `${after} cohort row(s) survived deletion`);
    return `removed ${before} of ${before}`;
  });
} finally {
  // A failed run must not leave its cohort behind on the shared test database.
  await db.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]).catch(() => {});
  await db.end();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('PRESENTATION_OK');
