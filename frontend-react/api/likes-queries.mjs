// Pure SQL builders for the Likes lists.
//
// Kept free of express, pg and env so the offline gate suite can import them
// and assert the two filters that decide who a real user is ever shown: the
// account-kind fragment (passed in from realOnlySql(), exactly as the feed
// does it) and the blocked-pair exclusion in both directions.
//
// Both builders take the caller as $1 and a parameterless real-account
// fragment assembled from constants — never caller input.

// Blocked pairs, either direction, identical to the feed's own exclusion.
const BLOCKED_CLAUSE = `AND s.swiped_id NOT IN (
  SELECT blocked_id FROM blocks WHERE blocker_id = $1
  UNION
  SELECT blocker_id FROM blocks WHERE blocked_id = $1
)`;

const BLOCKED_SENDER_CLAUSE = `AND s.swiper_id NOT IN (
  SELECT blocked_id FROM blocks WHERE blocker_id = $1
  UNION
  SELECT blocker_id FROM blocks WHERE blocked_id = $1
)`;

/**
 * Likes I have sent: every `like` swipe I wrote, newest first, with the
 * target's public profile fields and whether a live match exists today.
 * Non-real targets and blocked pairs drop out of the result set.
 */
export function sentLikesQuery(userId, realFilter) {
  return {
    params: [userId],
    sql: `SELECT s.swiped_id AS user_id,
                 u.name,
                 p.profile_image,
                 p.city,
                 p.occupation,
                 s.created_at AS liked_at,
                 m.id AS match_id,
                 (m.id IS NOT NULL) AS matched
          FROM swipes s
          JOIN users u ON u.id = s.swiped_id
          LEFT JOIN profiles p ON p.user_id = s.swiped_id
          LEFT JOIN matches m
            ON m.user_a_id = LEAST($1, s.swiped_id)
           AND m.user_b_id = GREATEST($1, s.swiped_id)
           AND m.status = 'matched'
          WHERE s.swiper_id = $1
            AND s.action = 'like'
            AND ${realFilter}
            ${BLOCKED_CLAUSE}
          ORDER BY s.created_at DESC`,
  };
}

/**
 * Incoming likes I have not answered: `like` swipes aimed at me from which I
 * have no swipe of my own (so mutual likes are already matches and passes
 * are already decided), same eligibility rules as every other surface.
 */
export function receivedLikesQuery(userId, realFilter) {
  return {
    params: [userId],
    sql: `SELECT s.swiper_id AS user_id,
                 u.name,
                 p.profile_image,
                 p.city,
                 p.occupation,
                 s.created_at AS liked_at
          FROM swipes s
          JOIN users u ON u.id = s.swiper_id
          LEFT JOIN profiles p ON p.user_id = s.swiper_id
          WHERE s.swiped_id = $1
            AND s.action = 'like'
            AND NOT EXISTS (
              SELECT 1 FROM swipes mine
              WHERE mine.swiper_id = $1 AND mine.swiped_id = s.swiped_id
            )
            AND ${realFilter}
            ${BLOCKED_SENDER_CLAUSE}
          ORDER BY s.created_at DESC`,
  };
}
