// Refuses to run a database-writing script against the deployed database.
//
// The QA scripts register throwaway accounts. Run against the database in .env
// they write to the live product and, because cleanup covers only the prefixes
// it knows about, most of them survive. That is how ~185 stray accounts ended
// up in production. This makes the mistake impossible rather than recoverable.
//
//   node --import ./scripts/dns-shim.mjs scripts/require-test-db.mjs
//
// Override only if you genuinely mean it: ALLOW_DEPLOYED_DB_TESTS=1.
import fs from 'fs';
import path from 'path';

const hostOf = url => { try { return new URL(url).host; } catch { return null; } };

const envFile = path.resolve(process.cwd(), '.env');
const readEnvUrl = () => {
  if (!fs.existsSync(envFile)) return null;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
};

const deployedHost = hostOf(readEnvUrl());
// These scripts load .env only for variables the environment does not already
// define, so an unset DATABASE_URL means "use .env", i.e. the deployed one.
// Resolving the target the same way is the whole point of the check.
const target = hostOf(process.env.DATABASE_URL || readEnvUrl() || '');

if (deployedHost && target === deployedHost && process.env.ALLOW_DEPLOYED_DB_TESTS !== '1') {
  console.error(`refusing to run: DATABASE_URL is the deployed database (${target}).`);
  console.error('These scripts create accounts. Point DATABASE_URL at a test database, e.g.');
  console.error('  neon branches create --project-id <id> --name test-harness --parent production');
  console.error('or set ALLOW_DEPLOYED_DB_TESTS=1 if you genuinely intend to write to production.');
  process.exit(3);
}