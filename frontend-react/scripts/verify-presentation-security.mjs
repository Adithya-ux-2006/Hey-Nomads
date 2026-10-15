// Security probe for the presentation surface (release-readiness pass).
// Re-runnable: boots the real API against the isolated test DB, exercises every
// allowed AND denied path, proves no real-user row is read or modified, then
// stops the server and proves the port came back.
//
//   cd frontend-react
//   DATABASE_URL=<test url> node --import ./scripts/dns-shim.mjs scripts/verify-presentation-security.mjs
//
// Needs DATABASE_URL (fail-closed via require-test-db.mjs) and JWT_SECRET from
// .env, same as every other verify-* script.
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import pg from 'pg';
import jwt from 'jsonwebtoken';

// Fail closed before anything touches the database.
await import('./require-test-db.mjs');

// Same .env source local-api.mjs and the deployment use; never overrides.
{
  const fs = await import('fs');
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3100;
const API = `http://127.0.0.1:${PORT}`;
const NS = 'qa.present.';
const ROLES = ['host', 'ada', 'noor', 'sam'];
const EMAILS = ROLES.map(r => `${NS}${r}@gmail.com`);

const JWT_SECRET = process.env.JWT_SECRET;
assert.ok(JWT_SECRET, 'JWT_SECRET missing from env/.env');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 45000,
});
const q = (sql, params) => pool.query(sql, params);

const results = [];
const check = (name, fn) => {
  const done = async () => {
    try { await fn(); results.push([true, name]); console.log(`PASS  ${name}`); }
    catch (e) { results.push([false, name]); console.log(`FAIL  ${name}\n        ${e.message}`); }
  };
  return done();
};

const api = async (p, { method = 'GET', body, token } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${API}${p}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let json = null;
  try { json = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, body: json };
};

const sign = (payload, opts) => jwt.sign(payload, JWT_SECRET, opts);
const { default: handler } = await import('../api/index.js');
import http from 'http';
const server = http.createServer(handler);
await new Promise(r => server.listen(PORT, r));

const portFree = port => new Promise(resolve => {
  const probe = net.createServer();
  probe.once('error', () => resolve(false));
  probe.once('listening', () => probe.close(() => resolve(true)));
  probe.listen(port, '127.0.0.1');
});

try {
  // ── identities ──────────────────────────────────────────────
  const cohort = (await q(
    `SELECT id, email, name FROM users WHERE email LIKE $1 || '%' ORDER BY id`, [NS]
  )).rows;
  assert.strictEqual(cohort.length, 4, `expected 4 cohort accounts, got ${cohort.length}`);
  const ids = cohort.map(r => r.id);
  const host = cohort.find(r => r.email === `${NS}host@gmail.com`);
  const peer = cohort.find(r => r.email === `${NS}ada@gmail.com`);
  const outsider = (await q(
    `SELECT id, email FROM users WHERE email NOT LIKE $1 || '%' ORDER BY id DESC LIMIT 1`, [NS]
  )).rows[0];
  assert.ok(outsider, 'no non-cohort account found in the test DB');

  // ── session (the only unauthenticated entry) ────────────────
  const s1 = await api('/api/presentation/session', { method: 'POST' });
  await check('session returns 200 ready:true with token + user', () => {
    assert.strictEqual(s1.status, 200);
    assert.strictEqual(s1.body.ready, true);
    assert.strictEqual(typeof s1.body.token, 'string');
    assert.ok(s1.body.user?.name, 'no user.name');
  });
  const token = s1.body.token;
  const claims = jwt.decode(token);
  await check('session token is scoped to the host presentation account', () => {
    assert.strictEqual(claims.scope, 'presentation');
    assert.strictEqual(claims.userId, host.id);
  });

  // ── allowed paths ───────────────────────────────────────────
  const disc = await api('/api/presentation/discover', { token });
  await check('presentation discover returns only cohort peers', () => {
    assert.strictEqual(disc.status, 200);
    assert.ok(Array.isArray(disc.body), 'not an array');
    assert.ok(disc.body.length >= 1, 'empty feed');
    for (const row of disc.body) {
      assert.ok(ids.includes(row.id), `stranger id ${row.id} in presentation feed`);
      assert.notStrictEqual(row.id, host.id);
    }
  });

  const cand = await api(`/api/presentation/candidates/${peer.id}`, { token });
  await check('presentation candidate detail scores a cohort peer', () => {
    assert.strictEqual(cand.status, 200);
    assert.strictEqual(typeof cand.body.score, 'number');
    assert.strictEqual(typeof cand.body.is_match, 'boolean');
    assert.ok(Array.isArray(cand.body.reasons));
  });

  // Clean slate, then snapshot every table the presentation can touch.
  const r1 = await api('/api/presentation/reset', { method: 'POST', token });
  await check('reset succeeds and returns a fresh token', () => {
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.body.ok, true);
    assert.ok(typeof r1.body.token === 'string');
  });
  const snapSql = `
    SELECT (SELECT count(*) FROM swipes)                        AS swipes,
           (SELECT count(*) FROM matches)                       AS matches,
           (SELECT count(*) FROM conversations)                 AS conversations,
           (SELECT count(*) FROM conversation_members)          AS conversation_members,
           (SELECT count(*) FROM messages)                      AS messages,
           (SELECT count(*) FROM users)                         AS users,
           (SELECT count(*) FROM profiles)                      AS profiles,
           (SELECT count(*) FROM agreements)                    AS agreements`;
  const before = (await q(snapSql)).rows[0];

  const like = await api('/api/presentation/like', {
    method: 'POST', token, body: { targetId: peer.id, action: 'like' },
  });
  await check('presentation like on a cohort peer creates a match', () => {
    assert.strictEqual(like.status, 200);
    assert.strictEqual(like.body.ok, true);
    assert.strictEqual(like.body.matchCreated, true);
  });

  const matches = await api('/api/presentation/matches', { token });
  await check('presentation matches lists the new match only', () => {
    assert.strictEqual(matches.status, 200);
    assert.strictEqual(matches.body.length, 1);
    assert.strictEqual(matches.body[0].partner_id, peer.id);
  });

  const chatGet = await api(`/api/presentation/chat/${peer.id}`, { token });
  await check('presentation chat returns the cohort greeting', () => {
    assert.strictEqual(chatGet.status, 200);
    assert.ok(chatGet.body.length >= 1, 'no greeting message');
    assert.ok(chatGet.body.every(m => ids.includes(m.sender_id)), 'stranger in thread');
  });

  const chatPost = await api('/api/presentation/chat', {
    method: 'POST', token, body: { peerId: peer.id, message: 'Probe message' },
  });
  await check('presentation chat post returns 201', () => {
    assert.strictEqual(chatPost.status, 201);
    assert.strictEqual(chatPost.body.content, 'Probe message');
  });

  // ── denied: scope guard on ordinary endpoints ───────────────
  const guarded = [
    ['/api/auth/me', 'GET'], ['/api/discover', 'GET'], ['/api/matches', 'GET'],
    ['/api/conversations', 'GET'], ['/api/agreements', 'GET'], ['/api/shortlist', 'GET'],
    [`/api/profile/${outsider.id}`, 'GET'], ['/api/profile', 'POST'],
  ];
  for (const [p, method] of guarded) {
    const r = await api(p, { method, token, body: method === 'POST' ? {} : undefined });
    await check(`scope guard refuses ${method} ${p} with a presentation token`, () => {
      assert.strictEqual(r.status, 403, `got ${r.status} ${JSON.stringify(r.body)}`);
      assert.match(r.body?.error || '', /cannot use this endpoint/);
    });
  }

  // ── denied: presentation routes without/with wrong token ────
  const noAuth = await api('/api/presentation/discover');
  await check('presentation routes require a token (401)', () => {
    assert.strictEqual(noAuth.status, 401);
  });

  const ordinary = sign({ userId: host.id });
  const ordTok = await api('/api/presentation/discover', { token: ordinary });
  await check('an ordinary session token is refused on presentation routes (403)', () => {
    assert.strictEqual(ordTok.status, 403);
    assert.match(ordTok.body?.error || '', /Presentation session required/);
  });

  const forged = sign({ userId: outsider.id, scope: 'presentation' });
  const forgTok = await api('/api/presentation/discover', { token: forged });
  await check('a presentation token for a non-cohort account is refused (403)', () => {
    assert.strictEqual(forgTok.status, 403);
    assert.match(forgTok.body?.error || '', /Not a presentation account/);
  });

  const wrongSecret = jwt.sign({ userId: host.id, scope: 'presentation' }, 'not-the-secret');
  const badTok = await api('/api/presentation/discover', { token: wrongSecret });
  await check('a token signed with the wrong secret is refused (401)', () => {
    assert.strictEqual(badTok.status, 401);
  });

  const expired = sign({ userId: host.id, scope: 'presentation' }, { expiresIn: '-10s' });
  const expTok = await api('/api/presentation/discover', { token: expired });
  await check('an expired presentation token is refused (401)', () => {
    assert.strictEqual(expTok.status, 401);
  });

  // ── denied: the presentation cannot reach a real account ────
  const likeReal = await api('/api/presentation/like', {
    method: 'POST', token, body: { targetId: outsider.id, action: 'like' },
  });
  await check('presentation like cannot swipe a non-cohort account (404)', () => {
    assert.strictEqual(likeReal.status, 404);
  });
  const candReal = await api(`/api/presentation/candidates/${outsider.id}`, { token });
  await check('presentation candidate detail cannot read a non-cohort account (404)', () => {
    assert.strictEqual(candReal.status, 404);
  });
  const chatReal = await api(`/api/presentation/chat/${outsider.id}`, { token });
  await check('presentation chat cannot open a thread with a non-cohort account (403)', () => {
    assert.strictEqual(chatReal.status, 403);
  });
  const postReal = await api('/api/presentation/chat', {
    method: 'POST', token, body: { peerId: outsider.id, message: 'hi' },
  });
  await check('presentation chat post cannot message a non-cohort account (404)', () => {
    assert.strictEqual(postReal.status, 404);
  });
  const idem = await api('/api/presentation/like', {
    method: 'POST', token, body: { targetId: 'not-a-number' },
  });
  await check('presentation like rejects a malformed targetId (400)', () => {
    assert.strictEqual(idem.status, 400);
  });

  // ── reset is repeatable and leaves real-user rows untouched ──
  const r2 = await api('/api/presentation/reset', { method: 'POST', token });
  const r3 = await api('/api/presentation/reset', { method: 'POST', token: r2.body.token });
  await check('reset is idempotent (twice in a row)', () => {
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.body.ok, true);
    assert.strictEqual(r3.status, 200);
    assert.strictEqual(r3.body.ok, true);
  });
  const after = (await q(snapSql)).rows[0];
  await check('no row outside the cohort changed across the whole run', () => {
    for (const k of Object.keys(before)) {
      assert.strictEqual(String(after[k]), String(before[k]),
        `${k}: before=${before[k]} after=${after[k]}`);
    }
  });
  const cleanDisc = await api('/api/presentation/discover', { token });
  const cleanMatches = await api('/api/presentation/matches', { token });
  await check('after reset the feed is full again and matches are empty', () => {
    assert.strictEqual(cleanDisc.body.length, 3, `feed had ${cleanDisc.body.length} cards`);
    assert.strictEqual(cleanMatches.body.length, 0);
  });

  // ── rate limit on the token-minting endpoint ────────────────
  // startLimit is a fixed 60s window with max:15, shared across every session
  // request (keyed on the empty email). s1 above already consumed slot 1 of
  // this window, so this loop's 14 requests are hits 2..15 (all 200) plus
  // 16 and 17 (both 429). 14 requests stays inside the window; a 15th would
  // land after it and reset the count.
  const seen = [];
  for (let i = 0; i < 14; i++) {
    seen.push((await api('/api/presentation/session', { method: 'POST' })).status);
  }
  await check('session mints at most 15 tokens per minute, then 429', () => {
    const ok = seen.filter(s => s === 200).length;
    const limited = seen.filter(s => s === 429).length;
    assert.strictEqual(ok, 14, `expected 14 allowed after s1, got ${ok}`);
    assert.strictEqual(limited, 2, `expected 2 rate-limited, got ${limited}`);
    assert.strictEqual(seen[seen.length - 1], 429, 'last request was not limited');
  });
} finally {
  server.close();
  await new Promise(r => setTimeout(r, 400));
  const leaked = !(await portFree(PORT));
  if (leaked) console.log('PORT_3100_LEAKED');
  else console.log('PORT_3100_CLEAN');
  await pool.end();
}

const failed = results.filter(r => !r[0]).length;
console.log(`\n${'-'.repeat(56)}`);
console.log(`${results.length - failed}/${results.length} checks passed`);
console.log(failed ? 'PRESENTATION_SECURITY_PROBE_FAILED' : 'PRESENTATION_SECURITY_PROBE_OK');
process.exit(failed ? 1 : 0);
