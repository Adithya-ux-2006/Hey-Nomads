// Applies database/schema_v2.sql to the configured database. Idempotent:
// every statement in the schema is IF NOT EXISTS, so this is safe to re-run.
//
// Splits on ";" but never inside a $$ ... $$ dollar-quoted body, which the
// trigger function contains.
//
//   node --import ./scripts/dns-shim.mjs scripts/apply-schema.mjs
import fs from 'fs';
import path from 'path';
import pg from 'pg';

for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const sql = fs.readFileSync(path.resolve(process.cwd(), '..', 'database', 'schema_v2.sql'), 'utf8');

const stmts = [];
let buf = '';
let inDollar = false;
for (let i = 0; i < sql.length; i++) {
  const c = sql[i];
  if (c === '$' && sql[i + 1] === '$') { inDollar = !inDollar; buf += '$$'; i++; continue; }
  if (c === ';' && !inDollar) { stmts.push(buf); buf = ''; continue; }
  buf += c;
}
stmts.push(buf);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  await db.connect();
} catch (err) {
  console.error('Could not connect. Is DATABASE_URL set?', err.message);
  process.exit(1);
}

let ok = 0;
let skipped = 0;
const failures = [];
for (const raw of stmts) {
  const body = raw.replace(/--[^\n]*/g, '').trim();
  if (!body) continue;
  // Reference data lives in the seeders, not in the schema.
  if (/^(INSERT|DELETE|UPDATE)/i.test(body)) { skipped++; continue; }
  try {
    await db.query(body);
    ok++;
  } catch (err) {
    failures.push(`${body.split('\n')[0].slice(0, 70)}\n     -> ${err.message}`);
  }
}

if (failures.length) {
  console.error(`${failures.length} statement(s) failed:`);
  for (const f of failures) console.error('  ' + f);
}
console.log(`applied ${ok}, skipped ${skipped} (data lives in the seeders), failed ${failures.length}`);
await db.end();
process.exit(failures.length ? 1 : 0);