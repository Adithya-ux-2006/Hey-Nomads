// Route-mocked browser suite for the offline-first work (GATES.offline.md G6).
//
//   node scripts/qa-offline-ui.mjs
//
// Serves the production build with `vite preview`, intercepts every /api/**
// call in the browser (no server, no database, no blob storage), and asserts:
//   - the Likes screen at 360, 390 and 1440 px: Sent/Received/Matches tabs,
//     populated and empty, with the demo screen's own "simulated data" banner
//     as the mocked-data label;
//   - the photo step's honest states: saved on this device, uploading, only
//     "uploaded" after a server success, failure keeps the preview with a
//     retry, and no success text on the failure path (positive control).
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const PORT = 4187;
const ORIGIN = `http://127.0.0.1:${PORT}`;

// ── fixtures (labelled: every name carries the Sample prefix) ──

const SENT = [
  { user_id: 21, name: 'Sample Aarav Mehta', profile_image: null, city: 'Pune', occupation: 'Designer', liked_at: '2026-10-01T10:00:00Z', matched: true },
  { user_id: 22, name: 'Sample Sara Khan', profile_image: null, city: 'Mumbai', occupation: 'Engineer', liked_at: '2026-10-02T10:00:00Z', matched: false },
];
const RECEIVED = [
  { user_id: 23, name: 'Sample Priya Sharma', profile_image: null, city: 'Delhi', occupation: 'Doctor', liked_at: '2026-10-03T10:00:00Z' },
  { user_id: 24, name: 'Sample Rohan Iyer', profile_image: null, city: 'Chennai', occupation: 'Chef', liked_at: '2026-10-04T10:00:00Z' },
];
const MATCHES = [
  { id: 500, partner_id: 21, partner_name: 'Sample Aarav Mehta', partner_image: null, partner_city: 'Pune', partner_occupation: 'Designer', updated_at: '2026-10-05T10:00:00Z', status: 'matched' },
];
const PROFILE = { name: 'Test User', age: 30, city: 'Pune', budget: 20000, bio: 'Offline suite' };

// Mutable per-scenario spec; the router reads it at request time so a test can
// flip the upload outcome between two clicks of the same button.
const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const attachRoutes = (context, spec) =>
  context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/likes/sent') return route.fulfill(json(spec.sent));
    if (path === '/api/likes/received') return route.fulfill(json(spec.received));
    if (path === '/api/matches') return route.fulfill(json(spec.matches));
    if (path === '/api/languages') return route.fulfill([]);
    if (path.startsWith('/api/profile/')) return route.fulfill(json(spec.profile || PROFILE));
    if (path === '/api/upload') {
      if (spec.uploadDelayMs) await new Promise(r => setTimeout(r, spec.uploadDelayMs));
      const u = spec.upload;
      return route.fulfill({ status: u.status, contentType: 'application/json', body: JSON.stringify(u.body) });
    }
    return route.fulfill(json([]));
  });

const defaultSpec = () => ({
  sent: SENT,
  received: RECEIVED,
  matches: MATCHES,
  profile: PROFILE,
  upload: { status: 200, body: { url: 'https://blob.test/uploaded.png' } },
  uploadDelayMs: 0,
});

const newContext = async (browser, { demo = false, spec = defaultSpec() } = {}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ demo }) => {
    if (demo) sessionStorage.setItem('hey_nomads_demo', '1');
    else {
      localStorage.setItem('authToken', 'offline-ui-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    }
  }, { demo });
  await attachRoutes(context, spec);
  return { context, spec };
};

// Hidden sibling panels can hold the same copy (both Sent and Matches render
// "Sample Aarav Mehta"), so every wait targets a VISIBLE match only.
const text = (page, fragment) =>
  page
    .getByText(fragment, { exact: false })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 8000 });

const gone = async (page, fragment) => {
  assert.equal(await page.getByText(fragment, { exact: false }).count(), 0, `"${fragment}" must not be on the page`);
};

const tab = (page, name) => page.getByRole('tab', { name: new RegExp(`^${name}`) });

const assertNoOverflow = async (page, width) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `horizontal overflow of ${overflow}px at ${width}px`);
};

// ── Likes screen, populated, at every viewport ─────────────────

async function likesPass(browser, width) {
  const { context } = await newContext(browser);
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${ORIGIN}/likes`, { waitUntil: 'domcontentloaded' });

  assert.equal(await tab(page, 'Sent').getAttribute('aria-selected'), 'true', 'Sent is the default tab');
  await text(page, 'Sample Aarav Mehta');
  await text(page, 'Matched');

  await tab(page, 'Received').click();
  await text(page, 'Sample Priya Sharma');
  await text(page, 'New like');

  await tab(page, 'Matches').click();
  await text(page, 'Sample Aarav Mehta');
  await page
    .getByRole('link', { name: 'Message Sample Aarav Mehta' })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 8000 });

  await assertNoOverflow(page, width);
  await context.close();
}

// ── Likes screen, empty ────────────────────────────────────────

async function emptyPass(browser) {
  const { context } = await newContext(browser, {
    spec: { ...defaultSpec(), sent: [], received: [], matches: [] },
  });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/likes`, { waitUntil: 'domcontentloaded' });

  await text(page, 'No likes sent yet');
  await tab(page, 'Received').click();
  await text(page, 'No incoming likes yet');
  await tab(page, 'Matches').click();
  await text(page, 'No matches yet');
  await context.close();
}

// ── Demo mode: the in-app mock transport, labelled as simulated ─

// Tab badges read "Sent 2"; poll until the digits equal n (refetch is instant
// in demo, but the assertion still waits like any other UI transition).
const tabCount = async (page, name) => {
  const t = await tab(page, name).textContent();
  return Number(String(t).replace(/\D/g, ''));
};
const expectTabCount = async (page, name, n) => {
  for (let i = 0; i < 40; i++) {
    if (await tabCount(page, name) === n) return;
    await page.waitForTimeout(100);
  }
  const last = await tab(page, name).textContent();
  throw new Error(`tab ${name} never counted ${n}; last badge: "${last}"`);
};

async function demoPass(browser) {
  const { context } = await newContext(browser, { demo: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 900 });

  // Landing regression: the "Try with Demo Account" button must land the
  // signed-out visitor inside the rebuilt walkthrough directly (no hub, no
  // extra click), and the legacy /presentation surface must be gone.
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Try with Demo Account' }).first().click();
  await page.waitForURL('**/roommates', { timeout: 15000 });
  await text(page, 'simulated data, saved in this tab only');

  await page.goto(`${ORIGIN}/likes`, { waitUntil: 'domcontentloaded' });

  // The banner is the label that keeps mocked rows from posing as real people.
  await text(page, 'simulated data, saved in this tab only');
  await text(page, 'Sample Aarav Mehta');

  // Seeded demo state: 2 sent likes (both matched) + 5 incoming likes.
  await tab(page, 'Received').click();
  await text(page, 'Sample Priya Sharma');
  assert.deepEqual(
    [
      await tabCount(page, 'Sent'),
      await tabCount(page, 'Received'),
      await tabCount(page, 'Matches'),
    ],
    [2, 5, 2],
  );

  // Accept one: same /swipe endpoint the discovery screen uses. The like is
  // mutual, so a match is created and the row leaves Received.
  await page.getByRole('button', { name: 'Accept like from Sample Priya Sharma' }).click();
  await expectTabCount(page, 'Received', 4);
  await expectTabCount(page, 'Matches', 3);

  await tab(page, 'Matches').click();
  await text(page, 'Sample Priya Sharma');
  await page
    .getByRole('link', { name: 'Message Sample Priya Sharma' })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 8000 });

  // Refresh keeps the accepted match.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await tab(page, 'Matches').click();
  await text(page, 'Sample Priya Sharma');

  // Dismiss another: it vanishes and stays gone after a second refresh.
  await tab(page, 'Received').click();
  await page.getByRole('button', { name: 'Dismiss Sample Rohan Iyer' }).click();
  await expectTabCount(page, 'Received', 3);
  await gone(page, 'Sample Rohan Iyer');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await gone(page, 'Sample Rohan Iyer');

  await context.close();
}

// ── Photo step: the honest state machine, in a real browser ────

const openPhotoStep = async page => {
  await page.goto(`${ORIGIN}/edit-profile`, { waitUntil: 'domcontentloaded' });
  await text(page, 'Basic Info');
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: 'Save and continue' }).click();
  }
  await text(page, 'Photo');
};

const PNG_PICK = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('offline-suite-image-bytes') };

async function photoPass(browser) {
  // 1. Offline pick stays "Saved on this device"; going online retries it.
  {
    const { context } = await newContext(browser);
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 900 });
    await openPhotoStep(page); // assets need the network; only the pick is offline
    await context.setOffline(true);
    await page.locator('input[type="file"]').setInputFiles(PNG_PICK);
    await page.locator('[data-photo-state="local"]').waitFor({ state: 'visible', timeout: 8000 });
    await text(page, 'Saved on this device');
    await gone(page, 'Uploaded to your profile');

    await context.setOffline(false); // fires the page's online event -> retry
    await page.locator('[data-photo-state="uploaded"]').waitFor({ state: 'visible', timeout: 8000 });
    await text(page, 'Uploaded to your profile');
    await context.close();
  }

  // 2. Uploading is visible while the request is in flight, and it blocks Save.
  {
    const { context, spec } = await newContext(browser);
    spec.uploadDelayMs = 1500;
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 900 });
    await openPhotoStep(page);
    await page.locator('input[type="file"]').setInputFiles(PNG_PICK);
    await page.locator('[data-photo-state="saving"]').waitFor({ state: 'visible', timeout: 8000 });
    await text(page, 'Uploading');
    await page.getByRole('button', { name: 'Uploading photo' }).waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('[data-photo-state="uploaded"]').waitFor({ state: 'visible', timeout: 8000 });
    await context.close();
  }

  // 3. Failure keeps the preview, offers a retry, and never says "uploaded".
  //    Then the retry recovers once the server does answer.
  {
    const { context, spec } = await newContext(browser);
    spec.upload = { status: 500, body: { error: 'Upload failed' } };
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 900 });
    await openPhotoStep(page);
    await page.locator('input[type="file"]').setInputFiles(PNG_PICK);
    await page.locator('[data-photo-state="failed"]').waitFor({ state: 'visible', timeout: 8000 });
    await text(page, 'kept on this device');
    await page.locator('img[alt="Preview"]').waitFor({ state: 'visible', timeout: 8000 });
    await page.getByRole('button', { name: 'Retry upload' }).waitFor({ state: 'visible', timeout: 8000 });
    // Positive control: a failed upload may never claim success.
    await gone(page, 'Uploaded to your profile');

    spec.upload = { status: 200, body: { url: 'https://blob.test/retried.png' } };
    await page.getByRole('button', { name: 'Retry upload' }).click();
    await page.locator('[data-photo-state="uploaded"]').waitFor({ state: 'visible', timeout: 8000 });
    await context.close();
  }

  // 4. A rejected file type answers inline and leaves the step idle.
  {
    const { context } = await newContext(browser);
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 900 });
    await openPhotoStep(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image'),
    });
    await text(page, 'Choose a JPG, PNG or WebP image.');
    assert.equal(await page.locator('[data-photo-state]').count(), 0, 'an invalid pick must not invent a state');
    await context.close();
  }
}

// ── Gender-preference selector on the profile editor ───────────

async function genderPrefPass(browser, width) {
  const EXPECTED_OPTIONS = ['Prefer not to specify', 'Women', 'Men', 'All genders'];

  // 1. No stored preference: the selector defaults to "Prefer not to specify"
  //    and both labels ("My gender" vs the preference) are present and distinct.
  {
    const { context } = await newContext(browser, {
      spec: { ...defaultSpec(), profile: { ...PROFILE } },
    });
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${ORIGIN}/edit-profile`, { waitUntil: 'domcontentloaded' });
    await text(page, 'Basic Info');

    await text(page, 'My gender');
    await text(page, 'Who would you prefer to live with?');

    const sel = page.locator('#f-prefGender');
    await sel.waitFor({ state: 'visible', timeout: 8000 });
    assert.equal(await sel.inputValue(), 'unspecified', 'must default to Prefer not to specify');
    assert.deepEqual(await sel.locator('option').allTextContents(), EXPECTED_OPTIONS);

    // Selecting a value updates the form state.
    await sel.selectOption('female');
    assert.equal(await sel.inputValue(), 'female');

    await assertNoOverflow(page, width);
    await context.close();
  }

  // 2. A stored preference is reflected after load.
  {
    const { context, spec } = await newContext(browser);
    spec.profile = { ...PROFILE, preferred_gender: 'female' };
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${ORIGIN}/edit-profile`, { waitUntil: 'domcontentloaded' });
    await text(page, 'Basic Info');

    const sel = page.locator('#f-prefGender');
    await sel.waitFor({ state: 'visible', timeout: 8000 });
    assert.equal(await sel.inputValue(), 'female', 'stored preference must load into the selector');
    await context.close();
  }
}

// ── harness ────────────────────────────────────────────────────

// ── Discovery preference on the Profile page ──────────────────

async function profilePrefPass(browser, width) {
  // 1. Own profile: the control is there, loads the stored value, offers the
  //    four canonical choices, and says out loud what the choice does.
  {
    const { context, spec } = await newContext(browser);
    spec.profile = { ...PROFILE, preferred_gender: 'female' };
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${ORIGIN}/profile`, { waitUntil: 'domcontentloaded' });
    await text(page, 'Discovery');

    const sel = page.locator('#pp-prefGender');
    await sel.waitFor({ state: 'visible', timeout: 8000 });
    assert.equal(await sel.inputValue(), 'female', 'stored preference must load into the profile control');
    assert.deepEqual(
      await sel.locator('option').allTextContents(),
      ['Prefer not to specify', 'Women', 'Men', 'All genders'],
      'the profile control must offer the same four values as the editor'
    );

    await sel.selectOption('male');
    assert.equal(await sel.inputValue(), 'male', 'selecting must update the control');
    await text(page, "You'll only see men's accounts in Discover and Roommates.");

    await assertNoOverflow(page, width);
    await context.close();
  }

  // 2. Someone else's profile: no control. A preference is the owner's
  //    setting, not display copy for a visitor.
  {
    const { context } = await newContext(browser);
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${ORIGIN}/profile/21`, { waitUntil: 'domcontentloaded' });
    await text(page, PROFILE.name);
    assert.equal(await page.locator('#pp-prefGender').count(), 0, 'a browsed profile must not expose the control');
    await assertNoOverflow(page, width);
    await context.close();
  }
}

// ── Onboarding states the consequence of the preference choice ──

async function onboardingPrefPass(browser, width) {
  const { context } = await newContext(browser);
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${ORIGIN}/onboarding`, { waitUntil: 'domcontentloaded' });

  await text(page, "I'd like to meet");
  // The default is "I'm not sure yet": an open feed, stated honestly rather
  // than left to be discovered as an empty Discover page.
  await text(page, "You'll see everyone you're compatible with.");

  // Choosing a gender states the consequence right there, and the two-sided
  // rule stays on screen alongside it.
  await page.getByRole('button', { name: 'Women', exact: true }).click();
  await text(page, "You'll only see women's accounts in Discover and Roommates.");
  await text(page, 'Both sides have to be open to it');

  await assertNoOverflow(page, width);
  await context.close();
}

const waitForServer = url =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + 30000;
    const probe = () => {
      const req = http.get(url, res => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`preview server did not start at ${url}`));
        else setTimeout(probe, 250);
      });
    };
    probe();
  });

// Always rebuild: the suite must test the current sources, not a stale dist.
const build = spawnSync(process.execPath, ['scripts/gates.mjs', 'build'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const preview = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' }
);

let browser;
try {
  await waitForServer(ORIGIN);
  browser = await chromium.launch();
  for (const width of [360, 390, 1440]) {
    await likesPass(browser, width);
    console.error(`likes ${width}px ok`);
  }
  await emptyPass(browser);
  console.error('likes empty ok');
  await demoPass(browser);
  console.error('demo label ok');
  await photoPass(browser);
  console.error('photo states ok');
  for (const width of [360, 390, 1440]) {
    await genderPrefPass(browser, width);
    console.error(`gender-pref ${width}px ok`);
  }
  for (const width of [360, 390, 1440]) {
    await profilePrefPass(browser, width);
    console.error(`profile-pref ${width}px ok`);
  }
  for (const width of [360, 390, 1440]) {
    await onboardingPrefPass(browser, width);
    console.error(`onboarding-pref ${width}px ok`);
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  preview.kill();
}
process.exit(process.exitCode ?? 0);
