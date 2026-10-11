// READ-ONLY count of the configured database.
//
// Safety: the session is put into READ ONLY mode before any statement runs, so
// the server itself rejects INSERT/UPDATE/DELETE/DDL for this connection even if
// this file were edited by mistake. Nothing is printed except row counts.
//
//   node --import ./scripts/dns-shim.mjs <this file>
import fs from 'fs';
import pg from 'pg';

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(2); }

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await db.connect();
} catch (err) {
  console.error('CONNECT FAILED');
  console.error('  code    :', err.code || '(none)');
  console.error('  message :', String(err.message).replace(/:\/\/[^@]*@/, '://[redacted]@'));
  process.exit(1);
}

// Belt and braces: refuse writes at the server for the rest of this session.
await db.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
await db.query('BEGIN TRANSACTION READ ONLY');

const t = await db.query(`SELECT current_database() db,
  (SELECT count(*) FROM users)::int      AS users,
  (SELECT count(*) FROM swipes)::int     AS swipes,
  (SELECT count(*) FROM matches)::int    AS matches,
  (SELECT count(*) FROM conversations)::int AS conversations,
  (SELECT count(*) FROM messages)::int   AS messages,
  (SELECT count(*) FROM agreements)::int AS agreements,
  (SELECT count(*) FROM shortlists)::int AS shortlists`);

// Prove the read-only claim rather than assert it.
let writeBlocked = false;
try { await db.query('CREATE TEMP TABLE guard_probe(x int)'); }
catch (err) { writeBlocked = /read-only/i.test(err.message); }

const r = t.rows[0];
console.log('READ-ONLY SESSION ESTABLISHED');
console.log('  database        :', r.db);
console.log('  users           :', r.users);
console.log('  swipes          :', r.swipes);
console.log('  matches         :', r.matches);
console.log('  conversations   :', r.conversations);
console.log('  messages        :', r.messages);
console.log('  agreements      :', r.agreements);
console.log('  shortlists      :', r.shortlists);
console.log('  write attempt   :', writeBlocked ? 'BLOCKED by server (read-only confirmed)' : 'NOT BLOCKED - investigate');

const mx = await db.query(`SELECT max(created_at)::text AS latest FROM conversations`);
console.log('  newest convo    :', mx.rows[0].latest);

await db.query('ROLLBACK');
await db.end();