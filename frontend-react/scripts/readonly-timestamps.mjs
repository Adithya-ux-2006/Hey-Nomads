// READ-ONLY: newest row timestamps, used to locate the incident in the timeline.
import fs from 'fs';
import pg from 'pg';

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL || env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();
await db.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
await db.query('BEGIN TRANSACTION READ ONLY');

const r = await db.query(`
  SELECT 'users' AS t, count(*)::int n, max(created_at)::text newest FROM users
  UNION ALL SELECT 'conversations', count(*)::int, max(created_at)::text FROM conversations
  UNION ALL SELECT 'swipes', count(*)::int, max(created_at)::text FROM swipes
  UNION ALL SELECT 'matches', count(*)::int, max(created_at)::text FROM matches
  UNION ALL SELECT 'shortlists', count(*)::int, max(created_at)::text FROM shortlists
  ORDER BY t`);
for (const x of r.rows) console.log(`  ${x.t.padEnd(14)} n=${String(x.n).padEnd(5)} newest=${x.newest}`);
const now = await db.query('SELECT now()::text AS db_now');
console.log('  db now      ', now.rows[0].db_now);

await db.query('ROLLBACK');
await db.end();