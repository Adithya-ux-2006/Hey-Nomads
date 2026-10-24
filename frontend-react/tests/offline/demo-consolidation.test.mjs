// Regression tests for Demo Mode consolidation: one canonical demo entry
// point, immediate walkthrough entry, and removal of legacy / competing
// triggers. Source-level assertions mirror the demo gate plus unit checks of
// the demo transport.
import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = fs.realpathSync('.');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const LANDING = 'src/pages/LandingPage.jsx';
const DEMO_PAGE = 'src/pages/DemoModePage.jsx';
const APP = 'src/App.jsx';
const ROOMMATES = 'src/pages/RoommatesPage.jsx';

test('landing page keeps the primary Try with Demo Account entry point to /demo', () => {
  const landing = read(LANDING);
  assert.ok(/Try with Demo Account/.test(landing), 'primary Try with Demo Account button present');
  assert.ok(/to="\/demo"/.test(landing), 'primary demo button links to /demo');
  assert.ok(!/to="\/presentation"/.test(landing), 'legacy /presentation link removed from landing');
});

test('DemoModePage enters demo, starts the tour, and opens the first stage immediately', () => {
  const page = read(DEMO_PAGE);
  assert.ok(/enterDemo\s*\(/.test(page), 'DemoModePage enters demo mode on mount');
  assert.ok(/startTour\s*\(0\)/.test(page), 'DemoModePage starts the tour at step 0');
  assert.ok(/navigate\(TOUR_STEPS\[0\]\.path\)/.test(page), 'DemoModePage opens the first walkthrough stage');
  assert.ok(page.includes('return null'), 'DemoModePage renders no chrome of its own');
});

test('/demo is a public route and no legacy demo route or component remains', () => {
  const app = read(APP);
  assert.ok(/path="\/demo" element=\{<DemoModePage \/>}/.test(app), '/demo is a public route');
  assert.ok(!/PrivateRoute/.test(app.slice(app.indexOf('path="/demo"'), app.indexOf('path="/demo"') + 60)), '/demo is not wrapped in PrivateRoute');
  assert.ok(!app.includes('/presentation'), 'no legacy /presentation route in the router');
  assert.equal(fs.existsSync(path.join(root, 'src/pages/PresentationPage.jsx')), false, 'PresentationPage.jsx removed');
  assert.equal(fs.existsSync(path.join(root, 'src/lib/presentation.js')), false, 'presentation.js removed');
});

test('RoommatesPage no longer renders a competing demo walkthrough trigger', () => {
  const roommates = read(ROOMMATES);
  assert.ok(!/DemoModeLink/.test(roommates), 'DemoModeLink component removed from RoommatesPage');
  assert.ok(!/to="\/demo"/.test(roommates), 'RoommatesPage has no competing /demo trigger');
  assert.ok(!/isDemo/.test(roommates), 'RoommatesPage no longer branches on demo state');
});

// ---- demo transport unit checks (mirrors of demo-likes coverage, isolated) ----

const mem = () => {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
};

globalThis.window = globalThis.window || {};
globalThis.sessionStorage = mem();
globalThis.localStorage = mem();
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('offline test: network disabled'); };

const demo = await import('../../src/lib/demoMode.js');

const DEMO_KEYS = ['hey_nomads_demo','hey_nomads_demo_received','hey_nomads_demo_sent','hey_nomads_demo_matches','hey_nomads_demo_dismissed','hey_nomads_demo_messages','hey_nomads_demo_initialized'];

afterEach(async () => {
  if (demo.isDemo()) demo.exitDemo();
  const s = globalThis.sessionStorage;
  for (const k of DEMO_KEYS) s.removeItem(k);
});

after(() => { globalThis.fetch = realFetch; });

test('demo entry sets the flag and answers the tour endpoints locally', async () => {
  assert.equal(demo.isDemo(), false);
  await demo.enterDemo();
  assert.equal(demo.isDemo(), true);
  const feed = demo.demoResponse('/roommates/recommended');
  assert.ok(Array.isArray(feed) && feed.length === 10);
  for (const p of feed) {
    assert.equal(typeof p.score, 'number');
    assert.ok(Array.isArray(p.reasons));
  }
  assert.equal(typeof demo.demoResponse('/likes/sent'), 'object');
  assert.equal(typeof demo.demoResponse('/matches'), 'object');
  demo.exitDemo();
  assert.equal(demo.isDemo(), false);
  assert.equal(demo.demoResponse('/matches'), undefined);
});

test('accepting an incoming like creates a match; dismissing removes it persistently', async () => {
  await demo.enterDemo();
  const received = demo.demoResponse('/likes/received');
  const target = received[0].user_id;

  demo.acceptLike(target);
  assert.ok(!demo.demoResponse('/likes/received').some(r => r.user_id === target));
  assert.ok(demo.demoResponse('/matches').some(m => m.partner_id === target));

  demo.exitDemo();
  await demo.enterDemo();
  assert.ok(!demo.demoResponse('/likes/received').some(r => r.user_id === target));
  assert.ok(demo.demoResponse('/matches').some(m => m.partner_id === target));
});

test('demo data stays isolated from real-user storage keys', async () => {
  await demo.enterDemo();
  assert.equal(globalThis.sessionStorage.getItem('hey_nomads_demo'), '1', 'demo flag stored in sessionStorage');
  assert.ok(globalThis.sessionStorage.getItem('hey_nomads_demo_received') != null, 'demo received state persisted');
  assert.equal(globalThis.localStorage.getItem('authToken'), null, 'no real auth token left after demo entry');
  assert.equal(globalThis.localStorage.getItem('userId'), null, 'no real user id left after demo entry');
});
