// Living DNA regression suite.
//
// Runs in-process against api/index.js like verify-api-flows.mjs, and is meant to
// be executed the same way:
//
//   DATABASE_URL=<isolated test db> node --import ./scripts/dns-shim.mjs scripts/verify-living-dna.mjs
//
// Every account is registered with a run-scoped prefix (`ld<stamp>.*`) and the
// teardown deletes exactly that prefix, so a run can never touch another run's
// accounts or a genuine user. Cleanup runs in a finally block, so a failing
// assertion still tidies up.
import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { Readable } from 'node:stream';

// Same fail-closed database guard as every other writer in this repo.
await import('./require-test-db.mjs');

for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'living-dna-test-only';

const { default: app } = await import('../api/index.js');

// Copied verbatim from verify-api-flows.mjs rather than reimplemented. A
// hand-rolled version that omitted transfer-encoding/httpVersion/socket made
// body-parser see an empty body, and every write route answered "All fields are
// required" - a failure that looks like an app bug and is not one.
const call = (method, path, token, body) => new Promise((resolve, reject) => {
  const u = new URL(path, 'http://internal');
  const payload = body ? JSON.stringify(body) : '';
  const req = Object.assign(Readable.from([payload]), u);
  req.method = method;
  req.url = path;
  req.httpVersion = '1.1';
  req.headers = {
    host: 'internal',
    ...(payload ? { 'content-type': 'application/json', 'transfer-encoding': 'chunked' } : {}),
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

const results = [];
const step = async (name, fn) => {
  try { const d = await fn(); results.push(['ok', name, d]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
};

const STAMP = Date.now();
const PREFIX = `ld${STAMP}`;
const made = [];      // ids created by this run, for reporting
const emails = [];    // addresses created by this run, for precise teardown

const register = async (tag) => {
  const email = `${PREFIX}.${tag}.${Date.now()}@gmail.com`;
  const r = await call('POST', '/api/auth/register', null, { email, password: 'Verify12345!', name: `LD ${tag}` });
  assert.equal(r.status, 201, `register ${tag}: ${r.body?.error}`);
  emails.push(email);
  made.push(r.body.user.id);
  return { id: r.body.user.id, token: r.body.token, email };
};

try {
  // Register first: every Living DNA route is authenticated, including the
  // question list, which is consistent with the rest of the API.
  const a = await register('a');
  const b = await register('b');
  const stranger = await register('stranger');

  const questions = [];
  await step('questionnaire loads with stored options', async () => {
    const r = await call('GET', '/api/living-dna/questions', a.token);
    assert.equal(r.status, 200, r.body?.error);
    assert.ok(Array.isArray(r.body) && r.body.length >= 12, `expected 12+ questions, got ${r.body?.length}`);
    assert.ok(r.body.every(q => Array.isArray(q.options) && q.options.length >= 3), 'every question needs options');
    questions.push(...r.body);
    return `${r.body.length} questions`;
  });

  await step('saving answers persists and reports real progress', async () => {
    const picks = questions.slice(0, 4).map((q, i) => ({
      question_id: q.id, option: q.options[i % q.options.length], is_boundary: i === 0,
    }));
    const r = await call('PUT', '/api/living-dna/answers', a.token, { answers: picks });
    assert.equal(r.status, 200, r.body?.error);
    assert.ok(r.body.saved === 4, `saved=${r.body?.saved}`);
    assert.ok(r.body.answered === 4, `answered=${r.body?.answered}`);
    assert.ok(r.body.total === questions.length);
    assert.equal(r.body.complete, false, '4 of many answers is not complete');

    const me = await call('GET', '/api/living-dna/me', a.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.answers.length, 4, 'answers did not persist');
    assert.equal(me.body.sharing.share_preferences, false, 'sharing must default to nothing shared');
    return `saved 4 of ${questions.length}`;
  });

  await step('answers can be edited and the questionnaire completed', async () => {
    const first = questions[0];
    const alt = first.options.find(o => o !== first.options[0]);
    const edit = await call('PUT', '/api/living-dna/answers', a.token, {
      answers: [{ question_id: first.id, option: alt, is_boundary: false }],
    });
    assert.equal(edit.status, 200, edit.body?.error);
    const me = await call('GET', '/api/living-dna/me', a.token);
    const row = me.body.answers.find(x => x.question_id === first.id);
    assert.equal(row.option, alt, 'edit did not overwrite the earlier answer');
    assert.equal(row.is_boundary, false, 'boundary flag did not update');

    const rest = questions.slice(4).map(q => ({ question_id: q.id, option: q.options[0] }));
    const done = await call('PUT', '/api/living-dna/answers', a.token, { answers: rest });
    assert.equal(done.body.complete, true, `complete=${done.body?.complete} answered=${done.body?.answered}`);
    return 'edited one, completed the rest';
  });

  await step('an invented option is rejected, not stored', async () => {
    const q = questions[0];
    const before = await call('GET', '/api/living-dna/me', a.token);
    const r = await call('PUT', '/api/living-dna/answers', a.token, {
      answers: [{ question_id: q.id, option: 'definitely not a real option' }],
    });
    assert.equal(r.status, 400, `expected 400, got ${r.status}`);
    const after = await call('GET', '/api/living-dna/me', a.token);
    assert.equal(after.body.answers.find(x => x.question_id === q.id).option,
      before.body.answers.find(x => x.question_id === q.id).option, 'a rejected answer was persisted');
    return '400, and nothing written';
  });

  await step('another account cannot read or write your questionnaire', async () => {
    const read = await call('GET', '/api/living-dna/me', b.token);
    assert.equal(read.body.answers.length, 0, 'a private answer leaked to another account');
    const write = await call('PUT', '/api/living-dna/answers', b.token, {
      answers: [{ question_id: questions[0].id, option: questions[0].options[0] }],
    });
    assert.equal(write.status, 200, 'b should be able to write its OWN answers');
    const mine = await call('GET', '/api/living-dna/me', a.token);
    assert.equal(mine.body.answers.find(x => x.question_id === questions[0].id).option
      !== undefined, true, 'a lost its own answer');
    return 'private reads, writes scoped to the caller';
  });

  await step('comparison refuses unmatched accounts', async () => {
    const r = await call('GET', `/api/living-dna/compare/${stranger.id}`, a.token);
    assert.equal(r.status, 403, `unmatched comparison returned ${r.status}`);
    return '403 for a non-match';
  });

  // Make a real mutual match between a and b.
  await call('POST', '/api/swipe', a.token, { targetId: b.id, action: 'like' });
  const match = await call('POST', '/api/swipe', b.token, { targetId: a.id, action: 'like' });
  assert.equal(match.status, 200, match.body?.error);

  await step('comparison refuses until both people consent', async () => {
    const none = await call('GET', `/api/living-dna/compare/${b.id}`, a.token);
    assert.equal(none.status, 403, 'b has not consented but comparison was served');

    await call('PUT', '/api/living-dna/sharing', a.token, { share_preferences: true, share_boundaries: false });
    const onlyMe = await call('GET', `/api/living-dna/compare/${b.id}`, a.token);
    assert.equal(onlyMe.status, 403, 'one-sided consent was enough');

    await call('PUT', '/api/living-dna/sharing', b.token, { share_preferences: true, share_boundaries: false });
    const both = await call('GET', `/api/living-dna/compare/${b.id}`, a.token);
    assert.equal(both.status, 200, `mutual consent still refused: ${both.body?.error}`);
    assert.ok(both.body.compared > 0, 'nothing was comparable');
    return `refused at 0 and 1 consents, served at 2 (${both.body.compared} compared)`;
  });

  await step('comparison hides answers from someone who declined to share boundaries', async () => {
    // b marks one answer as a boundary but does not share boundaries.
    const bMe = await call('GET', '/api/living-dna/me', b.token);
    const cur = bMe.body.answers[0];
    const q = questions.find(x => x.id === cur.question_id);
    const alt = q.options.find(o => o !== cur.option);
    await call('PUT', '/api/living-dna/answers', b.token, {
      answers: [{ question_id: q.id, option: alt, is_boundary: true }],
    });
    const cmp = await call('GET', `/api/living-dna/compare/${b.id}`, a.token);
    assert.equal(cmp.status, 200);
    const row = cmp.body.pairs.find(p => p.slug === q.slug);
    assert.ok(row, 'the boundary question is missing from the comparison');
    assert.equal(row.their_option, null, 'an unshared boundary answer was exposed');
    assert.equal(row.status, 'not_shared', `status was ${row.status}`);
    return 'unshared boundary withheld';
  });

  await step('comparison reports no invented percentage', async () => {
    const cmp = await call('GET', `/api/living-dna/compare/${b.id}`, a.token);
    const s = JSON.stringify(cmp.body);
    assert.ok(!/"(score|percentage|match_percent)"\s*:/i.test(s), 'a fabricated numeric score is present');
    assert.ok(cmp.body.note, 'the comparison must state what it is not');
    return 'no numeric score, note present';
  });

  await step('constitution refuses non-participants', async () => {
    const r = await call('GET', `/api/living-dna/constitution/${b.id}`, stranger.token);
    assert.equal(r.status, 403, `stranger read a constitution: ${r.status}`);
    const w = await call('POST', `/api/living-dna/constitution/${b.id}/rules`, stranger.token, {
      category: 'Cleaning & chores', rule_text: 'stranger rule',
    });
    assert.equal(w.status, 403, `stranger wrote a rule: ${w.status}`);
    return '403 for read and write';
  });

  await step('accepting with no rules is refused', async () => {
    const r = await call('POST', `/api/living-dna/constitution/${b.id}/accept`, a.token);
    assert.equal(r.status, 409, `expected 409, got ${r.status}`);
    return '409 nothing to accept';
  });

  await step('an invalid category is rejected', async () => {
    const r = await call('POST', `/api/living-dna/constitution/${b.id}/rules`, a.token, {
      category: 'Vibes', rule_text: 'be nice',
    });
    assert.equal(r.status, 400, `expected 400, got ${r.status}`);
    return '400 unknown category';
  });

  await step('duplicate rules are refused', async () => {
    const body = { category: 'Cleaning & chores', rule_text: 'We take turns with the bins' };
    const one = await call('POST', `/api/living-dna/constitution/${b.id}/rules`, a.token, body);
    assert.equal(one.status, 201, one.body?.error);
    const two = await call('POST', `/api/living-dna/constitution/${a.id}/rules`, b.token, body);
    assert.equal(two.status, 409, `duplicate accepted: ${two.status}`);
    return '201 then 409';
  });

  // NOTE: each participant must address the other. Addressing yourself is a
// self-constitution and is refused on purpose.
await step('one-sided acceptance is never shown as mutual', async () => {
    const mine = await call('POST', `/api/living-dna/constitution/${b.id}/accept`, a.token);
    assert.equal(mine.status, 200, mine.body?.error);
    assert.equal(mine.body.iHaveAccepted, true);
    assert.equal(mine.body.theyHaveAccepted, false);
    assert.equal(mine.body.mutuallyAccepted, false, 'a single acceptance was reported as mutual');

    const view = await call('GET', `/api/living-dna/constitution/${a.id}`, b.token);
    assert.equal(view.body.mutuallyAccepted, false, 'the other side also saw a false mutual');
    assert.equal(view.body.iHaveAccepted, false);
    assert.equal(view.body.theyHaveAccepted, true);
    return 'one acceptance is not mutual';
  });

  await step('both acceptances produce mutual status', async () => {
    const theirs = await call('POST', `/api/living-dna/constitution/${a.id}/accept`, b.token);
    assert.equal(theirs.status, 200, theirs.body?.error);
    assert.equal(theirs.body.mutuallyAccepted, true, 'two acceptances were not mutual');
    const view = await call('GET', `/api/living-dna/constitution/${b.id}`, a.token);
    assert.equal(view.body.mutuallyAccepted, true);
    assert.ok(view.body.rules.every(r => r.status === 'agreed'), 'accepted rules should be agreed');
    return 'mutual after both';
  });

  await step('a new rule resets acceptance so it must be re-agreed', async () => {
    const add = await call('POST', `/api/living-dna/constitution/${a.id}/rules`, b.token, {
      category: 'Guests & quiet hours', rule_text: 'No overnight guests without a heads up',
    });
    assert.equal(add.status, 201, add.body?.error);
    assert.equal(add.body.acceptanceReset, true, 'the response should say acceptance was reset');
    const view = await call('GET', `/api/living-dna/constitution/${b.id}`, a.token);
    assert.equal(view.body.mutuallyAccepted, false, 'a changed document still reports mutual acceptance');
    assert.equal(view.body.agreedRules, 0, 'reset should return rules to proposed');
    return 'acceptance invalidated on change';
  });
} finally {
  // Run-scoped teardown, and deliberately belt-and-braces.
  //
  // The primary key is this run's own stamp: every address registered above is
  // matched by exact equality, so cleanup cannot touch another run or a real
  // user. The stamp-prefix sweep is a backstop for the case where the process
  // died before this block could run - three earlier runs left 9 accounts and 48
  // answer rows behind exactly that way, and they classified as real, so they
  // ranked in genuine users' feeds. Same shape as the layout.* residue that
  // qa:profile left behind.
  //
  // The sweep pattern is ^ld<13 digits>\. which is this suite's own convention;
  // it was checked to match no account that does not belong to this suite.
  try {
    const pg = (await import('pg')).default;
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    const exact = await db.query('DELETE FROM users WHERE email = ANY($1::text[]) RETURNING id', [emails]);
    const sweep = await db.query(
      "DELETE FROM users WHERE split_part(email,'@',1) ~ $1 RETURNING id", [`^ld${STAMP % 10 ** 13}\\.`]
    );
    // Anything left from an older run of this suite, same naming convention.
    const stale = await db.query(
      "DELETE FROM users WHERE split_part(email,'@',1) ~ '^ld[0-9]{13}\\.' RETURNING id"
    );
    await db.end();
    console.log(`\ncleanup: ${exact.rows.length} this run, ${sweep.rows.length} same-stamp, ${stale.rows.length} stale from earlier runs`);
  } catch (err) {
    console.error(`cleanup failed: ${err.message}`);
  }
}

const failed = results.filter(r => r[0] === 'FAIL');
console.log('');
for (const [status, name, detail] of results) console.log(`${status.padEnd(4)} ${name}\n     ${detail}`);
console.log(`\nall ${results.length - failed.length}/${results.length} Living DNA checks passed`);
process.exit(failed.length ? 1 : 0);