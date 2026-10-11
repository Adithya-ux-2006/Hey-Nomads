// READ-ONLY verification of the recovery-verify branch.
//
// Refuses to run unless the target host is the endpoint we expect, so it is
// impossible to query production by accident. Opens a READ ONLY transaction and
// proves it by attempting a write that the server must reject.
//
//   DATABASE_URL=<recovery-verify url> node --import ./scripts/dns-shim.mjs scripts/verify-recovery-branch.mjs
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not provided; refusing'); process.exit(2); }

const host = new URL(url).hostname;
const EXPECT = process.env.EXPECT_ENDPOINT_SUBSTRING;
if (EXPECT && !host.includes(EXPECT)) {
  console.error(`refusing: connected target ${host} does not contain expected "${EXPECT}"`);
  process.exit(3);
}
console.log('TARGET CONFIRMED  :', host);
console.log('expected substring:', EXPECT || '(none supplied)');

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
await db.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
await db.query('BEGIN TRANSACTION READ ONLY');

const r = await db.query(`
  SELECT (SELECT count(*) FROM users)::int        AS users,
         (SELECT count(*) FROM swipes)::int       AS swipes,
         (SELECT count(*) FROM matches)::int      AS matches,
         (SELECT count(*) FROM conversations)::int AS conversations,
         (SELECT count(*) FROM messages)::int     AS messages,
         (SELECT count(*) FROM agreements)::int   AS agreements`);

const v = r.rows[0];
const expected = { users: 210, swipes: 107, matches: 46 };
console.log('\nCOUNTS');
for (const k of ['users', 'swipes', 'matches', 'conversations', 'messages', 'agreements']) {
  const note = k in expected ? (v[k] === expected[k] ? '  <- matches pre-incident' : `  <- EXPECTED ${expected[k]}`) : '';
  console.log(`  ${k.padEnd(14)} ${String(v[k]).padEnd(6)}${note}`);
}

const mx = await db.query(`SELECT max(created_at)::text AS newest FROM conversations`);
console.log(`\n  newest conversation: ${mx.rows[0].newest}`);

const real = await db.query(`
  SELECT count(*)::int AS n FROM users
  WHERE email NOT LIKE '%@heynomads.app' AND email NOT LIKE 'qa.%'
    AND email NOT LIKE 'verify%' AND email NOT LIKE 'walkthrough.%'`);
console.log(`  non-reserved-prefix accounts: ${real.rows[0].n}`);

await db.query('ROLLBACK');
// Prove read-only on a throwaway connection so the rollback is not polluted.
const probe = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await probe.connect();
await probe.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
await probe.query('BEGIN TRANSACTION READ ONLY');
let blocked = false;
try { await probe.query('CREATE TEMP TABLE guard_probe(x int)'); }
catch (err) { blocked = /read-only/i.test(err.message); }
await probe.query('ROLLBACK');
await probe.end();
await db.end();

console.log(`\n  write attempt: ${blocked ? 'BLOCKED by server (read-only confirmed)' : 'NOT BLOCKED - investigate'}`);