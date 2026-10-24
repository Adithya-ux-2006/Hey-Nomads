import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { enterDemo } from '../lib/demoMode';
import { startTour, TOUR_STEPS } from '../lib/tour';

// Demo Mode is a guided tour of the real screens, not a second product.
// This file is only the entry point now: landing on /demo IS starting the
// walkthrough - the flag is set, the canned transport goes live, and the tour
// opens on the Feed with its coach-mark. No launcher screen, no second flow:
// every "Try the demo account" button and deep link lands here directly.
//
// The route stays public on purpose: demo mode fetches nothing and creates no
// session, so it must not inherit whatever account happens to be signed in on
// this browser (enterDemo drops a stored session before anything renders).
export default function DemoModePage() {
  const navigate = useNavigate();

  useEffect(() => {
    enterDemo();
    startTour(0);
    navigate(TOUR_STEPS[0].path);
  }, [navigate]);

  return null;
}
