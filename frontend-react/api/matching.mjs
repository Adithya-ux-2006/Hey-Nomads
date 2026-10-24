// Pure matching/scoring logic shared by the API and the Demo Mode transport.
// No express, no pg, no network: safe to import from tests and from the
// browser bundle.
export const MATCH_CATEGORIES = { lifestyle: 25, budget: 20, location: 20, movein: 15, interests: 10, habits: 10 };

export const ANSWERED_FIELDS = [
  'sleep_time', 'cleanliness', 'smoking', 'drinking', 'social_level', 'diet',
  'noise_tolerance', 'flat_type', 'pets', 'work_schedule', 'move_in_date',
  'city', 'neighbourhood', 'preferred_neighbourhood',
];

export const WEIGHT_KEYS = {
  lifestyle: 'lifestyle_weight', budget: 'budget_weight', location: 'location_weight',
  movein: 'movein_weight', interests: 'interests_weight', habits: 'habits_weight',
};

export const DEFAULT_MATCH_WEIGHTS = {
  lifestyle_weight: 0.25, budget_weight: 0.20, location_weight: 0.20,
  movein_weight: 0.15, interests_weight: 0.10, habits_weight: 0.10,
};

export function scoreCompatibility(ctx, candidateId, weights) {
  const me = answered(ctx.me);
  const them = answered(ctx.themById.get(candidateId));
  if (!me || !them) return { score: 0, breakdown: {}, reasons: [] };

  function answered(row) {
    if (!row) return row;
    if (row.onboarding_complete) return row;
    const blank = { ...row };
    for (const k of ANSWERED_FIELDS) blank[k] = null;
    blank.budget = null;
    return blank;
  }

  const costOf = (row) =>
    ctx.costByCity.get(String(row.moving_to || row.city || '').toLowerCase()) || 3;
  const meCost = costOf(me);
  const themCost = costOf(them);

  const reasons = [];
  const breakdown = {};

  let lifestyleScore = 0;
  const lifestyleMax = 25;

  if (me.sleep_time && them.sleep_time) {
    if (me.sleep_time === them.sleep_time) { lifestyleScore += 4; reasons.push({ text: 'Same sleep schedule', type: 'positive' }); }
    else if (me.sleep_time === 'flexible' || them.sleep_time === 'flexible') { lifestyleScore += 2; }
  }
  if (me.cleanliness && them.cleanliness) {
    const cdiff = Math.abs(me.cleanliness - them.cleanliness);
    lifestyleScore += Math.round(4 * (1 - cdiff / 4));
    if (cdiff <= 1) reasons.push({ text: 'Similar cleanliness preference', type: 'positive' });
  }
  if (me.smoking && them.smoking && me.smoking === them.smoking) { lifestyleScore += 3; if (me.smoking === 'no') reasons.push({ text: 'Both non-smokers', type: 'positive' }); }
  if (me.drinking && them.drinking && me.drinking === them.drinking) { lifestyleScore += 3; if (me.drinking === 'no') reasons.push({ text: 'Same drinking habits', type: 'positive' }); }
  if (me.social_level && them.social_level) {
    const socialMap = { introvert: 1, moderate: 2, extrovert: 3 };
    const sdiff = Math.abs((socialMap[me.social_level]||2) - (socialMap[them.social_level]||2));
    lifestyleScore += Math.round(3 * (1 - sdiff / 2));
    if (sdiff === 0) reasons.push({ text: 'Similar social energy', type: 'positive' });
  }
  if (me.diet && them.diet) {
    if (me.diet === them.diet) { lifestyleScore += 4; reasons.push({ text: `Both ${me.diet} eaters`, type: 'positive' }); }
    else if ((me.diet === 'veg' && them.diet === 'eggetarian') || (me.diet === 'eggetarian' && them.diet === 'veg')) { lifestyleScore += 3; }
  }
  if (me.noise_tolerance && them.noise_tolerance) {
    if (me.noise_tolerance === them.noise_tolerance) { lifestyleScore += 4; reasons.push({ text: 'Same noise tolerance', type: 'positive' }); }
    else { lifestyleScore += 1; }
  }
  breakdown.lifestyle = Math.min(lifestyleMax, lifestyleScore);

  let budgetScore = 10;
  const bA = parseInt(me.budget) || 0, bB = parseInt(them.budget) || 0;
  const idxA = bA / (meCost || 1), idxB = bB / (themCost || 1);
  const maxIdx = Math.max(idxA, idxB);
  if (maxIdx > 0 && bA > 0 && bB > 0) {
    const closeness = 1 - Math.abs(idxA - idxB) / maxIdx;
    budgetScore = Math.round(20 * closeness);
    if (closeness > 0.8) reasons.push({ text: 'Comfortable in the same price bracket', type: 'positive' });
  }
  breakdown.budget = Math.max(0, Math.min(20, budgetScore));

  let locationScore = 0;
  const cityA = (me.city||'').toLowerCase(), cityB = (them.city||'').toLowerCase();
  const movingA = (me.moving_to||'').toLowerCase(), movingB = (them.moving_to||'').toLowerCase();
  if (cityA && cityB && cityA === cityB) { locationScore += 12; reasons.push({ text: 'Same city', type: 'positive' }); }
  else if (movingA && movingB && movingA === movingB) { locationScore += 10; reasons.push({ text: 'Both moving to the same city', type: 'positive' }); }
  else if (cityA && movingB && cityA === movingB) { locationScore += 8; }
  else if (movingA && cityB && movingA === cityB) { locationScore += 8; }

  const nA = (me.preferred_neighbourhood||'').toLowerCase(), nB = (them.neighbourhood||'').toLowerCase();
  const nC = (them.preferred_neighbourhood||'').toLowerCase(), nD = (me.neighbourhood||'').toLowerCase();
  if ((nA && nB && nA === nB) || (nC && nD && nC === nD) || (nA && nC && nA === nC)) {
    locationScore += 8; reasons.push({ text: 'Preferred neighbourhoods align', type: 'positive' });
  }
  breakdown.location = Math.min(20, locationScore);

  let moveinScore = 0;
  if (me.move_in_date && them.move_in_date) {
    const diffDays = Math.abs(new Date(me.move_in_date) - new Date(them.move_in_date)) / (1000 * 60 * 60 * 24);
    if (diffDays <= 14) { moveinScore = 15; reasons.push({ text: 'Moving in around the same time', type: 'positive' }); }
    else if (diffDays <= 30) { moveinScore = 10; }
    else if (diffDays <= 60) { moveinScore = 5; }
    else { moveinScore = 2; }
  } else { moveinScore = 7; }
  breakdown.movein = moveinScore;

  let interestsScore = 0;
  const myInterests = me.interests || [];
  const theirInterests = them.interests || [];
  if (myInterests.length > 0 && theirInterests.length > 0) {
    const shared = myInterests.filter(i => theirInterests.includes(i));
    interestsScore = Math.min(10, shared.length * 2);
    if (shared.length >= 3) reasons.push({ text: `${shared.length} shared interests`, type: 'positive' });
    else if (shared.length >= 1) reasons.push({ text: `${shared.length} shared interest`, type: 'positive' });
  }
  breakdown.interests = interestsScore;

  let habitsScore = 0;
  if (me.flat_type && them.flat_type && me.flat_type === them.flat_type) { habitsScore += 3; reasons.push({ text: 'Same housing preference', type: 'positive' }); }
  if (me.pets && them.pets) {
    if (me.pets === them.pets) habitsScore += 2;
    else if (them.pets === 'okay' || me.pets === 'okay') habitsScore += 2;
  }
  if (me.work_schedule && them.work_schedule && me.work_schedule === them.work_schedule) { habitsScore += 3; reasons.push({ text: 'Same work schedule', type: 'positive' }); }
  if (me.languages && them.languages) {
    const myLangs = ctx.meLangs;
    const theirLangs = ctx.langsById.get(candidateId) || [];
    const sharedLangs = myLangs.filter(l => theirLangs.includes(l));
    if (sharedLangs.length > 0) { habitsScore += 2; reasons.push({ text: `Share ${sharedLangs.join(', ')}`, type: 'positive' }); }
  }
  breakdown.habits = Math.min(10, habitsScore);

  const w = weights || DEFAULT_MATCH_WEIGHTS;
  const totalWeight = Object.values(WEIGHT_KEYS).reduce((sum, k) => sum + (Number(w[k]) || 0), 0);

  const total = Math.min(100, Math.round(
    Object.entries(MATCH_CATEGORIES).reduce((sum, [key, ceiling]) => {
      const wk = (Number(w[WEIGHT_KEYS[key]]) || 0) / (totalWeight || 1);
      return sum + (Number(breakdown[key]) / ceiling) * wk * 100;
    }, 0)
  ));

  return { score: total, breakdown, reasons };
}
