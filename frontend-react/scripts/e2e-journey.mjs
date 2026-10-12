// End-to-end journey against the isolated test branch only.
//
// This is the check mocked UI tests cannot make: that the real backend, real
// database and real routes agree. Sign in, discover an eligible profile, match,
// talk, then Living DNA privacy defaults and Constitution acceptance.
//
// Run: node --import ./scripts/dns-shim.mjs scripts/e2e-journey.mjs
import assert from 'node:assert/strict';
import pg from 'pg';
import './require-test-db.mjs';

const BASE = process.env.API_BASE || 'http://127.0.0.1:3100';
const STAMP = Date.now();
const NS = `e2e${STAMP}`;
const emails = [];
let passed = 0, failed = 0;
const step = async (name, fn) => {
  try { const detail = await fn(); passed++; console.log(`  ok   ${name}${detail ? ' - ' + detail : ''}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n         ${e.message.split('\n')[0]}`); }
};

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const reg = async tag => {
  const email = `${NS}.${tag}@gmail.com`;
  emails.push(email);
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Verify12345!', name: `E2E ${tag}` }),
  });
  assert.equal(r.status, 201, `register ${tag} -> ${r.status}`);
  const j = await r.json();
  await fetch(`${BASE}/api/onboarding`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${j.token}` },
    body: JSON.stringify({ moving_to: 'Lisbon', budget: 980, cleanliness: 4, sleep_time: 'early' }),
  });
  return { ...j, email };
};
const H = t => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

try {
  console.log('\nEND-TO-END JOURNEY (isolated branch)\n');

  const me = await reg('me');
  const them = await reg('them');

  await step('sign in returns a usable session', async () => {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: me.email, password: 'Verify12345!' }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok(j.token, 'no token');
    return `user ${j.user.id}`;
  });

  let feed = [];
  await step('discover returns the other account as an eligible profile', async () => {
    const r = await fetch(`${BASE}/api/roommates/recommended`, { headers: H(me.token) });
    assert.equal(r.status, 200);
    feed = await r.json();
    assert.ok(Array.isArray(feed) && feed.length > 0, 'no candidates');
    const hit = feed.find(c => c.email === them.email || c.name === 'E2E them');
    assert.ok(hit, 'the other journey account is not in the feed');
    return `${feed.length} candidates`;
  });

  let conversationUserId = null;
  await step('mutual likes create a match and a conversation', async () => {
    conversationUserId = feed.find(c => c.name === 'E2E them').id;
    const a = await fetch(`${BASE}/api/swipe`, {
      method: 'POST', headers: H(me.token),
      body: JSON.stringify({ targetId: conversationUserId, action: 'like' }),
    });
    assert.equal(a.status, 200);
    const b = await fetch(`${BASE}/api/swipe`, {
      method: 'POST', headers: H(them.token),
      body: JSON.stringify({ targetId: me.user.id, action: 'like' }),
    });
    assert.equal(b.status, 200);
    const both = await b.json();
    assert.equal(both.matchCreated, true, 'no match created');
    const m = await fetch(`${BASE}/api/matches`, { headers: H(me.token) });
    const matches = await m.json();
    assert.ok(matches.length > 0, 'match not listed');
    return 'matched';
  });

  await step('a message persists and reads back', async () => {
    const s = await fetch(`${BASE}/api/messages`, {
      method: 'POST', headers: H(me.token),
      body: JSON.stringify({ receiver_id: conversationUserId, message: 'Still looking in Lisbon?' }),
    });
    assert.equal(s.status, 201, `POST /api/messages -> ${s.status} ${await s.clone().text()}`);
    const c = await fetch(`${BASE}/api/conversations/${conversationUserId}`, { headers: H(me.token) });
    assert.equal(c.status, 200);
    const convo = await c.json();
    assert.ok(convo.some(x => x.content === 'Still looking in Lisbon?'), 'message did not persist');
    return `${convo.length} message(s)`;
  });

  await step('Living DNA answers save and report real progress', async () => {
    const q = await (await fetch(`${BASE}/api/living-dna/questions`, { headers: H(me.token) })).json();
    assert.ok(q.length > 0, 'no questions published');
    const r = await fetch(`${BASE}/api/living-dna/answers`, {
      method: 'PUT', headers: H(me.token),
      body: JSON.stringify({ answers: [{ question_id: q[0].id, option: q[0].options[0], is_boundary: false }] }),
    });
    assert.equal(r.status, 200);
    const me2 = await (await fetch(`${BASE}/api/living-dna/me`, { headers: H(me.token) })).json();
    assert.ok(me2.answered >= 1, 'progress not reported');
    return `${me2.answered}/${me2.total}`;
  });

  await step('sharing is private by default and the other side is gated', async () => {
    const mine = await (await fetch(`${BASE}/api/living-dna/me`, { headers: H(me.token) })).json();
    assert.equal(mine.sharing.share_preferences, false, 'preferences shared by default');
    assert.equal(mine.sharing.share_boundaries, false, 'boundaries shared by default');

    const res = await fetch(`${BASE}/api/living-dna/compare/${conversationUserId}`, { headers: H(me.token) });
    assert.equal(res.status, 403, `compare before consent -> ${res.status}`);
    const body = await res.json();
    assert.match(body.error, /not chosen to share/i, `unexpected reason: ${body.error}`);
    // No other person's answer text may appear anywhere in the refusal.
    assert.ok(!JSON.stringify(body).includes('bins'), 'private answer text leaked into the refusal');
    return 'refused while they share nothing';
  });

  await step('Constitution acceptance is one-sided until both accept', async () => {
    const before = await (await fetch(`${BASE}/api/living-dna/constitution/${conversationUserId}`, { headers: H(me.token) })).json();
    assert.equal(before.iHaveAccepted, false, 'accepted before accepting');
    assert.equal(before.mutuallyAccepted, false, 'mutual before anyone accepted');

    const tooEarly = await fetch(`${BASE}/api/living-dna/constitution/${conversationUserId}/accept`, { method: 'POST', headers: H(me.token) });
    assert.equal(tooEarly.status, 409, 'an empty constitution was accepted');

    const proposed = await fetch(`${BASE}/api/living-dna/constitution/${conversationUserId}/rules`, {
      method: 'POST', headers: H(me.token),
      body: JSON.stringify({ category: 'Rent & expenses', rule_text: 'Rent is 980 EUR a month, split evenly, due on the 1st.' }),
    });
    assert.ok(proposed.status < 300, `propose rule -> ${proposed.status}`);
    await fetch(`${BASE}/api/living-dna/constitution/${conversationUserId}/accept`, { method: 'POST', headers: H(me.token) });

    const afterMine = await (await fetch(`${BASE}/api/living-dna/constitution/${conversationUserId}`, { headers: H(me.token) })).json();
    assert.equal(afterMine.iHaveAccepted, true, `after accept: ${JSON.stringify(afterMine).slice(0, 180)}`);
    assert.equal(afterMine.theyHaveAccepted, false, 'the other side was accepted for me');
    assert.equal(afterMine.mutuallyAccepted, false, 'mutual claimed with one acceptance');

    const theirAccept = await fetch(`${BASE}/api/living-dna/constitution/${me.user.id}/accept`, { method: 'POST', headers: H(them.token) });
    assert.ok(theirAccept.status < 300, `their accept -> ${theirAccept.status} ${await theirAccept.clone().text()}`);
    const both = await (await fetch(`${BASE}/api/living-dna/constitution/${conversationUserId}`, { headers: H(me.token) })).json();
    assert.equal(both.mutuallyAccepted, true, 'mutual not reached after both accepted');

    // Adding a rule reopens the document for both sides.
    const reopened2 = await fetch(`${BASE}/api/living-dna/constitution/${me.user.id}/rules`, {
      method: 'POST', headers: H(them.token),
      body: JSON.stringify({ category: 'Cleaning & chores', rule_text: 'Kitchen cleaned after every use.' }),
    });
    assert.ok(reopened2.status < 300, `rule add -> ${reopened2.status}`);
    const reopened = await (await fetch(`${BASE}/api/living-dna/constitution/${conversationUserId}`, { headers: H(me.token) })).json();
    assert.equal(reopened.mutuallyAccepted, false, 'mutual survived a rule change');
    return '409 when empty, one-sided, mutual, reopened';
  });

  await step('an outsider cannot send a message either', async () => {
    const outsiderEmail = `${NS}.outsider2@gmail.com`;
    emails.push(outsiderEmail);
    const r = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: outsiderEmail, password: 'Verify12345!', name: 'E2E outsider2' }),
    });
    const { token } = await r.json();
    const s = await fetch(`${BASE}/api/messages`, {
      method: 'POST', headers: H(token),
      body: JSON.stringify({ receiver_id: conversationUserId, message: 'let me in' }),
    });
    assert.ok(s.status === 403 || s.status === 400, `outsider write got ${s.status}`);
    return `write denied with ${s.status}`;
  });

  await step('a non-journey account cannot read the conversation', async () => {
    const outsiderEmail = `${NS}.outsider@gmail.com`;
    emails.push(outsiderEmail);
    const r = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: outsiderEmail, password: 'Verify12345!', name: 'E2E outsider' }),
    });
    const { token } = await r.json();
    const c = await fetch(`${BASE}/api/conversations/${conversationUserId}`, { headers: H(token) });
    assert.ok(c.status === 403 || c.status === 404, `outsider got ${c.status}`);
    return `denied with ${c.status}`;
  });
} catch (e) {
  console.log(`\nJOURNEY ABORTED: ${e.message.split('\n')[0]}`);
  failed++;
} finally {
  const before = (await db.query('SELECT count(*)::int n FROM users WHERE email = ANY($1::text[])', [emails])).rows[0].n;
  const deleted = (await db.query('DELETE FROM users WHERE email = ANY($1::text[]) RETURNING id', [emails])).rows.length;
  const after = (await db.query('SELECT count(*)::int n FROM users WHERE email = ANY($1::text[])', [emails])).rows[0].n;
  console.log(`\ncleanup: before=${before} deleted=${deleted} after=${after}`);
  if (after !== 0) console.log('WARNING: residue remains');
  await db.end();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
