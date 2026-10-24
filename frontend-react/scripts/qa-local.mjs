// Local QA harness: boots the real API handler and Vite against the isolated
// test database, runs the browser suites against that origin, then stops both
// and proves the ports came back.
//
//   cd frontend-react
//   DATABASE_URL=<test url> node scripts/qa-local.mjs [--suite browser|profile]
//
// DATABASE_URL is inherited from the caller and is refused if it names the
// deployed database -- see require-test-db.mjs. Both child servers are always
// stopped in a finally block, so an interrupted run cannot leave them behind.
import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

// Fail closed before anything is started: the handler this boots writes to the
// database, and local-api.mjs is not itself guarded.
await import('./require-test-db.mjs');

const here = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.resolve(here, '..');
const PORT_API = 3100;
const PORT_WEB = 5199;
const BASE = `http://127.0.0.1:${PORT_WEB}`;

const argv = process.argv.slice(2);
const SUITES = {
  browser: { script: 'browser-qa.mjs', token: 'browser qa passed' },
  profile: { script: 'profile-layout-qa.mjs', token: 'profile layout qa passed' },
  ui: { script: 'ui-inspect.mjs', token: 'ui inspection passed' },
  journey: { script: 'ui-walkthrough.mjs', token: 'ui walkthrough passed' },
  demo: { script: 'demo-tour-qa.mjs', token: 'demo tour qa passed' },
};
// `all` is the fast local gate: the two suites that cover rendering and layout.
// ui, journey and demo are slower and are run through their own gates.
const DEFAULT_SUITE = ['browser', 'profile'];
const suiteFlag = argv.indexOf('--suite');
const suite = suiteFlag !== -1 ? argv[suiteFlag + 1] : 'all';
const selected = suite === 'all' ? DEFAULT_SUITE : [suite];
for (const s of selected) {
  if (!SUITES[s]) {
    console.error(`unknown suite "${s}" -- expected ${Object.keys(SUITES).join(', ')} or all`);
    process.exit(2);
  }
}

const portFree = port => new Promise(resolve => {
  const probe = net.createServer();
  probe.once('error', () => resolve(false));
  probe.once('listening', () => probe.close(() => resolve(true)));
  probe.listen(port, '127.0.0.1');
});

// Any HTTP response -- even a 404 -- proves the process is accepting requests.
// Connection refusal throws, which is what "not ready yet" looks like.
const responds = async url => {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
};

const waitFor = async (url, label, ms = 60000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await responds(url)) return;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`${label} did not start accepting requests within ${ms}ms`);
};

const children = [];
const logs = { api: '', vite: '' };

const start = (key, file, args) => {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  const absorb = chunk => { logs[key] += chunk.toString(); };
  child.stdout.on('data', absorb);
  child.stderr.on('data', absorb);
  child.on('error', err => { logs[key] += `\nspawn error: ${err.message}`; });
  children.push({ key, child });
  return child;
};

const stopAll = async () => {
  for (const { child } of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  // Give them a moment to release their sockets, then force the stragglers.
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (children.every(({ child }) => child.exitCode !== null)) break;
    await new Promise(r => setTimeout(r, 200));
  }
  for (const { child } of children) {
    if (child.exitCode === null) { try { child.kill('SIGKILL'); } catch {} }
  }
  // Ports must be free again; a leaked server is a real defect, not a footnote.
  await new Promise(r => setTimeout(r, 500));
  const leaked = [];
  if (!(await portFree(PORT_API))) leaked.push(PORT_API);
  if (!(await portFree(PORT_WEB))) leaked.push(PORT_WEB);
  return leaked;
};

const runSuite = key => new Promise(resolve => {
  const { script } = SUITES[key];
  const child = spawn(
    process.execPath,
    ['--import', './scripts/dns-shim.mjs', `scripts/${script}`, BASE],
    // Suites read the base either from argv or from env; provide both so a
    // script written either way is pointed at this local origin, never at the
    // deployed site.
    { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BASE_URL: BASE, API_BASE: `http://127.0.0.1:${PORT_API}` } },
  );
  let out = '';
  const absorb = chunk => { const t = chunk.toString(); out += t; process.stdout.write(t); };
  child.stdout.on('data', absorb);
  child.stderr.on('data', absorb);
  child.on('error', err => { out += `\nspawn error: ${err.message}`; resolve({ key, code: 1, out }); });
  child.on('close', code => resolve({ key, code, out }));
});

let leaked = [];
let results = [];

try {
  for (const [port, name] of [[PORT_API, 'API'], [PORT_WEB, 'Vite']]) {
    if (!(await portFree(port))) {
      console.error(`port ${port} (${name}) is already in use; stop it before running local QA`);
      process.exit(1);
    }
  }

  start('api', 'local-api', ['--import', './scripts/dns-shim.mjs', 'scripts/local-api.mjs']);
  start('vite', 'vite', ['node_modules/vite/bin/vite.js', '--port', String(PORT_WEB), '--strictPort']);

  await waitFor(`http://127.0.0.1:${PORT_API}/`, 'API');
  await waitFor(`${BASE}/`, 'Vite');
  console.log(`\nSERVERS_READY api=:${PORT_API} vite=:${PORT_WEB} base=${BASE}\n`);

  for (const key of selected) results.push(await runSuite(key));
} catch (err) {
  console.error(`\nharness error: ${err.message}`);
  results.push({ key: 'harness', code: 1, out: err.message });
} finally {
  leaked = await stopAll();
}

for (const { key, out } of results) {
  const { token } = SUITES[key];
  if (!out.includes(token)) console.log(`MISSING_TOKEN ${key}: expected "${token}"`);
}

const failedSuites = results.filter(r => r.code !== 0);
const missingToken = results.filter(r => !SUITES[r.key] || !r.out.includes(SUITES[r.key].token));

console.log(`\nSERVERS_STOPPED leaked=${leaked.length ? leaked.join(',') : 'none'}`);
if (leaked.length) console.log('SERVERS_DIRTY');
else console.log('SERVERS_CLEAN');

if (failedSuites.length || missingToken.length || leaked.length) {
  console.log(`QA_LOCAL_FAILED suites=${failedSuites.map(r => r.key).join(',') || 'none'} ` +
    `missingToken=${missingToken.map(r => r.key).join(',') || 'none'} leaked=${leaked.length}`);
  process.exit(1);
}
console.log('QA_LOCAL_OK');
