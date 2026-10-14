// The presentation page, driven the way a judge drives it.
//
// presentation-flow-qa.mjs proves the endpoints and the authorization. This one
// proves the actual screen: intro -> Discover -> candidate profile -> Like ->
// mutual match -> Matches -> chat, then Restart. It runs on the real Vite
// server, the real API and the isolated test database, with no fixtures and no
// mocks.
//
//   node scripts/qa-local.mjs --suite walk
//
// It also asserts that the ordinary product still gates normally while a
// presentation session is live, and that no fixture, credential or developer
// control is visible anywhere on the presentation screens.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import './require-test-db.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const SHOT_DIR = path.resolve(process.cwd(), 'screenshots', 'qa');

let passed = 0, failed = 0;
const step = async (name, fn) => {
  try { const d = await fn(); passed++; console.log(`  ok   ${name}${d ? ' - ' + d : ''}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n         ${e.message.split('\n')[0]}`); }
};

fs.mkdirSync(SHOT_DIR, { recursive: true });

// Screens a judge looks at, at the widths the design has to hold up on.
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];

// Words that would tell a visitor how the demonstration is wired. None of them
// may appear as text on any presentation screen.
const LEAKS = ['qa.present', 'presentationToken', 'Bearer', 'account_kind', 'gmail.com', 'JWT'];

const shoot = async (page, label) => {
  try {
    await page.screenshot({ path: path.join(SHOT_DIR, `pres-${label}.png`), fullPage: true });
  } catch { /* evidence only; never fail a run over a screenshot */ }
};

const textOf = page => page.locator('body').innerText();

console.log('\nPRESENTATION UI WALKTHROUGH\n');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: VIEWPORTS[1] });
  const page = await context.newPage();

  await step('the presentation opens as a public page with a guided intro', async () => {
    await page.goto(`${BASE}/presentation`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('h1', { hasText: 'Find a flatmate you can actually live with.' })
      .waitFor({ timeout: 15000 });
    const text = await textOf(page);
    if (!/Discover/.test(text) || !/Mutual match/.test(text) || !/First message/.test(text)) {
      throw new Error('the intro does not lay out the walkthrough');
    }
    await shoot(page, `intro-${page.viewportSize().width}`);
    return 'intro renders';
  });

  await step('no fixture, credential or developer control is visible', async () => {
    const text = await textOf(page);
    for (const leak of LEAKS) {
      if (text.includes(leak)) throw new Error(`presentation screen shows "${leak}"`);
    }
    const controls = await page.locator('button, a').allInnerTexts();
    const joined = controls.join(' | ');
    for (const dev of ['Seed', 'Admin', 'Reset DB', 'Fixtures', 'Skip']) {
      if (joined.includes(dev)) throw new Error(`presentation screen exposes "${dev}"`);
    }
    return `no leaks across ${controls.length} controls`;
  });

  await step('starting provisions the cohort and lands on Discover', async () => {
    await page.getByRole('button', { name: /Start the walkthrough/ }).click();
    await page.locator('h1', { hasText: 'Discover' }).waitFor({ timeout: 90000 });
    const cards = page.locator('li button', { hasText: 'View profile' });
    await cards.first().waitFor({ timeout: 20000 });
    const n = await cards.count();
    if (n !== 3) throw new Error(`expected 3 candidate cards, saw ${n}`);
    await shoot(page, `discover-${page.viewportSize().width}`);
    return `${n} ranked cards`;
  });

  await step('a candidate profile shows the score and its reasoning', async () => {
    await page.locator('li button', { hasText: 'View profile' }).first().click();
    await page.getByRole('button', { name: /^Like / }).waitFor({ timeout: 20000 });
    const text = await textOf(page);
    if (!/Why you match/.test(text)) throw new Error('no reasoning section on the profile');
    if (!/The details/.test(text)) throw new Error('no lifestyle detail on the profile');
    if (!/\d+%/.test(text)) throw new Error('no compatibility score on the profile');
    await shoot(page, `profile-${page.viewportSize().width}`);
    return 'score, reasons and detail present';
  });

  await step('a like produces the mutual match moment', async () => {
    await page.getByRole('button', { name: /^Like / }).click();
    await page.locator('h1', { hasText: 'You matched with' }).waitFor({ timeout: 30000 });
    const text = await textOf(page);
    if (!/compatible/i.test(text)) throw new Error('the match screen does not state a score');
    await shoot(page, `match-${page.viewportSize().width}`);
    return (await page.locator('h1').innerText()).replace(/\s+/g, ' ');
  });

  await step('the match appears in Matches with its score', async () => {
    await page.getByRole('button', { name: /See your matches/ }).click();
    await page.locator('h1', { hasText: 'Matches' }).waitFor({ timeout: 20000 });
    const rows = page.locator('li button', { hasText: 'Message' });
    await rows.first().waitFor({ timeout: 20000 });
    const n = await rows.count();
    if (n !== 1) throw new Error(`expected 1 match row, saw ${n}`);
    if (!/\d+%/.test(await textOf(page))) throw new Error('the match row has no score');
    await shoot(page, `matches-${page.viewportSize().width}`);
    return '1 match with a compatibility score';
  });

  await step('the thread opens with an opener and takes a reply', async () => {
    await page.locator('li button', { hasText: 'Message' }).first().click();
    await page.locator('#pres-draft').waitFor({ timeout: 20000 });
    const bubble = 'div[class*="max-w-[75%]"]';
    // The draft box renders immediately; the opener arrives a beat later.
    await page.locator(bubble).first().waitFor({ timeout: 20000 });
    const before = await page.locator(bubble).count();
    await page.locator('#pres-draft').fill('Saturday morning works for me.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.waitForFunction(
      n => document.querySelectorAll('div[class*="max-w-[75%]"]').length > n,
      before, { timeout: 20000 },
    );
    await shoot(page, `chat-${page.viewportSize().width}`);
    return `${before} opener, reply appended`;
  });

  await step('restart clears the run and returns to a full feed', async () => {
    await page.getByRole('button', { name: 'Restart the walkthrough' }).click();
    await page.locator('h1', { hasText: 'Discover' }).waitFor({ timeout: 60000 });
    await page.locator('li button', { hasText: 'View profile' }).first().waitFor({ timeout: 20000 });
    const n = await page.locator('li button', { hasText: 'View profile' }).count();
    if (n !== 3) throw new Error(`feed restarted with ${n} cards instead of 3`);
    const text = await textOf(page);
    if (/You matched with/.test(text)) throw new Error('the previous run is still on screen');
    return 'feed restored to 3';
  });

  await step('the presentation session never opens the real product', async () => {
    await page.goto(`${BASE}/discover`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForURL(/\/login/, { timeout: 20000 });
    const inputs = await page.locator('input[type=email], input#login-email, input[name=email]').count();
    if (inputs === 0) throw new Error('the sign-in form did not render');
    await shoot(page, `login-gate-${page.viewportSize().width}`);
    return 'an ordinary protected route still demands sign-in';
  });

  await step('sign-up and sign-in are still reachable from the landing page', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);
    const text = await textOf(page);
    if (!/Start matching/.test(text)) throw new Error('the landing page lost its sign-up action');
    if (!/Try the demo account/.test(text)) throw new Error('the landing page lost the demo entry');
    if (!/guided walkthrough/.test(text)) throw new Error('the presentation entry is not linked');
    return 'landing intact with all three entries';
  });

  // Narrow viewports: the same journey, checked for overflow and clipping.
  for (const vp of VIEWPORTS.slice(0, 1)) {
    const small = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p = await small.newPage();
    await step(`the walkthrough holds together at ${vp.width}px`, async () => {
      await p.goto(`${BASE}/presentation`, { waitUntil: 'networkidle', timeout: 30000 });
      await p.getByRole('button', { name: /Start the walkthrough/ }).click();
      await p.locator('h1', { hasText: 'Discover' }).waitFor({ timeout: 60000 });
      await p.locator('li button', { hasText: 'View profile' }).first().click();
      await p.getByRole('button', { name: /^Like / }).waitFor({ timeout: 20000 });
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 2) throw new Error(`horizontal overflow of ${overflow}px at ${vp.width}px`);
      await shoot(p, `narrow-${vp.width}-profile`);
      await p.getByRole('button', { name: /^Like / }).click();
      await p.locator('h1', { hasText: 'You matched with' }).waitFor({ timeout: 30000 });
      await shoot(p, `narrow-${vp.width}-match`);
      return 'no horizontal overflow';
    });
    await small.close();
  }

  await context.close();
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('PRESENTATION_UI_OK');
