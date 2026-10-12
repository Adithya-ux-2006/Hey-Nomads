// Focused frontend regression checks for the Discover feed.
//
// These drive the real page with mocked API responses, so they need Vite but
// never Neon, a network, or a database. Each case pins one behaviour that was
// actually wrong at some point on this page:
//
//   1. Two eligible candidates render two cards.
//   2. A genuinely empty response renders the empty state.
//   3. A failed request renders an error state, not a false "you've seen
//      everyone".
//   4. The empty state does not flash while the first request is in flight.
//   5. The card shows plain-language reasons, capped, and never the raw
//      sub-score breakdown.
//
// Run:  node scripts/qa-discover-ui.mjs        (expects Vite on :5199)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const EMPTY_TITLE = 'No roommates to show you yet';
// This page used to render a second empty state outside the loading/error
// chain, so this text appeared mid-load and next to error states. It must never
// come back.
const STALE_TITLE = "You've seen everyone";
const CARD = 'a[href^="/roommates/"]';

const candidate = (id, name, score) => ({
  id, name, age: 27, occupation: 'Product design', city: 'Lisbon', budget: 15000,
  bio: 'Six years of flat sharing.', profile_image: null,
  score, breakdown: { lifestyle: 25, budget: 20, location: 0, movein: 7, interests: 0, habits: 8 },
  reasons: [
    { text: 'Same sleep schedule', type: 'positive' },
    { text: 'Similar cleanliness preference', type: 'positive' },
    { text: 'Both non-smokers', type: 'positive' },
    { text: 'Same drinking habits', type: 'positive' },
    { text: 'Similar social energy', type: 'positive' },
    { text: 'Both veg eaters', type: 'positive' },
  ],
});

let passed = 0;
const failures = [];
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.log(`  FAIL ${name}\n         ${e.message.split('\n')[0]}`); }
};

const browser = await chromium.launch();

/**
 * Mocks every API the page touches. `feed` decides what the recommendation
 * endpoint does: 'fulfil', 'fail', or 'hold' (pending until release()).
 */
const openPage = async (feed, body) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let release = null;
  // `waiting` resolves once the feed handler is actually parked, so the test
  // never calls release() before there is anything to release.
  let markWaiting;
  const waiting = new Promise(res => { markWaiting = res; });

  await ctx.route('**/api/auth/me', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ user: { id: 1, name: 'Tester' } }),
  }));
  await ctx.route('**/api/shortlist', r => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await ctx.route('**/api/roommates/recommended', async r => {
    if (feed === 'fail') return r.fulfill({
      status: 500, contentType: 'application/json',
      body: JSON.stringify({ error: 'Failed to get roommates' }),
    });
    if (feed === 'hold') {
      release = () => {};
      markWaiting();
      await new Promise(res => { release = res; });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  // Seeded before any document loads, so no route can clear it.
  await ctx.addInitScript(() => localStorage.setItem('authToken', 'test-token'));
  const page = await ctx.newPage();
  return { ctx, page, waiting, release: () => release && release() };
};

try {
  console.log('\nDISCOVER FRONTEND REGRESSION\n');

  await check('two eligible candidates render two cards', async () => {
    const { ctx, page } = await openPage('fulfil', [candidate(101, 'Rich Person', 60), candidate(102, 'Sparse Person', 55)]);
    try {
      await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
      await page.locator(CARD).first().waitFor({ state: 'attached', timeout: 15000 });
      assert.equal(await page.locator(CARD).count(), 2, 'expected two cards');
      assert.ok(await page.getByText('Rich Person').isVisible(), 'first name missing');
      assert.ok(await page.getByText('Sparse Person').isVisible(), 'second name missing');
      assert.equal(await page.getByText(EMPTY_TITLE).count(), 0, 'empty state shown despite candidates');
      assert.equal(await page.getByText(STALE_TITLE).count(), 0, 'stale empty state shown despite candidates');
    } finally { await ctx.close(); }
  });

  await check('a genuinely empty response renders the empty state', async () => {
    const { ctx, page } = await openPage('fulfil', []);
    try {
      await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
      await page.getByText(EMPTY_TITLE).waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await page.locator(CARD).count(), 0, 'cards rendered for an empty feed');
    } finally { await ctx.close(); }
  });

  await check('a failed request renders an error state, not a false empty feed', async () => {
    const { ctx, page } = await openPage('fail', null);
    try {
      await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
      const alert = page.getByRole('alert');
      await alert.waitFor({ state: 'visible', timeout: 15000 });
      assert.ok((await alert.innerText()).includes("couldn't load your matches"), 'wrong error copy');
      assert.equal(await page.getByText(STALE_TITLE).count(), 0, 'a failure was reported as an empty feed');
      assert.equal(await page.getByText(EMPTY_TITLE).count(), 0, 'both empty states rendered after a failure');
      assert.equal(await page.locator(CARD).count(), 0, 'cards rendered after a failure');
    } finally { await ctx.close(); }
  });

  await check('the empty state does not flash while the first request is pending', async () => {
    const { ctx, page, waiting, release } = await openPage('hold', [candidate(201, 'Late Person', 70)]);
    try {
      await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
      // The request is deliberately still in flight here. Asserting after a
      // sleep would only prove the sleep was long enough; asserting now proves
      // the empty state is not on screen while the answer is genuinely unknown.
      await waiting;
      assert.equal(await page.getByText(EMPTY_TITLE).count(), 0,
        'empty state rendered while the feed request was still pending');
      assert.equal(await page.getByText(STALE_TITLE).count(), 0,
        'the old out-of-chain empty state flashed during loading');
      assert.equal(await page.locator(CARD).count(), 0, 'cards rendered before any response');
      release();
      await page.locator(CARD).first().waitFor({ state: 'attached', timeout: 15000 });
      assert.equal(await page.locator(CARD).count(), 1, 'card did not appear after resolution');
    } finally { await ctx.close(); }
  });

  await check('the card shows capped reasons and never the raw sub-score breakdown', async () => {
    const { ctx, page } = await openPage('fulfil', [candidate(301, 'Reason Person', 60)]);
    try {
      await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
      await page.locator(CARD).first().waitFor({ state: 'attached', timeout: 15000 });
      const text = await page.locator('body').innerText();
      assert.ok(text.includes('Same sleep schedule'), 'a real reason is missing');
      assert.ok(text.includes('+2 more'), `expected a "+2 more" overflow marker, got:\n${text.slice(0, 300)}`);
      assert.equal(await page.getByText('Similar social energy').count(), 0, 'reasons were not capped');
      for (const leaked of ['Location:', 'Interests:', 'Lifestyle:', 'Budget:', 'Habits:']) {
        assert.ok(!text.includes(leaked), `raw breakdown "${leaked}" is still shown to users`);
      }
      assert.ok(text.includes('60%'), 'the overall compatibility score disappeared');
    } finally { await ctx.close(); }
  });
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
