// Focused checks for the Chat composer layout and the Matches empty-state
// navigation.
//
// Both regressions came out of visual inspection, so both are pinned here with
// mocked responses. No Neon, no network, no new framework.
//
// Run:  node scripts/qa-chat-matches-ui.mjs      (expects Vite on :5199)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const ME = 900;
const OTHER = 11;

let passed = 0;
const failures = [];
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.log(`  FAIL ${name}\n         ${e.message.split('\n')[0]}`); }
};

const browser = await chromium.launch();

const open = async (width, height, api) => {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.route('**/api/**', route => {
    const path = route.request().url().split('/api/')[1];
    if (path.startsWith('auth/me')) {
      // Top level, not nested: restoreSession reads user.id directly, and a
      // nested shape silently breaks message alignment.
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: ME, name: 'Tester' }) });
    }
    const body = api[path];
    return route.fulfill({
      status: body === undefined ? 404 : 200,
      contentType: 'application/json',
      body: JSON.stringify(body === undefined ? { error: 'not mocked' } : body),
    });
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('userId', String(900));
    localStorage.setItem('userName', 'Tester');
  });
  const page = await ctx.newPage();
  return { ctx, page };
};

const CHAT_API = {
  [`conversations/${OTHER}`]: [
    { id: 1, sender_id: OTHER, content: 'Hey, still looking?', created_at: '2026-10-12T09:00:00Z' },
    { id: 2, sender_id: ME, content: 'I am.', created_at: '2026-10-12T09:01:00Z' },
  ],
  [`roommates/${OTHER}`]: { id: OTHER, name: 'Rich Person', profile_image: null },
  [`conversations/${OTHER}/read`]: { ok: true },
  messages: { ok: true },
};

try {
  console.log('\nCHAT LAYOUT AND MATCHES NAVIGATION\n');

  for (const [label, width, height] of [['mobile', 390, 844], ['desktop', 1440, 1000]]) {
    await check(`chat composer clears the fixed nav at ${label} (${width}px)`, async () => {
      const { ctx, page } = await open(width, height, CHAT_API);
      try {
        await page.goto(`${BASE}/messages/${OTHER}`, { waitUntil: 'domcontentloaded' });
        const input = page.getByPlaceholder('Type a message...');
        await input.waitFor({ state: 'visible', timeout: 15000 });

        const send = page.getByRole('button', { name: 'Send message' });
        assert.ok(await send.isVisible(), 'send button is not visible');

        // The nav is the last <nav> in the page; the composer must finish above it.
        const composerBox = await input.boundingBox();
        const navBox = await page.locator('nav').last().boundingBox();
        assert.ok(composerBox && navBox, 'could not measure composer or nav');
        assert.ok(composerBox.y + composerBox.height <= navBox.y + 1,
          `composer bottom (${Math.round(composerBox.y + composerBox.height)}) overlaps nav top (${Math.round(navBox.y)})`);

        const sendBox = await send.boundingBox();
        assert.ok(sendBox.y + sendBox.height <= navBox.y + 1,
          'send button overlaps the navigation');

        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth);
        assert.equal(overflow, false, 'horizontal overflow introduced');
      } finally { await ctx.close(); }
    });
  }

  await check('the send button accepts a message', async () => {
    const { ctx, page } = await open(390, 844, CHAT_API);
    try {
      await page.goto(`${BASE}/messages/${OTHER}`, { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('Type a message...').fill('Sound good.');
      await page.getByRole('button', { name: 'Send message' }).click();
      await page.getByText('Sound good.').waitFor({ state: 'visible', timeout: 15000 });
    } finally { await ctx.close(); }
  });

  await check('Matches empty state navigates to the roommates feed', async () => {
    const { ctx, page } = await open(1440, 1000, { matches: [] });
    try {
      await page.goto(`${BASE}/matches`, { waitUntil: 'domcontentloaded' });
      const cta = page.getByRole('link', { name: 'Find roommates' });
      await cta.waitFor({ state: 'visible', timeout: 15000 });
      await cta.click();
      await page.waitForURL(/\/roommates$/, { timeout: 15000 });
      assert.ok(/\/roommates$/.test(page.url()), `landed on ${page.url()}`);
      // The destination must actually be the feed, not a redirect home.
      assert.ok(await page.locator('a[href^="/roommates/"]').count() > 0
        || await page.getByText('No matches in your filters').count() > 0
        || await page.getByRole('heading', { name: /Recommended Roommates/i }).count() > 0,
        'roommates route did not render the Discover feed');
    } finally { await ctx.close(); }
  });

  await check('populated match card renders its partner and actions', async () => {
    const { ctx, page } = await open(390, 844, {
      matches: [{ id: 5, partner_id: OTHER, partner_name: 'Rich Person', partner_image: null,
        compatibility: 60, match_type: 'mutual', created_at: '2026-10-12T10:00:00Z' }],
    });
    try {
      await page.goto(`${BASE}/matches`, { waitUntil: 'domcontentloaded' });
      await page.getByText('Rich Person').first().waitFor({ state: 'visible', timeout: 15000 });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(overflow, false, 'populated matches overflow at 390px');
    } finally { await ctx.close(); }
  });
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
