// MOCKED demo-transport test — network disabled, no storage, no database.
// The /likes routes must be answered inside a tour just like every other
// screen, from the same fixture set, and never answered when inactive.
import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const mem = () => {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
};

// Browser globals demoMode touches. Set BEFORE the import so module init sees
// a window; fetch is replaced so entering demo mode cannot touch the network.
globalThis.window = globalThis.window || {};
globalThis.sessionStorage = mem();
globalThis.localStorage = mem();
const realFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error('offline test: network disabled');
};

const demo = await import('../../src/lib/demoMode.js');

afterEach(async () => {
  if (demo.isDemo()) demo.exitDemo();
});

after(() => {
  globalThis.fetch = realFetch;
});

test('positive control: an inactive demo answers nothing', () => {
  assert.equal(demo.isDemo(), false);
  assert.equal(demo.demoResponse('/likes/sent'), undefined);
  assert.equal(demo.demoResponse('/likes/received'), undefined);
});

test('entering demo answers both /likes routes from the fixture set', async () => {
  await demo.enterDemo();
  assert.equal(demo.isDemo(), true);

  const sent = demo.demoResponse('/likes/sent');
  const received = demo.demoResponse('/likes/received');
  assert.ok(Array.isArray(sent) && sent.length > 0, 'sent must be a non-empty array');
  assert.ok(Array.isArray(received) && received.length > 0, 'received must be a non-empty array');

  for (const row of [...sent, ...received]) {
    assert.equal(typeof row.user_id, 'number');
    assert.ok(row.name, 'every demo like must carry a display name');
    assert.ok(row.liked_at, 'every demo like must carry a timestamp');
  }
});

test('sent rows agree with the matches tab; received rows are unanswered', async () => {
  await demo.enterDemo();
  const sent = demo.demoResponse('/likes/sent');
  const received = demo.demoResponse('/likes/received');
  const matches = demo.demoResponse('/matches');
  const feedIds = demo.demoFeed.map(p => p.id);

  // Same first-two slice as demoMatches() — a sent row marked matched must be
  // present on the Matches tab, or the three tabs contradict each other.
  assert.deepEqual(sent.map(r => r.user_id), feedIds.slice(0, 2));
  assert.deepEqual(matches.map(m => m.partner_id), feedIds.slice(0, 2));
  for (const row of sent) assert.equal(row.matched, true);

  // Incoming likes are the rest of the fixture set, already disjoint.
  assert.deepEqual(received.map(r => r.user_id), feedIds.slice(2, 4));
  for (const row of received) assert.equal(row.matched, undefined);

  const overlap = sent.filter(r => received.some(x => x.user_id === r.user_id));
  assert.equal(overlap.length, 0, 'a user cannot be in both lists');
});

test('unknown likes paths still fall through instead of being answered', async () => {
  await demo.enterDemo();
  assert.equal(demo.demoResponse('/likes'), undefined);
  assert.equal(demo.demoResponse('/likes/unknown'), undefined);
});

test('leaving demo stops answering /likes again', async () => {
  await demo.enterDemo();
  demo.exitDemo();
  assert.equal(demo.isDemo(), false);
  assert.equal(demo.demoResponse('/likes/sent'), undefined);
});
