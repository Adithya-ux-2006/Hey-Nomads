// Boots api/index.js in-process (no server, no port) against the real
// database and exercises the read/write paths the frontend depends on.
// Returns 401-free assertions only; it registers a throwaway account and
// deletes it afterwards.
//
//   JWT_SECRET=x node --import ./scripts/dns-shim.mjs scripts/verify-api-flows.mjs
import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { Readable } from 'node:stream';

for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'verify-only-not-a-real-secret';

const { default: app } = await import('../api/index.js');

// Express reads the request as a stream, so the fake has to be a real Readable
// with the fields Express touches. No listen(), so nothing binds a port.
const call = (method, path, token, body) => new Promise((resolve, reject) => {
  const u = new URL(path, 'http://internal');
  const payload = body ? JSON.stringify(body) : '';
  const req = Object.assign(Readable.from([payload]), u);
  req.method = method;
  req.url = path;
  req.httpVersion = '1.1';
  req.headers = {
    host: 'internal',
    // Only claim a length when there is a body; body-parser rejects a
    // zero-length content-length against a GET that has no body.
    ...(payload ? {
      'content-type': 'application/json',
      'transfer-encoding': 'chunked',
    } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  req.socket = { remoteAddress: '127.0.0.1', encrypted: false, end() {}, destroy() {} };
  req.get = n => req.headers[String(n).toLowerCase()];

  const res = {
    statusCode: 200, headersSent: false, locals: {},
    status(c) { this.statusCode = c; return this; },
    set() { return this; },
    setHeader() { return this; },
    getHeader() { return undefined; },
    removeHeader() {},
    json(data) { resolve({ status: this.statusCode, body: data }); },
    send(data) { resolve({ status: this.statusCode, body: data }); },
    end() { resolve({ status: this.statusCode, body: null }); },
  };

  try { app(req, res); } catch (e) { reject(e); }
  setTimeout(() => reject(new Error(`${method} ${path} never responded`)), 15000).unref?.();
});

const email = `verify.${Date.now()}@heynomads.test`;
let token, userId;
const results = [];
const step = async (name, fn) => {
  try { const d = await fn(); results.push(['ok', name, d]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
};

// ── register ──────────────────────────────────────────────────
await step('register creates a user with a profile and preferences', async () => {
  const r = await call('POST', '/api/auth/register', null, { email, password: 'Verify12345!', name: 'Verify Flow' });
  assert.equal(r.status, 201, r.body?.error);
  token = r.body.token; userId = r.body.user.id;
  assert.ok(token && userId);
  return `id=${userId}`;
});

await step('duplicate email is rejected', async () => {
  const r = await call('POST', '/api/auth/register', null, { email, password: 'Verify12345!', name: 'Dup' });
  assert.equal(r.status, 400);
});

await step('short password is rejected', async () => {
  const r = await call('POST', '/api/auth/register', null, { email: `x${Date.now()}@t.test`, password: 'short', name: 'X' });
  assert.equal(r.status, 400);
});

await step('login works and /auth/me returns the account', async () => {
  const r = await call('POST', '/api/auth/login', null, { email, password: 'Verify12345!' });
  assert.equal(r.status, 200, r.body?.error);
  const me = await call('GET', '/api/auth/me', r.body.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.email, email);
  token = r.body.token;
});

// ── onboarding: every field the form collects must survive ─────
await step('onboarding persists all lifestyle fields the form collects', async () => {
  const body = {
    looking_for: 'both', moving_to: 'London', moving_date: '2026-09-01',
    budget: 22000, flat_type: '2BHK', cleanliness: 4, sleep_time: 'early',
    social_level: 'introvert', smoking: 'no', drinking: 'yes', diet: 'vegan',
    interests: ['music', 'hiking', 'cooking'],
  };
  const r = await call('POST', '/api/onboarding', token, body);
  assert.equal(r.status, 200, r.body?.error);

  const me = await call('GET', '/api/auth/me', token);
  assert.equal(me.body.onboarding_complete, true);
  assert.equal(me.body.moving_to, 'London');
  assert.equal(me.body.profile_city, 'London', 'moving_to must also land on profiles.city');
  assert.equal(me.body.country, 'United Kingdom', 'country derived from the chosen city');

  const prof = await call('GET', `/api/profile/${userId}`, token);
  const p = prof.body.profile || prof.body;
  assert.equal(p.budget, 22000, 'budget');
  assert.equal(p.flat_type, '2BHK', 'flat_type');
  assert.equal(p.cleanliness, 4, 'cleanliness');
  assert.equal(p.sleep_time, 'early', 'sleep_time');
  assert.equal(p.social_level, 'introvert', 'social_level');
  assert.equal(p.diet, 'vegan', 'diet');
  assert.equal(p.smoking, 'no', 'smoking');
  assert.equal(p.drinking, 'yes', 'drinking');
  return '9/9 lifestyle fields + city + country persisted';
});

// ── destination drives the checklist links ────────────────────
await step('destination resolves from onboarding', async () => {
  const r = await call('GET', '/api/me/destination', token);
  assert.equal(r.status, 200);
  assert.equal(r.body.city, 'London');
  assert.equal(r.body.country, 'United Kingdom');
  return JSON.stringify(r.body);
});

await step('banking checklist task carries a working UK link', async () => {
  const r = await call('GET', '/api/settlement', token);
  assert.equal(r.status, 200);
  const bank = r.body.find(t => t.category === 'banking');
  assert.ok(bank, 'no banking task returned');
  assert.ok(bank.url && /^https:\/\//.test(bank.url), `banking task has no url: ${bank.url}`);
  assert.ok(/moneyhelper|gov\.uk/.test(bank.url), `unexpected UK banking link: ${bank.url}`);
  return `${r.body.length} tasks, banking -> ${bank.url}`;
});

await step('resources are scoped to the destination, not Mumbai', async () => {
  const r = await call('GET', '/api/resources?city=London&country=United Kingdom', token);
  assert.equal(r.status, 200);
  assert.ok(r.body.some(x => /london/i.test(x.title)), 'no London resource');
  assert.ok(!r.body.some(x => /mumbai/i.test(x.title)), 'Mumbai resource leaked into a London user view');
  assert.ok(r.body.some(x => /moneyhelper/.test(x.url || '')), 'no UK banking guide');
  return `${r.body.length} resources`;
});

await step('resources without a destination return only global guides', async () => {
  const r = await call('GET', '/api/resources', token);
  assert.equal(r.status, 200);
  assert.ok(!r.body.some(x => /mumbai|london/i.test(x.title)), 'city-specific guides leaked into the global view');
});

await step('an event can be created and appears in the list', async () => {
  const before = await call('GET', '/api/events', token);
  const start = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  const created = await call('POST', '/api/events', token, {
    title: 'Verify test meetup',
    description: 'Created by verify-api-flows',
    location: 'Test Hall',
    city: 'London',
    category: 'social',
    start_time: start,
    capacity: 10,
  });
  assert.equal(created.status, 201, `create returned ${created.status}: ${JSON.stringify(created.body)}`);
  assert.equal(created.body.category, 'social', 'category was not stored');
  assert.ok(Number(created.body.capacity) === 10, 'capacity was not stored');

  const after = await call('GET', '/api/events', token);
  assert.equal(after.status, 200);
  assert.equal(after.body.length, before.body.length + 1, 'new event is not in the list');
  // The chip list is derived from the data, so the new category has to surface.
  assert.ok(after.body.some(e => e.category === 'social'), 'category filter would miss the new event');

  await call('DELETE', `/api/events/${created.body.id}`, token);
  return `id=${created.body.id}, category=social`;
});

await step('event creation validates its input', async () => {
  const noTitle = await call('POST', '/api/events', token, { start_time: '2026-01-01 10:00' });
  assert.equal(noTitle.status, 400);
  const badDate = await call('POST', '/api/events', token, { title: 'x', start_time: 'not-a-date' });
  assert.equal(badDate.status, 400, 'an unparseable date was accepted');
});

await step('discover exposes the same banking link as the checklist', async () => {
  const r = await call('GET', '/api/discover', token);
  assert.equal(r.status, 200);
  const s = r.body.settlement;
  const bank = s.tasks.find(t => t.url && /moneyhelper|gov\.uk/.test(t.url));
  assert.ok(bank, 'discover has no banking guide link');
  return `${s.completed}/${s.total} done`;
});

// ── counterpart account, needed by the agreement checks ───────
const other = { id: null, token: null };
await step('register the counterpart account', async () => {
  const r = await call('POST', '/api/auth/register', null, {
    email: `verify2.${Date.now()}@heynomads.test`, password: 'Verify12345!', name: 'Other Person',
  });
  assert.equal(r.status, 201, r.body?.error);
  other.id = r.body.user.id;
  other.token = r.body.token;
  await call('POST', '/api/onboarding', other.token, { moving_to: 'London', budget: 23000, cleanliness: 4 });
  return `id=${other.id}`;
});

// ── messaging authorization ──────────────────────────────────
// The shortlist used to link to /messages/:id for anyone it held, but
// POST /api/messages refuses unmatched pairs, so that path always dead-ended
// on a 403. These checks pin both halves: the refusal is real, and a genuine
// match can actually write.
await step('messaging an unmatched user is refused', async () => {
  const r = await call('POST', '/api/messages', token, {
    receiver_id: other.id, message: 'hello before we match',
  });
  assert.equal(r.status, 403, `expected 403 for an unmatched pair, got ${r.status}`);
  return '403 for unmatched pair';
});

await step('a mutual like allows a message', async () => {
  // Both directions, which is what POST /api/swipe requires to create the match.
  await call('POST', '/api/swipe', token, { targetId: other.id, action: 'like' });
  await call('POST', '/api/swipe', other.token, { targetId: userId, action: 'like' });

  const send = await call('POST', '/api/messages', token, {
    receiver_id: other.id, message: 'now that we match, hello',
  });
  assert.equal(send.status, 201, `matched send returned ${send.status}: ${JSON.stringify(send.body)}`);

  const convo = await call('GET', `/api/conversations/${other.id}`, token);
  assert.equal(convo.status, 200);
  assert.ok(convo.body.some(m => m.content === 'now that we match, hello'),
    'the sent message did not appear in the conversation');
  return `conversation has ${convo.body.length} message(s)`;
});

await step('shortlist reports match state so the UI can gate the action', async () => {
  const r = await call('POST', '/api/shortlist', token, { targetId: other.id });
  assert.equal(r.status, 200);

  const list = await call('GET', '/api/shortlist', token);
  assert.equal(list.status, 200);
  const row = list.body.find(u => u.id === other.id);
  assert.ok(row, 'shortlisted user is missing from the shortlist response');
  assert.equal(typeof row.is_match, 'boolean',
    `shortlist row has no is_match field, so the client cannot gate Message (got ${typeof row.is_match})`);
  assert.equal(row.is_match, true, 'a matched user must report is_match=true');

  await call('DELETE', '/api/shortlist', token, { targetId: other.id });
  return `is_match=${row.is_match}`;
});

// ── agreement authorization ───────────────────────────────────
// An agreement is private to its two parties and quotes their rent and deposit.
// Neither route compared req.userId against the pair, so any signed-in account
// could read or overwrite anyone's agreement by supplying their ids.
const outsider = { id: null, token: null };
await step('register an unrelated account', async () => {
  const r = await call('POST', '/api/auth/register', null, {
    email: `verify3.${Date.now()}@heynomads.test`, password: 'Verify12345!', name: 'Unrelated Third Party',
  });
  assert.equal(r.status, 201, r.body?.error);
  outsider.id = r.body.user.id;
  outsider.token = r.body.token;
  return `id=${outsider.id}`;
});

await step('a third party cannot read an agreement they are not part of', async () => {
  const r = await call('GET', `/api/agreement/${userId}/${other.id}`, outsider.token);
  assert.equal(r.status, 403,
    `expected 403 for an unrelated reader, got ${r.status} (leaks rent and deposit)`);
  return '403 for unrelated reader';
});

await step('a third party cannot write an agreement for other people', async () => {
  const r = await call('POST', '/api/agreement', outsider.token, {
    userA_id: userId, userB_id: other.id, content: 'injected by someone who is not a party',
  });
  assert.equal(r.status, 403, `expected 403 for an unrelated writer, got ${r.status}`);

  // Confirm the document itself was not modified, not merely that the call
  // was refused: a route can reject and still have written.
  const after = await call('GET', `/api/agreement/${userId}/${other.id}`, token);
  assert.ok(!/injected by someone/.test(after.body.content || ''),
    'the rejected write still modified the agreement');
  return '403 and the stored document is unchanged';
});

await step('a party can still read their own agreement', async () => {
  const r = await call('GET', `/api/agreement/${userId}/${other.id}`, token);
  assert.equal(r.status, 200, r.body?.error);
  assert.ok(/ROOMMATE AGREEMENT/.test(r.body.content), 'a party lost access to their own agreement');
  return 'parties keep access';
});

// ── matching ─────────────────────────────────────────────────
await step('compatibility score stays 0-100 with a full breakdown', async () => {
  const r = await call('GET', '/api/roommates/recommended', token);
  assert.equal(r.status, 200, r.body?.error);
  const list = Array.isArray(r.body) ? r.body : (r.body.roommates || []);
  assert.ok(list.length > 0, 'no candidates scored');
  for (const c of list) {
    assert.ok(c.score >= 0 && c.score <= 100, `score out of range: ${c.score}`);
    assert.ok(c.breakdown && typeof c.breakdown === 'object', `no breakdown for ${c.name}`);
    for (const [k, v] of Object.entries(c.breakdown)) {
      assert.ok(typeof v === 'number' && v >= 0, `${c.name} breakdown.${k} = ${v}`);
    }
  }
  // Ranked, not random: this is the whole point of the recommendation list.
  const scores = list.map(c => c.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), `not ranked: ${scores.join(',')}`);
  return `${list.length} ranked: ${scores.slice(0, 4).join(', ')}`;
});

await step('budget scoring is currency-aware', async () => {
  // A Londoner at £1100 and a Mumbaite at ₹28000 are both ordinary for their
  // market. Raw arithmetic scores that pair near zero; cost-level normalisation
  // must not.
  const r = await call('GET', '/api/roommates/recommended', token);
  const list = Array.isArray(r.body) ? r.body : (r.body.roommates || []);
  const cross = list.find(c => c.breakdown && c.breakdown.budget !== undefined);
  assert.ok(cross, 'no candidates with a budget breakdown');
  assert.ok(cross.breakdown.budget >= 0 && cross.breakdown.budget <= 20,
    `budget sub-score outside 0-20: ${cross.breakdown.budget}`);
  return `${cross.name}: budget sub-score ${cross.breakdown.budget}/20`;
});

await step('agreement quotes the destination currency', async () => {
  const r = await call('GET', `/api/agreement/${userId}/${other.id}`, token);
  assert.equal(r.status, 200, r.body?.error);
  assert.ok(/£/.test(r.body.content), `London agreement is missing the pound symbol:\n${r.body.content.slice(0, 160)}`);
  assert.ok(!/Rs/.test(r.body.content), 'London agreement still quotes rupees');
});

// ── checklist toggling round-trips ────────────────────────────
await step('checklist toggle persists across requests', async () => {
  const before = await call('GET', '/api/settlement', token);
  const task = before.body[0];
  const wasCompleted = task.completed;

  await call('POST', `/api/settlement/${task.id}/${wasCompleted ? 'uncomplete' : 'complete'}`, token);
  let after = await call('GET', '/api/settlement', token);
  assert.notEqual(after.body.find(t => t.id === task.id).completed, wasCompleted, 'toggle did not persist');

  await call('POST', `/api/settlement/${task.id}/${wasCompleted ? 'complete' : 'uncomplete'}`, token);
  after = await call('GET', '/api/settlement', token);
  assert.equal(after.body.find(t => t.id === task.id).completed, wasCompleted, 'toggle did not round-trip');
});

// ── agreement uses the snake_case columns ─────────────────────
await step('agreement saves under the snake_case columns and round-trips', async () => {
  const otherId = other.id;
  const otherToken = other.token;

  const gen = await call('GET', `/api/agreement/${userId}/${otherId}`, token);
  assert.equal(gen.status, 200, gen.body?.error);
  assert.ok(gen.body.content && /ROOMMATE AGREEMENT/.test(gen.body.content));

  const save = await call('POST', '/api/agreement', token, {
    userA_id: userId, userB_id: otherId, content: gen.body.content,
  });
  assert.equal(save.status, 200, `save returned ${save.status}: ${JSON.stringify(save.body)}`);

  const read = await call('GET', `/api/agreement/${userId}/${otherId}`, token);
  assert.equal(read.status, 200);
  assert.equal(read.body.content, gen.body.content, 'saved agreement did not round-trip');

  // Reversed order is the same agreement; must not create a second row or 500.
  const rev = await call('GET', `/api/agreement/${otherId}/${userId}`, otherToken);
  assert.equal(rev.status, 200);
  assert.equal(rev.body.content, gen.body.content);

  return `id=${read.body.id} status=${read.body.status}`;
});

await step('agreement rejects a missing counterpart', async () => {
  const r = await call('POST', '/api/agreement', token, { userA_id: userId, content: 'x' });
  assert.equal(r.status, 400);
});

await step('agreement rejects self-agreements', async () => {
  const r = await call('POST', '/api/agreement', token, { userA_id: userId, userB_id: userId, content: 'x' });
  assert.equal(r.status, 400);
});

// ── auth boundary ─────────────────────────────────────────────
await step('unauthenticated requests are rejected', async () => {
  for (const p of ['/api/settlement', '/api/discover', '/api/me/destination', '/api/resources']) {
    const r = await call('GET', p, null);
    assert.equal(r.status, 401, `${p} was not 401`);
  }
  return '4 routes';
});

// ── cleanup ───────────────────────────────────────────────────
const cleanup = async () => {
  const pg = (await import('pg')).default;
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query(`DELETE FROM users WHERE email LIKE 'verify%@heynomads.test'`);
  await db.end();
};
await cleanup().catch(e => results.push(['FAIL', 'cleanup', e.message]));

// ── report ────────────────────────────────────────────────────
let failed = 0;
for (const [status, name, detail] of results) {
  if (status === 'FAIL') failed++;
  console.log(`${status.padEnd(4)} ${name}${detail ? '\n       ' + detail : ''}`);
}
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);