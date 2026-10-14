// Small gate wrapper. Each subcommand runs one real check and prints a
// success-only token, so a ledger gate can require both exit 0 and a marker
// that is only emitted after every assertion passed.
//
// Run: node scripts/gates.mjs lint|build|demo
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let arg = process.argv[2];

function run(cmd, args, token) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log(token);
}

if (arg === 'lint') {
  run('npx', ['eslint', '.', '--max-warnings=0'], 'GATE_LINT_OK');
} else if (arg === 'build') {
  run('npx', ['vite', 'build'], 'GATE_BUILD_OK');
} else if (arg === 'demo') {
  // Demo Mode is a tour of the real screens, asserted from source rather than
  // from a screenshot: the contract is which modules are wired to which.
  const page = fs.readFileSync(path.join(root, 'src/pages/DemoModePage.jsx'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
  const landing = fs.readFileSync(path.join(root, 'src/pages/LandingPage.jsx'), 'utf8');
  const fixtures = fs.readFileSync(path.join(root, 'src/lib/demoProfiles.js'), 'utf8');
  const navbar = fs.readFileSync(path.join(root, 'src/components/Navbar.jsx'), 'utf8');
  const demoMode = fs.readFileSync(path.join(root, 'src/lib/demoMode.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'api/index.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'src/lib/api.js'), 'utf8');

  const fail = m => { console.error('demo isolation failed: ' + m); process.exit(1); };

  // The tour must start demo mode and then hand off to the real screens.
  if (!/enterDemo\s*\(/.test(page)) fail('DemoModePage never enters demo mode');
  if (/apiFetch\s*\(|\buseAsync\s*\(/.test(page)) fail('DemoModePage talks to the authenticated API directly');
  if (!/demoResponse\s*\(path/.test(client)) fail('apiFetch does not route through the demo transport');
  // Demo answers must be produced before any token is read or attached. Match
  // the call site, not the `function getToken()` declaration.
  const intercept = client.indexOf('demoResponse(path');
  const token = client.indexOf('getToken();');
  if (intercept === -1 || token === -1 || intercept > token) fail('the demo transport runs after the auth token is read');
  // Real auth always ends the tour, so a signed-in person never sees canned rows.
  if (!/exitDemo\s*\(\)/.test(client)) fail('signing in does not end demo mode');
  // Starting the tour has to drop any stored session. Otherwise a signed-in
  // visitor keeps their real token and account id, and the screens the tour
  // renders read that identity as their own.
  if (!/localStorage\.removeItem\('authToken'\)/.test(demoMode)) fail('enterDemo does not drop the stored session');
  // The tour needs its own id: the chat and detail screens compare ids with
  // Number() and label the sender of a message, so null made both unreadable.
  if (!/DEMO_SELF_ID\s*=\s*\d+/.test(demoMode)) fail('the demo has no numeric self id');
  // Without the guard bypass the tour cannot reach the real screens at all.
  if (!/isDemo\s*\(\)/.test(app)) fail('PrivateRoute does not admit the demo tour');
  // Public route: no PrivateRoute wrapper, so a stored token cannot decide access.
  if (!/path="\/demo" element=\{<DemoModePage \/>}/.test(app)) fail('/demo is not a public route');
  // The samples endpoint must be reachable signed out, or demo inherits sign-in.
  if (!/app\.get\('\/api\/demo\/profiles',\s*async/.test(api)) fail('/api/demo/profiles still requires auth');
  // Both landing demo CTAs must reach demo mode, not the sign-in form.
  if ((landing.match(/to="\/demo"/g) || []).length < 2) fail('landing does not offer two demo entry points');
  if (/to="\/login"/.test(landing)) fail('landing still sends the demo visitor to /login');
  // Bundled fixtures are the offline fallback and must be self-evidently synthetic.
  const names = [...fixtures.matchAll(/name: '([^']+)'/g)].map(m => m[1]);
  if (names.length < 3) fail('fewer than three demo fixtures');
  if (!names.every(n => n.startsWith('Sample '))) fail('a demo name is not marked as a sample: ' + names.join(', '));
  // Demo mode must be marked on screen for the whole tour, not just on the hub.
  if (!/isDemo\s*\(\)/.test(fs.readFileSync(path.join(root, 'src/components/Layout.jsx'), 'utf8'))) {
    fail('Layout does not show the persistent demo marker');
  }
  if (!/sessionStorage/.test(demoMode)) fail('the demo flag is not session scoped');
    // Match a write of the flag key, not storage calls in general. The tour
    // also *removes* a stored auth session when it starts - that is how a
    // signed-in visitor's real identity stays off the demo screens - and
    // clearing auth is not storing the demo flag.
    if (/localStorage\s*\.\s*setItem\s*\(\s*(FLAG|['"]hey_nomads_demo)/.test(demoMode)
      || /localStorage\s*\.\s*getItem\s*\(\s*(FLAG|['"]hey_nomads_demo)/.test(demoMode)) {
      fail('demo mode stores its flag in localStorage');
    }
  // The signed-out visitor must not be shown signed-in-only chrome.
  if (!/auth\.isAuthenticated\(\)/.test(navbar)) fail('Navbar does not branch on authentication state');

  console.log('GATE_DEMO_OK');
} else {
  console.error('usage: node scripts/gates.mjs lint|build|demo');
  process.exit(2);
}
