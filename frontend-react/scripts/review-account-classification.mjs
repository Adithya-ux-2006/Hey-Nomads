// READ-ONLY review report for the account_kind migration.
//
// Prints what the interim email-prefix heuristic would classify, grouped by how
// strong the evidence is, so a human can approve each class before any backfill
// runs. It deliberately performs no UPDATE: classifying an existing account
// changes who can discover whom, and that needs explicit sign-off per class.
//
// Usage:
//   node --import ./scripts/dns-shim.mjs scripts/review-account-classification.mjs
//
// Deliberately not wired into package.json: it is a one-time review aid, not a
// verification gate.
import fs from 'fs';
import path from 'path';
import pg from 'pg';

for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

// Which accounts the migration column already exists on, if any.
const cols = await db.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'account_kind'`);
console.log(`account_kind column present: ${cols.rows.length > 0}`);
if (cols.rows.length === 0) {
  console.log('Migration not applied. Classification is still derived from the address,');
  console.log('which the application handles correctly either way.');
}

// The candidate set, split by how safe automatic classification would be.
// Redacted addresses: enough to recognise an account, not enough to spam it.
const rows = await db.query(`
  SELECT id, name,
         CASE
           WHEN email LIKE '%@heynomads.app' THEN 'demo'
           WHEN email LIKE 'walkthrough.%' THEN 'walkthrough'
           WHEN email LIKE 'qa.%' OR email LIKE 'verify%' THEN 'qa'
           ELSE 'heuristic-real'
         END AS proposed,
         regexp_replace(email, '(^.).*(@.*$)', '\\1***\\2') AS address
  FROM users
  ORDER BY proposed, id`);

const groups = {};
for (const r of rows.rows) (groups[r.proposed] ||= []).push(r);

const CONFIDENCE = {
  'demo': 'HIGH - seeded fixtures own the heynomads.app domain',
  'walkthrough': 'MEDIUM - distinctive prefix, but could in principle be a real name',
  'qa': 'MEDIUM - prefix also used by the verify suite; check for genuine users',
  'heuristic-real': 'DEFAULT - no backfill needed, but review the two above first',
};

console.log('\nproposed classification counts:');
for (const [kind, list] of Object.entries(groups)) {
  console.log(`  ${kind.padEnd(14)} ${String(list.length).padStart(3)}   (${CONFIDENCE[kind]})`);
}

for (const kind of ['walkthrough', 'qa', 'heuristic-real']) {
  const list = groups[kind] || [];
  if (!list.length) continue;
  console.log(`\n--- ${kind} (${list.length}) — review each before any UPDATE ---`);
  for (const r of list) console.log(`  id=${String(r.id).padStart(4)}  ${r.address.padEnd(28)} ${r.name}`);
}

console.log(`
No rows were modified. To proceed, run the UPDATE statements in
database/migrations/2026-10-10_add_account_kind.sql yourself, one class at a
time, after confirming the list above. Anything ambiguous must be left
'unknown' rather than guessed: an unknown account is excluded from the real feed
(fail closed), which is the safe direction to be wrong in.
`);

await db.end();