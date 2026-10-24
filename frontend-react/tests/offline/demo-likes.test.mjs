// MOCKED demo-transport test — network disabled, no storage, no database.
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

test('positive control: an inactive demo answers nothing', () => {
  assert.equal(demo.isDemo(), false);
  assert.equal(demo.demoResponse('/likes/sent'), undefined);
  assert.equal(demo.demoResponse('/likes/received'), undefined);
  assert.equal(demo.demoResponse('/matches'), undefined);
});

test('ten demo profiles load with real scores', async () => {
  await demo.enterDemo();
  assert.equal(demo.demoFeed.length, 10);
  for (const p of demo.demoFeed) {
    assert.equal(typeof p.score, 'number');
    assert.ok(p.score >= 0 && p.score <= 100);
    assert.ok(p.breakdown && typeof p.breakdown === 'object');
    for (const k of ['lifestyle','budget','location','movein','interests','habits']) {
      assert.ok(Object.prototype.hasOwnProperty.call(p.breakdown, k), `missing ${k}`);
    }
    assert.ok(Array.isArray(p.reasons));
  }
});

test('incoming likes are 4-6, disjoint from sent, no self', async () => {
  await demo.enterDemo();
  const sent = demo.demoResponse('/likes/sent');
  const received = demo.demoResponse('/likes/received');
  assert.ok(Array.isArray(sent) && sent.length > 0);
  assert.ok(Array.isArray(received) && received.length >= 4 && received.length <= 6);
  for (const row of [...sent, ...received]) {
    assert.equal(typeof row.user_id, 'number');
    assert.ok(row.name);
    assert.ok(row.liked_at);
    assert.notEqual(row.user_id, demo.DEMO_SELF_ID);
  }
  const overlap = sent.filter(r => received.some(x => x.user_id === r.user_id));
  assert.equal(overlap.length, 0);
});

test('sent rows agree with matches tab', async () => {
  await demo.enterDemo();
  const sent = demo.demoResponse('/likes/sent');
  const matches = demo.demoResponse('/matches');
  const feedIds = demo.demoFeed.map(p => p.id);
  assert.deepEqual(sent.map(r => r.user_id), feedIds.slice(0, 2));
  assert.deepEqual(matches.map(m => m.partner_id), feedIds.slice(0, 2));
  for (const row of sent) assert.equal(row.matched, true);
  const received = demo.demoResponse('/likes/received');
  assert.deepEqual(received.map(r => r.user_id), feedIds.slice(2, 7));
});

test('accepting a like creates a match and removes from received', async () => {
  await demo.enterDemo();
  const received = demo.demoResponse('/likes/received');
  const target = received[0].user_id;
  const before = demo.demoResponse('/matches').length;
  demo.acceptLike(target);
  const afterReceived = demo.demoResponse('/likes/received');
  const afterMatches = demo.demoResponse('/matches');
  assert.ok(!afterReceived.some(r => r.user_id === target));
  assert.ok(afterMatches.some(m => m.partner_id === target));
  assert.equal(afterMatches.length, before + 1);
});

test('dismissing a like persists and keeps it out of received', async () => {
  await demo.enterDemo();
  const received = demo.demoResponse('/likes/received');
  const target = received[0].user_id;
  demo.dismissLike(target);
  assert.ok(!demo.demoResponse('/likes/received').some(r => r.user_id === target));
  // re-enter preserves dismissed
  demo.exitDemo();
  await demo.enterDemo();
  assert.ok(!demo.demoResponse('/likes/received').some(r => r.user_id === target));
});

test('swipe like on a received profile creates a match', async () => {
  await demo.enterDemo();
  const received = demo.demoResponse('/likes/received');
  const target = received[0].user_id;
  const res = demo.demoResponse('/swipe', { method: 'POST', body: { targetId: target, action: 'like' } });
  assert.equal(res.ok, true);
  assert.equal(res.matchCreated, true);
  assert.ok(demo.demoResponse('/matches').some(m => m.partner_id === target));
});

test('state survives refresh (re-enter)', async () => {
  await demo.enterDemo();
  const received = demo.demoResponse('/likes/received');
  const target = received[0].user_id;
  demo.acceptLike(target);
  demo.exitDemo();
  await demo.enterDemo();
  assert.ok(demo.demoResponse('/matches').some(m => m.partner_id === target));
  assert.ok(!demo.demoResponse('/likes/received').some(r => r.user_id === target));
});

test('repeated init does not restore dismissed or duplicate matches', async () => {
  await demo.enterDemo();
  const received = demo.demoResponse('/likes/received');
  const dTarget = received[0].user_id;
  const aTarget = received[1].user_id;
  demo.dismissLike(dTarget);
  demo.acceptLike(aTarget);
  const matchCount = demo.demoResponse('/matches').length;
  demo.exitDemo();
  await demo.enterDemo();
  assert.ok(!demo.demoResponse('/likes/received').some(r => r.user_id === dTarget));
  assert.equal(demo.demoResponse('/matches').length, matchCount);
  assert.ok(demo.demoResponse('/matches').some(m => m.partner_id === aTarget));
});

test('messaging persists across poll', async () => {
  await demo.enterDemo();
  const matches = demo.demoResponse('/matches');
  const pid = matches[0].partner_id;
  const SENT = 'Is the place still available?';
  demo.demoResponse('/messages', { method: 'POST', body: { receiver_id: pid, message: SENT } });
  const thread = demo.demoResponse(`/conversations/${pid}`);
  assert.ok(thread.some(m => m.content === SENT));
});

test('unknown likes paths fall through', async () => {
  await demo.enterDemo();
  assert.equal(demo.demoResponse('/likes'), undefined);
  assert.equal(demo.demoResponse('/likes/unknown'), undefined);
});

test('leaving demo stops answering', async () => {
  await demo.enterDemo();
  demo.exitDemo();
  assert.equal(demo.isDemo(), false);
  assert.equal(demo.demoResponse('/likes/sent'), undefined);
});
