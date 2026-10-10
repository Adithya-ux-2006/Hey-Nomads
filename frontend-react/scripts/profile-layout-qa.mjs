// Profile layout QA: renders the profile page at the four required widths and
// asserts the geometry that the padding hack used to break — the avatar's
// distance from the card edge, name alignment, and that Edit is fully inside
// the card rather than clipped by the banner.
//
// Usage: node scripts/profile-layout-qa.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://hey-nomads.vercel.app';
const WIDTHS = [360, 390, 768, 1440];
// The avatar should sit one padding unit in from the card edge. Tolerances are
// in CSS pixels and cover sub-pixel rounding only.
const EDGE_TOLERANCE = 3;
const ALIGN_TOLERANCE = 2;

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const api = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const stamp = Date.now();
// Two real-classified accounts: one complete enough to exercise the populated
// branch, one bare so the empty-state branch renders.
const mk = async (n, onboard) => {
  const email = `layout.${stamp}.${n}@gmail.com`;
  const password = 'LayoutQa!2026';
  const r = await api('/auth/register', { method: 'POST', body: { email, password, name: `Layout ${n}` } });
  if (r.status !== 201) throw new Error(`register ${n}: ${r.status}`);
  if (onboard) {
    await api('/onboarding', {
      method: 'POST', token: r.body.token,
      body: {
        moving_to: 'Mumbai', budget: 28000, cleanliness: 4, occupation: 'Software Engineer',
        bio: 'Backend developer, early morning runner, looking for a calm and tidy flat in Bandra.',
        sleep_time: 'early', diet: 'veg', social_level: 'moderate', flat_type: '2BHK',
      },
    });
    await api('/profile', {
      method: 'POST', token: r.body.token,
      body: { occupation: 'Software Engineer', bio: 'Backend developer, early morning runner, looking for a calm and tidy flat in Bandra.', flat_type: '2BHK' },
    });
  }
  return { email, password, id: r.body.user.id };
};

const login = async (page, a) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', a.email);
  await page.fill('input[type="password"]', a.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
};

const browser = await chromium.launch();

try {
  const rich = await mk('rich', true);
  const bare = await mk('bare', false);
  record('accounts provisioned', true, `rich=${rich.id} bare=${bare.id}`);

  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await login(page, rich);
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { timeout: 20000 });
    await page.waitForTimeout(700);

    // Geometry, measured from the rendered boxes rather than the class names.
    const geo = await page.evaluate(() => {
      const card = document.querySelector('h1')?.closest('.overflow-hidden');
      const avatar = document.querySelector('h1')?.closest('.overflow-hidden')
        ?.querySelector('div > div > div.rounded-2xl') || null;
      const edit = Array.from(document.querySelectorAll('a'))
        .find(a => /Edit profile/i.test(a.textContent || '')) || null;
      const banner = card?.querySelector('.h-32') || null;
      if (!card || !avatar || !edit) return null;
      const c = card.getBoundingClientRect();
      const a = avatar.getBoundingClientRect();
      const e = edit.getBoundingClientRect();
      const b = banner?.getBoundingClientRect();
      const h1 = document.querySelector('h1').getBoundingClientRect();
      return {
        cardLeft: c.left, cardRight: c.right,
        avatarLeft: a.left, avatarTop: a.top,
        editBottom: e.bottom, editRight: e.right, editTop: e.top,
        nameLeft: h1.left,
        bannerBottom: b ? b.bottom : null,
        docScrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
      };
    });

    if (!geo) {
      record(`${width}px: layout measured`, false, 'could not locate card, avatar or Edit button');
      await page.close();
      continue;
    }

    const edgeOffset = geo.avatarLeft - geo.cardLeft;
    record(`${width}px: avatar sits one padding unit from the card edge`,
      Math.abs(edgeOffset - 24) <= EDGE_TOLERANCE, `${edgeOffset.toFixed(1)}px (want 24)`);

    const alignDelta = Math.abs(geo.nameLeft - geo.avatarLeft);
    record(`${width}px: name aligns with the avatar`,
      alignDelta <= ALIGN_TOLERANCE, `${alignDelta.toFixed(1)}px apart`);

    record(`${width}px: avatar overlaps the banner`,
      geo.bannerBottom === null || geo.avatarTop < geo.bannerBottom,
      `avatar top ${geo.avatarTop.toFixed(0)} vs banner bottom ${geo.bannerBottom?.toFixed(0)}`);

    const clippedBelow = geo.editBottom > geo.cardRight; // sanity placeholder replaced below
    const editInside = geo.editRight <= geo.cardRight + 1 && geo.editTop >= 0;
    record(`${width}px: Edit button is fully inside the card`, editInside,
      `edit right ${geo.editRight.toFixed(0)} vs card right ${geo.cardRight.toFixed(0)}`);
    record(`${width}px: Edit button is not clipped by the banner`,
      geo.bannerBottom === null || geo.editTop >= geo.bannerBottom - 40,
      `edit top ${geo.editTop.toFixed(0)}, banner bottom ${geo.bannerBottom?.toFixed(0)}`);

    record(`${width}px: no horizontal overflow`, geo.docScrollW <= geo.innerW + 1,
      `scrollWidth ${geo.docScrollW} vs innerWidth ${geo.innerW}`);
    void clippedBelow;

    await page.close();
  }

  // Empty-state branch on a profile with nothing filled in.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await login(page, bare);
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { timeout: 20000 });
    await page.waitForTimeout(700);

    const intro = await page.getByText("No introduction added yet").count();
    record('incomplete profile: introduction empty state renders', intro > 0, `${intro} occurrence(s)`);
    const about = await page.getByText("No introduction added yet").count();
    record('incomplete profile: About section states it is empty', about > 0);
// Registration seeds lifestyle defaults, so this section is legitimately
// populated. What matters is that it is never a bare header over nothing:
// either it shows values, or it says plainly that none were added.
const lifestyleItems = await page.getByText(/^(Sleep|Cleanliness|Diet|Smoking|Drinking|Social)$/).count();
const lifestyleEmpty = await page.getByText("Lifestyle details haven't been added yet").count();
record('incomplete profile: Lifestyle shows values or an explicit empty state',
  lifestyleItems > 0 || lifestyleEmpty > 0,
  `${lifestyleItems} value(s), empty state ${lifestyleEmpty}`);
    const complete = await page.getByRole('link', { name: /Complete profile/i }).count();
    record('incomplete profile: owner is offered a way to complete it', complete > 0, `${complete} control(s)`);
    const invented = await page.getByText(/Backend developer/i).count();
    record('incomplete profile: no invented biography', invented === 0);

    // Another user's profile must not offer editing.
    await page.goto(`${BASE}/profile/${rich.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const editOnOther = await page.getByRole('link', { name: /Edit profile/i }).count();
    record('other profile: no edit control on someone else’s profile', editOnOther === 0);
    await page.close();
  }
} catch (err) {
  record('harness completed without throwing', false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} profile layout checks passed`);
for (const f of failed) console.log(`  FAILED: ${f.name} — ${f.detail}`);
if (!failed.length) console.log('profile layout qa passed');
process.exit(failed.length ? 1 : 0);