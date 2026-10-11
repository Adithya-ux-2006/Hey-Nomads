// Tests scripts/require-test-db.mjs without connecting to anything.
//
// Every case runs the guard in a child process with a synthetic DATABASE_URL
// and asserts the exit code. The guard only parses URLs; it never opens a
// socket, so these cases cannot touch production even though one of them names
// the real production endpoint.
//
// The production endpoint id is read from .env so the "same database, different
// URL form" cases are real rather than hypothetical, but only the endpoint id
// is ever derived. No username, password, port or full connection string is
// printed or passed to a child other than the synthetic values below.
//
//   node scripts/test-require-test-db.mjs
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.join(here, 'require-test-db.mjs');
const guardUrl = 'file:///' + GUARD.replace(/\\/g, '/');

// Endpoint id of the deployed database, e.g. "ep-abc.c-4.us-east-2.aws.neon.tech".
const envFile = path.resolve(here, '..', '.env');
let deployedEndpoint = null;
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) {
      try { deployedEndpoint = new URL(m[1].replace(/^["']|["']$/g, '')).host; } catch { /* ignore */ }
    }
  }
}
if (!deployedEndpoint) {
  console.error('cannot determine the deployed endpoint from .env; refusing to fake the cases');
  process.exit(2);
}

const FAKE = 'postgresql://synthetic:synthetic@';
const cases = [
  { name: 'production pooler endpoint', url: `${FAKE}${deployedEndpoint}/neondb`, want: 'REFUSED' },
  { name: 'same database, direct endpoint (no -pooler)',
    url: `${FAKE}${deployedEndpoint.replace(/^([^.]+)-pooler(\.|$)/, '$1$2')}/neondb`, want: 'REFUSED' },
  { name: 'same database, trailing dot in host',
    url: `${FAKE}${deployedEndpoint}.`, want: 'REFUSED' },
  { name: 'same database, uppercase host',
    url: `${FAKE}${deployedEndpoint.toUpperCase()}/neondb`, want: 'REFUSED' },
  { name: 'malformed URL', url: 'not-a-url', want: 'REFUSED' },
  { name: 'DATABASE_URL unset (falls back to .env)', url: null, want: 'REFUSED' },
  { name: 'empty DATABASE_URL', url: '', want: 'REFUSED' },
  { name: 'explicitly unrelated test branch', url: `${FAKE}ep-synthetic-test-branch.aws.neon.tech/neondb`, want: 'ALLOWED' },
];

// A directory holding its OWN copy of the guard and no .env beside it, to
// exercise the CONFIRM_TEST_DATABASE_HOST path. Copying only the probe is not
// enough: the guard resolves .env relative to itself, so it would still find
// frontend-react/.env and take the "compare against deployed" branch.
const noEnvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-noenv-'));
fs.mkdirSync(path.join(noEnvDir, 'scripts'));
fs.copyFileSync(GUARD, path.join(noEnvDir, 'scripts', 'require-test-db.mjs'));
fs.writeFileSync(path.join(noEnvDir, 'probe.mjs'),
  `await import('./scripts/require-test-db.mjs'); console.log('ALLOWED');\n`);

const run = (url, { cwd = os.tmpdir(), confirm } = {}) => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.CONFIRM_TEST_DATABASE_HOST;
  delete env.ALLOW_DEPLOYED_DB_TESTS;
  if (url !== null) env.DATABASE_URL = url;
  if (confirm) env.CONFIRM_TEST_DATABASE_HOST = confirm;
  try {
    const out = execFileSync('node', [path.join(cwd, 'probe.mjs')], { cwd, env, encoding: 'utf8' });
    return { allowed: out.includes('ALLOWED'), code: 0 };
  } catch (e) {
    return { allowed: String(e.stdout || '').includes('ALLOWED'), code: e.status };
  }
};

// probe.mjs must sit next to nothing in particular; cwd only affects relative
// resolution, and the guard resolves .env from its own location regardless.
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
fs.writeFileSync(path.join(workDir, 'probe.mjs'),
  `await import(${JSON.stringify(guardUrl)}); console.log('ALLOWED');\n`);

let failures = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: expected ${want}, got ${got ? 'ALLOWED (ran)' : 'REFUSED'}`);
};

for (const c of cases) check(c.name, run(c.url, { cwd: workDir }).allowed, c.want === 'ALLOWED');

check('no .env, no CONFIRM set', run(`${FAKE}ep-synthetic-test-branch.aws.neon.tech/neondb`, { cwd: noEnvDir }).allowed, false);
check('no .env, wrong CONFIRM', run(`${FAKE}ep-synthetic-test-branch.aws.neon.tech/neondb`,
  { cwd: noEnvDir, confirm: 'wrong-host.aws.neon.tech' }).allowed, false);
check('no .env, correct CONFIRM', run(`${FAKE}ep-synthetic-test-branch.aws.neon.tech/neondb`,
  { cwd: noEnvDir, confirm: 'ep-synthetic-test-branch.aws.neon.tech' }).allowed, true);

fs.rmSync(workDir, { recursive: true, force: true });
fs.rmSync(noEnvDir, { recursive: true, force: true });

console.log(`\n${cases.length + 3} cases, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);