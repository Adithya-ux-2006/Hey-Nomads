// Offline gate scenarios against the REAL express app — no database, no
// storage service, no network beyond 127.0.0.1.
//
//   node scripts/offline-api-gates.mjs upload
//   node scripts/offline-api-gates.mjs likes
//
// Boots api/index.js in-process with:
//   - JWT_SECRET set           (the app refuses to start without it)
//   - DATABASE_URL pointed at 127.0.0.1:9 (nothing listens; any accidental
//     query fails fast with ECONNREFUSED instead of touching a real database)
//   - BLOB_READ_WRITE_TOKEN deleted (storage must answer "not configured")
//
// Because authMiddleware is JWT-only and runs before any handler body, the
// 401s below prove rejection happens before any database access: the database
// in this process cannot be reached at all.
import http from 'node:http';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'offline-gate-secret';
process.env.DATABASE_URL = 'postgres://offline:offline@127.0.0.1:9/offline_never';
delete process.env.BLOB_READ_WRITE_TOKEN;

const mode = process.argv[2];
assert.ok(['upload', 'likes', 'genderprefs', 'age', 'notifications', 'livingdna', 'phase15'].includes(mode), 'usage: offline-api-gates.mjs <upload|likes|genderprefs|age|notifications|livingdna|phase15>');

const { default: handler } = await import('../api/index.js');
const { default: jwt } = await import('jsonwebtoken');

const server = http.createServer((req, res) => handler(req, res));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const token = jwt.sign({ userId: 7770 }, process.env.JWT_SECRET);
const auth = { Authorization: `Bearer ${token}` };

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4096, 0x11)]);
const HTML = Buffer.from('<html><script>1</script></html>', 'utf8');

// node:http, not fetch: undici's client trips a libuv assertion on Windows
// (Node 24) when it talks to this express app. Verified stable with the same
// server and the same requests — only the client transport differs.
const request = (path, { method = 'GET', body, headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(base + path, { method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () =>
        resolve({ status: res.statusCode, text: () => Promise.resolve(Buffer.concat(chunks).toString('utf8')) })
      );
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body === undefined) req.end();
    else req.end(body);
  });

const post = (path, body, headers) => request(path, { method: 'POST', body, headers });
const get = (path, headers = {}) => request(path, { method: 'GET', headers });

const jsonOf = async res => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

try {
  if (mode === 'upload') {
    const messages = [];

    // 1. No credentials — rejected before the body or any storage is read.
    let res = await post('/api/upload', JPEG, { 'content-type': 'image/jpeg' });
    assert.equal(res.status, 401, 'upload must 401 without a token');
    messages.push((await jsonOf(res)).error);

    // 2. Non-image declared type.
    res = await post('/api/upload', Buffer.from('hi'), { 'content-type': 'text/plain', ...auth });
    assert.equal(res.status, 415, 'non-image content type must 415');
    messages.push((await jsonOf(res)).error);

    // 3. Declared image, really HTML — magic-byte mismatch.
    res = await post('/api/upload', HTML, { 'content-type': 'image/png', ...auth });
    assert.equal(res.status, 400, 'magic mismatch must 400');
    messages.push((await jsonOf(res)).error);

    // 4. Empty body.
    res = await post('/api/upload', Buffer.alloc(0), { 'content-type': 'image/jpeg', ...auth });
    assert.equal(res.status, 400, 'empty body must 400');
    messages.push((await jsonOf(res)).error);

    // 5. Over the cap — streaming bound stops it before it is buffered whole.
    const oversized = Buffer.concat([JPEG, Buffer.alloc(4 * 1024 * 1024 + 1)]);
    res = await post('/api/upload', oversized, { 'content-type': 'image/jpeg', ...auth });
    assert.equal(res.status, 413, 'oversized body must 413');
    messages.push((await jsonOf(res)).error);

    // 6. Valid-looking JPEG, but this deployment has no storage token.
    res = await post('/api/upload', JPEG, { 'content-type': 'image/jpeg', ...auth });
    assert.equal(res.status, 503, 'missing storage config must 503, not 500');
    const body503 = await jsonOf(res);
    assert.equal(body503.code, 'storage-not-configured');
    messages.push(body503.error);

    // Positive control: every verdict carries its own message, and none of
    // them is the generic 500 string kept for real storage failures.
    assert.ok(messages.every(m => typeof m === 'string' && m.length > 0), 'every failure has copy');
    assert.ok(messages.every(m => m !== 'Upload failed'), 'request problems must not use the generic 500 message');
    assert.equal(new Set(messages).size, messages.length, 'each verdict must say something different');
  }

  if (mode === 'likes') {
    // Unauthenticated — and the database behind this process is unreachable,
    // so a 401 (not a 500, not a timeout) proves the auth gate sits in front
    // of the query layer.
    for (const path of ['/api/likes/sent', '/api/likes/received']) {
      const res = await get(path);
      assert.equal(res.status, 401, `${path} must 401 without a token`);
      const body = await jsonOf(res);
      assert.equal(body.error, 'No token provided');
    }

    // Authenticated calls are deliberately NOT made: they would query the
    // database, which this offline process must never do. The route's
    // real-account and blocked-pair filters are asserted against the pure
    // builders in tests/offline/likes-queries.test.mjs instead (G3/G5).
    const api = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
    assert.ok(api.includes("app.get('/api/likes/sent', authMiddleware"), 'sent route must exist behind auth');
    assert.ok(api.includes("app.get('/api/likes/received', authMiddleware"), 'received route must exist behind auth');
    const queries = readFileSync(new URL('../api/likes-queries.mjs', import.meta.url), 'utf8');
    assert.ok(queries.includes('NOT EXISTS'), 'received must drop answered swipes');
    assert.ok(queries.includes('FROM blocks'), 'blocked pairs must be excluded');
    assert.ok(existsSync(new URL('../tests/offline/likes-queries.test.mjs', import.meta.url)), 'builder tests must exist');
  }

  if (mode === 'genderprefs') {
    // Both recommendation routes must reject unauthenticated calls before
    // any query: the database in this process is unreachable, so a 401
    // (not a 500) proves auth runs first.
    for (const path of ['/api/discover', '/api/roommates/recommended']) {
      const res = await get(path);
      assert.equal(res.status, 401, `${path} must 401 without a token`);
      assert.equal((await jsonOf(res)).error, 'No token provided');
    }

    // An invalid preferredGender must 400 before the handler touches the
    // database: same authed POST shape, only the value differs.
    let res = await post('/api/profile', JSON.stringify({ preferredGender: 'robot' }),
      { 'content-type': 'application/json', ...auth });
    assert.equal(res.status, 400, 'invalid preferredGender must 400 before any DB access');
    assert.ok((await jsonOf(res)).error.includes('preferredGender'), 'the 400 must name the field');

    // Positive control: a valid preferredGender passes the gate and reaches
    // the query layer, which fails with ECONNREFUSED → 500 here. That
    // contrast is what proves the 400 above came from validation, not from
    // the unreachable database.
    res = await post('/api/profile', JSON.stringify({ preferredGender: 'female' }),
      { 'content-type': 'application/json', ...auth });
    assert.equal(res.status, 500, 'valid preferredGender proceeds to the (unreachable) DB layer');

    // The Profile page's one-field save lives on its own route and must make
    // the same three guarantees: auth before the handler, validation before
    // any query, and a valid value that reaches the (unreachable) DB layer.
    res = await request('/api/preferences/gender', {
      method: 'PUT',
      body: JSON.stringify({ preferredGender: 'female' }),
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(res.status, 401, 'the narrow preference route must 401 without a token');

    res = await request('/api/preferences/gender', {
      method: 'PUT',
      body: JSON.stringify({ preferredGender: 'robot' }),
      headers: { 'content-type': 'application/json', ...auth },
    });
    assert.equal(res.status, 400, 'narrow route: invalid preferredGender must 400 before any DB access');
    assert.ok((await jsonOf(res)).error.includes('preferredGender'), 'the 400 must name the field');

    res = await request('/api/preferences/gender', {
      method: 'PUT',
      body: JSON.stringify({ preferredGender: 'female' }),
      headers: { 'content-type': 'application/json', ...auth },
    });
    assert.equal(res.status, 500, 'narrow route: valid preferredGender proceeds to the (unreachable) DB layer');

    // Structural: the shared feed applies the two-sided filter, the
    // candidates query joins preferences, and the pure predicate has tests.
    const api = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
    assert.ok(api.includes('feedGenderFilterSql('), 'getRecommendedRoommates must apply the gender filter');
    assert.ok(api.includes('LEFT JOIN preferences pref2'), 'candidates query must join preferences');
    assert.ok(api.includes("from './gender-prefs.mjs'"), 'the API must import the pure module');
    assert.ok(api.includes("app.put('/api/preferences/gender', authMiddleware"), 'the narrow preference route must exist behind auth');
    assert.ok(api.includes('ON CONFLICT (user_id) DO UPDATE SET preferred_gender'), 'the narrow route must upsert the single column');
    assert.ok(!/app\.put\('\/api\/preferences\/gender'[\s\S]{0,1200}DELETE FROM user_languages/.test(api), 'the narrow route must not touch languages');
    assert.ok(existsSync(new URL('../tests/offline/gender-prefs.test.mjs', import.meta.url)), 'predicate tests must exist');
  }

  if (mode === 'age') {
    // Onboarding must reject an invalid DOB with a 400 and a message naming
    // the field, before the handler writes anything. The database behind this
    // process is unreachable, so a 400 (not a 500) proves validation ran first.
    let res = await post('/api/onboarding', JSON.stringify({ date_of_birth: '2020-02-30' }),
      { 'content-type': 'application/json', ...auth });
    assert.equal(res.status, 400, 'impossible DOB must 400');
    const body400 = await jsonOf(res);
    assert.ok(body400.error && body400.error.length > 0, 'the 400 must carry copy');
    assert.ok(body400.error !== 'Failed to save onboarding', 'a validation failure must not use the generic 500 message');

    // Under-age DOB is rejected with the minimum age named.
    res = await post('/api/onboarding', JSON.stringify({ date_of_birth: '2020-01-01' }),
      { 'content-type': 'application/json', ...auth });
    assert.equal(res.status, 400, 'under-age DOB must 400');
    assert.ok((await jsonOf(res)).error.includes('18'), 'the message must name the minimum age');

    // A future DOB is rejected.
    res = await post('/api/onboarding', JSON.stringify({ date_of_birth: '2999-01-01' }),
      { 'content-type': 'application/json', ...auth });
    assert.equal(res.status, 400, 'future DOB must 400');

    // Positive control: a valid DOB passes the gate and reaches the query
    // layer, which fails with ECONNREFUSED → 500 here. That contrast is what
    // proves the 400s above came from validation, not from the database.
    res = await post('/api/onboarding', JSON.stringify({ date_of_birth: '2000-05-15' }),
      { 'content-type': 'application/json', ...auth });
    assert.equal(res.status, 500, 'valid DOB proceeds to the (unreachable) DB layer');

    // The same gate on the profile editor, so the two entry points cannot
    // disagree about what counts as a valid date.
    res = await post('/api/profile', JSON.stringify({ dateOfBirth: '2020-02-30' }),
      { 'content-type': 'application/json', ...auth });
    assert.equal(res.status, 400, 'profile editor must also reject an impossible DOB');

    // Structural: the pure module exists, is imported by the API, and has tests.
    const api = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
    assert.ok(api.includes("from './age.mjs'"), 'the API must import the pure age module');
    assert.ok(api.includes('validateDob('), 'onboarding must validate the DOB');
    assert.ok(api.includes("setUser('age', derivedAge)"), 'age must be derived from the DOB, not typed');
    assert.ok(existsSync(new URL('../api/age.mjs', import.meta.url)), 'the pure module must exist');
    assert.ok(existsSync(new URL('../tests/offline/age.test.mjs', import.meta.url)), 'age tests must exist');
  }

  if (mode === 'notifications') {
    // Every notifications route must reject unauthenticated calls before any
    // query: the database in this process is unreachable, so a 401 (not a 500)
    // proves auth runs first.
    for (const path of ['/api/notifications', '/api/notifications/unread-count']) {
      const res = await get(path);
      assert.equal(res.status, 401, `${path} must 401 without a token`);
      assert.equal((await jsonOf(res)).error, 'No token provided');
    }
    for (const path of ['/api/notifications/1/read', '/api/notifications/read-all']) {
      const res = await post(path);
      assert.equal(res.status, 401, `${path} must 401 without a token`);
    }

    // Structural: the routes exist behind auth, the pure module is imported,
    // message/like/match all call the recorder, and the tests exist.
    const api = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
    assert.ok(api.includes("app.get('/api/notifications', authMiddleware"), 'list route must exist behind auth');
    assert.ok(api.includes("app.get('/api/notifications/unread-count', authMiddleware"), 'unread-count route must exist behind auth');
    assert.ok(api.includes("app.post('/api/notifications/read-all', authMiddleware"), 'read-all route must exist behind auth');
    assert.ok(api.includes("from './notifications.mjs'"), 'the API must import the pure module');
    assert.ok(api.includes("type: 'message'"), 'a new message must record a notification');
    assert.ok(api.includes("type: 'like'"), 'a like must record a notification');
    assert.ok(api.includes("type: 'match'"), 'a match must record a notification');
    assert.ok(existsSync(new URL('../api/notifications.mjs', import.meta.url)), 'the pure module must exist');
    assert.ok(existsSync(new URL('../tests/offline/notifications.test.mjs', import.meta.url)), 'notification tests must exist');
  }

  if (mode === 'livingdna') {
    // Every Living DNA route must reject unauthenticated calls before any
    // query: the database in this process is unreachable, so a 401 (not a 500)
    // proves auth runs first.
    const GET_ROUTES = ['/api/living-dna/questions', '/api/living-dna/me',
      '/api/living-dna/compare/1', '/api/living-dna/constitution/1'];
    for (const path of GET_ROUTES) {
      const res = await get(path);
      assert.equal(res.status, 401, `${path} must 401 without a token`);
      assert.equal((await jsonOf(res)).error, 'No token provided');
    }
    const PUT_ROUTES = ['/api/living-dna/answers', '/api/living-dna/sharing'];
    for (const path of PUT_ROUTES) {
      const res = await request(path, { method: 'PUT' });
      assert.equal(res.status, 401, `${path} must 401 without a token`);
    }
    const POST_ROUTES = ['/api/living-dna/constitution/1/rules', '/api/living-dna/constitution/1/accept'];
    for (const path of POST_ROUTES) {
      const res = await post(path);
      assert.equal(res.status, 401, `${path} must 401 without a token`);
    }

    // A PUT with a malformed body must 400 before any query runs — the array
    // guard sits ahead of the first database access.
    let res = await request('/api/living-dna/answers', {
      method: 'PUT',
      body: JSON.stringify({ answers: 'nope' }),
      headers: { 'content-type': 'application/json', ...auth },
    });
    assert.equal(res.status, 400, 'non-array answers must 400 before any DB access');
    assert.ok((await jsonOf(res)).error.includes('array'), 'the 400 must name the expected shape');

    // Same for the sharing consent guard.
    res = await request('/api/living-dna/sharing', {
      method: 'PUT',
      body: JSON.stringify({ share_preferences: 'yes', share_boundaries: false }),
      headers: { 'content-type': 'application/json', ...auth },
    });
    assert.equal(res.status, 400, 'non-boolean sharing must 400 before any DB access');

    // Structural: every handler answers 503 honestly when the migration has
    // not been applied, rather than a generic 500 that reads like data loss.
    const api = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
    const starts = [...api.matchAll(/app\.(get|put|post)\('\/api\/living-dna\//g)].map(m => m.index);
    assert.ok(starts.length >= 7, `expected at least 7 living-dna routes, found ${starts.length}`);
    for (const start of starts) {
      const next = api.indexOf('\napp.', start + 1);
      const body = api.slice(start, next === -1 ? api.length : next);
      assert.ok(body.includes('isMissingLivingDnaTable(err)'),
        'every living-dna handler must map a missing table to a 503');
    }
    assert.ok(api.includes('LIVING_DNA_NOT_READY'), 'the honest copy must be shared across handlers');
    // Consent must be checked before any answer row is read.
    assert.ok(api.includes("status(403).json({ error: 'They have not chosen to share"),
      'compare must refuse before reading answers when they have not shared');
  }

  if (mode === 'phase15') {
    // Every communities / events / cities / settlement route must reject
    // unauthenticated calls before any query: the database in this process is
    // unreachable, so a 401 (not a 500) proves auth runs first.
    const GET = ['/api/communities', '/api/communities/1', '/api/events',
      '/api/events/1/attendees', '/api/cities', '/api/cities/1', '/api/settlement'];
    for (const path of GET) {
      const res = await get(path);
      assert.equal(res.status, 401, `${path} must 401 without a token`);
      assert.equal((await jsonOf(res)).error, 'No token provided');
    }
    for (const path of ['/api/communities', '/api/communities/1/join',
      '/api/communities/1/leave', '/api/events', '/api/events/1/rsvp',
      '/api/settlement/1/complete', '/api/settlement/1/uncomplete']) {
      const res = await post(path);
      assert.equal(res.status, 401, `${path} must 401 without a token`);
    }
    for (const path of ['/api/events/1', '/api/events/1/rsvp']) {
      const res = await request(path, { method: 'DELETE' });
      assert.equal(res.status, 401, `DELETE ${path} must 401 without a token`);
    }

    // Structural: the scoring engine keeps a single canonical implementation
    // with the documented weights and the gender filter applied pre-scoring.
    const api = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
    assert.ok(api.includes('function scoreCompatibility'), 'one canonical scorer must exist');
    assert.ok(api.includes('lifestyle_weight: 0.25') && api.includes('budget_weight: 0.20')
      && api.includes('location_weight: 0.20') && api.includes('movein_weight: 0.15')
      && api.includes('interests_weight: 0.10') && api.includes('habits_weight: 0.10'),
      'the six documented weights must be present');
    assert.ok(api.includes('feedGenderFilterSql('), 'the gender filter must gate the feed');
    assert.ok(api.includes('getRecommendedRoommates'), 'Discover and Roommates must share one recommender');
    assert.ok(existsSync(new URL('../../docs/matching-formula.md', import.meta.url)),
      'the formula must stay documented');
    for (const page of ['CommunitiesPage.jsx', 'CommunityDetailPage.jsx', 'EventsPage.jsx',
      'SettleInPage.jsx', 'RoommatesPage.jsx']) {
      assert.ok(existsSync(new URL(`../src/pages/${page}`, import.meta.url)), `${page} must exist`);
    }
    assert.ok(existsSync(new URL('../src/components/Navbar.jsx', import.meta.url)), 'Navbar must exist');
  }

  process.exitCode = 0;
} catch (err) {
  // Assertion failures print their stack and exit non-zero before the exit
  // call below; nothing here needs to run first.
  console.error(err);
  process.exitCode = 1;
}
// Explicit exit: the HTTP server and fetch's keep-alive sockets would
// otherwise hold the event loop open after the scenarios are done.
process.exit(process.exitCode ?? 0);
