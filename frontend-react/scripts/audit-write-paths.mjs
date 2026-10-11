// Static audit of every entry point that can modify data.
//
// This only reads files. It never runs a script and never opens a connection,
// so it is safe to point at a repository that has already caused an incident.
//
// For each candidate it reports how it writes (direct SQL, or through HTTP),
// whether a guard runs before the first write, and how the target is chosen.
// Exits non-zero if a writing entry point has no guard ahead of its first write.
//
//   node scripts/audit-write-paths.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const WRITE_SQL = /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+TABLE|ON\s+CONFLICT)\b/i;
const CONNECTS = /\bnew\s+(pg\.)?(Client|Pool)\b/;
const GUARD = /require-test-db\.mjs/;
const HTTP_GUARD = /ALLOW_DEPLOYED_SMOKE|ALLOW_PRODUCTION_WALKTHROUGH/;
const FETCH_WRITE = /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i;
const TARGET_ENV = /process\.env\.(DATABASE_URL|BASE_URL|LOCAL_API_PORT)/;

// Reviewed exceptions, each with the reason it is safe. An exception is a claim
// a reviewer has to re-check, so it is recorded here rather than assumed.
const EXCEPTIONS = {
  'scripts/verify-security.mjs': 'POSTs only to /api/auth/login against an unreachable DATABASE_URL '
    + '(127.0.0.1:1) to exercise rate limiting. Login creates no records.',
  'scripts/review-account-classification.mjs': 'Read-only by construction: issues SELECT only and '
    + 'has no write path. Auditing production is this script\'s entire purpose, so blocking it would '
    + 'block the investigation.',
};

const rows = [];
const dir = path.join(root, 'scripts');
for (const name of fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
  const src = fs.readFileSync(path.join(dir, name), 'utf8');
  // Strip comments so a DELETE mentioned in a comment is not counted as a write.
  const code = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  const writesSql = WRITE_SQL.test(code) && CONNECTS.test(code);
  const writesHttp = FETCH_WRITE.test(code);
  const readsDb = CONNECTS.test(code) && !writesSql;
  if (!writesSql && !writesHttp && !readsDb) continue;

  const firstWrite = Math.min(
    ...[WRITE_SQL, FETCH_WRITE].map(re => {
      const m = code.match(new RegExp(re.source, re.flags.replace('g', '')));
      return m ? m.index : Infinity;
    }),
  );
  const firstConn = (() => { const m = code.match(CONNECTS); return m ? m.index : Infinity; })();
  const guardAt = (() => { const m = code.match(GUARD); return m ? m.index : Infinity; })();
  const httpGuardAt = (() => { const m = code.match(HTTP_GUARD); return m ? m.index : Infinity; })();

  const writes = writesSql && writesHttp ? 'SQL+HTTP' : writesSql ? 'SQL' : writesHttp ? 'HTTP' : 'read-only';
  const guardKind = guardAt < Infinity ? 'require-test-db' : httpGuardAt < Infinity ? 'BASE_URL opt-in' : 'NONE';
  const guardedBeforeWrite = guardKind === 'NONE' ? false
    : Math.min(guardAt, httpGuardAt) < Math.min(firstWrite, firstConn === Infinity ? firstWrite : firstConn);

  rows.push({
    entry: `scripts/${name}`,
    writes,
    guard: guardKind,
    guarded: guardedBeforeWrite,
    target: TARGET_ENV.test(code) ? 'env / .env' : 'fixed',
    npm: Object.entries(pkg.scripts).filter(([, v]) => v.includes(name)).map(([k]) => k).join(','),
    exception: EXCEPTIONS[`scripts/${name}`] || null,
  });
}

const failures = rows.filter(r => r.writes !== 'read-only' && !r.guarded && !r.exception);
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('ENTRY POINT', 40)}${pad('WRITES', 10)}${pad('GUARD', 20)}${pad('BEFORE WRITE', 14)}TARGET`);
for (const r of rows) {
  console.log(`${pad(r.entry, 40)}${pad(r.writes, 10)}${pad(r.guard, 20)}${pad(r.guarded ? 'yes' : 'NO', 14)}${r.target}`);
}
console.log(`\n${rows.length} database-touching entry points, ${failures.length} unguarded writer(s)`);
for (const f of failures) console.log(`  UNGUARDED WRITER: ${f.entry} (${f.writes})`);
for (const [entry, why] of Object.entries(EXCEPTIONS)) {
  console.log(`\nREVIEWED EXCEPTION: ${entry}\n  ${why}`);
}
// Known limit of this check: it matches write keywords in source, so a script
// that executes SQL assembled at runtime (apply-migration.mjs) is classified by
// its guard rather than its keywords. Those are covered by test-require-test-db.
console.log('\nLIMITATION: runtime-assembled SQL is not detectable by keyword matching;');
console.log('apply-migration.mjs is verified through test-require-test-db.mjs instead.');
process.exit(failures.length ? 1 : 0);