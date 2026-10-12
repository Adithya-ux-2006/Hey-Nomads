// Visual capture for the redesigned Discover screen. Database-independent where
// possible: it registers run-scoped accounts so the feed has real cards, and
// removes them in a finally block.
import { chromium } from 'playwright';
import pg from 'pg';

const BASE = process.argv[2] || 'http://127.0.0.1:5199';
const STAMP = Date.now();
const PREFIX = `shot${STAMP}`;
const emails = [];

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  // Log every API status so an empty feed is distinguishable from an auth
  // failure, a server error and a network timeout.
  const apiLog = [];
  page.on('response', r => { if (r.url().includes('/api/')) apiLog.push(`${r.status()} ${r.url().split('/api/')[1]}`); });
  page.on('pageerror', e => apiLog.push('PAGEERROR ' + e.message.slice(0, 80)));

  // Plain fetch, not page.request: Playwright's request context resolved this
  // call but the row never landed, so the feed had nothing to render.
  const reg = async (tag, extra = {}) => {
    const email = `${PREFIX}.${tag}.${Date.now()}@gmail.com`;
    emails.push(email);
    const r = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Verify12345!', name: `${tag} Person`, ...extra }),
    });
    const j = await r.json();
    if (!j.token) throw new Error(`register ${tag}: status ${r.status} ${JSON.stringify(j).slice(0, 120)}`);
    return j;
  };

  const peers = [];
  for (const tag of ['Rich', 'Sparse']) peers.push(await reg(tag));

  // The recommendation feed only surfaces onboarded profiles, so a bare
  // registration produces an empty Discover screen and the capture proves
  // nothing. Complete onboarding for each peer through the real endpoint.
  for (const p of peers) {
    for (const [path, body] of [
      ['/api/onboarding', { moving_to: 'Lisbon', budget: 980, cleanliness: 4, sleep_time: 'early', quiet_hours: true, smoking: false, pets: false, work_style: 'hybrid' }],
      ['/api/profile', { bio: 'Six years of flat sharing, plant parent, runs most mornings.', occupation: 'Product design', city: 'Lisbon' }],
    ]) {
      const r = await fetch(`${BASE}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) console.log('  onboarding', path, r.status);
    }
  }
  const me = await reg('Me');

  // Give the rich peer a profile so the card is not all fallback initials.
  const pgmod = (await import('pg')).default;
  const db = new pgmod.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.end();

  // Seed the token before ANY document loads. Navigating to /login first and
  // setting localStorage afterwards looks equivalent and is not: the login
  // screen mounts, resets auth state, and the later /roommates load renders
  // with no token. That is why Discover came back empty while the API itself
  // was returning candidates correctly.
  await ctx.addInitScript(t => localStorage.setItem('authToken', t), me.token);

  for (const [w, h, tag] of [[1440, 1100, '1440'], [390, 844, '390']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const cards = await page.locator('a[href^="/roommates/"]').count();
    console.log('  api:', apiLog.join(' | ') || '(no api calls)');
    console.log('  body:', (await page.locator('body').innerText()).slice(0, 160).replace(/\n+/g, ' | '));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    console.log(`${tag}: cards=${cards} overflow=${overflow}`);
    await page.screenshot({ path: `screenshots/redesign-discover-${tag}.png`, fullPage: true });
  }

  // Focus indicator on a primary action, captured deliberately.
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await page.screenshot({ path: 'screenshots/redesign-login-focus.png' });
  console.log('focus shot captured');

  await ctx.close();
} catch (e) {
  console.log('ERR:', String(e.message).slice(0, 200));
} finally {
  await browser.close();
  try {
    const pgmod = (await import('pg')).default;
    const db = new pgmod.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    // This script previously deleted with `email = ANY($1::text[])` and a plain
    // array, which matched nothing and leaked 15 accounts classified real. It
    // now uses the same precise pattern every other teardown here relies on,
    // and reports a count that can be checked.
    const n = await db.query("DELETE FROM users WHERE split_part(email,'@',1) ~ $1 RETURNING id", [`^shot${STAMP}\\.`]);
    await db.end();
    console.log('cleanup removed', n.rows.length);
  } catch (e) { console.error('cleanup failed', e.message); }
}
