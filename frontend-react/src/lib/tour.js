// The walkthrough's coach-marks. Steps point at real screens and real elements
// (via data-tour attributes), so the guidance sits on the interface the visitor
// is already looking at instead of on a separate menu page.
//
// State follows the same subscribe pattern as demoMode.js: a module-level flag
// plus listeners, so Layout can mount one overlay for every screen without
// prop-drilling through the router.
//
// Copy is written as Do / Don't pairs. A single "here's the feature" sentence
// tells people what exists; the pair tells them what to actually do, which is
// what a first-time visitor cannot infer from the screen alone.
export const TOUR_STEPS = [
  {
    path: '/roommates',
    anchor: 'feed-card',
    title: 'Browse and decide',
    do: 'Read the reason chips, then tap the heart to like or the cross to pass.',
    dont: "Don't skip the reasons — they explain why this person was recommended.",
    cta: 'Next: Matches',
  },
  {
    path: '/matches',
    anchor: 'match-card',
    title: 'Matches are mutual',
    do: 'Message a match or open an Agreement straight from the row.',
    dont: "Don't expect a match from a one-sided like — it only appears once they like you back.",
    cta: 'Next: Messages',
  },
  {
    path: '/messages',
    anchor: 'conversation-list',
    title: 'Agree the details',
    do: 'Use chat to settle rent, move-in date and house rules before committing.',
    dont: "Don't move anyone in without an Agreement both of you have read.",
    cta: 'Finish tour',
  },
];

let active = false;
let index = 0;
const listeners = new Set();

function emit() {
  const snapshot = { active, index };
  listeners.forEach(fn => fn(snapshot));
}

export const isTourActive = () => active;

export function startTour(step = 0) {
  active = true;
  index = Math.max(0, Math.min(step, TOUR_STEPS.length - 1));
  emit();
}

export function endTour() {
  if (!active) return;
  active = false;
  index = 0;
  emit();
}

export function nextTour() {
  if (index >= TOUR_STEPS.length - 1) {
    endTour();
    return;
  }
  index += 1;
  emit();
}

export function prevTour() {
  if (index <= 0) return;
  index -= 1;
  emit();
}

export function onTourChange(fn) {
  listeners.add(fn);
  // Hand over the current state immediately. A screen change remounts Layout
  // and with it the overlay; without this the fresh instance would sit at its
  // inactive initial value until the next emit, and the coach-mark would
  // disappear the moment the tour moved to a new screen.
  fn({ active, index });
  return () => listeners.delete(fn);
}
