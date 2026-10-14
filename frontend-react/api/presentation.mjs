// Competition presentation API.
//
// A live walkthrough that runs against the real engine, on isolated synthetic
// accounts. Everything here is namespaced to `qa.present.*`, which the shared
// classifier already treats as a test account, so those rows never reach a real
// feed, can never be liked or matched by a genuine user, and cannot be read
// through the ordinary profile routes. Isolation is a property of the account
// rules the product already enforces - not a flag a request can carry.
//
// The cohort itself is built through the ordinary public endpoints
// (/auth/register, /onboarding, /profile) by the presentation page, so this
// module owns no fixture-creation surface. What it owns is authorization: a
// scoped token, issued only once the cohort exists, that every route below
// re-checks against the namespace.
//
// Mounted from api/index.js with the helpers it must not duplicate: the scorer,
// the weight loader and the pool.

const NS = 'qa.present.';
const ROLES = ['host', 'ada', 'noor', 'sam'];
const EMAILS = ROLES.map(r => `${NS}${r}@gmail.com`);
const emailFor = role => `${NS}${role}@gmail.com`;

// Greetings the cohort opens a new thread with, picked by id so the same
// candidate always says the same thing across runs.
const GREETINGS = [
  'Hey! Really glad you swiped right - I have been looking for someone tidy.',
  'Hi! The room is still free. Fancy a quick chat about move-in dates?',
  'Hello! Your budget lines up with mine, which never happens.',
];

export function mountPresentation(app, deps) {
  const { query, jwt, JWT_SECRET, Sentry, rateLimit,
    getMatchWeights, loadScoreContext, scoreCompatibility, calcCompatibility } = deps;

  // Signed here rather than through signToken(): that helper issues the
  // product's ordinary session shape and must stay exactly as it is.
  const token = userId => jwt.sign({ userId, scope: 'presentation' }, JWT_SECRET, { expiresIn: '30d' });

  // Both halves are checked: the scope claim says "presentation session", the
  // email namespace says "this presentation". A token for any other account is
  // refused even if a scope claim were somehow present on it.
  async function presentationAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    let decoded;
    try {
      decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (decoded.scope !== 'presentation') {
      return res.status(403).json({ error: 'Presentation session required' });
    }
    try {
      const member = await query(
        `SELECT 1 FROM users WHERE id = $1 AND email LIKE $2 || '%'`,
        [decoded.userId, NS]
      );
      if (member.rows.length === 0) {
        return res.status(403).json({ error: 'Not a presentation account' });
      }
    } catch (err) {
      Sentry.captureException(err);
      return res.status(500).json({ error: 'Could not verify the presentation session' });
    }
    req.userId = decoded.userId;
    next();
  }

  // The shared limiter keys on body.email, which this request deliberately
  // omits, so every presentation start lands in one bucket. That is the intent:
  // the endpoint mints tokens, so what needs bounding is the overall rate.
  const startLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: 'The presentation is starting too quickly. Try again in a minute.',
  });

  const fail = (res, err, fallback) => {
    Sentry.captureException(err);
    res.status(500).json({ error: fallback });
  };

  // Issues the scoped token. It creates nothing: the cohort has to exist and
  // have finished onboarding first, and until then the answer is ready:false so
  // the page can build it through the product's own registration flow.
  app.post('/api/presentation/session', startLimit, async (req, res) => {
    try {
      const rows = (await query(
        'SELECT id, email, name, onboarding_complete FROM users WHERE email = ANY($1::text[])',
        [EMAILS]
      )).rows;
      const host = rows.find(r => r.email === emailFor('host'));
      const ready = rows.length === EMAILS.length
        && Boolean(host)
        && rows.every(r => r.onboarding_complete);
      if (!ready) return res.json({ ready: false });
      res.json({
        ready: true,
        token: token(host.id),
        user: { id: host.id, name: host.name },
      });
    } catch (err) {
      fail(res, err, 'Failed to start the presentation session');
    }
  });

  // Repeatable walkthrough: clear every like, match and thread the cohort owns,
  // then hand back a fresh token. Both endpoints of every deleted row must be
  // cohort rows, so a genuine account that ever sits beside one is untouched.
  app.post('/api/presentation/reset', presentationAuth, async (req, res) => {
    try {
      const ids = (await query(
        `SELECT id FROM users WHERE email LIKE $1 || '%'`, [NS]
      )).rows.map(r => r.id);
      if (ids.length === 0) {
        return res.status(404).json({ error: 'The presentation cohort is missing' });
      }
      await query(
        'DELETE FROM swipes WHERE swiper_id = ANY($1::int[]) AND swiped_id = ANY($1::int[])',
        [ids]
      );
      await query(
        'DELETE FROM matches WHERE user_a_id = ANY($1::int[]) AND user_b_id = ANY($1::int[])',
        [ids]
      );
      // Only threads whose membership is entirely cohort; deleting them cascades
      // to conversation_members and messages.
      await query(
        `DELETE FROM conversations WHERE id IN (
           SELECT cm1.conversation_id FROM conversation_members cm1
           JOIN conversation_members cm2 ON cm2.conversation_id = cm1.conversation_id
           WHERE cm1.user_id = ANY($1::int[]) AND cm2.user_id = ANY($1::int[]))`,
        [ids]
      );
      res.json({ ok: true, token: token(req.userId) });
    } catch (err) {
      fail(res, err, 'Failed to reset the presentation');
    }
  });

  // The cohort's own feed. Same scorer, same weights, same ordering as
  // /api/roommates/recommended; only the candidate set differs, because
  // realOnlySql would - correctly - hide these accounts from the real pool.
  app.get('/api/presentation/discover', presentationAuth, async (req, res) => {
    try {
      const rows = (await query(
        `SELECT u.id, u.name, u.age, u.interests, u.moving_to, u.country, u.university,
                u.created_at,
                p.bio, p.occupation, p.city, p.profile_image, p.budget, p.flat_type,
                p.move_in_date, p.sleep_time, p.cleanliness, p.diet, p.smoking,
                p.drinking, p.noise_tolerance, p.social_level, p.pets, p.work_schedule, p.gender
           FROM users u
           LEFT JOIN profiles p ON u.id = p.user_id
          WHERE u.id != $1 AND u.email LIKE $2 || '%' AND u.onboarding_complete
          ORDER BY u.created_at DESC`,
        [req.userId, NS]
      )).rows;

      // Decided cards leave the feed, exactly as they do for a real user.
      const swiped = await query('SELECT swiped_id FROM swipes WHERE swiper_id = $1', [req.userId]);
      const swipedIds = new Set(swiped.rows.map(r => r.swiped_id));
      const candidates = rows.filter(r => !swipedIds.has(r.id));

      const weights = await getMatchWeights();
      const ctx = await loadScoreContext(req.userId, candidates.map(c => c.id));
      const cards = candidates.map(c => ({ ...c, ...scoreCompatibility(ctx, c.id, weights) }));
      cards.sort((a, b) =>
        b.score - a.score || new Date(b.created_at) - new Date(a.created_at) || a.id - b.id);
      res.json(cards);
    } catch (err) {
      fail(res, err, 'Failed to load the presentation feed');
    }
  });

  app.get('/api/presentation/candidates/:id', presentationAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid candidate' });
      const result = await query(
        `SELECT u.id, u.name, u.age, u.interests, u.moving_to, u.country, u.university,
                p.bio, p.occupation, p.city, p.profile_image, p.budget, p.flat_type,
                p.move_in_date, p.sleep_time, p.cleanliness, p.diet, p.smoking,
                p.drinking, p.noise_tolerance, p.social_level, p.pets, p.work_schedule, p.gender
           FROM users u
           LEFT JOIN profiles p ON u.id = p.user_id
          WHERE u.id = $1 AND u.email LIKE $2 || '%'`,
        [id, NS]
      );
      // 404 rather than 403: a 403 would confirm the id exists.
      if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });

      const weights = await getMatchWeights();
      const { score, breakdown, reasons } = await calcCompatibility(req.userId, id, weights);
      const [matched, mine] = await Promise.all([
        query(
          `SELECT 1 FROM matches WHERE status = 'matched' AND
           ((user_a_id = $1 AND user_b_id = $2) OR (user_b_id = $1 AND user_a_id = $2)) LIMIT 1`,
          [req.userId, id]
        ),
        query('SELECT action FROM swipes WHERE swiper_id = $1 AND swiped_id = $2', [req.userId, id]),
      ]);
      res.json({
        ...result.rows[0],
        score, breakdown, reasons,
        is_match: matched.rows.length > 0,
        my_action: mine.rows[0]?.action || null,
      });
    } catch (err) {
      fail(res, err, 'Failed to load that candidate');
    }
  });

  // One participant, so the cohort's side of the courtship is written here
  // instead of waited for. Everything else is the real thing: the same mutual
  // check /api/swipe runs, the same scorer for the score, the same match and
  // conversation rows the product creates for a genuine pair.
  app.post('/api/presentation/like', presentationAuth, async (req, res) => {
    try {
      const targetId = parseInt(req.body?.targetId, 10);
      const action = req.body?.action === 'pass' ? 'pass' : 'like';
      if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'targetId required' });
      if (targetId === req.userId) return res.status(400).json({ error: 'Cannot swipe on yourself' });

      const target = await query(
        'SELECT id FROM users WHERE id = $1 AND email LIKE $2 || \'%\'',
        [targetId, NS]
      );
      if (target.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });

      await query(
        `INSERT INTO swipes (swiper_id, swiped_id, action) VALUES ($1, $2, $3)
         ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET action = $3, created_at = CURRENT_TIMESTAMP`,
        [req.userId, targetId, action]
      );

      let matchCreated = false;
      if (action === 'like') {
        await query(
          `INSERT INTO swipes (swiper_id, swiped_id, action) VALUES ($1, $2, 'like')
           ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET action = 'like', created_at = CURRENT_TIMESTAMP`,
          [targetId, req.userId]
        );
        const mutual = await query(
          `SELECT 1 FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'`,
          [targetId, req.userId]
        );
        if (mutual.rows.length > 0) {
          const ua = Math.min(req.userId, targetId);
          const ub = Math.max(req.userId, targetId);
          const weights = await getMatchWeights();
          const { score } = await calcCompatibility(req.userId, targetId, weights);
          const existing = await query(
            'SELECT id FROM matches WHERE user_a_id = $1 AND user_b_id = $2', [ua, ub]
          );
          if (existing.rows.length === 0) {
            await query(
              `INSERT INTO matches (user_a_id, user_b_id, compatibility_score, status)
               VALUES ($1, $2, $3, 'matched')`,
              [ua, ub, score]
            );
            const conv = await query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
            const convId = conv.rows[0].id;
            await query(
              'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
              [convId, ua, ub]
            );
            // The cohort opens the thread, so a fresh match is never an empty
            // room on stage. A normal message row from a normal account.
            await query(
              'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)',
              [convId, targetId, GREETINGS[targetId % GREETINGS.length]]
            );
            await query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [convId]);
            matchCreated = true;
          }
        }
      }
      res.json({ ok: true, matchCreated });
    } catch (err) {
      fail(res, err, 'Failed to record your decision');
    }
  });

  app.get('/api/presentation/matches', presentationAuth, async (req, res) => {
    try {
      const result = await query(
        `SELECT m.*,
                CASE WHEN m.user_a_id = $1 THEN m.user_b_id ELSE m.user_a_id END AS partner_id,
                u.name AS partner_name,
                p.profile_image AS partner_image,
                p.city AS partner_city,
                p.occupation AS partner_occupation,
                p.bio AS partner_bio
           FROM matches m
           JOIN users u ON u.id = CASE WHEN m.user_a_id = $1 THEN m.user_b_id ELSE m.user_a_id END
           LEFT JOIN profiles p ON p.user_id = u.id
          WHERE (m.user_a_id = $1 OR m.user_b_id = $1) AND m.status = 'matched'
          ORDER BY m.updated_at DESC`,
        [req.userId]
      );
      res.json(result.rows);
    } catch (err) {
      fail(res, err, 'Failed to load matches');
    }
  });

  app.get('/api/presentation/chat/:peerId', presentationAuth, async (req, res) => {
    try {
      const peerId = parseInt(req.params.peerId, 10);
      if (!Number.isInteger(peerId)) return res.status(400).json({ error: 'Invalid conversation' });
      const conv = await query(
        `SELECT c.id FROM conversations c
         JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
         JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2`,
        [req.userId, peerId]
      );
      if (conv.rows.length === 0) {
        // Membership above is the authorisation. A matched pair with no thread
        // yet is genuinely empty and still gets []; everyone else is refused.
        const match = await query(
          `SELECT 1 FROM matches WHERE status = 'matched' AND
           ((user_a_id = $1 AND user_b_id = $2) OR (user_b_id = $1 AND user_a_id = $2)) LIMIT 1`,
          [req.userId, peerId]
        );
        if (match.rows.length === 0) {
          return res.status(403).json({ error: 'You can only read conversations with your matches' });
        }
        return res.json([]);
      }
      const messages = await query(
        `SELECT m.id, m.sender_id, m.content, m.created_at, u.name AS sender_name
           FROM messages m
           JOIN users u ON u.id = m.sender_id
          WHERE m.conversation_id = $1
          ORDER BY m.created_at ASC`,
        [conv.rows[0].id]
      );
      res.json(messages.rows);
    } catch (err) {
      fail(res, err, 'Failed to load messages');
    }
  });

  app.post('/api/presentation/chat', presentationAuth, async (req, res) => {
    try {
      const receiverId = parseInt(req.body?.peerId, 10);
      const message = String(req.body?.message || '').trim();
      if (!Number.isInteger(receiverId) || !message) {
        return res.status(400).json({ error: 'peerId and message required' });
      }
      const peer = await query(
        'SELECT id FROM users WHERE id = $1 AND email LIKE $2 || \'%\'',
        [receiverId, NS]
      );
      if (peer.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });

      const conv = await query(
        `SELECT c.id FROM conversations c
         JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
         JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2`,
        [req.userId, receiverId]
      );

      let conversationId;
      if (conv.rows.length === 0) {
        const match = await query(
          `SELECT 1 FROM matches WHERE status = 'matched' AND
           ((user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)) LIMIT 1`,
          [req.userId, receiverId]
        );
        if (match.rows.length === 0) {
          return res.status(403).json({ error: 'You can only message matched users' });
        }
        const created = await query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
        conversationId = created.rows[0].id;
        await query(
          'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
          [conversationId, req.userId, receiverId]
        );
      } else {
        conversationId = conv.rows[0].id;
      }

      const sent = await query(
        'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, content, created_at',
        [conversationId, req.userId, message]
      );
      await query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [conversationId]);
      res.status(201).json(sent.rows[0]);
    } catch (err) {
      fail(res, err, 'Failed to send message');
    }
  });
}
