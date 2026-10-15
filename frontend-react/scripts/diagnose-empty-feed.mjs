// Isolate whether /api/roommates/recommended returns nothing, or the frontend
// fails to render what it returns. Registers run-scoped accounts, exercises the
// real onboarding routes, calls the API with a real token, then reports the
// exact predicate outcomes for each candidate.
//
// Teardown matches only this run's reserved namespace and reports counts before
// and after, so a failed cleanup is visible rather than silent.
import pg from 'pg';

// This script registers run-scoped accounts and opens a direct connection.
// Refuse to do that to the deployed database -- see require-test-db.mjs. The
// import is awaited before the client is constructed, so there is no path to
// a connection without the check having run first.
await import('./require-test-db.mjs');

const BASE = process.argv[2] || 'http://127.0.0.1:3100';
const STAMP = Date.now();
const NS = `feedadj${STAMP}`;           // reserved namespace, 13-digit stamp
const emails = [];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const countNs = async () => {
  const r = await db.query('SELECT count(*)::int AS n FROM users WHERE split_part(email,\'@\',1) LIKE $1', [`${NS}.%`]);
  return r.rows[0].n;
};

try {
  console.log('namespace before:', await countNs());

  const reg = async (tag) => {
    const email = `${NS}.${tag}@gmail.com`;
    emails.push(email);
    const r = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Verify12345!', name: `Feed ${tag}` }),
    });
    const j = await r.json();
    if (r.status !== 201 || !j.token) throw new Error(`register ${tag}: ${r.status} ${JSON.stringify(j).slice(0, 120)}`);
    return j;
  };

  const peer = await reg('peer');
  const me = await reg('me');

  // Confirm the rows actually exist before trusting any token.
  const rows = await db.query(
    `SELECT u.id, u.name, u.account_kind, u.onboarding_complete,
            p.occupation, p.city, p.budget
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.email = ANY($1::text[]) ORDER BY u.id`, [emails]
  );
  console.log('persisted rows:', rows.rows.length);
  for (const x of rows.rows) console.log(`  id=${x.id} kind=${x.account_kind} onboarded=${x.onboarding_complete} city=${x.city ?? '-'} budget=${x.budget ?? '-'}`);

  // Post the real onboarding route so the requester is as complete as a user would be.
  const onb = await fetch(`${BASE}/api/onboarding`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${me.token}` },
    body: JSON.stringify({ moving_to: 'Lisbon', budget: 980, cleanliness: 4, sleep_time: 'early' }),
  });
  console.log('onboarding status:', onb.status);

  const feed = await fetch(`${BASE}/api/roommates/recommended`, { headers: { Authorization: `Bearer ${me.token}` } });
  const body = await feed.text();
  console.log('recommended status:', feed.status, '| bytes:', body.length);
  let parsed = null;
  try { parsed = JSON.parse(body); } catch { /* not json */ }
  console.log('recommended rows:', Array.isArray(parsed) ? parsed.length : '(not an array)');
  if (Array.isArray(parsed)) for (const c of parsed.slice(0, 5)) console.log(`   ${c.id} ${c.name} score=${c.score}`);

  // Predicate-by-predicate, read only.
  const pred = await db.query(
    `SELECT u.id, u.name, u.account_kind,
            (u.id = $2) AS is_self,
            (u.account_kind = 'real') AS passes_kind,
            EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = $2 AND s.swiped_id = u.id) AS already_swiped,
            (p.user_id IS NOT NULL) AS has_profile
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id <> $2 ORDER BY u.created_at DESC LIMIT 8`,
    [me.user.id, me.user.id]
  );
  console.log('\npredicate outcomes for the requester:');
  for (const x of pred.rows) {
    console.log(`  id=${x.id} kind=${x.account_kind} is_self=${x.is_self} passes_kind=${x.passes_kind} swiped=${x.already_swiped} profile=${x.has_profile}  ${x.name}`);
  }
} catch (e) {
  console.log('ERR:', e.message.slice(0, 200));
} finally {
  const before = await countNs();
  // Narrow, namespace-scoped delete. Counted before and after so a silent
  // failure is visible.
  const del = await db.query('DELETE FROM users WHERE email = ANY($1::text[]) RETURNING id', [emails]);
  const after = await countNs();
  console.log(`\ncleanup: namespace ${before} -> ${after}, deleted ${del.rows.length}`);
  if (after !== 0) console.log('WARNING: residue remains, do not broaden the predicate automatically');
  await db.end();
}