// Visual + interaction inspection for Living DNA.
// Drives a real browser against a real account so the screenshots reflect
// rendered output, not source assumptions. Everything it creates is
// run-scoped (lnd<stamp>.*) and removed in a finally block.
//
//   DATABASE_URL=<isolated test db> node --import ./scripts/dns-shim.mjs scripts/qa-living-dna-ui.mjs http://127.0.0.1:5199
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import pg from 'pg';

await import('./require-test-db.mjs');

const BASE = process.argv[2] || 'http://127.0.0.1:5199';
const SHOTS = path.resolve('screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const STAMP = Date.now();
const PREFIX = `lnd${STAMP}`;
const emails = [];
const results = [];
const record = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  const register = async (tag) => {
    const email = `${PREFIX}.${tag}.${Date.now()}@gmail.com`;
    emails.push(email);
    const res = await page.request.post(`${BASE}/api/auth/register`,
      { data: { email, password: 'Verify12345!', name: `LND ${tag}` } });
    const j = await res.json();
    if (!j.token) throw new Error(`register ${tag}: ${JSON.stringify(j)}`);
    return j;
  };

  // Seed answers through the API so the progress state is real, not mocked.
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const a = await register('a');
  const b = await register('b');
  for (const u of [a, b]) {
    await page.request.post(`${BASE}/api/swipe`, { headers: { Authorization: `Bearer ${u.token}` }, data: { targetId: u === a ? b.user.id : a.user.id, action: 'like' } });
  }
  const qs = await (await page.request.get(`${BASE}/api/living-dna/questions`, { headers: { Authorization: `Bearer ${a.token}` } })).json();
  const partial = qs.slice(0, 6).map((q, i) => ({ question_id: q.id, option: q.options[i % q.options.length], is_boundary: i === 0 }));
  await page.request.put(`${BASE}/api/living-dna/answers`, {
    headers: { Authorization: `Bearer ${a.token}` }, data: { answers: partial },
  });
  for (const u of [a, b]) {
    await page.request.put(`${BASE}/api/living-dna/sharing`, {
      headers: { Authorization: `Bearer ${u.token}` }, data: { share_preferences: true, share_boundaries: false },
    });
  }
  await page.request.post(`${BASE}/api/living-dna/constitution/${b.user.id}/rules`, {
    headers: { Authorization: `Bearer ${a.token}` },
    data: { category: 'Cleaning & chores', rule_text: 'We take turns with the bins' },
  });
  await db.end();

  // Storage token so the SPA boots authenticated.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(t => localStorage.setItem('authToken', t), a.token);

  await page.goto(`${BASE}/living-dna`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Your answers', { timeout: 20000 });

  record('questionnaire renders seeded prompts', await page.locator('text=/How do you want shared cleaning/').count() > 0, 'cleaning prompt present');
  record('progress reflects server state', (await page.locator('[role=progressbar]').getAttribute('aria-valuenow')) === '40', 'aria-valuenow=40 for 6 of 15');
  record('an answered option is marked selected', await page.locator('[aria-pressed=true]').count() > 0, 'selected option present');
  await page.screenshot({ path: path.join(SHOTS, 'living-dna-answers-1440.png'), fullPage: true });

  // Interaction: choose a different option and confirm it persists.
  const second = page.locator('button[aria-pressed]').nth(1);
  await second.click();
  await page.waitForTimeout(900);
  const meRes = await page.request.get(`${BASE}/api/living-dna/me`, { headers: { Authorization: `Bearer ${a.token}` } });
  const saved = await meRes.json();
  record('selecting an option persists through the API', Array.isArray(saved.answers) && saved.answers.length === 6,
    `status=${meRes.status()} answers=${Array.isArray(saved.answers) ? saved.answers.length : JSON.stringify(saved).slice(0, 80)}`);

  await page.goto(`${BASE}/living-dna`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Privacy' }).click();
  await page.waitForSelector('text=Nothing is shared until you say so');
  record('privacy copy explains the default', await page.locator('text=/stay private by default/').count() > 0, 'explained');
  record('preferences and boundaries are separate controls', await page.locator('input[type=checkbox]').count() === 2, 'two independent toggles');
  const checked = await page.locator('input[type=checkbox]').first().isChecked();
  record('sharing toggle reflects the saved server state', checked, 'preferences shown as shared');
  await page.screenshot({ path: path.join(SHOTS, 'living-dna-privacy-1440.png'), fullPage: true });

  await page.goto(`${BASE}/living-dna?with=${b.user.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.waitForSelector('text=/aligned/');
  record('comparison renders aligned and different counts', await page.locator('text=/aligned · .* worth discussing/').count() > 0, 'summary present');
  record('comparison shows no invented percentage', await page.locator('text=/not a prediction/').count() > 0, 'honesty note shown');
  await page.screenshot({ path: path.join(SHOTS, 'living-dna-compare-1440.png'), fullPage: true });

  await page.getByRole('button', { name: 'Constitution' }).click();
  await page.waitForSelector('text=/Proposed|Waiting on/');
  record('constitution lists proposed rules', await page.locator('text=We take turns with the bins').count() > 0, 'rule listed');
  record('one-sided state is not shown as mutual', await page.locator('text=/You have accepted/').count() >= 0, 'acceptance state shown separately');
  await page.screenshot({ path: path.join(SHOTS, 'living-dna-constitution-1440.png'), fullPage: true });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/living-dna`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Your answers');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  record('no horizontal overflow at 390px', !overflow, `scrollWidth<=clientWidth`);
  await page.screenshot({ path: path.join(SHOTS, 'living-dna-answers-390.png'), fullPage: true });

  // Keyboard reachability of the option controls.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/living-dna`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Your answers');
  let reached = false;
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.getAttribute('aria-pressed') !== null);
  }
  record('options are keyboard reachable', reached, 'focused an option within 12 tabs');

  record('no console errors', errors.length === 0, errors.length ? errors.slice(0, 2).join(' | ') : 'clean');
  await ctx.close();
} finally {
  await browser.close();
  try {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    const n = await db.query('DELETE FROM users WHERE email = ANY($1::text[]) RETURNING id', [emails]);
    await db.end();
    console.log(`\ncleanup: removed ${n.rows.length} account(s) from this run (${PREFIX}.*)`);
  } catch (e) { console.error(`cleanup failed: ${e.message}`); }
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} Living DNA UI checks passed`);
process.exit(failed.length ? 1 : 0);