// UI inspection: renders the real screens at phone and desktop widths and
// measures what a person would actually see -- horizontal overflow, clipped
// navigation, an avatar occluded by its cover, and controls that sit outside
// the viewport. Screenshots land in screenshots/qa/ for review.
//
//   node scripts/ui-inspect.mjs [baseUrl]     (qa-local passes the base URL)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// This script registers an account. Refuse to do that to the deployed database.
await import('./require-test-db.mjs');

const BASE = process.argv[2] || 'http://127.0.0.1:5199';
const WIDTHS = [360, 390, 1440];
const SHOT_DIR = path.resolve(process.cwd(), 'screenshots', 'qa');

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const api = async (p, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${BASE}/api${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const shoot = async (page, label) => {
  try {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const file = path.join(SHOT_DIR, `inspect-${label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`SHOT  screenshots/qa/inspect-${label}.png`);
  } catch (err) {
    console.log(`SHOT_FAIL  ${label}: ${err.message}`);
  }
};

const stamp = Date.now();
const account = { email: `uinspect.${stamp}@gmail.com`, password: 'UInspect!2026' };

const register = async () => {
  const r = await api('/auth/register', {
    method: 'POST',
    body: { email: account.email, password: account.password, name: 'Uma Inspect' },
  });
  if (r.status !== 201) throw new Error(`register: ${r.status}`);
  await api('/onboarding', {
    method: 'POST', token: r.body.token,
    body: { moving_to: 'Lisbon', budget: 1200, cleanliness: 4, looking_for: 'both' },
  });
  return r.body.token;
};

const login = async (page) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 25000 });
};

// Objective geometry probes. Every one of these reports a number or a list so
// a failure names what was measured instead of an opinion.
const probe = page => page.evaluate(() => {
  const vw = window.innerWidth;
  const clippedNav = [];
  // Report which nav was measured: several routes can render more than one
  // <nav>, and a probe that silently measured a signed-out bar would clear
  // every clipping check by measuring the wrong element.
  const navs = [...document.querySelectorAll('nav')];
  const authed = navs.find(n => /Log out/i.test(n.textContent || ''))
    || navs.find(n => /Log in|Create account/i.test(n.textContent || '')) || navs[0] || null;
  if (authed) {
    for (const el of authed.querySelectorAll('a, button')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        clippedNav.push(`${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18)} (${r.left.toFixed(0)}..${r.right.toFixed(0)})`);
      }
    }
  }

  // An avatar behind its cover reads as a cropped photo. Hit-test 8px into the
  // avatar's own box: testing the centre would land on the banner's bottom edge
  // for a 96px avatar pulled up 48px, and silently report a covered avatar as
  // visible.
  let avatarOccluded = null;
  const h1 = document.querySelector('h1');
  const card = h1?.closest('.overflow-hidden');
  const avatar = card?.querySelector('div > div > div.rounded-2xl');
  if (avatar) {
    const r = avatar.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 8);
    avatarOccluded = !(hit && (hit === avatar || avatar.contains(hit)));
  }

  return {
    vw,
    navCount: navs.length,
    navKind: authed ? (/Log out/i.test(authed.textContent || '') ? 'authed' : 'signed-out') : 'none',
    overflow: document.documentElement.scrollWidth - vw,
    clippedNav,
    avatarOccluded,
    hasAvatar: Boolean(avatar),
  };
});

const browser = await chromium.launch();
try {
  await register();

  // Signed-out surfaces first: auth is where a clipped control costs most.
  for (const width of WIDTHS) {
    for (const [label, route] of [['login', '/login'], ['register', '/register']]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input', { timeout: 20000 });
      await page.waitForTimeout(500);
      const p = await probe(page);
      record(`${label} ${width}px: no horizontal overflow`, p.overflow <= 1, `overflow ${p.overflow}px`);
      record(`${label} ${width}px: no navigation control is clipped`, p.clippedNav.length === 0,
        p.clippedNav.join(' | ') || 'all inside viewport');
      const submit = await page.locator('button[type="submit"]').boundingBox();
      record(`${label} ${width}px: submit control is inside the viewport`,
        Boolean(submit) && submit.x >= 0 && submit.x + submit.width <= width + 1,
        submit ? `x=${submit.x.toFixed(0)} w=${submit.width.toFixed(0)}` : 'not found');
      await shoot(page, `${label}-${width}`);
      await page.close();
    }
  }

  // Signed-in surfaces.
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await login(page);

    for (const [label, route] of [['profile', '/profile'], ['discover', '/roommates'], ['matches', '/matches'], ['chat', '/messages']]) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      // The profile renders skeletons until its query lands; measuring before
      // the heading exists reports "avatar not found" against a page that had
      // not drawn yet. networkidle covers the data fetch for the other routes
      // too -- a fixed sleep captured Discover mid-spinner.
      if (label === 'profile') await page.waitForSelector('h1', { timeout: 25000 });
      await page.waitForTimeout(1000);
      const p = await probe(page);

      record(`${label} ${width}px: no horizontal overflow`, p.overflow <= 1, `overflow ${p.overflow}px`);
      record(`${label} ${width}px: signed-in navigation is present`, p.navKind === 'authed',
        `${p.navCount} nav(s), measured ${p.navKind}`);
      record(`${label} ${width}px: no navigation control is clipped`, p.clippedNav.length === 0,
        p.clippedNav.join(' | ') || 'all inside viewport');

      if (label === 'profile') {
        record(`${width}px: profile avatar rendered`, p.hasAvatar, p.hasAvatar ? 'avatar located' : 'avatar not found');
        record(`${width}px: the avatar is not hidden behind its cover`,
          p.avatarOccluded === false,
          p.avatarOccluded === null ? 'no avatar to measure' : (p.avatarOccluded ? 'occluded by the cover' : 'fully visible'));
      }

      await shoot(page, `${label}-${width}`);
    }
    await page.close();
  }
} catch (err) {
  record('ui inspection ran without throwing', false, err.message);
} finally {
  await browser.close();
  try {
    const pg = (await import('pg')).default;
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    const gone = await db.query('DELETE FROM users WHERE email = $1 RETURNING id', [account.email]);
    await db.end();
    console.log(`cleanup: removed ${gone.rows.length} account(s) created by this run`);
  } catch (err) {
    console.log(`cleanup failed: ${err.message}`);
  }
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} ui inspection checks passed`);
for (const f of failed) console.log(`  FAILED: ${f.name}`);
// Success-only marker: printed only when every check above passed.
if (!failed.length) console.log('ui inspection passed');
process.exit(failed.length ? 1 : 0);
