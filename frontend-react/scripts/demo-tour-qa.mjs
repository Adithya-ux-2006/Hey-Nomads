// End-to-end check for Demo Mode: a signed-out visitor opens the hub, walks
// the real Feed / Matches / Messages screens on canned data, and the private
// routes are guarded again once the tour is left.
//
// This one deliberately needs no database - the tour falls back to the bundled
// samples when the API is unreachable - which is why it is the only browser
// gate that can run while the test database is offline.
//
// Usage: node scripts/demo-tour-qa.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const PORT = Number(process.env.TOUR_PORT || 5199);
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
const record = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};

const inUse = () => new Promise(res => {
  const s = createServer();
  s.once('error', () => res(true));
  s.once('listening', () => s.close(() => res(false)));
  s.listen(PORT);
});

const wait = ms => new Promise(r => setTimeout(r, ms));

async function startVite() {
  if (await inUse()) throw new Error(`port ${PORT} is already in use`);
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/demo`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return child;
    } catch { /* not up yet */ }
    await wait(1000);
  }
  throw new Error('vite did not start');
}

function stopVite(child) {
  try { process.kill(-child.pid); } catch { try { child.kill(); } catch { /* already gone */ } }
}

const vite = await startVite();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR ' + e.message));

// Every /api/ path the tour is allowed to put on the wire. The canned
// transport answers everything else before it becomes a request, so any other
// path here means a screen fell through to the real API - where it would meet
// a 401, or worse, carry a stored token with it.
const ALLOWED_API = new Set(['/api/demo/profiles']);
const seenApi = new Set();
const authedRequests = new Set();
page.on('request', r => {
  const u = new URL(r.url());
  if (u.pathname.startsWith('/api/')) {
    seenApi.add(u.pathname);
    console.log('API ' + u.pathname);
    if (r.headers()['authorization']) authedRequests.add(u.pathname);
  }
});
const unexpected = () => [...seenApi].filter(p => !ALLOWED_API.has(p));

try {
  await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });
  record('demo hub renders signed out', await page.getByText('Take the tour').isVisible());
  const steps = await page.getByRole('listitem').count();
  record('hub offers three tour steps', steps === 3, `${steps} steps`);

  await page.getByRole('button', { name: 'Start demo at Feed' }).click();
  await page.waitForURL('**/roommates', { timeout: 15000 });
  record('step 1 opens the real feed route', page.url().endsWith('/roommates'));

  await page.getByText('Demo Mode — simulated data, nothing is saved').waitFor({ timeout: 15000 });
  record('demo marker persists on the real screen', true);
  record('an exit control is always available', await page.getByRole('button', { name: 'Exit demo' }).isVisible());

  await page.waitForSelector('[aria-label^="Like "]', { timeout: 15000 });
  const cards = await page.locator('[aria-label^="Like "]').count();
  record('feed renders likeable cards from demo data', cards > 0, `${cards} cards`);

  const chips = await page.locator('.rounded-full.text-xs.font-semibold').allInnerTexts();
  record('match reasons render as readable text', chips.some(t => t.trim().length > 0), chips[0] || 'none');

  record('the demo does not advertise itself inside the demo',
    (await page.getByRole('link', { name: 'Try Demo Mode' }).count()) === 0);

  // The card itself links into the detail screen. The tour has to answer that
  // screen locally too, or the visitor silently falls out of the demo and the
  // detail page fires a real request with no session behind it.
  await page.locator('a[href^="/roommates/"]').first().click();
  await wait(3000);
  record('tapping a feed card stays inside the tour',
    !page.url().includes('/login'), page.url());
  record('the detail screen did not fall through to the real API',
    unexpected().length === 0, unexpected().join(', '));

  await page.goto(`${BASE}/roommates`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[aria-label^="Like "]', { timeout: 15000 });

  await page.locator('[aria-label^="Like "]').first().click();
  await page.getByText(/You matched with/).waitFor({ timeout: 15000 });
  record('liking produces the match payoff', true);

  await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Start demo at Matches' }).click();
  await page.waitForURL('**/matches', { timeout: 15000 });
  await page.waitForSelector('[aria-label^="Message "]', { timeout: 15000 });
  record('step 2 opens matches listing partners',
    (await page.locator('[aria-label^="Message "]').count()) > 0);

  // Opening the conversation is the other fall-through: the chat screen asks
  // for a thread by id, which the canned transport does not cover.
  await page.locator('a[aria-label^="Message "]').first().click();
  await wait(3000);
  record('opening a conversation stays inside the tour',
    !page.url().includes('/login'), page.url());
  record('the chat screen did not fall through to the real API',
    unexpected().length === 0, unexpected().join(', '));

  // The thread has to render from canned data, take a message, and still be
  // showing it after the chat's own three-second poll refreshes the thread.
  const composer = page.locator('input[aria-label="Message"]');
  await composer.waitFor({ timeout: 15000 });
  const SENT = 'Is the place still available?';
  await composer.fill(SENT);
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.getByText(SENT).first().waitFor({ timeout: 15000 });
  await wait(4000);
  record('a message sent in the tour survives polling',
    (await page.getByText(SENT).count()) > 0);
  record('the sent message renders on the visitor\'s own side',
    (await page.locator('div.justify-end').filter({ hasText: SENT }).count()) > 0);

  await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Start demo at Messages' }).click();
  await page.waitForURL('**/messages', { timeout: 15000 });
  record('step 3 opens messages', page.url().endsWith('/messages'));

  await page.getByRole('button', { name: 'Exit demo' }).click();
  await page.waitForURL(BASE + '/', { timeout: 15000 });
  await page.goto(`${BASE}/roommates`, { waitUntil: 'networkidle' });
  record('the feed is guarded again after leaving the tour', page.url().includes('/login'), page.url());

  // The single invariant behind the whole tour: every request the visitor's
  // browser made to the API was one the canned transport owns.
  record('no screen ever called the real API during the tour',
    unexpected().length === 0, unexpected().join(', '));

  // Identity leak: sign-in state must not survive into the tour. The canary is
  // seeded after the app has booted, so the only thing that can clear it is
  // starting the tour - if it is still there, a screen would read a real
  // account's id and name and render a real person's profile.
  await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('authToken', 'leak-canary-token');
    localStorage.setItem('userId', '4242');
    localStorage.setItem('userName', 'Leak Canary');
  });

  authedRequests.clear();
  await page.getByRole('button', { name: 'Start demo at Feed' }).click();
  await page.waitForURL('**/roommates', { timeout: 15000 });
  await page.locator('a[href^="/roommates/"]').first().click();
  await wait(3000);

  record('the tour never sends the stored credentials', authedRequests.size === 0,
    [...authedRequests].join(', '));
  const stored = await page.evaluate(() => ({
    token: localStorage.getItem('authToken'),
    userId: localStorage.getItem('userId'),
    userName: localStorage.getItem('userName'),
  }));
  record('starting the tour drops the real session',
    stored.token === null && stored.userId === null && stored.userName === null,
    JSON.stringify(stored));
  record('the tour does not bounce the visitor to sign-in',
    !page.url().includes('/login'), page.url());
} catch (e) {
  record('tour ran without throwing', false, e.message);
} finally {
  await browser.close();
  stopVite(vite);
}

const failed = results.filter(r => !r).length;
if (failed) {
  console.error(`demo tour qa: ${failed} failed`);
  process.exit(1);
}
console.log(`demo tour qa passed - all ${results.length} checks`);
