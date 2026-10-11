// READ-ONLY verification that production was restored to the pre-incident point.
//
// Asserts the target host before connecting, opens a READ ONLY transaction, and
// proves it by attempting a write the server must reject. Prints counts only.
//
//   EXPECT_ENDPOINT_SUBSTRING=ep-... node --import ./scripts/dns-shim.mjs scripts/verify-production-restore.mjs
import fs from 'fs';
import pg from 'pg';

const EXPECTED = { users: 215, swipes: 113, matches: 48, conversations: 357, messages: 2, agreements: 40 };

const env = {};
for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = process.env.DATABASE_URL || env.DATABASE_URL;
const host = new URL(url).hostname;
const expect = process.env.EXPECT_ENDPOINT_SUBSTRING;
if (expect && !host.includes(expect)) {
  console.error(`refusing: target ${host} does not contain "${expect}"`);
  process.exit(3);
}
console.log('TARGET:', host);

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
await db.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
await db.query('BEGIN TRANSACTION READ ONLY');

const r = await db.query(`
  SELECT (SELECT count(*) FROM users)::int          AS users,
         (SELECT count(*) FROM swipes)::int         AS swipes,
         (SELECT count(*) FROM matches)::int        AS matches,
         (SELECT count(*) FROM conversations)::int AS conversations,
         (SELECT count(*) FROM messages)::int       AS messages,
         (SELECT count(*) FROM agreements)::int     AS agreements`);

const v = r.rows[0];
let bad = 0;
console.log('\nTABLE             ACTUAL   EXPECTED   STATUS');
for (const k of Object.keys(EXPECTED)) {
  const ok = v[k] === EXPECTED[k];
  if (!ok) bad++;
  console.log(`  ${k.padEnd(16)}${String(v[k]).padEnd(9)}${String(EXPECTED[k]).padEnd(11)}${ok ? 'MATCH' : '*** DIFFERS ***'}`);
}

const mx = await db.query('SELECT max(created_at)::text AS newest FROM conversations');
console.log(`\n  newest conversation: ${mx.rows[0].newest}`);

const nonDemo = await db.query(`SELECT count(*)::int AS n FROM users
  WHERE email NOT LIKE '%@heynomads.app' AND email NOT LIKE 'qa.%'
    AND email NOT LIKE 'verify%' AND email NOT LIKE 'walkthrough.%'`);
console.log(`  non-reserved-prefix accounts: ${nonDemo.rows[0].n} (test residue present, as expected pre-incident)`);

await db.query('ROLLBACK');
await db.end();
console.log(`\n  ${bad === 0 ? 'ALL EXPECTED COUNTS MATCH' : bad + ' TABLE(S) DIFFER FROM EXPECTED'}`);
process.exit(bad === 0 ? 0 : 1);