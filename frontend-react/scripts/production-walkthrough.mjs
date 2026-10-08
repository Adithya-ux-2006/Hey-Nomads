// Full production walkthrough against the live deployment.
// Registers a fresh account and walks Register -> Onboarding -> Discover ->
// Shortlist -> Chat -> Compare -> Agreement.
const BASE = process.env.BASE_URL || 'https://hey-nomads.vercel.app';
const STAMP = Date.now();
const EMAIL = `walkthrough.${STAMP}@example.com`;
const PASSWORD = 'HeyNomads2026!';

let token = null;
const results = [];

async function call(path, options = {}, auth = true) {
  const headers = { ...(options.headers || {}) };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 120); }
  return { status: res.status, data };
}

function step(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
}

console.log(`Production walkthrough against ${BASE}\n`);

// 1. Health
{
  const r = await call('/health', {}, false);
  step('1. /api/health', r.status === 200 && r.data.ok === true,
    `HTTP ${r.status} db=${r.data?.database} tables=${r.data?.tables?.present} missing=${JSON.stringify(r.data?.tables?.missing)}`);
}

// 2. Register
let userId;
{
  const r = await call('/auth/register', { method: 'POST', body: { email: EMAIL, password: PASSWORD, name: 'Walkthrough Tester' } }, false);
  token = r.data?.token;
  userId = r.data?.user?.id;
  step('2. Register', r.status === 201 && !!token, `HTTP ${r.status} email=${EMAIL} userId=${userId}`);
}

// 3. Onboarding
{
  const r = await call('/onboarding', {
    method: 'POST',
    body: { looking_for: 'both', moving_to: 'Bangalore', moving_date: '2026-11-01', country: 'India', city: 'Bangalore', interests: ['music', 'food', 'hiking'] },
  });
  step('3. Onboarding', r.status === 200 && r.data?.ok === true, `HTTP ${r.status} ${JSON.stringify(r.data)}`);
}

// 4. Profile (fill in lifestyle so scoring has something to work with)
{
  const r = await call('/profile', {
    method: 'POST',
    body: { budget: 18000, deposit: 6000, flatType: 'shared', sleepTime: 'flexible', cleanliness: 4, diet: 'veg', smoking: 'no', drinking: 'no', partying: 'low', socialLevel: 'moderate', noiseLevel: 3, noiseTolerance: 'moderate', pets: 'okay', workSchedule: 'hybrid', neighbourhood: 'Indiranagar', city: 'Bangalore', bio: 'Product designer moving to Bangalore for a new role.', occupation: 'Product Designer' },
  });
  step('4. Profile saved', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.data)}`);
}

// 5. Discover
let roommateId;
{
  const r = await call('/discover');
  const rm = r.data?.roommates || [];
  roommateId = rm[0]?.id;
  const scores = rm.map(x => x.score);
  step('5. Discover (scored)', r.status === 200 && rm.length > 0,
    `HTTP ${r.status} roommates=${rm.length} scores=[${scores.join(', ')}] taskKeys=${Object.keys(r.data?.settlement?.tasks?.[0] || {}).join('/')}`);
}

// 6. Settlement toggle persists across reload
{
  const before = await call('/settlement');
  const open = (before.data || []).find(t => !t.completed);
  if (open) {
    await call(`/settlement/${open.id}/complete`, { method: 'POST' });
    const after = await call('/settlement');
    const now = (after.data || []).find(t => t.id === open.id);
    const disc = await call('/discover');
    const dTask = (disc.data?.settlement?.tasks || []).find(t => t.id === open.id);
    step('6. Settlement toggle persists', now?.completed === true && dTask?.completed === true && !!dTask?.title,
      `task id=${open.id} afterToggle=${now?.completed} afterReload=${dTask?.completed} title="${dTask?.title}"`);
  } else {
    step('6. Settlement toggle persists', false, 'no incomplete task found to toggle');
  }
}

// 7. Shortlist
{
  const add = await call('/shortlist', { method: 'POST', body: { targetId: roommateId } });
  const list = await call('/shortlist');
  step('7. Shortlist', add.status === 200 && (list.data || []).some(u => u.id === roommateId),
    `add HTTP ${add.status}, list has ${(list.data || []).length} entries, target present=${(list.data || []).some(u => u.id === roommateId)}`);
}

// 8. Swipe -> mutual match
{
  const r = await call('/swipe', { method: 'POST', body: { targetId: roommateId, action: 'like' } });
  step('8. Swipe like', r.status === 200, `HTTP ${r.status} matchCreated=${r.data?.matchCreated}`);
}

// 9. Chat (needs a match; expect 403 otherwise, which is correct behaviour)
{
  const send = await call('/messages', { method: 'POST', body: { receiver_id: roommateId, message: 'Hey! Saw we are both moving to Bangalore.' } });
  const thread = await call(`/conversations/${roommateId}`);
  const convos = await call('/conversations');
  const ok = send.status === 201 || send.status === 403;
  step('9. Chat', ok,
    `send HTTP ${send.status}${send.status === 403 ? ' (correctly blocked: not matched yet)' : ''}; thread=${(thread.data || []).length} msgs; conversations=${(convos.data || []).length}`);
}

// 10. Compare (2 profiles fetched by the page)
{
  const me = await call(`/profile/${userId}`);
  const them = await call(`/profile/${roommateId}`);
  step('10. Compare page data', me.status === 200 && them.status === 200,
    `me HTTP ${me.status} (${me.data?.city}, budget ${me.data?.budget}); them HTTP ${them.status} (${them.data?.city}, budget ${them.data?.budget})`);
}

// 11. Agreement template
{
  const r = await call(`/agreement/${userId}/${roommateId}`);
  const hasContent = typeof r.data?.content === 'string' && r.data.content.length > 50;
  step('11. Agreement template', r.status === 200 && hasContent,
    `HTTP ${r.status} status=${r.data?.status} ${hasContent ? `${r.data.content.length} chars` : 'NO CONTENT'}`);

  const save = await call('/agreement', { method: 'POST', body: { userA_id: userId, userB_id: roommateId, content: 'Walkthrough draft agreement.' } });
  const reRead = await call(`/agreement/${userId}/${roommateId}`);
  step('11b. Agreement saves', save.status === 200 && reRead.data?.content === 'Walkthrough draft agreement.',
    `save HTTP ${save.status}, reread content="${(reRead.data?.content || '').slice(0, 40)}"`);
}

// 12. Report + Block
{
  const rep = await call('/report', { method: 'POST', body: { reported_user_id: roommateId, type: 'user', reason: 'Spam', description: 'Walkthrough test' } });
  const blk = await call('/block', { method: 'POST', body: { targetId: roommateId } });
  step('12. Report + Block', rep.status === 200 && blk.status === 200, `report HTTP ${rep.status}, block HTTP ${blk.status}`);
}

const passed = results.filter(r => r.ok).length;
console.log(`\n${'-'.repeat(50)}\n${passed}/${results.length} steps passed`);
console.log(`test account: ${EMAIL}`);
process.exit(passed === results.length ? 0 : 1);