// Visual + state audit for Matches, Chat, Agreements and Living DNA.
//
// Every screen is loaded against mocked API responses, so this needs Vite but
// never Neon. For each screen it captures the populated, empty and error states
// at 1440px and 390px, and logs which API paths each screen actually calls so
// the fixtures can be corrected rather than guessed.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const OUT = 'screenshots';

const ME = 900;
const other = id => ({
  id, name: 'Rich Person', age: 27, occupation: 'Product design', city: 'Lisbon',
  budget: 15000, bio: 'Six years of flat sharing, plant parent, runs most mornings.',
  profile_image: null, verification_status: 'verified', moving_to: 'Lisbon',
});

// The four screens under review, with the routes they hit. ChatPage's contract
// is known from source: /conversations/:id returns the message array and
// /roommates/:id returns the partner profile.
const SCREENS = [
  { name: 'matches', path: '/matches', populated: { '**/api/matches': [other(11)] } },
  { name: 'chat', path: '/messages/11', populated: {
      '**/api/conversations/11': [
        { id: 1, sender_id: other(11).id, content: 'Hey! Are you still looking for a flatmate in Lisbon?', created_at: '2026-10-12T09:00:00Z', read_at: null },
        { id: 2, sender_id: ME, content: 'I am. Prefer something quiet and near the river.', created_at: '2026-10-12T09:01:00Z', read_at: '2026-10-12T09:01:05Z' },
        { id: 3, sender_id: other(11).id, content: 'Same here. Want to swap details this week?', created_at: '2026-10-12T09:02:00Z', read_at: null },
      ],
      '**/api/roommates/11': other(11),
      '**/api/conversations/11/read': { ok: true },
    } },
  { name: 'agreements', path: '/agreements', populated: { '**/api/agreements': [
      { id: 1, status: 'pending', created_at: '2026-10-12T10:00:00Z', user_a_id: ME, user_b_id: 11,
        other_user: other(11), title: 'Flat share agreement', property: 'Rua da Prata, Lisbon' },
    ] } },
  { name: 'living-dna', path: '/living-dna', populated: {} },
];

const SHOTS = [];

const browser = await chromium.launch();

const load = async (screen, scenario) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const calls = [];
  const populated = screen.populated || {};

  await ctx.route('**/api/**', async route => {
    const url = route.request().url();
    const path = url.split('/api/')[1];
    calls.push(path);

    // auth/me must keep succeeding. A 500 there makes the app clear the
    // session and bounce to /login, which hid every other screen's error state
    // behind the login form and told me nothing about error handling.
    const isSessionProbe = path.startsWith('auth/me');
    if (scenario === 'error' && !isSessionProbe) {
      return route.fulfill({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ error: 'Something went wrong' }) });
    }
    if (isSessionProbe) {
      // restoreSession() reads `user.id` off the TOP level of this response.
      // Returning it nested under `user` stored the literal string "undefined"
      // as the user id, which made Number() return NaN and rendered every
      // message - including the viewer's own - as if it were someone else's.
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: ME, name: 'Tester' }) });
    }

    // 'empty' must actually be empty. Falling through to the populated fixture
    // made the empty screenshots identical to the populated ones.
    const hit = scenario === 'populated'
      ? Object.keys(populated).find(k => url.includes(k.slice('**/api/'.length)))
      : null;
    if (hit) return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(populated[hit]) });
    // Default: an empty list, which is the honest "nothing here yet" shape for
    // a GET that returns rows.
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await ctx.addInitScript(() => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('userId', '900');
    localStorage.setItem('userName', 'Tester');
  });

  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(e.message.slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)); });

  await page.goto(`${BASE}${screen.path}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  // A fixed settle is acceptable here: this is a screenshot audit, not an
  // assertion suite, and the assertions live in qa-discover-ui.mjs.
  await page.waitForTimeout(2500);

  for (const [w, h, tag] of [[1440, 1000, '1440'], [390, 844, '390']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    const file = `${OUT}/${screen.name}-${scenario}-${tag}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    SHOTS.push({ file, tag, overflow });
  }

  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 180);
  await ctx.close();
  return { calls: [...new Set(calls)], consoleErrors, text };
};

try {
  for (const screen of SCREENS) {
    for (const scenario of ['populated', 'empty', 'error']) {
      const r = await load(screen, scenario);
      console.log(`\n[${screen.name}/${scenario}]`);
      console.log(`  api: ${r.calls.join(', ') || '(none)'}`);
      console.log(`  text: ${r.text}`);
      if (r.consoleErrors.length) console.log(`  console errors: ${r.consoleErrors.join(' | ')}`);
      else console.log('  console errors: none');
    }
  }
  console.log('\n--- shots ---');
  SHOTS.forEach(s => console.log(`${s.file} overflow=${s.overflow}`));
  fs.writeFileSync('screenshots/.audit-summary.json', JSON.stringify(SHOTS, null, 2));
} finally {
  await browser.close();
}
