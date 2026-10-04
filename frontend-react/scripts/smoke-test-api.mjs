// API smoke test — exercises the real Hey Nomads API handler end-to-end
// using the seeded test accounts. Verifies auth, matching, messaging,
// communities, events, discover and settlement against the live database.
//
// Usage (with the API running):
//   node --import ./scripts/dns-shim.mjs scripts/local-api.mjs     # terminal 1
//   node scripts/smoke-test-api.mjs                                # terminal 2
//
// Override the target with BASE_URL=http://host:port

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const EMAIL = process.env.SMOKE_EMAIL || 'priya.sharma@heynomads.app';
const PASSWORD = process.env.SMOKE_PASSWORD || 'HeyNomads2026!';

let passed = 0;
let failed = 0;

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 120); }
  return { status: res.status, body: json };
}

function check(label, ok, detail = '') {
  if (ok) { passed++; console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

console.log(`\n🔍 Smoke testing ${BASE}\n`);

// ── 1. Health
console.log('Health');
const health = await call('GET', '/api/health');
check('GET /api/health', health.status === 200 && health.body.ok === true, `status ${health.status}`);

// ── 2. Auth (seeded test account)
console.log('\nAuth');
const badLogin = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: 'wrong-password' } });
check('login rejects wrong password', badLogin.status === 401, `status ${badLogin.status}`);

const login = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
const token = login.body?.token;
const me = login.body?.user;
check('POST /api/auth/login (seeded account)', login.status === 200 && !!token, `user ${me?.name} id=${me?.id}`);
if (!token) { console.log('\nCannot continue without a token.\n'); process.exit(1); }

const meResp = await call('GET', '/api/auth/me', { token });
check('GET /api/auth/me with JWT', meResp.status === 200 && meResp.body.email === EMAIL, `status ${meResp.status}`);

const noAuth = await call('GET', '/api/auth/me');
check('GET /api/auth/me without token → 401', noAuth.status === 401, `status ${noAuth.status}`);

// ── 3. Discovery / matching
console.log('\nMatching');
const recs = await call('GET', '/api/roommates/recommended', { token });
check('GET /api/roommates/recommended', recs.status === 200 && Array.isArray(recs.body), `${recs.body?.length ?? '?'} candidates`);
check('scores are computed', Array.isArray(recs.body) && recs.body.length > 0 && typeof recs.body[0].score === 'number', `top score ${recs.body?.[0]?.score}`);

const detail = await call('GET', `/api/roommates/${recs.body?.[0]?.id}`, { token });
check('GET /api/roommates/:id includes match reasons', detail.status === 200 && Array.isArray(detail.body.reasons), `${detail.body?.reasons?.length} reasons`);

const matches = await call('GET', '/api/matches', { token });
check('GET /api/matches', matches.status === 200 && Array.isArray(matches.body), `${matches.body?.length} matches: ${(matches.body || []).map(m => m.partner_name).join(', ')}`);

// ── 4. Messaging (this path was broken before the messages-table fix)
console.log('\nMessaging');
const convs = await call('GET', '/api/conversations', { token });
check('GET /api/conversations', convs.status === 200 && Array.isArray(convs.body), `${convs.body?.length} conversations`);
const partner = convs.body?.[0]?.partner_id;

const thread = await call('GET', `/api/conversations/${partner}`, { token });
check('GET /api/conversations/:userId (seeded history)', thread.status === 200 && thread.body.length > 0, `${thread.body?.length} messages`);

const sent = await call('POST', '/api/messages', { token, body: { receiver_id: partner, message: 'Smoke test: still good for Sunday?' } });
check('POST /api/messages (previously 500 — fixed table)', sent.status === 201 && !!sent.body.id, `status ${sent.status}`);

const after = await call('GET', `/api/conversations/${partner}`, { token });
check('new message appears in thread', Array.isArray(after.body) && after.body.some(m => m.id === sent.body?.id));

const read = await call('POST', `/api/conversations/${partner}/read`, { token });
check('POST /api/conversations/:userId/read', read.status === 200);

// ── 5. Content
console.log('\nContent');
const events = await call('GET', '/api/events', { token });
check('GET /api/events (upcoming only)', events.status === 200 && events.body.length > 0, `${events.body?.length} events`);

const comms = await call('GET', '/api/communities', { token });
check('GET /api/communities', comms.status === 200 && comms.body.length > 0, `${comms.body?.length} communities`);

const rsvpEvent = events.body?.[0];
if (rsvpEvent) {
  const rsvp = await call('POST', `/api/events/${rsvpEvent.id}/rsvp`, { token, body: { status: 'going' } });
  check('POST /api/events/:id/rsvp', rsvp.status === 200);
  const cancel = await call('DELETE', `/api/events/${rsvpEvent.id}/rsvp`, { token });
  check('DELETE /api/events/:id/rsvp (cleanup)', cancel.status === 200);
}

const settle = await call('GET', '/api/settlement', { token });
check('GET /api/settlement', settle.status === 200 && settle.body.length > 0, `${settle.body?.filter(t => t.completed).length}/${settle.body?.length} tasks done`);

const disc = await call('GET', '/api/discover', { token });
check('GET /api/discover', disc.status === 200 && !!disc.body.user,
  `roommates:${disc.body?.roommates?.length} communities:${disc.body?.communities?.length} events:${disc.body?.events?.length}`);

// ── 6. Cleanup: remove the smoke-test message
if (sent.body?.id) {
  try {
    const { default: pg } = await import('pg');
    const fs = await import('fs');
    const url = new URL(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .match(/DATABASE_URL\s*=\s*(.+)/)[1].trim());
    const client = new pg.Client({
      connectionString: url.href, ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query('DELETE FROM messages WHERE id = $1', [sent.body.id]);
    await client.end();
    console.log(`\n🧹 Cleaned up smoke-test message #${sent.body.id}`);
  } catch (err) {
    console.log(`\n⚠️  Could not clean up message #${sent.body.id}: ${err.message}`);
    console.log('   (run this script with --import ./scripts/dns-shim.mjs for DB cleanup)');
  }
}

console.log(`\n${'─'.repeat(46)}\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);