// The guided walkthrough, end to end: the real user-facing presentation.
//
// presentation-qa.mjs proves a presentation *slice* can be served on isolated
// accounts. This proves the thing a judge actually clicks through - the session
// gate, the four-step journey, and that authorization is enforced by the server
// rather than hidden in the UI. Run it the same way as the other suites:
//
//   node scripts/qa-local.mjs --suite flow
//
// Everything is built through the product's own public endpoints. There is no
// seeding call here: register, onboarding and profile are what the page uses,
// and this script uses them too.
import './require-test-db.mjs';
import pg from 'pg';
import { COHORT, NS, emailFor, onboardingBody, profileBody } from '../src/lib/presentation-cohort.js';

const API = process.env.API_BASE || 'http://127.0.0.1:3100';
const EMAILS = COHORT.map(c => emailFor(c.role));
const NAMES = new Set(COHORT.map(c => c.name));
const PASSWORD = `Walk${Date.now()}9x!`; // 8-72 chars, satisfies the register contract

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

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const provision = async () => {
  for (const account of COHORT) {
    const email = emailFor(account.role);
    let token = null;
    const reg = await call('/auth/register', {
      method: 'POST',
      body: { email, password: PASSWORD, name: account.name },
    });
    if (reg.status === 201) token = reg.data.token;
    else {
      const login = await call('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
      if (login.status === 200) token = login.data.token;
    }
    assert(token, `could not open ${email} (${reg.status}/${reg.data?.error || ''})`);
    await call('/onboarding', { method: 'POST', token, body: onboardingBody(account) });
    await call('/profile', { method: 'POST', token, body: profileBody(account) });
  }
};

let probeId = null;

console.log('\nGUIDED PRESENTATION WALKTHROUGH\n');

try {
  await check('the cohort on this database is exactly the four presentation addresses', async () => {
    const rows = (await db.query(
      `SELECT id, email FROM users WHERE email LIKE 'qa.present.%'`
    )).rows;
    for (const r of rows) {
      assert(EMAILS.includes(r.email), `unexpected address in the presentation namespace: ${r.email}`);
    }
    const ids = rows.map(r => r.id);
    if (ids.length > 0) {
      // Isolation is the whole claim. If any decision or thread links the cohort
      // to a non-cohort account, abort rather than delete our way past it.
      const crossSwipes = (await db.query(
        `SELECT 1 FROM swipes
          WHERE (swiper_id = ANY($1::int[]) OR swiped_id = ANY($1::int[]))
            AND (swiper_id <> ALL($1::int[]) OR swiped_id <> ALL($1::int[]))
          LIMIT 1`, [ids])).rows;
      assert(crossSwipes.length === 0, 'a cohort swipe references a non-cohort account');
      const crossMatches = (await db.query(
        `SELECT 1 FROM matches
          WHERE (user_a_id = ANY($1::int[]) OR user_b_id = ANY($1::int[]))
            AND (user_a_id <> ALL($1::int[]) OR user_b_id <> ALL($1::int[]))
          LIMIT 1`, [ids])).rows;
      assert(crossMatches.length === 0, 'a cohort match references a non-cohort account');
      const blocks = (await db.query(
        'SELECT 1 FROM blocks WHERE blocker_id = ANY($1::int[]) OR blocked_id = ANY($1::int[]) LIMIT 1',
        [ids])).rows;
      assert(blocks.length === 0, 'a cohort account is in the block list');
    }
    // Cold start, so the readiness gate below is genuinely exercised.
    if (ids.length > 0) await db.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
    const left = (await db.query(
      `SELECT count(*)::int n FROM users WHERE email LIKE 'qa.present.%'`)).rows[0].n;
    assert(left === 0, `${left} cohort row(s) survived the cold start`);
    return `inventory verified, ${ids.length} row(s) cleared`;
  });

  await check('the session refuses to issue a token before the cohort is ready', async () => {
    const { status, data } = await call('/presentation/session', { method: 'POST' });
    assert(status === 200, `session answered ${status}`);
    assert(data.ready === false, `expected ready:false on a cold start, got ${JSON.stringify(data)}`);
    assert(!data.token, 'a token was issued before the cohort existed');
    assert(!data.user, 'a user was handed back before the cohort existed');
    return 'ready:false, no token';
  });

  await check('the walkthrough builds the cohort through the public endpoints', async () => {
    await provision();
    const rows = (await db.query(
      `SELECT email, onboarding_complete FROM users WHERE email = ANY($1::text[])`, [EMAILS])).rows;
    assert(rows.length === 4, `only ${rows.length} of 4 accounts exist`);
    assert(rows.every(r => r.onboarding_complete), 'an account has not finished onboarding');
    return '4 accounts registered, onboarded and filled in';
  });

  await check('the session issues a scoped token once every profile is ready', async () => {
    const { status, data } = await call('/presentation/session', { method: 'POST' });
    assert(status === 200, `session answered ${status}`);
    assert(data.ready === true, 'session is still not ready');
    assert(typeof data.token === 'string' && data.token.split('.').length === 3, 'token is not a JWT');
    assert(Number.isInteger(data.user?.id), 'no host user id');
    return `host id ${data.user.id}`;
  });

  let presToken;
  {
    const { data } = await call('/presentation/session', { method: 'POST' });
    presToken = data.token;
  }

  await check('a presentation token is refused by every ordinary endpoint', async () => {
    for (const p of ['/matches', '/roommates/recommended', '/profile', '/conversations', '/messages']) {
      const { status } = await call(p, { token: presToken });
      assert(status === 403, `${p} answered ${status} to a presentation token`);
    }
    return '5 ordinary endpoints refused it';
  });

  await check('an ordinary account token is refused by the presentation routes', async () => {
    const email = `qa.probe.${Date.now()}@gmail.com`;
    const reg = await call('/auth/register', {
      method: 'POST', body: { email, password: PASSWORD, name: 'Probe' },
    });
    assert(reg.status === 201, `probe register answered ${reg.status}`);
    probeId = reg.data.user.id;
    const { status } = await call('/presentation/discover', { token: reg.data.token });
    assert(status === 403, `presentation discover answered ${status} to an ordinary token`);
    return 'ordinary token refused with 403';
  });

  await check('the presentation routes require a token at all', async () => {
    for (const p of ['/presentation/discover', '/presentation/matches', '/presentation/reset']) {
      const { status } = await call(p, { method: p.includes('reset') ? 'POST' : 'GET' });
      assert(status === 401, `${p} answered ${status} with no token`);
    }
    return '3 routes answered 401';
  });

  let feed = [];

  await check('the feed returns only synthetic profiles scored by the real engine', async () => {
    const { status, data } = await call('/presentation/discover', { token: presToken });
    assert(status === 200, `discover answered ${status}`);
    assert(Array.isArray(data) && data.length === 3, `expected 3 candidates, got ${data?.length}`);
    for (const card of data) {
      assert(card.id && card.name && Number.isFinite(card.score), 'a card is missing its identity or score');
      assert(card.score > 0, `${card.name} scored ${card.score} - the engine produced nothing`);
      assert(!('email' in card) && !('password' in card), `a card exposes credentials for ${card.name}`);
      assert(Array.isArray(card.reasons), `${card.name} has no reasons`);
    }
    assert(data.every(c => NAMES.has(c.name)), 'a non-cohort name reached the feed');
    feed = data;
    return `${data.length} cards, top score ${feed[0].score}`;
  });

  await check('the candidate detail exposes the reasoning behind the score', async () => {
    const { status, data } = await call(`/presentation/candidates/${feed[0].id}`, { token: presToken });
    assert(status === 200, `candidate answered ${status}`);
    assert(Number.isFinite(data.score) && data.breakdown && typeof data.breakdown === 'object',
      'no score or breakdown');
    assert(Array.isArray(data.reasons), 'no reasons');
    assert(data.is_match === false && data.my_action === null, 'a fresh candidate is already decided');
    assert(!('email' in data), 'detail exposes the email address');
    return `${data.score}% with ${Object.keys(data.breakdown).length} scored dimensions`;
  });

  let matchRow;

  await check('a like creates a mutual match carrying a real compatibility score', async () => {
    const target = feed[0];
    const liked = await call('/presentation/like', {
      method: 'POST', token: presToken, body: { targetId: target.id, action: 'like' },
    });
    assert(liked.status === 200 && liked.data.ok, `like answered ${liked.status}`);
    assert(liked.data.matchCreated === true, 'the mutual like did not create a match');
    const { status, data } = await call('/presentation/matches', { token: presToken });
    assert(status === 200 && data.length === 1, `expected 1 match, got ${data?.length}`);
    matchRow = data[0];
    assert(Number(matchRow.compatibility_score) > 0, 'match has no compatibility score');
    assert(matchRow.partner_name === target.name, 'match partner is not the person liked');
    return `${matchRow.partner_name} at ${matchRow.compatibility_score}%`;
  });

  await check('the thread opens with an opener and accepts a reply', async () => {
    const opened = await call(`/presentation/chat/${matchRow.partner_id}`, { token: presToken });
    assert(opened.status === 200 && Array.isArray(opened.data), `thread answered ${opened.status}`);
    assert(opened.data.length >= 1, 'the new thread is empty');
    assert(opened.data[0].content && opened.data[0].sender_id, 'the opener has no content or sender');
    const reply = await call('/presentation/chat', {
      method: 'POST', token: presToken,
      body: { peerId: matchRow.partner_id, message: 'Hi! Saturday works for me.' },
    });
    assert(reply.status === 201, `reply answered ${reply.status}`);
    const after = await call(`/presentation/chat/${matchRow.partner_id}`, { token: presToken });
    assert(after.data.length === opened.data.length + 1, 'the reply did not land in the thread');
    return `${after.data.length} messages, opener first`;
  });

  await check('reset makes the whole walkthrough repeatable', async () => {
    const { status } = await call('/presentation/reset', { method: 'POST', token: presToken });
    assert(status === 200, `reset answered ${status}`);
    const matches = await call('/presentation/matches', { token: presToken });
    assert(matches.data.length === 0, `${matches.data.length} match(es) survived reset`);
    const disc = await call('/presentation/discover', { token: presToken });
    assert(disc.data.length === 3, `feed has ${disc.data.length} cards after reset`);
    return 'matches cleared, feed restored to 3';
  });

  await check('no unauthenticated admin or seed control is reachable', async () => {
    for (const p of ['/seed', '/admin', '/admin/users', '/presentation/seed', '/presentation/reset']) {
      const { status } = await call(p, { method: p.includes('presentation') ? 'POST' : 'GET' });
      assert([401, 403, 404].includes(status), `${p} answered ${status}`);
    }
    return 'no admin surface';
  });
} finally {
  // A failed run must not leave its probe account behind. The cohort itself
  // stays: it is the presentation's own fixture and the next run reuses it.
  if (probeId) await db.query('DELETE FROM users WHERE id = $1', [probeId]).catch(() => {});
  await db.end();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('PRESENTATION_FLOW_OK');
