// MOCKED / OFFLINE unit tests — pure SQL builders, no database.
// The predicates asserted here are the ones gate G5 re-runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sentLikesQuery, receivedLikesQuery } from '../../api/likes-queries.mjs';
import { realAccountSql } from '../../api/account-kind.mjs';

const UID = 7;
const FILTER_STORED = realAccountSql('u', true);
const FILTER_HEURISTIC = realAccountSql('u', false);

// Every eligibility rule both routes must carry, regardless of schema state.
const carriesRealAccountFilter = sql => sql.includes(FILTER_STORED);
const carriesHeuristicFilter = sql => sql.includes(FILTER_HEURISTIC);
const carriesBlockedFilter = sql =>
  sql.includes('FROM blocks WHERE blocker_id = $1') &&
  sql.includes('FROM blocks WHERE blocked_id = $1') &&
  sql.includes('UNION');

for (const [name, build] of [
  ['sent', (f) => sentLikesQuery(UID, f)],
  ['received', (f) => receivedLikesQuery(UID, f)],
]) {
  test(`${name}: parameters are exactly the caller id`, () => {
    const q = build(FILTER_STORED);
    assert.deepEqual(q.params, [UID]);
  });

  test(`${name}: carries the stored-column real-account filter`, () => {
    assert.ok(carriesRealAccountFilter(build(FILTER_STORED).sql));
  });

  test(`${name}: carries the pre-migration heuristic filter`, () => {
    assert.ok(carriesHeuristicFilter(build(FILTER_HEURISTIC).sql));
  });

  test(`${name}: excludes blocked pairs in both directions`, () => {
    assert.ok(carriesBlockedFilter(build(FILTER_STORED).sql));
  });

  test(`${name}: positive control — a builder without the filter fails the same predicate`, () => {
    // Same builder, fragment deliberately dropped. The predicates above are
    // not vacuous: they reject this, so passing them means the real SQL has it.
    const unf = build('1 = 1').sql;
    assert.ok(!carriesRealAccountFilter(unf));
    assert.ok(!carriesHeuristicFilter(unf));
  });

  test(`${name}: only like swipes aimed at the caller are in scope`, () => {
    const sql = build(FILTER_STORED).sql;
    assert.ok(sql.includes("s.action = 'like'"));
    assert.ok(sql.includes(name === 'sent' ? 's.swiper_id = $1' : 's.swiped_id = $1'));
  });

  test(`${name}: newest first`, () => {
    assert.ok(build(FILTER_STORED).sql.includes('ORDER BY s.created_at DESC'));
  });
}

test('received: a swipe I already answered drops out (no duplicate rows)', () => {
  const sql = receivedLikesQuery(UID, FILTER_STORED).sql;
  assert.ok(sql.includes('NOT EXISTS'));
  assert.ok(sql.includes('mine.swiper_id = $1 AND mine.swiped_id = s.swiped_id'));
});

test('sent: a live match is detected via LEAST/GREATEST pair, not status text', () => {
  const sql = sentLikesQuery(UID, FILTER_STORED).sql;
  assert.ok(sql.includes('m.user_a_id = LEAST($1, s.swiped_id)'));
  assert.ok(sql.includes('m.user_b_id = GREATEST($1, s.swiped_id)'));
  assert.ok(sql.includes("m.status = 'matched'"));
  assert.ok(sql.includes('s.swiped_id AS user_id'), 'row must expose the target id for message links');
});
