// MOCKED / OFFLINE unit tests — pure notification logic, no database, no network.
// These are the builder/normalizer/dedup cases the gate suite re-runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_TYPES,
  dedupKeyFor,
  buildNotification,
  toApiNotification,
  destinationFor,
  labelFor,
} from '../../api/notifications.mjs';

// ── NOTIFICATION_TYPES ────────────────────────────────────────

test('NOTIFICATION_TYPES: only message, like, match are emittable', () => {
  assert.deepEqual([...NOTIFICATION_TYPES].sort(), ['like', 'match', 'message']);
});

// ── dedupKeyFor ───────────────────────────────────────────────

test('dedupKeyFor: message is keyed per conversation so a thread is one row', () => {
  assert.equal(dedupKeyFor('message', { conversationId: 42 }), 'conversation:42');
});

test('dedupKeyFor: like is keyed per actor so re-liking does not stack', () => {
  assert.equal(dedupKeyFor('like', { actorId: 7 }), 'actor:7');
  assert.equal(dedupKeyFor('like', { actorId: 7, other: 'ignored' }), 'actor:7');
});

test('dedupKeyFor: match is keyed per pair, order-independent', () => {
  assert.equal(dedupKeyFor('match', { userAId: 3, userBId: 9 }), 'pair:3-9');
  assert.equal(dedupKeyFor('match', { userAId: 9, userBId: 3 }), 'pair:3-9');
});

test('dedupKeyFor: missing ids return null, never a wrong-but-plausible key', () => {
  assert.equal(dedupKeyFor('message', {}), null);
  assert.equal(dedupKeyFor('message', { conversationId: null }), null);
  assert.equal(dedupKeyFor('like', {}), null);
  assert.equal(dedupKeyFor('match', { userAId: 1 }), null);
  assert.equal(dedupKeyFor('nope', { conversationId: 1 }), null);
});

// ── buildNotification ─────────────────────────────────────────

test('buildNotification: a valid message notification is built with numeric ids', () => {
  const n = buildNotification({ recipientId: '5', actorId: '9', type: 'message', ids: { conversationId: 42 } });
  assert.deepEqual(n, {
    recipientId: 5,
    actorId: 9,
    type: 'message',
    dedupKey: 'conversation:42',
  });
});

test('buildNotification: self-notifications are dropped (no bell for your own action)', () => {
  assert.equal(buildNotification({ recipientId: 7, actorId: 7, type: 'like', ids: { actorId: 7 } }), null);
  assert.equal(buildNotification({ recipientId: '7', actorId: 7, type: 'message', ids: { conversationId: 1 } }), null);
});

test('buildNotification: unknown type or missing recipient is null, never throws', () => {
  assert.equal(buildNotification({ recipientId: 1, actorId: 2, type: 'follow', ids: { actorId: 2 } }), null);
  assert.equal(buildNotification({ actorId: 2, type: 'like', ids: { actorId: 2 } }), null);
  assert.equal(buildNotification(), null);
  assert.equal(buildNotification(null), null);
});

test('buildNotification: an unknown-but-allowed type with a missing dedup key is null', () => {
  // A type we allow but without the ids it needs must not emit a row with an
  // empty dedup key, which would collide with every other such row.
  assert.equal(buildNotification({ recipientId: 1, actorId: 2, type: 'match', ids: { userAId: 1 } }), null);
});

// ── toApiNotification ─────────────────────────────────────────

test('toApiNotification: snake_case row becomes the camelCase API shape', () => {
  const out = toApiNotification({
    id: 11,
    type: 'match',
    read_at: null,
    created_at: '2026-07-04T00:00:00.000Z',
    actor_id: 4,
    actor_name: 'Sam',
    actor_image: 'https://x/y.png',
  });
  assert.deepEqual(out, {
    id: 11,
    type: 'match',
    read: false,
    createdAt: '2026-07-04T00:00:00.000Z',
    actor: { id: 4, name: 'Sam', image: 'https://x/y.png' },
  });
});

test('toApiNotification: read_at present means read=true; a null actor stays null', () => {
  const out = toApiNotification({
    id: 12, type: 'like', read_at: '2026-07-04T01:00:00.000Z',
    created_at: '2026-07-04T00:00:00.000Z', actor_id: null, actor_name: null, actor_image: null,
  });
  assert.equal(out.read, true);
  assert.equal(out.actor, null);
});

test('toApiNotification: a null row is null, not a crash', () => {
  assert.equal(toApiNotification(null), null);
});

// ── destinationFor ────────────────────────────────────────────

test('destinationFor: message goes to the thread with the actor', () => {
  assert.equal(destinationFor('message', 9), '/messages/9');
});

test('destinationFor: like goes to the actor profile', () => {
  assert.equal(destinationFor('like', 9), '/roommates/9');
});

test('destinationFor: match goes to the matches tab (no actor needed)', () => {
  assert.equal(destinationFor('match', null), '/matches');
});

test('destinationFor: an unknown type or missing actor is null', () => {
  assert.equal(destinationFor('message', null), null);
  assert.equal(destinationFor('follow', 9), null);
});

// ── labelFor ──────────────────────────────────────────────────

test('labelFor: each type names the actor, falling back to "Someone"', () => {
  assert.equal(labelFor('message', 'Sam'), 'Sam sent you a message');
  assert.equal(labelFor('like', 'Sam'), 'Sam liked you');
  assert.equal(labelFor('match', 'Sam'), 'Sam is now a match');
  assert.equal(labelFor('message', null), 'Someone sent you a message');
});

test('labelFor: an unknown type falls back to generic copy', () => {
  assert.equal(labelFor('follow', 'Sam'), 'New activity');
});
