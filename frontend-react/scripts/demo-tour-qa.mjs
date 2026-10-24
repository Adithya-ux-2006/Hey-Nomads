// End-to-end check for Demo Mode: a signed-out visitor opens /demo and is
// inside the walkthrough immediately - real Feed / Likes / Matches / Messages
// screens on client-side synthetic data - and the private routes are guarded
// again once the exit control is used.
//
// This one deliberately needs no database. The demo transport answers every
// screen locally, and since the legacy server demo endpoints were removed the
// demo makes ZERO /api calls - the strongest invariant this suite asserts.
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
  s.once('listening', () => res(false));
  s.listen(PORT);
});

const wait = ms => new Promise(r => setTimeout(r, ms));

async function startVite() {
  if (await inUse()) throw new Error(`port ${PORT} is already in use`);
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
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

// Since the rebuild the demo is fully client-side: any /api/ path on the wire
// means a screen fell through to the real API - a 401 there, or worse, a call
// carrying a stored token. There is no allowed list any more: zero is the rule.
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
const apiCalls = () => [...seenApi].join(', ');

try {
  // 1. Opening /demo IS entering the walkthrough: no launcher, no extra click.
  await page.goto(`${BASE}/demo`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/roommates', { timeout: 15000 });
  record('opening /demo enters the walkthrough directly',
    page.url().endsWith('/roommates'), page.url());

  await page.getByText('Demo Mode — simulated data, saved in this tab only').waitFor({ timeout: 15000 });
  record('demo marker persists on the real screen', true);
  record('an exit control is always available', await page.getByRole('button', { name: 'Exit demo' }).isVisible());

  await page.waitForSelector('[aria-label^="Like "]', { timeout: 15000 });
  const cards = await page.locator('[aria-label^="Like "]').count();
  record('feed renders likeable cards from demo data', cards > 0, `${cards} cards`);

  const chips = await page.locator('.rounded-full').allInnerTexts();
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
    seenApi.size === 0, apiCalls());

  // 2. The Likes screen is part of the tour: seeded incoming likes accept into
  // a match and dismiss stays dismissed, all through the demo transport.
  await page.goto(`${BASE}/likes`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: /received/i }).click();
  await page.getByRole('button', { name: /Accept like from Sample/ }).first().waitFor({ timeout: 15000 });
  const receivedBefore = Number((await page.getByRole('tab', { name: /received/i }).innerText()).replace(/\D/g, ''));
  await page.getByRole('button', { name: /Accept like from Sample/ }).first().click();
  for (let i = 0; i < 40; i++) {
    const t = Number((await page.getByRole('tab', { name: /received/i }).innerText()).replace(/\D/g, ''));
    if (t === receivedBefore - 1) break;
    await wait(100);
  }
  const receivedAfter = Number((await page.getByRole('tab', { name: /received/i }).innerText()).replace(/\D/g, ''));
  record('accepting an incoming like moves the count', receivedAfter === receivedBefore - 1,
    `${receivedBefore} -> ${receivedAfter}`);

  // 3. Matches listing from demo state.
  await page.goto(`${BASE}/matches`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[aria-label^="Message "]', { timeout: 15000 });
  record('matches listing partners from demo state',
    (await page.locator('[aria-label^="Message "]').count()) > 0);

  // Opening the conversation is the other fall-through: the chat screen asks
  // for a thread by id, which the canned transport does not cover.
  await page.locator('a[aria-label^="Message "]').first().click();
  await wait(3000);
  record('opening a conversation stays inside the tour',
    !page.url().includes('/login'), page.url());
  record('the chat screen did not fall through to the real API',
    seenApi.size === 0, apiCalls());

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

  // 4. The old demo surface is gone: /presentation has no route any more.
  await page.goto(`${BASE}/presentation`, { waitUntil: 'domcontentloaded' });
  record('the legacy /presentation route no longer exists',
    await page.getByText('Find a flatmate you can actually live with.').isVisible()
    || page.url().endsWith('/'), page.url());
  record('the legacy walkthrough intro does not render',
    (await page.getByText('Product walkthrough').count()) === 0);

  // 5. Leaving the tour guards the private routes again.
  await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Exit demo' }).click();
  await page.waitForURL(BASE + '/', { timeout: 15000 });
  await page.goto(`${BASE}/roommates`, { waitUntil: 'networkidle' });
  record('the feed is guarded again after leaving the tour', page.url().includes('/login'), page.url());

  // 6. Identity leak: sign-in state must not survive into the tour. The canary
  // is seeded after the app has booted, so the only thing that can clear it is
  // entering the tour - if it is still there, a screen would read a real
  // account's id and name and render a real person's profile.
  await page.goto(`${BASE}/demo`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/roommates', { timeout: 15000 });
  record('re-entering /demo after exit restarts the tour',
    page.url().endsWith('/roommates'), page.url());

  await page.evaluate(() => {
    localStorage.setItem('authToken', 'leak-canary-token');
    localStorage.setItem('userId', '4242');
    localStorage.setItem('userName', 'Leak Canary');
  });

  authedRequests.clear();
  await page.goto(`${BASE}/likes`, { waitUntil: 'domcontentloaded' });
  await wait(2000);

  record('the tour never sends the stored credentials', authedRequests.size === 0,
    [...authedRequests].join(', '));
  const stored = await page.evaluate(() => ({
    token: localStorage.getItem('authToken'),
    userId: localStorage.getItem('userId'),
    userName: localStorage.getItem('userName'),
  }));
  record('entering the tour drops the real session',
    stored.token === null && stored.userId === null && stored.userName === null,
    JSON.stringify(stored));
  record('the tour does not bounce the visitor to sign-in',
    !page.url().includes('/login'), page.url());

  // The single invariant behind the whole tour: every request the visitor's
  // browser made to the API was zero - the demo answers everything locally.
  record('no screen ever called the real API during the tour',
    seenApi.size === 0, apiCalls());
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
