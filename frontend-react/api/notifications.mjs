// Notification types and the pure helpers that build/normalize them. No
// express, no pg, so the offline gate suite can import and assert directly.
//
// Design: one notification row per (recipient, type, dedup_key). dedup_key is
// what makes event handling idempotent — a retried webhook or a double-tapped
// swipe cannot produce two bells for the same underlying event.

export const NOTIFICATION_TYPES = ['message', 'like', 'match'];

// Stable, collision-free dedup key for a given event. message => per
// conversation so a chatty thread is one row that bumps, like => per actor so
// re-liking does not stack, match => per pair so it can only fire once.
export function dedupKeyFor(type, ids = {}) {
  if (type === 'message') {
    if (ids.conversationId == null) return null;
    return `conversation:${ids.conversationId}`;
  }
  if (type === 'like') {
    if (ids.actorId == null) return null;
    return `actor:${ids.actorId}`;
  }
  if (type === 'match') {
    const a = ids.userAId, b = ids.userBId;
    if (a == null || b == null) return null;
    const lo = Math.min(Number(a), Number(b));
    const hi = Math.max(Number(a), Number(b));
    return `pair:${lo}-${hi}`;
  }
  return null;
}

// Returns a fully-formed notification row (without id/created_at, which the DB
// supplies) or null when the input is not a notification we can emit. Never
// throws on bad input: a caller that has already committed the underlying
// message/swipe must not have its request fail because notification metadata
// was malformed.
export function buildNotification(input) {
  // An explicit null is not covered by the `{}` default, and destructuring
  // null throws — which would break a caller that already committed the
  // underlying message/swipe. Guard first so bad input degrades to null.
  const { recipientId, actorId, type, ids } = input || {};
  if (recipientId == null) return null;
  if (!NOTIFICATION_TYPES.includes(type)) return null;
  // Self-notifications are noise; a user does not need a bell for their own
  // like/message/match acting on themselves.
  if (Number(recipientId) === Number(actorId)) return null;
  const key = dedupKeyFor(type, ids);
  if (!key) return null;
  return {
    recipientId: Number(recipientId),
    actorId: actorId == null ? null : Number(actorId),
    type,
    dedupKey: key,
  };
}

// Normalize a DB row into the shape the API returns. Accepts snake_case (what
// pg gives us) so callers can pass result.rows straight through. A missing or
// null read_at means unread.
export function toApiNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    read: row.read_at != null,
    createdAt: row.created_at,
    actor: row.actor_id == null ? null : {
      id: row.actor_id,
      name: row.actor_name ?? null,
      image: row.actor_image ?? null,
    },
  };
}

// Where a tap on a given notification type should navigate. Single source of
// truth so the bell UI and the notifications list cannot disagree about where
// a row leads. message -> the thread with the actor; like -> their profile;
// match -> the matches tab.
export function destinationFor(type, actorId) {
  // match routes to the matches tab regardless of actor: a match is symmetric
  // and its notification may carry a null actor, so the actor guard below must
  // not swallow it.
  if (type === 'match') return '/matches';
  if (actorId == null) return null;
  if (type === 'message') return `/messages/${actorId}`;
  if (type === 'like') return `/roommates/${actorId}`;
  return null;
}

// Human-readable, non-judgmental copy for each type. Kept here (not in JSX) so
// the wording is testable and stays identical wherever it renders.
export function labelFor(type, actorName) {
  const who = actorName || 'Someone';
  if (type === 'message') return `${who} sent you a message`;
  if (type === 'like') return `${who} liked you`;
  if (type === 'match') return `${who} is now a match`;
  return 'New activity';
}
