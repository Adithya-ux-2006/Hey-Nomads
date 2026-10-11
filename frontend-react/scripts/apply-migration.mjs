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

const envPath = path.resolve(process.cwd(), '.env');
const readEnv = () => {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
};

const file = process.argv[2];
if (!file) { console.error('usage: apply-migration.mjs <file.sql>'); process.exit(2); }
if (!fs.existsSync(file)) { console.error(`not found: ${file}`); process.exit(2); }

const url = process.env.DATABASE_URL || readEnv().DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(2); }

const host = (() => { try { return new URL(url).host; } catch { return '(unparseable)'; } })();
const deployedHost = (() => { try { return new URL(readEnv().DATABASE_URL || '').host; } catch { return null; } })();

const isDeployed = deployedHost && host === deployedHost;
if (isDeployed && !process.argv.includes('--force-production')) {
  console.error(`refusing: ${host} is the database in .env, i.e. the deployed one.`);
  console.error('Point DATABASE_URL at a test database, or pass --force-production deliberately.');
  process.exit(3);
}
console.log(`target: ${host}${isDeployed ? '  (FORCED past the deployed-database guard)' : ''}`);

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