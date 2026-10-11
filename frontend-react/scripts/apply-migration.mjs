// Applies a single migration file to the database named by DATABASE_URL.
//
//   node --import ./scripts/dns-shim.mjs scripts/apply-migration.mjs ../database/migrations/<file>.sql
//
// Safety: the database in .env is the one the deployment uses, so this refuses
// to touch it unless --force-production is passed. Migrations are additive, but
// "additive" is a claim about the SQL, not about what the file will be edited to
// contain next month.
import fs from 'fs';
import path from 'path';
import pg from 'pg';

// One guard implementation, so there is one thing to audit. This used to carry
// its own copy of the production check.
await import('./require-test-db.mjs');

const file = process.argv[2];
if (!file) { console.error('usage: apply-migration.mjs <file.sql>'); process.exit(2); }
if (!fs.existsSync(file)) { console.error(`not found: ${file}`); process.exit(2); }

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(2); }

// Host only. The guard has already refused the deployed database, so by here
// this is a test target. Never print the connection string, it carries a password.
const host = (() => { try { return new URL(url).host; } catch { return '(unparseable)'; } })();
console.log(`target: ${host}`);

const sql = fs.readFileSync(file, 'utf8');

// Strip comments BEFORE splitting on ';'. A sentence like "additive and
// reversible; has not been run against production" contains a semicolon that
// has nothing to do with statement separation.
const stripComments = text => {
  let out = '', quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; out += c; continue; }
    if (c === '-' && text[i + 1] === '-') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    out += c;
  }
  return out;
};

// No dollar-quoted bodies in these migrations, so a plain split is enough.
const stmts = stripComments(sql).split(';').map(s => s.trim()).filter(Boolean);

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
let ok = 0;
const failures = [];
for (const body of stmts) {
  try { await db.query(body); ok++; }
  catch (err) { failures.push(`${body.split('\n')[0].slice(0, 70)}\n     -> ${err.message}`); }
}
await db.end();

for (const f of failures) console.error('  ' + f);
console.log(`applied ${ok}, failed ${failures.length}`);
process.exit(failures.length ? 1 : 0);