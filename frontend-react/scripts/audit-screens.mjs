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
const OTHER_ID = 11;
const other = id => ({
  id, name: 'Rich Person', age: 27, occupation: 'Product design', city: 'Lisbon',
  budget: 15000, bio: 'Six years of flat sharing, plant parent, runs most mornings.',
  profile_image: null, verification_status: 'verified', moving_to: 'Lisbon',
});

// ?? Living DNA ????????????????????????????????????????????????????????????
// Fixtures follow the real contracts:
//   GET /living-dna/questions -> [{ id, slug, category, prompt, options, position }]
//   GET /living-dna/me        -> { answers, sharing, answered, total, complete }
//   GET /living-dna/compare/:id     -> { pairs, aligned, different, notAnsweredByThem, ... }
//   GET /living-dna/constitution/:id -> { rules, acceptedBy, iHaveAccepted, ... }
// The partner views live behind ?with=<id>, which is how LivingDnaPage decides
// whether to open on the answers tab or the comparison tab.
const ldQuestions = [
  { id: 1, slug: 'guests', category: 'Guests & quiet hours', position: 1,
    prompt: 'How do you feel about overnight guests?',
    options: ['Rarely, and always with notice', 'A couple of times a month', 'Often', 'No strong preference'] },
  { id: 2, slug: 'noise', category: 'Guests & quiet hours', position: 2,
    prompt: 'What does a quiet evening at home look like?',
    options: ['Silence after 9pm', 'Normal household noise until 11pm', 'A TV or music on is fine'] },
  { id: 3, slug: 'cleaning', category: 'Cleaning & chores', position: 3,
    prompt: 'How do you handle shared chores?',
    options: ['Weekly checklist we split', 'We clean as we go', 'One of us does it'] },
  { id: 4, slug: 'boundary', category: 'Cleaning & chores', position: 4,
    prompt: 'Is there anything you consider completely non-negotiable in a shared home?',
    options: ['No smoking indoors', 'No pets, sorry', 'Nothing absolute'] },
];

// Partly answered, so progress is real rather than 0% or 100%.
const ldMinePartial = {
  answers: [
    { question_id: 1, option: 'A couple of times a month', is_boundary: false, slug: 'guests', category: 'Guests & quiet hours', prompt: 'How do you feel about overnight guests?', updated_at: '2026-10-12T09:00:00Z' },
    { question_id: 2, option: 'Normal household noise until 11pm', is_boundary: false, slug: 'noise', category: 'Guests & quiet hours', prompt: 'What does a quiet evening at home look like?', updated_at: '2026-10-12T09:02:00Z' },
    { question_id: 4, option: 'No smoking indoors', is_boundary: true, slug: 'boundary', category: 'Cleaning & chores', prompt: 'Is there anything you consider completely non-negotiable in a shared home?', updated_at: '2026-10-12T09:05:00Z' },
  ],
  // Private by default: neither preferences nor boundaries are shared yet.
  sharing: { share_preferences: false, share_boundaries: false },
  answered: 3, total: 4, complete: false,
};

const ldCompare = {
  matchId: 77,
  iHaveShared: true, theyHaveShared: true,
  theySharePreferences: true, theyShareBoundaries: true,
  compared: 3, aligned: 2, different: 1, notAnsweredByThem: false,
  pairs: [
    { slug: 'guests', category: 'Guests & quiet hours', prompt: 'How do you feel about overnight guests?',
      status: 'aligned', my_option: 'A couple of times a month', their_option: 'A couple of times a month', their_boundary: null },
    { slug: 'noise', category: 'Guests & quiet hours', prompt: 'What does a quiet evening at home look like?',
      status: 'aligned', my_option: 'Normal household noise until 11pm', their_option: 'Normal household noise until 11pm', their_boundary: null },
    { slug: 'cleaning', category: 'Cleaning & chores', prompt: 'How do you handle shared chores?',
      status: 'different', my_option: 'Weekly checklist we split', their_option: 'We clean as we go', their_boundary: null },
  ],
  note: 'A side-by-side view of the answers you have both chosen to share. It is not a prediction of how well you will get along.',
};

// One accepted, one not: the dual-acceptance state the API actually reports.
const ldConstitution = {
  matchId: 77, partnerId: OTHER_ID,
  rules: [
    { id: 1, category: 'Rent & expenses', rule_text: 'Rent is 980 EUR a month, split evenly, due on the 1st.', status: 'agreed', author_id: ME, author_name: 'Tester', updated_at: '2026-10-12T09:10:00Z' },
    { id: 2, category: 'Cleaning & chores', rule_text: 'Kitchen is cleaned after every use; bathroom on a rotating weekly schedule.', status: 'proposed', author_id: OTHER_ID, author_name: 'Rich Person', updated_at: '2026-10-12T09:20:00Z' },
  ],
  acceptedBy: [ME],
  iHaveAccepted: true, theyHaveAccepted: false,
  mutuallyAccepted: false,
  agreedRules: 1,
};

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
      { id: 1, status: 'pending', updated_at: '2026-10-12T10:00:00Z', user_a_id: ME, user_b_id: 11,
        partner_id: 11, partner_name: 'Rich Person', partner_image: null,
        content: 'Rent is 980 EUR a month, split evenly. Bills are paid from a shared account on the first of each month.' },
    ] } },
  { name: 'living-dna', path: '/living-dna', populated: {
      '**/api/living-dna/questions': ldQuestions,
      '**/api/living-dna/me': ldMinePartial,
    } },
  { name: 'living-dna-compare', path: '/living-dna?with=' + OTHER_ID, populated: {
      '**/api/living-dna/questions': ldQuestions,
      '**/api/living-dna/me': ldMinePartial,
      ['**/api/living-dna/compare/' + OTHER_ID]: ldCompare,
      ['**/api/living-dna/constitution/' + OTHER_ID]: ldConstitution,
    } },
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
