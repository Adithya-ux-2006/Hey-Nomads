// L8 browser QA against the deployed application.
// Creates two throwaway accounts so no seeded demo or real data is touched,
// then drives the real UI for each gate scenario.
//
// Usage: node scripts/browser-qa.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://hey-nomads.vercel.app';
const stamp = Date.now();
const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const api = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const account = (n) => ({
  name: `QA${n} ${stamp}`,
  email: `qa.l8.${stamp}.${n}@heynomads.test`,
  password: 'QaL8Testing!2026',
});

const register = async (n) => {
  const a = account(n);
  const r = await api('/auth/register', { method: 'POST', body: { email: a.email, password: a.password, name: a.name } });
  if (r.status !== 201) throw new Error(`register ${n} failed: ${r.status}`);
  await api('/onboarding', {
    method: 'POST',
    token: r.body.token,
    body: { moving_to: 'Mumbai', budget: 25000, cleanliness: 4, looking_for: 'both' },
  });
  return { ...a, id: r.body.user.id, token: r.body.token };
};

const login = async (page, a) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', a.email);
  await page.fill('input[type="password"]', a.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
};

const browser = await chromium.launch();
const consoleErrors = [];
const failedRequests = [];

try {
  const A = await register('a');
  const B = await register('b');
  record('accounts provisioned', true, `A=${A.id} B=${B.id}`);

  // ── Test B first: a one-sided like must show the neutral state ──
  {
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 500) failedRequests.push(`${r.status()} ${r.url()}`); });
    await login(page, B);

    // B likes A, but A has not liked B: one-sided.
    await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
    // Exact aria-label: a prefix match once hit a real account whose name
    // started with the same letter.
    const likeA = page.locator(`button[aria-label="Like ${A.name}"]`);
    await likeA.waitFor({ state: 'visible', timeout: 25000 });
    await likeA.click();
    await page.waitForTimeout(2500);

    const banner = await page.locator('div[role="status"]').first();
    const text = (await banner.count()) ? (await banner.innerText()).replace(/\s+/g, ' ').trim() : '';
    const isMatch = /You matched/i.test(text);
    const isNeutral = /^Liked/i.test(text);

    record('B: one-sided like shows a neutral confirmation', isNeutral, text.slice(0, 90) || 'no banner');
    record('B: one-sided like does NOT claim a match', !isMatch, isMatch ? 'banner claimed a match' : 'no match claimed');
    const links = await banner.locator('a').count().catch(() => 0);
    record('B: no Message/Agreement links on a one-sided like', links === 0, `${links} link(s) found`);
    await page.close();
  }

  // ── Test A: A likes B, and B already liked A, so this is mutual ──
  {
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 500) failedRequests.push(`${r.status()} ${r.url()}`); });
    await login(page, A);

    await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
    const likeB = page.locator(`button[aria-label="Like ${B.name}"]`);
    await likeB.waitFor({ state: 'visible', timeout: 25000 });
    await likeB.click();
    await page.waitForTimeout(2500);

    const banner = page.locator('div[role="status"]').first();
    const text = (await banner.count()) ? (await banner.innerText()).replace(/\s+/g, ' ').trim() : '';
    record('A: mutual like shows the match banner', /You matched/i.test(text), text.slice(0, 90) || 'no banner');

    const msg = banner.locator('a', { hasText: 'Message' });
    const agr = banner.locator('a', { hasText: 'Agreement' });
    record('A: banner offers Message', await msg.count() === 1);
    record('A: banner offers Agreement', await agr.count() === 1);

    if (await msg.count()) {
      await msg.click();
      await page.waitForURL(/\/messages\//, { timeout: 15000 }).catch(() => {});
      record('A: Message link opens the chat', /\/messages\//.test(page.url()), page.url().replace(BASE, ''));
    }
    if (await agr.count()) {
      await agr.click();
      await page.waitForURL(/\/agreement\//, { timeout: 15000 }).catch(() => {});
      const editor = await page.locator('textarea').count();
      record('A: Agreement link opens the editor', /\/agreement\//.test(page.url()) && editor > 0, page.url().replace(BASE, ''));
    }

    // Test E: an agreement exists only once someone drafts one, so exercise
    // the real flow rather than expecting a match to invent a document.
    await page.goto(`${BASE}/agreement/${B.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('textarea', { timeout: 20000 });
    await page.click('button:has-text("Save Draft")');
    await page.waitForTimeout(2500);
    const saved = await page.locator('text=Draft saved').count();
    record('E: an agreement draft saves', saved > 0, saved > 0 ? 'draft saved' : 'no confirmation');

    await page.goto(`${BASE}/agreements`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const hasB = await page.getByText(B.name).count();
    record('E: /agreements lists the drafted partner', hasB > 0, `${hasB} row(s) for ${B.name}`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const survived = await page.locator('h1').innerText();
    record('E: /agreements survives a hard refresh', /Agreements/i.test(survived), survived.trim());

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    record('E: browser Back works', !/\/agreements/.test(page.url()), page.url().replace(BASE, ''));
    await page.close();
  }

  // ── Test C: a failed like must not claim success ──
  {
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await login(page, A);
    await page.goto(`${BASE}/roommates`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button[aria-label^="Like"]', { timeout: 25000 });

    const before = await page.locator('button[aria-label^="Like"]').count();
    // Only the three accounts exist, so force the failure by blocking the call.
    await page.route('**/api/swipe', r => r.abort('failed'));
    await page.click('button[aria-label^="Like"]');
    await page.waitForTimeout(2500);
    await page.unroute('**/api/swipe');

    const after = await page.locator('button[aria-label^="Like"]').count();
    record('C: failed like restores the card', after === before, `${before} -> ${after}`);

    const status = page.locator('div[role="status"]').first();
    const statusText = (await status.count()) ? (await status.innerText()).replace(/\s+/g, ' ').trim() : '';
    record('C: no false success is shown', !/You matched/i.test(statusText), statusText.slice(0, 80) || 'no success banner');
    await page.close();
  }

  // ── Test D: Demo Mode ──
  {
    const page = await browser.newPage();
    await login(page, A);
    // Attached after login on purpose: the sign-in POST is not a Demo Mode
    // interaction and would otherwise be counted as one.
    const writes = [];
    page.on('request', r => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method()) && r.url().includes('/api/')) {
        writes.push(`${r.method()} ${r.url().replace(BASE, '')}`);
      }
    });
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await page.goto(`${BASE}/demo`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const bannerText = await page.locator('text=Demo Mode').count();
    record('D: Demo Mode explains itself', bannerText > 0);

    const demoBadges = await page.locator('text=Demo').count();
    record('D: demo profiles are labelled', demoBadges > 1, `${demoBadges - 1} badge(s)`);

    const likeBtn = page.locator('button[aria-label^="Like sample profile"]').first();
    if (await likeBtn.count()) {
      await likeBtn.click();
      await page.waitForTimeout(1200);
      const matched = await page.locator('text=Simulated matches').count();
      record('D: a demo like produces a simulated match', matched > 0);
    } else {
      record('D: a demo like produces a simulated match', false, 'no demo like button rendered');
    }
    const sendBtn = page.locator('button:has-text("Send")');
    if (await sendBtn.count()) {
      await page.fill('input[aria-label="Simulated chat message"]', 'hello from QA');
      await sendBtn.click();
      await page.waitForTimeout(800);
      const echoed = await page.locator('text=hello from QA').count();
      record('D: simulated chat echoes locally', echoed > 0);
    }
    record('D: demo mode issues no API writes', writes.length === 0, writes.join(', ') || 'zero write requests');
    await page.close();
  }

  // net::ERR_FAILED is expected here: test C aborts /api/swipe on purpose.
// Real server-side failures are covered by the 5xx assertion below.
const unexpectedConsole = consoleErrors.filter(e => !/net::ERR_FAILED/.test(e));
record('console: no unexpected application errors', unexpectedConsole.length === 0,
  unexpectedConsole.slice(0, 3).join(' | ') || 'clean');
  record('network: no 5xx responses', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | ') || 'clean');
} catch (err) {
  record('harness completed without throwing', false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
for (const f of failed) console.log(`  FAILED: ${f.name} — ${f.detail}`);
// Success-only marker, emitted only when every check above passed, so a gate
// can match on it without hardcoding the check count.
if (!failed.length) console.log('browser qa passed');
process.exit(failed.length ? 1 : 0);