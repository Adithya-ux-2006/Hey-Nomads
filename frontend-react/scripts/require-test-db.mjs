// Refuses to run a database-writing script against the deployed database.
//
// The QA scripts register throwaway accounts. Run against the database in .env
// they write to the live product and, because cleanup covers only the prefixes
// it knows about, most of them survive. That is how ~185 stray accounts ended
// up in production. This makes the mistake impossible rather than recoverable.
//
//   node --import ./scripts/dns-shim.mjs scripts/require-test-db.mjs
//
// Overrides, both deliberate:
//   ALLOW_DEPLOYED_DB_TESTS=1     proceed against the deployed database
//   CONFIRM_TEST_DATABASE_HOST=h  when there is no .env, name the intended host
//
// Fails CLOSED. An unparseable DATABASE_URL, a missing .env, or a target that
// cannot be named is treated as unsafe, because the cost of a false refusal is
// a confusing error message and the cost of a false pass is production data.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve .env next to THIS file, not next to the current directory. A guard
// that can be switched off by running from another folder is not a guard.
const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, '..', '.env');

const deny = why => {
  console.error(`refusing to run: ${why}`);
  console.error('These scripts create accounts. Point DATABASE_URL at a test database, e.g.');
  console.error('  neon branches create --project-id <id> --name test-harness --parent production');
  console.error('or set ALLOW_DEPLOYED_DB_TESTS=1 if you genuinely intend to write to production.');
  process.exit(3);
};

// Neon exposes one database through several endpoints. `ep-x-pooler.region` and
// `ep-x.region` are the same database, so comparing raw hostnames lets a
// trivial rewrite walk straight past this check. Compare the endpoint id.
const normalizeHost = url => {
  if (typeof url !== 'string' || !url.trim()) return null;
  let host;
  try { host = new URL(url).host; } catch { return null; }
  host = host.toLowerCase().replace(/\.$/, '');
  const at = host.indexOf('@');
  if (at !== -1) host = host.slice(at + 1);
  return host.replace(/^([^.]+)-pooler(\.|$)/, '$1$2');
};

const readEnvUrl = () => {
  if (!fs.existsSync(envFile)) return null;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
};

// The override must NOT process.exit() here. This module is imported by
// apply-migration.mjs, so an exit would end the importer before it applies
// anything — and exit(0) makes that look like success. Fall through instead:
// standalone runs still end with code 0 after the warning, while importers
// continue into their real work.
if (process.env.ALLOW_DEPLOYED_DB_TESTS === '1') {
  console.warn('ALLOW_DEPLOYED_DB_TESTS=1: proceeding against a database that may be the deployed one.');
} else {
  const configured = process.env.DATABASE_URL;
  const effective = configured || readEnvUrl();

  if (!effective) {
    deny('no database configuration was found, so the target cannot be established');
  }
  const target = normalizeHost(effective);
  if (!target) {
    // A malformed URL is not evidence of a safe target.
    deny('DATABASE_URL is set but could not be parsed, so the target is unknown');
  }

  const deployed = normalizeHost(readEnvUrl());

  if (deployed) {
    if (target === deployed) deny(`the target is the deployed database (${target})`);
  } else {
    // No .env means we cannot know where production is, so ask rather than assume.
    const confirmed = normalizeHost(`postgresql://${process.env.CONFIRM_TEST_DATABASE_HOST || ''}`);
    if (!confirmed) {
      deny('there is no .env to compare against, so set CONFIRM_TEST_DATABASE_HOST to the test host you intend to use');
    }
    if (confirmed !== target) {
      deny(`CONFIRM_TEST_DATABASE_HOST (${confirmed}) does not match the actual target (${target})`);
    }
  }

  // Host only. Never print the connection string, which carries the password.
  console.log(`test database confirmed: ${target}`);
}